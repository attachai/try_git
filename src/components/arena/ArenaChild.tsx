import { FormEvent, useEffect, useState } from "react";
import { api } from "../../lib/api";
import { computeStats, typeMultiplier, weakTo } from "../../../shared/battle";
import { ITEMS, parentLevelFor, THEMES, WEATHER, weatherMultiplier, type ItemKind } from "../../../shared/arena";
import { TYPE_INFO, TypeBadges } from "../TypeBadge";
import ArenaHistory from "./ArenaHistory";
import BattleView from "./BattleView";
import { DIFFICULTY_LABEL, useRoom, type RoomView } from "./useRoom";

type Owned = { child_character_id: string; name: string; image_url: string; rarity: string; type_primary: string; type_secondary?: string | null; level: number };
const TEAM_MAX = 3;

type Props = { collection: Owned[]; onBack: () => void; onFinished: () => Promise<void> };

export default function ArenaChild({ collection, onBack, onFinished }: Props) {
  const { view, setView } = useRoom(null);
  const [code, setCode] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [item, setItem] = useState<ItemKind | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  // Refresh points once the battle ends, whoever landed the final hit, and after
  // using an item (it's paid for when used).
  const finished = view?.room.status === "FINISHED";
  const itemUsed = Boolean(view?.state?.teams.CHILD.item?.used);
  useEffect(() => {
    if (finished || itemUsed) onFinished().catch(() => undefined);
  }, [finished, itemUsed]);

  useEffect(() => {
    api<RoomView | { room: null }>("/api/arena/rooms/current")
      .then((current) => { if (current.room) setView(current as RoomView); })
      .catch(() => undefined);
  }, []);

  async function run(action: () => Promise<RoomView>) {
    if (busy) return;
    try {
      setBusy(true);
      setMessage("");
      setView(await action());
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "เกิดข้อผิดพลาด");
    } finally {
      setBusy(false);
    }
  }

  function join(event: FormEvent) {
    event.preventDefault();
    run(() => api<RoomView>("/api/arena/rooms/" + code + "/join", { method: "POST", body: "{}" })).catch(() => undefined);
  }

  function togglePick(id: string) {
    setPicked((current) => current.includes(id)
      ? current.filter((item) => item !== id)
      : current.length < TEAM_MAX ? [...current, id] : current);
  }

  function startFight() {
    if (!view) return;
    run(() => api<RoomView>("/api/arena/rooms/" + view.room.code + "/team", {
      method: "POST",
      body: JSON.stringify({ childCharacterIds: picked, item }),
    })).catch(() => undefined);
  }

  const back = <button className="link-button arena-back" onClick={onBack}>← กลับ</button>;

  if (!view || view.room.status === "CANCELLED") {
    return (
      <>
      <section className="panel">
        {back}
        <div className="section-heading"><h2>⚔️ Arena</h2><span>ท้าสู้พ่อแม่!</span></div>
        {view?.room.status === "CANCELLED" && <p className="feedback">ห้องนี้ถูกปิดแล้ว</p>}
        <form className="login-form" onSubmit={join}>
          <label>
            รหัสห้อง (ขอจากพ่อแม่)
            <input
              className="family-code-input"
              inputMode="numeric"
              pattern="\d{4}"
              maxLength={4}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              placeholder="0000"
              required
            />
          </label>
          <button className="submit-button earn" disabled={busy || code.length !== 4} type="submit">{busy ? "กำลังเข้า..." : "เข้าห้อง"}</button>
        </form>
        {message && <p className="feedback">{message}</p>}
      </section>
      <ArenaHistory />
      </>
    );
  }

  if (view.room.status === "PICKING") {
    const foes = view.parent_team;
    return (
      <>
        <section className="panel">
          {back}
          <div className="section-heading"><h2>ทีมของ {view.room.parent_name}</h2><span>{DIFFICULTY_LABEL[view.room.difficulty]} · ชนะได้ ⭐ {view.room.prize}</span></div>
          <div className="arena-team-preview">
            {foes.map((foe) => (
              <div key={foe.id}>
                <img src={foe.image_url} alt={foe.name} />
                <strong>{foe.name}</strong>
                <TypeBadges primary={foe.type_primary} secondary={foe.type_secondary} />
                <small>แพ้ทาง {weakTo(foe).map((type) => TYPE_INFO[type]?.icon).join("")}</small>
              </div>
            ))}
          </div>
        </section>

        <section className="panel">
          {view.room.theme && (
            <div className={"arena-theme-card theme-" + view.room.theme.toLowerCase()}>
              <strong>{THEMES[view.room.theme].icon} สนาม{THEMES[view.room.theme].label}</strong>
              <small>กฎพิเศษ: {THEMES[view.room.theme].rule}</small>
            </div>
          )}
          <div className={"arena-field field-" + view.room.weather.toLowerCase()}>
            <span>อากาศ: {WEATHER[view.room.weather].icon} {WEATHER[view.room.weather].label}</span>
            <small>
              {WEATHER[view.room.weather].boost.length ? "ช่วย " + WEATHER[view.room.weather].boost.map((type) => TYPE_INFO[type]?.icon).join("") + " +20%" : "ไม่มีผลกับธาตุ"}
              {WEATHER[view.room.weather].weaken.length ? " · กด " + WEATHER[view.room.weather].weaken.map((type) => TYPE_INFO[type]?.icon).join("") + " −20%" : ""}
              {" · เปลี่ยนทุก 4 รอบ"}
            </small>
          </div>
        </section>

        <section className="panel">
          <div className="section-heading"><h2>เลือกทีม</h2><span>แตะเรียงลำดับ 1-2-3</span></div>
          {collection.length === 0 ? <p className="muted">ยังไม่มีตัวละคร ไปหาจากร้านก่อนนะ</p> : (
            <div className="arena-pick-grid">
              {collection.map((monster) => {
                const order = picked.indexOf(monster.child_character_id);
                const beats = foes.filter((foe) => typeMultiplier(monster.type_primary, foe) > 1);
                const threats = foes.filter((foe) => typeMultiplier(foe.type_primary, monster) > 1);
                const stats = computeStats(monster);
                const field = weatherMultiplier(view.room.weather, monster.type_primary);
                return (
                  <button
                    key={monster.child_character_id}
                    className={"arena-pick" + (order >= 0 ? " picked" : "")}
                    onClick={() => togglePick(monster.child_character_id)}
                  >
                    {order >= 0 && <span className="arena-pick-order">{order + 1}</span>}
                    <img src={monster.image_url} alt="" />
                    <strong>{monster.name} <span className="level-chip">Lv.{monster.level}</span></strong>
                    <TypeBadges primary={monster.type_primary} secondary={monster.type_secondary} iconOnly />
                    <small>❤️{stats.hp} ⚔️{stats.atk} 🛡️{stats.def}</small>
                    {beats.length > 0 && <small className="arena-good">💪 ชนะ {beats.map((foe) => foe.name).join(", ")}</small>}
                    {threats.length > 0 && <small className="arena-bad">⚠️ แพ้ {threats.map((foe) => foe.name).join(", ")}</small>}
                    {field !== 1 && <small className={field > 1 ? "arena-good" : "arena-bad"}>{WEATHER[view.room.weather].icon} สนาม{field > 1 ? "ช่วย" : "กด"} ×{field}</small>}
                  </button>
                );
              })}
            </div>
          )}
          {picked.length > 0 && (
            <p className="muted">
              ทีม {view.room.parent_name} จะเป็น <span className="level-chip">Lv.{parentLevelFor(picked.map((id) => collection.find((monster) => monster.child_character_id === id)?.level ?? 1))}</span> ตามเลเวลเฉลี่ยทีมคุณ
              {picked.length < TEAM_MAX ? " · ลงน้อยกว่า 3 ตัว ได้ HP +20% ทุกตัว" : ""}
            </p>
          )}
          <p className="arena-label">🎒 พกไอเทม 1 ชิ้น (จ่ายแต้มเมื่อใช้)</p>
          <div className="arena-items">
            <button className={item === null ? "active" : ""} onClick={() => setItem(null)}>ไม่พก</button>
            {(Object.keys(ITEMS) as ItemKind[]).map((kind) => (
              <button key={kind} className={item === kind ? "active" : ""} onClick={() => setItem(kind)}>
                <strong>{ITEMS[kind].icon} {ITEMS[kind].label}</strong>
                <small>{ITEMS[kind].detail} · ⭐{ITEMS[kind].price}</small>
              </button>
            ))}
          </div>
          <button className="submit-button earn arena-start" disabled={busy || picked.length === 0} onClick={startFight}>
            {busy ? "กำลังเริ่ม..." : "⚔️ เริ่มสู้! (" + picked.length + " ตัว)"}
          </button>
          {message && <p className="feedback">{message}</p>}
        </section>
      </>
    );
  }

  return (
    <>
      {back}
      <BattleView view={view} onView={setView} />
      {view.room.status === "FINISHED" && (
        <button className="submit-button earn arena-again" onClick={() => { setView(null); setPicked([]); setCode(""); }}>เล่นห้องใหม่</button>
      )}
    </>
  );
}
