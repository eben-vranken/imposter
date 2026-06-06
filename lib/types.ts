export type GameMode = "word" | "number";
export type Phase = "lobby" | "reveal";

// Stored per player in the Redis hash room:{code}:players (field = playerId).
export interface Player {
  id: string;
  name: string;
  joinedAt: number; // ms epoch — used for stable ordering & host succession
  lastSeen: number; // ms epoch — updated on every poll (heartbeat)
}

// The full secret round data. Lives ONLY in the room meta, server-side.
// It is never sent to a client wholesale — each poll returns a filtered,
// per-player view (see PlayerReveal).
export interface Round {
  mode: GameMode;
  imposterId: string;
  // word mode
  word?: string;
  imposterHint?: string;
  // number mode
  category?: string;
  number?: number;
}

// Room meta — single JSON blob, written only by host-driven mutations and
// host-succession. Player join/heartbeat go to the separate hash so they
// can't clobber meta or each other.
export interface RoomMeta {
  code: string;
  hostId: string;
  mode: GameMode;
  phase: Phase;
  round: Round | null;
  lastImposterId: string | null; // avoid same imposter twice in a row
  createdAt: number;
}

// ---- Client-facing shapes (what the poll endpoint returns) ----

export interface PublicPlayer {
  id: string;
  name: string;
  connected: boolean;
  isHost: boolean;
}

// The ONLY round info a given phone receives. Crew never learn who the
// imposter is; the imposter never learns the real word/number.
export interface PlayerReveal {
  mode: GameMode;
  role: "crew" | "imposter";
  // word mode
  word?: string; // crew only
  imposterHint?: string; // imposter only
  // number mode
  category?: string; // everyone
  number?: number; // crew only
}

export interface RoomView {
  code: string;
  mode: GameMode;
  phase: Phase;
  you: { id: string; name: string; isHost: boolean } | null;
  players: PublicPlayer[];
  reveal: PlayerReveal | null;
}
