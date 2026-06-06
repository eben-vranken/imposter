import { redis, metaKey, playersKey, ROOM_TTL_SECONDS } from "./redis";
import {
  WORDS,
  NUMBER_CATEGORIES,
  pick,
} from "./content";
import type {
  GameMode,
  Player,
  RoomMeta,
  Round,
  RoomView,
  PublicPlayer,
  PlayerReveal,
} from "./types";

// A player counts as "connected" if we've seen a poll within this window.
const CONNECTED_MS = 15_000;
// Players we haven't heard from for this long are removed entirely.
const PRUNE_MS = 120_000;

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ"; // no I/O to avoid confusion

function randomCode(): string {
  let s = "";
  for (let i = 0; i < 4; i++) {
    s += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return s;
}

function newId(): string {
  return crypto.randomUUID();
}

async function refreshTtl(code: string): Promise<void> {
  await Promise.all([
    redis.expire(metaKey(code), ROOM_TTL_SECONDS),
    redis.expire(playersKey(code), ROOM_TTL_SECONDS),
  ]);
}

async function getMeta(code: string): Promise<RoomMeta | null> {
  return (await redis.get<RoomMeta>(metaKey(code))) ?? null;
}

async function setMeta(meta: RoomMeta): Promise<void> {
  await redis.set(metaKey(meta.code), meta, { ex: ROOM_TTL_SECONDS });
}

async function getPlayers(code: string): Promise<Record<string, Player>> {
  return (await redis.hgetall<Record<string, Player>>(playersKey(code))) ?? {};
}

async function setPlayer(code: string, player: Player): Promise<void> {
  // HSET on a single field is atomic, so concurrent joins/heartbeats from
  // different phones never clobber each other.
  await redis.hset(playersKey(code), { [player.id]: player });
  await redis.expire(playersKey(code), ROOM_TTL_SECONDS);
}

// ---------------------------------------------------------------------------

export async function createRoom(name: string): Promise<{ code: string; playerId: string }> {
  let code = randomCode();
  // Avoid (unlikely) collisions with a live room.
  for (let attempt = 0; attempt < 8; attempt++) {
    const exists = await redis.exists(metaKey(code));
    if (!exists) break;
    code = randomCode();
  }

  const playerId = newId();
  const now = Date.now();

  const meta: RoomMeta = {
    code,
    hostId: playerId,
    mode: "word",
    phase: "lobby",
    round: null,
    lastImposterId: null,
    createdAt: now,
  };

  await setMeta(meta);
  await setPlayer(code, { id: playerId, name: cleanName(name), joinedAt: now, lastSeen: now });

  return { code, playerId };
}

export async function joinRoom(
  code: string,
  name: string,
  existingId?: string
): Promise<{ ok: true; playerId: string } | { ok: false; error: string }> {
  const meta = await getMeta(code);
  if (!meta) return { ok: false, error: "Room not found" };

  const players = await getPlayers(code);
  const now = Date.now();

  // Reconnect path: a phone that locked/refreshed re-joins its SAME slot.
  if (existingId && players[existingId]) {
    const existing = players[existingId];
    await setPlayer(code, { ...existing, name: cleanName(name) || existing.name, lastSeen: now });
    return { ok: true, playerId: existingId };
  }

  const liveCount = Object.values(players).filter((p) => now - p.lastSeen < PRUNE_MS).length;
  if (liveCount >= 12) return { ok: false, error: "Room is full (max 12)" };

  // Either a brand-new player, or a returning id that was already pruned.
  const playerId = existingId && !players[existingId] ? existingId : newId();
  await setPlayer(code, { id: playerId, name: cleanName(name), joinedAt: now, lastSeen: now });
  await refreshTtl(code);

  return { ok: true, playerId };
}

// Builds the per-player view. This is also the heartbeat: polling updates
// lastSeen, prunes the dead, and promotes a new host if the old one vanished.
export async function buildView(code: string, playerId: string): Promise<RoomView | null> {
  const meta = await getMeta(code);
  if (!meta) return null;

  const players = await getPlayers(code);
  const now = Date.now();

  // Heartbeat the caller (if they're a member) before pruning.
  if (players[playerId]) {
    players[playerId] = { ...players[playerId], lastSeen: now };
    await setPlayer(code, players[playerId]);
  }

  // Prune the long-gone.
  const stale = Object.values(players).filter((p) => now - p.lastSeen >= PRUNE_MS);
  if (stale.length) {
    await redis.hdel(playersKey(code), ...stale.map((p) => p.id));
    for (const p of stale) delete players[p.id];
  }

  const ordered = Object.values(players).sort((a, b) => a.joinedAt - b.joinedAt);

  // Host succession: if the host is gone, promote the earliest-joined player.
  let metaChanged = false;
  if (ordered.length && !players[meta.hostId]) {
    meta.hostId = ordered[0].id;
    metaChanged = true;
  }
  if (metaChanged) await setMeta(meta);

  await refreshTtl(code);

  const publicPlayers: PublicPlayer[] = ordered.map((p) => ({
    id: p.id,
    name: p.name,
    connected: now - p.lastSeen < CONNECTED_MS,
    isHost: p.id === meta.hostId,
  }));

  const me = players[playerId];
  const you = me ? { id: me.id, name: me.name, isHost: me.id === meta.hostId } : null;

  const reveal =
    meta.phase === "reveal" && meta.round && me
      ? revealFor(meta.round, playerId)
      : null;

  return {
    code: meta.code,
    mode: meta.mode,
    phase: meta.phase,
    you,
    players: publicPlayers,
    reveal,
  };
}

// Computes exactly what ONE phone is allowed to see. Crew never receive the
// imposter's identity; the imposter never receives the real word/number.
function revealFor(round: Round, playerId: string): PlayerReveal {
  const isImposter = round.imposterId === playerId;

  if (round.mode === "word") {
    return isImposter
      ? { mode: "word", role: "imposter", imposterHint: round.imposterHint }
      : { mode: "word", role: "crew", word: round.word };
  }

  // number mode — category is shown to everyone, but the imposter gets no number
  return isImposter
    ? {
        mode: "number",
        role: "imposter",
        category: round.category,
      }
    : {
        mode: "number",
        role: "crew",
        category: round.category,
        number: round.number,
      };
}

export async function startRound(
  code: string,
  playerId: string,
  mode: GameMode
): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  const meta = await getMeta(code);
  if (!meta) return { ok: false, error: "Room not found", status: 404 };
  if (meta.hostId !== playerId)
    return { ok: false, error: "Only the host can start a round", status: 403 };

  const players = await getPlayers(code);
  const now = Date.now();
  const live = Object.values(players).filter((p) => now - p.lastSeen < CONNECTED_MS);
  if (live.length < 3)
    return { ok: false, error: "Need at least 3 connected players", status: 400 };

  // Pick the imposter, avoiding a repeat of last round when possible.
  let candidates = live.map((p) => p.id);
  if (candidates.length > 1 && meta.lastImposterId) {
    const filtered = candidates.filter((id) => id !== meta.lastImposterId);
    if (filtered.length) candidates = filtered;
  }
  const imposterId = pick(candidates);

  const round = buildRound(mode, imposterId);

  meta.mode = mode;
  meta.phase = "reveal";
  meta.round = round;
  meta.lastImposterId = imposterId;
  await setMeta(meta);

  return { ok: true };
}

function buildRound(mode: GameMode, imposterId: string): Round {
  if (mode === "word") {
    const entry = pick(WORDS);
    return { mode, imposterId, word: entry.word, imposterHint: entry.imposterHint };
  }
  const category = pick(NUMBER_CATEGORIES);
  const number = Math.floor(Math.random() * 11); // 0..10
  return { mode, imposterId, category, number };
}

export async function kickPlayer(
  code: string,
  hostId: string,
  targetId: string
): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  const meta = await getMeta(code);
  if (!meta) return { ok: false, error: "Room not found", status: 404 };
  if (meta.hostId !== hostId)
    return { ok: false, error: "Only the host can kick", status: 403 };
  if (targetId === hostId)
    return { ok: false, error: "Can't kick yourself", status: 400 };

  await redis.hdel(playersKey(code), targetId);
  await refreshTtl(code);
  return { ok: true };
}

function cleanName(name: string): string {
  return (name ?? "").trim().slice(0, 20);
}
