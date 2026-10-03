import { z } from 'zod';
import type { Env } from '../types';
import { getSessionUser } from '../lib/session';
import { error, json, readJson } from '../lib/http';
import { thaiDay } from './quests';
import { typeMultiplier } from '../../shared/battle';
import { aiTurn, applyAction, ArenaError, makeTeam, startBattle, type BattleState } from '../../shared/arena';
import { battleStars, missingTypes, STAGES, type AdventureMonster, type AdventureRun } from '../../shared/adventure';

type Row = Omit<AdventureRun, 'state'> & { child_id: string; state: string };
type Monster = Omit<AdventureMonster, 'pickId' | 'loan'>;
const rng = () => crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296;
const startSchema = z.object({ stageId: z.number().int().min(1).max(120), team: z.array(z.string().min(1).max(160)).min(1).max(3) });
const actionSchema = z.object({ version: z.number().int().min(0), action: z.enum(['ATTACK', 'SPECIAL', 'GUARD', 'ULTIMATE', 'SWITCH']), target: z.number().int().min(0).max(2).optional() });
const decode = (row: Row): AdventureRun => ({ id: row.id, stage_id: row.stage_id, state: JSON.parse(row.state), version: row.version, status: row.status, stars: row.stars, xp: row.xp });
async function roster(env: Env, childId: string, stageId: number) {
  const stage = STAGES[stageId - 1];
  const owned = await env.DB.prepare(`SELECT c.id, c.name, c.image_url, c.rarity, c.type_primary, c.type_secondary, cc.level, cc.id AS pickId
    FROM child_characters cc JOIN characters c ON c.id = cc.character_id WHERE cc.child_id = ? AND cc.status = 'OWNED' AND c.is_active = 1`).bind(childId).all<Monster & { pickId: string }>();
  const all = await env.DB.prepare('SELECT id, name, image_url, rarity, type_primary, type_secondary FROM characters WHERE is_active = 1 ORDER BY price DESC, id').all<Omit<Monster, 'level'>>();
  const progress = await env.DB.prepare('SELECT cleared FROM adventure_progress WHERE child_id = ?').bind(childId).first<{ cleared: number }>();
  const level = Math.min(10, 1 + Math.floor((progress?.cleared ?? 0) / 15));
  // Loaners cover every entrance requirement, without granting permanent ownership.
  const loanRarities = (progress?.cleared ?? 0) >= 75 ? ['EPIC'] : (progress?.cleared ?? 0) >= 30 ? ['RARE', 'EPIC'] : ['COMMON', 'RARE'];
  const loans = [...new Set([...stage.requiredTypes, 'Electric', 'Water', 'Grass', 'Fire'])].map(type =>
    all.results.find(mon => mon.type_primary === type && loanRarities.includes(mon.rarity)) ?? all.results.find(mon => mon.type_primary === type || mon.type_secondary === type),
  ).filter((mon): mon is Omit<Monster, 'level'> => Boolean(mon));
  const unique = [...new Map(loans.map(mon => [mon.id, mon])).values()];
  return { characters: [...owned.results.map(mon => ({ ...mon, pickId: 'owned:' + mon.pickId, loan: false })), ...unique.map(mon => ({ ...mon, level, pickId: 'loan:' + mon.id, loan: true }))] as AdventureMonster[], all: all.results };
}
async function view(env: Env, childId: string) {
  const day = thaiDay();
  const [progress, used, records, active] = await Promise.all([
    env.DB.prepare('SELECT cleared, xp FROM adventure_progress WHERE child_id = ?').bind(childId).first<{ cleared: number; xp: number }>(),
    env.DB.prepare('SELECT COUNT(*) AS n FROM adventure_runs WHERE child_id = ? AND day = ?').bind(childId, day).first<{ n: number }>(),
    env.DB.prepare('SELECT stage_id, stars FROM adventure_records WHERE child_id = ? ORDER BY stage_id').bind(childId).all(),
    env.DB.prepare("SELECT * FROM adventure_runs WHERE child_id = ? AND status = 'BATTLE'").bind(childId).first<Row>(),
  ]);
  const resetsAt = new Date(new Date(day + 'T00:00:00+07:00').getTime() + 86400000).toISOString();
  return { cleared: progress?.cleared ?? 0, xp: progress?.xp ?? 0, day, resetsAt, used: used?.n ?? 0, records: records.results, active: active ? decode(active) : null };
}
export async function adventureRoutes(request: Request, env: Env, pathname: string) {
  const user = await getSessionUser(request, env);
  if (!user) return error(401, 'UNAUTHENTICATED', 'กรุณาเข้าสู่ระบบ');
  if (user.role !== 'CHILD') return error(403, 'FORBIDDEN', 'โหมดผจญภัยสำหรับเด็ก');
  const child = await env.DB.prepare('SELECT id FROM children WHERE user_id = ?').bind(user.id).first<{ id: string }>();
  if (!child) return error(404, 'CHILD_NOT_FOUND', 'ไม่พบโปรไฟล์เด็ก');
  if (pathname === '/api/adventure' && request.method === 'GET') return json(await view(env, child.id));
  if (pathname === '/api/adventure/roster' && request.method === 'GET') {
    const stageId = Number(new URL(request.url).searchParams.get('stageId'));
    if (!Number.isInteger(stageId) || !STAGES[stageId - 1]) return error(400, 'INVALID_STAGE', 'ไม่พบด่าน');
    const { characters } = await roster(env, child.id, stageId);
    return json({ characters });
  }
  if (pathname === '/api/adventure/start' && request.method === 'POST') {
    const parsed = startSchema.safeParse(await readJson(request));
    if (!parsed.success || new Set(parsed.data.team).size !== parsed.data.team.length) return error(400, 'INVALID_TEAM', 'เลือกทีม 1–3 ตัวที่ไม่ซ้ำกัน');
    const { stageId, team: ids } = parsed.data;
    const stage = STAGES[stageId - 1];
    const profile = await view(env, child.id);
    if (profile.active) return error(409, 'ACTIVE_BATTLE', 'มีการต่อสู้ค้างอยู่ กลับไปเล่นต่อก่อนนะ');
    if (stageId > profile.cleared + 1) return error(409, 'LOCKED', 'ผ่านด่านก่อนหน้าก่อนนะ');
    const { characters, all } = await roster(env, child.id, stageId);
    const team = ids.map(id => characters.find(mon => mon.pickId === id));
    if (team.some(mon => !mon)) return error(400, 'INVALID_TEAM', 'เลือกได้เฉพาะโปเกมอนของเราและเพื่อนให้ยืมในด่านนี้');
    const selected = team as AdventureMonster[];
    if (missingTypes(stage.requiredTypes, selected).length) return error(400, 'MISSING_TYPE', 'ทีมยังไม่มีธาตุที่สนามกำหนด');
    if (new Set(selected.map(mon => mon.id)).size !== selected.length) return error(400, 'DUPLICATE_SPECIES', 'เลือกโปเกมอนต่างตัวกันนะ');
    const pool = all.filter(mon => (mon.type_primary === stage.enemyType || mon.type_secondary === stage.enemyType) && typeMultiplier(stage.requiredTypes[0], mon) > 1);
    if (!pool.length) return error(409, 'NO_OPPONENTS', 'สนามกำลังเตรียมคู่แข่ง ลองอีกครั้งภายหลัง');
    const shuffled = [...pool].sort(() => rng() - 0.5);
    const enemies = Array.from({ length: stage.enemyCount }, (_, i) => ({ ...shuffled[i % shuffled.length], rarity: stage.region < 2 ? 'COMMON' : stage.region < 5 ? 'RARE' : 'EPIC', level: stage.enemyLevel }));
    const state = startBattle(makeTeam(selected), makeTeam(enemies, stage.scale), stage.weather, stage.theme);
    const id = crypto.randomUUID();
    try {
      await env.DB.prepare('INSERT INTO adventure_runs(id, child_id, stage_id, day, state) VALUES (?, ?, ?, ?, ?)').bind(id, child.id, stageId, thaiDay(), JSON.stringify(state)).run();
    } catch (cause) {
      const message = String(cause);
      if (message.includes('ADVENTURE_DAILY_LIMIT')) return error(429, 'DAILY_LIMIT', 'วันนี้ผจญภัยครบ 5 ครั้งแล้ว พักก่อนแล้วกลับมาพรุ่งนี้นะ');
      if (message.includes('UNIQUE')) return error(409, 'ACTIVE_BATTLE', 'มีการต่อสู้ค้างอยู่ กดกลับไปเล่นต่อ');
      if (message.includes('ADVENTURE_LOCKED')) return error(409, 'LOCKED', 'ผ่านด่านก่อนหน้าก่อนนะ');
      throw cause;
    }
    return json({ run: decode((await env.DB.prepare('SELECT * FROM adventure_runs WHERE id = ?').bind(id).first<Row>())!) }, { status: 201 });
  }
  const match = pathname.match(/^\/api\/adventure\/runs\/([^/]+)\/(action|abandon)$/);
  if (!match || request.method !== 'POST') return null;
  const row = await env.DB.prepare('SELECT * FROM adventure_runs WHERE id = ? AND child_id = ?').bind(match[1], child.id).first<Row>();
  if (!row) return error(404, 'NOT_FOUND', 'ไม่พบการต่อสู้');
  if (row.status !== 'BATTLE') return error(409, 'FINISHED', 'การต่อสู้นี้จบแล้ว');
  if (match[2] === 'abandon') {
    await env.DB.prepare("UPDATE adventure_runs SET status = 'ABANDONED', version = version + 1 WHERE id = ? AND status = 'BATTLE' AND version = ?").bind(row.id, row.version).run();
    return json(await view(env, child.id));
  }
  const parsed = actionSchema.safeParse(await readJson(request));
  if (!parsed.success) return error(400, 'INVALID_ACTION', 'เลือกคำสั่งอีกครั้ง');
  if (row.version !== parsed.data.version) return error(409, 'STALE', 'เกมเปลี่ยนไปแล้ว กดโหลดการต่อสู้ใหม่');
  let state: BattleState;
  try {
    state = applyAction(JSON.parse(row.state), 'CHILD', parsed.data.action, rng, parsed.data.target);
    if (!state.winner && state.turn === 'PARENT') state = aiTurn(state, 'PARENT', rng);
  } catch (cause) {
    if (cause instanceof ArenaError) return error(409, 'INVALID_ACTION', cause.message);
    throw cause;
  }
  const stars = battleStars(state);
  const progress = await env.DB.prepare('SELECT cleared FROM adventure_progress WHERE child_id = ?').bind(child.id).first<{ cleared: number }>();
  const xp = state.winner ? (stars ? row.stage_id > (progress?.cleared ?? 0) ? STAGES[row.stage_id - 1].xp : 0 : 10) : 0;
  const saved = await env.DB.prepare(`UPDATE adventure_runs SET state = ?, version = version + 1, status = ?, stars = ?, xp = ?
    WHERE id = ? AND version = ? AND status = 'BATTLE'`).bind(JSON.stringify(state), state.winner ? 'FINISHED' : 'BATTLE', stars, xp, row.id, row.version).run();
  if (!saved.meta.changes) return error(409, 'STALE', 'เกมเปลี่ยนไปแล้ว กดโหลดการต่อสู้ใหม่');
  return json({ run: decode({ ...row, state: JSON.stringify(state), version: row.version + 1, status: state.winner ? 'FINISHED' : 'BATTLE', stars, xp }) });
}
