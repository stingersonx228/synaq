import type { Case } from "../types";
import { CASES } from "./cases";
import type { RefuteFailReason } from "../refute";

export { CASES };

export const SESSION_ROUNDS = 6;
export const SESSION_LIVES = 3;

const BY_ID = new Map(CASES.map((c) => [c.id, c]));

export function getCase(id: string): Case | undefined {
  return BY_ID.get(id);
}

export const CASE_IDS = CASES.map((c) => c.id);

export const TYPE_NAMES: Record<string, string> = {
  percent_add: "Проценты: сложение скидок",
  percent_base: "Проценты: не та база",
  fraction_add: "Дроби: сложение знаменателей",
  odz: "ОДЗ: деление на ноль",
  extraneous_root: "Посторонние корни",
  sign_transfer: "Перенос без смены знака",
  square_sum: "Квадрат суммы",
  ineq_sign: "Неравенства: деление на минус",
  percent_symmetric: "Проценты: «+50% и −50%»",
  lost_root: "Потерянный корень",
  power_mult: "Степени: перемножение показателей",
  sqrt_sum: "Корень из суммы",
  abs_lost: "Модуль: потерянный случай",
  root_formula: "Формула корней: знак b",
  log_sum: "Логарифмы: сумма вместо произведения",
  cancel_terms: "Дроби: сокращение слагаемых",
  ap_formula: "Прогрессия: n вместо n − 1",
  neg_exponent: "Степени: отрицательный показатель",
  avg_speed: "Средняя скорость",
  joint_work: "Совместная работа",
  vieta_sign: "Теорема Виета: знак суммы",
  sqrt_abs: "Корень из квадрата: модуль",
  exp_divide: "Показательные уравнения",
  sin_sum: "Тригонометрия: синус суммы",
  clean: "Ложная тревога: ошибки не было",
};

export function typeName(typeId: string): string {
  return TYPE_NAMES[typeId] ?? typeId;
}

/** Fixed intern lines that never come from the LLM. */
export const INTERN_LINES = {
  greeting: "Привет! Я Алибек, стажёр. Задачу уже решил, всё точно верно. Можешь проверить, но ошибок не найдёшь.",
  wrongLine: (step: number) => `В строке ${step} у меня всё верно. Можешь пересчитать, всё сойдётся.`,
  missedBug: "Вот и я говорю: всё идеально!",
  cleanWin: "Вот видишь, я же говорил. Спасибо за честную проверку каждой строки.",
  proofFailed: {
    invalid_input: "Ну и что это за число? Давай нормальное.",
    undefined: "Так нечестно, тут вообще ничего не посчитать.",
    values_equal: "Вот видишь, получилось одно и то же. Мой способ работает.",
    claim_false: "Это вообще не мой ответ. Ты проверяешь что-то своё.",
    original_holds: "Подставил, всё сходится. Я же говорил!",
    not_a_solution: "Это число к уравнению не подходит. Мимо.",
    already_claimed: "Так это число у меня и так есть в ответе.",
    unknown_mode: "Не понимаю, что ты проверяешь.",
  } satisfies Record<RefuteFailReason, string>,
} as const;

/** Lowercase, collapse whitespace, unify minus/dash characters. */
export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[−‒–—]/g, "-")
    .replace(/ё/g, "е")
    .replace(/\s+/g, " ")
    .trim();
}

/** Strips all whitespace and the tenge sign for answer comparison. */
export function compactAnswer(text: string): string {
  return normalizeText(text).replace(/[\s₸]/g, "");
}

/** No-LLM fallback: the explanation names the cause if it contains at least one keyword root. */
export function keywordJudge(c: Case, explanation: string): boolean {
  if (!c.bug) return false;
  const text = normalizeText(explanation);
  return c.bug.keywords.some((k) => text.includes(normalizeText(k)));
}

export type Rng = () => number;

export function shuffle<T>(items: readonly T[], rng: Rng = Math.random): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Picks a session: exactly one clean case, the rest unique buggy cases, in random order. */
export function pickSessionCases(rounds: number = SESSION_ROUNDS, rng: Rng = Math.random): string[] {
  const clean = shuffle(CASES.filter((c) => c.bug === null), rng);
  const buggy = shuffle(CASES.filter((c) => c.bug !== null), rng);
  if (clean.length === 0 || rounds < 1) return buggy.slice(0, rounds).map((c) => c.id);
  const picked = [clean[0], ...buggy.slice(0, rounds - 1)];
  return shuffle(picked, rng).map((c) => c.id);
}

export const PRACTICE_MIN_ROUNDS = 4;

/**
 * Practice session for a student's blind spots: one case per weak error type (preferring a
 * case not just played), topped up with unplayed cases to PRACTICE_MIN_ROUNDS, shuffled.
 */
export function pickPracticeCases(spotTypes: string[], played: string[], rng: Rng = Math.random): string[] {
  const picked: string[] = [];
  for (const type of spotTypes.slice(0, SESSION_ROUNDS)) {
    const ofType = shuffle(CASES.filter((c) => c.type_id === type), rng);
    const choice = ofType.find((c) => !played.includes(c.id)) ?? ofType[0];
    if (choice && !picked.includes(choice.id)) picked.push(choice.id);
  }
  const fresh = shuffle(
    CASES.filter((c) => c.bug !== null && !played.includes(c.id) && !picked.includes(c.id)),
    rng,
  );
  while (picked.length < PRACTICE_MIN_ROUNDS && fresh.length > 0) picked.push(fresh.shift()!.id);
  return shuffle(picked, rng);
}

/**
 * Picks any case not in `exclude`. Deliberately ignores clean/buggy kind: swapping a clean
 * case only among clean cases would tell the player there is no bug.
 */
export function pickReplacement(current: string, exclude: string[], rng: Rng = Math.random): string | null {
  const pool = CASES.filter((c) => c.id !== current && !exclude.includes(c.id));
  if (pool.length === 0) return null;
  return pool[Math.floor(rng() * pool.length)].id;
}
