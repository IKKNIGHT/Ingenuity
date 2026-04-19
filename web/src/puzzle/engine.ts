import type { ButtonId, MoveKind, PuzzleState } from "./types";

/** Canonical solved configuration from the original Trial of Ingenuity. */
export const SOLVED_STATE: PuzzleState = {
  leftButton1: "=",
  leftButton2: "||",
  leftButton3: "||",
  leftButton4: "┘",
  rightButton1: "=",
  rightButton2: "┌",
  rightButton3: "┘",
  rightButton4: "└",
};

export function cloneState(s: PuzzleState): PuzzleState {
  return { ...s };
}

export function statesEqual(a: PuzzleState, b: PuzzleState): boolean {
  const keys = Object.keys(a) as ButtonId[];
  return keys.every((k) => a[k] === b[k]);
}

export function isSolved(state: PuzzleState): boolean {
  return statesEqual(state, SOLVED_STATE);
}

export function serializeState(state: PuzzleState): string {
  return JSON.stringify(state);
}

export function applyMove(state: PuzzleState, move: MoveKind): PuzzleState {
  const next = cloneState(state);
  if (move === "L") rotateLeft(next);
  else if (move === "R") rotateRight(next);
  else swap(next);
  return next;
}

function rotateLeft(s: PuzzleState): void {
  const t1 = s.leftButton1;
  const t2 = s.leftButton2;
  const t3 = s.leftButton3;
  const t4 = s.leftButton4;
  s.leftButton1 = t2;
  s.leftButton2 = t3;
  s.leftButton3 = t4;
  s.leftButton4 = t1;
}

function rotateRight(s: PuzzleState): void {
  const b1 = s.rightButton1;
  const b2 = s.rightButton2;
  const b3 = s.rightButton3;
  const b4 = s.rightButton4;
  s.rightButton1 = b2;
  s.rightButton2 = b4;
  s.rightButton3 = b1;
  s.rightButton4 = b3;
}

/**
 * Matches `ingenuity.html` `swapButtons()` (variable names there are misleading):
 * R4 ↔ L1 and L4 ↔ **R1** (the second DOM ref is `getElementById('rightButton1')`).
 */
function swap(s: PuzzleState): void {
  let tmp = s.rightButton4;
  s.rightButton4 = s.leftButton1;
  s.leftButton1 = tmp;

  tmp = s.leftButton4;
  s.leftButton4 = s.rightButton1;
  s.rightButton1 = tmp;
}

/**
 * Apply random moves from the solved state (for scrambling).
 * Mirrors the control flow in `ingenuity.html` `runRandomMoves` (swap-streak guard, step counting).
 */
export function scrambleFromSolved(moveCount: number, rng: () => number = Math.random): PuzzleState {
  let s = cloneState(SOLVED_STATE);
  let lastMove = "";
  let lastLastMove = "";
  let i = 0;

  while (i < moveCount) {
    const randomMove = Math.floor(rng() * 3);

    if (randomMove === 2 && lastMove === "B" && lastLastMove === "B") {
      for (let j = 0; j < 2; j++) {
        const extraMove = Math.floor(rng() * 2);
        const kind: MoveKind = extraMove === 0 ? "L" : "R";
        s = applyMove(s, kind);
        lastLastMove = lastMove;
        lastMove = kind;
      }
    } else {
      const kind: MoveKind = randomMove === 0 ? "L" : randomMove === 1 ? "R" : "B";
      s = applyMove(s, kind);
      lastLastMove = lastMove;
      lastMove = kind;
      i++;
    }
  }
  return s;
}
