import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import type { RankKey } from "../../../shared/progression";

type Profile = {
  rank: { key: RankKey; icon: string; label: string; min: number; rp: number; next: { icon: string; label: string; min: number } | null };
  achievements: { code: string; icon: string; label: string; detail: string; points: number; unlocked_at: string | null }[];
  quests: { day: string; list: { code: string; icon: string; label: string; target: number; points: number; progress: number; done: boolean }[] };
};

type Props = {
  childId?: string; // parents pass the child to show; children see their own
  childName?: string;
  refreshKey?: unknown;
};

// Rank card, today's arena quests, and the achievement board.
export default function ArenaProfile({ childId, childName, refreshKey }: Props) {
  const [data, setData] = useState<Profile | null>(null);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    api<Profile>("/api/arena/profile" + (childId ? "?childId=" + encodeURIComponent(childId) : ""))
      .then(setData)
      .catch(() => undefined);
  }, [childId, refreshKey]);

  if (!data) return null;
  const { rank } = data;
  const span = rank.next ? rank.next.min - rank.min : 1;
  const percent = rank.next ? Math.round(((rank.rp - rank.min) / span) * 100) : 100;
  const unlocked = data.achievements.filter((entry) => entry.unlocked_at);
  // Unlocked first, then the ones still to get.
  const board = [...unlocked, ...data.achievements.filter((entry) => !entry.unlocked_at)];

  return (
    <section className="panel arena-profile">
      <div className={"rank-card rank-" + rank.key.toLowerCase()}>
        <span className="rank-icon">{rank.icon}</span>
        <div>
          <small>แรงก์ Arena{childName ? " ของ " + childName : ""}</small>
          <strong>{rank.label} · {rank.rp} RP</strong>
          <span className="rank-bar"><span style={{ width: percent + "%" }} /></span>
          <small>{rank.next ? "อีก " + (rank.next.min - rank.rp) + " RP ขึ้น " + rank.next.icon + " " + rank.next.label : "แรงก์สูงสุดแล้ว! 🎉"}</small>
        </div>
      </div>

      <h3 className="dex-subheading">📋 ภารกิจ Arena วันนี้</h3>
      <ul className="arena-quests">
        {data.quests.list.map((quest) => (
          <li key={quest.code} className={quest.done ? "done" : ""}>
            <span className="arena-quest-icon">{quest.done ? "✅" : quest.icon}</span>
            <div>
              <strong>{quest.label}</strong>
              <span className="dex-set-bar"><span style={{ width: Math.round((quest.progress / quest.target) * 100) + "%" }} /></span>
            </div>
            <small>{quest.progress}/{quest.target} · ⭐{quest.points}</small>
          </li>
        ))}
      </ul>

      <h3 className="dex-subheading">🏅 ความสำเร็จ {unlocked.length}/{data.achievements.length}</h3>
      <div className="achievement-grid">
        {(showAll ? board : board.slice(0, 6)).map((entry) => (
          <div key={entry.code} className={"achievement" + (entry.unlocked_at ? " unlocked" : "")} title={entry.detail}>
            <span>{entry.unlocked_at ? entry.icon : "🔒"}</span>
            <strong>{entry.label}</strong>
            <small>{entry.detail}</small>
            <small className="achievement-points">⭐{entry.points}</small>
          </div>
        ))}
      </div>
      {board.length > 6 && (
        <button className="link-button" onClick={() => setShowAll(!showAll)}>{showAll ? "ย่อ" : "ดูทั้งหมด (" + board.length + ")"}</button>
      )}
    </section>
  );
}
