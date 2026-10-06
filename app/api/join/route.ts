import { jsonError, readBody } from "@/lib/http";
import { JoinBody } from "@/lib/schemas";
import { getSupabase } from "@/lib/supabase";

export async function POST(request: Request): Promise<Response> {
  const body = await readBody(request, JoinBody);
  if (!body.ok) return body.response;
  const db = getSupabase();
  if (!db) return jsonError(503, "db_unavailable");
  const { code, nickname } = body.data;

  try {
    const { data: cls, error } = await db.from("classes").select("id, name").eq("code", code).maybeSingle();
    if (error) throw new Error(error.code);
    if (!cls) return jsonError(404, "class_not_found");

    const find = () => db.from("students").select("id").eq("class_id", cls.id).eq("nickname", nickname).maybeSingle();
    const existing = await find();
    if (existing.error) throw new Error(existing.error.code);
    let studentId: string | null = existing.data?.id ?? null;

    if (!studentId) {
      const created = await db.from("students").insert({ class_id: cls.id, nickname }).select("id").single();
      if (created.error?.code === "23505") {
        // Another device joined with the same nickname at the same moment.
        studentId = (await find()).data?.id ?? null;
      } else if (created.error) {
        throw new Error(created.error.code);
      } else {
        studentId = created.data.id;
      }
    }
    if (!studentId) throw new Error("student not created");
    return Response.json({ studentId, nickname, className: cls.name });
  } catch {
    return jsonError(500, "E_JOIN");
  }
}
