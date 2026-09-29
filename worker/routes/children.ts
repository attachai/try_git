import type { Env } from "../types";
import { error, json } from "../lib/http";
import { getSessionUser } from "../lib/session";

export async function childrenRoutes(request: Request, env: Env, pathname: string) {
  const user = await getSessionUser(request, env);
  if (!user) return error(401, "UNAUTHENTICATED", "Please sign in.");

  if (pathname === "/api/children" && request.method === "GET") {
    if (user.role !== "PARENT") return error(403, "FORBIDDEN", "Parent role required.");

    const result = await env.DB.prepare(
      `SELECT c.id, c.display_name, c.avatar_url, c.points_balance
       FROM children c
       JOIN family_members child_member ON child_member.family_id = c.family_id
       JOIN family_members parent_member ON parent_member.family_id = child_member.family_id
       WHERE parent_member.user_id = ? AND child_member.user_id = c.user_id
       ORDER BY c.created_at ASC`,
    ).bind(user.id).all();

    return json({ children: result.results });
  }

  if (pathname === "/api/child/me" && request.method === "GET") {
    if (user.role !== "CHILD") return error(403, "FORBIDDEN", "Child role required.");
    const child = await env.DB.prepare(
      "SELECT id, display_name, avatar_url, points_balance FROM children WHERE user_id = ?",
    ).bind(user.id).first();
    return child ? json({ child }) : error(404, "CHILD_NOT_FOUND", "Child profile not found.");
  }

  return null;
}
