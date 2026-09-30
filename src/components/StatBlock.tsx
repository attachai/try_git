import { archetypeLabel, computeStats, LEVEL_MAX, STAT_MAX, strongAgainst, weakTo, xpToNext, type Stats } from "../../shared/battle";
import { TYPE_INFO } from "./TypeBadge";

type Monster = { rarity: string; type_primary: string; type_secondary?: string | null; level?: number | null };

const ROWS: { key: keyof Stats; icon: string; label: string; suffix?: string }[] = [
  { key: "hp", icon: "❤️", label: "HP" },
  { key: "atk", icon: "⚔️", label: "โจมตี" },
  { key: "def", icon: "🛡️", label: "ป้องกัน" },
  { key: "eva", icon: "💨", label: "หลบ", suffix: "%" },
  { key: "crit", icon: "💥", label: "คริ", suffix: "%" },
];

function icons(types: string[]) {
  return types.map((type) => (
    <span key={type} title={TYPE_INFO[type]?.th ?? type}>{TYPE_INFO[type]?.icon ?? type}</span>
  ));
}

// Arena level with progress toward the next one.
export function LevelBar({ level, xp }: { level: number; xp: number }) {
  const need = xpToNext(level);
  return (
    <div className="level-bar" aria-label={"เลเวล " + level + (need ? " XP " + xp + " จาก " + need : " สูงสุด")}>
      <span className="level-chip">Lv.{level}</span>
      <span className="level-track"><span style={{ width: (need ? Math.round((xp / need) * 100) : 100) + "%" }} /></span>
      <small>{level >= LEVEL_MAX ? "MAX" : xp + "/" + need + " XP"}</small>
    </div>
  );
}

export default function StatBlock({ monster, showMatchups = true }: { monster: Monster; showMatchups?: boolean }) {
  const stats = computeStats(monster);
  const strong = strongAgainst(monster);
  const weak = weakTo(monster);

  return (
    <div className="stat-block">
      <div className="stat-archetype">{archetypeLabel(monster.type_primary)}</div>
      {ROWS.map((row) => (
        <div className="stat-row" key={row.key}>
          <span className="stat-name"><span aria-hidden="true">{row.icon}</span> {row.label}</span>
          <span className={"stat-bar stat-" + row.key} aria-hidden="true">
            <span style={{ width: Math.min(100, Math.round((stats[row.key] / STAT_MAX[row.key]) * 100)) + "%" }} />
          </span>
          <span className="stat-value">{stats[row.key]}{row.suffix ?? ""}</span>
        </div>
      ))}
      {showMatchups && (
        <div className="matchups">
          {strong.length > 0 && <div><span className="matchup-label">💪 ชนะทาง</span> <span className="matchup-icons">{icons(strong)}</span></div>}
          {weak.length > 0 && <div><span className="matchup-label">⚠️ แพ้ทาง</span> <span className="matchup-icons">{icons(weak)}</span></div>}
        </div>
      )}
    </div>
  );
}
