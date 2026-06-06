// Tiny localStorage layer so a phone that locks / refreshes auto-rejoins its
// SAME slot. We remember the player's name and a per-room playerId.
"use client";

const NAME_KEY = "imposter.name";
const ROOMS_KEY = "imposter.rooms"; // { [code]: playerId }

export function getName(): string {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(NAME_KEY) ?? "";
}

export function setName(name: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(NAME_KEY, name);
}

function readRooms(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(ROOMS_KEY) ?? "{}");
  } catch {
    return {};
  }
}

export function getPlayerId(code: string): string | null {
  return readRooms()[code.toUpperCase()] ?? null;
}

export function setPlayerId(code: string, playerId: string): void {
  if (typeof window === "undefined") return;
  const rooms = readRooms();
  rooms[code.toUpperCase()] = playerId;
  window.localStorage.setItem(ROOMS_KEY, JSON.stringify(rooms));
}

export function clearPlayerId(code: string): void {
  if (typeof window === "undefined") return;
  const rooms = readRooms();
  delete rooms[code.toUpperCase()];
  window.localStorage.setItem(ROOMS_KEY, JSON.stringify(rooms));
}
