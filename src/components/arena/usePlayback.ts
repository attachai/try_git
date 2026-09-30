import { useEffect, useRef, useState } from "react";
import { FIELD_EVENTS, ITEMS, STATUS_INFO, WEATHER, type BattleEvent, type BattleState, type FieldEventKind, type Side } from "../../../shared/arena";
import { TYPE_ICON } from "../../../shared/types";
import { buzz, sfx } from "./sound";

export type Float = { id: number; side: Side; text: string; tone: string };
export type Fx = {
  sprite: Partial<Record<Side, string>>;
  floats: Float[];
  banner: { text: string; type: string } | null;
  screen: string;
  projectile: { from: Side; icon: string } | null;
  confetti: boolean;
  cutin: { side: Side; name: string; type: string; index: number } | null;
  commentary: { id: number; text: string; tone: string } | null;
  field: { kind: FieldEventKind; side: Side } | null;
};
// What the cards should show while events play: which fighter is out and its HP.
export type Display = { active: Record<Side, number>; hp: Record<Side, number[]> };

const EMPTY_FX: Fx = { sprite: {}, floats: [], banner: null, screen: "", projectile: null, confetti: false, cutin: null, commentary: null, field: null };
const COMMENTARY_MS = 1500;
const STREAK_CALLOUT = 3;
const FLOAT_MS = 1200;

// Milliseconds each event holds the stage before the next one plays.
const DURATION: Record<BattleEvent["kind"], number> = {
  attack: 350, special: 750, ultimate: 1400, hit: 650, miss: 550, heal: 550, status: 450, buff: 450,
  tick: 500, guard: 450, paralyzed: 450, faint: 800, switch: 550, win: 1000,
  weather: 1300, combo: 700, item: 600, recall: 400, field: 1000,
};

function snapshot(state: BattleState): Display {
  return {
    active: { CHILD: state.teams.CHILD.active, PARENT: state.teams.PARENT.active },
    hp: { CHILD: state.teams.CHILD.fighters.map((f) => f.hp), PARENT: state.teams.PARENT.fighters.map((f) => f.hp) },
  };
}

// Plays new battle events one beat at a time. Returns what to draw meanwhile;
// `display` is null when the cards should just show the real state.
export function usePlayback(state: BattleState, me: Side) {
  const lastSeq = useRef(state.eventSeq ?? 0);
  const shown = useRef<BattleState>(state);
  const floatId = useRef(0);
  // Hits landed in a row per side, for the "on fire" callout; survives across batches.
  const streak = useRef<Record<Side, number>>({ CHILD: 0, PARENT: 0 });
  const [display, setDisplay] = useState<Display | null>(null);
  const [fx, setFx] = useState<Fx>(EMPTY_FX);
  const [playing, setPlaying] = useState(false);
  // The log from before the new events, so lines don't spoil what hasn't animated yet.
  const [heldLog, setHeldLog] = useState<string[]>(state.log);

  useEffect(() => {
    const pending = (state.events ?? []).filter((event) => event.seq > lastSeq.current);
    if (pending.length === 0) {
      shown.current = state;
      return;
    }
    lastSeq.current = state.eventSeq ?? lastSeq.current;
    const current = snapshot(shown.current);
    setHeldLog(shown.current.log);
    shown.current = state;
    const timers: number[] = [];
    let cancelled = false;

    const addFloat = (side: Side, text: string, tone: string) => {
      const id = ++floatId.current;
      setFx((fx) => ({ ...fx, floats: [...fx.floats, { id, side, text, tone }] }));
      timers.push(window.setTimeout(() => setFx((fx) => ({ ...fx, floats: fx.floats.filter((f) => f.id !== id) })), FLOAT_MS));
    };
    const say = (text: string, tone = "hype") => {
      const id = ++floatId.current;
      setFx((fx) => ({ ...fx, commentary: { id, text, tone } }));
      timers.push(window.setTimeout(() => setFx((fx) => (fx.commentary?.id === id ? { ...fx, commentary: null } : fx)), COMMENTARY_MS));
    };
    const alive = (side: Side) => current.hp[side].filter((hp) => hp > 0).length;
    const setHp = (event: BattleEvent) => {
      if (event.hp === undefined) return;
      current.hp[event.side] = current.hp[event.side].map((hp, i) => (i === event.index ? event.hp! : hp));
      setDisplay({ active: { ...current.active }, hp: { CHILD: [...current.hp.CHILD], PARENT: [...current.hp.PARENT] } });
    };

    function play(event: BattleEvent) {
      const foe: Side = event.side === "CHILD" ? "PARENT" : "CHILD";
      setFx((fx) => ({ ...fx, sprite: {}, banner: null, screen: "", projectile: null, cutin: null, field: null }));
      switch (event.kind) {
        case "attack":
          sfx.swing();
          setFx((fx) => ({ ...fx, sprite: { [event.side]: "lunge" } }));
          break;
        case "special":
          sfx.special();
          setFx((fx) => ({
            ...fx,
            sprite: { [event.side]: "charge" },
            banner: { text: "🌟 " + (event.move ?? "ท่าพิเศษ") + "!", type: (event.type ?? "Normal").toLowerCase() },
            screen: "flash flash-" + (event.type ?? "Normal").toLowerCase(),
            projectile: { from: event.side, icon: TYPE_ICON[event.type ?? ""] ?? "✨" },
          }));
          break;
        case "ultimate":
          sfx.special();
          buzz([60, 40, 60, 40, 120]);
          setFx((fx) => ({
            ...fx,
            sprite: { [event.side]: "charge" },
            cutin: { side: event.side, name: event.move ?? "ท่าไม้ตาย", type: (event.type ?? "Normal").toLowerCase(), index: event.index },
            screen: "flash flash-" + (event.type ?? "Normal").toLowerCase(),
          }));
          say("ท่าไม้ตาย!!! 💥", "ultimate");
          break;
        case "hit":
          setHp(event);
          if (event.crit) { sfx.crit(); buzz([40, 30, 60]); } else sfx.hit();
          streak.current[foe] += 1;
          if (event.hp !== undefined && event.hp > 0 && event.max && event.hp / event.max <= 0.1) say("เกือบไปแล้ว!! 😱", "clutch");
          else if (event.crit) say("โอ้โห! คริติคอลสุดแรง! 💥", "crit");
          else if ((event.multiplier ?? 1) >= 2) say("แรงสุดๆ! ได้เปรียบธาตุ ×2!", "good");
          else if (streak.current[foe] === STREAK_CALLOUT) say("ตีโดนติดกัน " + STREAK_CALLOUT + " ครั้ง! ร้อนแรง 🔥", "hype");
          setFx((fx) => ({ ...fx, sprite: { [event.side]: "hurt" }, screen: event.crit ? "shake" : "" }));
          addFloat(event.side, (event.crit ? "CRITICAL! " : "") + "−" + event.amount, event.crit ? "crit" : "damage");
          if ((event.multiplier ?? 1) >= 1.5) addFloat(event.side, "ได้เปรียบ! ×" + event.multiplier, "good");
          else if ((event.multiplier ?? 1) < 1) addFloat(event.side, "แพ้ทาง ×" + event.multiplier, "weak");
          if (event.guarded) addFloat(event.side, "🛡️ ลดครึ่ง", "shield");
          break;
        case "miss":
          sfx.miss();
          streak.current[foe] = 0;
          say("หลบสวย! 💨", "cool");
          setFx((fx) => ({ ...fx, sprite: { [event.side]: "dodge" } }));
          addFloat(event.side, "MISS 💨", "miss");
          break;
        case "heal":
          setHp(event);
          sfx.heal();
          setFx((fx) => ({ ...fx, sprite: { [event.side]: "heal" } }));
          addFloat(event.side, "+" + event.amount + " 💚", "heal");
          break;
        case "status":
        case "buff":
          sfx.status();
          setFx((fx) => ({ ...fx, sprite: { [event.side]: event.kind === "buff" ? "buff" : "hurt-soft" } }));
          if (event.status) addFloat(event.side, STATUS_INFO[event.status].icon + " " + STATUS_INFO[event.status].label, event.kind);
          break;
        case "tick":
          setHp(event);
          sfx.hit();
          setFx((fx) => ({ ...fx, sprite: { [event.side]: "hurt-soft" } }));
          addFloat(event.side, (event.status ? STATUS_INFO[event.status].icon + " " : "") + "−" + event.amount, "damage");
          break;
        case "guard":
          sfx.guard();
          setFx((fx) => ({ ...fx, sprite: { [event.side]: "guard" } }));
          addFloat(event.side, "🛡️ ตั้งรับ", "shield");
          break;
        case "paralyzed":
          sfx.status();
          setFx((fx) => ({ ...fx, sprite: { [event.side]: "hurt-soft" } }));
          addFloat(event.side, "⚡ ชา! ขยับไม่ได้", "weak");
          break;
        case "weather": {
          const field = WEATHER[event.weather ?? "CLEAR"];
          sfx.special();
          setFx((fx) => ({ ...fx, banner: { text: "🌦️ สนามเปลี่ยน! " + field.icon + " " + field.label, type: "weather" }, screen: "flash flash-normal" }));
          say(field.icon + " " + field.label + "!", "cool");
          break;
        }
        case "field": {
          const kind = event.fieldEvent ?? "RAINBOW";
          const info = FIELD_EVENTS[kind];
          if (kind === "METEOR" || kind === "LAVA") { sfx.crit(); buzz(80); } else if (kind === "LIGHTNING") { sfx.crit(); } else if (kind === "CHEER") { sfx.win(); } else { sfx.heal(); }
          setFx((fx) => ({
            ...fx,
            field: { kind, side: event.side },
            screen: kind === "METEOR" || kind === "LIGHTNING" ? "shake" : kind === "LAVA" ? "flash flash-fire" : "",
            banner: kind === "CHEER" ? null : { text: info.icon + " " + info.label, type: "weather" },
          }));
          if (kind === "CHEER") say("📣 คนดูเชียร์สนั่น!", "hype");
          break;
        }
        case "combo":
          sfx.crit();
          buzz([30, 30, 30]);
          setFx((fx) => ({ ...fx, sprite: { [event.side]: "hurt" }, screen: "shake" }));
          addFloat(event.side, "🔗 " + event.combo, "crit");
          say("🔗 คอมโบ! " + event.combo + "!", "crit");
          break;
        case "item":
          sfx.heal();
          setFx((fx) => ({ ...fx, sprite: { [event.side]: "buff" } }));
          if (event.item) addFloat(event.side, ITEMS[event.item].icon + " " + ITEMS[event.item].label, "buff");
          break;
        case "recall":
          sfx.miss();
          setFx((fx) => ({ ...fx, sprite: { [event.side]: "recall" } }));
          break;
        case "faint":
          sfx.faint();
          buzz(120);
          streak.current[event.side] = 0;
          current.hp[event.side] = current.hp[event.side].map((hp, i) => (i === event.index ? 0 : hp));
          setFx((fx) => ({ ...fx, sprite: { [event.side]: "faint" } }));
          break;
        case "switch":
          current.active[event.side] = event.index;
          setDisplay({ active: { ...current.active }, hp: { CHILD: [...current.hp.CHILD], PARENT: [...current.hp.PARENT] } });
          sfx.enter();
          setFx((fx) => ({ ...fx, sprite: { [event.side]: "enter" } }));
          if (current.hp[event.side].length > 1 && alive(event.side) === 1) say("ตัวสุดท้าย! ฮึดสู้!! 🔥", "clutch");
          break;
        case "win":
          if (event.side === me) sfx.win(); else sfx.lose();
          // A comeback: the winner is down to its last monster and beat a full team of 2+.
          if (current.hp[event.side].length > 1 && current.hp[foe].length > 1 && alive(event.side) === 1) say("พลิกเกม!!! 🤯", "ultimate");
          else say(event.side === me ? "ชนะแล้ว! 🏆" : "สู้ได้ดีมาก! 💪", "hype");
          setFx((fx) => ({ ...fx, sprite: { [foe]: "faint" }, confetti: event.side === me }));
          break;
      }
    }

    setPlaying(true);
    setDisplay({ active: { ...current.active }, hp: { CHILD: [...current.hp.CHILD], PARENT: [...current.hp.PARENT] } });
    let delay = 0;
    for (const event of pending) {
      timers.push(window.setTimeout(() => { if (!cancelled) play(event); }, delay));
      delay += DURATION[event.kind];
    }
    timers.push(window.setTimeout(() => {
      if (cancelled) return;
      setDisplay(null);
      setPlaying(false);
      setFx((fx) => ({ ...EMPTY_FX, confetti: fx.confetti, floats: fx.floats }));
    }, delay));

    return () => {
      cancelled = true;
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [state.eventSeq]);

  return { display, fx, playing, log: playing ? heldLog : state.log };
}
