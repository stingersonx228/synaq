// Server-only Supabase access with the service-role key. RLS is enabled on every table with
// no policies, so the database is reachable only through our route handlers.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null | undefined;

export function getSupabase(): SupabaseClient | null {
  if (client !== undefined) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  client = url && key ? createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }) : null;
  return client;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** True if the student exists. Throws on database errors so callers can fail closed or fall back. */
export async function studentExists(db: SupabaseClient, studentId: string): Promise<boolean> {
  if (!UUID_RE.test(studentId)) return false;
  const { data, error } = await db.from("students").select("id").eq("id", studentId).maybeSingle();
  if (error) throw new Error(`students lookup failed: ${error.code}`);
  return data !== null;
}

export type StudentCheck = { ok: true; studentId: string | null } | { ok: false };

/**
 * Resolves an optional student id for routes that also work anonymously (LLM routes).
 * Unknown ids are rejected; without a database, or on a database error, the caller
 * proceeds anonymously so the game never breaks.
 */
export async function resolveOptionalStudent(studentId: string | undefined): Promise<StudentCheck> {
  const db = getSupabase();
  if (!studentId || !db) return { ok: true, studentId: null };
  try {
    return (await studentExists(db, studentId)) ? { ok: true, studentId } : { ok: false };
  } catch {
    return { ok: true, studentId: null };
  }
}
