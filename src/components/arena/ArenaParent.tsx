import { FormEvent, useEffect, useState } from "react";
import { api } from "../../lib/api";
import { TypeBadges } from "../TypeBadge";
import BattleView from "./BattleView";
import { DIFFICULTY_LABEL, useRoom, type RoomView } from "./useRoom";

type Difficulty = keyof typeof DIFFICULTY_LABEL;
const DIFFICULTY_HINT: Record<Difficulty, string> = {
  EASY: "ตัว COMMON/RARE พลัง ×0.85",
  NORMAL: "ไม่มีตัวตำนาน พลังปกติ",
  HARD: "สุ่มได้ทุกตัว พลัง ×1.1",
};

export default function ArenaParent() {
  const { view, setView } = useRoom(null);
  const [loaded, setLoaded] = useState(false);
  const [difficulty, setDifficulty] = useState<Difficulty>("NORMAL");
  const [prize, setPrize] = useState(50);
  const [autoParent, setAutoParent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

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
      setView(await api<RoomView>("/api/arena/rooms", { method: "POST", body: JSON.stringify({ difficulty, prize, autoParent }) }));
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

  if (!view || view.room.status === "CANCELLED") {
    return (
      <section className="panel">
        <div className="section-heading"><h2>⚔️ สร้างห้อง Arena</h2><span>ให้ลูกมาท้าสู้</span></div>
        <form className="point-form" onSubmit={create}>
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
          <label>
            รางวัลถ้าลูกชนะ (0-200 แต้ม)
            <input className="reason-input" type="number" inputMode="numeric" min={0} max={200} step={1} value={prize} onChange={(e) => setPrize(Number(e.target.value))} required />
            <small className="muted">แพ้ได้ +10 · ลูกรับรางวัล Arena ได้วันละ 3 ห้อง</small>
          </label>
          <label className="arena-toggle">
            <input type="checkbox" checked={autoParent} onChange={(e) => setAutoParent(e.target.checked)} />
            ให้ระบบเล่นแทนฉัน
          </label>
          <button disabled={busy} className="submit-button earn" type="submit">{busy ? "กำลังสร้าง..." : "สร้างห้อง"}</button>
          {message && <p className="feedback">{message}</p>}
        </form>
      </section>
    );
  }

  if (view.room.status === "WAITING" || view.room.status === "PICKING") {
    return (
      <section className="panel arena-lobby">
        <div className="section-heading"><h2>⚔️ ห้อง Arena</h2><span>{DIFFICULTY_LABEL[view.room.difficulty]} · ชนะได้ ⭐ {view.room.prize}</span></div>
        <p className="muted">ให้ลูกกด "⚔️ Arena" แล้วใส่รหัสนี้</p>
        <div className="arena-code" aria-label={"รหัสห้อง " + view.room.code.split("").join(" ")}>{view.room.code}</div>
        <p className="arena-status">
          {view.room.status === "WAITING" ? "⏳ รอลูกเข้าห้อง..." : "🤔 " + view.room.child_name + " กำลังเลือกทีม..."}
        </p>
        <p className="arena-label">ทีมของคุณ (ลูกจะเห็นก่อนเลือกทีม)</p>
        <div className="arena-team-preview">
          {view.parent_team.map((monster) => (
            <div key={monster.id}>
              <img src={monster.image_url} alt={monster.name} />
              <strong>{monster.name}</strong>
              <TypeBadges primary={monster.type_primary} secondary={monster.type_secondary} iconOnly />
            </div>
          ))}
        </div>
        <button className="link-button login-alt" onClick={cancel}>ปิดห้อง</button>
      </section>
    );
  }

  return (
    <>
      <BattleView view={view} onView={setView} />
      {view.room.status === "FINISHED" && (
        <button className="submit-button earn arena-again" onClick={() => setView(null)}>สร้างห้องใหม่</button>
      )}
    </>
  );
}
