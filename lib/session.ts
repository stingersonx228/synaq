// Browser-only helpers around localStorage. Every access is guarded: storage can be
// unavailable (private mode, blocked site data) and the game must work without it.

const KEY_STUDENT = "synaq.student";
const KEY_PROGRESS = "synaq.progress";

export interface StudentIdentity {
  studentId: string;
  nickname: string;
  className: string;
}

export interface SessionRecord {
  finishedAt: string;
  score: number;
  rounds: number;
  solved: number;
  blindSpots: string[];
}

export interface LocalProgress {
  sessions: number;
  bestScore: number;
  history: SessionRecord[];
}

const HISTORY_LIMIT = 20;

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string | null): void {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    // Storage is optional.
  }
}

function readJson<T>(key: string, guard: (v: unknown) => v is T): T | null {
  const raw = read(key);
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return guard(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;

const isIdentity = (v: unknown): v is StudentIdentity =>
  isObj(v) && typeof v.studentId === "string" && typeof v.nickname === "string" && typeof v.className === "string";

const isProgress = (v: unknown): v is LocalProgress =>
  isObj(v) && typeof v.sessions === "number" && typeof v.bestScore === "number" && Array.isArray(v.history);

export function getStudent(): StudentIdentity | null {
  return readJson(KEY_STUDENT, isIdentity);
}

export function setStudent(identity: StudentIdentity | null): void {
  write(KEY_STUDENT, identity ? JSON.stringify(identity) : null);
}

export function getProgress(): LocalProgress {
  return readJson(KEY_PROGRESS, isProgress) ?? { sessions: 0, bestScore: 0, history: [] };
}

export function recordSession(record: SessionRecord): LocalProgress {
  const prev = getProgress();
  const next: LocalProgress = {
    sessions: prev.sessions + 1,
    bestScore: Math.max(prev.bestScore, record.score),
    history: [record, ...prev.history].slice(0, HISTORY_LIMIT),
  };
  write(KEY_PROGRESS, JSON.stringify(next));
  return next;
}
