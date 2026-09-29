import type { Env } from "../types";

const COOKIE_NAME = "frg_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 14;

export type SessionUser = {
  id: string;
  display_name: string;
  role: "PARENT" | "CHILD";
};

function cookieValue(request: Request, name: string) {
  const cookie = request.headers.get("cookie") ?? "";
  for (const part of cookie.split(";")) {
    const [key, ...value] = part.trim().split("=");
    if (key === name) return decodeURIComponent(value.join("="));
  }
  return null;
}

export async function getSessionUser(request: Request, env: Env): Promise<SessionUser | null> {
  const sessionId = cookieValue(request, COOKIE_NAME);
  if (!sessionId) return null;

  return env.DB.prepare(
    `SELECT u.id, u.display_name, u.role
     FROM sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.id = ? AND datetime(s.expires_at) > datetime('now')`,
  ).bind(sessionId).first<SessionUser>();
}

export async function createSession(env: Env, userId: string) {
  const id = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000).toISOString();
  await env.DB.prepare("INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)")
    .bind(id, userId, expiresAt)
    .run();

  return {
    id,
    cookie: `${COOKIE_NAME}=${encodeURIComponent(id)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_TTL_SECONDS}`,
  };
}

export async function destroySession(request: Request, env: Env) {
  const id = cookieValue(request, COOKIE_NAME);
  if (id) await env.DB.prepare("DELETE FROM sessions WHERE id = ?").bind(id).run();
  return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}
