// Small helpers shared by route handlers.
import type { z } from "zod";

export function jsonError(status: number, error: string): Response {
  return Response.json({ error }, { status });
}

const MAX_BODY_BYTES = 4096;

/** Parses and validates a small JSON body. Returns the data or a ready 4xx response. */
export async function readBody<T extends z.ZodType>(
  request: Request,
  schema: T,
): Promise<{ ok: true; data: z.infer<T> } | { ok: false; response: Response }> {
  const declared = Number(request.headers.get("content-length"));
  if (declared > MAX_BODY_BYTES) return { ok: false, response: jsonError(413, "body_too_large") };
  let raw: unknown;
  try {
    const text = await request.text();
    if (new TextEncoder().encode(text).length > MAX_BODY_BYTES) {
      return { ok: false, response: jsonError(413, "body_too_large") };
    }
    raw = JSON.parse(text);
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
