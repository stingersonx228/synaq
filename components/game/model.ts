import { INTERN_LINES, pickSessionCases, SESSION_LIVES } from "@/lib/catalog";
import type { Outcome } from "@/lib/types";

export type Phase = "pick" | "explain" | "prove" | "done";

export interface ChatMsg {
  key: string;
  from: "intern" | "student";
  text: string;
  tone?: "concede";
}

export interface Round {
  token: number;
  caseId: string;
  phase: Phase;
  wrongLines: number[];
  foundLine: number | null;
  hintsUsed: number;
  causeOk: boolean | null;
  refuteTries: number;
  proofFeedback: string | null;
  chat: ChatMsg[];
  typing: boolean;
  outcome: Outcome | null;
  livesLost: number;
  score: number;
}

export interface RoundResult {
  /** Idempotency key for the server report; stays the same across retries. */
  attemptId: string;
  caseId: string;
  typeId: string;
  outcome: Outcome;
  score: number;
  stars: number;
  hintsUsed: number;
  causeOk: boolean | null;
  refuteTries: number;
  livesLost: number;
}

export interface GameState {
  caseIds: string[];
  index: number;
  lives: number;
  total: number;
  results: RoundResult[];
  round: Round;
  over: boolean;
  flash: { kind: "good" | "bad"; key: number } | null;
}

export function newRound(caseId: string, token: number): Round {
  return {
    token,
    caseId,
    phase: "pick",
    wrongLines: [],
    foundLine: null,
    hintsUsed: 0,
    causeOk: null,
    refuteTries: 0,
    proofFeedback: null,
    chat: [{ key: `${token}-0`, from: "intern", text: INTERN_LINES.greeting }],
    typing: false,
    outcome: null,
    livesLost: 0,
    score: 0,
  };
}

export function newGame(fixedCaseId: string | null, token: number): GameState {
  const caseIds = fixedCaseId ? [fixedCaseId] : pickSessionCases();
  return {
    caseIds,
    index: 0,
    lives: SESSION_LIVES,
    total: 0,
    results: [],
    round: newRound(caseIds[0], token),
    over: false,
    flash: null,
  };
}

export function addMsg(round: Round, from: ChatMsg["from"], text: string, tone?: ChatMsg["tone"]): Round {
  return { ...round, chat: [...round.chat, { key: `${round.token}-${round.chat.length}`, from, text, tone }] };
}
