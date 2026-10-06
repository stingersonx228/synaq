import { getCase } from "@/lib/catalog";
import { jsonError, readBody } from "@/lib/http";
import { AttemptBody } from "@/lib/schemas";
import { roundScore, stars } from "@/lib/scoring";
import { getSupabase, studentExists } from "@/lib/supabase";
import type { Case } from "@/lib/types";

export async function POST(request: Request): Promise<Response> {
  const body = await readBody(request, AttemptBody);
  if (!body.ok) return body.response;
  const db = getSupabase();
  if (!db) return jsonError(503, "db_unavailable");
  const a = body.data;
  const c = getCase(a.caseId) as Case;

  try {
    if (!(await studentExists(db, a.studentId))) return jsonError(401, "unknown_student");
    // The score is recomputed from the round facts; the client never sends it.
    const score = roundScore({
      outcome: a.outcome,
      clean: c.bug === null,
      causeOk: a.causeOk,
      refuteTries: a.refuteTries,
      hintsUsed: a.hintsUsed,
    });
    const { error } = await db.from("attempts").insert({
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
    if (error) throw new Error(error.code);
    return Response.json({ ok: true, score, stars: stars(score) });
  } catch {
    return jsonError(500, "E_ATTEMPT");
  }
}
