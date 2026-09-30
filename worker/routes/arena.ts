import { z } from "zod";
import type { Env } from "../types";
import { error, json, readJson } from "../lib/http";
import { getSessionUser, type SessionUser } from "../lib/session";
import { thaiDay } from "./quests";
import {
  aiTurn, applyAction, ArenaError, EMOTES, ITEMS, makeTeam, mvp, parentLevelFor, rollWeather, startBattle, WEATHER_KINDS,
  type ItemKind, type WeatherKind,
  type BattleState, type Rng, type Side,
} from "../../shared/arena";
import { addXp } from "../../shared/battle";

export const DIFFICULTY = {
  EASY: { scale: 0.85, rarities: ["COMMON", "RARE"] },
  NORMAL: { scale: 1.0, rarities: ["COMMON", "RARE", "EPIC"] },
  HARD: { scale: 1.1, rarities: ["COMMON", "RARE", "EPIC", "LEGENDARY"] },
} as const;
export const PARENT_TEAM_SIZE = 3;
export const LOSS_CONSOLATION = 10;
export const REWARDED_ROOMS_PER_DAY = 3;
export const XP_WIN = 30;
export const XP_LOSS = 10;
export const XP_MVP_BONUS = 20;
export const XP_ROOMS_PER_DAY = 5;
export const EMOTES_KEPT = 10;
export const EMOTE_COOLDOWN_MS = 1000;
const OPEN_STATUSES = "('WAITING','PICKING','BATTLE')";

const createSchema = z.object({
  difficulty: z.enum(["EASY", "NORMAL", "HARD"]),
  prize: z.number().int().min(0).max(200),
  autoParent: z.boolean(),
});
const teamSchema = z.object({
  childCharacterIds: z.array(z.string().min(1)).min(1).max(3),
  item: z.enum(Object.keys(ITEMS) as [ItemKind, ...ItemKind[]]).nullable().optional(),
});
const emoteSchema = z.object({ emoji: z.enum(EMOTES) });
const actionSchema = z.object({
  version: z.number().int().min(0),
  action: z.enum(["ATTACK", "SPECIAL", "GUARD", "ULTIMATE", "SWITCH", "ITEM"]),
  target: z.number().int().min(0).max(2).optional(),
});

type CharacterInfo = { id: string; name: string; image_url: string; rarity: string; type_primary: string; type_secondary: string | null };
type Room = {
  id: string; code: string; parent_user_id: string; child_id: string | null;
  difficulty: keyof typeof DIFFICULTY; prize: number; auto_parent: number;
  status: "WAITING" | "PICKING" | "BATTLE" | "FINISHED" | "CANCELLED";
  parent_team: string; state: string | null; version: number;
  winner: Side | null; reward_points: number; xp_awards: string | null;
  emotes: string | null; emote_seq: number; weather: WeatherKind | null;
};
type Emote = { seq: number; side: Side; emoji: string; at: number };
type XpAward = { name: string; gained: number; level: number; levels_gained: number };

const rng: Rng = () => {
  const values = new Uint32Array(1);
  crypto.getRandomValues(values);
  return values[0] / 2 ** 32;
};

async function loadRoom(env: Env, code: string) {
  return env.DB.prepare(`SELECT * FROM arena_rooms WHERE code = ? ORDER BY created_at DESC LIMIT 1`).bind(code).first<Room>();
}

async function childOf(env: Env, user: SessionUser) {
  return env.DB.prepare("SELECT id, display_name FROM children WHERE user_id = ?").bind(user.id).first<{ id: string; display_name: string }>();
}

// The child must be in one of the room owner's families.
async function childCanJoin(env: Env, parentUserId: string, childId: string) {
  return env.DB.prepare(
    `SELECT 1 FROM children c
     JOIN family_members fm ON fm.family_id = c.family_id
     WHERE c.id = ? AND fm.user_id = ? AND fm.relation IN ('FATHER','MOTHER','GUARDIAN')`,
  ).bind(childId, parentUserId).first();
}

async function view(env: Env, room: Room, side: Side) {
  const names = await env.DB.prepare(
    `SELECT (SELECT display_name FROM users WHERE id = ?) AS parent_name,
            (SELECT display_name FROM children WHERE id = ?) AS child_name`,
  ).bind(room.parent_user_id, room.child_id).first<{ parent_name: string; child_name: string | null }>();
  const state = room.state ? JSON.parse(room.state) as BattleState : null;
  const best = state ? mvp(state) : null;
  return {
    room: {
      code: room.code,
      status: room.status,
      difficulty: room.difficulty,
      prize: room.prize,
      auto_parent: Boolean(room.auto_parent),
      version: room.version,
      winner: room.winner,
      reward_points: room.reward_points,
      parent_name: names?.parent_name ?? "",
      child_name: names?.child_name ?? null,
      my_side: side,
      emote_seq: room.emote_seq,
      weather: room.weather ?? "CLEAR",
    },
    parent_team: JSON.parse(room.parent_team) as CharacterInfo[],
    state,
    mvp: best ? { name: best.name, damage: best.damageDealt } : null,
    xp_awards: room.xp_awards ? JSON.parse(room.xp_awards) as XpAward[] : null,
    emotes: room.emotes ? JSON.parse(room.emotes) as Emote[] : [],
  };
}

async function roleFor(env: Env, user: SessionUser, room: Room): Promise<Side | null> {
  if (user.role === "PARENT") return room.parent_user_id === user.id ? "PARENT" : null;
  const child = await childOf(env, user);
  if (!child) return null;
  if (room.child_id === child.id) return "CHILD";
  if (room.status === "WAITING" && (await childCanJoin(env, room.parent_user_id, child.id))) return "CHILD";
  return null;
}

// Pays the child once per room: the prize for a win, a small consolation for a loss,
// for up to REWARDED_ROOMS_PER_DAY rooms per Thailand-time day.
async function reward(env: Env, room: Room, winner: Side) {
  if (!room.child_id) return 0;
  const day = thaiDay();
  const counted = await env.DB.prepare(
    "SELECT count(*) AS n FROM arena_rooms WHERE child_id = ? AND reward_day = ? AND reward_points > 0",
  ).bind(room.child_id, day).first<{ n: number }>();
  const points = (counted?.n ?? 0) >= REWARDED_ROOMS_PER_DAY ? 0 : winner === "CHILD" ? room.prize : LOSS_CONSOLATION;
  if (points <= 0) return 0;
  try {
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO point_transactions
           (id, child_id, created_by, transaction_type, points, reason, reference_type, reference_id)
         VALUES (?, ?, ?, 'EARN', ?, ?, 'ARENA', ?)`,
      ).bind(crypto.randomUUID(), room.child_id, room.parent_user_id, points,
        winner === "CHILD" ? "⚔️ ชนะ Arena" : "⚔️ สู้เต็มที่ใน Arena", room.id),
      env.DB.prepare("UPDATE arena_rooms SET reward_points = ?, reward_day = ? WHERE id = ?").bind(points, day, room.id),
    ]);
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    if (message.includes("UNIQUE constraint failed")) return 0;
    throw cause;
  }
  return points;
}

// Every monster on the child's team earns XP: more for a win, a bonus for the MVP,
// for up to XP_ROOMS_PER_DAY rooms per Thailand-time day. Claiming xp_day first
// makes sure a room only ever hands out XP once.
async function awardXp(env: Env, room: Room, state: BattleState) {
  if (!room.child_id || !state.winner) return;
  const day = thaiDay();
  const counted = await env.DB.prepare(
    "SELECT count(*) AS n FROM arena_rooms WHERE child_id = ? AND xp_day = ? AND xp_awards <> '[]'",
  ).bind(room.child_id, day).first<{ n: number }>();
  const claim = await env.DB.prepare("UPDATE arena_rooms SET xp_day = ? WHERE id = ? AND xp_day IS NULL").bind(day, room.id).run();
  if (!claim.meta.changes) return;
  if ((counted?.n ?? 0) >= XP_ROOMS_PER_DAY) {
    await env.DB.prepare("UPDATE arena_rooms SET xp_awards = '[]' WHERE id = ?").bind(room.id).run();
    return;
  }

  const best = state.winner === "CHILD" ? mvp(state) : null;
  const awards: XpAward[] = [];
  const updates: D1PreparedStatement[] = [];
  for (const fighter of state.teams.CHILD.fighters) {
    if (!fighter.owned_id) continue;
    const owned = await env.DB.prepare("SELECT level, xp FROM child_characters WHERE id = ? AND child_id = ?")
      .bind(fighter.owned_id, room.child_id).first<{ level: number; xp: number }>();
    if (!owned) continue; // released or evolved away mid-battle
    const gained = (state.winner === "CHILD" ? XP_WIN : XP_LOSS) + (best === fighter ? XP_MVP_BONUS : 0);
    const next = addXp(owned.level, owned.xp, gained);
    updates.push(env.DB.prepare("UPDATE child_characters SET level = ?, xp = ? WHERE id = ?").bind(next.level, next.xp, fighter.owned_id));
    awards.push({ name: fighter.name, gained, level: next.level, levels_gained: next.levelsGained });
  }
  // Rooms started before levels existed have no owned ids; leave xp_awards empty (NULL)
  // so the result screen doesn't claim the daily limit was hit.
  if (awards.length > 0) {
    updates.push(env.DB.prepare("UPDATE arena_rooms SET xp_awards = ? WHERE id = ?").bind(JSON.stringify(awards), room.id));
  }
  if (updates.length > 0) await env.DB.batch(updates);
}

async function chargeItem(env: Env, room: Room, userId: string, kind: ItemKind) {
  try {
    await env.DB.prepare(
      `INSERT INTO point_transactions
         (id, child_id, created_by, transaction_type, points, reason, reference_type, reference_id)
       VALUES (?, ?, ?, 'PURCHASE', ?, ?, 'ARENA_ITEM', ?)`,
    ).bind(crypto.randomUUID(), room.child_id, userId, -ITEMS[kind].price, "⚔️ ใช้ " + ITEMS[kind].icon + " " + ITEMS[kind].label + " ใน Arena", room.id).run();
  } catch (cause) {
    // Already charged for this room, or the balance dropped since the check: the item stays used.
    const message = cause instanceof Error ? cause.message : String(cause);
    if (message.includes("UNIQUE constraint failed") || message.includes("INSUFFICIENT_POINTS")) return;
    throw cause;
  }
}

async function saveState(env: Env, room: Room, state: BattleState) {
  const status = state.winner ? "FINISHED" : "BATTLE";
  const result = await env.DB.prepare(
    `UPDATE arena_rooms SET state = ?, status = ?, winner = ?, version = version + 1, updated_at = CURRENT_TIMESTAMP
     WHERE id = ? AND version = ?`,
  ).bind(JSON.stringify(state), status, state.winner, room.id, room.version).run();
  return result.meta.changes === 1;
}

export const HISTORY_LIMIT = 100;
export const RECENT_SHOWN = 20;

type HistoryRow = {
  code: string; difficulty: keyof typeof DIFFICULTY; winner: Side; state: string;
  reward_points: number; finished_at: string; parent_name: string;
};
type Monster = { id: string; name: string; image_url: string; type_primary: string; type_secondary: string | null; level?: number };

// Finished rooms for one child, against any parent: totals, streaks, per-difficulty
// record, the child's most successful monsters, and the latest rooms.
async function history(env: Env, childId: string) {
  const rows = await env.DB.prepare(
    `SELECT r.code, r.difficulty, r.winner, r.state, r.reward_points, r.updated_at AS finished_at, u.display_name AS parent_name
     FROM arena_rooms r JOIN users u ON u.id = r.parent_user_id
     WHERE r.child_id = ? AND r.status = 'FINISHED' AND r.state IS NOT NULL
     ORDER BY r.updated_at DESC LIMIT ?`,
  ).bind(childId, HISTORY_LIMIT).all<HistoryRow>();

  const games = rows.results.map((row) => ({ ...row, battle: JSON.parse(row.state) as BattleState }));
  const wins = games.filter((game) => game.winner === "CHILD").length;

  let current = 0;
  for (const game of games) {
    if (game.winner !== "CHILD") break;
    current += 1;
  }
  let best = 0;
  let run = 0;
  for (const game of [...games].reverse()) {
    run = game.winner === "CHILD" ? run + 1 : 0;
    best = Math.max(best, run);
  }

  const byDifficulty = Object.fromEntries((Object.keys(DIFFICULTY) as (keyof typeof DIFFICULTY)[]).map((level) => {
    const played = games.filter((game) => game.difficulty === level);
    return [level, { wins: played.filter((game) => game.winner === "CHILD").length, losses: played.filter((game) => game.winner !== "CHILD").length }];
  }));

  const monsters = new Map<string, { monster: Monster; battles: number; wins: number; damage: number; mvp: number }>();
  for (const game of games) {
    const star = mvp(game.battle);
    for (const fighter of game.battle.teams.CHILD.fighters) {
      const entry = monsters.get(fighter.id) ?? {
        monster: { id: fighter.id, name: fighter.name, image_url: fighter.image_url, type_primary: fighter.type_primary, type_secondary: fighter.type_secondary },
        battles: 0, wins: 0, damage: 0, mvp: 0,
      };
      entry.battles += 1;
      entry.wins += game.winner === "CHILD" ? 1 : 0;
      entry.damage += fighter.damageDealt;
      entry.mvp += star === fighter ? 1 : 0;
      monsters.set(fighter.id, entry);
    }
  }
  const topMonsters = [...monsters.values()]
    .sort((a, b) => b.wins - a.wins || b.damage - a.damage)
    .slice(0, 3);

  const pickTeam = (fighters: BattleState["teams"]["CHILD"]["fighters"]): Monster[] =>
    fighters.map(({ id, name, image_url, type_primary, type_secondary, level }) => ({ id, name, image_url, type_primary, type_secondary, level }));

  return {
    summary: {
      played: games.length,
      wins,
      losses: games.length - wins,
      win_rate: games.length ? Math.round((wins / games.length) * 100) : 0,
      current_streak: current,
      best_streak: best,
    },
    by_difficulty: byDifficulty,
    top_monsters: topMonsters,
    recent: games.slice(0, RECENT_SHOWN).map((game) => {
      const star = mvp(game.battle);
      return {
        code: game.code,
        difficulty: game.difficulty,
        winner: game.winner,
        finished_at: game.finished_at,
        parent_name: game.parent_name,
        rounds: game.battle.round,
        reward_points: game.reward_points,
        mvp: star ? { name: star.name, damage: star.damageDealt, side: game.winner } : null,
        child_team: pickTeam(game.battle.teams.CHILD.fighters),
        parent_team: pickTeam(game.battle.teams.PARENT.fighters),
      };
    }),
  };
}

export async function arenaRoutes(request: Request, env: Env, pathname: string) {
  const user = await getSessionUser(request, env);
  if (!user) return error(401, "UNAUTHENTICATED", "Please sign in.");

  if (pathname === "/api/arena/rooms" && request.method === "POST") {
    if (user.role !== "PARENT") return error(403, "FORBIDDEN", "Parent role required.");
    const parsed = createSchema.safeParse(await readJson<unknown>(request));
    if (!parsed.success) return error(400, "INVALID_REQUEST", "Invalid room settings.");
    const difficulty = DIFFICULTY[parsed.data.difficulty];

    const pool = await env.DB.prepare(
      `SELECT id, name, image_url, rarity, type_primary, type_secondary FROM characters
       WHERE is_active = 1 AND rarity IN (${difficulty.rarities.map(() => "?").join(",")})`,
    ).bind(...difficulty.rarities).all<CharacterInfo>();
    const team = [...pool.results].sort(() => rng() - 0.5).slice(0, PARENT_TEAM_SIZE);
    if (team.length === 0) return error(409, "NO_CHARACTERS", "No characters available.");

    // Retry a few codes in case one is already in use by an open room.
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const code = String(Math.floor(rng() * 10000)).padStart(4, "0");
      const id = crypto.randomUUID();
      try {
        await env.DB.prepare(
          `INSERT INTO arena_rooms (id, code, parent_user_id, difficulty, prize, auto_parent, status, parent_team, weather)
           VALUES (?, ?, ?, ?, ?, ?, 'WAITING', ?, ?)`,
        ).bind(id, code, user.id, parsed.data.difficulty, parsed.data.prize, parsed.data.autoParent ? 1 : 0, JSON.stringify(team), rollWeather(rng)).run();
      } catch (cause) {
        const message = cause instanceof Error ? cause.message : String(cause);
        if (message.includes("UNIQUE constraint failed")) continue;
        throw cause;
      }
      const room = await loadRoom(env, code);
      return json(await view(env, room!, "PARENT"), { status: 201 });
    }
    return error(503, "NO_CODE", "ลองสร้างห้องใหม่อีกครั้ง");
  }

  if (pathname === "/api/arena/history" && request.method === "GET") {
    let childId: string | null;
    if (user.role === "CHILD") {
      childId = (await childOf(env, user))?.id ?? null;
    } else {
      childId = new URL(request.url).searchParams.get("childId");
      if (childId && !(await childCanJoin(env, user.id, childId))) childId = null;
    }
    if (!childId) return error(404, "CHILD_NOT_FOUND", "Child not found.");
    return json(await history(env, childId));
  }

  if (pathname === "/api/arena/rooms/current" && request.method === "GET") {
    const child = user.role === "CHILD" ? await childOf(env, user) : null;
    const room = user.role === "PARENT"
      ? await env.DB.prepare(`SELECT * FROM arena_rooms WHERE parent_user_id = ? AND status IN ${OPEN_STATUSES} ORDER BY created_at DESC LIMIT 1`).bind(user.id).first<Room>()
      : child
        ? await env.DB.prepare(`SELECT * FROM arena_rooms WHERE child_id = ? AND status IN ('PICKING','BATTLE') ORDER BY created_at DESC LIMIT 1`).bind(child.id).first<Room>()
        : null;
    return json(room ? await view(env, room, user.role === "PARENT" ? "PARENT" : "CHILD") : { room: null });
  }

  const match = pathname.match(/^\/api\/arena\/rooms\/(\d{4})(?:\/(join|team|action|cancel|emote))?$/);
  if (!match) return null;
  const [, code, verb] = match;
  const room = await loadRoom(env, code);
  if (!room) return error(404, "ROOM_NOT_FOUND", "ไม่พบห้องนี้");
  const side = await roleFor(env, user, room);
  if (!side) return error(404, "ROOM_NOT_FOUND", "ไม่พบห้องนี้");

  if (!verb && request.method === "GET") return json(await view(env, room, side));
  if (request.method !== "POST") return null;

  if (verb === "emote") {
    if (room.status !== "BATTLE" && room.status !== "FINISHED") return error(409, "NOT_IN_BATTLE", "ยังไม่เริ่มการต่อสู้");
    const parsed = emoteSchema.safeParse(await readJson<unknown>(request));
    if (!parsed.success) return error(400, "INVALID_EMOTE", "Unknown emoji.");
    const emotes = room.emotes ? JSON.parse(room.emotes) as Emote[] : [];
    const now = Date.now();
    if (emotes.some((emote) => emote.side === side && now - emote.at < EMOTE_COOLDOWN_MS)) {
      return error(429, "EMOTE_COOLDOWN", "ส่งเร็วไปนิด");
    }
    const next = [...emotes, { seq: room.emote_seq + 1, side, emoji: parsed.data.emoji, at: now }].slice(-EMOTES_KEPT);
    // Compare-and-swap on emote_seq so two emotes at once don't overwrite each other.
    const result = await env.DB.prepare(
      "UPDATE arena_rooms SET emotes = ?, emote_seq = emote_seq + 1 WHERE id = ? AND emote_seq = ?",
    ).bind(JSON.stringify(next), room.id, room.emote_seq).run();
    if (!result.meta.changes) return error(409, "EMOTE_BUSY", "ลองอีกครั้ง");
    return json({ emote_seq: room.emote_seq + 1 });
  }

  if (verb === "cancel") {
    if (side !== "PARENT") return error(403, "FORBIDDEN", "Parent role required.");
    await env.DB.prepare(`UPDATE arena_rooms SET status = 'CANCELLED', version = version + 1 WHERE id = ? AND status IN ${OPEN_STATUSES}`).bind(room.id).run();
    return json({ ok: true });
  }

  if (verb === "join") {
    if (side !== "CHILD") return error(403, "FORBIDDEN", "Child role required.");
    const child = (await childOf(env, user))!;
    if (room.child_id === child.id) return json(await view(env, room, side));
    const result = await env.DB.prepare(
      "UPDATE arena_rooms SET child_id = ?, status = 'PICKING', version = version + 1 WHERE id = ? AND status = 'WAITING'",
    ).bind(child.id, room.id).run();
    if (!result.meta.changes) return error(409, "ROOM_TAKEN", "ห้องนี้มีคนเข้าแล้ว");
    return json(await view(env, (await loadRoom(env, code))!, side));
  }

  if (verb === "team") {
    if (side !== "CHILD" || room.status !== "PICKING") return error(409, "NOT_PICKING", "ตอนนี้เลือกทีมไม่ได้");
    const parsed = teamSchema.safeParse(await readJson<unknown>(request));
    if (!parsed.success || new Set(parsed.data.childCharacterIds).size !== parsed.data.childCharacterIds.length) {
      return error(400, "INVALID_TEAM", "เลือก 1-3 ตัวที่ไม่ซ้ำกัน");
    }
    const ids = parsed.data.childCharacterIds;
    const owned = await env.DB.prepare(
      `SELECT cc.id AS owned_id, cc.level, c.id, c.name, c.image_url, c.rarity, c.type_primary, c.type_secondary
       FROM child_characters cc JOIN characters c ON c.id = cc.character_id
       WHERE cc.child_id = ? AND cc.status = 'OWNED' AND cc.id IN (${ids.map(() => "?").join(",")})`,
    ).bind(room.child_id, ...ids).all<CharacterInfo & { owned_id: string; level: number }>();
    if (owned.results.length !== ids.length) return error(400, "INVALID_TEAM", "เลือกได้เฉพาะตัวใน Collection");
    const ordered = ids.map((id) => owned.results.find((row) => row.owned_id === id)!);

    const parentLevel = parentLevelFor(ordered.map((monster) => monster.level));
    const parentTeam = (JSON.parse(room.parent_team) as CharacterInfo[]).map((monster) => ({ ...monster, level: parentLevel }));
    const childTeam = makeTeam(ordered);
    if (parsed.data.item) childTeam.item = { kind: parsed.data.item, used: false };
    const weather = room.weather && (WEATHER_KINDS as string[]).includes(room.weather) ? room.weather : "CLEAR";
    const state = startBattle(childTeam, makeTeam(parentTeam, DIFFICULTY[room.difficulty].scale), weather);
    if (!(await saveState(env, room, state))) return error(409, "STALE", "มีการเปลี่ยนแปลง ลองใหม่อีกครั้ง");
    return json(await view(env, (await loadRoom(env, code))!, side));
  }

  if (verb === "action") {
    if (room.status !== "BATTLE" || !room.state) return error(409, "NOT_IN_BATTLE", "ยังไม่เริ่มการต่อสู้");
    const parsed = actionSchema.safeParse(await readJson<unknown>(request));
    if (!parsed.success) return error(400, "INVALID_REQUEST", "Invalid action.");
    if (parsed.data.version !== room.version) return error(409, "STALE", "มีการเปลี่ยนแปลง ลองใหม่อีกครั้ง");
    if (side === "PARENT" && room.auto_parent) return error(409, "AUTO_PARENT", "ห้องนี้ให้ระบบเล่นแทนผู้ปกครอง");

    // Items are paid for when used: check the balance up front, charge after the move is saved.
    const itemKind = parsed.data.action === "ITEM" ? (JSON.parse(room.state) as BattleState).teams[side].item?.kind : undefined;
    if (itemKind) {
      const balance = await env.DB.prepare("SELECT points_balance FROM children WHERE id = ?").bind(room.child_id).first<{ points_balance: number }>();
      if ((balance?.points_balance ?? 0) < ITEMS[itemKind].price) return error(409, "INSUFFICIENT_POINTS", "แต้มไม่พอใช้ไอเทม");
    }

    let state: BattleState;
    try {
      state = applyAction(JSON.parse(room.state) as BattleState, side, parsed.data.action, rng, parsed.data.target);
      // With "let the system play", the parent's reply happens in the same request.
      if (room.auto_parent && !state.winner && state.turn === "PARENT") {
        state = aiTurn(state, "PARENT", rng);
      }
    } catch (cause) {
      if (cause instanceof ArenaError) return error(409, "INVALID_ACTION", cause.message);
      throw cause;
    }

    if (!(await saveState(env, room, state))) return error(409, "STALE", "มีการเปลี่ยนแปลง ลองใหม่อีกครั้ง");
    if (itemKind) await chargeItem(env, room, user.id, itemKind);
    if (state.winner) {
      await reward(env, room, state.winner);
      await awardXp(env, room, state);
    }
    return json(await view(env, (await loadRoom(env, code))!, side));
  }

  return null;
}
