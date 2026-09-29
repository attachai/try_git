import { authRoutes } from "./routes/auth";
import { childrenRoutes } from "./routes/children";
import { pointsRoutes } from "./routes/points";
import type { Env } from "./types";
import { error, json } from "./lib/http";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/api/health") {
      const row = await env.DB.prepare("SELECT 1 AS ok").first<{ ok: number }>();
      return json({ ok: row?.ok === 1, service: "family-reward-game" });
    }

    if (url.pathname.startsWith("/api/auth/")) {
      return (await authRoutes(request, env, url.pathname)) ?? error(404, "NOT_FOUND", "Not found.");
    }

    if (url.pathname === "/api/children" || url.pathname === "/api/child/me") {
      return (await childrenRoutes(request, env, url.pathname)) ?? error(404, "NOT_FOUND", "Not found.");
    }

    if (url.pathname === "/api/points" || url.pathname.includes("/history")) {
      return (await pointsRoutes(request, env, url.pathname)) ?? error(404, "NOT_FOUND", "Not found.");
    }

    return error(404, "NOT_FOUND", "Not found.");
  },
} satisfies ExportedHandler<Env>;
