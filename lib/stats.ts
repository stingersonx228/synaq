import { CASES, typeName } from "./catalog";
import type { Outcome } from "./types";

export interface StudentRow {
  id: string;
  nickname: string;
}

export interface AttemptRow {
  student_id: string;
  type_id: string;
  outcome: Outcome;
  score: number;
  hints_used: number;
  lives_lost: number;
  created_at: string;
}

export interface TypeStat {
  typeId: string;
  name: string;
  rounds: number;
  /** Rounds where the bug was not found, a life was lost, or all three hints were opened. */
  problemRounds: number;
  problemRate: number;
  missed: number;
  lifeLost: number;
  fullHints: number;
}

export interface StudentStat {
  nickname: string;
  rounds: number;
  avgScore: number;
  lastActive: string | null;
}

export interface ClassStats {
  studentCount: number;
  roundCount: number;
  types: TypeStat[];
  blindSpots: TypeStat[];
  students: StudentStat[];
}

const TYPE_ORDER = [...new Set(CASES.map((c) => c.type_id))];

export function isProblemRound(a: Pick<AttemptRow, "outcome" | "lives_lost" | "hints_used">): boolean {
  return a.outcome !== "solved" || a.lives_lost > 0 || a.hints_used >= 3;
}

export function aggregateStats(students: StudentRow[], attempts: AttemptRow[]): ClassStats {
  const byType = new Map<string, TypeStat>();
  for (const a of attempts) {
    let t = byType.get(a.type_id);
    if (!t) {
      t = {
        typeId: a.type_id,
        name: typeName(a.type_id),
        rounds: 0,
        problemRounds: 0,
        problemRate: 0,
        missed: 0,
        lifeLost: 0,
        fullHints: 0,
      };
      byType.set(a.type_id, t);
    }
    t.rounds += 1;
    if (isProblemRound(a)) t.problemRounds += 1;
    if (a.outcome !== "solved") t.missed += 1;
    if (a.lives_lost > 0) t.lifeLost += 1;
    if (a.hints_used >= 3) t.fullHints += 1;
  }
  const types = [...byType.values()]
    .map((t) => ({ ...t, problemRate: t.rounds > 0 ? t.problemRounds / t.rounds : 0 }))
    .sort(
      (x, y) =>
        y.problemRate - x.problemRate ||
        y.problemRounds - x.problemRounds ||
        TYPE_ORDER.indexOf(x.typeId) - TYPE_ORDER.indexOf(y.typeId),
    );

  const perStudent = new Map<string, { rounds: number; total: number; last: string | null }>();
  for (const s of students) perStudent.set(s.id, { rounds: 0, total: 0, last: null });
  for (const a of attempts) {
    const s = perStudent.get(a.student_id);
    if (!s) continue;
    s.rounds += 1;
    s.total += a.score;
    if (!s.last || a.created_at > s.last) s.last = a.created_at;
  }
  const studentStats = students
    .map((s) => {
      const p = perStudent.get(s.id)!;
      return {
        nickname: s.nickname,
        rounds: p.rounds,
        avgScore: p.rounds > 0 ? Math.round(p.total / p.rounds) : 0,
        lastActive: p.last,
      };
    })
    .sort(
      (x, y) => (y.lastActive ?? "").localeCompare(x.lastActive ?? "") || x.nickname.localeCompare(y.nickname, "ru"),
    );

  return {
    studentCount: students.length,
    roundCount: attempts.length,
    types,
    blindSpots: types.filter((t) => t.problemRounds > 0).slice(0, 3),
    students: studentStats,
  };
}
