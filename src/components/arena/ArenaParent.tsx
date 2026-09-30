import { FormEvent, useEffect, useState } from "react";
import { api } from "../../lib/api";
import { TypeBadges } from "../TypeBadge";
import { THEME_KINDS, THEMES, type ThemeKind } from "../../../shared/arena";
import { TOURNAMENT_STAGES } from "../../../shared/progression";
import ArenaHistory from "./ArenaHistory";
import ArenaProfile from "./ArenaProfile";
import BattleView from "./BattleView";
import { DIFFICULTY_LABEL, useRoom, type RoomView } from "./useRoom";

type Difficulty = keyof typeof DIFFICULTY_LABEL;
const DIFFICULTY_HINT: Record<Difficulty, string> = {
  EASY: "ตัว COMMON/RARE พลัง ×0.85",
  NORMAL: "ไม่มีตัวตำนาน พลังปกติ",
  HARD: "สุ่มได้ทุกตัว พลัง ×1.1",
};

type Props = { kids: { id: string; display_name: string }[] };

export default function ArenaParent({ kids }: Props) {
  const { view, setView } = useRoom(null);
  const [loaded, setLoaded] = useState(false);
  const [difficulty, setDifficulty] = useState<Difficulty>("NORMAL");
  const [prize, setPrize] = useState(50);
  const [autoParent, setAutoParent] = useState(false);
  const [theme, setTheme] = useState<ThemeKind | "RANDOM">("RANDOM");
  const [mode, setMode] = useState<"DUEL" | "TOURNAMENT">("DUEL");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [historyChildId, setHistoryChildId] = useState("");

  useEffect(() => {
    api<RoomView | { room: null }>("/api/arena/rooms/current")
      .then((current) => { if (current.room) setView(current as RoomView); })
      .catch(() => undefined)
      .finally(() => setLoaded(true));
  }, []);

  async function create(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    try {
      setBusy(true);
      setMessage("");
      setView(await api<RoomView>("/api/arena/rooms", { method: "POST", body: JSON.stringify({ difficulty, prize, autoParent, theme, mode }) }));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "สร้างห้องไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  async function cancel() {
    if (!view || !window.confirm("ปิดห้อง " + view.room.code + "?")) return;
    await api("/api/arena/rooms/" + view.room.code + "/cancel", { method: "POST", body: "{}" }).catch(() => undefined);
    setView(null);
  }

  if (!loaded) return null;

  const historyKid = kids.find((kid) => kid.id === historyChildId) ?? kids[0];
  const historyPanel = historyKid && (
    <>
      {kids.length > 1 && (
        <label className="child-picker">
          ดูประวัติของ
          <select value={historyKid.id} onChange={(e) => setHistoryChildId(e.target.value)}>
            {kids.map((kid) => <option key={kid.id} value={kid.id}>{kid.display_name}</option>)}
          </select>
        </label>
      )}
      <ArenaProfile childId={historyKid.id} childName={historyKid.display_name} refreshKey={view?.room.version} />
      <ArenaHistory childId={historyKid.id} childName={historyKid.display_name} refreshKey={view?.room.version} />
    </>
  );

  if (!view || view.room.status === "CANCELLED") {
    return (
      <>
      <section className="panel">
        <div className="section-heading"><h2>⚔️ สร้างห้อง Arena</h2><span>ให้ลูกมาท้าสู้</span></div>
        <form className="point-form" onSubmit={create}>
          <div className="segmented arena-mode">
            <button type="button" className={mode === "DUEL" ? "active" : ""} onClick={() => setMode("DUEL")}>⚔️ ดวล 1 รอบ</button>
            <button type="button" className={mode === "TOURNAMENT" ? "active" : ""} onClick={() => setMode("TOURNAMENT")}>🏟️ ทัวร์นาเมนต์</button>
          </div>
          {mode === "TOURNAMENT" ? (
            <div className="arena-tournament-note">
              <strong>🏟️ สู้ 3 รอบติด กับทีมที่ระบบเล่น</strong>
              <small>{TOURNAMENT_STAGES.map((stage) => stage.icon + " " + stage.label).join(" → ")}</small>
              <small>ทีมลูกสู้ต่อเนื่อง ฟื้น HP 60% ระหว่างรอบ · ศัตรูเก่งขึ้นทุกรอบ</small>
            </div>
          ) : (
          <div>
            <p className="arena-label">ความยาก</p>
            <div className="segmented arena-difficulty">
              {(Object.keys(DIFFICULTY_LABEL) as Difficulty[]).map((key) => (
                <button type="button" key={key} className={difficulty === key ? "active" : ""} onClick={() => setDifficulty(key)}>
                  {DIFFICULTY_LABEL[key]}
                </button>
              ))}
            </div>
            <small className="muted">{DIFFICULTY_HINT[difficulty]}</small>
          </div>
          )}
          <div>
            <p className="arena-label">{mode === "TOURNAMENT" ? "สนามรอบแรก (รอบต่อไปสุ่มสนามใหม่)" : "สนาม"}</p>
            <div className="arena-themes">
              <button type="button" className={theme === "RANDOM" ? "active" : ""} onClick={() => setTheme("RANDOM")}>
                <strong>🎲 สุ่ม</strong><small>ลุ้นกันเลย</small>
              </button>
              {THEME_KINDS.map((kind) => (
                <button type="button" key={kind} className={"theme-" + kind.toLowerCase() + (theme === kind ? " active" : "")} onClick={() => setTheme(kind)}>
                  <strong>{THEMES[kind].icon} {THEMES[kind].label}</strong><small>{THEMES[kind].rule}</small>
                </button>
              ))}
            </div>
          </div>
          <label>
            {mode === "TOURNAMENT" ? "รางวัลถ้าลูกเป็นแชมป์ (0-200 แต้ม)" : "รางวัลถ้าลูกชนะ (0-200 แต้ม)"}
            <input className="reason-input" type="number" inputMode="numeric" min={0} max={200} step={1} value={prize} onChange={(e) => setPrize(Number(e.target.value))} required />
            <small className="muted">{mode === "TOURNAMENT" ? "ตกรอบได้ +10 ต่อรอบที่ไปถึง" : "แพ้ได้ +10"} · ลูกรับรางวัล Arena ได้วันละ 3 ห้อง</small>
          </label>
          {mode === "DUEL" && (
            <label className="arena-toggle">
              <input type="checkbox" checked={autoParent} onChange={(e) => setAutoParent(e.target.checked)} />
              ให้ระบบเล่นแทนฉัน
            </label>
          )}
          <button disabled={busy} className="submit-button earn" type="submit">{busy ? "กำลังสร้าง..." : "สร้างห้อง"}</button>
          {message && <p className="feedback">{message}</p>}
        </form>
      </section>
      {historyPanel}
      </>
    );
  }

  if (view.room.status === "WAITING" || view.room.status === "PICKING") {
    return (
      <section className="panel arena-lobby">
        <div className="section-heading">
          <h2>{view.room.mode === "TOURNAMENT" ? "🏟️ ทัวร์นาเมนต์" : "⚔️ ห้อง Arena"}</h2>
          <span>{view.room.mode === "TOURNAMENT" ? "แชมป์ได้" : DIFFICULTY_LABEL[view.room.difficulty] + " · ชนะได้"} ⭐ {view.room.prize}</span>
        </div>
        {view.room.theme && <p className="arena-status">{THEMES[view.room.theme].icon} {THEMES[view.room.theme].label}</p>}
        <p className="muted">ให้ลูกกด "⚔️ Arena" แล้วใส่รหัสนี้</p>
        <div className="arena-code" aria-label={"รหัสห้อง " + view.room.code.split("").join(" ")}>{view.room.code}</div>
        <p className="arena-status">
          {view.room.status === "WAITING" ? "⏳ รอลูกเข้าห้อง..." : "🤔 " + view.room.child_name + " กำลังเลือกทีม..."}
        </p>
        {(view.stage_teams ?? [view.parent_team]).map((team, round) => (
          <div key={round}>
            <p className="arena-label">
              {view.stage_teams ? TOURNAMENT_STAGES[round].icon + " " + TOURNAMENT_STAGES[round].label : "ทีมของคุณ (ลูกจะเห็นก่อนเลือกทีม)"}
            </p>
            <div className="arena-team-preview">
              {team.map((monster) => (
                <div key={monster.id}>
                  <img src={monster.image_url} alt={monster.name} />
                  <strong>{monster.name}</strong>
                  <TypeBadges primary={monster.type_primary} secondary={monster.type_secondary} iconOnly />
                </div>
              ))}
            </div>
          </div>
        ))}
        <button className="link-button login-alt" onClick={cancel}>ปิดห้อง</button>
      </section>
    );
  }

  return (
    <>
      <BattleView key={view.room.code + ":" + view.room.stage} view={view} onView={setView} />
      {view.room.status === "FINISHED" && (
        <>
          <button className="submit-button earn arena-again" onClick={() => setView(null)}>สร้างห้องใหม่</button>
          {historyPanel}
        </>
      )}
    </>
  );
}
