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

export interface AttemptPayload {
  studentId: string;
  caseId: string;
  outcome: Outcome;
  hintsUsed: number;
  causeOk: boolean | null;
  refuteTries: number;
  livesLost: number;
}

/** "saved" | "unauthorized" (student no longer exists) | "unavailable" (no DB / network). */
export async function saveAttempt(payload: AttemptPayload): Promise<"saved" | "unauthorized" | "unavailable"> {
  const res = await postJson("/api/attempt", payload);
  if (res?.ok) return "saved";
  if (res?.status === 401) return "unauthorized";
  return "unavailable";
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
