import { DEFAULT_SUBJECT, getCase, INTERN_LINES, pickSessionCases, SESSION_LIVES, SESSION_ROUNDS } from "@/lib/catalog";
import { OUTCOMES, SUBJECTS, type Outcome, type Subject } from "@/lib/types";

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
  /** The student's explanation, kept so a resumed round can still be judged. */
  explanation: string | null;
  hintsUsed: number;
  causeOk: boolean | null;
  refuteTries: number;
  proofFeedback: string | null;
  /** What the winning proof showed, with the computed numbers. */
  proof: string | null;
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
  subject: Subject;
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
    explanation: null,
    hintsUsed: 0,
    causeOk: null,
    refuteTries: 0,
    proofFeedback: null,
    proof: null,
    chat: [{ key: `${token}-0`, from: "intern", text: INTERN_LINES.greeting }],
    typing: false,
    outcome: null,
    livesLost: 0,
    score: 0,
  };
}

/** `presetCaseIds` overrides the random pick (used by blind-spot practice). */
export function newGame(
  fixedCaseId: string | null,
  token: number,
  presetCaseIds?: string[],
  subject: Subject = DEFAULT_SUBJECT,
): GameState {
  const caseIds = presetCaseIds?.length
    ? presetCaseIds
    : fixedCaseId
      ? [fixedCaseId]
      : pickSessionCases(SESSION_ROUNDS, Math.random, subject);
  return {
    subject: getCase(caseIds[0])?.subject ?? subject,
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

const PHASES: readonly Phase[] = ["pick", "explain", "prove", "done"];

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;
const isInt = (v: unknown, min: number, max = Number.MAX_SAFE_INTEGER): v is number =>
  Number.isInteger(v) && (v as number) >= min && (v as number) <= max;
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const isStr = (v: unknown): v is string => typeof v === "string";
const isNullable = <T,>(v: unknown, guard: (x: unknown) => x is T): boolean => v === null || guard(v);
const isBool = (v: unknown): v is boolean => typeof v === "boolean";
const isOutcome = (v: unknown): v is Outcome => OUTCOMES.includes(v as Outcome);

function isChatMsg(v: unknown): v is ChatMsg {
  return (
    isObj(v) &&
    isStr(v.key) &&
    (v.from === "intern" || v.from === "student") &&
    isStr(v.text) &&
    (v.tone === undefined || v.tone === "concede")
  );
}

function isResult(v: unknown): v is RoundResult {
  return (
    isObj(v) &&
    isStr(v.attemptId) &&
    isStr(v.caseId) &&
    getCase(v.caseId) !== undefined &&
    isStr(v.typeId) &&
    isOutcome(v.outcome) &&
    isNum(v.score) &&
    isNum(v.stars) &&
    isInt(v.hintsUsed, 0) &&
    isNullable(v.causeOk, isBool) &&
    isInt(v.refuteTries, 0) &&
    isInt(v.livesLost, 0)
  );
}

function isRound(v: unknown): v is Round {
  return (
    isObj(v) &&
    isInt(v.token, 1) &&
    isStr(v.caseId) &&
    PHASES.includes(v.phase as Phase) &&
    Array.isArray(v.wrongLines) &&
    v.wrongLines.every((n) => isInt(n, 1)) &&
    isNullable(v.foundLine, (n): n is number => isInt(n, 1)) &&
    isNullable(v.explanation, isStr) &&
    isInt(v.hintsUsed, 0) &&
    isNullable(v.causeOk, isBool) &&
    isInt(v.refuteTries, 0) &&
    isNullable(v.proofFeedback, isStr) &&
    isNullable(v.proof, isStr) &&
    Array.isArray(v.chat) &&
    v.chat.every(isChatMsg) &&
    isNullable(v.outcome, isOutcome) &&
    isInt(v.livesLost, 0) &&
    isNum(v.score)
  );
}

/**
 * Validates a saved session (it may come from an older deploy or be edited by hand) and
 * clears what cannot survive a reload: a pending intern reply and the screen flash.
 */
export function restoreGame(raw: unknown): GameState | null {
  if (!isObj(raw) || raw.over !== false) return null;
  const { caseIds, index, lives, total, results, round } = raw;
  // Sessions saved before subjects existed are algebra.
  const subject = raw.subject === undefined ? DEFAULT_SUBJECT : raw.subject;
  if (!SUBJECTS.includes(subject as Subject)) return null;
  if (!Array.isArray(caseIds) || caseIds.length === 0) return null;
  if (!caseIds.every((id) => isStr(id) && getCase(id)?.subject === subject)) return null;
  if (!isInt(index, 0, caseIds.length - 1) || !isInt(lives, 0, SESSION_LIVES) || !isNum(total)) return null;
  if (!Array.isArray(results) || !results.every(isResult)) return null;
  if (!isRound(round) || round.caseId !== caseIds[index]) return null;
  return {
    subject: subject as Subject,
    caseIds: caseIds as string[],
    index,
    lives,
    total,
    results: results as RoundResult[],
    round: { ...round, typing: false },
    over: false,
    flash: null,
  };
}

// Per browser tab and subject: a reload resumes the session, a new tab starts a fresh one.
const saveKey = (offline: boolean, subject: Subject) =>
  `synaq.game.v1.${offline ? "offline" : "online"}${subject === DEFAULT_SUBJECT ? "" : `.${subject}`}`;

export function loadGame(offline: boolean, subject: Subject): GameState | null {
  try {
    const raw = window.sessionStorage.getItem(saveKey(offline, subject));
    return raw ? restoreGame(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

/** Saves an unfinished session; a finished one (or null) clears the slot. */
export function saveGame(offline: boolean, subject: Subject, game: GameState | null): void {
  try {
    if (!game || game.over) window.sessionStorage.removeItem(saveKey(offline, subject));
    else window.sessionStorage.setItem(saveKey(offline, subject), JSON.stringify(game));
  } catch {
    // Storage is optional: without it a reload simply starts a new session.
  }
}
