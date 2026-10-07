import { afterEach, describe, expect, it, vi } from "vitest";
import { aggregateStats, type AttemptRow } from "../lib/stats";
import { generateClassCode, generateTeacherToken, hashToken } from "../lib/teacher";
import { CLASS_CODE_RE, JoinBody, TEACHER_TOKEN_RE } from "../lib/schemas";

const supabaseMock = vi.hoisted(() => ({
  db: null as unknown,
  exists: false,
}));

vi.mock("../lib/supabase", () => ({
  getSupabase: () => supabaseMock.db,
  studentExists: async () => supabaseMock.exists,
  resolveOptionalStudent: async (id: string | undefined) =>
    !id || !supabaseMock.db ? { ok: true, studentId: null } : supabaseMock.exists ? { ok: true, studentId: id } : { ok: false },
}));

const { POST: join } = await import("../app/api/join/route");
const { POST: attempt } = await import("../app/api/attempt/route");
const { POST: createClass } = await import("../app/api/teacher/class/route");
const { GET: stats } = await import("../app/api/teacher/[token]/stats/route");
const { POST: judge } = await import("../app/api/judge/route");
const { POST: intern } = await import("../app/api/intern/route");
const { resetMemoryLimits } = await import("../lib/ratelimit");

const post = (body: unknown, ip = "10.9.0.1") =>
  new Request("http://localhost/api", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": ip },
    body: JSON.stringify(body),
  });

const validAttempt = {
  attemptId: "44444444-4444-4444-8444-444444444444",
  studentId: "11111111-1111-4111-8111-111111111111",
  caseId: "pct-01",
  outcome: "solved",
  hintsUsed: 0,
  causeOk: true,
  refuteTries: 1,
  livesLost: 0,
};

afterEach(() => {
  supabaseMock.db = null;
  supabaseMock.exists = false;
  resetMemoryLimits();
});

describe("request guards", () => {
  it("rejects bodies over 4 KB with 413", async () => {
    const res = await join(post({ code: "K7M2QX", nickname: "Барыс", pad: "x".repeat(5000) }));
    expect(res.status).toBe(413);
  });

  it("rejects malformed JSON with 400", async () => {
    const res = await join(new Request("http://localhost/api", { method: "POST", body: "{nope" }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "invalid_json" });
  });

  it("limits join attempts per IP", async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 121; i++) statuses.push((await join(post({ code: "K7M2QX", nickname: "Барыс" }, "10.9.9.9"))).status);
    expect(statuses.slice(0, 120).every((s) => s === 503)).toBe(true);
    expect(statuses[120]).toBe(429);
    expect((await join(post({ code: "K7M2QX", nickname: "Барыс" }, "10.9.9.10"))).status).toBe(503);
  });

  it("limits class creation per IP", async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 11; i++) statuses.push((await createClass(post({ name: "9Б" }, "10.8.8.8"))).status);
    expect(statuses[9]).toBe(503);
    expect(statuses[10]).toBe(429);
  });

  it("LLM routes reject an unknown student id with 401", async () => {
    supabaseMock.db = {};
    supabaseMock.exists = false;
    const studentId = "22222222-2222-4222-8222-222222222222";
    const j = await judge(post({ caseId: "pct-01", explanation: "вторая скидка от новой цены", studentId }));
    expect(j.status).toBe(401);
    const i = await intern(post({ caseId: "pct-01", stage: 0, explanation: "вторая скидка от новой цены", studentId }));
    expect(i.status).toBe(401);
  });

  it("LLM routes still answer anonymous players", async () => {
    vi.stubEnv("LLM_DISABLED", "1");
    const j = await judge(post({ caseId: "pct-01", explanation: "вторая скидка от сниженной цены" }));
    expect(await j.json()).toEqual({ verdict: true, source: "fallback" });
    vi.unstubAllEnvs();
  });
});

describe("routes without Supabase", () => {
  it("return 503 db_unavailable so the client switches to local mode", async () => {
    const r1 = await join(post({ code: "K7M2QX", nickname: "Барыс" }));
    expect(r1.status).toBe(503);
    expect(await r1.json()).toEqual({ error: "db_unavailable" });
    expect((await attempt(post(validAttempt))).status).toBe(503);
    expect((await createClass(post({ name: "9Б" }))).status).toBe(503);
    const ctx = { params: Promise.resolve({ token: "a".repeat(64) }) };
    expect((await stats(new Request("http://localhost"), ctx)).status).toBe(503);
  });

  it("validate input before anything else", async () => {
    expect((await join(post({ code: "OOOOOO", nickname: "Барыс" }))).status).toBe(400);
    expect((await join(post({ code: "K7M2QX", nickname: "<script>" }))).status).toBe(400);
    expect((await attempt(post({ ...validAttempt, outcome: "won" }))).status).toBe(400);
    expect((await attempt(post({ ...validAttempt, hintsUsed: 4 }))).status).toBe(400);
    expect((await attempt(post({ ...validAttempt, studentId: "not-a-uuid" }))).status).toBe(400);
    expect((await createClass(post({ name: "   " }))).status).toBe(400);
  });
});

describe("/api/attempt with Supabase", () => {
  it("rejects an unknown student with 401", async () => {
    supabaseMock.db = {};
    supabaseMock.exists = false;
    const res = await attempt(post(validAttempt));
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "unknown_student" });
  });

  it("stores a server-computed score and hides database errors", async () => {
    const inserted: unknown[] = [];
    supabaseMock.exists = true;
    supabaseMock.db = { from: () => ({ insert: async (row: unknown) => (inserted.push(row), { error: null }) }) };
    const res = await attempt(post({ ...validAttempt, score: 999 }));
    expect(await res.json()).toEqual({ ok: true, score: 100, stars: 3 });
    expect(inserted[0]).toMatchObject({
      id: validAttempt.attemptId,
      case_id: "pct-01",
      type_id: "percent_add",
      score: 100,
      stars: 3,
    });

    supabaseMock.db = { from: () => ({ insert: async () => ({ error: { code: "42P01", message: "secret detail" } }) }) };
    const failed = await attempt(post(validAttempt));
    expect(failed.status).toBe(500);
    expect(await failed.json()).toEqual({ error: "E_ATTEMPT" });
  });

  it("treats a retried report (same attemptId) as already saved", async () => {
    supabaseMock.exists = true;
    supabaseMock.db = { from: () => ({ insert: async () => ({ error: { code: "23505" } }) }) };
    const res = await attempt(post(validAttempt));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, score: 100, stars: 3 });
  });

  it("rejects round reports the game cannot produce", async () => {
    supabaseMock.exists = true;
    supabaseMock.db = { from: () => ({ insert: async () => ({ error: null }) }) };
    const cleanWithBonus = { ...validAttempt, caseId: "lin-ok", causeOk: true, refuteTries: 0 };
    const res = await attempt(post(cleanWithBonus));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "inconsistent_attempt" });
    const noProof = await attempt(post({ ...validAttempt, refuteTries: 0 }));
    expect(noProof.status).toBe(400);
  });

  it("requires an attemptId", async () => {
    const withoutId: Partial<typeof validAttempt> = { ...validAttempt };
    delete withoutId.attemptId;
    expect((await attempt(post(withoutId))).status).toBe(400);
  });
});

describe("class codes and teacher tokens", () => {
  it("codes use 6 unambiguous characters", () => {
    for (let i = 0; i < 200; i++) {
      const code = generateClassCode();
      expect(code).toMatch(CLASS_CODE_RE);
      expect(code).not.toMatch(/[O0I1]/);
    }
  });
  it("tokens are 32 random bytes in hex and are stored hashed", () => {
    const token = generateTeacherToken();
    expect(token).toMatch(TEACHER_TOKEN_RE);
    expect(generateTeacherToken()).not.toBe(token);
    expect(hashToken(token)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashToken(token)).not.toBe(token);
  });
  it("join normalizes the code and nickname", () => {
    expect(JoinBody.parse({ code: " k7m2qx ", nickname: "  Барыс   42 " })).toEqual({ code: "K7M2QX", nickname: "Барыс 42" });
  });
});

describe("aggregateStats", () => {
  const row = (student: string, type: string, extra: Partial<AttemptRow> = {}): AttemptRow => ({
    student_id: student,
    type_id: type,
    outcome: "solved",
    score: 100,
    hints_used: 0,
    lives_lost: 0,
    cause_ok: true,
    created_at: "2026-10-01T10:00:00Z",
    ...extra,
  });

  it("ranks error types by the share of problem rounds", () => {
    const s = aggregateStats(
      [
        { id: "a", nickname: "Барыс" },
        { id: "b", nickname: "Тулпар" },
        { id: "c", nickname: "Новичок" },
      ],
      [
        row("a", "odz", { outcome: "missed_clean", score: 0 }),
        row("b", "odz", { hints_used: 3, score: 40 }),
        row("a", "lost_root", { lives_lost: 1, score: 60, created_at: "2026-10-02T10:00:00Z" }),
        row("b", "lost_root"),
        row("a", "percent_add"),
      ],
    );
    expect(s.studentCount).toBe(3);
    expect(s.roundCount).toBe(5);
    expect(s.types.map((t) => [t.typeId, t.problemRate])).toEqual([
      ["odz", 1],
      ["lost_root", 0.5],
      ["percent_add", 0],
    ]);
    expect(s.types[0]).toMatchObject({ missed: 1, fullHints: 1, lifeLost: 0 });
    expect(s.blindSpots.map((t) => t.typeId)).toEqual(["odz", "lost_root"]);
    expect(s.students).toEqual([
      { nickname: "Барыс", rounds: 3, avgScore: 53, lastActive: "2026-10-02T10:00:00Z", weakTypes: ["odz", "lost_root"] },
      { nickname: "Тулпар", rounds: 2, avgScore: 70, lastActive: "2026-10-01T10:00:00Z", weakTypes: ["odz"] },
      { nickname: "Новичок", rounds: 0, avgScore: 0, lastActive: null, weakTypes: [] },
    ]);
  });

  it("counts a proved round without a named cause as a problem round", () => {
    const s = aggregateStats(
      [{ id: "a", nickname: "Барыс" }],
      [row("a", "odz"), row("a", "odz", { cause_ok: false, score: 60 }), row("a", "lin-ok-type", { cause_ok: null })],
    );
    const odz = s.types.find((t) => t.typeId === "odz")!;
    expect(odz).toMatchObject({ rounds: 2, problemRounds: 1, noCause: 1, missed: 0 });
    expect(s.types.find((t) => t.typeId === "lin-ok-type")!.problemRounds).toBe(0);
  });

  it("lists the latest rounds newest first with nicknames", () => {
    const s = aggregateStats(
      [
        { id: "a", nickname: "Барыс" },
        { id: "b", nickname: "Тулпар" },
      ],
      [
        row("a", "odz", { created_at: "2026-10-01T10:00:00Z" }),
        row("b", "lost_root", { outcome: "failed_proof", score: 0, lives_lost: 1, created_at: "2026-10-01T10:02:00Z" }),
        row("ghost", "odz", { created_at: "2026-10-01T10:05:00Z" }),
      ],
    );
    expect(s.recent).toEqual([
      { nickname: "Тулпар", typeId: "lost_root", outcome: "failed_proof", score: 0, at: "2026-10-01T10:02:00Z" },
      { nickname: "Барыс", typeId: "odz", outcome: "solved", score: 100, at: "2026-10-01T10:00:00Z" },
    ]);
  });

  it("handles an empty class", () => {
    expect(aggregateStats([], [])).toEqual({
      studentCount: 0,
      roundCount: 0,
      types: [],
      blindSpots: [],
      students: [],
      recent: [],
    });
  });
});

describe("demo class", () => {
  it("is deterministic, has 30 students and plausible problem rates", async () => {
    const { demoClassStats } = await import("../lib/demo");
    const a = demoClassStats();
    expect(demoClassStats()).toEqual(a);
    expect(a.studentCount).toBe(30);
    expect(new Set(a.students.map((s) => s.nickname)).size).toBe(30);
    expect(a.roundCount).toBeGreaterThan(150);
    expect(a.blindSpots).toHaveLength(3);
    for (const t of a.types) expect(t.problemRate).toBeGreaterThan(0.02);
    for (const t of a.types) expect(t.problemRate).toBeLessThan(0.9);
  });
});
