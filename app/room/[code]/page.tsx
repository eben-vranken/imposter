"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  getName,
  setName as storeName,
  getPlayerId,
  setPlayerId,
} from "@/lib/storage";
import type { GameMode, RoomView } from "@/lib/types";

const POLL_MS = 1500;

type Status = "loading" | "ok" | "reconnecting" | "notfound" | "needjoin";

export default function RoomPage() {
  const params = useParams();
  const router = useRouter();
  const code = String(params.code).toUpperCase();

  const [view, setView] = useState<RoomView | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [selectedMode, setSelectedMode] = useState<GameMode>("word");
  const seededMode = useRef(false);

  const playerIdRef = useRef<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const alive = useRef(true);

  const poll = useCallback(async () => {
    const pid = playerIdRef.current;
    if (!pid) {
      setStatus("needjoin");
      return;
    }
    try {
      const res = await fetch(`/api/room/${code}?playerId=${pid}`, { cache: "no-store" });
      if (res.status === 404) {
        if (alive.current) setStatus("notfound");
        return;
      }
      const data: RoomView = await res.json();
      if (!alive.current) return;

      if (!data.you) {
        // We were pruned (or never actually joined) — show the join form.
        setStatus("needjoin");
      } else {
        if (!seededMode.current) {
          setSelectedMode(data.mode);
          seededMode.current = true;
        }
        setView(data);
        setStatus("ok");
      }
    } catch {
      if (alive.current) setStatus((s) => (s === "loading" ? "loading" : "reconnecting"));
    } finally {
      if (alive.current && playerIdRef.current) {
        timer.current = setTimeout(poll, POLL_MS);
      }
    }
  }, [code]);

  useEffect(() => {
    alive.current = true;
    playerIdRef.current = getPlayerId(code);
    poll();
    return () => {
      alive.current = false;
      if (timer.current) clearTimeout(timer.current);
    };
  }, [code, poll]);

  // Called after a (re)join succeeds — restart the poll loop with the new id.
  function resumePolling(pid: string) {
    playerIdRef.current = pid;
    setStatus("loading");
    if (timer.current) clearTimeout(timer.current);
    poll();
  }

  // --- actions ---
  async function startRound() {
    const pid = playerIdRef.current;
    if (!pid) return;
    await fetch(`/api/room/${code}/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ playerId: pid, mode: selectedMode }),
    });
    poll();
  }

  async function kick(targetId: string) {
    const pid = playerIdRef.current;
    if (!pid) return;
    await fetch(`/api/room/${code}/kick`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ playerId: pid, targetId }),
    });
    poll();
  }

  // --- render ---
  if (status === "notfound") {
    return (
      <div className="card center">
        <div className="section-title" style={{ justifyContent: "center" }}>
          <span className="jp">緊急</span> SIGNAL LOST
        </div>
        <h2 style={{ letterSpacing: 2 }}>ROOM {code} NOT FOUND</h2>
        <p className="hint-text">Channel expired or terminated. Open a new one.</p>
        <button className="btn" onClick={() => router.push("/")}>Return</button>
      </div>
    );
  }

  if (status === "needjoin") {
    return <JoinForm code={code} onJoined={resumePolling} onHome={() => router.push("/")} />;
  }

  if (status === "loading" && !view) {
    return (
      <div className="card center">
        <p className="hint-text">
          <span className="jp" style={{ color: "var(--orange)" }}>解析</span> · establishing link…
        </p>
      </div>
    );
  }

  if (!view) return null;

  return (
    <>
      <div className="topbar">
        <button className="link-btn" onClick={() => router.push("/")}>◄ DISCONNECT</button>
        <SyncIndicator status={status} />
      </div>

      {view.phase === "lobby" ? (
        <Lobby
          view={view}
          selectedMode={selectedMode}
          onSelectMode={setSelectedMode}
          onStart={startRound}
          onKick={kick}
        />
      ) : (
        <Reveal
          view={view}
          selectedMode={selectedMode}
          onSelectMode={setSelectedMode}
          onNewRound={startRound}
        />
      )}
    </>
  );
}

// ---------------------------------------------------------------------------

function SyncIndicator({ status }: { status: Status }) {
  const bad = status === "reconnecting" || status === "loading";
  return (
    <span className={`sync ${bad ? "bad" : "ok"}`}>
      <span className="dot" />
      <span className="jp">同期</span>
      {bad ? "RECONNECT" : "LINK OK"}
    </span>
  );
}

function ModeToggle({
  mode,
  onSelect,
  disabled,
}: {
  mode: GameMode;
  onSelect: (m: GameMode) => void;
  disabled?: boolean;
}) {
  return (
    <div className="mode-toggle">
      <button
        className={`mode-btn ${mode === "word" ? "active" : ""}`}
        onClick={() => !disabled && onSelect("word")}
        disabled={disabled}
      >
        <span className="emoji">🔤</span>
        Word
      </button>
      <button
        className={`mode-btn ${mode === "number" ? "active" : ""}`}
        onClick={() => !disabled && onSelect("number")}
        disabled={disabled}
      >
        <span className="emoji">🔢</span>
        Number
      </button>
    </div>
  );
}

function Lobby({
  view,
  selectedMode,
  onSelectMode,
  onStart,
  onKick,
}: {
  view: RoomView;
  selectedMode: GameMode;
  onSelectMode: (m: GameMode) => void;
  onStart: () => void;
  onKick: (id: string) => void;
}) {
  const isHost = view.you?.isHost ?? false;
  const connectedCount = view.players.filter((p) => p.connected).length;
  const canStart = isHost && connectedCount >= 3;

  function copyCode() {
    navigator.clipboard?.writeText(view.code).catch(() => {});
  }

  return (
    <>
      <div className="card code-banner">
        <div className="label">Room Code <span className="jp">識別</span></div>
        <div className="code">{view.code}</div>
        <button className="copy-btn" onClick={copyCode}>⧉ Copy</button>
      </div>

      <div className="card">
        <h3 className="section-title">
          Operatives · {connectedCount}/{view.players.length} linked
        </h3>
        <ul className="players">
          {view.players.map((p) => (
            <li className="player-row" key={p.id}>
              <span className={`dot ${p.connected ? "on" : ""}`} />
              <span className="player-name">{p.name}</span>
              {p.isHost && <span className="badge">Cmd</span>}
              {p.id === view.you?.id && <span className="badge you">You</span>}
              {isHost && p.id !== view.you?.id && (
                <button className="kick" onClick={() => onKick(p.id)}>Eject</button>
              )}
            </li>
          ))}
        </ul>
      </div>

      {isHost ? (
        <div className="card">
          <h3 className="section-title">Operation Mode</h3>
          <ModeToggle mode={selectedMode} onSelect={onSelectMode} />
          <button className="btn" onClick={onStart} disabled={!canStart}>
            {canStart ? "Commence Round" : `Awaiting ${Math.max(0, 3 - connectedCount)} more`}
          </button>
        </div>
      ) : (
        <p className="hint-text">
          <span className="jp" style={{ color: "var(--orange)" }}>待機</span> · standby — command initiates round
        </p>
      )}
    </>
  );
}

function Reveal({
  view,
  selectedMode,
  onSelectMode,
  onNewRound,
}: {
  view: RoomView;
  selectedMode: GameMode;
  onSelectMode: (m: GameMode) => void;
  onNewRound: () => void;
}) {
  const r = view.reveal;
  const [held, setHeld] = useState(false);
  const isHost = view.you?.isHost ?? false;

  if (!r) return (
    <div className="card center">
      <p className="hint-text">
        <span className="jp" style={{ color: "var(--orange)" }}>解析</span> · assigning roles…
      </p>
    </div>
  );

  const isImposter = r.role === "imposter";

  return (
    <>
      <div className={`starter-banner ${r.youStart ? "you" : ""}`}>
        {r.youStart ? (
          <>► YOU OPEN — give the first clue out loud</>
        ) : (
          <>► <span className="who">{r.starterName}</span> opens the round</>
        )}
      </div>

      <div
        className={`reveal-hold ${held ? "held " + r.role : ""}`}
        onPointerDown={() => setHeld(true)}
        onPointerUp={() => setHeld(false)}
        onPointerLeave={() => setHeld(false)}
        onPointerCancel={() => setHeld(false)}
        onContextMenu={(e) => e.preventDefault()}
      >
        {!held ? (
          <div className="reveal-hint">
            <span className="jp">機密 · 解析</span>
            <span className="big">▣</span>
            Hold to decrypt
            <br />
            shield from nearby eyes
          </div>
        ) : (
          <RevealContent reveal={r} isImposter={isImposter} />
        )}
      </div>

      {isHost ? (
        <div className="card">
          <h3 className="section-title">Next Round</h3>
          <ModeToggle mode={selectedMode} onSelect={onSelectMode} />
          <button className="btn" onClick={onNewRound}>↻ New Round</button>
        </div>
      ) : (
        <p className="hint-text">Debate out loud — command initiates the next round.</p>
      )}
    </>
  );
}

function RevealContent({
  reveal,
  isImposter,
}: {
  reveal: NonNullable<RoomView["reveal"]>;
  isImposter: boolean;
}) {
  if (reveal.mode === "word") {
    if (isImposter) {
      return (
        <div>
          <div className="imposter-title">
            <span className="jp">警告</span>YOU ARE THE IMPOSTER
          </div>
          <div className="role-label">Decoy hint word</div>
          <span className="hint-pill">{reveal.imposterHint}</span>
          <small className="hint-caption">
            Slip this into the conversation to blend in. Don&apos;t get caught.
          </small>
        </div>
      );
    }
    return (
      <div>
        <div className="role-label">
          Status · <span className="role-crew">CREW</span>
        </div>
        <div className="role-label">Secret word</div>
        <div className="secret-word">{reveal.word}</div>
      </div>
    );
  }

  // number mode — everyone sees the category
  if (isImposter) {
    return (
      <div>
        <div className="imposter-title">
          <span className="jp">警告</span>YOU ARE THE IMPOSTER
        </div>
        <p className="category">{reveal.category}</p>
        <small className="hint-caption">
          The number is withheld — bluff a rating and try to blend in.
        </small>
      </div>
    );
  }
  return (
    <div>
      <div className="role-label">
        Status · <span className="role-crew">CREW</span>
      </div>
      <p className="category">{reveal.category}</p>
      <div className="secret-number">
        {reveal.number}
        <small> / 10</small>
      </div>
    </div>
  );
}

function JoinForm({
  code,
  onJoined,
  onHome,
}: {
  code: string;
  onJoined: (playerId: string) => void;
  onHome: () => void;
}) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => setName(getName()), []);

  async function submit() {
    if (!name.trim()) return setError("Enter your name");
    setBusy(true);
    setError("");
    try {
      const existing = getPlayerId(code) ?? undefined;
      const res = await fetch(`/api/room/${code}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), playerId: existing }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to join");
      storeName(name.trim());
      setPlayerId(code, data.playerId);
      onJoined(data.playerId);
    } catch (e: any) {
      setError(e.message || "Something went wrong");
      setBusy(false);
    }
  }

  return (
    <div className="card">
      <div className="code-banner">
        <div className="label">Linking Channel <span className="jp">識別</span></div>
        <div className="code">{code}</div>
      </div>
      <label htmlFor="jn" style={{ marginTop: 12 }}>Callsign</label>
      <input
        id="jn"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="e.g. Sam"
        maxLength={20}
        autoFocus
      />
      <button className="btn" onClick={submit} disabled={busy}>
        {busy ? "Linking…" : "Connect"}
      </button>
      {error && <p className="error">{error}</p>}
      <button className="btn ghost" onClick={onHome}>← Home</button>
    </div>
  );
}
