import type { Env } from "../types";
import { error, json } from "../lib/http";
import { getSessionUser } from "../lib/session";
import { thaiDay } from "./quests";

export const GACHA_PRICE = 400;
export const GACHA_DAILY_LIMIT = 3;
// Relative weights. Rarities with nothing left for the child are skipped and
// the rest renormalized, so the odds shown always match what the spin uses.
export const GACHA_WEIGHTS: Record<string, number> = { COMMON: 55, RARE: 35, EPIC: 7, LEGENDARY: 3 };

type PoolCharacter = { id: string; name: string; image_url: string; rarity: string; type_primary: string; type_secondary: string | null };

// Shop characters (price > 0) the child doesn't currently own. Evolved forms stay evolution-only.
async function pool(env: Env, childId: string) {
  const result = await env.DB.prepare(
    `SELECT c.id, c.name, c.image_url, c.rarity, c.type_primary, c.type_secondary
     FROM characters c
     WHERE c.is_active = 1 AND c.price > 0
       AND NOT EXISTS (
         SELECT 1 FROM child_characters cc
         WHERE cc.child_id = ? AND cc.character_id = c.id AND cc.status = 'OWNED'
       )`,
  ).bind(childId).all<PoolCharacter>();
  return result.results;
}

function odds(characters: PoolCharacter[]) {
  const available = Object.keys(GACHA_WEIGHTS).filter((rarity) => characters.some((c) => c.rarity === rarity));
  const total = available.reduce((sum, rarity) => sum + GACHA_WEIGHTS[rarity], 0);
  return available.map((rarity) => ({
    rarity,
    weight: GACHA_WEIGHTS[rarity],
    percent: Math.round((GACHA_WEIGHTS[rarity] / total) * 1000) / 10,
    count: characters.filter((c) => c.rarity === rarity).length,
  }));
}

function randomBelow(max: number) {
  const values = new Uint32Array(1);
  crypto.getRandomValues(values);
  return (values[0] / 2 ** 32) * max;
}

function pick(characters: PoolCharacter[]) {
  const table = odds(characters);
  let roll = randomBelow(table.reduce((sum, row) => sum + row.weight, 0));
  const rarity = table.find((row) => (roll -= row.weight) < 0)?.rarity ?? table[table.length - 1].rarity;
  const candidates = characters.filter((c) => c.rarity === rarity);
  return candidates[Math.floor(randomBelow(candidates.length))];
}

async function spinsToday(env: Env, childId: string, day: string) {
  const row = await env.DB.prepare("SELECT count(*) AS n FROM gacha_spins WHERE child_id = ? AND day = ?")
    .bind(childId, day).first<{ n: number }>();
  return row?.n ?? 0;
}

export async function gachaRoutes(request: Request, env: Env, pathname: string) {
  const user = await getSessionUser(request, env);
  if (!user) return error(401, "UNAUTHENTICATED", "Please sign in.");
  if (user.role !== "CHILD") return error(403, "FORBIDDEN", "Child role required.");

  const child = await env.DB.prepare("SELECT id, points_balance FROM children WHERE user_id = ?")
    .bind(user.id).first<{ id: string; points_balance: number }>();
  if (!child) return error(404, "CHILD_NOT_FOUND", "Child profile not found.");
  const day = thaiDay();

  if (pathname === "/api/gacha" && request.method === "GET") {
    const characters = await pool(env, child.id);
    return json({
      price: GACHA_PRICE,
      daily_limit: GACHA_DAILY_LIMIT,
      spins_today: await spinsToday(env, child.id, day),
      pool_size: characters.length,
      odds: odds(characters).map(({ rarity, percent, count }) => ({ rarity, percent, count })),
    });
  }

  if (pathname === "/api/gacha/spin" && request.method === "POST") {
    if ((await spinsToday(env, child.id, day)) >= GACHA_DAILY_LIMIT) {
      return error(429, "DAILY_LIMIT", "วันนี้เปิดกล่องครบ " + GACHA_DAILY_LIMIT + " ครั้งแล้ว พรุ่งนี้มาใหม่นะ");
    }
    const characters = await pool(env, child.id);
    if (characters.length === 0) return error(409, "POOL_EMPTY", "สะสมตัวในร้านครบทุกตัวแล้ว เก่งมาก!");
    if (child.points_balance < GACHA_PRICE) return error(409, "INSUFFICIENT_POINTS", "คะแนนสะสมไม่พอ");

    const character = pick(characters);
    const spinId = crypto.randomUUID();
    const ownedId = crypto.randomUUID();
    try {
      await env.DB.batch([
        env.DB.prepare(
          `INSERT INTO point_transactions
             (id, child_id, created_by, transaction_type, points, reason, reference_type, reference_id)
           VALUES (?, ?, ?, 'PURCHASE', ?, ?, 'GACHA', ?)`,
        ).bind(crypto.randomUUID(), child.id, user.id, -GACHA_PRICE, "🎁 กล่องสุ่มได้ " + character.name, spinId),
        env.DB.prepare(
          `INSERT INTO child_characters (id, child_id, character_id, acquisition_type, status)
           VALUES (?, ?, ?, 'PURCHASE', 'OWNED')`,
        ).bind(ownedId, child.id, character.id),
        env.DB.prepare(
          `INSERT INTO gacha_spins (id, child_id, character_id, child_character_id, rarity, points_used, day)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
        ).bind(spinId, child.id, character.id, ownedId, character.rarity, GACHA_PRICE, day),
      ]);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      if (message.includes("INSUFFICIENT_POINTS")) return error(409, "INSUFFICIENT_POINTS", "คะแนนสะสมไม่พอ");
      // Another spin or purchase just took this character; nothing was charged.
      if (message.includes("UNIQUE constraint failed")) return error(409, "TRY_AGAIN", "ลองเปิดกล่องอีกครั้งนะ");
      throw cause;
    }

    return json({ character }, { status: 201 });
  }

  return null;
}
