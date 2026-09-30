import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import { TypeBadges } from "../TypeBadge";
import { TOURNAMENT_STAGES } from "../../../shared/progression";
import { DIFFICULTY_LABEL } from "./useRoom";

type Monster = { id: string; name: string; image_url: string; type_primary: string; type_secondary: string | null; level?: number };
type Difficulty = keyof typeof DIFFICULTY_LABEL;
type History = {
  summary: { played: number; wins: number; losses: number; win_rate: number; current_streak: number; best_streak: number; tournaments: number; championships: number };
  by_difficulty: Record<Difficulty, { wins: number; losses: number }>;
  top_monsters: { monster: Monster; battles: number; wins: number; damage: number; mvp: number }[];
  recent: {
    code: string; difficulty: Difficulty; mode: "DUEL" | "TOURNAMENT"; stage: number; winner: "CHILD" | "PARENT"; finished_at: string; parent_name: string;
    rounds: number; reward_points: number; mvp: { name: string; damage: number } | null;
    child_team: Monster[]; parent_team: Monster[];
  }[];
};

// D1 timestamps are UTC "YYYY-MM-DD HH:MM:SS".
function when(timestamp: string) {
  return new Date(timestamp.replace(" ", "T") + "Z").toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" });
}

function Team({ team }: { team: Monster[] }) {
  return (
    <span className="history-team">
      {team.map((monster, index) => <img key={monster.id + index} src={monster.image_url} alt={monster.name} title={monster.name} />)}
    </span>
  );
}

type Props = {
  childId?: string; // parents pass the child to show; children see their own
  childName?: string;
  refreshKey?: unknown; // change to reload, e.g. after a battle ends
};

export default function ArenaHistory({ childId, childName, refreshKey }: Props) {
  const [data, setData] = useState<History | null>(null);

  useEffect(() => {
    setData(null);
    api<History>("/api/arena/history" + (childId ? "?childId=" + encodeURIComponent(childId) : ""))
      .then(setData)
      .catch(() => undefined);
  }, [childId, refreshKey]);

  if (!data) return null;
  const { summary } = data;
  const owner = childName ? childName : "คุณ";

  return (
    <section className="panel arena-history">
      <div className="section-heading"><h2>📜 ประวัติ Arena{childName ? " ของ " + childName : ""}</h2><span>{summary.played} ห้อง</span></div>

      {summary.played === 0 ? (
        <p className="muted">ยังไม่เคยสู้ใน Arena {childName ? "ชวน " + childName + " มาท้าสู้กัน!" : "ขอรหัสห้องจากพ่อแม่แล้วมาลองกัน!"}</p>
      ) : (
        <>
          <div className="history-stats">
            <div><strong>{summary.wins}</strong><small>ชนะ</small></div>
            <div><strong>{summary.losses}</strong><small>แพ้</small></div>
            <div><strong>{summary.win_rate}%</strong><small>อัตราชนะ</small></div>
            <div className={summary.current_streak > 0 ? "hot" : ""}><strong>🔥 {summary.current_streak}</strong><small>ชนะติดกัน · สูงสุด {summary.best_streak}</small></div>
          </div>

          <div className="history-difficulty">
            {(Object.keys(DIFFICULTY_LABEL) as Difficulty[]).map((level) => (
              <span key={level}>{DIFFICULTY_LABEL[level]} <strong>{data.by_difficulty[level].wins}-{data.by_difficulty[level].losses}</strong></span>
            ))}
            {summary.tournaments > 0 && <span>🏟️ แชมป์ <strong>{summary.championships}/{summary.tournaments}</strong></span>}
          </div>

          {data.top_monsters.length > 0 && (
            <>
              <h3 className="dex-subheading">⭐ ตัวเก่งของ{owner}</h3>
              <div className="history-top">
                {data.top_monsters.map((entry, index) => (
                  <div key={entry.monster.id}>
                    <span className="history-rank">{["🥇", "🥈", "🥉"][index]}</span>
                    <img src={entry.monster.image_url} alt="" />
                    <strong>{entry.monster.name}</strong>
                    <TypeBadges primary={entry.monster.type_primary} secondary={entry.monster.type_secondary} iconOnly />
                    <small>ชนะ {entry.wins}/{entry.battles} · 💥 {entry.damage}{entry.mvp ? " · 🏅×" + entry.mvp : ""}</small>
                  </div>
                ))}
              </div>
            </>
          )}

          <h3 className="dex-subheading">ห้องล่าสุด</h3>
          <ol className="history-list">
            {data.recent.map((game) => {
              const won = game.winner === "CHILD";
              const tournament = game.mode === "TOURNAMENT";
              return (
                <li key={game.code + game.finished_at} className={won ? "win" : "loss"}>
                  <div className="history-row-top">
                    <strong>{tournament ? (won ? "👑 แชมป์" : "💪 ตก" + (TOURNAMENT_STAGES[game.stage - 1]?.label ?? "")) : won ? "🏆 ชนะ" : "💪 แพ้"}</strong>
                    <span>{tournament ? "ทัวร์นาเมนต์" : "vs " + game.parent_name}</span>
                    <span className="history-chip">{(tournament ? "🏟️ " : "") + DIFFICULTY_LABEL[game.difficulty] + (tournament ? " · " + game.stage + "/" + TOURNAMENT_STAGES.length : "")}</span>
                    <small>{when(game.finished_at)}</small>
                  </div>
                  <div className="history-row-teams">
                    <Team team={game.child_team} />
                    <span className="history-vs">vs</span>
                    <Team team={game.parent_team} />
                  </div>
                  <small className="muted">
                    {game.rounds} รอบ{game.mvp ? " · 🏅 " + game.mvp.name : ""}{game.reward_points ? " · ⭐ +" + game.reward_points : ""}
                  </small>
                </li>
              );
            })}
          </ol>
        </>
      )}
    </section>
  );
}
