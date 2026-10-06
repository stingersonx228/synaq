import type { Outcome } from "./types";

export const SCORE = {
  found: 60,
  causeOk: 30,
  firstTry: 10,
  cleanWin: 100,
  hintCost: [10, 20, 30],
} as const;

export const MAX_HINTS = 3;
export const MAX_REFUTE_TRIES = 3;

export interface RoundScoreInput {
  outcome: Outcome;
  /** True for a clean case (bug === null). */
  clean: boolean;
  causeOk: boolean | null;
  refuteTries: number;
  hintsUsed: number;
}

/** Total penalty for opening the first `hintsUsed` hint levels. */
export function hintPenalty(hintsUsed: number): number {
  const n = Math.max(0, Math.min(MAX_HINTS, Math.floor(hintsUsed)));
  return SCORE.hintCost.slice(0, n).reduce((a, b) => a + b, 0);
}

export function roundScore(input: RoundScoreInput): number {
  if (input.outcome !== "solved") return 0;
  let score: number;
  if (input.clean) {
    score = SCORE.cleanWin;
  } else {
    score = SCORE.found;
    if (input.causeOk === true) score += SCORE.causeOk;
    if (input.refuteTries === 1) score += SCORE.firstTry;
  }
  return Math.max(0, score - hintPenalty(input.hintsUsed));
}

export function stars(score: number): 0 | 1 | 2 | 3 {
  if (score >= 90) return 3;
  if (score >= 60) return 2;
  if (score > 0) return 1;
  return 0;
}

export interface RoundSummary {
  typeId: string;
  outcome: Outcome;
  hintsUsed: number;
}

/** Error types the student did not catch, or caught only with a hint. Ordered, unique. */
export function blindSpots(rounds: RoundSummary[]): string[] {
  const out: string[] = [];
  for (const r of rounds) {
    const weak = r.outcome !== "solved" || r.hintsUsed > 0;
    if (weak && !out.includes(r.typeId)) out.push(r.typeId);
  }
  return out;
}
