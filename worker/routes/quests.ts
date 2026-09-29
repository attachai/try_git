import { z } from "zod";
import type { Env } from "../types";
import { error, json, readJson } from "../lib/http";
import { getSessionUser, type SessionUser } from "../lib/session";

// Streak length (in days) → bonus points, paid once when the streak reaches it.
export const STREAK_BONUSES: Record<number, number> = { 3: 20, 7: 50, 14: 100, 30: 200 };
const THAILAND_OFFSET_MS = 7 * 60 * 60 * 1000;

const createQuestSchema = z.object({
  childId: z.string().min(1),
  forAllChildren: z.boolean(),
  title: z.string().trim().min(2).max(80),
  points: z.number().int().min(5).max(500),
});
const questIdSchema = z.object({ questId: z.string().min(1) });
const completeSchema = z.object({ questId: z.string().min(1), childId: z.string().min(1).optional() });
const reviewSchema = z.object({ completionId: z.string().min(1), approve: z.boolean() });

type Completion = {
  id: string;
  quest_id: string;
  child_id: string;
  day: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  title: string;
  points: number;
};

export function thaiDay(now = Date.now()) {
  return new Date(now + THAILAND_OFFSET_MS).toISOString().slice(0, 10);
}

function addDays(day: string, delta: number) {
  const date = new Date(day + "T00:00:00Z");
  date.setUTCDate(date.getUTCDate() + delta);
  return date.toISOString().slice(0, 10);
}

function runEndingAt(days: Set<string>, end: string) {
  let count = 0;
  for (let day = end; days.has(day); day = addDays(day, -1)) count += 1;
  return count;
}

async function approvedDays(env: Env, childId: string) {
  const rows = await env.DB.prepare(
    "SELECT DISTINCT day FROM quest_completions WHERE child_id = ? AND status = 'APPROVED' ORDER BY day DESC LIMIT 400",
  ).bind(childId).all<{ day: string }>();
  return new Set(rows.results.map((row) => row.day));
}

async function streakInfo(env: Env, childId: string, today: string) {
  const days = await approvedDays(env, childId);
  const todayDone = days.has(today);
  // A streak stays alive through today until the day ends without a quest.
  const current = todayDone ? runEndingAt(days, today) : runEndingAt(days, addDays(today, -1));
  const next = Object.keys(STREAK_BONUSES).map(Number).find((milestone) => milestone > current) ?? null;
  return {
    current,
    today_done: todayDone,
    next_milestone: next,
    next_bonus: next ? STREAK_BONUSES[next] : null,
  };
}

async function parentChild(env: Env, parentUserId: string, childId: string) {
  return env.DB.prepare(
    `SELECT c.id, c.family_id
     FROM children c
     JOIN family_members fm ON fm.family_id = c.family_id
     WHERE c.id = ? AND fm.user_id = ? AND fm.relation IN ('FATHER','MOTHER','GUARDIAN')`,
  ).bind(childId, parentUserId).first<{ id: string; family_id: string }>();
}

async function ownChild(env: Env, userId: string) {
  return env.DB.prepare("SELECT id, family_id FROM children WHERE user_id = ?")
    .bind(userId).first<{ id: string; family_id: string }>();
}

// Resolves which child a request is about: the signed-in child, or a child of the signed-in parent.
async function targetChild(env: Env, user: SessionUser, childId: string | null | undefined) {
  if (user.role === "CHILD") return ownChild(env, user.id);
  return childId ? parentChild(env, user.id, childId) : null;
}

async function questForChild(env: Env, questId: string, child: { id: string; family_id: string }) {
  return env.DB.prepare(
    `SELECT id, title, points FROM quests
     WHERE id = ? AND family_id = ? AND is_active = 1 AND (child_id IS NULL OR child_id = ?)`,
  ).bind(questId, child.family_id, child.id).first<{ id: string; title: string; points: number }>();
}

async function approve(env: Env, completion: Completion, reviewerId: string) {
  try {
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO point_transactions
           (id, child_id, created_by, transaction_type, points, reason, reference_type, reference_id)
         VALUES (?, ?, ?, 'EARN', ?, ?, 'QUEST', ?)`,
      ).bind(crypto.randomUUID(), completion.child_id, reviewerId, completion.points, "ภารกิจ: " + completion.title, completion.id),
      env.DB.prepare(
        "UPDATE quest_completions SET status = 'APPROVED', reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP WHERE id = ?",
      ).bind(reviewerId, completion.id),
    ]);
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    if (message.includes("UNIQUE constraint failed")) return { alreadyApproved: true as const };
    throw cause;
  }

  const run = runEndingAt(await approvedDays(env, completion.child_id), completion.day);
  const bonus = STREAK_BONUSES[run];
  if (!bonus) return { streakBonus: null };
  try {
    await env.DB.prepare(
      `INSERT INTO point_transactions
         (id, child_id, created_by, transaction_type, points, reason, reference_type, reference_id)
       VALUES (?, ?, ?, 'EARN', ?, ?, 'STREAK', ?)`,
    ).bind(
      crypto.randomUUID(), completion.child_id, reviewerId, bonus,
      "🔥 ทำภารกิจต่อเนื่อง " + run + " วัน", completion.child_id + ":" + completion.day,
    ).run();
  } catch (cause) {
    // The bonus for this day was already paid.
    const message = cause instanceof Error ? cause.message : String(cause);
    if (message.includes("UNIQUE constraint failed")) return { streakBonus: null };
    throw cause;
  }
  return { streakBonus: { days: run, points: bonus } };
}

async function loadCompletion(env: Env, where: string, ...binds: unknown[]) {
  return env.DB.prepare(
    `SELECT qc.id, qc.quest_id, qc.child_id, qc.day, qc.status, q.title, q.points
     FROM quest_completions qc
     JOIN quests q ON q.id = qc.quest_id
     WHERE ${where}`,
  ).bind(...binds).first<Completion>();
}

export async function questRoutes(request: Request, env: Env, pathname: string) {
  const user = await getSessionUser(request, env);
  if (!user) return error(401, "UNAUTHENTICATED", "Please sign in.");
  const url = new URL(request.url);
  const today = thaiDay();

  if (pathname === "/api/quests" && request.method === "GET") {
    const child = await targetChild(env, user, url.searchParams.get("childId"));
    if (!child) return error(404, "CHILD_NOT_FOUND", "Child not found.");

    const quests = await env.DB.prepare(
      `SELECT q.id, q.title, q.points, q.child_id, qc.id AS completion_id, qc.status
       FROM quests q
       LEFT JOIN quest_completions qc ON qc.quest_id = q.id AND qc.child_id = ? AND qc.day = ?
       WHERE q.family_id = ? AND q.is_active = 1 AND (q.child_id IS NULL OR q.child_id = ?)
       ORDER BY q.created_at ASC`,
    ).bind(child.id, today, child.family_id, child.id).all();

    return json({ day: today, quests: quests.results, streak: await streakInfo(env, child.id, today) });
  }

  if (pathname === "/api/quests/pending" && request.method === "GET") {
    if (user.role !== "PARENT") return error(403, "FORBIDDEN", "Parent role required.");
    const pending = await env.DB.prepare(
      `SELECT qc.id, qc.day, qc.child_id, c.display_name AS child_name, q.title, q.points
       FROM quest_completions qc
       JOIN quests q ON q.id = qc.quest_id
       JOIN children c ON c.id = qc.child_id
       WHERE qc.status = 'PENDING' AND c.family_id IN (
         SELECT family_id FROM family_members
         WHERE user_id = ? AND relation IN ('FATHER','MOTHER','GUARDIAN')
       )
       ORDER BY qc.created_at ASC`,
    ).bind(user.id).all();
    return json({ pending: pending.results });
  }

  if (pathname === "/api/quests" && request.method === "POST") {
    if (user.role !== "PARENT") return error(403, "FORBIDDEN", "Parent role required.");
    const parsed = createQuestSchema.safeParse(await readJson<unknown>(request));
    if (!parsed.success) return error(400, "INVALID_REQUEST", "ชื่อภารกิจ 2-80 ตัวอักษร และคะแนน 5-500");
    const child = await parentChild(env, user.id, parsed.data.childId);
    if (!child) return error(404, "CHILD_NOT_FOUND", "Child not found in your family.");

    const id = crypto.randomUUID();
    await env.DB.prepare(
      "INSERT INTO quests (id, family_id, child_id, title, points, created_by) VALUES (?, ?, ?, ?, ?, ?)",
    ).bind(id, child.family_id, parsed.data.forAllChildren ? null : child.id, parsed.data.title, parsed.data.points, user.id).run();
    return json({ quest: { id, title: parsed.data.title, points: parsed.data.points } }, { status: 201 });
  }

  if (pathname === "/api/quests/archive" && request.method === "POST") {
    if (user.role !== "PARENT") return error(403, "FORBIDDEN", "Parent role required.");
    const parsed = questIdSchema.safeParse(await readJson<unknown>(request));
    if (!parsed.success) return error(400, "INVALID_REQUEST", "Invalid quest.");
    const result = await env.DB.prepare(
      `UPDATE quests SET is_active = 0
       WHERE id = ? AND family_id IN (
         SELECT family_id FROM family_members
         WHERE user_id = ? AND relation IN ('FATHER','MOTHER','GUARDIAN')
       )`,
    ).bind(parsed.data.questId, user.id).run();
    if (!result.meta.changes) return error(404, "QUEST_NOT_FOUND", "Quest not found.");
    return json({ ok: true });
  }

  if (pathname === "/api/quests/complete" && request.method === "POST") {
    const parsed = completeSchema.safeParse(await readJson<unknown>(request));
    if (!parsed.success) return error(400, "INVALID_REQUEST", "Invalid quest.");
    const child = await targetChild(env, user, parsed.data.childId);
    if (!child) return error(404, "CHILD_NOT_FOUND", "Child not found.");
    const quest = await questForChild(env, parsed.data.questId, child);
    if (!quest) return error(404, "QUEST_NOT_FOUND", "Quest not found.");

    let completion = await loadCompletion(env, "qc.quest_id = ? AND qc.child_id = ? AND qc.day = ?", quest.id, child.id, today);
    if (completion?.status === "APPROVED") return error(409, "ALREADY_DONE", "ภารกิจนี้ทำเสร็จแล้ววันนี้");
    if (completion?.status === "PENDING" && user.role === "CHILD") {
      return error(409, "ALREADY_SUBMITTED", "ส่งแล้ว รอพ่อแม่ยืนยัน");
    }

    if (!completion) {
      const id = crypto.randomUUID();
      await env.DB.prepare(
        "INSERT INTO quest_completions (id, quest_id, child_id, day, status, submitted_by) VALUES (?, ?, ?, ?, 'PENDING', ?)",
      ).bind(id, quest.id, child.id, today, user.id).run();
      completion = { id, quest_id: quest.id, child_id: child.id, day: today, status: "PENDING", title: quest.title, points: quest.points };
    } else if (completion.status === "REJECTED") {
      await env.DB.prepare(
        "UPDATE quest_completions SET status = 'PENDING', submitted_by = ?, reviewed_by = NULL, reviewed_at = NULL WHERE id = ?",
      ).bind(user.id, completion.id).run();
    }

    if (user.role === "CHILD") return json({ status: "PENDING" }, { status: 201 });

    // A parent marking a quest done approves it right away.
    const result = await approve(env, completion, user.id);
    if ("alreadyApproved" in result) return error(409, "ALREADY_DONE", "ภารกิจนี้ทำเสร็จแล้ววันนี้");
    return json({ status: "APPROVED", streakBonus: result.streakBonus }, { status: 201 });
  }

  if (pathname === "/api/quests/review" && request.method === "POST") {
    if (user.role !== "PARENT") return error(403, "FORBIDDEN", "Parent role required.");
    const parsed = reviewSchema.safeParse(await readJson<unknown>(request));
    if (!parsed.success) return error(400, "INVALID_REQUEST", "Invalid review.");

    const completion = await loadCompletion(env, "qc.id = ?", parsed.data.completionId);
    if (!completion || !(await parentChild(env, user.id, completion.child_id))) {
      return error(404, "COMPLETION_NOT_FOUND", "Quest completion not found.");
    }
    if (completion.status !== "PENDING") return error(409, "ALREADY_REVIEWED", "รายการนี้ตรวจแล้ว");

    if (!parsed.data.approve) {
      await env.DB.prepare(
        "UPDATE quest_completions SET status = 'REJECTED', reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'PENDING'",
      ).bind(user.id, completion.id).run();
      return json({ status: "REJECTED" });
    }

    const result = await approve(env, completion, user.id);
    if ("alreadyApproved" in result) return error(409, "ALREADY_REVIEWED", "รายการนี้ตรวจแล้ว");
    return json({ status: "APPROVED", streakBonus: result.streakBonus });
  }

  return null;
}
