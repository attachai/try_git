import { z } from "zod";
import type { Env } from "../types";
import { error, json, readJson } from "../lib/http";
import { getSessionUser } from "../lib/session";

// A set is every active character with the same primary type, plus "ALL" for the whole Pokédex.
export const SET_BONUS_PER_CHARACTER = 30;
export const ALL_SET = "ALL";
export const ALL_SET_BONUS = 1000;

const claimSchema = z.object({ set: z.string().min(1).max(40) });

type Entry = {
  id: string;
  external_id: string | null;
  name: string;
  image_url: string;
  rarity: string;
  type_primary: string;
  type_secondary: string | null;
  price: number;
  evolves_from: string | null;
  registered: number;
};

// Registered = the child has ever had it, including forms they've since evolved.
async function entries(env: Env, childId: string) {
  const result = await env.DB.prepare(
    `SELECT c.id, c.external_id, c.name, c.image_url, c.rarity, c.type_primary, c.type_secondary, c.price,
            (SELECT src.name FROM evolution_paths ep JOIN characters src ON src.id = ep.from_character_id
             WHERE ep.to_character_id = c.id LIMIT 1) AS evolves_from,
            EXISTS (SELECT 1 FROM child_characters cc WHERE cc.child_id = ? AND cc.character_id = c.id) AS registered
     FROM characters c
     WHERE c.is_active = 1
     ORDER BY CAST(c.external_id AS INTEGER) ASC, c.name ASC`,
  ).bind(childId).all<Entry>();
  return result.results;
}

function sets(list: Entry[], claimed: Set<string>) {
  const types = [...new Set(list.map((entry) => entry.type_primary))];
  const typeSets = types.map((type) => {
    const members = list.filter((entry) => entry.type_primary === type);
    return {
      set: type,
      total: members.length,
      registered: members.filter((entry) => entry.registered).length,
      bonus: members.length * SET_BONUS_PER_CHARACTER,
      claimed: claimed.has(type),
    };
  }).sort((a, b) => b.registered / b.total - a.registered / a.total || a.total - b.total);

  return [
    ...typeSets,
    {
      set: ALL_SET,
      total: list.length,
      registered: list.filter((entry) => entry.registered).length,
      bonus: ALL_SET_BONUS,
      claimed: claimed.has(ALL_SET),
    },
  ];
}

async function claimedSets(env: Env, childId: string) {
  const rows = await env.DB.prepare(
    "SELECT reference_id FROM point_transactions WHERE child_id = ? AND reference_type = 'DEX_SET'",
  ).bind(childId).all<{ reference_id: string }>();
  const prefix = childId + ":";
  return new Set(rows.results.map((row) => row.reference_id.slice(prefix.length)));
}

export async function pokedexRoutes(request: Request, env: Env, pathname: string) {
  const user = await getSessionUser(request, env);
  if (!user) return error(401, "UNAUTHENTICATED", "Please sign in.");
  if (user.role !== "CHILD") return error(403, "FORBIDDEN", "Child role required.");

  const child = await env.DB.prepare("SELECT id FROM children WHERE user_id = ?").bind(user.id).first<{ id: string }>();
  if (!child) return error(404, "CHILD_NOT_FOUND", "Child profile not found.");

  if (pathname === "/api/pokedex" && request.method === "GET") {
    const list = await entries(env, child.id);
    return json({
      total: list.length,
      registered: list.filter((entry) => entry.registered).length,
      entries: list,
      sets: sets(list, await claimedSets(env, child.id)),
    });
  }

  if (pathname === "/api/pokedex/claim" && request.method === "POST") {
    const parsed = claimSchema.safeParse(await readJson<unknown>(request));
    if (!parsed.success) return error(400, "INVALID_REQUEST", "Invalid set.");

    const target = sets(await entries(env, child.id), new Set()).find((row) => row.set === parsed.data.set);
    if (!target) return error(404, "SET_NOT_FOUND", "Set not found.");
    if (target.registered < target.total) return error(409, "SET_INCOMPLETE", "ยังสะสมชุดนี้ไม่ครบ");

    const label = target.set === ALL_SET ? "ครบทุกตัว" : "ครบชุดธาตุ " + target.set;
    try {
      await env.DB.prepare(
        `INSERT INTO point_transactions
           (id, child_id, created_by, transaction_type, points, reason, reference_type, reference_id)
         VALUES (?, ?, ?, 'EARN', ?, ?, 'DEX_SET', ?)`,
      ).bind(crypto.randomUUID(), child.id, user.id, target.bonus, "📖 สมุดสะสม" + label, child.id + ":" + target.set).run();
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      if (message.includes("UNIQUE constraint failed")) return error(409, "ALREADY_CLAIMED", "รับรางวัลชุดนี้ไปแล้ว");
      throw cause;
    }

    return json({ set: target.set, bonus: target.bonus }, { status: 201 });
  }

  return null;
}
