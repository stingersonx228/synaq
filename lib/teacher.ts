// Server-only class management. The teacher token is shown once; only its hash is stored.
import { createHash, randomBytes, randomInt } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { aggregateStats, type AttemptRow, type ClassStats, type StudentRow } from "./stats";
import { TEACHER_TOKEN_RE } from "./schemas";

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_ATTEMPTS = 8;
const PAGE = 1000;
const MAX_PAGES = 20;

export function generateClassCode(): string {
  let code = "";
  for (let i = 0; i < 6; i++) code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  return code;
}

export function generateTeacherToken(): string {
  return randomBytes(32).toString("hex");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createClass(db: SupabaseClient, name: string): Promise<{ code: string; token: string }> {
  for (let i = 0; i < CODE_ATTEMPTS; i++) {
    const code = generateClassCode();
    const token = generateTeacherToken();
    const { error } = await db.from("classes").insert({ code, name, teacher_token_hash: hashToken(token) });
    if (!error) return { code, token };
    // 23505 = unique violation: the random code collided, try another one.
    if (error.code !== "23505") throw new Error(`class insert failed: ${error.code}`);
  }
  throw new Error("could not generate a unique class code");
}

export interface ClassDashboard {
  name: string;
  code: string;
  stats: ClassStats;
}

interface AttemptWithClass extends AttemptRow {
  students: unknown;
}

/** Returns null when the token is malformed or matches no class. */
export async function loadClassDashboard(db: SupabaseClient, token: string): Promise<ClassDashboard | null> {
  if (!TEACHER_TOKEN_RE.test(token)) return null;
  const { data: cls, error } = await db
    .from("classes")
    .select("id, name, code")
    .eq("teacher_token_hash", hashToken(token))
    .maybeSingle();
  if (error) throw new Error(`class lookup failed: ${error.code}`);
  if (!cls) return null;

  const { data: students, error: sErr } = await db
    .from("students")
    .select("id, nickname")
    .eq("class_id", cls.id)
    .limit(PAGE);
  if (sErr) throw new Error(`students lookup failed: ${sErr.code}`);

  const attempts: AttemptRow[] = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const { data, error: aErr } = await db
      .from("attempts")
      .select("student_id, type_id, outcome, score, hints_used, lives_lost, created_at, students!inner(class_id)")
      .eq("students.class_id", cls.id)
      .order("created_at", { ascending: false })
      // Tie-breaker: without it rows with equal timestamps can repeat or vanish across pages.
      .order("id", { ascending: true })
      .range(page * PAGE, page * PAGE + PAGE - 1)
      .returns<AttemptWithClass[]>();
    if (aErr) throw new Error(`attempts lookup failed: ${aErr.code}`);
    for (const row of data ?? []) {
      const { student_id, type_id, outcome, score, hints_used, lives_lost, created_at } = row;
      attempts.push({ student_id, type_id, outcome, score, hints_used, lives_lost, created_at });
    }
    if (!data || data.length < PAGE) break;
  }

  return {
    name: String(cls.name),
    code: String(cls.code),
    stats: aggregateStats((students ?? []) as StudentRow[], attempts),
  };
}
