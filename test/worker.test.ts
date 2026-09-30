import { beforeEach, describe, expect, it } from "vitest";
import { env, SELF } from "cloudflare:test";
import { makeTeam, startBattle } from "../shared/arena";

async function resetDb() {
  await env.DB.batch([
    env.DB.prepare("DELETE FROM arena_rooms"),
    env.DB.prepare("DELETE FROM gacha_spins"),
    env.DB.prepare("DELETE FROM quest_completions"),
    env.DB.prepare("DELETE FROM quests"),
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

describe("profile picker login", () => {
  async function publicPost(path: string, body: unknown) {
    return SELF.fetch("https://example.test" + path, {
      method: "POST",
      headers: { "content-type": "application/json", origin: "https://example.test" },
      body: JSON.stringify(body),
    });
  }

  async function setupFamily() {
    const cookie = await sessionCookie("parent");
    await env.DB.prepare("UPDATE families SET join_code = 'TESTFAM' WHERE id = 'fam_test'").run();
    await post("/api/children", cookie, { displayName: "Kid", pin: "1111", familyId: "fam_test" });
    return cookie;
  }

  it("lists family profiles by family code", async () => {
    await setupFamily();
    const response = await publicPost("/api/auth/family", { familyCode: "testfam" });
    expect(response.status).toBe(200);
    const body = await response.json() as { profiles: { display_name: string; has_pin: number }[] };
    const byName = Object.fromEntries(body.profiles.map((p) => [p.display_name, p.has_pin]));
    expect(byName).toMatchObject({ Parent: 0, Kid: 1 });
    expect((await publicPost("/api/auth/family", { familyCode: "NOPE" })).status).toBe(404);
  });

  it("signs a child in with their PIN", async () => {
    await setupFamily();
    const kid = await env.DB.prepare("SELECT user_id FROM children WHERE display_name = 'Kid'").first<{ user_id: string }>();
    expect((await publicPost("/api/auth/login/profile", { familyCode: "TESTFAM", userId: kid?.user_id, pin: "1111" })).status).toBe(200);
    expect((await publicPost("/api/auth/login/profile", { familyCode: "TESTFAM", userId: kid?.user_id, pin: "2222" })).status).toBe(401);
  });

  it("lets a parent set a PIN and relation, then sign in with it", async () => {
    const cookie = await setupFamily();
    expect((await publicPost("/api/auth/login/profile", { familyCode: "TESTFAM", userId: "parent", pin: "4321" })).status).toBe(401);
    expect((await post("/api/auth/profile", cookie, { pin: "4321", relation: "FATHER" })).status).toBe(200);
    expect((await publicPost("/api/auth/login/profile", { familyCode: "TESTFAM", userId: "parent", pin: "4321" })).status).toBe(200);
    const member = await env.DB.prepare("SELECT relation FROM family_members WHERE user_id = 'parent'").first<{ relation: string }>();
    expect(member?.relation).toBe("FATHER");
  });

  it("does not sign in a member of another family", async () => {
    await setupFamily();
    await env.DB.prepare("INSERT INTO families (id, name, join_code) VALUES ('fam_other', 'Other', 'OTHER')").run();
    const kid = await env.DB.prepare("SELECT user_id FROM children WHERE display_name = 'Kid'").first<{ user_id: string }>();
    expect((await publicPost("/api/auth/login/profile", { familyCode: "OTHER", userId: kid?.user_id, pin: "1111" })).status).toBe(401);
  });

  it("adds a second parent who signs in with a PIN and can award points", async () => {
    const cookie = await setupFamily();
    const response = await post("/api/parents", cookie, { familyId: "fam_test", displayName: "Mom", relation: "MOTHER", pin: "5555" });
    expect(response.status).toBe(201);
    const { parent } = await response.json() as { parent: { id: string } };

    const login = await publicPost("/api/auth/login/profile", { familyCode: "TESTFAM", userId: parent.id, pin: "5555" });
    expect(login.status).toBe(200);
    const momCookie = login.headers.get("set-cookie")!.split(";")[0];
    expect((await post("/api/points", momCookie, { childId: "child", type: "EARN", amount: 10, reason: "ช่วยงาน" })).status).toBe(201);
  });

  it("stores a child avatar only for the parent's own child", async () => {
    const cookie = await setupFamily();
    const avatarUrl = "data:image/jpeg;base64,/9j/4AAQSkZJRg==";
    expect((await post("/api/children/avatar", cookie, { childId: "child", avatarUrl })).status).toBe(200);
    const row = await env.DB.prepare("SELECT avatar_url FROM children WHERE id = 'child'").first<{ avatar_url: string }>();
    expect(row?.avatar_url).toBe(avatarUrl);

    expect((await post("/api/children/avatar", cookie, { childId: "child", avatarUrl: "https://evil.example/x.png" })).status).toBe(400);
    expect((await post("/api/children/avatar", await sessionCookie("child-user"), { childId: "child", avatarUrl })).status).toBe(403);
    await env.DB.prepare("INSERT INTO families (id, name) VALUES ('fam_other', 'Other')").run();
    await env.DB.prepare("UPDATE children SET family_id = 'fam_other' WHERE id = 'child'").run();
    expect((await post("/api/children/avatar", cookie, { childId: "child", avatarUrl })).status).toBe(404);
  });
});

describe("daily quests and streaks", () => {
  function get(path: string, cookie: string) {
    return SELF.fetch("https://example.test" + path, { headers: { cookie } });
  }

  function thaiDay(offsetDays = 0) {
    return new Date(Date.now() + 7 * 3600 * 1000 + offsetDays * 86400 * 1000).toISOString().slice(0, 10);
  }

  async function createQuest(cookie: string, title = "แปรงฟัน", points = 10) {
    const response = await post("/api/quests", cookie, { childId: "child", forAllChildren: true, title, points });
    expect(response.status).toBe(201);
    return (await response.json() as { quest: { id: string } }).quest.id;
  }

  async function balance() {
    return (await env.DB.prepare("SELECT points_balance FROM children WHERE id = 'child'").first<{ points_balance: number }>())!.points_balance;
  }

  it("child submits, parent approves once, and points are awarded", async () => {
    const parent = await sessionCookie("parent");
    const kid = await sessionCookie("child-user");
    const questId = await createQuest(parent);

    expect((await post("/api/quests/complete", kid, { questId })).status).toBe(201);
    expect((await post("/api/quests/complete", kid, { questId })).status).toBe(409);
    expect(await balance()).toBe(1000);

    const { pending } = await (await get("/api/quests/pending", parent)).json() as { pending: { id: string }[] };
    expect(pending).toHaveLength(1);
    expect((await post("/api/quests/review", parent, { completionId: pending[0].id, approve: true })).status).toBe(200);
    expect((await post("/api/quests/review", parent, { completionId: pending[0].id, approve: true })).status).toBe(409);
    expect(await balance()).toBe(1010);

    const today = await (await get("/api/quests", kid)).json() as { quests: { status: string }[]; streak: { current: number; today_done: boolean } };
    expect(today.quests[0].status).toBe("APPROVED");
    expect(today.streak).toMatchObject({ current: 1, today_done: true });
  });

  it("a rejected quest can be resubmitted", async () => {
    const parent = await sessionCookie("parent");
    const kid = await sessionCookie("child-user");
    const questId = await createQuest(parent);
    await post("/api/quests/complete", kid, { questId });
    const { pending } = await (await get("/api/quests/pending", parent)).json() as { pending: { id: string }[] };
    expect((await post("/api/quests/review", parent, { completionId: pending[0].id, approve: false })).status).toBe(200);
    expect(await balance()).toBe(1000);
    expect((await post("/api/quests/complete", kid, { questId })).status).toBe(201);
  });

  it("a parent can mark a quest done directly", async () => {
    const parent = await sessionCookie("parent");
    const questId = await createQuest(parent, "อ่านหนังสือ", 20);
    const response = await post("/api/quests/complete", parent, { questId, childId: "child" });
    expect(response.status).toBe(201);
    expect(await balance()).toBe(1020);
    expect((await post("/api/quests/complete", parent, { questId, childId: "child" })).status).toBe(409);
  });

  it("pays the 3-day streak bonus once", async () => {
    const parent = await sessionCookie("parent");
    const questId = await createQuest(parent);
    const secondQuestId = await createQuest(parent, "เก็บของเล่น", 10);
    for (const day of [thaiDay(-2), thaiDay(-1)]) {
      await env.DB.prepare(
        "INSERT INTO quest_completions (id, quest_id, child_id, day, status) VALUES (?, ?, 'child', ?, 'APPROVED')",
      ).bind(crypto.randomUUID(), questId, day).run();
    }

    const response = await post("/api/quests/complete", parent, { questId, childId: "child" });
    const body = await response.json() as { streakBonus: { days: number; points: number } | null };
    expect(body.streakBonus).toEqual({ days: 3, points: 20 });
    expect(await balance()).toBe(1000 + 10 + 20);

    // A second quest on the same day doesn't pay the bonus again.
    const again = await (await post("/api/quests/complete", parent, { questId: secondQuestId, childId: "child" })).json() as { streakBonus: unknown };
    expect(again.streakBonus).toBeNull();
    expect(await balance()).toBe(1000 + 10 + 20 + 10);

    const status = await (await get("/api/quests?childId=child", parent)).json() as { streak: { current: number; next_milestone: number } };
    expect(status.streak).toMatchObject({ current: 3, next_milestone: 7 });
  });

  it("keeps yesterday's streak alive until today ends", async () => {
    const parent = await sessionCookie("parent");
    const questId = await createQuest(parent);
    await env.DB.prepare(
      "INSERT INTO quest_completions (id, quest_id, child_id, day, status) VALUES (?, ?, 'child', ?, 'APPROVED')",
    ).bind(crypto.randomUUID(), questId, thaiDay(-1)).run();
    const status = await (await get("/api/quests?childId=child", parent)).json() as { streak: { current: number; today_done: boolean } };
    expect(status.streak).toMatchObject({ current: 1, today_done: false });
  });

  it("only lets parents create, archive, and review quests in their own family", async () => {
    const parent = await sessionCookie("parent");
    const kid = await sessionCookie("child-user");
    expect((await post("/api/quests", kid, { childId: "child", forAllChildren: true, title: "hack", points: 100 })).status).toBe(403);
    const questId = await createQuest(parent);

    await env.DB.batch([
      env.DB.prepare("INSERT INTO families (id, name) VALUES ('fam_other', 'Other')"),
      env.DB.prepare("INSERT INTO users (id, display_name, role) VALUES ('other-parent', 'Other', 'PARENT')"),
      env.DB.prepare("INSERT INTO family_members (id, family_id, user_id, relation) VALUES ('fm-other', 'fam_other', 'other-parent', 'FATHER')"),
    ]);
    const outsider = await sessionCookie("other-parent");
    expect((await post("/api/quests/archive", outsider, { questId })).status).toBe(404);
    expect((await post("/api/quests/complete", outsider, { questId, childId: "child" })).status).toBe(404);

    expect((await post("/api/quests/archive", parent, { questId })).status).toBe(200);
    expect((await post("/api/quests/complete", kid, { questId })).status).toBe(404);
  });
});

describe("mystery box", () => {
  function get(path: string, cookie: string) {
    return SELF.fetch("https://example.test" + path, { headers: { cookie } });
  }

  async function addShopCharacters(count: number) {
    await env.DB.batch(Array.from({ length: count }, (_, i) =>
      env.DB.prepare("INSERT INTO characters (id, name, slug, type_primary, image_url, price, rarity) VALUES (?, ?, ?, 'Water', 'https://example.test/x.png', 300, 'RARE')")
        .bind("extra" + i, "Extra " + i, "extra-" + i)));
  }

  async function balance() {
    return (await env.DB.prepare("SELECT points_balance FROM children WHERE id = 'child'").first<{ points_balance: number }>())!.points_balance;
  }

  it("charges the price and grants a shop character the child doesn't own", async () => {
    const kid = await sessionCookie("child-user");
    const response = await post("/api/gacha/spin", kid, {});
    expect(response.status).toBe(201);
    const { character } = await response.json() as { character: { id: string } };
    // Only the purchasable "starter" is in the pool; "evolved" (price 0) never drops.
    expect(character.id).toBe("starter");
    expect(await balance()).toBe(600);

    const empty = await post("/api/gacha/spin", kid, {});
    expect(empty.status).toBe(409);
    expect(await balance()).toBe(600);
  });

  it("never grants a duplicate and stops after the daily limit", async () => {
    await env.DB.prepare("UPDATE children SET points_balance = 5000 WHERE id = 'child'").run();
    await addShopCharacters(5);
    const kid = await sessionCookie("child-user");
    const got = new Set<string>();
    for (let i = 0; i < 3; i += 1) {
      const response = await post("/api/gacha/spin", kid, {});
      expect(response.status).toBe(201);
      got.add((await response.json() as { character: { id: string } }).character.id);
    }
    expect(got.size).toBe(3);
    expect((await post("/api/gacha/spin", kid, {})).status).toBe(429);
    expect(await balance()).toBe(5000 - 3 * 400);

    const info = await (await get("/api/gacha", kid)).json() as { spins_today: number; pool_size: number };
    expect(info).toMatchObject({ spins_today: 3, pool_size: 3 });
  });

  it("rejects a spin without enough points and never charges", async () => {
    await env.DB.prepare("UPDATE children SET points_balance = 399 WHERE id = 'child'").run();
    expect((await post("/api/gacha/spin", await sessionCookie("child-user"), {})).status).toBe(409);
    expect(await balance()).toBe(399);
    const spins = await env.DB.prepare("SELECT count(*) AS n FROM gacha_spins").first<{ n: number }>();
    expect(spins?.n).toBe(0);
  });

  it("shows odds that add up to 100% over what is left", async () => {
    await addShopCharacters(2);
    const info = await (await get("/api/gacha", await sessionCookie("child-user"))).json() as { odds: { rarity: string; percent: number }[] };
    // Pool has COMMON (starter) and RARE (extras) only, so 60:30 renormalizes to 66.7 / 33.3.
    expect(info.odds).toEqual([
      { rarity: "COMMON", percent: 66.7, count: 1 },
      { rarity: "RARE", percent: 33.3, count: 2 },
    ]);
  });

  it("is only for children", async () => {
    expect((await post("/api/gacha/spin", await sessionCookie("parent"), {})).status).toBe(403);
  });
});

describe("pokedex", () => {
  type Dex = {
    total: number; registered: number;
    entries: { id: string; registered: number; evolves_from: string | null }[];
    sets: { set: string; total: number; registered: number; bonus: number; claimed: boolean }[];
  };

  async function dex(cookie: string) {
    return await (await SELF.fetch("https://example.test/api/pokedex", { headers: { cookie } })).json() as Dex;
  }

  async function balance() {
    return (await env.DB.prepare("SELECT points_balance FROM children WHERE id = 'child'").first<{ points_balance: number }>())!.points_balance;
  }

  it("counts evolved-away forms as registered and shows how to get each one", async () => {
    const kid = await sessionCookie("child-user");
    expect((await dex(kid)).registered).toBe(0);

    await post("/api/shop/purchase", kid, { characterId: "starter" });
    const owned = await env.DB.prepare("SELECT id FROM child_characters WHERE character_id = 'starter'").first<{ id: string }>();
    await post("/api/collection/evolve", kid, { childCharacterId: owned!.id });

    const after = await dex(kid);
    expect(after).toMatchObject({ total: 2, registered: 2 });
    expect(after.entries.find((e) => e.id === "evolved")?.evolves_from).toBe("Starter");
  });

  it("pays a complete set once and refuses an incomplete one", async () => {
    const kid = await sessionCookie("child-user");
    expect((await post("/api/pokedex/claim", kid, { set: "Fire" })).status).toBe(409);

    await post("/api/shop/purchase", kid, { characterId: "starter" });
    const owned = await env.DB.prepare("SELECT id FROM child_characters WHERE character_id = 'starter'").first<{ id: string }>();
    await post("/api/collection/evolve", kid, { childCharacterId: owned!.id });
    const before = await balance();

    const claim = await post("/api/pokedex/claim", kid, { set: "Fire" });
    expect(claim.status).toBe(201);
    expect(await balance()).toBe(before + 2 * 30);
    expect((await post("/api/pokedex/claim", kid, { set: "Fire" })).status).toBe(409);

    expect((await post("/api/pokedex/claim", kid, { set: "ALL" })).status).toBe(201);
    expect(await balance()).toBe(before + 60 + 1000);

    const sets = (await dex(kid)).sets;
    expect(sets.find((s) => s.set === "Fire")).toMatchObject({ claimed: true, registered: 2, total: 2 });
    expect((await post("/api/pokedex/claim", kid, { set: "Nope" })).status).toBe(404);
  });

  it("is only for children", async () => {
    expect((await post("/api/pokedex/claim", await sessionCookie("parent"), { set: "Fire" })).status).toBe(403);
  });
});

describe("arena rooms", () => {
  type View = {
    room: { code: string; status: string; version: number; winner: string | null; reward_points: number; my_side: string };
    parent_team: { id: string }[];
    state: { turn: string; winner: string | null; teams: Record<string, { fighters: { name: string }[] }> } | null;
  };
  const get = (path: string, cookie: string) => SELF.fetch("https://example.test" + path, { headers: { cookie } });

  async function roomWithTeam(autoParent: boolean, prize = 50) {
    const parent = await sessionCookie("parent");
    const kid = await sessionCookie("child-user");
    await post("/api/shop/purchase", kid, { characterId: "starter" });
    const owned = await env.DB.prepare("SELECT id FROM child_characters WHERE character_id = 'starter'").first<{ id: string }>();
    const created = await post("/api/arena/rooms", parent, { difficulty: "EASY", prize, autoParent });
    expect(created.status).toBe(201);
    const { room } = await created.json() as View;
    expect(room.code).toMatch(/^\d{4}$/);
    expect((await post(`/api/arena/rooms/${room.code}/join`, kid, {})).status).toBe(200);
    const picked = await post(`/api/arena/rooms/${room.code}/team`, kid, { childCharacterIds: [owned!.id] });
    expect(picked.status).toBe(200);
    return { parent, kid, code: room.code, view: await picked.json() as View };
  }

  it("runs a full battle against the auto parent and pays the child once", async () => {
    const { kid, code, view } = await roomWithTeam(true);
    expect(view.room.status).toBe("BATTLE");
    expect(view.state?.teams.CHILD.fighters.map((f) => f.name)).toEqual(["Starter"]);

    let current = view;
    for (let i = 0; i < 100 && current.room.status === "BATTLE"; i += 1) {
      const response = await post(`/api/arena/rooms/${code}/action`, kid, { version: current.room.version, action: "ATTACK" });
      expect(response.status).toBe(200);
      current = await response.json() as View;
      // The auto parent answers in the same request, so it's always the child's turn again.
      if (current.room.status === "BATTLE") expect(current.state?.turn).toBe("CHILD");
    }
    expect(current.room.status).toBe("FINISHED");
    const expected = current.room.winner === "CHILD" ? 50 : 10;
    expect(current.room.reward_points).toBe(expected);
    const ledger = await env.DB.prepare("SELECT points FROM point_transactions WHERE reference_type = 'ARENA'").all<{ points: number }>();
    expect(ledger.results.map((r) => r.points)).toEqual([expected]);
    expect((await post(`/api/arena/rooms/${code}/action`, kid, { version: current.room.version, action: "ATTACK" })).status).toBe(409);
  });

  it("enforces turns and rejects a stale version", async () => {
    const { parent, kid, code, view } = await roomWithTeam(false);
    expect((await post(`/api/arena/rooms/${code}/action`, parent, { version: view.room.version, action: "ATTACK" })).status).toBe(409);
    const first = await post(`/api/arena/rooms/${code}/action`, kid, { version: view.room.version, action: "ATTACK" });
    expect(first.status).toBe(200);
    // Same version again (a double tap) is refused.
    expect((await post(`/api/arena/rooms/${code}/action`, kid, { version: view.room.version, action: "ATTACK" })).status).toBe(409);
    const next = await first.json() as View;
    expect(next.state?.turn).toBe("PARENT");
    expect((await post(`/api/arena/rooms/${code}/action`, parent, { version: next.room.version, action: "GUARD" })).status).toBe(200);
    const parentView = await (await get(`/api/arena/rooms/${code}`, parent)).json() as View;
    expect(parentView.room.my_side).toBe("PARENT");
    expect(parentView.state?.turn).toBe("CHILD");
  });

  it("only lets a child use monsters they own and only once per slot", async () => {
    const parent = await sessionCookie("parent");
    const kid = await sessionCookie("child-user");
    const { room } = await (await post("/api/arena/rooms", parent, { difficulty: "NORMAL", prize: 0, autoParent: false })).json() as View;
    await post(`/api/arena/rooms/${room.code}/join`, kid, {});
    expect((await post(`/api/arena/rooms/${room.code}/team`, kid, { childCharacterIds: ["not-mine"] })).status).toBe(400);
    expect((await post(`/api/arena/rooms/${room.code}/team`, kid, { childCharacterIds: [] })).status).toBe(400);
  });

  it("hides rooms from children outside the family and lets the parent cancel", async () => {
    await env.DB.batch([
      env.DB.prepare("INSERT INTO families (id, name) VALUES ('fam_other', 'Other')"),
      env.DB.prepare("INSERT INTO users (id, display_name, role) VALUES ('other-kid', 'Other Kid', 'CHILD')"),
      env.DB.prepare("INSERT INTO children (id, family_id, user_id, display_name, points_balance) VALUES ('other-child', 'fam_other', 'other-kid', 'Other Kid', 0)"),
    ]);
    const parent = await sessionCookie("parent");
    const { room } = await (await post("/api/arena/rooms", parent, { difficulty: "HARD", prize: 200, autoParent: false })).json() as View;
    expect((await post(`/api/arena/rooms/${room.code}/join`, await sessionCookie("other-kid"), {})).status).toBe(404);

    const current = await (await get("/api/arena/rooms/current", parent)).json() as View;
    expect(current.room.code).toBe(room.code);
    expect((await post(`/api/arena/rooms/${room.code}/cancel`, parent, {})).status).toBe(200);
    expect((await (await get("/api/arena/rooms/current", parent)).json() as { room: null }).room).toBeNull();
    expect((await post(`/api/arena/rooms/${room.code}/join`, await sessionCookie("child-user"), {})).status).toBe(404);
  });

  async function playToEnd(kid: string, code: string, view: View) {
    let current = view;
    for (let i = 0; i < 100 && current.room.status === "BATTLE"; i += 1) {
      current = await (await post(`/api/arena/rooms/${code}/action`, kid, { version: current.room.version, action: "ATTACK" })).json() as View;
    }
    return current as View & { xp_awards: { name: string; gained: number; level: number; levels_gained: number }[] | null };
  }

  it("awards XP to the child's team once per room and it survives evolving", async () => {
    const { kid, code, view } = await roomWithTeam(true);
    const done = await playToEnd(kid, code, view);
    const won = done.room.winner === "CHILD";
    // Solo team: on a win the only fighter is also the MVP.
    const gained = won ? 30 + 20 : 10;
    expect(done.xp_awards).toEqual([{ name: "Starter", gained, level: 1 + Math.floor(gained / 50), levels_gained: Math.floor(gained / 50) }]);
    const owned = await env.DB.prepare("SELECT id, level, xp FROM child_characters WHERE character_id = 'starter'").first<{ id: string; level: number; xp: number }>();
    expect(owned).toMatchObject({ level: 1 + Math.floor(gained / 50), xp: gained % 50 });

    // Re-reading the finished room doesn't pay again.
    await SELF.fetch(`https://example.test/api/arena/rooms/${code}`, { headers: { cookie: kid } });
    expect((await env.DB.prepare("SELECT xp FROM child_characters WHERE id = ?").bind(owned!.id).first<{ xp: number }>())!.xp).toBe(owned!.xp);

    await env.DB.prepare("UPDATE child_characters SET level = 4, xp = 12 WHERE id = ?").bind(owned!.id).run();
    await env.DB.prepare("UPDATE children SET points_balance = 1000 WHERE id = 'child'").run();
    expect((await post("/api/collection/evolve", kid, { childCharacterId: owned!.id })).status).toBe(201);
    const evolved = await env.DB.prepare("SELECT level, xp FROM child_characters WHERE character_id = 'evolved' AND status = 'OWNED'").first();
    expect(evolved).toEqual({ level: 4, xp: 12 });
  });

  it("levels the parent team to the child team's average level", async () => {
    const parent = await sessionCookie("parent");
    const kid = await sessionCookie("child-user");
    await post("/api/shop/purchase", kid, { characterId: "starter" });
    const owned = await env.DB.prepare("SELECT id FROM child_characters WHERE character_id = 'starter'").first<{ id: string }>();
    await env.DB.prepare("UPDATE child_characters SET level = 6 WHERE id = ?").bind(owned!.id).run();
    const { room } = await (await post("/api/arena/rooms", parent, { difficulty: "NORMAL", prize: 0, autoParent: false })).json() as View;
    await post(`/api/arena/rooms/${room.code}/join`, kid, {});
    const started = await (await post(`/api/arena/rooms/${room.code}/team`, kid, { childCharacterIds: [owned!.id] })).json() as {
      state: { teams: Record<string, { fighters: { level?: number; stats: { hp: number } }[] }> };
    };
    const [foe] = started.state.teams.PARENT.fighters;
    expect(foe.level).toBe(6);
    expect(started.state.teams.CHILD.fighters[0].level).toBe(6);
  });

  it("stops handing out XP after the daily room limit", async () => {
    await env.DB.prepare(
      `INSERT INTO arena_rooms (id, code, parent_user_id, child_id, difficulty, prize, status, parent_team, xp_day, xp_awards)
       SELECT 'old' || value, '99' || value, 'parent', 'child', 'EASY', 0, 'FINISHED', '[]', ?, '[{"name":"x"}]'
       FROM json_each('[10,11,12,13,14]')`,
    ).bind(new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10)).run();
    const { kid, code, view } = await roomWithTeam(true);
    const done = await playToEnd(kid, code, view);
    expect(done.xp_awards).toEqual([]);
    const owned = await env.DB.prepare("SELECT level, xp FROM child_characters WHERE character_id = 'starter'").first();
    expect(owned).toEqual({ level: 1, xp: 0 });
  });

  it("validates room settings", async () => {
    const parent = await sessionCookie("parent");
    expect((await post("/api/arena/rooms", parent, { difficulty: "EASY", prize: 500, autoParent: false })).status).toBe(400);
    expect((await post("/api/arena/rooms", await sessionCookie("child-user"), { difficulty: "EASY", prize: 0, autoParent: false })).status).toBe(403);
  });
});

describe("arena history", () => {
  const mon = (id: string, type_primary: string) => ({ id, name: id, image_url: "", rarity: "COMMON", type_primary, type_secondary: null });

  // Oldest first: win, loss, win, win (EASY, NORMAL, HARD, NORMAL).
  async function seedGames() {
    const games = [
      { winner: "CHILD", difficulty: "EASY", damage: [40, 0] },
      { winner: "PARENT", difficulty: "NORMAL", damage: [10, 5] },
      { winner: "CHILD", difficulty: "HARD", damage: [30, 60] },
      { winner: "CHILD", difficulty: "NORMAL", damage: [50, 20] },
    ];
    for (const [index, game] of games.entries()) {
      const state = startBattle(makeTeam([mon("Charmander", "Fire"), mon("Squirtle", "Water")]), makeTeam([mon("Onix", "Rock")]));
      state.winner = game.winner as "CHILD" | "PARENT";
      state.round = 5 + index;
      state.teams.CHILD.fighters.forEach((fighter, i) => { fighter.damageDealt = game.damage[i]; });
      await env.DB.prepare(
        `INSERT INTO arena_rooms (id, code, parent_user_id, child_id, difficulty, prize, status, parent_team, state, winner, reward_points, updated_at)
         VALUES (?, ?, 'parent', 'child', ?, 50, 'FINISHED', '[]', ?, ?, ?, datetime('now', ?))`,
      ).bind("h" + index, "10" + index + "0", game.difficulty, JSON.stringify(state), game.winner, game.winner === "CHILD" ? 50 : 10, `-${10 - index} minutes`).run();
    }
  }

  type History = {
    summary: Record<string, number>;
    by_difficulty: Record<string, { wins: number; losses: number }>;
    top_monsters: { monster: { name: string }; battles: number; wins: number; damage: number; mvp: number }[];
    recent: { code: string; winner: string; rounds: number; mvp: { name: string } | null; child_team: { name: string }[]; parent_team: { name: string }[] }[];
  };
  const history = async (cookie: string, query = "") =>
    SELF.fetch("https://example.test/api/arena/history" + query, { headers: { cookie } });

  it("summarizes a child's record, streaks, difficulties, and best monsters", async () => {
    await seedGames();
    const response = await history(await sessionCookie("child-user"));
    expect(response.status).toBe(200);
    const body = await response.json() as History;
    expect(body.summary).toEqual({ played: 4, wins: 3, losses: 1, win_rate: 75, current_streak: 2, best_streak: 2 });
    expect(body.by_difficulty).toEqual({ EASY: { wins: 1, losses: 0 }, NORMAL: { wins: 1, losses: 1 }, HARD: { wins: 1, losses: 0 } });
    expect(body.top_monsters[0]).toMatchObject({ monster: { name: "Charmander" }, battles: 4, wins: 3, damage: 130, mvp: 2 });
    expect(body.top_monsters[1]).toMatchObject({ monster: { name: "Squirtle" }, wins: 3, damage: 85, mvp: 1 });
    expect(body.recent.map((game) => game.code)).toEqual(["1030", "1020", "1010", "1000"]);
    expect(body.recent[0]).toMatchObject({ winner: "CHILD", rounds: 8, mvp: { name: "Charmander" } });
    expect(body.recent[0].parent_team.map((m) => m.name)).toEqual(["Onix"]);
  });

  it("lets a parent see their child's history but not other children's", async () => {
    await seedGames();
    const parent = await sessionCookie("parent");
    expect(((await (await history(parent, "?childId=child")).json()) as History).summary.played).toBe(4);
    expect((await history(parent)).status).toBe(404);

    await env.DB.batch([
      env.DB.prepare("INSERT INTO families (id, name) VALUES ('fam_other', 'Other')"),
      env.DB.prepare("INSERT INTO users (id, display_name, role) VALUES ('other-parent', 'Other', 'PARENT')"),
      env.DB.prepare("INSERT INTO family_members (id, family_id, user_id, relation) VALUES ('fm-other', 'fam_other', 'other-parent', 'FATHER')"),
    ]);
    expect((await history(await sessionCookie("other-parent"), "?childId=child")).status).toBe(404);
  });

  it("returns an empty record before any battles", async () => {
    const body = await (await history(await sessionCookie("child-user"))).json() as History;
    expect(body.summary).toEqual({ played: 0, wins: 0, losses: 0, win_rate: 0, current_streak: 0, best_streak: 0 });
    expect(body.recent).toEqual([]);
  });
});
