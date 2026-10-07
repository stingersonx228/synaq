import type { CSSProperties } from "react";

const COLORS = ["var(--color-pen)", "var(--color-good)", "var(--color-intern)", "var(--color-text)"];
const PIECES = 36;

// Deterministic spread (no randomness during render): a cheap hash of the piece index.
const frac = (n: number) => {
  const x = Math.sin(n * 12.9898) * 43758.5453;
  return x - Math.floor(x);
};

/** One-shot burst when Alibek concedes. Pure CSS, ignores pointer events, honors reduced motion. */
export default function Confetti() {
  return (
    <div aria-hidden className="confetti pointer-events-none fixed inset-0 z-40 overflow-hidden">
      {Array.from({ length: PIECES }, (_, i) => {
        const style = {
          left: `${10 + frac(i) * 80}%`,
          background: COLORS[i % COLORS.length],
          width: `${6 + frac(i + 7) * 6}px`,
          height: `${10 + frac(i + 3) * 8}px`,
          animationDelay: `${frac(i + 11) * 180}ms`,
          "--dx": `${(frac(i + 5) - 0.5) * 40}vw`,
          "--rot": `${(frac(i + 9) - 0.5) * 1080}deg`,
        } as CSSProperties;
        return <span key={i} className="confetti-piece" style={style} />;
      })}
    </div>
  );
}
