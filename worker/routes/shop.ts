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

type EvolutionStep = {
  from_character_id: string;
  id: string;
  name: string;
  image_url: string;
  rarity: string;
  type_primary: string;
  type_secondary: string | null;
  cost: number;
};
// Lines are at most a few steps long; the cap only guards against a bad cycle in data.
const MAX_CHAIN = 5;

// Every form a character can evolve into, in order, with the points each step costs.
async function evolutionChains(env: Env) {
  const result = await env.DB.prepare(
    `SELECT ep.from_character_id, c.id, c.name, c.image_url, c.rarity, c.type_primary, c.type_secondary, ep.point_cost AS cost
     FROM evolution_paths ep JOIN characters c ON c.id = ep.to_character_id
     WHERE c.is_active = 1`,
  ).all<EvolutionStep>();
  const next = new Map(result.results.map((step) => [step.from_character_id, step]));
  return (id: string) => {
    const chain: Omit<EvolutionStep, "from_character_id">[] = [];
    for (let step = next.get(id); step && chain.length < MAX_CHAIN; step = next.get(step.id)) {
      const { from_character_id: _from, ...form } = step;
      chain.push(form);
    }
    return chain;
  };
}

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
    const chainOf = await evolutionChains(env);

    return json({ characters: result.results.map((character) => ({ ...character, evolutions: chainOf(character.id) })) });
  }

  return null;
}
