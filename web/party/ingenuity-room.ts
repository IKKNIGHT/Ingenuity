import type * as Party from "partykit/server";
import {
  applyMove,
  cloneState,
  isSolved,
  scrambleFromSolved,
  type MoveKind,
  type PuzzleState,
} from "../src/puzzle/engine";
import { shortestDistanceToSolved } from "../src/puzzle/bfs";

type Phase = "lobby" | "playing" | "ended";

type PlayerModel = {
  name: string;
  isHost: boolean;
  participates: boolean;
  state: PuzzleState | null;
  moveCount: number;
  solvedAt: number | null;
  disconnected: boolean;
};

type GameConfig = {
  maxTimeSeconds: number;
  scrambleDepth: number;
};

export type StandingRow = {
  rank: number;
  playerId: string;
  name: string;
  solved: boolean;
  solveTimeMs: number | null;
  distanceRemaining: number | null;
  moveCount: number;
};

type SnapshotMessage = {
  type: "snapshot";
  phase: Phase;
  roomCode: string;
  you: { id: string; isHost: boolean; participates: boolean };
  config: GameConfig;
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

type ErrorMessage = { type: "error"; message: string };

type ServerMessage = SnapshotMessage | ErrorMessage;

type ClientMessage =
  | { type: "join"; name: string }
  | { type: "config"; maxTimeSeconds: number; scrambleDepth: number }
  | { type: "setParticipates"; participates: boolean }
  | { type: "start" }
  | { type: "move"; move: MoveKind };

const DEFAULT_CONFIG: GameConfig = {
  maxTimeSeconds: 180,
  scrambleDepth: 55,
};

function safeName(raw: string): string {
  const t = raw.trim().slice(0, 24);
  return t.length > 0 ? t : "Player";
}

export default class IngenuityRoom implements Party.Server {
  constructor(readonly room: Party.Room) {}

  private phase: Phase = "lobby";
  private hostId: string | null = null;
  private config: GameConfig = { ...DEFAULT_CONFIG };
  private players: Map<string, PlayerModel> = new Map();
  private gameStart = 0;
  private gameEnd = 0;
  private standings: StandingRow[] | null = null;

  onConnect(conn: Party.Connection) {
    this.sendTo(conn.id, this.buildSnapshot(conn.id));
  }

  onMessage(raw: string | ArrayBuffer | ArrayBufferView, sender: Party.Connection) {
    if (this.tickTimer()) return;

    let msg: ClientMessage;
    try {
      const text = typeof raw === "string" ? raw : new TextDecoder().decode(raw as ArrayBuffer);
      msg = JSON.parse(text) as ClientMessage;
    } catch {
      this.whisperError(sender.id, "Invalid message");
      return;
    }

    if (msg.type === "join") {
      const name = safeName(msg.name);
      if (!this.players.has(sender.id)) {
        if (this.hostId === null) {
          this.hostId = sender.id;
          this.players.set(sender.id, {
            name,
            isHost: true,
            participates: false,
            state: null,
            moveCount: 0,
            solvedAt: null,
            disconnected: false,
          });
        } else {
          this.players.set(sender.id, {
            name,
            isHost: false,
            participates: true,
            state: null,
            moveCount: 0,
            solvedAt: null,
            disconnected: false,
          });
        }
      } else {
        this.players.get(sender.id)!.name = name;
      }
      this.broadcastSnapshot();
      return;
    }

    const player = this.players.get(sender.id);
    if (!player) {
      this.whisperError(sender.id, "Join first");
      return;
    }

    if (msg.type === "config") {
      if (sender.id !== this.hostId) {
        this.whisperError(sender.id, "Only the host can change settings");
        return;
      }
      if (this.phase !== "lobby") {
        this.whisperError(sender.id, "Settings locked after start");
        return;
      }
      const maxTimeSeconds = Math.min(3600, Math.max(15, Math.floor(msg.maxTimeSeconds)));
      const scrambleDepth = Math.min(200, Math.max(10, Math.floor(msg.scrambleDepth)));
      this.config = { maxTimeSeconds, scrambleDepth };
      this.broadcastSnapshot();
      return;
    }

    if (msg.type === "setParticipates") {
      if (sender.id !== this.hostId) {
        this.whisperError(sender.id, "Only the lobby host can opt in/out of playing");
        return;
      }
      if (this.phase !== "lobby") {
        this.whisperError(sender.id, "Cannot change participation after start");
        return;
      }
      player.participates = msg.participates;
      this.broadcastSnapshot();
      return;
    }

    if (msg.type === "start") {
      if (sender.id !== this.hostId) {
        this.whisperError(sender.id, "Only the host can start");
        return;
      }
      if (this.phase !== "lobby") {
        this.whisperError(sender.id, "Game already started");
        return;
      }
      const competitors = [...this.players.values()].filter((p) => p.participates);
      if (competitors.length === 0) {
        this.whisperError(sender.id, "Need at least one competing player (host can opt in)");
        return;
      }

      const seed = scrambleFromSolved(this.config.scrambleDepth);
      const now = Date.now();
      this.phase = "playing";
      this.gameStart = now;
      this.gameEnd = now + this.config.maxTimeSeconds * 1000;
      this.standings = null;

      for (const p of this.players.values()) {
        if (p.participates) {
          p.state = cloneState(seed);
          p.moveCount = 0;
          p.solvedAt = null;
        } else {
          p.state = null;
          p.moveCount = 0;
          p.solvedAt = null;
        }
      }

      const delay = Math.max(0, this.gameEnd - Date.now());
      this.room.storage.setAlarm(Date.now() + delay + 50);
      this.broadcastSnapshot();
      return;
    }

    if (msg.type === "move") {
      this.applyPlayerMove(sender.id, msg.move);
      return;
    }
  }

  private applyPlayerMove(playerId: string, move: MoveKind) {
    if (this.phase !== "playing") return;

    if (Date.now() >= this.gameEnd) {
      this.finalizeGame();
      return;
    }

    const p = this.players.get(playerId);
    if (!p?.participates || !p.state) return;
    if (p.solvedAt !== null) return;

    p.state = applyMove(p.state, move);
    p.moveCount += 1;

    if (isSolved(p.state)) {
      p.solvedAt = Date.now();
    }

    const allSolved = [...this.players.values()]
      .filter((pl) => pl.participates && pl.state)
      .every((pl) => pl.solvedAt !== null);

    if (allSolved) {
      this.finalizeGame();
      return;
    }

    this.broadcastSnapshot();
  }

  onAlarm() {
    this.tickTimer();
  }

  /** @returns true if the game was finalized (caller should skip extra broadcasts). */
  private tickTimer(): boolean {
    if (this.phase === "playing" && Date.now() >= this.gameEnd) {
      this.finalizeGame();
      return true;
    }
    return false;
  }

  onClose(conn: Party.Connection) {
    const p = this.players.get(conn.id);
    if (p) p.disconnected = true;

    if (conn.id === this.hostId) {
      this.hostId = null;
      const next = [...this.players.entries()].find(
        ([id, pl]) => id !== conn.id && !pl.disconnected,
      );
      if (next) this.hostId = next[0];
    }
    this.broadcastSnapshot();
  }

  private finalizeGame() {
    if (this.phase !== "playing") return;
    this.phase = "ended";

    const rows: Omit<StandingRow, "rank">[] = [];
    const start = this.gameStart;

    for (const [id, pl] of this.players) {
      if (!pl.participates || !pl.state) continue;

      const solved = pl.solvedAt !== null;
      const solveTimeMs = solved ? pl.solvedAt! - start : null;
      const distanceRemaining = solved ? null : shortestDistanceToSolved(pl.state);

      rows.push({
        playerId: id,
        name: pl.name,
        solved,
        solveTimeMs,
        distanceRemaining,
        moveCount: pl.moveCount,
      });
    }

    rows.sort((a, b) => {
      if (a.solved && b.solved) {
        return (a.solveTimeMs ?? 0) - (b.solveTimeMs ?? 0);
      }
      if (a.solved && !b.solved) return -1;
      if (!a.solved && b.solved) return 1;
      const da = a.distanceRemaining ?? Number.POSITIVE_INFINITY;
      const db = b.distanceRemaining ?? Number.POSITIVE_INFINITY;
      if (da !== db) return da - db;
      return a.moveCount - b.moveCount;
    });

    this.standings = rows.map((r, i) => ({ ...r, rank: i + 1 }));
    this.room.broadcast(JSON.stringify(this.buildSnapshot()));
  }

  private whisperError(connectionId: string, message: string) {
    const c = this.room.getConnection(connectionId);
    if (c) {
      const err: ErrorMessage = { type: "error", message };
      c.send(JSON.stringify(err));
    }
  }

  private broadcastSnapshot() {
    if (this.tickTimer()) return;
    this.room.broadcast(JSON.stringify(this.buildSnapshot()));
  }

  private sendTo(connectionId: string, msg: ServerMessage) {
    const c = this.room.getConnection(connectionId);
    if (c) c.send(JSON.stringify(msg));
  }

  private buildSnapshot(forYouId?: string): SnapshotMessage {
    const now = Date.now();
    const roomCode = this.room.id;

    const playersOut: SnapshotMessage["players"] = {};
    for (const [id, pl] of this.players) {
      playersOut[id] = {
        name: pl.name,
        isHost: id === this.hostId,
        participates: pl.participates,
        moveCount: pl.moveCount,
        solved: pl.solvedAt !== null,
        state: pl.state ? cloneState(pl.state) : null,
        disconnected: pl.disconnected,
      };
    }

    const youId = forYouId ?? "";
    const you = this.players.get(youId);

    return {
      type: "snapshot",
      phase: this.phase,
      roomCode,
      you: {
        id: youId,
        isHost: youId === this.hostId,
        participates: you?.participates ?? false,
      },
      config: { ...this.config },
      players: playersOut,
      game:
        this.phase === "lobby"
          ? null
          : {
              startedAt: this.gameStart,
              endsAt: this.gameEnd,
              now,
            },
      standings: this.standings,
    };
  }
}
