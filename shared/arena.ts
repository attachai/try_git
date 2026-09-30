// Turn-based arena engine. Pure: callers pass a random source, so the server
// can use crypto randomness and tests can script every roll.
import { baseDamage, computeStats, typeMultiplier, type Stats } from "./battle";
import { TYPE_ICON } from "./types";

export type Side = "CHILD" | "PARENT";
export type Action = "ATTACK" | "SPECIAL" | "GUARD" | "ULTIMATE" | "SWITCH" | "ITEM";
export type StatusKind =
  | "BURN" | "POISON" | "PARALYZE" | "FREEZE" | "FEAR" | "CONFUSE" // on the target
  | "RAGE" | "ARMOR" | "SWIFT" | "EXPOSED" // on self
  | "WET" | "GRASSY"; // combo marks left by Water and Grass hits

export type Status = { kind: StatusKind; turns: number };
export type Fighter = {
  id: string;
  // The child's owned copy (child_characters.id), used to award XP. Absent for the parent team.
  owned_id?: string;
  level?: number;
  name: string;
  image_url: string;
  rarity: string;
  type_primary: string;
  type_secondary: string | null;
  stats: Stats;
  hp: number;
  statuses: Status[];
  guard: boolean;
  damageDealt: number;
};
// `ult` is the ultimate gauge (0–ULT_MAX); optional so older battles still load.
export type ItemKind = "POTION" | "ETHER" | "CLEANSE";
export type WeatherKind = "CLEAR" | "SUN" | "RAIN" | "STORM" | "SNOW" | "SAND";
export type ThemeKind = "VOLCANO" | "BEACH" | "FOREST" | "SNOWPEAK" | "SPACE" | "STADIUM";
export type FieldEventKind = "METEOR" | "LIGHTNING" | "RAINBOW" | "GIFT" | "LAVA" | "CHEER";
// `ult` is the ultimate gauge (0–ULT_MAX); `item` is the child's one carried item.
// Both optional so older battles still load.
export type Team = { fighters: Fighter[]; active: number; energy: number; ult?: number; item?: { kind: ItemKind; used: boolean } };
// Structured record of what happened, so the UI can animate each beat in order.
// `side` is who the event happens to; `index` is that fighter's slot in the team.
export type BattleEvent = {
  seq: number;
  kind: "attack" | "special" | "ultimate" | "hit" | "miss" | "heal" | "status" | "buff" | "tick" | "guard" | "paralyzed"
    | "faint" | "switch" | "win" | "weather" | "combo" | "item" | "recall" | "field";
  side: Side;
  index: number;
  hp?: number;
  max?: number;
  amount?: number;
  crit?: boolean;
  multiplier?: number;
  guarded?: boolean;
  type?: string;
  move?: string;
  status?: StatusKind;
  weather?: WeatherKind;
  combo?: string;
  item?: ItemKind;
  fieldEvent?: FieldEventKind;
};
export type BattleState = {
  turn: Side;
  round: number;
  teams: Record<Side, Team>;
  log: string[];
  winner: Side | null;
  // Optional so battles saved before events existed still load.
  events?: BattleEvent[];
  eventSeq?: number;
  weather?: WeatherKind;
  weatherUntil?: number; // round at which the field changes next
  theme?: ThemeKind;
  fieldEvents?: number; // random field events so far
  // Per-side counts for quests and achievements, and the move that decided the game.
  tally?: Record<Side, Tally>;
  finisher?: Action;
};
export type Tally = { ults: number; combos: number; crits: number; supers: number; switches: number; items: number };
export const emptyTally = (): Tally => ({ ults: 0, combos: 0, crits: 0, supers: 0, switches: 0, items: 0 });
export const tallyOf = (state: BattleState, side: Side): Tally => state.tally?.[side] ?? emptyTally();
function count(state: BattleState, side: Side, key: keyof Tally) {
  if (!state.tally) return; // battles saved before tallies existed
  state.tally[side][key] += 1;
}
export type Rng = () => number;

export const ENERGY_MAX = 5;
export const SPECIAL_COST = 3;
export const ULT_MAX = 100;
export const ULT_ON_HIT = 15;
export const ULT_ON_HURT = 10;
export const ULT_ON_GUARD = 10;
export const ULTIMATE_POWER = 2.2;

// Ultimate moves reuse the type's special effect at ULTIMATE_POWER.
export const ULTIMATE_NAMES: Record<string, string> = {
  Fire: "นรกเพลิง", Water: "สึนามิยักษ์", Grass: "ป่าคลั่ง", Electric: "สายฟ้าพันลูก", Ice: "ยุคน้ำแข็ง",
  Fighting: "หมัดพันหมื่น", Poison: "หมอกพิษมรณะ", Ground: "แผ่นดินแยก", Flying: "พายุทอร์นาโด",
  Psychic: "จิตพิฆาต", Bug: "ฝูงมหาภัย", Rock: "อุกกาบาตถล่ม", Ghost: "วิญญาณหลอน", Dragon: "มังกรพิโรธ",
  Dark: "ราตรีนิรันดร์", Steel: "ปราการเหล็ก", Fairy: "แสงศักดิ์สิทธิ์", Normal: "หมัดสุดพลัง",
};

export const ultOf = (team: Team) => team.ult ?? 0;

export const EMOTES = ["😆", "😱", "🔥", "👏", "😭", "💪", "😎", "🤣"] as const;
function gainUlt(team: Team, amount: number) {
  team.ult = Math.min(ULT_MAX, ultOf(team) + amount);
}
export const EVADE_CAP = 40;
export const LOG_LIMIT = 40;
export const EVENT_LIMIT = 40;
export const SMALL_TEAM_HP_BONUS = 1.2;
export const LAST_STAND_ATK = 1.15;

export const STATUS_INFO: Record<StatusKind, { icon: string; label: string }> = {
  BURN: { icon: "🔥", label: "ไหม้" },
  POISON: { icon: "☠️", label: "พิษ" },
  PARALYZE: { icon: "⚡", label: "ชา" },
  FREEZE: { icon: "❄️", label: "แช่แข็ง" },
  FEAR: { icon: "😨", label: "ขู่" },
  CONFUSE: { icon: "💫", label: "สับสน" },
  RAGE: { icon: "🐉", label: "พลังมังกร" },
  ARMOR: { icon: "🛡️", label: "เกราะ" },
  SWIFT: { icon: "💨", label: "ว่องไว" },
  EXPOSED: { icon: "🎯", label: "เปิดช่อง" },
  WET: { icon: "💧", label: "เปียก" },
  GRASSY: { icon: "🌿", label: "หญ้าคลุม" },
};

// Special move per primary type: its name, power, and what it does.
type Special = {
  name: string;
  power: number;
  target?: { kind: StatusKind; turns: number };
  self?: { kind: StatusKind; turns: number };
  pierce?: boolean;
  drain?: number;
  heal?: number;
  cleanse?: boolean;
};
export const SPECIALS: Record<string, Special> = {
  Fire: { name: "เปลวเพลิง", power: 1.6, target: { kind: "BURN", turns: 2 } },
  Poison: { name: "พ่นพิษ", power: 1.6, target: { kind: "POISON", turns: 3 } },
  Electric: { name: "สายฟ้าฟาด", power: 1.6, target: { kind: "PARALYZE", turns: 2 } },
  Ice: { name: "ลมหนาว", power: 1.6, target: { kind: "FREEZE", turns: 2 } },
  Ghost: { name: "เงาหลอน", power: 1.6, target: { kind: "FEAR", turns: 2 } },
  Dark: { name: "จู่โจมมืด", power: 1.6, target: { kind: "FEAR", turns: 2 } },
  Psychic: { name: "คลื่นจิต", power: 1.6, target: { kind: "CONFUSE", turns: 2 } },
  Fighting: { name: "หมัดเจาะเกราะ", power: 1.6, pierce: true },
  Grass: { name: "ดูดพลัง", power: 1.6, drain: 0.5 },
  Water: { name: "คลื่นฟื้นฟู", power: 1.6, heal: 0.15 },
  Fairy: { name: "แสงอวยพร", power: 1.6, heal: 0.2, cleanse: true },
  Dragon: { name: "พลังมังกร", power: 1.6, self: { kind: "RAGE", turns: 2 } },
  Rock: { name: "หินถล่ม", power: 1.6, self: { kind: "ARMOR", turns: 2 } },
  Ground: { name: "แผ่นดินไหว", power: 1.6, self: { kind: "ARMOR", turns: 2 } },
  Steel: { name: "หางเหล็ก", power: 1.6, self: { kind: "ARMOR", turns: 2 } },
  Flying: { name: "ลมกรด", power: 1.6, self: { kind: "SWIFT", turns: 2 } },
  Bug: { name: "ฝูงแมลง", power: 1.6, self: { kind: "SWIFT", turns: 2 } },
  Normal: { name: "ทุ่มสุดตัว", power: 2.0, self: { kind: "EXPOSED", turns: 1 } },
};

const BAD_STATUSES: StatusKind[] = ["BURN", "POISON", "PARALYZE", "FREEZE", "FEAR", "CONFUSE", "WET", "GRASSY"];

// Field conditions: the attacker's primary type gets ×WEATHER_BOOST or ×WEATHER_WEAKEN.
export const WEATHER_BOOST = 1.2;
export const WEATHER_WEAKEN = 0.8;
export const WEATHER_ROUNDS = 4;
export const WEATHER: Record<WeatherKind, { icon: string; label: string; boost: string[]; weaken: string[] }> = {
  CLEAR: { icon: "🌤️", label: "ฟ้าใส", boost: [], weaken: [] },
  SUN: { icon: "☀️", label: "แดดจ้า", boost: ["Fire"], weaken: ["Water"] },
  RAIN: { icon: "🌧️", label: "ฝนตก", boost: ["Water"], weaken: ["Fire"] },
  STORM: { icon: "⛈️", label: "พายุฟ้าคะนอง", boost: ["Electric", "Flying"], weaken: [] },
  SNOW: { icon: "❄️", label: "หิมะตก", boost: ["Ice"], weaken: ["Grass"] },
  SAND: { icon: "🏜️", label: "พายุทราย", boost: ["Rock", "Ground", "Steel"], weaken: ["Electric"] },
};
export const WEATHER_KINDS = Object.keys(WEATHER) as WeatherKind[];

export function weatherMultiplier(weather: WeatherKind | undefined, attackType: string) {
  const field = WEATHER[weather ?? "CLEAR"];
  if (field.boost.includes(attackType)) return WEATHER_BOOST;
  if (field.weaken.includes(attackType)) return WEATHER_WEAKEN;
  return 1;
}

export function rollWeather(rng: Rng, not?: WeatherKind, pool: WeatherKind[] = WEATHER_KINDS): WeatherKind {
  const options = pool.filter((kind) => kind !== not);
  return options[Math.floor(rng() * options.length)] ?? "CLEAR";
}

// Arena themes: a backdrop, the weather it tends to have, and one house rule.
export const THEMES: Record<ThemeKind, { icon: string; label: string; rule: string; weather: WeatherKind[] }> = {
  VOLCANO: { icon: "🌋", label: "ภูเขาไฟ", rule: "ทุก 3 รอบลาวาปะทุ ตัวที่ไม่ใช่ 🔥 เสีย HP 5%", weather: ["SUN", "SUN", "SAND", "CLEAR"] },
  BEACH: { icon: "🌊", label: "ชายหาด", rule: "💧 ฟื้น HP 3% ทุกตา", weather: ["RAIN", "RAIN", "SUN", "CLEAR", "STORM"] },
  FOREST: { icon: "🌲", label: "ป่าลึก", rule: "🌿 และ 🐛 หลบ +8%", weather: ["RAIN", "CLEAR", "CLEAR", "STORM"] },
  SNOWPEAK: { icon: "🏔️", label: "ยอดเขาหิมะ", rule: "ตีโดนมีโอกาส 10% ให้ศัตรูแช่แข็ง 1 ตา", weather: ["SNOW", "SNOW", "SNOW", "CLEAR"] },
  SPACE: { icon: "🌌", label: "อวกาศ", rule: "ทุกตัวหลบ +10% · ท่าพิเศษใช้ ⚡2 · ไม่มีสภาพอากาศ", weather: ["CLEAR"] },
  STADIUM: { icon: "🏟️", label: "สเตเดียม", rule: "คริหรือได้เปรียบธาตุ คนดูเชียร์ หลอดไม้ตาย +10", weather: WEATHER_KINDS },
};
export const THEME_KINDS = Object.keys(THEMES) as ThemeKind[];
export const LAVA_EVERY = 3;
export const LAVA_DAMAGE = 0.05;
export const BEACH_HEAL = 0.03;
export const FOREST_EVADE = 8;
export const SPACE_EVADE = 10;
export const SNOW_FREEZE_CHANCE = 0.1;
export const CHEER_ULT = 10;

export function specialCost(state: Pick<BattleState, "theme">) {
  return state.theme === "SPACE" ? SPECIAL_COST - 1 : SPECIAL_COST;
}

// Random field events: from round FIELD_EVENT_FROM, FIELD_EVENT_CHANCE per round, at most FIELD_EVENT_MAX.
export const FIELD_EVENT_FROM = 3;
export const FIELD_EVENT_CHANCE = 0.2;
export const FIELD_EVENT_MAX = 2;
export const FIELD_EVENTS: Record<FieldEventKind, { icon: string; label: string }> = {
  METEOR: { icon: "☄️", label: "อุกกาบาตตก!" },
  LIGHTNING: { icon: "⚡", label: "ฟ้าผ่า!" },
  RAINBOW: { icon: "🌈", label: "สายรุ้งปรากฏ!" },
  GIFT: { icon: "🎁", label: "กล่องของขวัญหล่นมา!" },
  LAVA: { icon: "🌋", label: "ลาวาปะทุ!" },
  CHEER: { icon: "📣", label: "คนดูเชียร์!" },
};

// Element combos: a mark (or status) on the defender plus the right attack type.
export const COMBO_MULTIPLIER = 1.3;
export const MARK_TURNS = 2;
type Combo = { name: string; needs: StatusKind; types: string[]; multiplier?: number; crit?: boolean; burn?: boolean; consume: boolean };
export const COMBOS: Combo[] = [
  { name: "⚡💧 ช็อตไฟฟ้า", needs: "WET", types: ["Electric"], multiplier: COMBO_MULTIPLIER, consume: true },
  { name: "❄️💥 แตกกระจาย", needs: "FREEZE", types: ["Rock", "Fighting", "Steel"], crit: true, consume: true },
  { name: "🌿🔥 ไฟลาม", needs: "GRASSY", types: ["Fire"], multiplier: 1.1, burn: true, consume: true },
  { name: "🔥🌪️ พายุไฟ", needs: "BURN", types: ["Flying"], multiplier: COMBO_MULTIPLIER, consume: false },
];
const MARK_FROM: Partial<Record<string, StatusKind>> = { Water: "WET", Grass: "GRASSY" };

// One carried item per battle for the child; using it takes the turn.
export const ITEMS: Record<ItemKind, { icon: string; label: string; detail: string; price: number }> = {
  POTION: { icon: "🧪", label: "ยาฟื้น HP", detail: "ฟื้น HP 30%", price: 60 },
  ETHER: { icon: "🔋", label: "ยาพลัง", detail: "⚡ +2", price: 50 },
  CLEANSE: { icon: "✨", label: "ยาล้างสถานะ", detail: "ล้างสถานะไม่ดี + ฟื้น 10%", price: 40 },
};
const DOT: Partial<Record<StatusKind, number>> = { BURN: 0.08, POISON: 0.06 };
const PARALYZE_SKIP = 0.25;

type CharacterInfo = Omit<Fighter, "stats" | "hp" | "statuses" | "guard" | "damageDealt">;

export function makeFighter(character: CharacterInfo, scale = 1): Fighter {
  const base = computeStats(character);
  const stats: Stats = {
    ...base,
    hp: Math.round(base.hp * scale),
    atk: Math.round(base.atk * scale),
    def: Math.round(base.def * scale),
  };
  return { ...character, stats, hp: stats.hp, statuses: [], guard: false, damageDealt: 0 };
}

// Teams of 1–2 get extra HP so a small collection can still compete.
export function makeTeam(characters: CharacterInfo[], scale = 1): Team {
  const hpBonus = characters.length < 3 ? SMALL_TEAM_HP_BONUS : 1;
  const fighters = characters.map((character) => {
    const fighter = makeFighter(character, scale);
    fighter.stats.hp = Math.round(fighter.stats.hp * hpBonus);
    fighter.hp = fighter.stats.hp;
    return fighter;
  });
  return { fighters, active: 0, energy: 0 };
}

// The parent team plays at the child team's average level, rounded down,
// so leveling up still gives the child a small edge.
export function parentLevelFor(childLevels: number[]) {
  if (childLevels.length === 0) return 1;
  return Math.max(1, Math.floor(childLevels.reduce((sum, level) => sum + level, 0) / childLevels.length));
}

export function startBattle(child: Team, parent: Team, weather: WeatherKind = "CLEAR", theme?: ThemeKind): BattleState {
  const space = theme === "SPACE";
  const state: BattleState = {
    turn: "CHILD", round: 1, teams: { CHILD: child, PARENT: parent }, log: [], winner: null,
    weather: space ? "CLEAR" : weather, weatherUntil: space ? undefined : 1 + WEATHER_ROUNDS,
    theme, fieldEvents: 0, tally: { CHILD: emptyTally(), PARENT: emptyTally() },
  };
  push(state, "⚔️ เริ่มการต่อสู้! " + child.fighters[0].name + " ปะทะ " + parent.fighters[0].name);
  return state;
}

// Tournaments: the child's team carries into the next round, healed a little.
export const TOURNAMENT_HEAL = 0.6;

export function carryOver(team: Team): Team {
  const next = structuredClone(team);
  for (const fighter of next.fighters) {
    fighter.hp = Math.min(fighter.stats.hp, fighter.hp + Math.round(fighter.stats.hp * TOURNAMENT_HEAL));
    fighter.statuses = [];
    fighter.guard = false;
  }
  next.active = 0;
  next.energy = 0;
  return next;
}

// A fresh battle against the next opponent. The ultimate gauge, the carried item,
// damage dealt, and the tallies all keep counting across the tournament.
export function startNextStage(previous: BattleState, parent: Team, weather: WeatherKind = "CLEAR", theme?: ThemeKind): BattleState {
  const state = startBattle(carryOver(previous.teams.CHILD), parent, weather, theme);
  if (previous.tally) state.tally = structuredClone(previous.tally);
  return state;
}

export const other = (side: Side): Side => (side === "CHILD" ? "PARENT" : "CHILD");
export const activeFighter = (state: BattleState, side: Side) => state.teams[side].fighters[state.teams[side].active];
const has = (fighter: Fighter, kind: StatusKind) => fighter.statuses.some((status) => status.kind === kind);
const aliveCount = (team: Team) => team.fighters.filter((fighter) => fighter.hp > 0).length;
// Only a team that has lost members gets the comeback boost; solo teams get extra HP instead.
const isLastStand = (team: Team) => team.fighters.length > 1 && aliveCount(team) === 1;

function push(state: BattleState, line: string) {
  state.log.push(line);
  if (state.log.length > LOG_LIMIT) state.log.splice(0, state.log.length - LOG_LIMIT);
}

function emit(state: BattleState, event: Omit<BattleEvent, "seq">) {
  const seq = (state.eventSeq ?? 0) + 1;
  state.eventSeq = seq;
  state.events = [...(state.events ?? []), { ...event, seq }].slice(-EVENT_LIMIT);
}

function addStatus(fighter: Fighter, kind: StatusKind, turns: number) {
  const existing = fighter.statuses.find((status) => status.kind === kind);
  if (existing) existing.turns = Math.max(existing.turns, turns);
  else fighter.statuses.push({ kind, turns });
}

function effectiveAtk(state: BattleState, side: Side, fighter: Fighter) {
  let atk = fighter.stats.atk;
  if (has(fighter, "RAGE")) atk *= 1.2;
  if (has(fighter, "FEAR")) atk *= 0.8;
  if (has(fighter, "FREEZE")) atk *= 0.7;
  if (isLastStand(state.teams[side])) atk *= LAST_STAND_ATK;
  return atk;
}

function effectiveDef(fighter: Fighter) {
  let def = fighter.stats.def;
  if (has(fighter, "ARMOR")) def *= 1.5;
  if (has(fighter, "EXPOSED")) def *= 0.5;
  return def;
}

function effectiveEva(state: BattleState, fighter: Fighter) {
  if (has(fighter, "FREEZE")) return 0;
  let eva = fighter.stats.eva;
  if (state.theme === "SPACE") eva += SPACE_EVADE;
  if (state.theme === "FOREST" && (fighter.type_primary === "Grass" || fighter.type_primary === "Bug")) eva += FOREST_EVADE;
  if (has(fighter, "SWIFT")) eva += 15;
  if (has(fighter, "CONFUSE")) eva -= 10;
  return Math.max(0, Math.min(EVADE_CAP, eva));
}

const effectiveCrit = (fighter: Fighter) => (has(fighter, "CONFUSE") ? 0 : fighter.stats.crit);

function multiplierText(multiplier: number) {
  if (multiplier >= 1.5) return " ได้เปรียบธาตุ ×" + multiplier + "!";
  if (multiplier < 1) return " แพ้ทางธาตุ ×" + multiplier;
  return "";
}

function hpText(fighter: Fighter) {
  return fighter.name + " (" + fighter.hp + "/" + fighter.stats.hp + ")";
}

function hit(state: BattleState, side: Side, special: Special | null, rng: Rng, ultimate = false) {
  const attacker = activeFighter(state, side);
  const defender = activeFighter(state, other(side));
  const icon = TYPE_ICON[attacker.type_primary] ?? "";
  const move = ultimate
    ? "ปล่อย 💥 ท่าไม้ตาย " + icon + " " + (ULTIMATE_NAMES[attacker.type_primary] ?? ULTIMATE_NAMES.Normal) + "!!"
    : special ? "ใช้ 🌟 " + icon + " " + special.name + "!" : "⚔️ โจมตี";
  const attackerIndex = state.teams[side].active;
  const defenderIndex = state.teams[other(side)].active;
  emit(state, {
    kind: ultimate ? "ultimate" : special ? "special" : "attack", side, index: attackerIndex, type: attacker.type_primary,
    move: ultimate ? ULTIMATE_NAMES[attacker.type_primary] ?? ULTIMATE_NAMES.Normal : special?.name,
  });

  // Special moves never miss, so saving energy for one is always worth it.
  if (!special && rng() * 100 < effectiveEva(state, defender)) {
    push(state, attacker.name + " " + move + " → " + defender.name + " หลบได้! 💨");
    emit(state, { kind: "miss", side: other(side), index: defenderIndex });
    return;
  }

  const multiplier = typeMultiplier(attacker.type_primary, defender);
  const combo = COMBOS.find((entry) => entry.types.includes(attacker.type_primary) && has(defender, entry.needs));
  const crit = rng() * 100 < effectiveCrit(attacker) || Boolean(combo?.crit);
  const def = special?.pierce ? 0 : effectiveDef(defender);
  let damage = baseDamage(effectiveAtk(state, side, attacker), def, multiplier, rng(), crit);
  if (special) damage = Math.round(damage * (ultimate ? ULTIMATE_POWER : special.power));
  const field = weatherMultiplier(state.weather, attacker.type_primary);
  damage = Math.round(damage * field * (combo?.multiplier ?? 1));
  let guarded = false;
  if (defender.guard) {
    damage = Math.max(1, Math.round(damage / 2));
    defender.guard = false;
    guarded = true;
  }
  damage = Math.min(damage, defender.hp);
  defender.hp -= damage;
  attacker.damageDealt += damage;
  state.teams[other(side)].energy = Math.min(ENERGY_MAX, state.teams[other(side)].energy + 1);
  if (!ultimate) gainUlt(state.teams[side], ULT_ON_HIT);
  gainUlt(state.teams[other(side)], ULT_ON_HURT);
  if (ultimate) count(state, side, "ults");
  if (combo) count(state, side, "combos");
  if (crit) count(state, side, "crits");
  if (multiplier >= 1.5) count(state, side, "supers");
  const cheer = state.theme === "STADIUM" && (crit || multiplier >= 1.5);
  if (cheer) gainUlt(state.teams[side], CHEER_ULT);

  push(state, attacker.name + " " + move + multiplierText(multiplier)
    + (field > 1 ? " สนามช่วย " + WEATHER[state.weather ?? "CLEAR"].icon : field < 1 ? " สนามกด " + WEATHER[state.weather ?? "CLEAR"].icon : "")
    + (combo ? " 🔗 คอมโบ " + combo.name + "!" : "") + (crit ? " คริติคอล! 💥" : "")
    + (guarded ? " (ตั้งรับไว้ ลดครึ่ง 🛡️)" : "") + " → " + defender.name + " −" + damage + " HP (" + defender.hp + "/" + defender.stats.hp + ")");
  if (combo) {
    emit(state, { kind: "combo", side: other(side), index: defenderIndex, combo: combo.name });
    if (combo.consume) defender.statuses = defender.statuses.filter((status) => status.kind !== combo.needs);
    if (combo.burn && defender.hp > 0) addStatus(defender, "BURN", 2);
  }
  const mark = MARK_FROM[attacker.type_primary];
  if (mark && defender.hp > 0 && !combo) addStatus(defender, mark, MARK_TURNS);
  if (cheer) {
    push(state, "📣 คนดูเชียร์ " + attacker.name + "! หลอดไม้ตาย +" + CHEER_ULT);
    emit(state, { kind: "field", side, index: attackerIndex, fieldEvent: "CHEER" });
  }
  if (state.theme === "SNOWPEAK" && defender.hp > 0 && !has(defender, "FREEZE") && rng() < SNOW_FREEZE_CHANCE) {
    addStatus(defender, "FREEZE", 1);
    push(state, "🏔️ ลมหิมะ! " + defender.name + " ติด ❄️ แช่แข็ง 1 ตา");
    emit(state, { kind: "status", side: other(side), index: defenderIndex, status: "FREEZE" });
  }
  emit(state, {
    kind: "hit", side: other(side), index: defenderIndex, amount: damage, hp: defender.hp, max: defender.stats.hp,
    crit, multiplier, guarded, type: attacker.type_primary,
  });

  if (!special) return;
  if (special.target && defender.hp > 0) {
    addStatus(defender, special.target.kind, special.target.turns);
    const info = STATUS_INFO[special.target.kind];
    push(state, defender.name + " ติด " + info.icon + " " + info.label + " " + special.target.turns + " ตา");
    emit(state, { kind: "status", side: other(side), index: defenderIndex, status: special.target.kind });
  }
  if (special.self) {
    addStatus(attacker, special.self.kind, special.self.turns);
    const info = STATUS_INFO[special.self.kind];
    push(state, attacker.name + " ได้ " + info.icon + " " + info.label);
    emit(state, { kind: "buff", side, index: attackerIndex, status: special.self.kind });
  }
  const healAmount = Math.round((special.drain ? damage * special.drain : 0) + (special.heal ? attacker.stats.hp * special.heal : 0));
  if (healAmount > 0) {
    const healed = Math.min(healAmount, attacker.stats.hp - attacker.hp);
    attacker.hp += healed;
    if (healed > 0) {
      push(state, attacker.name + " ฟื้น +" + healed + " HP 💚 " + hpText(attacker));
      emit(state, { kind: "heal", side, index: attackerIndex, amount: healed, hp: attacker.hp, max: attacker.stats.hp });
    }
  }
  if (special.cleanse) attacker.statuses = attacker.statuses.filter((status) => !BAD_STATUSES.includes(status.kind));
}

// Burn/poison tick and every status counts down at the end of its owner's turn.
function endOfTurn(state: BattleState, side: Side) {
  const fighter = activeFighter(state, side);
  if (fighter.hp <= 0) return;
  for (const status of fighter.statuses) {
    const rate = DOT[status.kind];
    if (!rate) continue;
    const damage = Math.min(fighter.hp, Math.max(1, Math.round(fighter.stats.hp * rate)));
    fighter.hp -= damage;
    const info = STATUS_INFO[status.kind];
    push(state, fighter.name + " " + info.icon + " " + info.label + " −" + damage + " HP (" + fighter.hp + "/" + fighter.stats.hp + ")");
    emit(state, { kind: "tick", side, index: state.teams[side].active, amount: damage, hp: fighter.hp, max: fighter.stats.hp, status: status.kind });
  }
  fighter.statuses = fighter.statuses
    .map((status) => ({ ...status, turns: status.turns - 1 }))
    .filter((status) => status.turns > 0);
  if (state.theme === "BEACH" && fighter.type_primary === "Water" && fighter.hp > 0) {
    heal(state, side, Math.max(1, Math.round(fighter.stats.hp * BEACH_HEAL)), "🌊");
  }
}

function heal(state: BattleState, side: Side, amount: number, icon: string) {
  const fighter = activeFighter(state, side);
  const healed = Math.min(amount, fighter.stats.hp - fighter.hp);
  if (healed <= 0 || fighter.hp <= 0) return;
  fighter.hp += healed;
  push(state, icon + " " + fighter.name + " ฟื้น +" + healed + " HP 💚 " + hpText(fighter));
  emit(state, { kind: "heal", side, index: state.teams[side].active, amount: healed, hp: fighter.hp, max: fighter.stats.hp });
}

function hurt(state: BattleState, side: Side, amount: number, icon: string) {
  const fighter = activeFighter(state, side);
  if (fighter.hp <= 0) return;
  const damage = Math.min(fighter.hp, Math.max(1, amount));
  fighter.hp -= damage;
  push(state, icon + " " + fighter.name + " −" + damage + " HP (" + fighter.hp + "/" + fighter.stats.hp + ")");
  emit(state, { kind: "tick", side, index: state.teams[side].active, amount: damage, hp: fighter.hp, max: fighter.stats.hp });
}

function teamHpShare(team: Team) {
  const max = team.fighters.reduce((sum, fighter) => sum + fighter.stats.hp, 0);
  return team.fighters.reduce((sum, fighter) => sum + fighter.hp, 0) / max;
}

function fieldEvent(state: BattleState, kind: FieldEventKind, side: Side = "CHILD") {
  const info = FIELD_EVENTS[kind];
  push(state, info.icon + " " + info.label);
  emit(state, { kind: "field", side, index: state.teams[side].active, fieldEvent: kind });
}

// Everything that happens as a new round begins: weather rotation, theme hazards, random field events.
function roundStart(state: BattleState, rng: Rng) {
  // Battles saved before weather existed have no weatherUntil and keep a clear field.
  if (state.weatherUntil && state.round >= state.weatherUntil) {
    state.weather = rollWeather(rng, state.weather, state.theme ? THEMES[state.theme].weather : WEATHER_KINDS);
    state.weatherUntil = state.round + WEATHER_ROUNDS;
    const field = WEATHER[state.weather];
    push(state, "🌦️ สภาพสนามเปลี่ยน! " + field.icon + " " + field.label);
    emit(state, { kind: "weather", side: "CHILD", index: 0, weather: state.weather });
  }

  if (state.theme === "VOLCANO" && state.round % LAVA_EVERY === 0) {
    fieldEvent(state, "LAVA");
    for (const side of ["CHILD", "PARENT"] as Side[]) {
      const fighter = activeFighter(state, side);
      if (fighter.type_primary !== "Fire") hurt(state, side, Math.round(fighter.stats.hp * LAVA_DAMAGE), "🌋");
    }
  }

  if (state.fieldEvents === undefined || state.round < FIELD_EVENT_FROM || state.fieldEvents >= FIELD_EVENT_MAX) return;
  if (rng() >= FIELD_EVENT_CHANCE) return;
  state.fieldEvents += 1;
  const kinds: FieldEventKind[] = ["METEOR", "LIGHTNING", "RAINBOW", "GIFT"];
  const kind = kinds[Math.floor(rng() * kinds.length)] ?? "RAINBOW";
  if (kind === "METEOR") {
    const side: Side = rng() < 0.5 ? "CHILD" : "PARENT";
    fieldEvent(state, kind, side);
    hurt(state, side, Math.round(activeFighter(state, side).stats.hp * 0.1), "☄️");
  } else if (kind === "LIGHTNING") {
    const wet = (["CHILD", "PARENT"] as Side[]).filter((side) => has(activeFighter(state, side), "WET"));
    fieldEvent(state, kind, wet[0] ?? "CHILD");
    if (wet.length === 0) push(state, "⚡ ฟ้าผ่าลงพื้น ไม่มีใครโดน!");
    for (const side of wet) hurt(state, side, Math.round(activeFighter(state, side).stats.hp * 0.12), "⚡");
  } else if (kind === "RAINBOW") {
    fieldEvent(state, kind);
    for (const side of ["CHILD", "PARENT"] as Side[]) heal(state, side, Math.round(activeFighter(state, side).stats.hp * 0.1), "🌈");
  } else {
    // The gift helps whoever is behind, so it can swing a lopsided game.
    const side: Side = teamHpShare(state.teams.CHILD) <= teamHpShare(state.teams.PARENT) ? "CHILD" : "PARENT";
    fieldEvent(state, kind, side);
    const team = state.teams[side];
    team.energy = Math.min(ENERGY_MAX, team.energy + 2);
    gainUlt(team, 30);
    push(state, "🎁 " + (side === "CHILD" ? "ลูก" : "ผู้ปกครอง") + " ได้ ⚡+2 และหลอดไม้ตาย +30");
  }
}

function replaceFainted(state: BattleState) {
  for (const side of [other(state.turn), state.turn]) {
    const team = state.teams[side];
    const fighter = team.fighters[team.active];
    if (fighter.hp > 0) continue;
    push(state, "😵 " + fighter.name + " หมดแรง!");
    emit(state, { kind: "faint", side, index: team.active });
    const next = team.fighters.findIndex((candidate) => candidate.hp > 0);
    if (next === -1) {
      state.winner = other(side);
      return;
    }
    team.active = next;
    const who = side === "CHILD" ? "ลูก" : "ผู้ปกครอง";
    push(state, "➡️ " + who + " ส่ง " + team.fighters[next].name + " ออกมาสู้!" + (isLastStand(team) ? " 🔥 ฮึดสู้! ATK +15%" : ""));
    emit(state, { kind: "switch", side, index: next });
  }
}

export class ArenaError extends Error {}

export function applyAction(state: BattleState, side: Side, action: Action, rng: Rng, target?: number): BattleState {
  if (state.winner) throw new ArenaError("การต่อสู้จบแล้ว");
  if (state.turn !== side) throw new ArenaError("ยังไม่ถึงตาคุณ");
  const next: BattleState = structuredClone(state);
  const team = next.teams[side];
  const fighter = activeFighter(next, side);
  if (action === "SPECIAL" && team.energy < specialCost(next)) throw new ArenaError("พลังไม่พอ ต้องมี ⚡ " + specialCost(next));
  if (action === "ULTIMATE" && ultOf(team) < ULT_MAX) throw new ArenaError("หลอดไม้ตายยังไม่เต็ม");
  if (action === "SWITCH") {
    const bench = target === undefined ? undefined : team.fighters[target];
    if (!bench || target === team.active || bench.hp <= 0) throw new ArenaError("เลือกตัวสำรองที่ยังสู้ได้");
  }
  if (action === "ITEM" && (!team.item || team.item.used)) throw new ArenaError("ไม่มีไอเทมให้ใช้");

  fighter.guard = false;

  // Switching and items work even while paralyzed, so they're a real escape.
  if (action === "SWITCH") {
    const who = side === "CHILD" ? "ลูก" : "ผู้ปกครอง";
    emit(next, { kind: "recall", side, index: team.active });
    team.active = target!;
    push(next, "🔄 " + who + " เรียก " + fighter.name + " กลับ แล้วส่ง " + team.fighters[target!].name + " ออกมา!");
    emit(next, { kind: "switch", side, index: target! });
    count(next, side, "switches");
  } else if (action === "ITEM") {
    const item = team.item!;
    item.used = true;
    const info = ITEMS[item.kind];
    push(next, fighter.name + " ใช้ " + info.icon + " " + info.label + "!");
    emit(next, { kind: "item", side, index: team.active, item: item.kind });
    count(next, side, "items");
    if (item.kind === "ETHER") team.energy = Math.min(ENERGY_MAX, team.energy + 2);
    if (item.kind === "CLEANSE") fighter.statuses = fighter.statuses.filter((status) => !BAD_STATUSES.includes(status.kind));
    const healRate = item.kind === "POTION" ? 0.3 : item.kind === "CLEANSE" ? 0.1 : 0;
    const healed = Math.min(Math.round(fighter.stats.hp * healRate), fighter.stats.hp - fighter.hp);
    if (healed > 0) {
      fighter.hp += healed;
      push(next, fighter.name + " ฟื้น +" + healed + " HP 💚 " + hpText(fighter));
      emit(next, { kind: "heal", side, index: team.active, amount: healed, hp: fighter.hp, max: fighter.stats.hp });
    }
  } else if (has(fighter, "PARALYZE") && rng() < PARALYZE_SKIP) {
    push(next, fighter.name + " ⚡ ชา! ขยับไม่ได้");
    emit(next, { kind: "paralyzed", side, index: team.active });
  } else if (action === "GUARD") {
    fighter.guard = true;
    team.energy = Math.min(ENERGY_MAX, team.energy + 1);
    gainUlt(team, ULT_ON_GUARD);
    push(next, fighter.name + " 🛡️ ตั้งรับ! (พลัง ⚡ " + team.energy + ")");
    emit(next, { kind: "guard", side, index: team.active });
  } else if (action === "ULTIMATE") {
    team.ult = 0;
    hit(next, side, SPECIALS[fighter.type_primary] ?? SPECIALS.Normal, rng, true);
  } else if (action === "SPECIAL") {
    team.energy -= specialCost(next);
    hit(next, side, SPECIALS[fighter.type_primary] ?? SPECIALS.Normal, rng);
  } else {
    hit(next, side, null, rng);
  }

  // Energy is gained at the end of your own turn, so the number shown is what you can spend.
  team.energy = Math.min(ENERGY_MAX, team.energy + 1);
  endOfTurn(next, side);
  replaceFainted(next);
  if (next.winner) {
    next.finisher = action;
    push(next, next.winner === "CHILD" ? "🏆 ลูกชนะ!" : "🏆 ผู้ปกครองชนะ!");
    emit(next, { kind: "win", side: next.winner, index: next.teams[next.winner].active });
    return next;
  }
  next.turn = other(side);
  if (next.turn === "CHILD") {
    next.round += 1;
    roundStart(next, rng);
    // Hazards can knock monsters out too (re-read: TS thinks winner is still null here).
    replaceFainted(next);
    const winner = next.winner as Side | null;
    if (winner) {
      push(next, winner === "CHILD" ? "🏆 ลูกชนะ!" : "🏆 ผู้ปกครองชนะ!");
      emit(next, { kind: "win", side: winner, index: next.teams[winner].active });
    }
  }
  return next;
}

// Simple opponent for "let the system play": specials when they land well, guard when low.
export function chooseAiAction(state: BattleState, side: Side, rng: Rng): Action {
  const me = activeFighter(state, side);
  const foe = activeFighter(state, other(side));
  if (ultOf(state.teams[side]) >= ULT_MAX) return "ULTIMATE";
  if (aiSwitchTarget(state, side) !== null && rng() < 0.3) return "SWITCH";
  // Brace when the other side's ultimate is ready and this monster can't take it.
  if (ultOf(state.teams[other(side)]) >= ULT_MAX && me.hp < me.stats.hp * 0.6 && rng() < 0.5) return "GUARD";
  if (state.teams[side].energy >= specialCost(state) && (typeMultiplier(me.type_primary, foe) >= 1 || rng() < 0.5)) return "SPECIAL";
  if (me.hp < me.stats.hp * 0.35 && rng() < 0.4) return "GUARD";
  return "ATTACK";
}

// A bench monster that isn't weak to the current foe, when the active one is.
export function aiSwitchTarget(state: BattleState, side: Side): number | null {
  const team = state.teams[side];
  const foe = activeFighter(state, other(side));
  if (typeMultiplier(foe.type_primary, activeFighter(state, side)) < 1.5) return null;
  const index = team.fighters.findIndex((fighter, i) => i !== team.active && fighter.hp > 0 && typeMultiplier(foe.type_primary, fighter) < 1.5);
  return index === -1 ? null : index;
}

// Plays one AI turn, including the switch target when it decides to switch.
export function aiTurn(state: BattleState, side: Side, rng: Rng) {
  const action = chooseAiAction(state, side, rng);
  return applyAction(state, side, action, rng, action === "SWITCH" ? aiSwitchTarget(state, side) ?? undefined : undefined);
}

// Winning side's fighter with the most damage.
export function mvp(state: BattleState) {
  if (!state.winner) return null;
  return [...state.teams[state.winner].fighters].sort((a, b) => b.damageDealt - a.damageDealt)[0] ?? null;
}
