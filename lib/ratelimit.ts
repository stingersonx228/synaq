// Per-student hourly budget of LLM calls. Uses the llm_calls table for registered students
// and an in-process window for anonymous/local players (acceptable for the local mode).
import { getSupabase, studentExists } from "./supabase";

const HOUR_MS = 60 * 60 * 1000;
const MEMORY_KEYS_MAX = 5000;
const memory = new Map<string, number[]>();

export function llmCallsPerHour(): number {
  const n = Number(process.env.LLM_CALLS_PER_HOUR);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 60;
}

function takeFromMemory(key: string, limit: number, now: number): boolean {
  const recent = (memory.get(key) ?? []).filter((t) => now - t < HOUR_MS);
  if (recent.length >= limit) {
    memory.set(key, recent);
    return false;
  }
  recent.push(now);
  memory.delete(key);
  memory.set(key, recent);
  // Drop the least recently used keys so the map cannot grow without bound.
  while (memory.size > MEMORY_KEYS_MAX) memory.delete(memory.keys().next().value as string);
  return true;
}

/** Consumes one LLM call from the budget. Returns false when the budget is exhausted. */
export async function takeLlmCall(who: { studentId: string | null; ip: string }, now = Date.now()): Promise<boolean> {
  const limit = llmCallsPerHour();
  if (limit === 0) return false;
  const db = getSupabase();
  if (db && who.studentId) {
    try {
      if (await studentExists(db, who.studentId)) {
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
        return true;
      }
    } catch {
      // Database trouble: fall through to the in-memory window.
    }
  }
  const key = who.studentId ? `s:${who.studentId}` : `ip:${who.ip}`;
  return takeFromMemory(key, limit, now);
}

export function resetMemoryLimits(): void {
  memory.clear();
}
