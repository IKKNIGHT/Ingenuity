import { useMemo } from "react";
import type { MoveKind, PuzzleState } from "../puzzle/types";
import { waterVisibility } from "../puzzle/water";

type Props = {
  state: PuzzleState;
  onMove?: (m: MoveKind) => void;
  disabled?: boolean;
  readOnly?: boolean;
  compact?: boolean;
};

const glyphClass =
  "flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-teal-900/70 text-sm font-semibold text-white shadow-inner sm:h-12 sm:w-12";

/**
 * Layout matches the original `ingenuity.html`: each side is a diamond of four runes around a
 * central Left / Right control; Swap sits between the two diamonds. Water segments run from the
 * hub toward each rune (SVG lines, same topology as the legacy transforms).
 */
export function PuzzleBoard({ state, onMove, disabled, readOnly, compact }: Props) {
  const w = useMemo(() => waterVisibility(state), [state]);
  const d = disabled || readOnly;
  const cluster = compact ? "h-[9.5rem] w-[9.5rem] sm:h-44 sm:w-44" : "h-44 w-44 sm:h-52 sm:w-52";

  return (
    <div className={`relative mx-auto flex ${readOnly ? "w-full" : "max-w-4xl"} flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4`}>
      <DiamondCluster
        className={cluster}
        variant="left"
        state={state}
        water={{
          west: w.leftWater1,
          north: w.leftWater2,
          south: w.leftWater3,
          east: w.leftWater4,
        }}
        centerLabel="Left"
        onCenter={() => onMove?.("L")}
        disabled={d}
      />

      <button
        type="button"
        className="z-20 h-14 w-20 shrink-0 rounded-xl bg-amber-500 text-sm font-bold text-slate-900 shadow-lg transition hover:bg-amber-400 active:scale-95 disabled:opacity-40 sm:h-16 sm:w-24"
        disabled={d}
        onClick={() => onMove?.("B")}
      >
        Swap
      </button>

      <DiamondCluster
        className={cluster}
        variant="right"
        state={state}
        water={{
          west: w.rightWater4,
          north: w.rightWater2,
          south: w.rightWater3,
          east: w.rightWater1,
        }}
        centerLabel="Right"
        onCenter={() => onMove?.("R")}
        disabled={d}
      />

      {readOnly && (
        <div
          className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-white/10"
          aria-hidden
        />
      )}
    </div>
  );
}

type DiamondClusterProps = {
  className: string;
  variant: "left" | "right";
  state: PuzzleState;
  water: { west: boolean; north: boolean; south: boolean; east: boolean };
  centerLabel: string;
  onCenter: () => void;
  disabled: boolean;
};

function DiamondCluster({
  className,
  variant,
  state,
  water,
  centerLabel,
  onCenter,
  disabled,
}: DiamondClusterProps) {
  const glyphs =
    variant === "left"
      ? {
          west: state.leftButton1,
          north: state.leftButton2,
          south: state.leftButton3,
          east: state.leftButton4,
        }
      : {
          west: state.rightButton4,
          north: state.rightButton2,
          south: state.rightButton3,
          east: state.rightButton1,
        };

  return (
    <div className={`relative ${className}`}>
      {/* Water: hub (50,50) to each cardinal — behind glyphs */}
      <svg
        className="pointer-events-none absolute inset-0 z-0 h-full w-full"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        aria-hidden
      >
        <WaterLine active={water.west} x1={50} y1={50} x2={14} y2={50} />
        <WaterLine active={water.north} x1={50} y1={50} x2={50} y2={14} />
        <WaterLine active={water.south} x1={50} y1={50} x2={50} y2={86} />
        <WaterLine active={water.east} x1={50} y1={50} x2={86} y2={50} />
        {/* Cover water lines under rune nodes */}
        <circle cx={14} cy={50} r={12} fill="#164e63" />
        <circle cx={50} cy={14} r={12} fill="#164e63" />
        <circle cx={50} cy={86} r={12} fill="#164e63" />
        <circle cx={86} cy={50} r={12} fill="#164e63" />
        <circle cx={50} cy={50} r={10} fill="#0d9488" />
      </svg>

      <button
        type="button"
        className="absolute left-1/2 top-1/2 z-30 h-12 w-12 -translate-x-1/2 -translate-y-1/2 rounded-full bg-teal-600 text-[10px] font-bold leading-tight text-white shadow-lg transition hover:bg-teal-500 active:scale-95 disabled:opacity-40 sm:h-14 sm:w-14 sm:text-xs"
        disabled={disabled}
        onClick={onCenter}
      >
        {centerLabel}
      </button>

      <div
        className={`${glyphClass} absolute left-[14%] top-1/2 z-20 -translate-x-1/2 -translate-y-1/2`}
        aria-hidden
      >
        {glyphs.west}
      </div>
      <div
        className={`${glyphClass} absolute left-1/2 top-[14%] z-20 -translate-x-1/2 -translate-y-1/2`}
        aria-hidden
      >
        {glyphs.north}
      </div>
      <div
        className={`${glyphClass} absolute left-1/2 top-[86%] z-20 -translate-x-1/2 -translate-y-1/2`}
        aria-hidden
      >
        {glyphs.south}
      </div>
      <div
        className={`${glyphClass} absolute left-[86%] top-1/2 z-20 -translate-x-1/2 -translate-y-1/2`}
        aria-hidden
      >
        {glyphs.east}
      </div>
    </div>
  );
}

function WaterLine({
  active,
  x1,
  y1,
  x2,
  y2,
}: {
  active: boolean;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}) {
  return (
    <line
      x1={x1}
      y1={y1}
      x2={x2}
      y2={y2}
      stroke="#38bdf8"
      strokeWidth={5}
      strokeLinecap="round"
      className="transition-opacity duration-300"
      opacity={active ? 0.95 : 0}
    />
  );
}
