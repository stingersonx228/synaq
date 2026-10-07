// Deterministic demo class for the pitch. Generated from a fixed seed, lives only in code,
// never written to the database, and always labelled as demo data in the UI.
import { CASES } from "./catalog";
import { roundScore } from "./scoring";
import { aggregateStats, type AttemptRow, type ClassStats, type StudentRow } from "./stats";
import type { Outcome } from "./types";

const SEED = 20261007;
const STUDENTS = 30;
const NOW = Date.parse("2026-10-06T12:00:00Z");

/** Share of problem rounds per error type, tuned to look like a typical 9th grade. */
const DIFFICULTY: Record<string, number> = {
  odz: 0.64,
  extraneous_root: 0.58,
  percent_symmetric: 0.55,
  percent_base: 0.47,
  ineq_sign: 0.41,
  percent_add: 0.36,
  lost_root: 0.31,
  clean: 0.27,
  square_sum: 0.26,
  sign_transfer: 0.19,
  fraction_add: 0.12,
  log_sum: 0.61,
  root_formula: 0.44,
  abs_lost: 0.42,
  sqrt_sum: 0.34,
  power_mult: 0.29,
  cancel_terms: 0.33,
};

const NICK_ROOTS = ["Барыс", "Қыран", "Тұлпар", "Арлан", "Самұрық", "Бүркіт", "Жұлдыз", "Сұңқар", "Шағала", "Көкжал"];
const NICK_TAILS = ["", "_7", "_42", "2009", "_kz"];

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function demoRows(): { students: StudentRow[]; attempts: AttemptRow[] } {
  const rng = mulberry32(SEED);
  const pick = <T,>(items: readonly T[]) => items[Math.floor(rng() * items.length)];
  const students: StudentRow[] = [];
  const attempts: AttemptRow[] = [];
  const used = new Set<string>();

  for (let i = 0; i < STUDENTS; i++) {
    let nickname = `${pick(NICK_ROOTS)}${pick(NICK_TAILS)}`;
    while (used.has(nickname)) nickname = `${pick(NICK_ROOTS)}_${Math.floor(rng() * 90 + 10)}`;
    used.add(nickname);
    const id = `demo-${i}`;
    students.push({ id, nickname });

    // Skill shifts every difficulty by up to ±0.2 so students differ visibly.
    const skill = (rng() - 0.5) * 0.4;
    const rounds = 4 + Math.floor(rng() * 15);
    // Uneven timestamps: real classes do not play on the hour or every 7 minutes exactly.
    const lastSeen = NOW - Math.floor(rng() * 9 * 24 * 60) * 60 * 1000;
    let at = lastSeen;
    for (let r = 0; r < rounds; r++) {
      const c = pick(CASES);
      const pProblem = Math.min(0.95, Math.max(0.03, (DIFFICULTY[c.type_id] ?? 0.3) - skill));
      const problem = rng() < pProblem;
      let outcome: Outcome = "solved";
      let hints = rng() < 0.3 ? 1 + Math.floor(rng() * 2) : 0;
      let livesLost = 0;
      if (problem) {
        const kind = rng();
        if (c.bug === null) outcome = "false_accusation";
        else if (kind < 0.4) outcome = "missed_clean";
        else if (kind < 0.65) outcome = "failed_proof";
        else if (kind < 0.8) hints = 3;
        else livesLost = 1;
        if (outcome !== "solved") livesLost = 1;
      }
      const refuteTries = c.bug && outcome === "solved" ? 1 + Math.floor(rng() * 2) : 0;
      const causeOk = c.bug && outcome === "solved" ? rng() < 0.7 - skill : null;
      const score = roundScore({ outcome, clean: c.bug === null, causeOk, refuteTries, hintsUsed: hints });
      at -= Math.floor((2 + rng() * 9) * 60 * 1000 + rng() * 59 * 1000);
      attempts.push({
        student_id: id,
        type_id: c.type_id,
        outcome,
        score,
        hints_used: hints,
        lives_lost: livesLost,
        cause_ok: causeOk,
        created_at: new Date(at).toISOString(),
      });
    }
  }
  return { students, attempts };
}

export function demoClassStats(): ClassStats {
  const { students, attempts } = demoRows();
  return aggregateStats(students, attempts);
}

export const DEMO_CLASS = { name: "9 «Б» (демо)", code: "DEMO42" } as const;
