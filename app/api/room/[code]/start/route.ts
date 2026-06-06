import { NextResponse } from "next/server";
import { startRound } from "@/lib/store";
import type { GameMode } from "@/lib/types";

export const dynamic = "force-dynamic";

// Host starts a round (or "New Round" — same call). Picks a fresh imposter
// and content, then writes per-player assignments into room state.
export async function POST(req: Request, { params }: { params: { code: string } }) {
  const code = params.code.toUpperCase();
  try {
    const { playerId, mode } = await req.json();
    if (!playerId || typeof playerId !== "string") {
      return NextResponse.json({ error: "playerId is required" }, { status: 400 });
    }
    if (mode !== "word" && mode !== "number") {
      return NextResponse.json({ error: "Invalid mode" }, { status: 400 });
    }
    const result = await startRound(code, playerId, mode as GameMode);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[start]", err);
    return NextResponse.json({ error: "Failed to start round" }, { status: 500 });
  }
}
