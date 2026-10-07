import { getCase, keywordJudge } from "@/lib/catalog";
import { clientIp, jsonError, readBody } from "@/lib/http";
import { getCachedVerdict, judgeCacheKey, setCachedVerdict } from "@/lib/judge-cache";
import { judgeWithLlm, llmEnabled } from "@/lib/llm";
import { takeLlmCall } from "@/lib/ratelimit";
import { JudgeBody } from "@/lib/schemas";
import { resolveOptionalStudent } from "@/lib/supabase";
import type { Case } from "@/lib/types";

type Source = "llm" | "cache" | "fallback";

export async function POST(request: Request): Promise<Response> {
  const body = await readBody(request, JudgeBody);
  if (!body.ok) return body.response;
  const { caseId, explanation } = body.data;
  const c = getCase(caseId) as Case;
  const reply = (verdict: boolean, source: Source) => Response.json({ verdict, source });

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
  return reply(keywordJudge(c, explanation), "fallback");
}
