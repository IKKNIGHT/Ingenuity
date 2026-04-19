import type { PuzzleState } from "../puzzle/types";

export type MpPhase = "lobby" | "playing" | "ended";

export type StandingRow = {
  rank: number;
  playerId: string;
  name: string;
  solved: boolean;
  solveTimeMs: number | null;
  distanceRemaining: number | null;
  moveCount: number;
};

export type SnapshotMessage = {
  type: "snapshot";
  phase: MpPhase;
  roomCode: string;
  you: { id: string; isHost: boolean; participates: boolean };
  config: { maxTimeSeconds: number; scrambleDepth: number };
  players: Record<
    string,
    {
      name: string;
      isHost: boolean;
      participates: boolean;
      moveCount: number;
      solved: boolean;
      state: PuzzleState | null;
      disconnected: boolean;
    }
  >;
  game: null | {
    startedAt: number;
    endsAt: number;
    now: number;
  };
  standings: StandingRow[] | null;
};

export type ErrorMessage = { type: "error"; message: string };

export type ServerMessage = SnapshotMessage | ErrorMessage;
