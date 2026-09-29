import { z } from "zod";
import type { Env } from "../types";
import { error, json, readJson } from "../lib/http";
import { createSession, destroySession, getSessionUser } from "../lib/session";

const devLoginSchema = z.object({
  role: z.enum(["PARENT", "CHILD"]),
});

export async function authRoutes(request: Request, env: Env, pathname: string) {
  if (pathname === "/api/auth/me" && request.method === "GET") {
    const user = await getSessionUser(request, env);
    return user ? json({ user }) : error(401, "UNAUTHENTICATED", "Not signed in.");
  }

  if (pathname === "/api/auth/dev-login" && request.method === "POST") {
    if (env.ENVIRONMENT === "production") {
      return error(404, "NOT_FOUND", "Not found.");
    }
    const parsed = devLoginSchema.safeParse(await readJson<unknown>(request));
    if (!parsed.success) return error(400, "INVALID_REQUEST", "Invalid demo role.");

    const userId = parsed.data.role === "PARENT" ? "usr_dad" : "usr_child";
    const user = await env.DB.prepare("SELECT id, display_name, role FROM users WHERE id = ?")
      .bind(userId)
      .first<{ id: string; display_name: string; role: "PARENT" | "CHILD" }>();

    if (!user) return error(404, "DEMO_USER_MISSING", "Run demo seed first.");

    const session = await createSession(env, user.id);
    return json({ user }, { headers: { "Set-Cookie": session.cookie } });
  }

  if (pathname === "/api/auth/logout" && request.method === "POST") {
    const cookie = await destroySession(request, env);
    return json({ ok: true }, { headers: { "Set-Cookie": cookie } });
  }

  return null;
}
