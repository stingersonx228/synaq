import { MAX_REFUTE_TRIES } from "./scoring";
import type { Case, Outcome } from "./types";

export interface AttemptFacts {
  outcome: Outcome;
  hintsUsed: number;
  causeOk: boolean | null;
  refuteTries: number;
  livesLost: number;
}

/**
 * Rejects round reports the game can never produce, so tampered or buggy clients cannot
 * pollute the teacher dashboard. Mirrors the round flow in components/game/Game.tsx.
 */
export function attemptFactsValid(c: Case, a: AttemptFacts): boolean {
  const lostRound = a.outcome !== "solved";
  // Every lost round costs exactly the life that ended it, plus earlier wrong-line clicks.
  if (lostRound && a.livesLost < 1) return false;

  if (c.bug === null) {
    // Clean case: either "no errors" (win, no life lost) or an accusation (one life).
    if (a.causeOk !== null || a.refuteTries !== 0) return false;
    if (a.outcome === "solved") return a.livesLost === 0;
    return a.outcome === "false_accusation" && a.livesLost === 1;
  }

  switch (a.outcome) {
    case "solved":
      return a.refuteTries >= 1 && a.refuteTries <= MAX_REFUTE_TRIES;
    case "failed_proof":
      return a.refuteTries === MAX_REFUTE_TRIES;
    case "wrong_line":
    case "missed_clean":
      // Both end the round in the line-picking phase, before any explanation or proof.
      return a.refuteTries === 0 && a.causeOk === null;
    case "false_accusation":
      return false;
  }
}
