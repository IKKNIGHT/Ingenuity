export type ButtonId =
  | "leftButton1"
  | "leftButton2"
  | "leftButton3"
  | "leftButton4"
  | "rightButton1"
  | "rightButton2"
  | "rightButton3"
  | "rightButton4";

export type PuzzleState = Record<ButtonId, string>;

export type MoveKind = "L" | "R" | "B";
