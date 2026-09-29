import { beforeEach, describe, expect, it } from "vitest";
import { env, SELF } from "cloudflare:test";

async function resetDb() {
  await env.DB.batch([
    env.DB.prepare("DELETE FROM evolution_transactions"),
    env.DB.prepare("DELETE FROM purchase_transactions"),
    env.DB.prepare("DELETE FROM child_characters"),
    env.DB.prepare("DELETE FROM point_transactions"),
    env.DB.prepare("DELETE FROM evolution_paths"),
    env.DB.prepare("DELETE FROM characters"),
    env.DB.prepare("DELETE FROM sessions"),
    env.DB.prepare("DELETE FROM children"),
    env.DB.prepare("DELETE FROM family_members"),
    env.DB.prepare("DELETE FROM users"),
    env.DB.prepare("DELETE FROM families"),
  ]);

  await env.DB.batch([
    env.DB.prepare("INSERT INTO families (id, name) VALUES ('fam_test', 'Test Family')"),
    env.DB.prepare("INSERT INTO users (id, email, display_name, role) VALUES ('parent', 'parent@test.local', 'Parent', 'PARENT')"),
    env.DB.prepare("INSERT INTO users (id, email, display_name, role) VALUES ('child-user', 'child@test.local', 'Child', 'CHILD')"),
    env.DB.prepare("INSERT INTO family_members (id, family_id, user_id, relation) VALUES ('fm-parent', 'fam_test', 'parent', 'FATHER')"),
    env.DB.prepare("INSERT INTO family_members (id, family_id, user_id, relation) VALUES ('fm-child', 'fam_test', 'child-user', 'CHILD')"),
    env.DB.prepare("INSERT INTO children (id, family_id, user_id, display_name, points_balance) VALUES ('child', 'fam_test', 'child-user', 'Child', 1000)"),
    env.DB.prepare("INSERT INTO characters (id, name, slug, type_primary, image_url, price, rarity) VALUES ('starter', 'Starter', 'starter', 'Fire', 'https://example.test/starter.png', 400, 'COMMON')"),
    env.DB.prepare("INSERT INTO characters (id, name, slug, type_primary, image_url, price, rarity) VALUES ('evolved', 'Evolved', 'evolved', 'Fire', 'https://example.test/evolved.png', 0, 'RARE')"),
    env.DB.prepare("INSERT INTO evolution_paths (id, from_character_id, to_character_id, point_cost) VALUES ('evo', 'starter', 'evolved', 300)"),
  ]);
}

async function sessionCookie(userId: string) {
  const id = crypto.randomUUID();
  await env.DB.prepare(
    "INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, datetime('now', '+1 day'))",
  ).bind(id, userId).run();
  return "frg_session=" + id;
}

function post(path: string, cookie: string, body: unknown) {
  return SELF.fetch("https://example.test" + path, {
    method: "POST",
    headers: { cookie, "content-type": "application/json", origin: "https://example.test" },
    body: JSON.stringify(body),
  });
}

beforeEach(resetDb);

describe("point ledger security", () => {
  it("lets a parent award points and updates ledger + balance together", async () => {
    const response = await post("/api/points", await sessionCookie("parent"), {
      childId: "child", type: "EARN", amount: 50, reason: "ช่วยงานบ้าน",
    });

    expect(response.status).toBe(201);
    const child = await env.DB.prepare("SELECT points_balance FROM children WHERE id = 'child'").first<{ points_balance: number }>();
    const ledger = await env.DB.prepare("SELECT points FROM point_transactions WHERE child_id = 'child'").first<{ points: number }>();
    expect(child?.points_balance).toBe(1050);
    expect(ledger?.points).toBe(50);
  });

  it("prevents a child from awarding points", async () => {
    const response = await post("/api/points", await sessionCookie("child-user"), {
      childId: "child", type: "EARN", amount: 50, reason: "self award",
    });
    expect(response.status).toBe(403);
  });

  it("rejects deductions that would make balance negative", async () => {
    const response = await post("/api/points", await sessionCookie("parent"), {
      childId: "child", type: "DEDUCT", amount: 1001, reason: "too much",
    });
    expect(response.status).toBe(409);
    const child = await env.DB.prepare("SELECT points_balance FROM children WHERE id = 'child'").first<{ points_balance: number }>();
    expect(child?.points_balance).toBe(1000);
  });

  it("rejects cross-site mutations", async () => {
    const response = await SELF.fetch("https://example.test/api/points", {
      method: "POST",
      headers: {
        cookie: await sessionCookie("parent"),
        "content-type": "application/json",
        origin: "https://evil.example",
        "sec-fetch-site": "cross-site",
      },
      body: JSON.stringify({ childId: "child", type: "EARN", amount: 50, reason: "bad origin" }),
    });
    expect(response.status).toBe(403);
  });
});

describe("shop and evolution", () => {
  it("purchases atomically and prevents a duplicate without another debit", async () => {
    const cookie = await sessionCookie("child-user");
    expect((await post("/api/shop/purchase", cookie, { characterId: "starter" })).status).toBe(201);
    expect((await post("/api/shop/purchase", cookie, { characterId: "starter" })).status).toBe(409);

    const child = await env.DB.prepare("SELECT points_balance FROM children WHERE id = 'child'").first<{ points_balance: number }>();
    const purchases = await env.DB.prepare("SELECT COUNT(*) AS count FROM purchase_transactions").first<{ count: number }>();
    expect(child?.points_balance).toBe(600);
    expect(purchases?.count).toBe(1);
  });

  it("evolves an owned character and preserves lineage", async () => {
    const cookie = await sessionCookie("child-user");
    await post("/api/shop/purchase", cookie, { characterId: "starter" });

    const owned = await env.DB.prepare(
      "SELECT id FROM child_characters WHERE child_id = 'child' AND character_id = 'starter' AND status = 'OWNED'",
    ).first<{ id: string }>();

    const response = await post("/api/collection/evolve", cookie, { childCharacterId: owned?.id });
    expect(response.status).toBe(201);

    const oldItem = await env.DB.prepare("SELECT status FROM child_characters WHERE id = ?").bind(owned?.id).first<{ status: string }>();
    const newItem = await env.DB.prepare(
      "SELECT evolved_from FROM child_characters WHERE child_id = 'child' AND character_id = 'evolved' AND status = 'OWNED'",
    ).first<{ evolved_from: string }>();
    const child = await env.DB.prepare("SELECT points_balance FROM children WHERE id = 'child'").first<{ points_balance: number }>();

    expect(oldItem?.status).toBe("EVOLVED");
    expect(newItem?.evolved_from).toBe(owned?.id);
    expect(child?.points_balance).toBe(300);
  });
});

describe("adding children", () => {
  function get(path: string, cookie: string) {
    return SELF.fetch("https://example.test" + path, { headers: { cookie } });
  }

  function childLogin(familyCode: string, childName: string, pin: string) {
    return SELF.fetch("https://example.test/api/auth/login/child", {
      method: "POST",
      headers: { "content-type": "application/json", origin: "https://example.test" },
      body: JSON.stringify({ familyCode, childName, pin }),
    });
  }

  it("creates a new family with a child who can sign in with the PIN", async () => {
    const cookie = await sessionCookie("parent");
    const response = await post("/api/children", cookie, {
      displayName: "ultra", pin: "1234", newFamily: { name: "ultra", familyCode: "ultra" },
    });
    expect(response.status).toBe(201);
    const body = await response.json() as { family: { family_code: string } };
    expect(body.family.family_code).toBe("ULTRA");

    expect((await childLogin("ULTRA", "Ultra", "1234")).status).toBe(200);
    expect((await childLogin("ULTRA", "ultra", "9999")).status).toBe(401);

    const families = await (await get("/api/families", cookie)).json() as { families: { family_code: string | null }[] };
    expect(families.families.map((f) => f.family_code)).toContain("ULTRA");
    const children = await (await get("/api/children", cookie)).json() as { children: { display_name: string }[] };
    expect(children.children.map((c) => c.display_name).sort()).toEqual(["Child", "ultra"]);
  });

  it("adds a child to an existing family and rejects a duplicate name", async () => {
    const cookie = await sessionCookie("parent");
    expect((await post("/api/children", cookie, { displayName: "Second", pin: "5678", familyId: "fam_test" })).status).toBe(201);
    expect((await post("/api/children", cookie, { displayName: "second", pin: "5678", familyId: "fam_test" })).status).toBe(409);
  });

  it("rejects a family code that is already used", async () => {
    const cookie = await sessionCookie("parent");
    await post("/api/children", cookie, { displayName: "A", pin: "1234", newFamily: { name: "One", familyCode: "SAME" } });
    const response = await post("/api/children", cookie, { displayName: "B", pin: "1234", newFamily: { name: "Two", familyCode: "same" } });
    expect(response.status).toBe(409);
    const families = await env.DB.prepare("SELECT count(*) AS n FROM families WHERE name = 'Two'").first<{ n: number }>();
    expect(families?.n).toBe(0);
  });

  it("only lets a parent add children to their own family", async () => {
    await env.DB.prepare("INSERT INTO families (id, name) VALUES ('fam_other', 'Other')").run();
    expect((await post("/api/children", await sessionCookie("parent"), { displayName: "X", pin: "1234", familyId: "fam_other" })).status).toBe(404);
    expect((await post("/api/children", await sessionCookie("child-user"), { displayName: "X", pin: "1234", familyId: "fam_test" })).status).toBe(403);
  });

  it("rejects an invalid PIN", async () => {
    const response = await post("/api/children", await sessionCookie("parent"), { displayName: "X", pin: "12", familyId: "fam_test" });
    expect(response.status).toBe(400);
  });
});
