# Trial of Ingenuity — Web Application Reference

This document describes the Vite + React + TypeScript client in `web/`, the shared puzzle logic, the PartyKit multiplayer server, ranking rules, and how to deploy the static app to Netlify or Vercel while hosting realtime separately.

## What you get

- **Single player**: Scrambled starting position, move counter, countdown, keyboard shortcuts (← / → / Space), optional **Show solution** (goal pattern preview, moves disabled while peeking). When the timer hits zero without solving, a **Time’s up** modal shows your move count and **optimal moves still needed** from that position (BFS, same metric as multiplayer ranking).
- **Multiplayer**: **No solution preview** (only single-player has “Show solution”). Lobbies use a **room code**; the **first connection** is **host** and sets **round length** / **scramble depth**; host may **spectate** or **compete**.
- **Spectator / host view**: Everyone sees every competitor’s **live board** (read-only mini boards). The host cannot edit other players’ states; moves are applied only for your own connection when you are a participating player.
- **End of round**: When the timer expires, or everyone has solved, the server finalizes results and broadcasts **standings**.

## Puzzle rules (implementation)

The board is eight symbol cells (four on the left cross, four on the right) plus three actions:

| Action | Effect |
|--------|--------|
| **Left** | Rotates the four left runes in a fixed cycle (matches the original HTML). |
| **Right** | Permutes the four right runes with the same permutation as the original file (not a simple cyclic shift). |
| **Swap** | Swaps `leftButton1` ↔ `rightButton4` and `leftButton4` ↔ `rightButton1` (matches `ingenuity.html` — the legacy comments there mislabel the DOM nodes). |

The **goal** pattern is fixed (`SOLVED_STATE` in `web/src/puzzle/engine.ts`) and matches the original “initialStates” in `ingenuity.html`.

**Water** decorations follow the same boolean rules as the legacy `checkWater()` and are computed in `web/src/puzzle/water.ts` for the React UI only.

## Source layout (`web/`)

| Path | Role |
|------|------|
| `src/puzzle/engine.ts` | State transitions, scramble, serialization. |
| `src/puzzle/bfs.ts` | Breadth-first search to compute **shortest distance to solved** (used on the **server** for ranking only — not bundled for cheating in the client flow). |
| `src/puzzle/water.ts` | Derives which “flow” segments are lit for visuals. |
| `src/components/PuzzleBoard.tsx` | Layout, glyphs, Left/Right/Swap controls, read-only mode for spectators. |
| `src/views/SinglePlayer.tsx` | Solo mode. |
| `src/views/MultiplayerRoom.tsx` | PartySocket client, lobby UI, live boards, results. |
| `src/multiplayer/types.ts` | Wire-format types shared with the server messages. |
| `party/ingenuity-room.ts` | PartyKit `Party.Server` — authoritative lobby, timer, moves, standings. |
| `partykit.json` | PartyKit project metadata (`name`, `main`, `compatibilityDate`). |

## Multiplayer protocol (JSON over WebSocket)

Clients send:

- `{ "type": "join", "name": string }` — must be sent after connect; first joiner in an empty room becomes **host**.
- `{ "type": "config", "maxTimeSeconds": number, "scrambleDepth": number }` — **host only**, lobby only.
- `{ "type": "setParticipates", "participates": boolean }` — **host only**, lobby only (whether the host also competes).
- `{ "type": "start" }` — **host only**; requires at least one `participates` player.
- `{ "type": "move", "move": "L" \| "R" \| "B" }` — only while playing, only for participants with an active board, ignored after you solve.

The server broadcasts:

- `{ "type": "snapshot", ... }` — full room view (all players’ public stats and puzzle states for competitors).
- `{ "type": "error", "message": string }` — ephemeral failures (permission, bad phase, etc.).

## Ranking algorithm (server)

When the round ends:

1. **Solved** competitors are sorted by **solve time** (milliseconds from `gameStart` to when `solvedAt` was recorded), ascending (faster is better).
2. **Unsolved** competitors are sorted by **shortest distance to solved** — the BFS depth from their **final** position to `SOLVED_STATE` (fewer optimal moves remaining is better).
3. **Tie-break** among unsolved: lower **total move count** during the round.
4. Final ordering: **all solved players first** (by time), then **all unsolved** (by distance, then move count).

The BFS implementation lives in `web/src/puzzle/bfs.ts`. It is used by the PartyKit server for **multiplayer** unsolved ranking, and by **single player** only to show “optimal moves still needed” on the time-up modal (not a live step-by-step solver).

## Local development

From `web/`:

```bash
npm install
npm run dev              # Vite only (single-player OK)
npm run dev:full         # Vite + PartyKit — use for multiplayer
```

**Multiplayer in dev:** Run `npm run dev:full` (PartyKit is pinned to port **1999**). With `VITE_PARTYKIT_HOST` unset, the client connects WebSockets to **`127.0.0.1:1999`** directly (no Vite proxy — avoids flaky `ECONNABORTED` proxy errors on some Windows setups).

Copy `.env.example` when you need a production PartyKit host for preview builds, not for typical local dev.

## Deploying PartyKit (realtime)

The static site only contains the React app. Deploy the PartyKit server separately:

```bash
cd web
npx partykit deploy
```

Note the hostname (e.g. `ingenuity.ikknight.partykit.dev`). Set **the same** value in your frontend environment as `VITE_PARTYKIT_HOST` (no `ws://` prefix — `partysocket` adds the protocol).

Rebuild the frontend after changing env vars so `import.meta.env.VITE_PARTYKIT_HOST` is inlined.

## Deploying the frontend (Netlify or Vercel)

**Important:** Point the project **root** to the `web/` directory (or move these files to the repo root and adjust paths).

### Netlify

- **Build command:** `npm run build`
- **Publish directory:** `dist`
- `web/netlify.toml` already sets SPA fallback to `index.html` for client-side routing (the app uses in-memory view state, but the fallback keeps refreshes working if you add routes later).

### Vercel

- **Framework preset:** Vite, or custom with **Output directory** `dist`
- `web/vercel.json` sets rewrites to `index.html` for SPA behavior.

Set `VITE_PARTYKIT_HOST` in the hosting provider’s environment UI to your deployed PartyKit host.

## Security / fairness notes

- Moves are validated on the server by applying the same `applyMove` logic per player; clients do not submit raw board state for moves.
- The optimal-move distance for unsolved ranking is computed **only at game end** on the server.
- Reconnecting creates a **new** connection id (new participant identity) unless you add persistence — documented as a known limitation for this version.

## Relationship to `ingenuity.html`

The original single-file demo included **Find Solution** (BFS in the browser). That **optimal-move finder** is not in the client UI. **Show solution** (goal pattern only) exists in **single player**; multiplayer has no spoiler. Ranking BFS for unsolved players remains server-only.
