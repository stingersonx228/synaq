import { getCase } from "@/lib/catalog";
import { clientIp, readBody } from "@/lib/http";
import { internWithLlm, llmEnabled } from "@/lib/llm";
import { takeLlmCall } from "@/lib/ratelimit";
import { InternBody } from "@/lib/schemas";
import type { Case } from "@/lib/types";

export async function POST(request: Request): Promise<Response> {
  const body = await readBody(request, InternBody);
  if (!body.ok) return body.response;
  const { caseId, stage, explanation, studentId } = body.data;
  const c = getCase(caseId) as Case;
  const fallback = c.bug!.defense[stage];

  try {
    if (llmEnabled() && (await takeLlmCall({ studentId: studentId ?? null, ip: clientIp(request) }))) {
      const reply = await internWithLlm(c, stage, explanation);
      if (reply) return Response.json({ reply, source: "llm" });
    }
  } catch {
    // Fall back to the scripted line.
  }
  return Response.json({ reply: fallback, source: "fallback" });
}
