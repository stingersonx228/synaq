import type { CSSProperties } from "react";

// Hand-drawn red-pen strokes. Paths use pathLength="1" so `.pen-draw` can draw them in.
// Pass `delay` (ms) to animate a mark in order; marks below the fold omit it and stay static.

type MarkProps = { className?: string; delay?: number };

function drawProps(delay: number | undefined) {
  if (delay === undefined) return {};
  return { className: "pen-draw", style: { "--delay": `${delay}ms` } as CSSProperties };
}

const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeLinecap: "round",
  strokeLinejoin: "round",
  pathLength: 1,
} as const;

/** A quick single stroke under a word, slightly rising to the right. */
export function Underline({ className = "", delay }: MarkProps) {
  return (
    <svg viewBox="0 0 300 16" preserveAspectRatio="none" className={className} aria-hidden>
      <path {...stroke} {...drawProps(delay)} strokeWidth={3.5} vectorEffect="non-scaling-stroke" d="M3 12 C 70 9, 150 6, 297 4" />
    </svg>
  );
}

/** The cross a teacher puts in the margin next to a wrong line. */
export function MarginCross({ className = "", delay }: MarkProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path {...stroke} {...drawProps(delay)} strokeWidth={2.6} d="M5 4.5 L19 19.5" />
      <path {...stroke} {...drawProps(delay === undefined ? undefined : delay + 180)} strokeWidth={2.6} d="M18.5 4 L5.5 19" />
    </svg>
  );
}

/** A loose oval around a grade, the end not quite meeting the start. */
export function GradeCircle({ className = "", delay }: MarkProps) {
  return (
    <svg viewBox="0 0 80 64" className={className} aria-hidden>
      <path
        {...stroke}
        {...drawProps(delay)}
        strokeWidth={2.4}
        d="M52 7 C 30 1, 6 12, 6 33 C 6 54, 32 61, 54 55 C 74 49, 78 26, 66 14 C 60 8, 50 5, 40 6"
      />
    </svg>
  );
}

/** A teacher's tick. */
export function Tick({ className = "", delay }: MarkProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path {...stroke} {...drawProps(delay)} strokeWidth={2.6} d="M4 13.5 L9.5 19 L20.5 5" />
    </svg>
  );
}
