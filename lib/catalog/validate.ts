import { evaluate } from "mathjs/number";
import { checkRefutation } from "../refute";
import { SUBJECTS, type Case } from "../types";
import { compactAnswer, TYPE_NAMES } from "./index";

const nonEmpty = (s: unknown): boolean => typeof s === "string" && s.trim().length > 0;

function evalTrue(expr: string): boolean {
  try {
    return evaluate(expr) === true;
  } catch {
    return false;
  }
}

/** Returns a list of human-readable violations; an empty list means the catalog is valid. */
export function validateCatalog(cases: Case[]): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();

  for (const c of cases) {
    const at = (msg: string) => errors.push(`${c.id || "<no id>"}: ${msg}`);

    if (!nonEmpty(c.id)) at("empty id");
    if (ids.has(c.id)) at("duplicate id");
    ids.add(c.id);

    for (const key of ["type_id", "topic", "task", "answer"] as const) {
      if (!nonEmpty(c[key])) at(`empty ${key}`);
    }
    if (!(c.type_id in TYPE_NAMES)) at(`type_id "${c.type_id}" has no display name`);
    if (!SUBJECTS.includes(c.subject)) at(`unknown subject "${c.subject}"`);
    if (![8, 9, 10, 11].includes(c.level)) at("level must be 8..11");
    if (c.steps.length < 3) at("steps.length < 3");
    c.steps.forEach((s, i) => !nonEmpty(s) && at(`empty step ${i + 1}`));
    if (c.hints.length !== 3) at("hints must have exactly 3 items");
    c.hints.forEach((h, i) => !nonEmpty(h) && at(`empty hint ${i + 1}`));
    if (c.truth.length === 0) at("truth is empty");
    for (const t of c.truth) if (!evalTrue(t)) at(`truth is not true: ${t}`);

    const bug = c.bug;
    if (bug === null) {
      if (!nonEmpty(c.falseAccusation)) at("clean case needs falseAccusation");
      continue;
    }
    if (c.falseAccusation !== undefined) at("buggy case must not have falseAccusation");

    for (const key of ["cause", "fix", "concede", "correct_answer"] as const) {
      if (!nonEmpty(bug[key])) at(`empty bug.${key}`);
    }
    if (bug.keywords.length < 3) at("keywords < 3");
    // Naming the answer is not naming the cause, so no keyword may be part of the correct answer.
    for (const k of bug.keywords) {
      if (compactAnswer(bug.correct_answer).includes(compactAnswer(k))) at(`keyword is part of the correct answer: ${k}`);
    }
    bug.keywords.forEach((k) => {
      if (!nonEmpty(k)) at("empty keyword");
      else if (k !== k.toLowerCase()) at(`keyword not lowercase: ${k}`);
    });
    if (bug.defense.length !== 2) at("defense must have exactly 2 items");
    bug.defense.forEach((d, i) => !nonEmpty(d) && at(`empty defense ${i + 1}`));

    if (bug.accept_steps.length === 0) at("accept_steps is empty");
    for (const s of bug.accept_steps) {
      if (!Number.isInteger(s) || s < 1 || s > c.steps.length) at(`accept_steps out of range: ${s}`);
    }

    const spec = bug.refute;
    if (!nonEmpty(spec.prompt)) at("empty refute.prompt");
    if (spec.vars.length === 0) at("refute.vars is empty");
    if (bug.demo.length === 0) at("demo is empty");
    if (bug.decoy.length === 0) at("decoy is empty");
    for (const d of bug.demo) {
      const r = checkRefutation(spec, d);
      if (!r.ok) at(`demo ${JSON.stringify(d)} must be ok:true, got ${r.reason}`);
    }
    for (const d of bug.decoy) {
      if (checkRefutation(spec, d).ok) at(`decoy ${JSON.stringify(d)} must be ok:false`);
    }

    const correct = compactAnswer(bug.correct_answer);
    if (compactAnswer(c.answer) === correct) at("intern answer equals the correct answer");
    for (const line of [...bug.defense, bug.concede]) {
      if (compactAnswer(line).includes(correct)) at(`intern line reveals the correct answer: "${line}"`);
    }
  }

  const clean = cases.filter((c) => c.bug === null).length;
  if (clean < 1) errors.push("catalog: needs at least one clean case");
  if (cases.length === 11 && clean !== 1) errors.push("catalog: 11 cases must contain exactly one clean case");

  return errors;
}
