// Turn-based arena engine. Pure: callers pass a random source, so the server
// can use crypto randomness and tests can script every roll.
import { baseDamage, computeStats, typeMultiplier, type Stats } from "./battle";
import { TYPE_ICON } from "./types";

export type Side = "CHILD" | "PARENT";
export type Action = "ATTACK" | "SPECIAL" | "GUARD";
export type StatusKind =
  | "BURN" | "POISON" | "PARALYZE" | "FREEZE" | "FEAR" | "CONFUSE" // on the target
  | "RAGE" | "ARMOR" | "SWIFT" | "EXPOSED"; // on self

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
export type Team = { fighters: Fighter[]; active: number; energy: number };
export type BattleState = {
  turn: Side;
  round: number;
  teams: Record<Side, Team>;
  log: string[];
  winner: Side | null;
};
export type Rng = () => number;

export const ENERGY_MAX = 5;
export const SPECIAL_COST = 3;
export const EVADE_CAP = 40;
export const LOG_LIMIT = 40;
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

const BAD_STATUSES: StatusKind[] = ["BURN", "POISON", "PARALYZE", "FREEZE", "FEAR", "CONFUSE"];
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

export function startBattle(child: Team, parent: Team): BattleState {
  const state: BattleState = { turn: "CHILD", round: 1, teams: { CHILD: child, PARENT: parent }, log: [], winner: null };
  push(state, "⚔️ เริ่มการต่อสู้! " + child.fighters[0].name + " ปะทะ " + parent.fighters[0].name);
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

function effectiveEva(fighter: Fighter) {
  if (has(fighter, "FREEZE")) return 0;
  let eva = fighter.stats.eva;
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

function hit(state: BattleState, side: Side, special: Special | null, rng: Rng) {
  const attacker = activeFighter(state, side);
  const defender = activeFighter(state, other(side));
  const icon = TYPE_ICON[attacker.type_primary] ?? "";
  const move = special ? "ใช้ 🌟 " + icon + " " + special.name + "!" : "⚔️ โจมตี";

  // Special moves never miss, so saving energy for one is always worth it.
  if (!special && rng() * 100 < effectiveEva(defender)) {
    push(state, attacker.name + " " + move + " → " + defender.name + " หลบได้! 💨");
    return;
  }

  const multiplier = typeMultiplier(attacker.type_primary, defender);
  const crit = rng() * 100 < effectiveCrit(attacker);
  const def = special?.pierce ? 0 : effectiveDef(defender);
  let damage = baseDamage(effectiveAtk(state, side, attacker), def, multiplier, rng(), crit);
  if (special) damage = Math.round(damage * special.power);
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

  push(state, attacker.name + " " + move + multiplierText(multiplier) + (crit ? " คริติคอล! 💥" : "")
    + (guarded ? " (ตั้งรับไว้ ลดครึ่ง 🛡️)" : "") + " → " + defender.name + " −" + damage + " HP (" + defender.hp + "/" + defender.stats.hp + ")");

  if (!special) return;
  if (special.target && defender.hp > 0) {
    addStatus(defender, special.target.kind, special.target.turns);
    const info = STATUS_INFO[special.target.kind];
    push(state, defender.name + " ติด " + info.icon + " " + info.label + " " + special.target.turns + " ตา");
  }
  if (special.self) {
    addStatus(attacker, special.self.kind, special.self.turns);
    const info = STATUS_INFO[special.self.kind];
    push(state, attacker.name + " ได้ " + info.icon + " " + info.label);
  }
  const healAmount = Math.round((special.drain ? damage * special.drain : 0) + (special.heal ? attacker.stats.hp * special.heal : 0));
  if (healAmount > 0) {
    const healed = Math.min(healAmount, attacker.stats.hp - attacker.hp);
    attacker.hp += healed;
    if (healed > 0) push(state, attacker.name + " ฟื้น +" + healed + " HP 💚 " + hpText(attacker));
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
  }
  fighter.statuses = fighter.statuses
    .map((status) => ({ ...status, turns: status.turns - 1 }))
    .filter((status) => status.turns > 0);
}

function replaceFainted(state: BattleState) {
  for (const side of [other(state.turn), state.turn]) {
    const team = state.teams[side];
    const fighter = team.fighters[team.active];
    if (fighter.hp > 0) continue;
    push(state, "😵 " + fighter.name + " หมดแรง!");
    const next = team.fighters.findIndex((candidate) => candidate.hp > 0);
    if (next === -1) {
      state.winner = other(side);
      return;
    }
    team.active = next;
    const who = side === "CHILD" ? "ลูก" : "ผู้ปกครอง";
    push(state, "➡️ " + who + " ส่ง " + team.fighters[next].name + " ออกมาสู้!" + (isLastStand(team) ? " 🔥 ฮึดสู้! ATK +15%" : ""));
  }
}

export class ArenaError extends Error {}

export function applyAction(state: BattleState, side: Side, action: Action, rng: Rng): BattleState {
  if (state.winner) throw new ArenaError("การต่อสู้จบแล้ว");
  if (state.turn !== side) throw new ArenaError("ยังไม่ถึงตาคุณ");
  const next: BattleState = structuredClone(state);
  const team = next.teams[side];
  const fighter = activeFighter(next, side);
  if (action === "SPECIAL" && team.energy < SPECIAL_COST) throw new ArenaError("พลังไม่พอ ต้องมี ⚡ " + SPECIAL_COST);

  fighter.guard = false;

  if (has(fighter, "PARALYZE") && rng() < PARALYZE_SKIP) {
    push(next, fighter.name + " ⚡ ชา! ขยับไม่ได้");
  } else if (action === "GUARD") {
    fighter.guard = true;
    team.energy = Math.min(ENERGY_MAX, team.energy + 1);
    push(next, fighter.name + " 🛡️ ตั้งรับ! (พลัง ⚡ " + team.energy + ")");
  } else if (action === "SPECIAL") {
    team.energy -= SPECIAL_COST;
    hit(next, side, SPECIALS[fighter.type_primary] ?? SPECIALS.Normal, rng);
  } else {
    hit(next, side, null, rng);
  }

  // Energy is gained at the end of your own turn, so the number shown is what you can spend.
  team.energy = Math.min(ENERGY_MAX, team.energy + 1);
  endOfTurn(next, side);
  replaceFainted(next);
  if (next.winner) {
    push(next, next.winner === "CHILD" ? "🏆 ลูกชนะ!" : "🏆 ผู้ปกครองชนะ!");
    return next;
  }
  next.turn = other(side);
  if (next.turn === "CHILD") next.round += 1;
  return next;
}

// Simple opponent for "let the system play": specials when they land well, guard when low.
export function chooseAiAction(state: BattleState, side: Side, rng: Rng): Action {
  const me = activeFighter(state, side);
  const foe = activeFighter(state, other(side));
  if (state.teams[side].energy >= SPECIAL_COST && (typeMultiplier(me.type_primary, foe) >= 1 || rng() < 0.5)) return "SPECIAL";
  if (me.hp < me.stats.hp * 0.35 && rng() < 0.4) return "GUARD";
  return "ATTACK";
}

// Winning side's fighter with the most damage.
export function mvp(state: BattleState) {
  if (!state.winner) return null;
  return [...state.teams[state.winner].fighters].sort((a, b) => b.damageDealt - a.damageDealt)[0] ?? null;
}
