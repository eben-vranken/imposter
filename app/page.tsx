"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getName, setName as storeName, setPlayerId } from "@/lib/storage";

type View = "home" | "create" | "join";

export default function Landing() {
  const router = useRouter();
  const [view, setView] = useState<View>("home");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => setName(getName()), []);

  async function create() {
    if (!name.trim()) return setError("Enter your name");
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/room/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      storeName(name.trim());
      setPlayerId(data.code, data.playerId);
      router.push(`/room/${data.code}`);
    } catch (e: any) {
      setError(e.message || "Something went wrong");
      setBusy(false);
    }
  }

  async function join() {
    const c = code.trim().toUpperCase();
    if (!name.trim()) return setError("Enter your name");
    if (c.length !== 4) return setError("Room code is 4 letters");
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/room/${c}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      storeName(name.trim());
      setPlayerId(c, data.playerId);
      router.push(`/room/${c}`);
    } catch (e: any) {
      setError(e.message || "Something went wrong");
      setBusy(false);
    }
  }

  return (
    <>
      <div className="sysbar">
        <span className="live">PROTOCOL ONLINE</span>
        <span className="jp">待機</span>
      </div>

      <Emblem />
      <h1 className="logo">
        IMPOST<span className="accent">ER</span>
      </h1>
      <p className="tagline">
        One of you is faking it <span className="jp">疑心</span>
      </p>
      <div className="hazard" style={{ margin: "12px 0 16px" }} />

      {view === "home" && (
        <div className="card">
          <button className="btn" onClick={() => { setError(""); setView("create"); }}>
            Create Room
          </button>
          <div className="divider">OR</div>
          <button className="btn secondary" onClick={() => { setError(""); setView("join"); }}>
            Join Room
          </button>
          <p className="hint-text">3–12 operatives · one device each</p>
        </div>
      )}

      {view === "create" && (
        <div className="card">
          <label htmlFor="name">Callsign</label>
          <input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Sam"
            maxLength={20}
            autoFocus
          />
          <button className="btn" onClick={create} disabled={busy}>
            {busy ? "Initializing…" : "Open Channel"}
          </button>
          {error && <p className="error">{error}</p>}
          <button className="btn ghost" onClick={() => setView("home")}>← Back</button>
        </div>
      )}

      {view === "join" && (
        <div className="card">
          <label htmlFor="code">Channel Code</label>
          <input
            id="code"
            className="code-input"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 4))}
            placeholder="ABCD"
            maxLength={4}
            autoCapitalize="characters"
            autoFocus
          />
          <label htmlFor="jname" style={{ marginTop: 16 }}>Callsign</label>
          <input
            id="jname"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Sam"
            maxLength={20}
          />
          <button className="btn" onClick={join} disabled={busy}>
            {busy ? "Linking…" : "Connect"}
          </button>
          {error && <p className="error">{error}</p>}
          <button className="btn ghost" onClick={() => setView("home")}>← Back</button>
        </div>
      )}
    </>
  );
}

// Original angular emblem — a warning-triangle reticle inside a rotating ring.
// Not based on any real-world logo.
function Emblem() {
  return (
    <svg className="emblem" viewBox="0 0 100 100" fill="none" stroke="currentColor" aria-hidden="true">
      <g className="spin">
        <circle cx="50" cy="50" r="46" strokeWidth="1" strokeDasharray="5 9" opacity="0.55" />
      </g>
      <polygon points="50,15 85,77 15,77" strokeWidth="2" />
      <polygon points="50,39 67,71 33,71" strokeWidth="1.4" opacity="0.7" />
      <line x1="27" y1="58" x2="73" y2="58" strokeWidth="1" opacity="0.5" />
      <circle cx="50" cy="63" r="3" fill="currentColor" stroke="none" />
    </svg>
  );
}
