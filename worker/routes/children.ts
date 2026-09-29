import { z } from "zod";
import type { Env } from "../types";
import { error, json, readJson } from "../lib/http";
import { hashSecret } from "../lib/password";
import { getSessionUser } from "../lib/session";
import { generatedCode, normalizedCode } from "./auth";

const addChildSchema = z.object({
  displayName: z.string().trim().min(1).max(80),
  pin: z.string().regex(/^\d{4,8}$/),
  familyId: z.string().min(1).optional(),
  newFamily: z.object({
    name: z.string().trim().min(2).max(100),
    familyCode: z.string().trim().min(4).max(20).optional(),
  }).optional(),
}).refine((value) => Boolean(value.familyId) !== Boolean(value.newFamily), {
  message: "Provide either familyId or newFamily.",
});

async function parentFamily(env: Env, parentUserId: string, familyId: string) {
  return env.DB.prepare(
    `SELECT f.id, f.name, f.join_code
     FROM families f
     JOIN family_members fm ON fm.family_id = f.id
     WHERE f.id = ? AND fm.user_id = ? AND fm.relation IN ('FATHER','MOTHER','GUARDIAN')`,
  ).bind(familyId, parentUserId).first<{ id: string; name: string; join_code: string | null }>();
}

export async function childrenRoutes(request: Request, env: Env, pathname: string) {
  const user = await getSessionUser(request, env);
  if (!user) return error(401, "UNAUTHENTICATED", "Please sign in.");

  if (pathname === "/api/children" && request.method === "GET") {
    if (user.role !== "PARENT") return error(403, "FORBIDDEN", "Parent role required.");

    const result = await env.DB.prepare(
      `SELECT c.id, c.family_id, c.display_name, c.avatar_url, c.points_balance
       FROM children c
       JOIN family_members child_member ON child_member.family_id = c.family_id
       JOIN family_members parent_member ON parent_member.family_id = child_member.family_id
       WHERE parent_member.user_id = ? AND child_member.user_id = c.user_id
       ORDER BY c.created_at ASC`,
    ).bind(user.id).all();

    return json({ children: result.results });
  }

  if (pathname === "/api/families" && request.method === "GET") {
    if (user.role !== "PARENT") return error(403, "FORBIDDEN", "Parent role required.");

    const result = await env.DB.prepare(
      `SELECT f.id, f.name, f.join_code AS family_code
       FROM families f
       JOIN family_members fm ON fm.family_id = f.id
       WHERE fm.user_id = ? AND fm.relation IN ('FATHER','MOTHER','GUARDIAN')
       ORDER BY f.created_at ASC`,
    ).bind(user.id).all();

    return json({ families: result.results });
  }

  if (pathname === "/api/children" && request.method === "POST") {
    if (user.role !== "PARENT") return error(403, "FORBIDDEN", "Parent role required.");

    const parsed = addChildSchema.safeParse(await readJson<unknown>(request));
    if (!parsed.success) return error(400, "INVALID_REQUEST", "Invalid child data.");
    const { displayName, pin, familyId: existingFamilyId, newFamily } = parsed.data;

    const statements: D1PreparedStatement[] = [];
    let family: { id: string; name: string; family_code: string | null };

    if (existingFamilyId) {
      const found = await parentFamily(env, user.id, existingFamilyId);
      if (!found) return error(404, "FAMILY_NOT_FOUND", "Family not found.");
      family = { id: found.id, name: found.name, family_code: found.join_code };

      // Child login looks children up by family code + case-insensitive name.
      const taken = await env.DB.prepare(
        "SELECT id FROM children WHERE family_id = ? AND lower(display_name) = lower(?)",
      ).bind(family.id, displayName).first();
      if (taken) return error(409, "CHILD_NAME_TAKEN", "ครอบครัวนี้มีเด็กชื่อนี้แล้ว");
    } else {
      family = {
        id: crypto.randomUUID(),
        name: newFamily!.name,
        family_code: normalizedCode(newFamily!.familyCode ?? generatedCode()),
      };
      statements.push(
        env.DB.prepare("INSERT INTO families (id, name, join_code) VALUES (?, ?, ?)")
          .bind(family.id, family.name, family.family_code),
        env.DB.prepare(
          "INSERT INTO family_members (id, family_id, user_id, relation) VALUES (?, ?, ?, 'GUARDIAN')",
        ).bind(crypto.randomUUID(), family.id, user.id),
      );
    }

    const childUserId = crypto.randomUUID();
    const childId = crypto.randomUUID();
    statements.push(
      env.DB.prepare(
        "INSERT INTO users (id, email, password_hash, display_name, role) VALUES (?, NULL, ?, ?, 'CHILD')",
      ).bind(childUserId, await hashSecret(pin), displayName),
      env.DB.prepare(
        "INSERT INTO family_members (id, family_id, user_id, relation) VALUES (?, ?, ?, 'CHILD')",
      ).bind(crypto.randomUUID(), family.id, childUserId),
      env.DB.prepare(
        "INSERT INTO children (id, family_id, user_id, display_name, points_balance) VALUES (?, ?, ?, ?, 0)",
      ).bind(childId, family.id, childUserId, displayName),
    );

    try {
      await env.DB.batch(statements);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      if (message.includes("UNIQUE constraint failed")) {
        return error(409, "FAMILY_CODE_TAKEN", "Family Code นี้ถูกใช้แล้ว");
      }
      throw cause;
    }

    return json({
      family,
      child: { id: childId, family_id: family.id, display_name: displayName, avatar_url: null, points_balance: 0 },
    }, { status: 201 });
  }

  if (pathname === "/api/child/me" && request.method === "GET") {
    if (user.role !== "CHILD") return error(403, "FORBIDDEN", "Child role required.");
    const child = await env.DB.prepare(
      "SELECT id, display_name, avatar_url, points_balance FROM children WHERE user_id = ?",
    ).bind(user.id).first();
    return child ? json({ child }) : error(404, "CHILD_NOT_FOUND", "Child profile not found.");
  }

  return null;
}
