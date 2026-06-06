# 🤫 Imposter

A dead-simple, mobile-first party game for playing **in person**. Everyone gathers
in a room with their phones. The app's only job is to **secretly hand each player
their private info** — a secret word (or number) for the crew, and a sneaky hint
for the lone imposter. All the clue-giving, discussion, and voting happen **out loud,
in real life**. There is no in-app chat, no timers, no voting screens.

Built with **Next.js (App Router)**, deployed on **Vercel**, with room state in
**Upstash Redis**. No WebSockets — phones poll for state every ~1.5s, which is
plenty fast for this game.

---

## How to play

1. One person taps **Create Room** and enters their name → they get a 4-letter code (e.g. `PLAY`).
2. Everyone else taps **Join Room**, types the code + their name.
3. The host picks a mode and taps **Start Round** (needs 3+ players).
4. Each phone privately shows that player their role. **Tap & hold** to reveal it.
   - **Crew** see the secret word (or number).
   - The **Imposter** sees `🤫 You are the IMPOSTER` plus a decoy hint.
5. Now play out loud: take turns dropping clues, discuss, and vote on who the imposter is — all face to face.
6. The host taps **New Round** for fresh content + a new random imposter. Mode can be switched between rounds.

### The two modes

- **Word** — Crew all see the same secret word. The imposter sees only a *related* hint word (e.g. word `beach` → hint `summer`) to help them bluff.
- **Number** — A category like *"How awkward is this? (0–10)"* is shown to **everyone**. Crew see the exact number (e.g. `8 / 10`); the imposter sees `It's roughly around X` (2–3 off) so they can fake a rating in the right ballpark.

---

## Run locally

### 1. Prerequisites
- Node.js 18.17+ and npm.
- An [Upstash Redis](https://console.upstash.com) database (free tier is fine).

### 2. Get Upstash credentials
1. Sign in at <https://console.upstash.com> and **Create Database** (type: Redis). Pick a nearby region; defaults are fine.
2. On the database page, open the **REST API** section and copy:
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN`

### 3. Configure env vars
Create a `.env.local` file in the project root (this file is git-ignored):

```bash
UPSTASH_REDIS_REST_URL="https://your-db.upstash.io"
UPSTASH_REDIS_REST_TOKEN="your-rest-token"
```

> `.env.example` lists the same variable names as a template. **Don't put real
> tokens in `.env.example`** — it isn't git-ignored. Real credentials belong in
> `.env.local`.

### 4. Install & run
```bash
npm install
npm run dev
```

Open <http://localhost:3000>.

> **Testing with multiple "phones" locally:** open several browser tabs/windows.
> Each tab is treated as a separate player (player identity is stored per-browser
> in `localStorage`). To test real phones on your Wi-Fi, run
> `npm run dev -- -H 0.0.0.0` and visit `http://<your-computer-ip>:3000`. The
> easiest way to test on actual phones over the internet is to just deploy to Vercel (below).

---

## Deploy to Vercel

### Option A — Vercel + Upstash integration (recommended, sets env vars for you)
1. Push this repo to GitHub.
2. In Vercel, **Add New → Project** and import the repo. Framework preset is auto-detected as **Next.js**. Click **Deploy**.
3. In your Vercel project, go to the **Integrations** tab (or the [Upstash integration page](https://vercel.com/integrations/upstash)) and **Add the Upstash integration**. Connect it to this project and select / create your Redis database.
   - The integration automatically adds `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` to your project's environment variables.
4. **Redeploy** (Deployments → ⋯ → Redeploy) so the new env vars take effect.

### Option B — set env vars manually
1. Import the repo into Vercel and deploy (as above).
2. In **Project → Settings → Environment Variables**, add for the **Production** (and Preview) environments:
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN`
3. **Redeploy**.

Once deployed, share the Vercel URL. Anyone can open it on their phone, and three+
phones can create/join a room and play.

---

## Acceptance check

- Three phones open the deployed site → one creates a room, two join with the code → host taps **Start Round** → within ~2s each phone independently shows its own private info (2 crew see the word/number, 1 imposter sees the imposter screen + hint). ✅
- Works across different phones over the internet (it's on Vercel). ✅
- Refreshing or locking a phone mid-game keeps the player in their room/role (identity persists in `localStorage`; state lives in Redis). ✅
- Both modes work and can be switched between rounds. ✅

---

## How it works (architecture)

- **No WebSockets.** Vercel serverless functions can't hold persistent sockets, so
  every phone polls `GET /api/room/[code]?playerId=…` every ~1.5s. That same call
  doubles as a heartbeat (updates the player's `lastSeen`).
- **Per-player private views.** The full secret round data (word, number, who the
  imposter is) lives **only** server-side in Redis. The poll endpoint computes and
  returns *only what that one phone is allowed to see* — crew never receive the
  imposter's identity, and the imposter never receives the real word/number. You
  can't cheat by inspecting network traffic.
- **State in Redis** (via `@upstash/redis`, REST-based, serverless-friendly):
  - `imposter:room:{code}:meta` — a JSON blob: host, mode, phase, current round, etc. Written only by host actions + host-succession.
  - `imposter:room:{code}:players` — a Redis **hash**, one field per player (`id → {name, joinedAt, lastSeen}`). Per-field `HSET` is atomic, so concurrent joins/heartbeats from different phones never clobber each other.
  - Both keys carry a **TTL of 4 hours** (refreshed on activity), so abandoned rooms clean themselves up.
- **Reconnection** is just re-polling with the `playerId` saved in `localStorage`,
  so a locked/refreshed phone rejoins the same slot with no duplicate player.
- **Presence:** a player shows as *online* if seen within 15s; players unseen for
  2 minutes are pruned. If the host disappears, the earliest-joined remaining
  player is promoted to host automatically.

### Adding content
Edit [`lib/content.ts`](lib/content.ts):
- `WORDS` — add `{ word, imposterHint }` pairs (the hint must be *related* but never the word itself).
- `NUMBER_CATEGORIES` — add `"... (0–10)"` scale strings.

### API routes
| Route | Method | Purpose |
|---|---|---|
| `/api/room/create` | POST | Create a room; returns `{ code, playerId }`. |
| `/api/room/[code]/join` | POST | Join (or reconnect to) a room. |
| `/api/room/[code]` | GET | Poll the per-player view + heartbeat. |
| `/api/room/[code]/start` | POST | Host starts a round / new round. |
| `/api/room/[code]/kick` | POST | Host removes a player. |
