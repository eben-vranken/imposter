import { Redis } from "@upstash/redis";

// Single shared Upstash Redis client. Uses the REST API, so it works fine
// inside Vercel serverless functions (no persistent connection needed).
//
// Reads credentials from UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN.
// `Redis.fromEnv()` would also work, but we construct explicitly so the error
// message is clearer if the env vars are missing.
if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
  // Don't throw at import time during build; throw lazily when used.
  console.warn(
    "[imposter] Missing UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN. " +
      "Set them in .env.local (see .env.example)."
  );
}

export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL ?? "",
  token: process.env.UPSTASH_REDIS_REST_TOKEN ?? "",
});

// Rooms auto-expire so abandoned games clean themselves up.
export const ROOM_TTL_SECONDS = 60 * 60 * 4; // 4 hours

export const metaKey = (code: string) => `imposter:room:${code}:meta`;
export const playersKey = (code: string) => `imposter:room:${code}:players`;
