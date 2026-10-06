import { jsonError } from "@/lib/http";
import { getSupabase } from "@/lib/supabase";
import { loadClassDashboard } from "@/lib/teacher";

export async function GET(_request: Request, ctx: RouteContext<"/api/teacher/[token]/stats">): Promise<Response> {
  const { token } = await ctx.params;
  const db = getSupabase();
  if (!db) return jsonError(503, "db_unavailable");
  try {
    const dashboard = await loadClassDashboard(db, token);
    if (!dashboard) return jsonError(404, "class_not_found");
    return Response.json(dashboard, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return jsonError(500, "E_STATS");
  }
}
