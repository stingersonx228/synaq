import { evaluate } from "mathjs/number";
import type { RefuteSpec, Values } from "./types";

const EPS = 1e-9;

const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

// Expressions come only from the catalog; student input only ever enters as numeric scope values.
const safe = (expr: string, scope: Values): unknown => {
  try {
    return evaluate(expr, { ...scope });
  } catch {
    return undefined;
  }
};

export type RefuteFailReason =
  | "invalid_input"
  | "undefined"
  | "values_equal"
  | "claim_false"
  | "original_holds"
  | "not_a_solution"
  | "already_claimed"
  | "unknown_mode";

export type RefuteResult =
  | { ok: true; wrong?: number; right?: number }
  | { ok: false; reason: RefuteFailReason; wrong?: number; right?: number };

export function checkRefutation(spec: RefuteSpec, values: Values): RefuteResult {
  for (const v of spec.vars) if (!isNum(values[v])) return { ok: false, reason: "invalid_input" };
  if (spec.mode === "diverge") {
    const w = safe(spec.wrong, values);
    const r = safe(spec.right, values);
    if (!isNum(w) || !isNum(r)) return { ok: false, reason: "undefined" };
    return Math.abs(w - r) > EPS
      ? { ok: true, wrong: w, right: r }
      : { ok: false, reason: "values_equal", wrong: w, right: r };
  }
  const claim = safe(spec.claim, values);
  const orig = safe(spec.original, values);
  if (spec.mode === "claim_test") {
    if (claim !== true) return { ok: false, reason: "claim_false" };
    return orig === true ? { ok: false, reason: "original_holds" } : { ok: true };
  }
  if (spec.mode === "missing") {
    if (orig !== true) return { ok: false, reason: "not_a_solution" };
    return claim === true ? { ok: false, reason: "already_claimed" } : { ok: true };
  }
  return { ok: false, reason: "unknown_mode" };
}

const NUMBER_RE = /^[+-]?(\d+(\.\d*)?|\.\d+)$/;

/**
 * Parses one student-typed number. Accepts a comma as decimal separator, the Unicode minus
 * and digit-group spaces ("20 000"). Anything else (expressions, exponents, Infinity) → null.
 */
export function parseNumberInput(raw: string): number | null {
  const s = raw
    .trim()
    .replace(/[\s  ]/g, "")
    .replace(/−/g, "-")
    .replace(",", ".");
  if (!NUMBER_RE.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** Parses raw form fields for the given variables; missing or invalid fields are omitted. */
export function parseValues(vars: string[], raw: Record<string, string>): Values {
  const out: Values = {};
  for (const v of vars) {
    const n = parseNumberInput(raw[v] ?? "");
    if (n !== null) out[v] = n;
  }
  return out;
}

export function formatNumber(n: number): string {
  const rounded = Math.round(n * 1e6) / 1e6;
  return rounded.toLocaleString("ru-RU", { maximumFractionDigits: 6 }).replace(/-/g, "−");
}

/** Student-facing explanation of why a proof attempt did not work. */
export function explainRefutation(result: RefuteResult): string {
  if (result.ok) return "Доказательство верное: стажёр ошибся.";
  switch (result.reason) {
    case "invalid_input":
      return "Введи число в каждое поле. Можно с запятой: 0,5.";
    case "undefined":
      return "При таком значении выражение не определено (например, деление на ноль). Подбери другое.";
    case "values_equal":
      return result.wrong !== undefined
        ? `При таком значении оба выражения равны (${formatNumber(result.wrong)}), подбери другое.`
        : "При таком значении оба выражения равны, подбери другое.";
    case "claim_false":
      return "Этого значения нет в ответе стажёра. Возьми то, что он считает верным, и покажи, что оно ломает условие.";
    case "original_holds":
      return "При этом значении исходное условие выполняется — здесь стажёр прав. Ищи другое значение.";
    case "not_a_solution":
      return "Это значение не подходит к исходному условию. Найди решение, которое стажёр потерял.";
    case "already_claimed":
      return "Это значение уже есть в ответе стажёра. Найди решение, которого у него нет.";
    case "unknown_mode":
      return "Эту задачу нельзя проверить. Попробуй другую.";
  }
}
