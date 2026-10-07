import { attemptFactsValid } from "@/lib/attempt";
import { getCase } from "@/lib/catalog";
import { clientIp, jsonError, readBody } from "@/lib/http";
import { allowRequest } from "@/lib/ratelimit";
import { AttemptBody } from "@/lib/schemas";
import { roundScore, stars } from "@/lib/scoring";
import { getSupabase, studentExists } from "@/lib/supabase";
import type { Case } from "@/lib/types";

const UNIQUE_VIOLATION = "23505";

export async function POST(request: Request): Promise<Response> {
  const body = await readBody(request, AttemptBody);
  if (!body.ok) return body.response;
  const a = body.data;
  const c = getCase(a.caseId) as Case;
  if (!attemptFactsValid(c, a)) return jsonError(400, "inconsistent_attempt");
  if (!allowRequest("attempt", clientIp(request))) return jsonError(429, "too_many_requests");
  const db = getSupabase();
  if (!db) return jsonError(503, "db_unavailable");

  // The score is recomputed from the round facts; the client never sends it.
  const score = roundScore({
    outcome: a.outcome,
    clean: c.bug === null,
    causeOk: a.causeOk,
    refuteTries: a.refuteTries,
    hintsUsed: a.hintsUsed,
  });

  try {
    if (!(await studentExists(db, a.studentId))) return jsonError(401, "unknown_student");
    const { error } = await db.from("attempts").insert({
      id: a.attemptId,
      student_id: a.studentId,
      case_id: c.id,
      type_id: c.type_id,
      outcome: a.outcome,
      score,
      stars: stars(score),
      hints_used: a.hintsUsed,
      cause_ok: a.causeOk,
      refute_tries: a.refuteTries,
      lives_lost: a.livesLost,
    });
    // A retry of a report that was already stored: the first write won, nothing to do.
    if (error && error.code !== UNIQUE_VIOLATION) throw new Error(error.code);
    return Response.json({ ok: true, score, stars: stars(score) });
  } catch {
    return jsonError(500, "E_ATTEMPT");
  }
}
