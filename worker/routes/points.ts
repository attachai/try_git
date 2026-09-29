import { z } from "zod";
import type { Env } from "../types";
import { error, json, readJson } from "../lib/http";
import { getSessionUser } from "../lib/session";

const pointSchema = z.object({
  childId: z.string().min(1),
  amount: z.number().int().min(1).max(10000),
  reason: z.string().trim().min(2).max(240),
  type: z.enum(["EARN", "DEDUCT"]),
});

async function parentOwnsChild(env: Env, parentUserId: string, childId: string) {
  return env.DB.prepare(
    `SELECT c.id
     FROM children c
     JOIN family_members fm ON fm.family_id = c.family_id
     WHERE c.id = ? AND fm.user_id = ? AND fm.relation IN ('FATHER','MOTHER','GUARDIAN')`,
  ).bind(childId, parentUserId).first<{ id: string }>();
}

export async function pointsRoutes(request: Request, env: Env, pathname: string) {
  const user = await getSessionUser(request, env);
  if (!user) return error(401, "UNAUTHENTICATED", "Please sign in.");

  if (pathname === "/api/points" && request.method === "POST") {
    if (user.role !== "PARENT") return error(403, "FORBIDDEN", "Parent role required.");

    const parsed = pointSchema.safeParse(await readJson<unknown>(request));
    if (!parsed.success) return error(400, "INVALID_REQUEST", "Invalid point transaction.");

    const owned = await parentOwnsChild(env, user.id, parsed.data.childId);
    if (!owned) return error(404, "CHILD_NOT_FOUND", "Child not found in your family.");

    const signedPoints = parsed.data.type === "EARN" ? parsed.data.amount : -parsed.data.amount;
    const id = crypto.randomUUID();

    try {
      await env.DB.prepare(
        `INSERT INTO point_transactions
          (id, child_id, created_by, transaction_type, points, reason)
         VALUES (?, ?, ?, ?, ?, ?)`,
      ).bind(
        id,
        parsed.data.childId,
        user.id,
        parsed.data.type,
        signedPoints,
        parsed.data.reason,
      ).run();
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      if (message.includes("INSUFFICIENT_POINTS")) {
        return error(409, "INSUFFICIENT_POINTS", "คะแนนคงเหลือไม่พอสำหรับการหักคะแนนนี้");
      }
      throw cause;
    }

    const child = await env.DB.prepare(
      "SELECT id, display_name, points_balance FROM children WHERE id = ?",
    ).bind(parsed.data.childId).first();

    return json({ transaction: { id, points: signedPoints, reason: parsed.data.reason }, child }, { status: 201 });
  }

  const historyMatch = pathname.match(/^\/api\/children\/([^/]+)\/history$/);
  if (historyMatch && request.method === "GET") {
    const childId = decodeURIComponent(historyMatch[1]);

    if (user.role === "PARENT") {
      if (!(await parentOwnsChild(env, user.id, childId))) {
        return error(404, "CHILD_NOT_FOUND", "Child not found in your family.");
      }
    } else {
      const own = await env.DB.prepare("SELECT id FROM children WHERE id = ? AND user_id = ?")
        .bind(childId, user.id).first();
      if (!own) return error(403, "FORBIDDEN", "You may only view your own history.");
    }

    const result = await env.DB.prepare(
      `SELECT pt.id, pt.transaction_type, pt.points, pt.reason, pt.created_at,
              u.display_name AS created_by_name
       FROM point_transactions pt
       LEFT JOIN users u ON u.id = pt.created_by
       WHERE pt.child_id = ?
       ORDER BY pt.created_at DESC
       LIMIT 100`,
    ).bind(childId).all();

    return json({ history: result.results });
  }

  return null;
}
