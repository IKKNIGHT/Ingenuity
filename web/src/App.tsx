import { useMemo, useState } from "react";
import { generateRoomCode, normalizeRoomCode } from "./multiplayer/code";
import { MultiplayerRoom } from "./views/MultiplayerRoom";
import { SinglePlayer } from "./views/SinglePlayer";

type View =
  | { screen: "home" }
  | { screen: "solo" }
  | { screen: "mp"; code: string; name: string };

export function App() {
  const [view, setView] = useState<View>({ screen: "home" });
  const [displayName, setDisplayName] = useState("");
  const [joinCode, setJoinCode] = useState("");

  const nameOk = useMemo(() => displayName.trim().length > 0, [displayName]);

  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-teal-600 focus:px-3 focus:py-2"
      >
        Skip to content
      </a>
      <div id="main" className="min-h-screen">
        {view.screen === "home" && (
          <div className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center px-4 py-16">
            <div className="mb-2 inline-flex w-fit items-center gap-2 rounded-full bg-teal-500/15 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-teal-300 ring-1 ring-teal-500/30">
              Web edition
            </div>
            <h1 className="mt-4 text-4xl font-bold tracking-tight text-white sm:text-5xl">
              Trial of Ingenuity
            </h1>
            <p className="mt-4 text-lg leading-relaxed text-slate-400">
              Rotate two rings of runes, swap opposing pairs, and restore the hidden pattern.
            </p>

            <div className="mt-10 flex flex-col gap-4 sm:flex-row">
              <button
                type="button"
                onClick={() => setView({ screen: "solo" })}
                className="flex-1 rounded-2xl bg-teal-600 px-6 py-4 text-center text-base font-semibold text-white shadow-lg shadow-teal-900/40 transition hover:bg-teal-500"
              >
                Single player
              </button>
            </div>

            <div className="mt-12 rounded-3xl border border-white/10 bg-[var(--color-panel)] p-6 backdrop-blur-md">
              <h2 className="text-lg font-semibold text-white">Multiplayer</h2>
              <p className="mt-1 text-sm text-slate-400">
                Create a room and share the code, or join a friend. The host sets the timer and
                scramble strength.
              </p>
              <label className="mt-4 block text-sm text-slate-300">
                Display name
                <input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="How others see you"
                  className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none ring-0 placeholder:text-slate-600 focus:border-teal-500/50"
                  autoComplete="nickname"
                />
              </label>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  disabled={!nameOk}
                  onClick={() =>
                    nameOk &&
                    setView({ screen: "mp", code: generateRoomCode(), name: displayName.trim() })
                  }
                  className="rounded-xl bg-indigo-600 py-3 text-sm font-semibold text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Create room
                </button>
                <div className="flex gap-2">
                  <input
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value)}
                    placeholder="CODE"
                    className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/30 px-3 py-3 font-mono text-sm uppercase text-white outline-none focus:border-teal-500/50"
                    maxLength={8}
                  />
                  <button
                    type="button"
                    disabled={!nameOk || normalizeRoomCode(joinCode).length < 4}
                    onClick={() =>
                      nameOk &&
                      setView({
                        screen: "mp",
                        code: normalizeRoomCode(joinCode),
                        name: displayName.trim(),
                      })
                    }
                    className="shrink-0 rounded-xl bg-white/10 px-4 py-3 text-sm font-semibold text-white ring-1 ring-white/15 hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Join
                  </button>
                </div>
              </div>
              <p className="mt-4 text-xs leading-relaxed text-slate-500">
                Note: Multiplayer is in early access. Expect some rough edges and occasional bugs.
              </p>
            </div>

            <footer className="mt-16 text-center text-xs text-slate-600">
              Puzzle logic from the original Trial of Ingenuity · UI rebuilt for the web
            </footer>
          </div>
        )}

        {view.screen === "solo" && (
          <SinglePlayer onBack={() => setView({ screen: "home" })} />
        )}

        {view.screen === "mp" && (
          <MultiplayerRoom
            roomCode={view.code}
            displayName={view.name}
            onBack={() => setView({ screen: "home" })}
          />
        )}
      </div>
    </>
  );
}
