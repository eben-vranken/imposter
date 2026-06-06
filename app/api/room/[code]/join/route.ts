import { NextResponse } from "next/server";
import { joinRoom } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: { code: string } }) {
  const code = params.code.toUpperCase();
  try {
    const { name, playerId } = await req.json();
    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }
    const result = await joinRoom(code, name, typeof playerId === "string" ? playerId : undefined);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 404 });
    }
    return NextResponse.json({ code, playerId: result.playerId });
  } catch (err) {
    console.error("[join]", err);
    return NextResponse.json({ error: "Failed to join room" }, { status: 500 });
  }
}
