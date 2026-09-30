import { useEffect, useRef, useState } from "react";
import { usePlayback, type Display, type Float } from "./usePlayback";
import { isMuted, setMuted, sfx } from "./sound";
import { api } from "../../lib/api";
import {
  activeFighter, EMOTES, ENERGY_MAX, other, SPECIAL_COST, SPECIALS, STATUS_INFO, ULT_MAX, ULTIMATE_NAMES, ULTIMATE_POWER, ultOf,
  type Action, type Fighter, type Side, type Team,
} from "../../../shared/arena";
import { typeMultiplier } from "../../../shared/battle";
import { TypeBadges } from "../TypeBadge";
import type { RoomView } from "./useRoom";

const LOG_SHOWN = 6;
const DANGER_PERCENT = 25;
const EMOTE_FLOAT_MS = 2200;
// Intro beats: the VS reveal, a 3-2-1 countdown, then FIGHT!
const INTRO: { text: string; ms: number }[] = [
  { text: "VS", ms: 1400 }, { text: "3", ms: 600 }, { text: "2", ms: 600 }, { text: "1", ms: 600 }, { text: "FIGHT!", ms: 700 },
];
const introKey = (code: string) => "frg.arenaIntro." + code;
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

type CardProps = {
  team: Team; side: Side; isTurn: boolean; mine: boolean;
  display: Display | null; sprite?: string; floats: Float[];
};

function FighterCard({ team, side, isTurn, mine, display, sprite, floats }: CardProps) {
  // While events play, show the fighter and HP of that moment instead of the final state.
  const active = display ? display.active[side] : team.active;
  const fighter = team.fighters[active];
  const hp = display ? display.hp[side][active] : fighter.hp;
  const percent = Math.round((hp / fighter.stats.hp) * 100);
  return (
    <div className={"arena-fighter" + (mine ? " mine" : " foe") + (isTurn ? " turn" : "")}>
      <div className={"arena-sprite" + (sprite ? " fx-" + sprite : "")} key={fighter.id + active}>
        <img src={fighter.image_url} alt={fighter.name} />
        {floats.map((float) => <span key={float.id} className={"arena-float float-" + float.tone}>{float.text}</span>)}
      </div>
      <div className="arena-fighter-info">
        <div className="arena-fighter-top">
          <strong>{fighter.name}{fighter.level ? <span className="level-chip">Lv.{fighter.level}</span> : null}</strong>
          <TypeBadges primary={fighter.type_primary} secondary={fighter.type_secondary} iconOnly />
          <span className="arena-owner">{SIDE_LABEL[side]}</span>
        </div>
        <div className="arena-hp" aria-label={"HP " + hp + " จาก " + fighter.stats.hp}>
          <span className="arena-hp-chip" style={{ width: percent + "%" }} />
          <span className={"arena-hp-fill" + (percent <= 25 ? " low" : percent <= 50 ? " mid" : "")} style={{ width: percent + "%" }} />
        </div>
        <div className="arena-fighter-bottom">
          <small>❤️ {hp}/{fighter.stats.hp}</small>
          <span className="arena-energy" aria-label={"พลัง " + team.energy}>
            {Array.from({ length: ENERGY_MAX }, (_, i) => <span key={i} className={i < team.energy ? "on" : ""}>⚡</span>)}
          </span>
        </div>
        <div className={"arena-ult" + (ultOf(team) >= ULT_MAX ? " ready" : "")} aria-label={"หลอดไม้ตาย " + ultOf(team) + "%"}>
          <span className="arena-ult-icon">💥</span>
          <span className="arena-ult-track"><span style={{ width: Math.round((ultOf(team) / ULT_MAX) * 100) + "%" }} /></span>
          <small>{ultOf(team) >= ULT_MAX ? "พร้อม!" : ultOf(team) + "%"}</small>
        </div>
        <div className="arena-statuses">
          {fighter.guard && <span title="ตั้งรับ">🛡️ ตั้งรับ</span>}
          {fighter.statuses.map((status) => (
            <span key={status.kind}>{STATUS_INFO[status.kind].icon} {STATUS_INFO[status.kind].label} {status.turns}</span>
          ))}
        </div>
        <div className="arena-bench">
          {team.fighters.map((member, index) => (
            <span key={member.id + index} className={((display ? display.hp[side][index] : member.hp) <= 0 ? "out" : "") + (index === active ? " active" : "")}>
              {(display ? display.hp[side][index] : member.hp) <= 0 ? "✗" : index + 1}
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
  const { display, fx, playing, log } = usePlayback(state, me);
  const [muted, setMutedState] = useState(isMuted);
  const [intro, setIntro] = useState(() => {
    if (state.round !== 1 || (state.eventSeq ?? 0) > 0) return -1;
    try { return sessionStorage.getItem(introKey(view.room.code)) ? -1 : 0; } catch { return 0; }
  });
  const canAct = myTurn && !playing && intro < 0;
  const finished = Boolean(state.winner) && !playing;
  const ultReady = ultOf(state.teams[me]) >= ULT_MAX;

  // Intro: step through the beats once per room per device.
  useEffect(() => {
    if (intro < 0) return;
    if (intro >= INTRO.length) {
      try { sessionStorage.setItem(introKey(view.room.code), "1"); } catch { /* shows again next time */ }
      setIntro(-1);
      return;
    }
    if (INTRO[intro].text === "FIGHT!") sfx.fight(); else if (intro > 0) sfx.count();
    const timer = window.setTimeout(() => setIntro(intro + 1), INTRO[intro].ms);
    return () => window.clearTimeout(timer);
  }, [intro]);

  // Low-HP drama for my active monster.
  const myActive = display ? display.active[me] : state.teams[me].active;
  const myHp = display ? display.hp[me][myActive] : state.teams[me].fighters[myActive].hp;
  const danger = !state.winner && myHp > 0 && myHp / state.teams[me].fighters[myActive].stats.hp <= DANGER_PERCENT / 100;
  useEffect(() => { if (danger) sfx.heartbeat(); }, [danger, myActive]);

  // Emoji reactions: show the other side's new ones, and mine right away when sent.
  const [emoteFloats, setEmoteFloats] = useState<{ id: number; side: Side; emoji: string; x: number }[]>([]);
  const lastEmote = useRef(view.room.emote_seq);
  const emoteId = useRef(0);
  function floatEmote(side: Side, emoji: string) {
    const id = ++emoteId.current;
    setEmoteFloats((list) => [...list, { id, side, emoji, x: 15 + Math.round(Math.random() * 70) }]);
    window.setTimeout(() => setEmoteFloats((list) => list.filter((item) => item.id !== id)), EMOTE_FLOAT_MS);
  }
  useEffect(() => {
    for (const emote of view.emotes ?? []) {
      if (emote.seq <= lastEmote.current) continue;
      if (emote.side !== me) floatEmote(emote.side, emote.emoji);
    }
    lastEmote.current = Math.max(lastEmote.current, view.room.emote_seq);
  }, [view.room.emote_seq]);
  async function sendEmote(emoji: string) {
    try {
      await api("/api/arena/rooms/" + view.room.code + "/emote", { method: "POST", body: JSON.stringify({ emoji }) });
      floatEmote(me, emoji);
    } catch { /* too fast or room closed: ignore */ }
  }

  function toggleSound() {
    setMuted(!muted);
    setMutedState(!muted);
  }

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
        <span className="arena-heading-right">
          <span className={canAct ? "arena-your-turn" : ""}>{playing || intro >= 0 ? "⚔️ ..." : state.winner ? "จบการต่อสู้" : state.turn === me ? "ตาของคุณ!" : "ตาของ" + SIDE_LABEL[state.turn]}</span>
          <button className="arena-sound" onClick={toggleSound} aria-label={muted ? "เปิดเสียง" : "ปิดเสียง"}>{muted ? "🔇" : "🔊"}</button>
        </span>
      </div>

      <div className={"arena-stage " + fx.screen + (danger ? " danger" : "")}>
        {intro >= 0 && intro < INTRO.length && (
          <div className="arena-intro" aria-live="assertive">
            {intro === 0 ? (
              <div className="arena-intro-vs">
                <div className="intro-team foe">{state.teams[foe].fighters.map((f, i) => <img key={i} src={f.image_url} alt={f.name} />)}</div>
                <strong>VS</strong>
                <div className="intro-team mine">{state.teams[me].fighters.map((f, i) => <img key={i} src={f.image_url} alt={f.name} />)}</div>
              </div>
            ) : (
              <strong key={intro} className={"arena-intro-count" + (INTRO[intro].text === "FIGHT!" ? " fight" : "")}>{INTRO[intro].text}</strong>
            )}
          </div>
        )}
        {fx.cutin && (
          <div className={"arena-cutin cutin-" + fx.cutin.type + (fx.cutin.side === me ? " mine" : " foe")} aria-hidden="true">
            <img src={state.teams[fx.cutin.side].fighters[fx.cutin.index]?.image_url} alt="" />
            <strong>💥 {fx.cutin.name}!!</strong>
          </div>
        )}
        {fx.commentary && <div key={fx.commentary.id} className={"arena-commentary tone-" + fx.commentary.tone}>{fx.commentary.text}</div>}
        {emoteFloats.map((item) => (
          <span key={item.id} className={"arena-emote " + (item.side === me ? "mine" : "foe")} style={{ left: item.x + "%" }}>{item.emoji}</span>
        ))}
        {fx.banner && <div className={"arena-banner-move move-" + fx.banner.type}>{fx.banner.text}</div>}
        {fx.projectile && <div className={"arena-projectile from-" + (fx.projectile.from === me ? "me" : "foe")}>{fx.projectile.icon}</div>}
        <FighterCard team={state.teams[foe]} side={foe} isTurn={state.turn === foe && !state.winner && !playing} mine={false}
          display={display} sprite={fx.sprite[foe]} floats={fx.floats.filter((f) => f.side === foe)} />
        <div className="arena-vs">VS</div>
        <FighterCard team={state.teams[me]} side={me} isTurn={canAct} mine
          display={display} sprite={fx.sprite[me]} floats={fx.floats.filter((f) => f.side === me)} />
        {fx.confetti && (
          <div className="arena-confetti" aria-hidden="true">
            {Array.from({ length: 24 }, (_, i) => <span key={i} style={{ left: (i * 37) % 100 + "%", animationDelay: (i % 8) * 0.12 + "s" }}>{["🎉", "✨", "⭐", "🏆"][i % 4]}</span>)}
          </div>
        )}
      </div>

      <div className="arena-emote-bar" aria-label="ส่งอีโมจิ">
        {EMOTES.map((emoji) => <button key={emoji} onClick={() => sendEmote(emoji)} aria-label={"ส่ง " + emoji}>{emoji}</button>)}
      </div>

      <ol className="arena-log" aria-live="polite">
        {log.slice(-LOG_SHOWN).map((line, index) => <li key={log.length - LOG_SHOWN + index}>{line}</li>)}
      </ol>

      {state.winner && !finished ? (
        <p className="muted arena-waiting">⚔️ ...</p>
      ) : state.winner ? (
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
          {canAct && advantage !== 1 && (
            <p className={"arena-hint" + (advantage > 1 ? " good" : " bad")}>
              {advantage > 1 ? "💡 ได้เปรียบธาตุ ×" + advantage + " ตีแรงขึ้น!" : "⚠️ แพ้ทางธาตุ ×" + advantage + " ลองใช้ท่าพิเศษหรือตั้งรับ"}
            </p>
          )}
          {ultReady && (
            <button className="arena-ultimate" disabled={!canAct || busy} onClick={() => act("ULTIMATE")}>
              <strong>💥 ท่าไม้ตาย: {ULTIMATE_NAMES[myFighter.type_primary] ?? ULTIMATE_NAMES.Normal}!</strong>
              <small>แรง ×{ULTIMATE_POWER} · ไม่พลาด · ได้ผลท่าพิเศษด้วย · ไม่ใช้ ⚡</small>
            </button>
          )}
          {canAct && !ultReady && ultOf(state.teams[foe]) >= ULT_MAX && (
            <p className="arena-hint bad">⚠️ ไม้ตายของอีกฝ่ายพร้อมแล้ว! ตั้งรับจะลดความเสียหายครึ่งหนึ่ง</p>
          )}
          <div className="arena-actions">
            <button disabled={!canAct || busy} onClick={() => act("ATTACK")}>
              <strong>⚔️ โจมตี</strong><small>อาจโดนหลบ</small>
            </button>
            <button className="special" disabled={!canAct || busy || state.teams[me].energy < SPECIAL_COST} onClick={() => act("SPECIAL")}>
              <strong>🌟 {special.name}</strong><small>⚡{SPECIAL_COST} · {special.detail}</small>
            </button>
            <button disabled={!canAct || busy} onClick={() => act("GUARD")}>
              <strong>🛡️ ตั้งรับ</strong><small>ลดครึ่ง · ⚡+1</small>
            </button>
          </div>
          {!myTurn && !playing && <p className="muted arena-waiting">รอ{SIDE_LABEL[state.turn]}เลือกท่า...</p>}
        </>
      )}
      {message && <p className="feedback">{message}</p>}
    </section>
  );
}
