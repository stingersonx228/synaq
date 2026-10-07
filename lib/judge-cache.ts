import { createHash } from "node:crypto";
import { getSupabase } from "./supabase";

const MEMORY_MAX = 2000;
const memory = new Map<string, boolean>();

/**
 * The verdict depends on the canonical cause it was judged against, so the cause is part of
 * the key: editing a case in the catalog invalidates its old verdicts automatically.
 */
export function judgeCacheKey(caseId: string, cause: string, normalizedExplanation: string): string {
  return createHash("sha256")
    .update(`${caseId}\n${cause}\n${normalizedExplanation.toLowerCase()}`)
    .digest("hex");
}

export async function getCachedVerdict(key: string): Promise<boolean | null> {
  const db = getSupabase();
  if (db) {
    const { data, error } = await db.from("judge_cache").select("verdict").eq("key", key).maybeSingle();
    if (!error && data && typeof data.verdict === "boolean") return data.verdict;
    if (!error) return null;
  }
  return memory.get(key) ?? null;
}

export async function setCachedVerdict(key: string, verdict: boolean): Promise<void> {
  const db = getSupabase();
  if (db) {
    const { error } = await db.from("judge_cache").upsert({ key, verdict });
    if (!error) return;
  }
  memory.set(key, verdict);
  if (memory.size > MEMORY_MAX) memory.delete(memory.keys().next().value as string);
}
