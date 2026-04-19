import { applyMove, isSolved, serializeState } from "./engine";
import type { PuzzleState } from "./types";

const MOVES: MoveKind[] = ["L", "R", "B"];

/**
 * Minimum number of moves from `state` to the solved configuration.
 * Used for ranking unfinished runs (server-side only in production).
 */
export function shortestDistanceToSolved(state: PuzzleState): number {
  if (isSolved(state)) return 0;

  const queue: { state: PuzzleState; depth: number }[] = [{ state, depth: 0 }];
  const visited = new Set<string>();
  visited.add(serializeState(state));

  while (queue.length > 0) {
    const cur = queue.shift()!;
    if (isSolved(cur.state)) return cur.depth;

    for (const m of MOVES) {
      const next = applyMove(cur.state, m);
      const key = serializeState(next);
      if (!visited.has(key)) {
        visited.add(key);
        queue.push({ state: next, depth: cur.depth + 1 });
      }
    }
  }

  return Number.POSITIVE_INFINITY;
}
