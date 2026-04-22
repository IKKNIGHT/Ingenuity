import PartySocket from "partysocket";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PuzzleBoard } from "../components/PuzzleBoard";
import { getPartyKitHost } from "../multiplayer/partyHost";
import { SOLVED_STATE } from "../puzzle/engine";
import type { MoveKind } from "../puzzle/types";
import type { ErrorMessage, ServerMessage, SnapshotMessage } from "../multiplayer/types";

type Props = {
  roomCode: string;
  displayName: string;
  onBack: () => void;
};

export function MultiplayerRoom({ roomCode, displayName, onBack }: Props) {
  const [snap, setSnap] = useState<SnapshotMessage | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [connError, setConnError] = useState<string | null>(null);
  const [hostAbandoned, setHostAbandoned] = useState(false);
  const socketRef = useRef<PartySocket | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    setConnError(null);
    setSnap(null);

    const socket = new PartySocket({
      host: getPartyKitHost(),
      room: roomCode,
      party: "ingenuity",
    });
    socketRef.current = socket;

    const sendJoin = () => {
      socket.send(JSON.stringify({ type: "join", name: displayName }));
    };

    const onMessage = (ev: MessageEvent) => {
      try {
        const data = JSON.parse(String(ev.data)) as ServerMessage;
        if (data.type === "error") {
          setToast((data as ErrorMessage).message);
          window.setTimeout(() => setToast(null), 4000);
          return;
        }
        if (data.type === "snapshot") {
          setSnap(data);
          setConnError(null);
        }
      } catch {
        /* ignore */
      }
    };

    const onOpen = () => {
      sendJoin();
    };

    const onError = () => {
      setConnError(
        "Could not connect to the PartyKit server. From the web folder run `npm run dev:full` (Vite + PartyKit), or set `VITE_PARTYKIT_HOST` to your deployed PartyKit host.",
      );
    };

    socket.addEventListener("message", onMessage);
    socket.addEventListener("open", onOpen);
    socket.addEventListener("error", onError);

    if (socket.readyState === WebSocket.OPEN) {
      sendJoin();
    }

    const slow = window.setTimeout(() => {
      setSnap((s) => {
        if (s === null) {
          setConnError(
            "Still waiting for the lobby… Is PartyKit running on port 1999? Run `npm run dev:full` from the web folder.",
          );
        }
        return s;
      });
    }, 8000);

    return () => {
      window.clearTimeout(slow);
      socket.removeEventListener("message", onMessage);
      socket.removeEventListener("open", onOpen);
      socket.removeEventListener("error", onError);
      socket.close();
      socketRef.current = null;
    };
  }, [roomCode, displayName]);

  useEffect(() => {
    if (snap?.phase !== "playing") return;
    const t = window.setInterval(() => setTick((x) => x + 1), 500);
    return () => window.clearInterval(t);
  }, [snap?.phase]);

  // Detect if host abandoned during game
  useEffect(() => {
    if (!snap || snap.phase !== "ended") return;
    
    const hostPlayer = Object.values(snap.players).find((p) => p.isHost);
    if (!hostPlayer || hostPlayer.disconnected) {
      setHostAbandoned(true);
      const timer = window.setTimeout(() => {
        onBack();
      }, 3000);
      return () => window.clearTimeout(timer);
    }
  }, [snap, onBack]);

  const sendMove = useCallback((m: MoveKind) => {
    socketRef.current?.send(JSON.stringify({ type: "move", move: m }));
  }, []);

  const sendConfig = useCallback((maxTimeSeconds: number, scrambleDepth: number) => {
    socketRef.current?.send(JSON.stringify({ type: "config", maxTimeSeconds, scrambleDepth }));
  }, []);

  const setParticipates = useCallback((participates: boolean) => {
    socketRef.current?.send(JSON.stringify({ type: "setParticipates", participates }));
  }, []);

  const start = useCallback(() => {
    socketRef.current?.send(JSON.stringify({ type: "start" }));
  }, []);

  const timeLeftSec = useMemo(() => {
    if (!snap?.game) return null;
    void tick;
    return Math.max(0, Math.ceil((snap.game.endsAt - Date.now()) / 1000));
  }, [snap, tick]);

  const myId = snap?.you.id;
  const myState = myId ? snap?.players[myId]?.state : null;
  const canPlay =
    snap?.phase === "playing" &&
    Boolean(snap.you.participates && myState && myId && !snap.players[myId]?.solved);

  const competitorBoards = useMemo(() => {
    if (!snap) return [];
    return Object.entries(snap.players).filter(([, p]) => p.participates && p.state);
  }, [snap]);

  const watchBoards = useMemo(() => {
    if (!snap) return [];
    if (snap.you.participates && myId) {
      return competitorBoards.filter(([id]) => id !== myId);
    }
    return competitorBoards;
  }, [snap, competitorBoards, myId]);

  const copyCode = () => {
    void navigator.clipboard.writeText(snap?.roomCode ?? roomCode);
    setToast("Code copied");
    window.setTimeout(() => setToast(null), 2000);
  };

  return (
    <div className="mx-auto max-w-6xl px-4 pb-20 pt-8">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4 animate-in-fade">
        <div>
          <button
            type="button"
            onClick={onBack}
            className="mb-2 text-sm text-teal-300/90 hover:text-teal-200"
          >
            ← Leave
          </button>
          <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Multiplayer
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Room <span className="font-mono text-teal-200">{snap?.roomCode ?? roomCode}</span>
            <button
              type="button"
              onClick={copyCode}
              className="ml-3 rounded-lg bg-white/10 px-2 py-0.5 text-xs font-semibold text-white ring-1 ring-white/15 hover:bg-white/15"
            >
              Copy
            </button>
          </p>
        </div>
        {snap?.phase === "playing" && timeLeftSec !== null && (
          <div className="rounded-2xl bg-black/30 px-5 py-3 text-center ring-1 ring-white/10 animate-in-scale">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Time left
            </div>
            <div className="font-mono text-3xl text-amber-300 tabular-nums">{timeLeftSec}s</div>
          </div>
        )}
      </header>

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-[60] -translate-x-1/2 rounded-xl bg-slate-900 px-4 py-2 text-sm text-white shadow-xl ring-1 ring-white/15">
          {toast}
        </div>
      )}

      {!snap && !connError && (
        <p className="text-center text-slate-400 animate-in-fade">Connecting to the lobby…</p>
      )}
      {!snap && connError && (
        <div className="mx-auto max-w-lg rounded-2xl border border-rose-500/40 bg-rose-950/40 p-6 text-center text-sm text-rose-100 animate-in-up">
          <p>{connError}</p>
          <button
            type="button"
            onClick={onBack}
            className="mt-4 rounded-xl bg-white/10 px-4 py-2 text-white ring-1 ring-white/20 hover:bg-white/15"
          >
            Back
          </button>
        </div>
      )}

      {hostAbandoned && (
        <div className="mx-auto mb-6 max-w-lg rounded-2xl border border-orange-500/40 bg-orange-950/40 p-6 text-center text-sm text-orange-100 animate-in-up">
          <p className="font-semibold">Host left the game</p>
          <p className="mt-2 text-xs text-orange-200">Returning to lobby...</p>
        </div>
      )}

      {snap && snap.phase === "lobby" && (
        <div className="animate-in-fade">
          <LobbyPanel
            snap={snap}
            onConfig={sendConfig}
            onParticipate={setParticipates}
            onStart={start}
          />
        </div>
      )}

      {snap && snap.phase === "playing" && (
        <div
          className={`animate-in-up ${
            snap.you.participates
              ? "grid gap-8 lg:grid-cols-[1fr_1fr]"
              : "grid gap-8"
          }`}
        >
          {snap.you.participates && (
            <section className="rounded-3xl border border-white/10 bg-[var(--color-panel)] p-5 shadow-xl backdrop-blur-md animate-in-left">
              <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-500">
                Your board
              </h2>
              {myState && (
                <PuzzleBoard
                  state={myState}
                  onMove={sendMove}
                  disabled={!canPlay}
                  readOnly={false}
                />
              )}
              {myState && myId && (
                <p className="mt-4 text-center text-sm text-slate-400">
                  Moves:{" "}
                  <span className="font-mono text-teal-200">{snap.players[myId]?.moveCount ?? 0}</span>
                  {snap.players[myId]?.solved && (
                    <span className="ml-3 text-emerald-400">Solved — waiting for others or timer</span>
                  )}
                </p>
              )}
              
              <div className="mt-8 pt-8 border-t border-white/10">
                <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-500">
                  Target state
                </h3>
                <PuzzleBoard state={SOLVED_STATE} readOnly />
              </div>
            </section>
          )}

          {!snap.you.participates && (
            <p className="mb-4 rounded-2xl bg-amber-950/40 px-4 py-3 text-sm text-amber-100 ring-1 ring-amber-500/30 animate-in-up">
              Spectator view — you can see every competitor&apos;s live board but cannot act. Only the
              host can opt in before the match starts.
            </p>
          )}

          {snap.you.isHost && (
            <section
              className={`rounded-3xl border border-white/10 bg-black/20 p-5 ring-1 ring-white/5 animate-in-right ${
                snap.you.participates ? "" : "lg:col-span-2"
              }`}
            >
              <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-500">
                {snap.you.participates ? "Other players" : "All players (read-only)"}
              </h2>
              <div className="grid max-h-[70vh] gap-6 overflow-y-auto pr-1 sm:grid-cols-2 lg:grid-cols-2">
                {watchBoards.map(([id, p]) => (
                  <div key={id} className="rounded-2xl bg-white/5 p-3 ring-1 ring-white/10 animate-in-scale">
                    <div className="mb-2 flex items-center justify-between text-xs text-slate-400">
                      <span className="font-semibold text-slate-200">{p.name}</span>
                      {p.solved ? <span className="text-emerald-400">Solved</span> : null}
                      {p.disconnected ? <span className="text-rose-400">Away</span> : null}
                    </div>
                    <PuzzleBoard state={p.state!} readOnly />
                    <div className="mt-2 text-center text-[11px] text-slate-500">
                      Moves {p.moveCount}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {snap && snap.phase === "ended" && snap.standings && (
        <div className="animate-in-up">
          <Results standings={snap.standings} youId={myId} />
        </div>
      )}
    </div>
  );
}

function LobbyPanel({
  snap,
  onConfig,
  onParticipate,
  onStart,
}: {
  snap: SnapshotMessage;
  onConfig: (maxTimeSeconds: number, scrambleDepth: number) => void;
  onParticipate: (v: boolean) => void;
  onStart: () => void;
}) {
  const [maxT, setMaxT] = useState(snap.config.maxTimeSeconds);
  const [depth, setDepth] = useState(snap.config.scrambleDepth);

  useEffect(() => {
    setMaxT(snap.config.maxTimeSeconds);
    setDepth(snap.config.scrambleDepth);
  }, [snap.config.maxTimeSeconds, snap.config.scrambleDepth]);

  const players = Object.entries(snap.players);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="rounded-3xl border border-white/10 bg-[var(--color-panel)] p-6 backdrop-blur-md animate-in-left">
        <h2 className="text-lg font-semibold text-white">Lobby</h2>
        <ul className="mt-4 space-y-2 text-sm">
          {players.map(([id, p]) => (
            <li
              key={id}
              className="flex items-center justify-between rounded-xl bg-black/20 px-3 py-2 ring-1 ring-white/10 animate-in-scale"
            >
              <span>{p.name}</span>
              <span className="text-xs text-slate-500">
                {p.isHost ? "Host" : "Player"}
                {p.isHost && p.participates ? " · competing" : ""}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {snap.you.isHost ? (
        <div className="rounded-3xl border border-teal-500/20 bg-teal-950/30 p-6 backdrop-blur-md animate-in-right">
          <h2 className="text-lg font-semibold text-white">Host controls</h2>
          <label className="mt-4 block text-sm text-slate-400">
            Round timer (seconds)
            <input
              type="range"
              min={15}
              max={1800}
              value={maxT}
              onChange={(e) => {
                const v = Number(e.target.value);
                setMaxT(v);
                onConfig(v, depth);
              }}
              className="mt-2 w-full accent-teal-500"
            />
            <div className="font-mono text-teal-200">{maxT}s</div>
          </label>
          <label className="mt-4 block text-sm text-slate-400">
            Scramble depth (moves)
            <input
              type="range"
              min={10}
              max={120}
              value={depth}
              onChange={(e) => {
                const v = Number(e.target.value);
                setDepth(v);
                onConfig(maxT, v);
              }}
              className="mt-2 w-full accent-teal-500"
            />
            <div className="font-mono text-teal-200">{depth}</div>
          </label>
          <label className="mt-4 flex cursor-pointer items-center gap-2 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={snap.you.participates}
              onChange={(e) => onParticipate(e.target.checked)}
              className="size-4 accent-teal-500"
            />
            Compete as a player (not only spectate)
          </label>
          <button
            type="button"
            onClick={onStart}
            className="mt-6 w-full rounded-xl bg-teal-600 py-3 text-sm font-bold text-white shadow-lg hover:bg-teal-500"
          >
            Start match
          </button>
        </div>
      ) : (
        <div className="rounded-3xl border border-white/10 bg-[var(--color-panel)] p-6 text-sm text-slate-400 backdrop-blur-md animate-in-right">
          Waiting for the host to start…
        </div>
      )}
    </div>
  );
}

function Results({
  standings,
  youId,
}: {
  standings: NonNullable<SnapshotMessage["standings"]>;
  youId?: string;
}) {
  if (standings.length === 0) {
    return (
      <div className="rounded-3xl border border-white/10 bg-[var(--color-panel)] p-8 text-center text-slate-400 backdrop-blur-md animate-in-scale">
        No competitors finished with a recorded board.
      </div>
    );
  }
  return (
    <div className="rounded-3xl border border-white/10 bg-[var(--color-panel)] p-8 backdrop-blur-md">
      <h2 className="text-center text-2xl font-bold text-white">Final standings</h2>
      <p className="mt-2 text-center text-sm text-slate-400">
        Solved players ranked by fastest time. Unsolved ranked by fewest optimal moves remaining, then
        fewer total moves.
      </p>
      <ol className="mx-auto mt-8 max-w-lg space-y-3">
        {standings.map((row) => (
          <li
            key={row.playerId}
            className={`flex items-center justify-between rounded-2xl px-4 py-3 ring-1 ${
              row.playerId === youId ? "bg-teal-900/40 ring-teal-500/40" : "bg-black/25 ring-white/10"
            }`}
          >
            <div className="flex items-center gap-3">
              <span className="font-mono text-xl text-slate-500">#{row.rank}</span>
              <span className="font-medium text-white">{row.name}</span>
            </div>
            <div className="text-right text-sm text-slate-400">
              {row.solved ? (
                <span className="text-emerald-400">
                  {(row.solveTimeMs! / 1000).toFixed(2)}s
                </span>
              ) : (
                <span>
                  Not solved · <span className="text-amber-300">{row.distanceRemaining}</span> opt.
                  moves left
                </span>
              )}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
