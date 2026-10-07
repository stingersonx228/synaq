import { describe, expect, it } from "vitest";
import { checkRefutation, explainRefutation, parseNumberInput, parseValues } from "../lib/refute";
import type { RefuteSpec } from "../lib/types";

const diverge: RefuteSpec = { mode: "diverge", vars: ["x"], wrong: "0.7*x", right: "0.8*0.9*x", prompt: "" };
const fraction: RefuteSpec = {
  mode: "diverge",
  vars: ["a", "b", "c", "d"],
  wrong: "(a+c)/(b+d)",
  right: "a/b + c/d",
  prompt: "",
};
const odz: RefuteSpec = {
  mode: "claim_test",
  vars: ["x"],
  claim: "x == 2 or x == -2",
  original: "(x^2-4)/(x-2) == 0",
  prompt: "",
};
const radical: RefuteSpec = {
  mode: "claim_test",
  vars: ["x"],
  claim: "x == 2 or x == -1",
  original: "sqrt(x+2) == x",
  prompt: "",
};
const ineq: RefuteSpec = { mode: "claim_test", vars: ["x"], claim: "x > -3", original: "-2*x > 6", prompt: "" };
const missing: RefuteSpec = { mode: "missing", vars: ["x"], claim: "x == 3", original: "x^2 == 9", prompt: "" };

describe("checkRefutation: diverge", () => {
  it("accepts values where formulas differ", () => {
    const r = checkRefutation(diverge, { x: 20000 });
    expect(r.ok).toBe(true);
    expect(r.wrong).toBeCloseTo(14000);
    expect(r.right).toBeCloseTo(14400);
  });
  it("rejects values where formulas coincide", () => {
    expect(checkRefutation(diverge, { x: 0 })).toMatchObject({ ok: false, reason: "values_equal", wrong: 0 });
  });
  it("reports undefined on division by zero instead of throwing", () => {
    expect(checkRefutation(fraction, { a: 1, b: 0, c: 1, d: 0 })).toEqual({ ok: false, reason: "undefined" });
    expect(checkRefutation(fraction, { a: 1, b: 2, c: 1, d: 2 }).ok).toBe(true);
  });
  it("treats complex results as undefined", () => {
    const spec: RefuteSpec = { mode: "diverge", vars: ["x"], wrong: "sqrt(x)", right: "x", prompt: "" };
    expect(checkRefutation(spec, { x: -4 })).toEqual({ ok: false, reason: "undefined" });
  });
});

describe("checkRefutation: claim_test", () => {
  it("refutes when the original is 0/0 (NaN)", () => {
    expect(checkRefutation(odz, { x: 2 })).toEqual({ ok: true });
  });
  it("does not refute a genuine root", () => {
    expect(checkRefutation(odz, { x: -2 })).toEqual({ ok: false, reason: "original_holds" });
  });
  it("requires the value to belong to the claim", () => {
    expect(checkRefutation(odz, { x: 5 })).toEqual({ ok: false, reason: "claim_false" });
    expect(checkRefutation(ineq, { x: -5 })).toEqual({ ok: false, reason: "claim_false" });
  });
  it("refutes an extraneous root", () => {
    expect(checkRefutation(radical, { x: -1 })).toEqual({ ok: true });
    expect(checkRefutation(radical, { x: 2 })).toEqual({ ok: false, reason: "original_holds" });
  });
  it("handles inequalities", () => {
    expect(checkRefutation(ineq, { x: 0 })).toEqual({ ok: true });
  });
  it("treats an original that throws on complex numbers as not holding", () => {
    const spec: RefuteSpec = { mode: "claim_test", vars: ["x"], claim: "x < 0", original: "sqrt(x) > -1", prompt: "" };
    expect(checkRefutation(spec, { x: -4 })).toEqual({ ok: true });
  });
});

describe("checkRefutation: missing", () => {
  it("accepts a lost root", () => {
    expect(checkRefutation(missing, { x: -3 })).toEqual({ ok: true });
  });
  it("rejects a root that is already claimed", () => {
    expect(checkRefutation(missing, { x: 3 })).toEqual({ ok: false, reason: "already_claimed" });
  });
  it("rejects a non-solution", () => {
    expect(checkRefutation(missing, { x: 4 })).toEqual({ ok: false, reason: "not_a_solution" });
  });
});

describe("checkRefutation: input guards", () => {
  it("rejects missing, NaN and infinite inputs", () => {
    expect(checkRefutation(diverge, {})).toEqual({ ok: false, reason: "invalid_input" });
    expect(checkRefutation(diverge, { x: Number.NaN })).toEqual({ ok: false, reason: "invalid_input" });
    expect(checkRefutation(diverge, { x: Number.POSITIVE_INFINITY })).toEqual({ ok: false, reason: "invalid_input" });
    expect(checkRefutation(fraction, { a: 1, b: 2, c: 1 })).toEqual({ ok: false, reason: "invalid_input" });
  });
  it("rejects unknown modes", () => {
    const spec = { mode: "other", vars: [], claim: "", original: "", prompt: "" } as unknown as RefuteSpec;
    expect(checkRefutation(spec, {})).toEqual({ ok: false, reason: "unknown_mode" });
  });
  it("is not affected by extra scope keys", () => {
    expect(checkRefutation(diverge, { x: 20000, sqrt: 1 }).ok).toBe(true);
  });
});

describe("parseNumberInput", () => {
  it.each([
    ["20000", 20000],
    [" 20000 ", 20000],
    ["20 000", 20000],
    ["0,5", 0.5],
    ["937.5", 937.5],
    ["-3", -3],
    ["−3", -3],
    ["+7", 7],
    [".5", 0.5],
    ["5.", 5],
  ])("parses %j", (raw, expected) => {
    expect(parseNumberInput(raw)).toBe(expected);
  });

  it.each(["", "   ", "abc", "1/0", "1e5", "Infinity", "NaN", "2+2", "1,2,3", "--1", "x", "0x10", ","])(
    "rejects %j",
    (raw) => {
      expect(parseNumberInput(raw)).toBeNull();
    },
  );

  it("rejects numbers that overflow to infinity", () => {
    expect(parseNumberInput("9".repeat(400))).toBeNull();
  });

  it("parseValues drops invalid fields so the checker reports invalid_input", () => {
    const values = parseValues(["x"], { x: "abc" });
    expect(values).toEqual({});
    expect(checkRefutation(diverge, values)).toEqual({ ok: false, reason: "invalid_input" });
    expect(checkRefutation(diverge, parseValues(["x"], { x: "20 000" })).ok).toBe(true);
  });
});

describe("explainRefutation", () => {
  it("mentions equal values with the computed number", () => {
    const text = explainRefutation(checkRefutation(diverge, { x: 0 }));
    expect(text).toContain("оба выражения равны");
    expect(text).toContain("0");
  });
});

describe("keepNumbersTogether", () => {
  it("joins digit groups and the tenge sign with non-breaking spaces only", async () => {
    const { keepNumbersTogether } = await import("../lib/format");
    expect(keepNumbersTogether("20 000 × 0,3 = 6 000 ₸")).toBe("20 000 × 0,3 = 6 000 ₸");
    expect(keepNumbersTogether("x = 2 или 3 4")).toBe("x = 2 или 3 4");
    expect(keepNumbersTogether("1 250 000")).toBe("1 250 000");
  });
});
