import { describe, expect, it } from "vitest";
import { addMsg, newGame, restoreGame, type GameState } from "../components/game/model";

const roundTrip = (g: unknown) => restoreGame(JSON.parse(JSON.stringify(g)));

function midGame(): GameState {
  const g = newGame(null, 3);
  const round = addMsg({ ...g.round, phase: "prove", foundLine: 2, explanation: "вторая скидка от новой цены" }, "student", "x");
  return {
    ...g,
    lives: 2,
    total: 110,
    results: [
      {
        attemptId: "4f6c1d2e-8a1b-4c3d-9e0f-1a2b3c4d5e6f",
        caseId: g.caseIds[0],
        typeId: "percent_add",
        outcome: "solved",
        score: 110,
        stars: 3,
        hintsUsed: 0,
        causeOk: true,
        refuteTries: 1,
        livesLost: 0,
      },
    ],
    round: { ...round, typing: true },
    flash: { kind: "good", key: 1 },
  };
}

describe("restoreGame", () => {
  it("restores score, lives, results and the current round after a reload", () => {
    const g = midGame();
    const restored = roundTrip(g);
    expect(restored).not.toBeNull();
    expect(restored!.total).toBe(110);
    expect(restored!.lives).toBe(2);
    expect(restored!.results).toEqual(g.results);
    expect(restored!.round.phase).toBe("prove");
    expect(restored!.round.explanation).toBe("вторая скидка от новой цены");
    expect(restored!.round.chat).toEqual(g.round.chat);
  });

  it("drops what cannot survive a reload: a pending reply and the flash", () => {
    const restored = roundTrip(midGame())!;
    expect(restored.round.typing).toBe(false);
    expect(restored.flash).toBeNull();
  });

  it("restores a fresh session", () => {
    const g = newGame(null, 1);
    expect(roundTrip(g)).toEqual(g);
  });

  it.each([
    ["a finished session", (g: GameState) => ({ ...g, over: true })],
    ["an unknown case", (g: GameState) => ({ ...g, caseIds: ["no-such-case", ...g.caseIds.slice(1)] })],
    ["a round that does not match its slot", (g: GameState) => ({ ...g, round: { ...g.round, caseId: g.caseIds[1] } })],
    ["an index past the end", (g: GameState) => ({ ...g, index: g.caseIds.length })],
    ["more lives than a session has", (g: GameState) => ({ ...g, lives: 99 })],
    ["a broken result", (g: GameState) => ({ ...g, results: [{ ...g.results[0], outcome: "won" }] })],
    ["a broken chat", (g: GameState) => ({ ...g, round: { ...g.round, chat: [{ from: "admin" }] } })],
  ])("rejects %s", (_, mutate) => {
    expect(roundTrip(mutate(midGame()))).toBeNull();
  });

  it.each([null, 42, "game", [], {}])("rejects garbage %j", (raw) => {
    expect(restoreGame(raw)).toBeNull();
  });
});

describe("subjects in saved sessions", () => {
  it("starts and restores a physics session", () => {
    const g = newGame(null, 1, undefined, "physics");
    expect(g.subject).toBe("physics");
    expect(roundTrip(g)!.subject).toBe("physics");
  });

  it("reads a session saved before subjects existed as algebra", () => {
    const legacy: Partial<GameState> = newGame(null, 1);
    delete legacy.subject;
    expect(roundTrip(legacy)!.subject).toBe("algebra");
  });

  it("rejects a session whose cases belong to another subject", () => {
    const g = newGame(null, 1, undefined, "physics");
    expect(roundTrip({ ...g, subject: "algebra" })).toBeNull();
    expect(roundTrip({ ...g, subject: "chemistry" })).toBeNull();
  });
});
