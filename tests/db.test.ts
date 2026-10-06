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
}));

const { POST: join } = await import("../app/api/join/route");
const { POST: attempt } = await import("../app/api/attempt/route");
const { POST: createClass } = await import("../app/api/teacher/class/route");
const { GET: stats } = await import("../app/api/teacher/[token]/stats/route");

const post = (body: unknown) =>
  new Request("http://localhost/api", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

const validAttempt = {
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
    expect(inserted[0]).toMatchObject({ case_id: "pct-01", type_id: "percent_add", score: 100, stars: 3 });

    supabaseMock.db = { from: () => ({ insert: async () => ({ error: { code: "42P01", message: "secret detail" } }) }) };
    const failed = await attempt(post(validAttempt));
    expect(failed.status).toBe(500);
    expect(await failed.json()).toEqual({ error: "E_ATTEMPT" });
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
      { nickname: "Барыс", rounds: 3, avgScore: 53, lastActive: "2026-10-02T10:00:00Z" },
      { nickname: "Тулпар", rounds: 2, avgScore: 70, lastActive: "2026-10-01T10:00:00Z" },
      { nickname: "Новичок", rounds: 0, avgScore: 0, lastActive: null },
    ]);
  });

  it("handles an empty class", () => {
    expect(aggregateStats([], [])).toEqual({ studentCount: 0, roundCount: 0, types: [], blindSpots: [], students: [] });
  });
});
