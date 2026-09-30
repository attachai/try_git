import { z } from "zod";
import type { Env } from "../types";
import { error, json, readJson } from "../lib/http";
import { hashSecret } from "../lib/password";
import { getSessionUser } from "../lib/session";
import { generatedCode, normalizedCode, parentRelationSchema } from "./auth";

// Avatars are stored inline as small data URLs; the browser resizes before upload.
const AVATAR_MAX_CHARS = 200 * 1024;

const addParentSchema = z.object({
  familyId: z.string().min(1),
  displayName: z.string().trim().min(1).max(80),
  relation: parentRelationSchema,
  pin: z.string().regex(/^\d{4,8}$/),
});

const updateFamilySchema = z.object({
  familyId: z.string().min(1),
  name: z.string().trim().min(2).max(100),
  familyCode: z.string().trim().min(4).max(20),
});

const renameMemberSchema = z.object({
  familyId: z.string().min(1),
  userId: z.string().min(1),
  displayName: z.string().trim().min(1).max(80),
});

const leaveFamilySchema = z.object({ familyId: z.string().min(1) });

const avatarSchema = z.object({
  childId: z.string().min(1),
  avatarUrl: z.string()
    .max(AVATAR_MAX_CHARS)
    .regex(/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/)
    .nullable(),
});

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
    ).bind(user.id).all<{ id: string; name: string; family_code: string | null }>();

    const members = await env.DB.prepare(
      `SELECT fm.family_id, u.id AS user_id, u.display_name, u.role, fm.relation, c.id AS child_id, c.avatar_url,
              CASE WHEN (u.role = 'PARENT' AND u.pin_hash IS NOT NULL)
                     OR (u.role = 'CHILD' AND u.password_hash IS NOT NULL) THEN 1 ELSE 0 END AS has_pin
       FROM family_members fm
       JOIN users u ON u.id = fm.user_id
       LEFT JOIN children c ON c.user_id = u.id
       WHERE fm.family_id IN (
         SELECT family_id FROM family_members
         WHERE user_id = ? AND relation IN ('FATHER','MOTHER','GUARDIAN')
       )
       ORDER BY fm.created_at ASC`,
    ).bind(user.id).all<{ family_id: string }>();

    return json({
      families: result.results.map((family) => ({
        ...family,
        members: members.results.filter((member) => member.family_id === family.id),
      })),
    });
  }

  if (pathname === "/api/parents" && request.method === "POST") {
    if (user.role !== "PARENT") return error(403, "FORBIDDEN", "Parent role required.");

    const parsed = addParentSchema.safeParse(await readJson<unknown>(request));
    if (!parsed.success) return error(400, "INVALID_REQUEST", "Invalid parent data.");
    const family = await parentFamily(env, user.id, parsed.data.familyId);
    if (!family) return error(404, "FAMILY_NOT_FOUND", "Family not found.");

    // Parents added here have no email; they sign in with the profile picker PIN only.
    const parentId = crypto.randomUUID();
    await env.DB.batch([
      env.DB.prepare(
        "INSERT INTO users (id, email, password_hash, pin_hash, display_name, role) VALUES (?, NULL, NULL, ?, ?, 'PARENT')",
      ).bind(parentId, await hashSecret(parsed.data.pin), parsed.data.displayName),
      env.DB.prepare(
        "INSERT INTO family_members (id, family_id, user_id, relation) VALUES (?, ?, ?, ?)",
      ).bind(crypto.randomUUID(), family.id, parentId, parsed.data.relation),
    ]);

    return json({ parent: { id: parentId, display_name: parsed.data.displayName, relation: parsed.data.relation } }, { status: 201 });
  }

  // Rename a family and change its Family Code. Existing sessions keep working;
  // the new code is needed the next time someone signs in.
  if (pathname === "/api/families/update" && request.method === "POST") {
    if (user.role !== "PARENT") return error(403, "FORBIDDEN", "Parent role required.");
    const parsed = updateFamilySchema.safeParse(await readJson<unknown>(request));
    if (!parsed.success) return error(400, "INVALID_REQUEST", "ชื่อ 2-100 ตัวอักษร และ Family Code 4-20 ตัวอักษร");
    const family = await parentFamily(env, user.id, parsed.data.familyId);
    if (!family) return error(404, "FAMILY_NOT_FOUND", "Family not found.");
    const familyCode = normalizedCode(parsed.data.familyCode);
    try {
      await env.DB.prepare("UPDATE families SET name = ?, join_code = ? WHERE id = ?")
        .bind(parsed.data.name, familyCode, family.id).run();
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      if (message.includes("UNIQUE constraint failed")) return error(409, "FAMILY_CODE_TAKEN", "Family Code นี้ถูกใช้แล้ว");
      throw cause;
    }
    return json({ family: { id: family.id, name: parsed.data.name, family_code: familyCode } });
  }

  // Rename a parent or child profile in one of the caller's families.
  if (pathname === "/api/members/rename" && request.method === "POST") {
    if (user.role !== "PARENT") return error(403, "FORBIDDEN", "Parent role required.");
    const parsed = renameMemberSchema.safeParse(await readJson<unknown>(request));
    if (!parsed.success) return error(400, "INVALID_REQUEST", "ชื่อ 1-80 ตัวอักษร");
    const family = await parentFamily(env, user.id, parsed.data.familyId);
    if (!family) return error(404, "FAMILY_NOT_FOUND", "Family not found.");
    const member = await env.DB.prepare(
      `SELECT u.id, u.role, c.id AS child_id FROM family_members fm
       JOIN users u ON u.id = fm.user_id LEFT JOIN children c ON c.user_id = u.id
       WHERE fm.family_id = ? AND fm.user_id = ?`,
    ).bind(family.id, parsed.data.userId).first<{ id: string; role: string; child_id: string | null }>();
    if (!member) return error(404, "MEMBER_NOT_FOUND", "ไม่พบสมาชิกคนนี้");

    const name = parsed.data.displayName;
    const statements = [env.DB.prepare("UPDATE users SET display_name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(name, member.id)];
    if (member.child_id) {
      // Child login looks children up by family code + case-insensitive name.
      const taken = await env.DB.prepare(
        "SELECT id FROM children WHERE family_id = ? AND lower(display_name) = lower(?) AND id <> ?",
      ).bind(family.id, name, member.child_id).first();
      if (taken) return error(409, "CHILD_NAME_TAKEN", "ครอบครัวนี้มีเด็กชื่อนี้แล้ว");
      statements.push(env.DB.prepare("UPDATE children SET display_name = ? WHERE id = ?").bind(name, member.child_id));
    }
    await env.DB.batch(statements);
    return json({ member: { user_id: member.id, display_name: name } });
  }

  // Leave a family, e.g. after creating it for someone else. Another parent with a
  // PIN must stay so the family can still be managed.
  if (pathname === "/api/families/leave" && request.method === "POST") {
    if (user.role !== "PARENT") return error(403, "FORBIDDEN", "Parent role required.");
    const parsed = leaveFamilySchema.safeParse(await readJson<unknown>(request));
    if (!parsed.success) return error(400, "INVALID_REQUEST", "Invalid family.");
    const family = await parentFamily(env, user.id, parsed.data.familyId);
    if (!family) return error(404, "FAMILY_NOT_FOUND", "Family not found.");
    const others = await env.DB.prepare(
      `SELECT count(*) AS n FROM family_members fm JOIN users u ON u.id = fm.user_id
       WHERE fm.family_id = ? AND fm.user_id <> ? AND fm.relation IN ('FATHER','MOTHER','GUARDIAN') AND u.pin_hash IS NOT NULL`,
    ).bind(family.id, user.id).first<{ n: number }>();
    if (!others?.n) return error(409, "LAST_PARENT", "ต้องมีผู้ปกครองคนอื่นที่ตั้ง PIN แล้วอยู่ในครอบครัวก่อน");
    await env.DB.prepare("DELETE FROM family_members WHERE family_id = ? AND user_id = ?").bind(family.id, user.id).run();
    return json({ ok: true });
  }

  if (pathname === "/api/children/avatar" && request.method === "POST") {
    if (user.role !== "PARENT") return error(403, "FORBIDDEN", "Parent role required.");

    const parsed = avatarSchema.safeParse(await readJson<unknown>(request));
    if (!parsed.success) return error(400, "INVALID_REQUEST", "รูปต้องเป็น JPEG, PNG หรือ WebP และไม่เกิน 200 KB");

    const result = await env.DB.prepare(
      `UPDATE children SET avatar_url = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND family_id IN (
         SELECT family_id FROM family_members
         WHERE user_id = ? AND relation IN ('FATHER','MOTHER','GUARDIAN')
       )`,
    ).bind(parsed.data.avatarUrl, parsed.data.childId, user.id).run();
    if (!result.meta.changes) return error(404, "CHILD_NOT_FOUND", "Child not found in your family.");

    return json({ ok: true });
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
