import { beforeEach, describe, expect, it } from 'vitest';
import { env, SELF } from 'cloudflare:test';
import { STAGES, REGIONS, missingTypes, battleStars } from '../shared/adventure';
import { makeTeam, startBattle } from '../shared/arena';
import { typeMultiplier } from '../shared/battle';
import { thaiDay } from '../worker/routes/quests';

let cookie: string;
const post = (path: string, body: unknown, auth = cookie) => SELF.fetch('https://example.test/api/adventure' + path, { method: 'POST', headers: { cookie: auth, origin: 'https://example.test', 'content-type': 'application/json' }, body: JSON.stringify(body) });
const get = (path = '') => SELF.fetch('https://example.test/api/adventure' + path, { headers: { cookie } });
const mon = { id: 'test-electric', name: 'Pika', rarity: 'RARE', image_url: '', type_primary: 'Electric', type_secondary: null };
beforeEach(async () => {
  await env.DB.batch([
    env.DB.prepare('DELETE FROM adventure_runs'), env.DB.prepare('DELETE FROM adventure_records'), env.DB.prepare('DELETE FROM adventure_progress'),
    env.DB.prepare("INSERT OR IGNORE INTO families(id,name) VALUES('ad-family','Adventure')"),
    env.DB.prepare("INSERT OR IGNORE INTO users(id,display_name,role) VALUES('ad-child-user','Adventure Child','CHILD')"),
    env.DB.prepare("INSERT OR IGNORE INTO children(id,family_id,user_id,display_name) VALUES('ad-child','ad-family','ad-child-user','Adventure Child')"),
    env.DB.prepare("INSERT OR IGNORE INTO characters(id,name,slug,type_primary,image_url,price,rarity) VALUES('test-electric','Pika','ad-pika','Electric','',100,'RARE')"),
    env.DB.prepare("INSERT OR IGNORE INTO characters(id,name,slug,type_primary,image_url,price,rarity) VALUES('test-water','Water','ad-water','Water','',100,'COMMON')"),
    env.DB.prepare("INSERT OR IGNORE INTO characters(id,name,slug,type_primary,image_url,price,rarity) VALUES('test-fire','Fire','ad-fire','Fire','',100,'COMMON')"),
  ]);
  const id = crypto.randomUUID();
  await env.DB.prepare("INSERT INTO sessions(id,user_id,expires_at) VALUES(?,'ad-child-user',datetime('now','+1 day'))").bind(id).run();
  cookie = 'frg_session=' + id;
});
async function start() {
  const roster = await (await get('/roster?stageId=1')).json<{ characters: { pickId: string; type_primary: string }[] }>();
  return post('/start', { stageId: 1, team: [roster.characters.find(mon => mon.type_primary === 'Electric')!.pickId] });
}
async function finish(id: string, winner: 'CHILD' | 'PARENT' = 'CHILD') {
  const row = await env.DB.prepare('SELECT state FROM adventure_runs WHERE id = ?').bind(id).first<{ state: string }>();
  const state = JSON.parse(row!.state); state.winner = winner;
  await env.DB.prepare("UPDATE adventure_runs SET state = ?, status = 'FINISHED', stars = ?, xp = ? WHERE id = ?").bind(JSON.stringify(state), winner === 'CHILD' ? 3 : 0, winner === 'CHILD' ? 40 : 10, id).run();
}
describe('adventure campaign', () => {
  it('has 120 sequential stages, 15 per region, rising difficulty and valid requirements', () => {
    expect(STAGES).toHaveLength(120);
    REGIONS.forEach((_, r) => expect(STAGES.filter(stage => stage.region === r)).toHaveLength(15));
    STAGES.forEach((stage, i) => { expect(stage.id).toBe(i + 1); expect(stage.requiredTypes.length).toBeGreaterThan(0); if (i) expect(stage.scale).toBeGreaterThan(STAGES[i - 1].scale); });
    expect(STAGES[119].enemyLevel).toBeGreaterThan(STAGES[0].enemyLevel);
    expect(missingTypes(['Electric', 'Water'], [{ type_primary: 'Water', type_secondary: 'Electric' }])).toEqual([]);
    expect(missingTypes(['Electric'], [{ type_primary: 'Fire', type_secondary: null }])).toEqual(['Electric']);
  });
  it('gives stars for a win, surviving team and a quick victory', () => {
    const state = startBattle(makeTeam([mon]), makeTeam([mon]));
    expect(battleStars(state)).toBe(0); state.winner = 'CHILD'; expect(battleStars(state)).toBe(3);
    state.round = 16; expect(battleStars(state)).toBe(2);
  });
  it('offers loaners covering every unique entrance requirement', async () => {
    const representatives = [...new Map(STAGES.map(stage => [stage.requiredTypes.join(','), stage])).values()];
    for (const stage of representatives) {
      const response = await get('/roster?stageId=' + stage.id);
      expect(response.status).toBe(200);
      const { characters } = await response.json<{ characters: { type_primary: string; type_secondary: string | null; loan: boolean }[] }>();
      expect(missingTypes(stage.requiredTypes, characters.filter(mon => mon.loan))).toEqual([]);
    }
  });
  it('requires sign-in, validates entrance and locked stages without spending attempts', async () => {
    expect((await post('/start', { stageId: 1, team: ['loan:test-electric'] }, '')).status).toBe(401);
    expect((await post('/start', { stageId: 1, team: ['loan:test-fire'] })).status).toBe(400);
    expect((await post('/start', { stageId: 2, team: ['loan:test-water'] })).status).toBe(409);
    expect((await post('/start', { stageId: 1, team: ['owned:someone-elses'] })).status).toBe(400);
    const profile = await (await get()).json<{ used: number }>(); expect(profile.used).toBe(0);
  });
  it('starts independently with a loaner, resumes and rejects concurrent starts/stale actions', async () => {
    const started = await start(); expect(started.status).toBe(201);
    const { run } = await started.json<{ run: { id: string; version: number; state: ReturnType<typeof startBattle> } }>();
    run.state.teams.PARENT.fighters.forEach(mon => expect(typeMultiplier('Electric', mon)).toBeGreaterThan(1));
    const profile = await (await get()).json<{ active: { id: string }; used: number }>();
    expect(profile.active.id).toBe(run.id); expect(profile.used).toBe(1);
    expect((await start()).status).toBe(409);
    const action = await post(`/runs/${run.id}/action`, { version: 0, action: 'ATTACK' }); expect(action.status).toBe(200);
    expect((await post(`/runs/${run.id}/action`, { version: 0, action: 'ATTACK' })).status).toBe(409);
  });
  it('finishes through the action API and commits progress with the battle', async () => {
    const { run } = await (await start()).json<{ run: { id: string } }>();
    const row = await env.DB.prepare('SELECT state FROM adventure_runs WHERE id = ?').bind(run.id).first<{ state: string }>();
    const state = JSON.parse(row!.state);
    state.teams.PARENT.fighters.forEach((fighter: { hp: number; stats: { evade: number } }) => { fighter.hp = 1; fighter.stats.evade = 0; });
    await env.DB.prepare('UPDATE adventure_runs SET state = ? WHERE id = ?').bind(JSON.stringify(state), run.id).run();
    const result = await post(`/runs/${run.id}/action`, { version: 0, action: 'ATTACK' });
    expect(result.status).toBe(200);
    const body = await result.json<{ run: { status: string; xp: number; stars: number } }>();
    expect(body.run).toMatchObject({ status: 'FINISHED', xp: 40, stars: 3 });
    expect(await (await get()).json()).toMatchObject({ cleared: 1, xp: 40, active: null, used: 1 });
  });
  it('hides battles from other children and rejects parent access', async () => {
    const { run } = await (await start()).json<{ run: { id: string } }>();
    await env.DB.prepare("INSERT OR IGNORE INTO users(id,display_name,role) VALUES('ad-other','Other','CHILD')").run();
    await env.DB.prepare("INSERT OR IGNORE INTO children(id,family_id,user_id,display_name) VALUES('ad-other-child','ad-family','ad-other','Other')").run();
    await env.DB.prepare("INSERT OR IGNORE INTO users(id,display_name,role) VALUES('ad-parent','Parent','PARENT')").run();
    const other = crypto.randomUUID(); const parent = crypto.randomUUID();
    await env.DB.batch([
      env.DB.prepare("INSERT INTO sessions(id,user_id,expires_at) VALUES(?,'ad-other',datetime('now','+1 day'))").bind(other),
      env.DB.prepare("INSERT INTO sessions(id,user_id,expires_at) VALUES(?,'ad-parent',datetime('now','+1 day'))").bind(parent),
    ]);
    expect((await post(`/runs/${run.id}/action`, { version: 0, action: 'ATTACK' }, 'frg_session=' + other)).status).toBe(404);
    expect((await post('/start', { stageId: 1, team: ['loan:test-electric'] }, 'frg_session=' + parent)).status).toBe(403);
  });
  it('records first-clear XP and best stars atomically; replay cannot farm XP', async () => {
    const { run } = await (await start()).json<{ run: { id: string } }>();
    await finish(run.id);
    let profile = await (await get()).json<{ cleared: number; xp: number; records: { stars: number }[] }>();
    expect(profile.cleared).toBe(1); expect(profile.xp).toBe(40); expect(profile.records[0].stars).toBe(3);
    expect((await post(`/runs/${run.id}/action`, { version: 0, action: 'ATTACK' })).status).toBe(409);
    const replay = await (await start()).json<{ run: { id: string } }>(); await finish(replay.run.id);
    profile = await (await get()).json<typeof profile>(); expect(profile.xp).toBe(40); expect(profile.records[0].stars).toBe(3);
  });
  it('counts abandoned starts and losses; sixth start is blocked; tomorrow allowance resets', async () => {
    for (let i = 0; i < 5; i++) {
      const response = await start(); expect(response.status).toBe(201);
      const { run } = await response.json<{ run: { id: string } }>();
      if (i === 0) await finish(run.id, 'PARENT'); else expect((await post(`/runs/${run.id}/abandon`, {})).status).toBe(200);
    }
    expect((await start()).status).toBe(429);
    const profile = await (await get()).json<{ xp: number; used: number; cleared: number }>();
    expect(profile).toMatchObject({ xp: 10, used: 5, cleared: 0 });
    await env.DB.prepare("UPDATE adventure_runs SET day = '2000-01-01'").run();
    expect((await start()).status).toBe(201);
    expect(thaiDay(Date.parse('2026-10-03T16:59:59Z'))).toBe('2026-10-03');
    expect(thaiDay(Date.parse('2026-10-03T17:00:00Z'))).toBe('2026-10-04');
  });
  it('database guard enforces quota on racing inserts', async () => {
    const state = JSON.stringify(startBattle(makeTeam([mon]), makeTeam([mon])));
    const attempts = await Promise.allSettled(Array.from({ length: 8 }, (_, i) => env.DB.prepare("INSERT INTO adventure_runs(id,child_id,stage_id,day,state,status) VALUES(?,'ad-child',1,?,?,'ABANDONED')").bind('race-' + i, thaiDay(), state).run()));
    expect(attempts.filter(result => result.status === 'fulfilled')).toHaveLength(5);
  });
});
