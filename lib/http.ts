// Small helpers shared by route handlers.
import type { z } from "zod";

export function jsonError(status: number, error: string): Response {
  return Response.json({ error }, { status });
}

/** Parses and validates a JSON body. Returns the data or a ready 400 response. */
export async function readBody<T extends z.ZodType>(
  request: Request,
  schema: T,
): Promise<{ ok: true; data: z.infer<T> } | { ok: false; response: Response }> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return { ok: false, response: jsonError(400, "invalid_json") };
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return { ok: false, response: jsonError(400, "invalid_input") };
  return { ok: true, data: parsed.data };
}

export function clientIp(request: Request): string {
  const fwd = request.headers.get("x-forwarded-for");
  return fwd?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
}

/** Collapses whitespace and trims; used before length checks and cache keys. */
export function normalizeExplanation(text: string): string {
  return text.trim().replace(/\s+/g, " ");
}
