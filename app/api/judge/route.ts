import { getCase, keywordJudge } from "@/lib/catalog";
import { clientIp, jsonError, readBody } from "@/lib/http";
import { getCachedVerdict, judgeCacheKey, setCachedVerdict } from "@/lib/judge-cache";
import { judgeWithLlm, llmEnabled } from "@/lib/llm";
import { takeLlmCall } from "@/lib/ratelimit";
import { JudgeBody } from "@/lib/schemas";
import { resolveOptionalStudent } from "@/lib/supabase";
import type { Case } from "@/lib/types";

type Source = "llm" | "cache" | "keywords" | "fallback";

export async function POST(request: Request): Promise<Response> {
  const body = await readBody(request, JudgeBody);
  if (!body.ok) return body.response;
  const { caseId, explanation } = body.data;
  const c = getCase(caseId) as Case;
  const keywords = keywordJudge(c, explanation);
  // The cause only earns bonus points, so a false rejection hurts more than a lenient
  // acceptance: the keyword roots can rescue a verdict the model refused. The cache keeps
  // the model's raw verdict, so this also applies to answers cached before.
  const reply = (llmVerdict: boolean, source: Source) =>
    Response.json(
      !llmVerdict && keywords ? { verdict: true, source: "keywords" } : { verdict: llmVerdict, source },
    );

  const student = await resolveOptionalStudent(body.data.studentId);
  if (!student.ok) return jsonError(401, "unknown_student");

  try {
    const key = judgeCacheKey(caseId, c.bug!.cause, explanation);
    const cached = await getCachedVerdict(key).catch(() => null);
    if (cached !== null) return reply(cached, "cache");

    if (llmEnabled() && (await takeLlmCall({ studentId: student.studentId, ip: clientIp(request) }))) {
      const verdict = await judgeWithLlm(c, explanation);
      if (verdict !== null) {
        await setCachedVerdict(key, verdict).catch(() => undefined);
        return reply(verdict, "llm");
      }
    }
  } catch {
    // Any failure degrades to the deterministic keyword check below.
  }
  return Response.json({ verdict: keywords, source: "fallback" });
}
