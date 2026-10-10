import { describe, expect, it } from "vitest";
import { evaluate } from "mathjs/number";
import { checkRefutation } from "../lib/refute";
import {
  CASES,
  casesOf,
  getCase,
  keywordJudge,
  pickPracticeCases,
  pickReplacement,
  PRACTICE_MIN_ROUNDS,
  pickSessionCases,
  SESSION_ROUNDS,
  typeName,
  typeSubject,
} from "../lib/catalog";
import { validateCatalog } from "../lib/catalog/validate";
import { SUBJECTS, type Case } from "../lib/types";

const clone = (c: Case): Case => structuredClone(c);

describe("catalog", () => {
  it("passes full validation", () => {
    expect(validateCatalog(CASES)).toEqual([]);
  });

  it("has at least 11 cases with unique ids, most of them buggy, and clean cases for every session", () => {
    expect(CASES.length).toBeGreaterThanOrEqual(11);
    expect(new Set(CASES.map((c) => c.id)).size).toBe(CASES.length);
    const clean = CASES.filter((c) => c.bug === null).length;
    expect(clean).toBeGreaterThanOrEqual(1);
    expect(CASES.length - clean).toBeGreaterThanOrEqual(SESSION_ROUNDS - 1);
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
  it("replacement may switch between clean and buggy cases, so a swap never reveals the kind", () => {
    // Walk every slot of the pool with a fixed rng instead of hoping random draws hit both kinds.
    const kinds = new Set<boolean>();
    const pool = CASES.length - 1;
    for (let i = 0; i < pool; i++) {
      const id = pickReplacement("lin-ok", ["lin-ok"], () => (i + 0.5) / pool);
      kinds.add(getCase(id!)!.bug === null);
    }
    expect(kinds).toEqual(new Set([true, false]));
  });

  it("replacement avoids excluded cases", () => {
    const exclude = CASES.map((c) => c.id).filter((id) => id !== "sq-01" && id !== "pct-01");
    expect(pickReplacement("pct-01", exclude)).toBe("sq-01");
    expect(pickReplacement("pct-01", CASES.map((c) => c.id))).toBeNull();
  });
});

describe("pickPracticeCases", () => {
  it("covers every blind-spot type, tops up to the minimum and never repeats a case", () => {
    for (let i = 0; i < 30; i++) {
      const ids = pickPracticeCases(["odz", "percent_add"], ["odz-01", "pct-01", "sq-01"]);
      expect(ids.length).toBeGreaterThanOrEqual(PRACTICE_MIN_ROUNDS);
      expect(new Set(ids).size).toBe(ids.length);
      const types = ids.map((id) => getCase(id)!.type_id);
      expect(types).toContain("odz");
      expect(types).toContain("percent_add");
      // Top-up cases are fresh: nothing already played except the blind-spot cases themselves.
      expect(ids).not.toContain("sq-01");
    }
  });

  it("prefers an unplayed case when a type has several", () => {
    for (let i = 0; i < 20; i++) {
      const ids = pickPracticeCases(["clean"], ["lin-ok"]);
      expect(ids.some((id) => id !== "lin-ok" && getCase(id)!.bug === null)).toBe(true);
      expect(ids).not.toContain("lin-ok");
    }
  });

  it("gives every buggy error type a second case, so practice offers a fresh one", () => {
    const buggyTypes = new Set(CASES.filter((c) => c.bug !== null).map((c) => c.type_id));
    for (const type of buggyTypes) {
      expect(CASES.filter((c) => c.type_id === type).length, type).toBeGreaterThanOrEqual(2);
    }
    for (let i = 0; i < 20; i++) {
      const ids = pickPracticeCases(["log_sum"], ["log-01"]);
      expect(ids).toContain("log-02");
      expect(ids).not.toContain("log-01");
    }
  });

  it("replays a played case when every case of its type was played", () => {
    const ids = pickPracticeCases(["log_sum"], ["log-01", "log-02"]);
    expect(ids.some((id) => id === "log-01" || id === "log-02")).toBe(true);
  });
});

describe("validateCatalog: keywords", () => {
  it("rejects a keyword that is just part of the correct answer", () => {
    const c = structuredClone(getCase("sq-01")!);
    c.bug!.keywords = [...c.bug!.keywords, "6x"];
    expect(validateCatalog([c, getCase("lin-ok")!]).join("\n")).toContain("keyword is part of the correct answer: 6x");
  });
});

describe("subjects", () => {
  it("every subject has clean cases and enough buggy ones for a session", () => {
    for (const subject of SUBJECTS) {
      const pool = casesOf(subject);
      expect(pool.filter((c) => c.bug === null).length, subject).toBeGreaterThanOrEqual(1);
      expect(pool.filter((c) => c.bug !== null).length, subject).toBeGreaterThanOrEqual(SESSION_ROUNDS - 1);
    }
  });

  it("an error type belongs to exactly one subject", () => {
    const owners = new Map<string, Set<string>>();
    for (const c of CASES.filter((x) => x.bug !== null)) {
      owners.set(c.type_id, (owners.get(c.type_id) ?? new Set()).add(c.subject));
    }
    for (const [type, subjects] of owners) expect(subjects.size, type).toBe(1);
    expect(typeSubject("ohm_law")).toBe("physics");
    expect(typeSubject("odz")).toBe("algebra");
    expect(typeSubject("clean")).toBeNull();
  });

  it("a physics session holds only physics, with exactly one clean case", () => {
    for (let i = 0; i < 30; i++) {
      const ids = pickSessionCases(SESSION_ROUNDS, Math.random, "physics");
      expect(ids).toHaveLength(SESSION_ROUNDS);
      expect(ids.every((id) => getCase(id)!.subject === "physics")).toBe(true);
      expect(ids.filter((id) => getCase(id)!.bug === null)).toHaveLength(1);
    }
  });

  it("the spare intern never switches the subject", () => {
    const pool = casesOf("physics").length - 1;
    for (let i = 0; i < pool; i++) {
      const id = pickReplacement("ph-ohm-01", ["ph-ohm-01"], () => (i + 0.5) / pool);
      expect(getCase(id!)!.subject).toBe("physics");
    }
  });

  it("practice stays in the subject, also for the shared clean type", () => {
    for (let i = 0; i < 20; i++) {
      const ids = pickPracticeCases(["clean", "ohm_law"], ["ph-ok-01", "ph-ohm-01"], Math.random, "physics");
      expect(ids.every((id) => getCase(id)!.subject === "physics")).toBe(true);
      expect(ids).toContain("ph-ok-02");
      expect(ids).toContain("ph-ohm-02");
    }
  });
});
