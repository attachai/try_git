import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { TypeBadges, typeLabel } from "./TypeBadge";

type Entry = {
  id: string; external_id: string | null; name: string; image_url: string; rarity: string;
  type_primary: string; type_secondary: string | null; price: number; evolves_from: string | null; registered: number;
};
type DexSet = { set: string; total: number; registered: number; bonus: number; claimed: boolean };
type Dex = { total: number; registered: number; entries: Entry[]; sets: DexSet[] };
type Filter = "all" | "have" | "missing";

const ALL_SET = "ALL";
// Sets shown before "ดูทั้งหมด"; the API already sorts them closest-to-complete first.
const SETS_PREVIEW = 4;

function howToGet(entry: Entry) {
  if (entry.price > 0) return "ซื้อในร้าน ⭐ " + entry.price + " หรือลุ้นจากกล่องสุ่ม";
  if (entry.evolves_from) return "วิวัฒนาการจาก " + entry.evolves_from;
  return "ยังไม่มีวิธีได้ตัวนี้";
}

type Props = {
  onChanged: () => Promise<void>;
  onCelebrate: (title: string, detail: string) => void;
};

export default function Pokedex({ onChanged, onCelebrate }: Props) {
  const [dex, setDex] = useState<Dex | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [selected, setSelected] = useState<string | null>(null);
  const [showAllSets, setShowAllSets] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function load() {
    setDex(await api<Dex>("/api/pokedex"));
  }

  useEffect(() => {
    load().catch(() => undefined);
  }, []);

  async function claim(set: DexSet) {
    if (busy) return;
    try {
      setBusy(true);
      setMessage("");
      await api("/api/pokedex/claim", { method: "POST", body: JSON.stringify({ set: set.set }) });
      await Promise.all([load(), onChanged()]);
      onCelebrate(set.set === ALL_SET ? "สะสมครบทุกตัว! 🏆" : "ครบชุด " + set.set + "! 📖", "ได้โบนัส +" + set.bonus + " คะแนน");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "รับรางวัลไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  if (!dex) return null;
  const percent = dex.total ? Math.round((dex.registered / dex.total) * 100) : 0;
  const typeSets = dex.sets.filter((set) => set.set !== ALL_SET);
  // Always keep claimable sets visible so a reward is never hidden behind the toggle.
  const visibleSets = showAllSets
    ? dex.sets
    : [
        ...typeSets.filter((set, index) => index < SETS_PREVIEW || (set.registered >= set.total && !set.claimed)),
        ...dex.sets.filter((set) => set.set === ALL_SET),
      ];
  const shown = dex.entries.filter((entry) =>
    filter === "all" ? true : filter === "have" ? entry.registered : !entry.registered);

  return (
    <>
      <section className="panel">
        <div className="section-heading"><h2>📖 สมุดสะสม</h2><span>{dex.registered}/{dex.total} ตัว</span></div>
        <div className="dex-progress" role="progressbar" aria-valuemin={0} aria-valuemax={dex.total} aria-valuenow={dex.registered}>
          <span style={{ width: percent + "%" }} />
        </div>
        <p className="muted dex-percent">สะสมแล้ว {percent}%</p>

        <h3 className="dex-subheading">โบนัสครบชุด</h3>
        <div className="dex-sets">
          {visibleSets.map((set) => {
            const complete = set.registered >= set.total;
            return (
              <div className={"dex-set" + (complete ? " complete" : "") + (set.set === ALL_SET ? " all" : "")} key={set.set}>
                <div>
                  <strong>{set.set === ALL_SET ? "🏆 ครบทุกตัว" : typeLabel(set.set)}</strong>
                  <small>{set.registered}/{set.total} · +{set.bonus}</small>
                  <span className="dex-set-bar"><span style={{ width: Math.round((set.registered / set.total) * 100) + "%" }} /></span>
                </div>
                {set.claimed ? (
                  <span className="quest-state done">✓ รับแล้ว</span>
                ) : complete ? (
                  <button className="quest-button approve" disabled={busy} onClick={() => claim(set)}>รับ +{set.bonus}</button>
                ) : null}
              </div>
            );
          })}
        </div>
        {typeSets.length > SETS_PREVIEW && (
          <button className="link-button dex-more" onClick={() => setShowAllSets(!showAllSets)}>
            {showAllSets ? "ย่อ" : "ดูทั้งหมด (" + typeSets.length + " ชุด)"}
          </button>
        )}
        {message && <p className="feedback">{message}</p>}
      </section>

      <section className="panel">
        <div className="segmented dex-filter">
          <button className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}>ทั้งหมด</button>
          <button className={filter === "have" ? "active" : ""} onClick={() => setFilter("have")}>มีแล้ว</button>
          <button className={filter === "missing" ? "active" : ""} onClick={() => setFilter("missing")}>ยังไม่มี</button>
        </div>
        <div className="dex-grid">
          {shown.map((entry) => (
            <button
              className={"dex-card" + (entry.registered ? "" : " missing") + (selected === entry.id ? " selected" : "")}
              key={entry.id}
              onClick={() => setSelected(selected === entry.id ? null : entry.id)}
            >
              <span className="dex-number">#{String(entry.external_id ?? "?").padStart(3, "0")}</span>
              <img src={entry.image_url} alt={entry.registered ? entry.name : "ยังไม่มี " + entry.name} loading="lazy" />
              <strong>{entry.name}</strong>
              <TypeBadges primary={entry.type_primary} secondary={entry.type_secondary} iconOnly />
              <span className={"rarity rarity-" + entry.rarity.toLowerCase()}>{entry.rarity}</span>
              {selected === entry.id && (
                entry.registered
                  ? <TypeBadges primary={entry.type_primary} secondary={entry.type_secondary} />
                  : <small className="dex-hint">{howToGet(entry)}</small>
              )}
            </button>
          ))}
        </div>
        {shown.length === 0 && <p className="muted">{filter === "missing" ? "สะสมครบแล้ว! 🎉" : "ยังไม่มีตัวละคร"}</p>}
      </section>
    </>
  );
}
