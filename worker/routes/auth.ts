import { z } from "zod";
import type { Env } from "../types";
import { error, json, readJson } from "../lib/http";
import { createSession, destroySession, getSessionUser } from "../lib/session";
import { hashSecret, verifySecret } from "../lib/password";

const devLoginSchema = z.object({
  role: z.enum(["PARENT", "CHILD"]),
});

const parentLoginSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(8).max(128),
});

const childLoginSchema = z.object({
  familyCode: z.string().trim().min(4).max(20),
  childName: z.string().trim().min(1).max(80),
  pin: z.string().regex(/^\d{4,8}$/),
});

const bootstrapSchema = z.object({
  familyName: z.string().trim().min(2).max(100),
  familyCode: z.string().trim().min(4).max(20).optional(),
  parentName: z.string().trim().min(2).max(100),
  parentEmail: z.string().trim().email().max(254),
  parentPassword: z.string().min(10).max(128),
  childName: z.string().trim().min(1).max(80),
  childPin: z.string().regex(/^\d{4,8}$/),
});

export function normalizedCode(value: string) {
  return value.trim().toUpperCase().replace(/\s+/g, "-");
}

export function generatedCode() {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase();
}

async function issueSession(env: Env, user: { id: string; display_name: string; role: "PARENT" | "CHILD" }) {
  const session = await createSession(env, user.id);
  return json({ user }, { headers: { "Set-Cookie": session.cookie } });
}

export async function authRoutes(request: Request, env: Env, pathname: string) {
  if (pathname === "/api/auth/config" && request.method === "GET") {
    return json({ demoLoginEnabled: env.ENVIRONMENT !== "production" });
  }

  if (pathname === "/api/auth/me" && request.method === "GET") {
    const user = await getSessionUser(request, env);
    return user ? json({ user }) : error(401, "UNAUTHENTICATED", "Not signed in.");
  }

  if (pathname === "/api/auth/login/parent" && request.method === "POST") {
    const parsed = parentLoginSchema.safeParse(await readJson<unknown>(request));
    if (!parsed.success) return error(400, "INVALID_REQUEST", "Invalid email or password.");

    const email = parsed.data.email.toLowerCase();
    const user = await env.DB.prepare(
      "SELECT id, display_name, role, password_hash FROM users WHERE lower(email) = ? AND role = 'PARENT'",
    ).bind(email).first<{ id: string; display_name: string; role: "PARENT"; password_hash: string | null }>();

    if (!user || !(await verifySecret(parsed.data.password, user.password_hash))) {
      return error(401, "INVALID_CREDENTIALS", "อีเมลหรือรหัสผ่านไม่ถูกต้อง");
    }

    return issueSession(env, { id: user.id, display_name: user.display_name, role: user.role });
  }

  if (pathname === "/api/auth/login/child" && request.method === "POST") {
    const parsed = childLoginSchema.safeParse(await readJson<unknown>(request));
    if (!parsed.success) return error(400, "INVALID_REQUEST", "Invalid family code, child name, or PIN.");

    const user = await env.DB.prepare(
      `SELECT u.id, u.display_name, u.role, u.password_hash
       FROM families f
       JOIN children c ON c.family_id = f.id
       JOIN users u ON u.id = c.user_id
       WHERE f.join_code = ?
         AND lower(c.display_name) = lower(?)
         AND u.role = 'CHILD'`,
    ).bind(normalizedCode(parsed.data.familyCode), parsed.data.childName).first<{
      id: string;
      display_name: string;
      role: "CHILD";
      password_hash: string | null;
    }>();

    if (!user || !(await verifySecret(parsed.data.pin, user.password_hash))) {
      return error(401, "INVALID_CREDENTIALS", "Family Code, ชื่อ หรือ PIN ไม่ถูกต้อง");
    }

    return issueSession(env, { id: user.id, display_name: user.display_name, role: user.role });
  }

  if (pathname === "/api/auth/bootstrap" && request.method === "POST") {
    if (env.ENVIRONMENT !== "production") {
      return error(403, "BOOTSTRAP_PRODUCTION_ONLY", "Bootstrap is production-only.");
    }
    if (!env.BOOTSTRAP_SECRET || request.headers.get("x-bootstrap-secret") !== env.BOOTSTRAP_SECRET) {
      return error(403, "INVALID_BOOTSTRAP_SECRET", "Bootstrap secret is invalid.");
    }

    const existingParent = await env.DB.prepare(
      "SELECT id FROM users WHERE role = 'PARENT' LIMIT 1",
    ).first();
    if (existingParent) return error(409, "BOOTSTRAP_ALREADY_COMPLETED", "A parent account already exists.");

    const parsed = bootstrapSchema.safeParse(await readJson<unknown>(request));
    if (!parsed.success) return error(400, "INVALID_REQUEST", "Invalid bootstrap data.");

    const familyId = crypto.randomUUID();
    const parentId = crypto.randomUUID();
    const childUserId = crypto.randomUUID();
    const childId = crypto.randomUUID();
    const familyCode = normalizedCode(parsed.data.familyCode ?? generatedCode());
    const parentHash = await hashSecret(parsed.data.parentPassword);
    const childHash = await hashSecret(parsed.data.childPin);

    try {
      await env.DB.batch([
        env.DB.prepare("INSERT INTO families (id, name, join_code) VALUES (?, ?, ?)")
          .bind(familyId, parsed.data.familyName, familyCode),
        env.DB.prepare(
          "INSERT INTO users (id, email, password_hash, display_name, role) VALUES (?, ?, ?, ?, 'PARENT')",
        ).bind(parentId, parsed.data.parentEmail.toLowerCase(), parentHash, parsed.data.parentName),
        env.DB.prepare(
          "INSERT INTO users (id, email, password_hash, display_name, role) VALUES (?, NULL, ?, ?, 'CHILD')",
        ).bind(childUserId, childHash, parsed.data.childName),
        env.DB.prepare(
          "INSERT INTO family_members (id, family_id, user_id, relation) VALUES (?, ?, ?, 'GUARDIAN')",
        ).bind(crypto.randomUUID(), familyId, parentId),
        env.DB.prepare(
          "INSERT INTO family_members (id, family_id, user_id, relation) VALUES (?, ?, ?, 'CHILD')",
        ).bind(crypto.randomUUID(), familyId, childUserId),
        env.DB.prepare(
          "INSERT INTO children (id, family_id, user_id, display_name, points_balance) VALUES (?, ?, ?, ?, 0)",
        ).bind(childId, familyId, childUserId, parsed.data.childName),
      ]);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      if (message.includes("UNIQUE constraint failed")) {
        return error(409, "BOOTSTRAP_CONFLICT", "Email or Family Code is already in use.");
      }
      throw cause;
    }

    return json({
      ok: true,
      family: { id: familyId, name: parsed.data.familyName, familyCode },
      parent: { id: parentId, displayName: parsed.data.parentName, email: parsed.data.parentEmail.toLowerCase() },
      child: { id: childId, displayName: parsed.data.childName },
    }, { status: 201 });
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

    return issueSession(env, user);
  }

  if (pathname === "/api/auth/logout" && request.method === "POST") {
    const cookie = await destroySession(request, env);
    return json({ ok: true }, { headers: { "Set-Cookie": cookie } });
  }

  return null;
}
