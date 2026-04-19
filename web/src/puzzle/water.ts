import type { PuzzleState } from "./types";

/** Which decorative “flow” segments are active — mirrors the original HTML `checkWater` logic. */
export function waterVisibility(state: PuzzleState): Record<string, boolean> {
  const L1 = state.leftButton1;
  const L2 = state.leftButton2;
  const L3 = state.leftButton3;
  const L4 = state.leftButton4;
  const R1 = state.rightButton1;
  const R2 = state.rightButton2;
  const R3 = state.rightButton3;
  const R4 = state.rightButton4;

  return {
    leftWater1: L1 === "=" || L1 === "┌",
    leftWater2: L2 === "||" || L2 === "┐",
    leftWater3: L3 === "||" || L3 === "└",
    leftWater4: L4 === "┘",
    rightWater1: R1 === "=" || R1 === "┐",
    rightWater2: R2 === "┌" || R2 === "||",
    rightWater3: R3 === "┘" || R3 === "||",
    rightWater4: R4 === "└",
  };
}
