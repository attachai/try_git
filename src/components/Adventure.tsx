import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { api } from '../lib/api';
import { DAILY_ADVENTURE_LIMIT, REGIONS, STAGES, missingTypes, trainerTitle, type AdventureMonster, type AdventureRun, type AdventureView } from '../../shared/adventure';
import { activeFighter, specialCost, ultOf, THEMES, WEATHER, type Action } from '../../shared/arena';
import { TYPE_INFO } from '../../shared/types';
import { TypeBadges } from './TypeBadge';

const typeLabel = (type: string) => `${TYPE_INFO[type]?.icon ?? ''} ${TYPE_INFO[type]?.th ?? type}`;
const starsLabel = (stars: number) => '★'.repeat(stars) + '☆'.repeat(3 - stars);
export default function Adventure({ childName, onBack }: { childName: string; onBack: () => void }) {
  const [profile, setProfile] = useState<AdventureView | null>(null);
  const [region, setRegion] = useState(0);
  const [stageId, setStageId] = useState(1);
  const [roster, setRoster] = useState<AdventureMonster[]>([]);
  const [picks, setPicks] = useState<string[]>([]);
  const [run, setRun] = useState<AdventureRun | null>(null);
  const [busy, setBusy] = useState(false);
  const [loadingRoster, setLoadingRoster] = useState(false);
  const [message, setMessage] = useState('');
  const [confirmQuit, setConfirmQuit] = useState(false);
  const requestSeq = useRef(0);
  const initialized = useRef(false);
  async function load() {
    const data = await api<AdventureView>('/api/adventure');
    setProfile(data);
    if (!initialized.current) {
      const next = Math.min(120, data.cleared + 1);
      setStageId(next); setRegion(Math.floor((next - 1) / 15));
      initialized.current = true;
    }
    setRun(data.active);
  }
  useEffect(() => { void load().catch(error => setMessage(error.message)); }, []);
  // Refresh the daily allowance at Thailand midnight, also after returning to the tab.
  useEffect(() => {
    if (!profile) return;
    const refresh = () => { void load().catch(error => setMessage(error.message)); };
    const timer = window.setTimeout(refresh, Math.max(1000, new Date(profile.resetsAt).getTime() - Date.now() + 1000));
    const visible = () => { if (document.visibilityState === 'visible') refresh(); };
    document.addEventListener('visibilitychange', visible);
    return () => { clearTimeout(timer); document.removeEventListener('visibilitychange', visible); };
  }, [profile?.resetsAt]);
  useEffect(() => {
    const seq = ++requestSeq.current;
    setRoster([]); setPicks([]); setLoadingRoster(true);
    api<{ characters: AdventureMonster[] }>('/api/adventure/roster?stageId=' + stageId)
      .then(data => { if (seq === requestSeq.current) setRoster(data.characters); })
      .catch(error => { if (seq === requestSeq.current) setMessage(error.message); })
      .finally(() => { if (seq === requestSeq.current) setLoadingRoster(false); });
    return () => { requestSeq.current += 1; };
  }, [stageId]);
  const stage = STAGES[stageId - 1];
  const team = picks.map(id => roster.find(mon => mon.pickId === id)!).filter(Boolean);
  const missing = missingTypes(stage.requiredTypes, team);
  const remaining = Math.max(0, DAILY_ADVENTURE_LIMIT - (profile?.used ?? 0));
  const records = new Map(profile?.records.map(record => [record.stage_id, record.stars]) ?? []);
  const starTotal = [...records.values()].reduce((sum, stars) => sum + stars, 0);
  async function perform(work: () => Promise<void>) {
    setBusy(true); setMessage('');
    try { await work(); } catch (error) { setMessage(error instanceof Error ? error.message : 'ลองอีกครั้งนะ'); }
    finally { setBusy(false); }
  }
  function select(mon: AdventureMonster) {
    setPicks(previous => previous.includes(mon.pickId) ? previous.filter(id => id !== mon.pickId)
      : previous.length < 3 && !previous.some(id => roster.find(other => other.pickId === id)?.id === mon.id) ? [...previous, mon.pickId] : previous);
  }
  async function start() {
    const data = await api<{ run: AdventureRun }>('/api/adventure/start', { method: 'POST', body: JSON.stringify({ stageId, team: picks }) });
    setRun(data.run);
    setProfile(previous => previous ? { ...previous, used: previous.used + 1, active: data.run } : previous);
  }
  async function action(action: Action, target?: number) {
    if (!run) return;
    const data = await api<{ run: AdventureRun }>(`/api/adventure/runs/${run.id}/action`, { method: 'POST', body: JSON.stringify({ version: run.version, action, target }) });
    setRun(data.run);
    if (data.run.status === 'FINISHED') {
      const profile = await api<AdventureView>('/api/adventure');
      setProfile(profile);
    }
  }
  if (!profile) return <section className="adventure"><button onClick={onBack}>← กลับบ้าน</button><p role="status">{message || 'กำลังเปิดสมุดการเดินทาง…'}</p>{message && <button onClick={() => void perform(load)}>ลองโหลดใหม่</button>}</section>;
  if (run) {
    const battle = run.state;
    const current = STAGES[run.stage_id - 1];
    const energy = battle.teams.CHILD.energy;
    const finished = run.status === 'FINISHED';
    return <section className="adventure adventure-battle" style={{ '--region-color': REGIONS[current.region].color } as CSSProperties}>
      <div className="adventure-topline"><button onClick={onBack}>← กลับบ้าน · บันทึกเกมแล้ว</button><span>ด่าน {run.stage_id} / 120</span></div>
      <h2>{current.name}</h2><p>{THEMES[current.theme].label} · {WEATHER[battle.weather ?? 'CLEAR'].label} · เทิร์น {battle.round}</p>
      <div className="adventure-fight">
        {(['CHILD', 'PARENT'] as const).map(side => {
          const fighter = activeFighter(battle, side);
          return <div className={'adventure-fighter ' + side.toLowerCase()} key={side}>
            <small>{side === 'CHILD' ? `${childName} ในบทซาโตชิ` : current.boss ? '🏆 หัวหน้ายิม' : 'คู่แข่งประจำเส้นทาง'}</small>
            <img src={fighter.image_url} alt={fighter.name} /><h3>{fighter.name} <small>Lv.{fighter.level}</small></h3>
            <TypeBadges primary={fighter.type_primary} secondary={fighter.type_secondary} />
            <progress aria-label={'พลังชีวิต ' + fighter.name} value={fighter.hp} max={fighter.stats.hp} /><strong>HP {fighter.hp} / {fighter.stats.hp}</strong>
            <div className="adventure-bench">{battle.teams[side].fighters.map((mon, i) => <span key={i} title={mon.name} className={mon.hp <= 0 ? 'fainted' : ''}>{mon.hp > 0 ? '●' : '○'}</span>)}</div>
          </div>;
        })}
        <span className="adventure-vs" aria-hidden="true">VS</span>
      </div>
      {!finished && <>
        <div className="adventure-tip">💡 {current.hint}</div>
        <p className="adventure-energy">⚡ พลัง {energy}/5 · 💥 ไม้ตาย {ultOf(battle.teams.CHILD)}%</p>
        <div className="adventure-actions">
          <button disabled={busy} onClick={() => void perform(() => action('ATTACK'))}>👊 โจมตี<small>เพิ่มพลัง ใช้ได้ทุกตา</small></button>
          <button disabled={busy || energy < specialCost(battle)} onClick={() => void perform(() => action('SPECIAL'))}>✨ ท่าพิเศษ<small>ใช้ {specialCost(battle)} พลัง</small></button>
          <button disabled={busy} onClick={() => void perform(() => action('GUARD'))}>🛡️ ตั้งรับ<small>ลดความเสียหายและเก็บพลัง</small></button>
          <button disabled={busy || ultOf(battle.teams.CHILD) < 100} onClick={() => void perform(() => action('ULTIMATE'))}>💥 ท่าไม้ตาย<small>ใช้เมื่อหลอดเต็ม 100%</small></button>
        </div>
        <div className="adventure-switch">{battle.teams.CHILD.fighters.map((mon, i) => <button key={i} disabled={busy || i === battle.teams.CHILD.active || mon.hp <= 0} onClick={() => void perform(() => action('SWITCH', i))}>🔄 {mon.name} {i === battle.teams.CHILD.active ? '(กำลังสู้)' : ''}</button>)}</div>
      </>}
      <div className="adventure-log" role="log" aria-live="polite">{battle.log.slice(-5).map((line, i) => <p key={i}>{line}</p>)}</div>
      {finished && <div className="adventure-result" role="status">
        <span className="adventure-result-icon">{battle.winner === 'CHILD' ? '🏆' : '🌱'}</span>
        <h2>{battle.winner === 'CHILD' ? 'เก่งมาก! ผ่านด่านแล้ว' : 'วันนี้ได้เรียนรู้แล้ว ลองใหม่ได้เสมอ'}</h2>
        <div className="adventure-stars">{starsLabel(run.stars)}</div><p>ประสบการณ์ซาโตชิ +{run.xp} XP</p>
        {battle.winner === 'CHILD' && current.local === 15 && <p>🎖️ ได้เหรียญภูมิภาค {REGIONS[current.region].name} แล้ว!</p>}
        <p>{remaining ? `วันนี้ยังเล่นได้อีก ${remaining} ครั้ง` : 'ครบ 5 ครั้งแล้ว พรุ่งนี้เจอกันใหม่ ไปพักสายตากันนะ'}</p>
        <button className="primary" disabled={busy} onClick={() => { setRun(null); setStageId(Math.min(120, profile.cleared + 1)); setRegion(Math.floor(Math.min(119, profile.cleared) / 15)); }}>กลับแผนที่การเดินทาง →</button>
      </div>}
      {message && <div className="adventure-error" role="alert">{message}<button disabled={busy} onClick={() => void perform(load)}>โหลดการต่อสู้ใหม่</button></div>}
      {!finished && <div className="adventure-quit">{confirmQuit ? <><p>ออกจากการต่อสู้จะเสียโควตาครั้งนี้ แต่ด่านที่ผ่านยังอยู่ครบ</p><button disabled={busy} onClick={() => void perform(async () => { const data = await api<AdventureView>(`/api/adventure/runs/${run.id}/abandon`, { method: 'POST' }); setProfile(data); setRun(null); setConfirmQuit(false); })}>ยืนยันออกจากการต่อสู้</button><button disabled={busy} onClick={() => setConfirmQuit(false)}>สู้ต่อ</button></> : <button disabled={busy} onClick={() => setConfirmQuit(true)}>ออกจากการต่อสู้ครั้งนี้</button>}</div>}
    </section>;
  }
  return <section className="adventure" style={{ '--region-color': REGIONS[region].color } as CSSProperties}>
    <div className="adventure-topline"><button onClick={onBack}>← กลับบ้าน</button><span>เล่นเองได้ · วันละ 5 ครั้ง</span></div>
    <header className="adventure-hero"><div><span className="adventure-eyebrow">SATOSHI'S JOURNEY · 120 STAGES</span><h2>การเดินทางของซาโตชิ</h2><p>{childName} พร้อมออกเดินทางไหม? เลือกเพื่อนร่วมทีม เรียนรู้ธาตุ แล้วเติบโตไปด้วยกัน</p><strong>Lv.{1 + Math.floor(profile.xp / 100)} · {trainerTitle(profile.cleared)}</strong><progress aria-label="ประสบการณ์เทรนเนอร์" value={profile.xp % 100} max={100} /><small>{profile.xp} XP · อีก {100 - profile.xp % 100} XP เพิ่มเลเวล</small></div><span className="adventure-hero-icon" aria-hidden="true">🎒⚡</span></header>
    <div className="adventure-summary"><div><strong>{profile.cleared}<small>/120</small></strong><span>ด่านที่ผ่าน</span></div><div><strong>{remaining}<small>/5</small></strong><span>เล่นได้วันนี้</span></div><div><strong>{starTotal}<small>/360</small></strong><span>ดาวสะสม</span></div></div>
    <div className="adventure-daily"><div className="adventure-tickets" aria-label={`เหลือ ${remaining} ครั้ง`}>{Array.from({ length: 5 }, (_, i) => <span key={i} className={i >= remaining ? 'used' : ''}>🎟️</span>)}</div><p>เริ่มสู้ แพ้ เล่นซ้ำ หรือออกจากการต่อสู้ นับ 1 ครั้ง · เติมโควตา 00:00 เวลาไทย<br />{remaining === 0 ? '🌙 วันนี้พักก่อนนะ พรุ่งนี้ค่อยเดินทางต่อ' : 'ออกจากหน้าจอได้ทุกเมื่อ เกมบันทึกให้เล่นต่อโดยไม่ใช้โควตาเพิ่ม'}</p></div>
    <nav className="adventure-regions" aria-label="เลือกภูมิภาค">{REGIONS.map((item, i) => <button key={item.name} aria-pressed={region === i} className={region === i ? 'active' : ''} onClick={() => { setRegion(i); setStageId(Math.max(i * 15 + 1, Math.min(i * 15 + 15, profile.cleared + 1))); }}><span>{item.icon}</span>{item.name}<small>{profile.cleared >= (i + 1) * 15 ? '🎖️ ผ่านแล้ว' : profile.cleared < i * 15 ? '🔒 รอเดินทาง' : 'กำลังเดินทาง'}</small></button>)}</nav>
    <div className="adventure-region-heading"><h3>{REGIONS[region].icon} {REGIONS[region].name}</h3><p>{REGIONS[region].story}</p></div>
    <div className="adventure-map">{STAGES.filter(item => item.region === region).map(item => {
      const locked = item.id > profile.cleared + 1;
      return <button key={item.id} disabled={locked} aria-pressed={stageId === item.id} className={(stageId === item.id ? 'selected ' : '') + (records.has(item.id) ? 'cleared' : '')} onClick={() => setStageId(item.id)}><span>{locked ? '🔒' : item.boss ? '🏆' : records.has(item.id) ? '✓' : '⚔️'}</span><strong>{item.id}</strong><small>{item.local === 15 ? 'แชมป์ลีก' : item.boss ? 'ยิม' : 'เส้นทาง'}</small><em>{starsLabel(records.get(item.id) ?? 0)}</em></button>;
    })}</div>
    <section className="adventure-stage"><div className="adventure-eyebrow">{stage.boss ? '🏆 BOSS CHALLENGE' : '⚔️ NEXT ADVENTURE'} · ด่าน {stage.id}</div><h3>{stage.name}</h3><p>คู่แข่งธาตุ {typeLabel(stage.enemyType)} · Lv.{stage.enemyLevel} · {stage.enemyCount} ตัว</p><div className="adventure-requirements"><strong>บัตรผ่านสนาม</strong>{stage.requiredTypes.map(type => <span key={type} className={missing.includes(type) ? '' : 'ready'}>{missing.includes(type) ? '○' : '✓'} ต้องมี {typeLabel(type)}</span>)}</div><p className="adventure-tip">💡 {stage.hint}</p><p>เลือก 1–3 ตัว ต้องมีครบทุกธาตุที่สนามกำหนด ธาตุรองก็นับได้<br /><small>เพื่อนให้ยืมใช้ฟรี เฉพาะโหมดนี้ · ได้ XP เทรนเนอร์เมื่อผ่านครั้งแรก แพ้ได้ 10 XP · เล่นซ้ำเพื่อเพิ่มดาว</small></p>
      {loadingRoster ? <p role="status">กำลังเตรียมเพื่อนร่วมทีม…</p> : <div className="adventure-roster">{roster.map(mon => {
        const selected = picks.includes(mon.pickId);
        const duplicate = !selected && team.some(other => other.id === mon.id);
        return <button key={mon.pickId} aria-pressed={selected} className={selected ? 'selected' : ''} disabled={stage.id > profile.cleared + 1 || duplicate || !selected && picks.length >= 3} onClick={() => select(mon)}><span className="adventure-loan">{mon.loan ? '🤝 ให้ยืม' : '🎒 ของเรา'}</span><img src={mon.image_url} alt="" loading="lazy" /><strong>{mon.name}</strong><TypeBadges primary={mon.type_primary} secondary={mon.type_secondary} iconOnly /><small>Lv.{mon.level}{selected ? ' · ✓ เลือกแล้ว' : ''}</small></button>;
      })}</div>}
      <div className="adventure-start"><p>{stage.id > profile.cleared + 1 ? '🔒 ผ่านด่านก่อนหน้าเพื่อเปิดเส้นทางนี้' : !remaining ? '🌙 วันนี้ครบโควตาแล้ว กลับมาพรุ่งนี้นะ' : missing.length ? 'ยังขาดธาตุ ' + missing.map(typeLabel).join(' และ ') : '✅ ทีมพร้อมแล้ว! ' + team.map(mon => mon.name).join(' · ')}</p><button className="primary" disabled={busy || loadingRoster || !remaining || !picks.length || missing.length > 0 || stage.id > profile.cleared + 1} onClick={() => void perform(start)}>{busy ? 'กำลังเข้าสนาม…' : 'เข้าสนาม · ใช้ 1 ครั้ง →'}</button></div>
    </section>
    {message && <p className="adventure-error" role="alert">{message}</p>}
    <section className="adventure-passport"><h3>📔 พาสปอร์ตนักเดินทาง</h3><div>{REGIONS.map((item, i) => <span key={item.name} className={profile.cleared >= (i + 1) * 15 ? 'earned' : ''}>{profile.cleared >= (i + 1) * 15 ? '🎖️' : '◌'} {item.name}</span>)}</div><p>ดาวแต่ละด่าน: ผ่านด่าน ★ · ทีมไม่หมดสติ +★ · ชนะภายใน 15 เทิร์น +★</p>{profile.cleared === 120 ? <p>👑 เป็นแชมป์โลกแล้ว! เป้าหมายต่อไป: สะสม 360 ดาวด้วยทีมที่แตกต่างกัน</p> : <p>ผ่านบอสทุก 5 ด่าน · เก็บเหรียญทุก 15 ด่าน · ไม่เล่นวันไหนก็ไม่เสียความก้าวหน้า</p>}</section>
  </section>;
}
