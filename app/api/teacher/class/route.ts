import { clientIp, jsonError, readBody } from "@/lib/http";
import { allowRequest } from "@/lib/ratelimit";
import { CreateClassBody } from "@/lib/schemas";
import { getSupabase } from "@/lib/supabase";
import { createClass } from "@/lib/teacher";

export async function POST(request: Request): Promise<Response> {
  const body = await readBody(request, CreateClassBody);
  if (!body.ok) return body.response;
  if (!allowRequest("createClass", clientIp(request))) return jsonError(429, "too_many_requests");
  const db = getSupabase();
  if (!db) return jsonError(503, "db_unavailable");
  try {
    const { code, token } = await createClass(db, body.data.name);
    return Response.json({ code, token, name: body.data.name }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return jsonError(500, "E_CLASS");
  }
}
