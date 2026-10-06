import { describe, expect, it } from "vitest";
import { blindSpots, hintPenalty, roundScore, stars } from "../lib/scoring";

const solved = { outcome: "solved" as const, clean: false, causeOk: false, refuteTries: 2, hintsUsed: 0 };

describe("roundScore", () => {
  it("gives 60 for finding and proving", () => {
    expect(roundScore(solved)).toBe(60);
  });
  it("adds 30 for a correct cause and 10 for a first-try proof", () => {
    expect(roundScore({ ...solved, causeOk: true })).toBe(90);
    expect(roundScore({ ...solved, refuteTries: 1 })).toBe(70);
    expect(roundScore({ ...solved, causeOk: true, refuteTries: 1 })).toBe(100);
  });
  it("does not add the cause bonus while the verdict is unknown", () => {
    expect(roundScore({ ...solved, causeOk: null, refuteTries: 1 })).toBe(70);
  });
  it("subtracts cumulative hint costs", () => {
    expect(roundScore({ ...solved, causeOk: true, refuteTries: 1, hintsUsed: 1 })).toBe(90);
    expect(roundScore({ ...solved, causeOk: true, refuteTries: 1, hintsUsed: 2 })).toBe(70);
    expect(roundScore({ ...solved, causeOk: true, refuteTries: 1, hintsUsed: 3 })).toBe(40);
  });
  it("never goes below zero", () => {
    expect(roundScore({ ...solved, hintsUsed: 3 })).toBe(0);
  });
  it("gives 100 for a clean case declared clean, minus hints", () => {
    const clean = { outcome: "solved" as const, clean: true, causeOk: null, refuteTries: 0, hintsUsed: 0 };
    expect(roundScore(clean)).toBe(100);
    expect(roundScore({ ...clean, hintsUsed: 2 })).toBe(70);
    expect(roundScore({ ...clean, hintsUsed: 3 })).toBe(40);
  });
  it.each(["wrong_line", "false_accusation", "missed_clean", "failed_proof"] as const)("gives 0 for %s", (outcome) => {
    expect(roundScore({ ...solved, outcome, causeOk: true, refuteTries: 1 })).toBe(0);
  });
});

describe("hintPenalty", () => {
  it("clamps the level count", () => {
    expect(hintPenalty(0)).toBe(0);
    expect(hintPenalty(-1)).toBe(0);
    expect(hintPenalty(3)).toBe(60);
    expect(hintPenalty(7)).toBe(60);
  });
});

describe("stars", () => {
  it.each([
    [100, 3],
    [90, 3],
    [89, 2],
    [60, 2],
    [59, 1],
    [1, 1],
    [0, 0],
  ])("%i → %i", (score, expected) => {
    expect(stars(score)).toBe(expected);
  });
});

describe("blindSpots", () => {
  it("lists failed rounds and rounds solved with hints, once each", () => {
    expect(
      blindSpots([
        { typeId: "odz", outcome: "solved", hintsUsed: 0 },
        { typeId: "percent_add", outcome: "failed_proof", hintsUsed: 0 },
        { typeId: "lost_root", outcome: "solved", hintsUsed: 1 },
        { typeId: "percent_add", outcome: "missed_clean", hintsUsed: 0 },
        { typeId: "clean", outcome: "false_accusation", hintsUsed: 0 },
      ]),
    ).toEqual(["percent_add", "lost_root", "clean"]);
  });
});
