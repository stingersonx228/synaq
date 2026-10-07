// Browser-side API calls. Every call has a deterministic local fallback so that a network
// failure never surfaces as an error on screen.
import { getCase, keywordJudge } from "./catalog";
import type { Outcome } from "./types";

const CLIENT_TIMEOUT_MS = 9000;

async function postJson(url: string, body: unknown): Promise<Response | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), CLIENT_TIMEOUT_MS);
  try {
    return await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function readJson(res: Response | null): Promise<Record<string, unknown> | null> {
  if (!res) return null;
  try {
    const data: unknown = await res.json();
    return typeof data === "object" && data !== null ? (data as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export interface NetOptions {
  offline: boolean;
  studentId: string | null;
}

export function localInternReply(caseId: string, stage: 0 | 1): string {
  const c = getCase(caseId);
  return c?.bug?.defense[stage] ?? "";
}

export async function fetchInternReply(caseId: string, stage: 0 | 1, explanation: string, net: NetOptions) {
  const fallback = localInternReply(caseId, stage);
  if (net.offline) return fallback;
  const res = await postJson("/api/intern", {
    caseId,
    stage,
    explanation,
    ...(net.studentId ? { studentId: net.studentId } : {}),
  });
  const data = res?.ok ? await readJson(res) : null;
  return typeof data?.reply === "string" && data.reply.trim() ? data.reply : fallback;
}

export async function fetchJudgeVerdict(caseId: string, explanation: string, net: NetOptions): Promise<boolean> {
  const c = getCase(caseId);
  const fallback = c ? keywordJudge(c, explanation) : false;
  if (net.offline) return fallback;
  const res = await postJson("/api/judge", {
    caseId,
    explanation,
    ...(net.studentId ? { studentId: net.studentId } : {}),
  });
  const data = res?.ok ? await readJson(res) : null;
  return typeof data?.verdict === "boolean" ? data.verdict : fallback;
}

/** Random UUID v4. crypto.randomUUID needs a secure context, which a LAN http address is not. */
export function newId(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

export interface AttemptPayload {
  attemptId: string;
  studentId: string;
  caseId: string;
  outcome: Outcome;
  hintsUsed: number;
  causeOk: boolean | null;
  refuteTries: number;
  livesLost: number;
}

export const ATTEMPT_RETRY_DELAYS_MS = [1000, 3000, 9000];

/** Network failures, 429 and 5xx (except 503 "no database") are worth retrying. */
function isTransient(res: Response | null): boolean {
  return res === null || res.status === 429 || (res.status >= 500 && res.status !== 503);
}

/**
 * "saved" | "unauthorized" (student no longer exists) | "unavailable" (no DB, or still failing
 * after retries). Retries are safe: the server stores each attemptId at most once.
 */
export async function saveAttempt(
  payload: AttemptPayload,
  delays: readonly number[] = ATTEMPT_RETRY_DELAYS_MS,
): Promise<"saved" | "unauthorized" | "unavailable"> {
  for (let i = 0; ; i++) {
    const res = await postJson("/api/attempt", payload);
    if (res?.ok) return "saved";
    if (res?.status === 401) return "unauthorized";
    if (!isTransient(res) || i >= delays.length) return "unavailable";
    await new Promise((r) => setTimeout(r, delays[i]));
  }
}

export type JoinResult =
  | { ok: true; studentId: string; nickname: string; className: string }
  | { ok: false; error: "class_not_found" | "invalid" | "rate_limited" | "unavailable" };

export async function joinClass(code: string, nickname: string): Promise<JoinResult> {
  const res = await postJson("/api/join", { code, nickname });
  const data = await readJson(res);
  if (
    res?.ok &&
    typeof data?.studentId === "string" &&
    typeof data.nickname === "string" &&
    typeof data.className === "string"
  ) {
    return { ok: true, studentId: data.studentId, nickname: data.nickname, className: data.className };
  }
  if (res?.status === 404) return { ok: false, error: "class_not_found" };
  if (res?.status === 400) return { ok: false, error: "invalid" };
  if (res?.status === 429) return { ok: false, error: "rate_limited" };
  return { ok: false, error: "unavailable" };
}
