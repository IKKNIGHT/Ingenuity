import { useCallback, useEffect, useMemo, useState } from "react";
import { PuzzleBoard } from "../components/PuzzleBoard";
import { shortestDistanceToSolved } from "../puzzle/bfs";
import {
  SOLVED_STATE,
  applyMove,
  isSolved,
  scrambleFromSolved,
  type MoveKind,
  type PuzzleState,
} from "../puzzle/engine";

type Props = {
  onBack: () => void;
};

type Phase = "play" | "won" | "timeUp";

export function SinglePlayer({ onBack }: Props) {
  const [limitSec] = useState(300);
  const [state, setState] = useState<PuzzleState>(() => scrambleFromSolved(55));
  const [moves, setMoves] = useState(0);
  const [phase, setPhase] = useState<Phase>("play");
  const [timeLeft, setTimeLeft] = useState<number | null>(() => 300);
  const [viewingSolution, setViewingSolution] = useState(false);
  const [scrambleKey, setScrambleKey] = useState(0);

  const won = useMemo(() => isSolved(state), [state]);

  const optimalMovesRemaining = useMemo(() => {
    if (phase !== "timeUp") return null;
    const d = shortestDistanceToSolved(state);
    return Number.isFinite(d) ? d : null;
  }, [phase, state]);

  useEffect(() => {
    if (phase === "play" && won) setPhase("won");
  }, [phase, won]);

  useEffect(() => {
    if (phase === "won" || phase === "timeUp") setViewingSolution(false);
  }, [phase]);

  useEffect(() => {
    if (phase !== "play" || timeLeft !== 0) return;
    if (isSolved(state)) setPhase("won");
    else setPhase("timeUp");
  }, [phase, timeLeft, state]);

  useEffect(() => {
    if (phase !== "play") return;
    const t = window.setInterval(() => {
      setTimeLeft((s) => {
        if (s === null) return s;
        if (s <= 0) return 0;
        return s - 1;
      });
    }, 1000);
    return () => window.clearInterval(t);
  }, [phase, scrambleKey]);

  const newScramble = useCallback(() => {
    setState(scrambleFromSolved(55));
    setMoves(0);
    setPhase("play");
    setTimeLeft(limitSec);
    setViewingSolution(false);
    setScrambleKey((k) => k + 1);
  }, [limitSec]);

  const canInteract = phase === "play" && !viewingSolution;

  const displayState = viewingSolution ? SOLVED_STATE : state;

  const doMove = useCallback(
    (m: MoveKind) => {
      if (!canInteract) return;
      setState((s) => applyMove(s, m));
      setMoves((c) => c + 1);
    },
    [canInteract],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!canInteract) return;
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        doMove("L");
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        doMove("R");
      }
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        doMove("B");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [canInteract, doMove]);

  return (
    <div className="mx-auto max-w-3xl px-4 pb-16 pt-8">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <button
            type="button"
            onClick={onBack}
            className="mb-2 text-sm text-teal-300/90 hover:text-teal-200"
          >
            ← Back
          </button>
          <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Single player
          </h1>
          <p className="mt-1 max-w-prose text-sm text-slate-400">
            Reach the trial pattern using Left, Right, and Swap. Keyboard: ← → Space. Peek at the goal
            layout anytime — multiplayer has no spoiler.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <Stat label="Moves" value={moves} />
          {timeLeft !== null && <Stat label="Time" value={`${timeLeft}s`} />}
        </div>
      </header>

      <div className="rounded-3xl border border-white/10 bg-[var(--color-panel)] p-6 shadow-2xl backdrop-blur-md">
        {viewingSolution && (
          <p className="mb-4 rounded-xl bg-amber-950/50 px-3 py-2 text-center text-sm text-amber-100 ring-1 ring-amber-500/30">
            Showing the <strong>solved</strong> pattern — moves are disabled. Toggle off to continue.
          </p>
        )}
        <PuzzleBoard state={displayState} onMove={doMove} disabled={!canInteract} />
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={() => setViewingSolution((v) => !v)}
            disabled={phase !== "play"}
            className="rounded-xl bg-indigo-600/90 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {viewingSolution ? "Hide solution" : "Show solution"}
          </button>
          <button
            type="button"
            onClick={newScramble}
            className="rounded-xl bg-white/10 px-5 py-2.5 text-sm font-semibold text-white ring-1 ring-white/15 transition hover:bg-white/15"
          >
            New scramble
          </button>
        </div>
      </div>

      {phase === "won" && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal
        >
          <div className="max-w-md rounded-2xl border border-teal-500/30 bg-slate-900 p-8 text-center shadow-2xl">
            <p className="text-sm font-medium uppercase tracking-widest text-teal-400">Trial complete</p>
            <h2 className="mt-2 text-2xl font-bold text-white">Pattern restored</h2>
            <p className="mt-3 text-slate-400">
              Moves: <span className="text-white">{moves}</span>
              {timeLeft !== null && (
                <>
                  {" "}
                  · Time left: <span className="text-white">{timeLeft}s</span>
                </>
              )}
            </p>
            <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
              <button
                type="button"
                onClick={newScramble}
                className="rounded-xl bg-teal-600 px-5 py-3 text-sm font-semibold text-white hover:bg-teal-500"
              >
                Play again
              </button>
              <button
                type="button"
                onClick={onBack}
                className="rounded-xl bg-white/10 px-5 py-3 text-sm font-semibold text-white ring-1 ring-white/15 hover:bg-white/15"
              >
                Home
              </button>
            </div>
          </div>
        </div>
      )}

      {phase === "timeUp" && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal
        >
          <div className="max-w-md rounded-2xl border border-amber-500/30 bg-slate-900 p-8 text-center shadow-2xl">
            <p className="text-sm font-medium uppercase tracking-widest text-amber-400">Time&apos;s up</p>
            <h2 className="mt-2 text-2xl font-bold text-white">Trial not completed</h2>
            <p className="mt-3 text-slate-400">
              Your moves: <span className="text-white">{moves}</span>
            </p>
            {optimalMovesRemaining !== null && (
              <p className="mt-2 text-sm text-slate-300">
                Optimal moves still needed from that position:{" "}
                <span className="font-mono text-lg text-amber-200">{optimalMovesRemaining}</span>
              </p>
            )}
            <p className="mt-2 text-xs text-slate-500">
              “Optimal” = fewest Left / Right / Swap moves to reach the goal pattern (computed locally).
            </p>
            <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
              <button
                type="button"
                onClick={newScramble}
                className="rounded-xl bg-teal-600 px-5 py-3 text-sm font-semibold text-white hover:bg-teal-500"
              >
                Try again
              </button>
              <button
                type="button"
                onClick={onBack}
                className="rounded-xl bg-white/10 px-5 py-3 text-sm font-semibold text-white ring-1 ring-white/15 hover:bg-white/15"
              >
                Home
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl bg-black/25 px-4 py-2 ring-1 ring-white/10">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{label}</div>
      <div className="font-mono text-lg text-teal-200">{value}</div>
    </div>
  );
}
