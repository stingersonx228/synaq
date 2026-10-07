// Sliding-window limits. LLM calls of registered students are counted in the llm_calls table;
// anonymous players and anti-spam limits use an in-process window (acceptable for an MVP:
// on serverless it is per instance).
import { getSupabase } from "./supabase";

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const MEMORY_KEYS_MAX = 5000;
const PRUNE_PROBABILITY = 0.02;
const memory = new Map<string, number[]>();

export function llmCallsPerHour(): number {
  const n = Number(process.env.LLM_CALLS_PER_HOUR);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 60;
}

/** Records a hit for `key` unless `limit` hits already happened within `windowMs`. */
function hitWindow(key: string, limit: number, windowMs: number, now: number): boolean {
  const recent = (memory.get(key) ?? []).filter((t) => now - t < windowMs);
  const allowed = recent.length < limit;
  if (allowed) recent.push(now);
  // Re-insert to keep the map in least-recently-used order, then trim the oldest keys.
  memory.delete(key);
  memory.set(key, recent);
  while (memory.size > MEMORY_KEYS_MAX) memory.delete(memory.keys().next().value as string);
  return allowed;
}

/**
 * Consumes one LLM call from the hourly budget. `studentId` must already be verified to exist
 * (or be null for anonymous players, who are limited per IP). Returns false when exhausted.
 */
export async function takeLlmCall(who: { studentId: string | null; ip: string }, now = Date.now()): Promise<boolean> {
  const limit = llmCallsPerHour();
  if (limit === 0) return false;
  const db = getSupabase();
  if (db && who.studentId) {
    try {
      const since = new Date(now - HOUR_MS).toISOString();
      const { count, error } = await db
        .from("llm_calls")
        .select("id", { count: "exact", head: true })
        .eq("student_id", who.studentId)
        .gte("created_at", since);
      if (error) throw new Error(error.code);
      if ((count ?? 0) >= limit) return false;
      const { error: insertError } = await db.from("llm_calls").insert({ student_id: who.studentId });
      if (insertError) throw new Error(insertError.code);
      // Rows older than the window are useless; prune them now and then instead of on every call.
      // Fire-and-forget: a failed prune must not fall through and count the call a second time.
      if (Math.random() < PRUNE_PROBABILITY) {
        void Promise.resolve(
          db.from("llm_calls").delete().lt("created_at", new Date(now - 2 * HOUR_MS).toISOString()),
        ).catch(() => undefined);
      }
      return true;
    } catch {
      // Database trouble: fall through to the in-memory window.
    }
  }
  const key = who.studentId ? `llm:s:${who.studentId}` : `llm:ip:${who.ip}`;
  return hitWindow(key, limit, HOUR_MS, now);
}

const SPAM_LIMITS = {
  // A whole class often shares one school IP.
  join: { limit: 120, windowMs: 10 * MINUTE_MS },
  createClass: { limit: 10, windowMs: HOUR_MS },
  // The live dashboard polls every 5 s; leave room for a projector tab plus the teacher's own.
  stats: { limit: 600, windowMs: 10 * MINUTE_MS },
  // 30 students x 6 rounds plus retries, from one school IP.
  attempt: { limit: 600, windowMs: 10 * MINUTE_MS },
} as const;

/** Per-IP anti-spam limit for endpoints that write to or scan the database. */
export function allowRequest(kind: keyof typeof SPAM_LIMITS, ip: string, now = Date.now()): boolean {
  const { limit, windowMs } = SPAM_LIMITS[kind];
  return hitWindow(`${kind}:${ip}`, limit, windowMs, now);
}

export function resetMemoryLimits(): void {
  memory.clear();
}
