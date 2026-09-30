import { authRoutes } from "./routes/auth";
import { childrenRoutes } from "./routes/children";
import { pointsRoutes } from "./routes/points";
import { shopRoutes } from "./routes/shop";
import { collectionRoutes } from "./routes/collection";
import { questRoutes } from "./routes/quests";
import { gachaRoutes } from "./routes/gacha";
import { pokedexRoutes } from "./routes/pokedex";
import { arenaRoutes } from "./routes/arena";
import type { Env } from "./types";
import { error, json } from "./lib/http";
import { isTrustedMutation, withSecurityHeaders } from "./lib/security";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (!isTrustedMutation(request)) {
      return withSecurityHeaders(error(403, "UNTRUSTED_ORIGIN", "Cross-site mutation rejected."));
    }

    let response: Response;

    if (url.pathname === "/api/health") {
      const row = await env.DB.prepare("SELECT 1 AS ok").first<{ ok: number }>();
      response = json({ ok: row?.ok === 1, service: "family-reward-game" });
    } else if (url.pathname.startsWith("/api/auth/")) {
      response = (await authRoutes(request, env, url.pathname)) ?? error(404, "NOT_FOUND", "Not found.");
    } else if (url.pathname === "/api/children" || url.pathname === "/api/child/me" || url.pathname === "/api/families" ||
      url.pathname === "/api/parents" || url.pathname === "/api/children/avatar" || url.pathname === "/api/families/update" ||
      url.pathname === "/api/families/leave" || url.pathname === "/api/members/rename") {
      response = (await childrenRoutes(request, env, url.pathname)) ?? error(404, "NOT_FOUND", "Not found.");
    } else if (url.pathname === "/api/points" || /^\/api\/children\/[^/]+\/history$/.test(url.pathname)) {
      response = (await pointsRoutes(request, env, url.pathname)) ?? error(404, "NOT_FOUND", "Not found.");
    } else if (url.pathname === "/api/quests" || url.pathname.startsWith("/api/quests/")) {
      response = (await questRoutes(request, env, url.pathname)) ?? error(404, "NOT_FOUND", "Not found.");
    } else if (url.pathname === "/api/gacha" || url.pathname === "/api/gacha/spin") {
      response = (await gachaRoutes(request, env, url.pathname)) ?? error(404, "NOT_FOUND", "Not found.");
    } else if (url.pathname === "/api/pokedex" || url.pathname === "/api/pokedex/claim") {
      response = (await pokedexRoutes(request, env, url.pathname)) ?? error(404, "NOT_FOUND", "Not found.");
    } else if (url.pathname.startsWith("/api/arena/")) {
      response = (await arenaRoutes(request, env, url.pathname)) ?? error(404, "NOT_FOUND", "Not found.");
    } else if (url.pathname === "/api/shop" || url.pathname === "/api/characters") {
      response = (await shopRoutes(request, env, url.pathname)) ?? error(404, "NOT_FOUND", "Not found.");
    } else if (
      url.pathname === "/api/collection" ||
      url.pathname === "/api/shop/purchase" ||
      url.pathname === "/api/collection/evolve"
    ) {
      response = (await collectionRoutes(request, env, url.pathname)) ?? error(404, "NOT_FOUND", "Not found.");
    } else {
      response = error(404, "NOT_FOUND", "Not found.");
    }

    return withSecurityHeaders(response);
  },
} satisfies ExportedHandler<Env>;
