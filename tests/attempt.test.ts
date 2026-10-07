import { afterEach, describe, expect, it, vi } from "vitest";
import { attemptFactsValid, type AttemptFacts } from "../lib/attempt";
import { getCase } from "../lib/catalog";
import { newId, saveAttempt, type AttemptPayload } from "../lib/client";
import { clientIp } from "../lib/http";
import { judgeCacheKey } from "../lib/judge-cache";

const buggy = getCase("pct-01")!;
const clean = getCase("lin-ok")!;
const facts = (f: Partial<AttemptFacts>): AttemptFacts => ({
  outcome: "solved",
  hintsUsed: 0,
  causeOk: true,
  refuteTries: 1,
  livesLost: 0,
  ...f,
});

describe("attemptFactsValid: rounds the game can produce", () => {
  it.each([
    ["buggy solved, first try", buggy, facts({})],
    ["buggy solved after wrong lines and hints", buggy, facts({ refuteTries: 3, livesLost: 2, hintsUsed: 3, causeOk: false })],
    ["buggy failed proof", buggy, facts({ outcome: "failed_proof", refuteTries: 3, livesLost: 1, causeOk: false })],
    ["buggy failed proof while judge pending", buggy, facts({ outcome: "failed_proof", refuteTries: 3, livesLost: 1, causeOk: null })],
    ["buggy wrong line ran out of lives", buggy, facts({ outcome: "wrong_line", refuteTries: 0, livesLost: 3, causeOk: null })],
    ["buggy declared clean", buggy, facts({ outcome: "missed_clean", refuteTries: 0, livesLost: 1, causeOk: null })],
    ["clean declared clean", clean, facts({ refuteTries: 0, causeOk: null })],
    ["clean with hints", clean, facts({ refuteTries: 0, causeOk: null, hintsUsed: 2 })],
    ["clean false accusation", clean, facts({ outcome: "false_accusation", refuteTries: 0, livesLost: 1, causeOk: null })],
  ] as const)("%s", (_name, c, f) => {
    expect(attemptFactsValid(c, f)).toBe(true);
  });
});

describe("attemptFactsValid: impossible rounds", () => {
  it.each([
    ["solved without any proof", buggy, facts({ refuteTries: 0 })],
    ["failed proof before 3 tries", buggy, facts({ outcome: "failed_proof", refuteTries: 1, livesLost: 1 })],
    ["lost round without losing a life", buggy, facts({ outcome: "missed_clean", refuteTries: 0, livesLost: 0, causeOk: null })],
    ["missed_clean after a proof", buggy, facts({ outcome: "missed_clean", refuteTries: 2, livesLost: 1, causeOk: null })],
    ["wrong_line with a cause verdict", buggy, facts({ outcome: "wrong_line", refuteTries: 0, livesLost: 1, causeOk: true })],
    ["false accusation on a buggy case", buggy, facts({ outcome: "false_accusation", refuteTries: 0, livesLost: 1, causeOk: null })],
    ["clean case with a cause bonus", clean, facts({ refuteTries: 0, causeOk: true })],
    ["clean case with proof tries", clean, facts({ refuteTries: 1, causeOk: null })],
    ["clean win that lost a life", clean, facts({ refuteTries: 0, causeOk: null, livesLost: 1 })],
    ["missed_clean on the clean case", clean, facts({ outcome: "missed_clean", refuteTries: 0, livesLost: 1, causeOk: null })],
    ["failed proof on the clean case", clean, facts({ outcome: "failed_proof", refuteTries: 3, livesLost: 1, causeOk: null })],
  ] as const)("%s", (_name, c, f) => {
    expect(attemptFactsValid(c, f)).toBe(false);
  });
});

describe("saveAttempt retries", () => {
  const payload: AttemptPayload = {
    attemptId: "33333333-3333-4333-8333-333333333333",
    studentId: "11111111-1111-4111-8111-111111111111",
    caseId: "pct-01",
    outcome: "solved",
    hintsUsed: 0,
    causeOk: true,
    refuteTries: 1,
    livesLost: 0,
  };
  const respond = (status: number) => new Response(JSON.stringify({}), { status });

  afterEach(() => vi.unstubAllGlobals());

  it("retries network errors, 5xx and 429 with the same attemptId, then succeeds", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce(respond(500))
      .mockResolvedValueOnce(respond(429))
      .mockResolvedValueOnce(respond(200));
    vi.stubGlobal("fetch", fetchMock);
    expect(await saveAttempt(payload, [0, 0, 0])).toBe("saved");
    expect(fetchMock).toHaveBeenCalledTimes(4);
    const ids = fetchMock.mock.calls.map((c) => JSON.parse((c[1] as RequestInit).body as string).attemptId);
    expect(new Set(ids)).toEqual(new Set([payload.attemptId]));
  });

  it("gives up after the last retry", async () => {
    const fetchMock = vi.fn().mockResolvedValue(respond(502));
    vi.stubGlobal("fetch", fetchMock);
    expect(await saveAttempt(payload, [0, 0])).toBe("unavailable");
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it.each([
    [503, "unavailable"],
    [400, "unavailable"],
    [401, "unauthorized"],
  ] as const)("does not retry %i", async (status, expected) => {
    const fetchMock = vi.fn().mockResolvedValue(respond(status));
    vi.stubGlobal("fetch", fetchMock);
    expect(await saveAttempt(payload, [0, 0, 0])).toBe(expected);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("newId", () => {
  it("produces RFC 4122 v4 ids, also without crypto.randomUUID", () => {
    const re = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
    expect(newId()).toMatch(re);
    const original = crypto.randomUUID;
    try {
      Object.defineProperty(crypto, "randomUUID", { value: undefined, configurable: true });
      const ids = Array.from({ length: 50 }, newId);
      for (const id of ids) expect(id).toMatch(re);
      expect(new Set(ids).size).toBe(50);
    } finally {
      Object.defineProperty(crypto, "randomUUID", { value: original, configurable: true });
    }
  });
});

describe("judgeCacheKey", () => {
  it("ignores letter case but depends on the canonical cause", () => {
    const a = judgeCacheKey("pct-01", "cause v1", "Вторая скидка от новой цены");
    expect(judgeCacheKey("pct-01", "cause v1", "вторая скидка от НОВОЙ цены")).toBe(a);
    expect(judgeCacheKey("pct-01", "cause v2", "Вторая скидка от новой цены")).not.toBe(a);
    expect(judgeCacheKey("pct-02", "cause v1", "Вторая скидка от новой цены")).not.toBe(a);
  });
});

describe("clientIp", () => {
  const req = (headers: Record<string, string>) => new Request("http://localhost", { headers });
  it("prefers x-real-ip over a client-supplied x-forwarded-for", () => {
    expect(clientIp(req({ "x-real-ip": "1.2.3.4", "x-forwarded-for": "6.6.6.6, 1.2.3.4" }))).toBe("1.2.3.4");
  });
  it("falls back to the first forwarded address, then to unknown", () => {
    expect(clientIp(req({ "x-forwarded-for": "5.5.5.5, 10.0.0.1" }))).toBe("5.5.5.5");
    expect(clientIp(req({}))).toBe("unknown");
  });
});
