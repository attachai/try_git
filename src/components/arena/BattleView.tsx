import { useState } from "react";
import { api } from "../../lib/api";
import {
  activeFighter, ENERGY_MAX, other, SPECIAL_COST, SPECIALS, STATUS_INFO,
  type Action, type Fighter, type Side, type Team,
} from "../../../shared/arena";
import { typeMultiplier } from "../../../shared/battle";
import { TypeBadges } from "../TypeBadge";
import type { RoomView } from "./useRoom";

const LOG_SHOWN = 6;
const SIDE_LABEL: Record<Side, string> = { CHILD: "ลูก", PARENT: "ผู้ปกครอง" };

function specialText(fighter: Fighter) {
  const special = SPECIALS[fighter.type_primary] ?? SPECIALS.Normal;
  const effect = special.target
    ? "ศัตรูติด " + STATUS_INFO[special.target.kind].icon + " " + STATUS_INFO[special.target.kind].label
    : special.self
      ? "ได้ " + STATUS_INFO[special.self.kind].icon + " " + STATUS_INFO[special.self.kind].label
      : special.pierce ? "ไม่สนเกราะ" : special.drain ? "ดูด HP" : special.heal ? "ฟื้น HP" : "";
  return { name: special.name, detail: "แรง ×" + special.power + " · ไม่พลาด · " + effect };
}

function FighterCard({ team, side, isTurn, mine }: { team: Team; side: Side; isTurn: boolean; mine: boolean }) {
  const fighter = team.fighters[team.active];
  const percent = Math.round((fighter.hp / fighter.stats.hp) * 100);
  return (
    <div className={"arena-fighter" + (mine ? " mine" : " foe") + (isTurn ? " turn" : "")}>
      <img src={fighter.image_url} alt={fighter.name} />
      <div className="arena-fighter-info">
        <div className="arena-fighter-top">
          <strong>{fighter.name}{fighter.level ? <span className="level-chip">Lv.{fighter.level}</span> : null}</strong>
          <TypeBadges primary={fighter.type_primary} secondary={fighter.type_secondary} iconOnly />
          <span className="arena-owner">{SIDE_LABEL[side]}</span>
        </div>
        <div className="arena-hp" aria-label={"HP " + fighter.hp + " จาก " + fighter.stats.hp}>
          <span className={percent <= 25 ? "low" : percent <= 50 ? "mid" : ""} style={{ width: percent + "%" }} />
        </div>
        <div className="arena-fighter-bottom">
          <small>❤️ {fighter.hp}/{fighter.stats.hp}</small>
          <span className="arena-energy" aria-label={"พลัง " + team.energy}>
            {Array.from({ length: ENERGY_MAX }, (_, i) => <span key={i} className={i < team.energy ? "on" : ""}>⚡</span>)}
          </span>
        </div>
        <div className="arena-statuses">
          {fighter.guard && <span title="ตั้งรับ">🛡️ ตั้งรับ</span>}
          {fighter.statuses.map((status) => (
            <span key={status.kind}>{STATUS_INFO[status.kind].icon} {STATUS_INFO[status.kind].label} {status.turns}</span>
          ))}
        </div>
        <div className="arena-bench">
          {team.fighters.map((member, index) => (
            <span key={member.id + index} className={(member.hp <= 0 ? "out" : "") + (index === team.active ? " active" : "")}>
              {member.hp <= 0 ? "✗" : index + 1}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

type Props = { view: RoomView; onView: (view: RoomView) => void };

export default function BattleView({ view, onView }: Props) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const state = view.state!;
  const me = view.room.my_side;
  const foe = other(me);
  const myFighter = activeFighter(state, me);
  const foeFighter = activeFighter(state, foe);
  const autoPlays = me === "PARENT" && view.room.auto_parent;
  const myTurn = state.turn === me && !state.winner && !autoPlays;
  const special = specialText(myFighter);
  const advantage = typeMultiplier(myFighter.type_primary, foeFighter);

  async function act(action: Action) {
    if (busy) return;
    try {
      setBusy(true);
      setMessage("");
      const next = await api<RoomView>("/api/arena/rooms/" + view.room.code + "/action", {
        method: "POST",
        body: JSON.stringify({ version: view.room.version, action }),
      });
      onView(next);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "ส่งคำสั่งไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  const won = state.winner === me;
  return (
    <section className="panel arena-battle">
      <div className="section-heading">
        <h2>⚔️ รอบ {state.round}</h2>
        <span>{state.winner ? "จบการต่อสู้" : state.turn === me ? "ตาของคุณ!" : "ตาของ" + SIDE_LABEL[state.turn]}</span>
      </div>

      <FighterCard team={state.teams[foe]} side={foe} isTurn={state.turn === foe && !state.winner} mine={false} />
      <div className="arena-vs">VS</div>
      <FighterCard team={state.teams[me]} side={me} isTurn={state.turn === me && !state.winner} mine />

      <ol className="arena-log" aria-live="polite">
        {state.log.slice(-LOG_SHOWN).map((line, index) => <li key={state.log.length - LOG_SHOWN + index}>{line}</li>)}
      </ol>

      {state.winner ? (
        <div className={"arena-result" + (won ? " win" : "")}>
          <strong>{won ? "🏆 ชนะแล้ว!" : me === "CHILD" ? "💪 เกือบแล้ว! ลองใหม่นะ" : "🏆 ผู้ปกครองชนะ"}</strong>
          {view.mvp && <span>🏅 MVP: {view.mvp.name} ({view.mvp.damage} ดาเมจ)</span>}
          {me === "CHILD" && view.xp_awards && view.xp_awards.length > 0 && (
            <ul className="xp-awards">
              {view.xp_awards.map((award) => (
                <li key={award.name}>
                  {award.name} +{award.gained} XP
                  {award.levels_gained > 0 && <strong> · เลเวลอัป! Lv.{award.level} 🎉</strong>}
                </li>
              ))}
            </ul>
          )}
          {me === "CHILD" && view.xp_awards?.length === 0 && <span className="muted">วันนี้รับ XP ครบ 5 ห้องแล้ว</span>}
          {me === "CHILD" && (
            <span>{view.room.reward_points > 0 ? "ได้ ⭐ +" + view.room.reward_points + " คะแนน" : "วันนี้รับรางวัล Arena ครบแล้ว"}</span>
          )}
        </div>
      ) : autoPlays ? (
        <p className="muted">ระบบกำลังเล่นแทนคุณ ดูการต่อสู้ได้เลย</p>
      ) : (
        <>
          {myTurn && advantage !== 1 && (
            <p className={"arena-hint" + (advantage > 1 ? " good" : " bad")}>
              {advantage > 1 ? "💡 ได้เปรียบธาตุ ×" + advantage + " ตีแรงขึ้น!" : "⚠️ แพ้ทางธาตุ ×" + advantage + " ลองใช้ท่าพิเศษหรือตั้งรับ"}
            </p>
          )}
          <div className="arena-actions">
            <button disabled={!myTurn || busy} onClick={() => act("ATTACK")}>
              <strong>⚔️ โจมตี</strong><small>อาจโดนหลบ</small>
            </button>
            <button className="special" disabled={!myTurn || busy || state.teams[me].energy < SPECIAL_COST} onClick={() => act("SPECIAL")}>
              <strong>🌟 {special.name}</strong><small>⚡{SPECIAL_COST} · {special.detail}</small>
            </button>
            <button disabled={!myTurn || busy} onClick={() => act("GUARD")}>
              <strong>🛡️ ตั้งรับ</strong><small>ลดครึ่ง · ⚡+1</small>
            </button>
          </div>
          {!myTurn && <p className="muted arena-waiting">รอ{SIDE_LABEL[state.turn]}เลือกท่า...</p>}
        </>
      )}
      {message && <p className="feedback">{message}</p>}
    </section>
  );
}
