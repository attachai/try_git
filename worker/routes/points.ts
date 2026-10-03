import { z } from "zod";
import type { Env } from "../types";
import { error, json, readJson } from "../lib/http";
import { getSessionUser } from "../lib/session";
import { thaiDay } from "./quests";

const pointSchema = z.object({
  childId: z.string().min(1),
  amount: z.number().int().min(1).max(10000),
  reason: z.string().trim().min(2).max(240),
  type: z.enum(["EARN", "DEDUCT"]),
});

export const HISTORY_DEFAULT_DAYS = 7;
export const HISTORY_MAX_DAYS = 366;
export const HISTORY_ROWS = 500;
const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function addDays(day: string, delta: number) {
  const date = new Date(day + "T00:00:00Z");
  date.setUTCDate(date.getUTCDate() + delta);
  return date.toISOString().slice(0, 10);
}

// Thailand-time midnight of a day, as a UTC "YYYY-MM-DD HH:MM:SS" string comparable to created_at.
function thaiMidnightUtc(day: string) {
  return new Date(day + "T00:00:00+07:00").toISOString().replace("T", " ").slice(0, 19);
}

// Which Thailand-time days to show: ?days=N (the last N days including today),
// or ?from=YYYY-MM-DD&to=YYYY-MM-DD (inclusive). Defaults to the last 7 days.
function historyRange(url: URL): { from: string; to: string } | null {
  const today = thaiDay();
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  if (from || to) {
    if (!from || !to || !DAY_PATTERN.test(from) || !DAY_PATTERN.test(to) || Number.isNaN(Date.parse(from)) || Number.isNaN(Date.parse(to))) return null;
    if (from > to) return null;
    if (addDays(from, HISTORY_MAX_DAYS - 1) < to) return null;
    return { from, to };
  }
  const days = Number(url.searchParams.get("days") ?? HISTORY_DEFAULT_DAYS);
  if (!Number.isInteger(days) || days < 1 || days > HISTORY_MAX_DAYS) return null;
  return { from: addDays(today, -(days - 1)), to: today };
}

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

    const range = historyRange(new URL(request.url));
    if (!range) return error(400, "INVALID_RANGE", "เลือกช่วงวันไม่ถูกต้อง (ไม่เกิน 366 วัน)");
    const start = thaiMidnightUtc(range.from);
    const end = thaiMidnightUtc(addDays(range.to, 1));

    const [result, totals] = await Promise.all([
      env.DB.prepare(
        `SELECT pt.id, pt.transaction_type, pt.points, pt.reason, pt.created_at,
                u.display_name AS created_by_name
         FROM point_transactions pt
         LEFT JOIN users u ON u.id = pt.created_by
         WHERE pt.child_id = ? AND pt.created_at >= ? AND pt.created_at < ?
         ORDER BY pt.created_at DESC
         LIMIT ?`,
      ).bind(childId, start, end, HISTORY_ROWS + 1).all(),
      env.DB.prepare(
        `SELECT count(*) AS count,
                coalesce(sum(CASE WHEN points > 0 THEN points END), 0) AS earned,
                coalesce(-sum(CASE WHEN points < 0 THEN points END), 0) AS spent
         FROM point_transactions
         WHERE child_id = ? AND created_at >= ? AND created_at < ?`,
      ).bind(childId, start, end).first<{ count: number; earned: number; spent: number }>(),
    ]);

    return json({
      history: result.results.slice(0, HISTORY_ROWS),
      truncated: result.results.length > HISTORY_ROWS,
      range,
      summary: totals ?? { count: 0, earned: 0, spent: 0 },
    });
  }

  return null;
}
