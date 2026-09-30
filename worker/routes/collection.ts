import { z } from "zod";
import type { Env } from "../types";
import { error, json, readJson } from "../lib/http";
import { getSessionUser } from "../lib/session";

const characterActionSchema = z.object({
  characterId: z.string().min(1),
});

const evolveSchema = z.object({
  childCharacterId: z.string().min(1),
});

async function currentChild(env: Env, userId: string) {
  return env.DB.prepare(
    "SELECT id, display_name, points_balance FROM children WHERE user_id = ?",
  ).bind(userId).first<{ id: string; display_name: string; points_balance: number }>();
}

function dbError(cause: unknown) {
  const message = cause instanceof Error ? cause.message : String(cause);
  if (message.includes("INSUFFICIENT_POINTS")) {
    return error(409, "INSUFFICIENT_POINTS", "คะแนนสะสมไม่พอ");
  }
  if (message.includes("UNIQUE constraint failed")) {
    return error(409, "ALREADY_OWNED", "มีตัวละครนี้อยู่ใน Collection แล้ว");
  }
  throw cause;
}

export async function collectionRoutes(request: Request, env: Env, pathname: string) {
  const user = await getSessionUser(request, env);
  if (!user) return error(401, "UNAUTHENTICATED", "Please sign in.");
  if (user.role !== "CHILD") return error(403, "FORBIDDEN", "Child role required.");

  const child = await currentChild(env, user.id);
  if (!child) return error(404, "CHILD_NOT_FOUND", "Child profile not found.");

  if (pathname === "/api/collection" && request.method === "GET") {
    const result = await env.DB.prepare(
      `SELECT cc.id AS child_character_id, cc.acquired_at, cc.acquisition_type, cc.level, cc.xp,
              c.id AS character_id, c.name, c.slug, c.type_primary, c.type_secondary,
              c.image_url, c.rarity,
              ep.to_character_id, ep.point_cost AS evolution_cost,
              next.name AS evolution_name, next.image_url AS evolution_image_url
       FROM child_characters cc
       JOIN characters c ON c.id = cc.character_id
       LEFT JOIN evolution_paths ep ON ep.from_character_id = c.id
       LEFT JOIN characters next ON next.id = ep.to_character_id
       WHERE cc.child_id = ? AND cc.status = 'OWNED'
       ORDER BY cc.acquired_at DESC`,
    ).bind(child.id).all();

    return json({ child, collection: result.results });
  }

  if (pathname === "/api/shop/purchase" && request.method === "POST") {
    const parsed = characterActionSchema.safeParse(await readJson<unknown>(request));
    if (!parsed.success) return error(400, "INVALID_REQUEST", "Invalid character.");

    const character = await env.DB.prepare(
      "SELECT id, name, price FROM characters WHERE id = ? AND is_active = 1 AND price > 0",
    ).bind(parsed.data.characterId).first<{ id: string; name: string; price: number }>();

    if (!character) return error(404, "CHARACTER_NOT_FOUND", "Character is not available.");

    const ledgerId = crypto.randomUUID();
    const ownedId = crypto.randomUUID();
    const purchaseId = crypto.randomUUID();

    try {
      await env.DB.batch([
        env.DB.prepare(
          `INSERT INTO point_transactions
             (id, child_id, created_by, transaction_type, points, reason, reference_type, reference_id)
           VALUES (?, ?, ?, 'PURCHASE', ?, ?, 'CHARACTER', ?)`,
        ).bind(ledgerId, child.id, user.id, -character.price, `ซื้อ ${character.name}`, character.id),
        env.DB.prepare(
          `INSERT INTO child_characters
             (id, child_id, character_id, acquisition_type, status)
           VALUES (?, ?, ?, 'PURCHASE', 'OWNED')`,
        ).bind(ownedId, child.id, character.id),
        env.DB.prepare(
          `INSERT INTO purchase_transactions
             (id, child_id, character_id, points_used)
           VALUES (?, ?, ?, ?)`,
        ).bind(purchaseId, child.id, character.id, character.price),
      ]);
    } catch (cause) {
      return dbError(cause);
    }

    const refreshed = await currentChild(env, user.id);
    return json({ ok: true, child: refreshed, purchased: { id: character.id, name: character.name } }, { status: 201 });
  }

  if (pathname === "/api/collection/evolve" && request.method === "POST") {
    const parsed = evolveSchema.safeParse(await readJson<unknown>(request));
    if (!parsed.success) return error(400, "INVALID_REQUEST", "Invalid collection item.");

    const evolution = await env.DB.prepare(
      `SELECT cc.id AS child_character_id,
              cc.character_id AS from_character_id,
              source.name AS from_name,
              ep.to_character_id,
              target.name AS to_name,
              ep.point_cost
       FROM child_characters cc
       JOIN characters source ON source.id = cc.character_id
       JOIN evolution_paths ep ON ep.from_character_id = cc.character_id
       JOIN characters target ON target.id = ep.to_character_id
       WHERE cc.id = ? AND cc.child_id = ? AND cc.status = 'OWNED'`,
    ).bind(parsed.data.childCharacterId, child.id).first<{
      child_character_id: string;
      from_character_id: string;
      from_name: string;
      to_character_id: string;
      to_name: string;
      point_cost: number;
    }>();

    if (!evolution) return error(409, "EVOLUTION_NOT_AVAILABLE", "ตัวละครนี้ยังไม่มีเส้นทางวิวัฒนาการ");

    const ledgerId = crypto.randomUUID();
    const nextOwnedId = crypto.randomUUID();
    const evolutionId = crypto.randomUUID();

    try {
      await env.DB.batch([
        env.DB.prepare(
          `INSERT INTO point_transactions
             (id, child_id, created_by, transaction_type, points, reason, reference_type, reference_id)
           VALUES (?, ?, ?, 'EVOLUTION', ?, ?, 'EVOLUTION', ?)`,
        ).bind(
          ledgerId,
          child.id,
          user.id,
          -evolution.point_cost,
          `วิวัฒนาการ ${evolution.from_name} เป็น ${evolution.to_name}`,
          evolutionId,
        ),
        env.DB.prepare(
          "UPDATE child_characters SET status = 'EVOLVED', evolved_at = CURRENT_TIMESTAMP WHERE id = ? AND child_id = ? AND status = 'OWNED'",
        ).bind(evolution.child_character_id, child.id),
        // The new form keeps the arena level and XP of the one it evolved from.
        env.DB.prepare(
          `INSERT INTO child_characters
             (id, child_id, character_id, acquisition_type, evolved_from, status, level, xp)
           SELECT ?, ?, ?, 'EVOLUTION', id, 'OWNED', level, xp
           FROM child_characters WHERE id = ?`,
        ).bind(nextOwnedId, child.id, evolution.to_character_id, evolution.child_character_id),
        env.DB.prepare(
          `INSERT INTO evolution_transactions
             (id, child_id, from_child_character_id, to_child_character_id,
              from_character_id, to_character_id, points_used)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
        ).bind(
          evolutionId,
          child.id,
          evolution.child_character_id,
          nextOwnedId,
          evolution.from_character_id,
          evolution.to_character_id,
          evolution.point_cost,
        ),
      ]);
    } catch (cause) {
      return dbError(cause);
    }

    const refreshed = await currentChild(env, user.id);
    return json({
      ok: true,
      child: refreshed,
      evolution: { from: evolution.from_name, to: evolution.to_name, cost: evolution.point_cost },
    }, { status: 201 });
  }

  return null;
}
