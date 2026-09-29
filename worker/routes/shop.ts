import type { Env } from "../types";
import { error, json } from "../lib/http";
import { getSessionUser } from "../lib/session";

type ShopCharacter = {
  id: string;
  name: string;
  slug: string;
  type_primary: string;
  type_secondary: string | null;
  image_url: string;
  price: number;
  rarity: string;
};

export async function shopRoutes(request: Request, env: Env, pathname: string) {
  const user = await getSessionUser(request, env);
  if (!user) return error(401, "UNAUTHENTICATED", "Please sign in.");

  if ((pathname === "/api/shop" || pathname === "/api/characters") && request.method === "GET") {
    const result = await env.DB.prepare(
      `SELECT c.id, c.name, c.slug, c.type_primary, c.type_secondary, c.image_url, c.price, c.rarity,
              CASE WHEN cc.id IS NULL THEN 0 ELSE 1 END AS owned
       FROM characters c
       LEFT JOIN children child ON child.user_id = ?
       LEFT JOIN child_characters cc
         ON cc.child_id = child.id
        AND cc.character_id = c.id
        AND cc.status = 'OWNED'
       WHERE c.is_active = 1
         AND c.price > 0
       ORDER BY c.price ASC, c.name ASC`,
    ).bind(user.id).all<ShopCharacter & { owned: number }>();

    return json({ characters: result.results });
  }

  return null;
}
