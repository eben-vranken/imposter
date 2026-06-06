import { NextResponse } from "next/server";
import { kickPlayer } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: { code: string } }) {
  const code = params.code.toUpperCase();
  try {
    const { playerId, targetId } = await req.json();
    if (!playerId || !targetId || typeof playerId !== "string" || typeof targetId !== "string") {
      return NextResponse.json({ error: "playerId and targetId are required" }, { status: 400 });
    }
    const result = await kickPlayer(code, playerId, targetId);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[kick]", err);
    return NextResponse.json({ error: "Failed to kick player" }, { status: 500 });
  }
}
