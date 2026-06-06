import { NextResponse } from "next/server";
import { buildView } from "@/lib/store";

export const dynamic = "force-dynamic";

// Poll endpoint. Also acts as the heartbeat (updates lastSeen).
export async function GET(req: Request, { params }: { params: { code: string } }) {
  const code = params.code.toUpperCase();
  const playerId = new URL(req.url).searchParams.get("playerId") ?? "";

  if (!playerId) {
    return NextResponse.json({ error: "playerId is required" }, { status: 400 });
  }

  try {
    const view = await buildView(code, playerId);
    if (!view) return NextResponse.json({ error: "Room not found" }, { status: 404 });
    return NextResponse.json(view);
  } catch (err) {
    console.error("[poll]", err);
    return NextResponse.json({ error: "Failed to load room" }, { status: 500 });
  }
}
