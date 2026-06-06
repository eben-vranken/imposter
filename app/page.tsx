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
      <h1 className="logo">IMPOSTER</h1>
      <p className="tagline">One of you is faking it. 🤫</p>

      {view === "home" && (
        <div className="card">
          <button className="btn" onClick={() => { setError(""); setView("create"); }}>
            Create Room
          </button>
          <div className="divider">— OR —</div>
          <button className="btn secondary" onClick={() => { setError(""); setView("join"); }}>
            Join Room
          </button>
          <p className="hint-text">3–12 players · everyone on their own phone</p>
        </div>
      )}

      {view === "create" && (
        <div className="card">
          <label htmlFor="name">Your name</label>
          <input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Sam"
            maxLength={20}
            autoFocus
          />
          <button className="btn" onClick={create} disabled={busy}>
            {busy ? "Creating…" : "Create Room"}
          </button>
          {error && <p className="error">{error}</p>}
          <button className="btn ghost" onClick={() => setView("home")}>← Back</button>
        </div>
      )}

      {view === "join" && (
        <div className="card">
          <label htmlFor="code">Room code</label>
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
          <label htmlFor="jname" style={{ marginTop: 16 }}>Your name</label>
          <input
            id="jname"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Sam"
            maxLength={20}
          />
          <button className="btn" onClick={join} disabled={busy}>
            {busy ? "Joining…" : "Join Room"}
          </button>
          {error && <p className="error">{error}</p>}
          <button className="btn ghost" onClick={() => setView("home")}>← Back</button>
        </div>
      )}
    </>
  );
}
