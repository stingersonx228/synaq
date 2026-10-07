import { describe, expect, it } from "vitest";
import { evaluate } from "mathjs/number";
import { checkRefutation } from "../lib/refute";
import {
  CASES,
  getCase,
  keywordJudge,
  pickReplacement,
  pickSessionCases,
  SESSION_ROUNDS,
  typeName,
} from "../lib/catalog";
import { validateCatalog } from "../lib/catalog/validate";
import type { Case } from "../lib/types";

const clone = (c: Case): Case => structuredClone(c);

describe("catalog", () => {
  it("passes full validation", () => {
    expect(validateCatalog(CASES)).toEqual([]);
  });

  it("has 11 cases with unique ids and exactly one clean case", () => {
    expect(CASES).toHaveLength(11);
    expect(new Set(CASES.map((c) => c.id)).size).toBe(CASES.length);
    expect(CASES.filter((c) => c.bug === null)).toHaveLength(1);
  });

  describe.each(CASES.map((c) => [c.id, c] as const))("%s", (_id, c) => {
    it("has complete fields", () => {
      expect(c.steps.length).toBeGreaterThanOrEqual(3);
      expect(c.hints).toHaveLength(3);
      for (const s of [c.task, c.answer, ...c.steps, ...c.hints]) expect(s.trim()).not.toBe("");
      expect(typeName(c.type_id)).not.toBe(c.type_id);
    });

    it("truth expressions evaluate to true", () => {
      for (const t of c.truth) expect(evaluate(t), t).toBe(true);
    });

    if (c.bug) {
      const bug = c.bug;
      it("demo values refute, decoy values do not", () => {
        for (const d of bug.demo) expect(checkRefutation(bug.refute, d).ok, JSON.stringify(d)).toBe(true);
        for (const d of bug.decoy) expect(checkRefutation(bug.refute, d).ok, JSON.stringify(d)).toBe(false);
      });
      it("has valid accept_steps, keywords and intern lines", () => {
        expect(bug.accept_steps.length).toBeGreaterThan(0);
        for (const s of bug.accept_steps) expect(s >= 1 && s <= c.steps.length).toBe(true);
        expect(bug.keywords.length).toBeGreaterThanOrEqual(3);
        expect(bug.defense).toHaveLength(2);
        expect(c.falseAccusation).toBeUndefined();
      });
      it("keyword fallback accepts the canonical cause and rejects vague text", () => {
        expect(keywordJudge(c, bug.cause)).toBe(true);
        expect(keywordJudge(c, "там неправильно, ответ не такой")).toBe(false);
      });
    } else {
      it("clean case has falseAccusation", () => {
        expect(c.falseAccusation?.trim()).toBeTruthy();
      });
    }
  });
});

describe("validateCatalog catches violations", () => {
  const base = getCase("pct-01")!;
  const cleanCase = getCase("lin-ok")!;
  const run = (mutate: (c: Case) => void, extra: Case[] = [cleanCase]) => {
    const c = clone(base);
    mutate(c);
    return validateCatalog([c, ...extra]).join("\n");
  };

  it("duplicate ids", () => {
    expect(validateCatalog([base, base, cleanCase]).join("\n")).toContain("duplicate id");
  });
  it("too few steps", () => expect(run((c) => (c.steps = c.steps.slice(0, 2)))).toContain("steps.length < 3"));
  it("empty strings", () => expect(run((c) => (c.task = "  "))).toContain("empty task"));
  it("accept_steps out of range", () =>
    expect(run((c) => (c.bug!.accept_steps = [9]))).toContain("accept_steps out of range"));
  it("false truth", () => expect(run((c) => (c.truth = ["1 == 2"]))).toContain("truth is not true"));
  it("demo that does not refute", () => expect(run((c) => (c.bug!.demo = [{ x: 0 }]))).toContain("must be ok:true"));
  it("decoy that refutes", () =>
    expect(run((c) => (c.bug!.decoy = [{ x: 20000 }]))).toContain("must be ok:false"));
  it("few keywords", () => expect(run((c) => (c.bug!.keywords = ["a", "b"]))).toContain("keywords < 3"));
  it("defense revealing the answer", () =>
    expect(run((c) => (c.bug!.defense = ["Будет 14 400 ₸", "нет"]))).toContain("reveals the correct answer"));
  it("buggy case with falseAccusation", () =>
    expect(run((c) => (c.falseAccusation = "x"))).toContain("must not have falseAccusation"));
  it("missing clean case", () => expect(run(() => {}, [])).toContain("at least one clean case"));
  it("clean case without falseAccusation", () => {
    const c = clone(cleanCase);
    delete c.falseAccusation;
    expect(validateCatalog([c]).join("\n")).toContain("needs falseAccusation");
  });
});

describe("session picking", () => {
  it("picks unique cases with exactly one clean case", () => {
    for (let i = 0; i < 50; i++) {
      const ids = pickSessionCases();
      expect(ids).toHaveLength(SESSION_ROUNDS);
      expect(new Set(ids).size).toBe(ids.length);
      expect(ids.filter((id) => getCase(id)!.bug === null)).toHaveLength(1);
    }
  });
  it("replacement avoids excluded cases", () => {
    const exclude = CASES.map((c) => c.id).filter((id) => id !== "sq-01" && id !== "pct-01");
    expect(pickReplacement("pct-01", exclude)).toBe("sq-01");
    expect(pickReplacement("pct-01", CASES.map((c) => c.id))).toBeNull();
  });
});
