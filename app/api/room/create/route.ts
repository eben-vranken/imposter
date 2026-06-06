import { NextResponse } from "next/server";
import { createRoom } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const { name } = await req.json();
    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }
    const { code, playerId } = await createRoom(name);
    return NextResponse.json({ code, playerId });
  } catch (err) {
    console.error("[create]", err);
    return NextResponse.json({ error: "Failed to create room" }, { status: 500 });
  }
}
