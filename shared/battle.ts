// Battle rules shared by the UI and the Worker: stats, type matchups, damage.
// Everything here is pure so the arena server and the client always agree.

export type Stats = { hp: number; atk: number; def: number; eva: number; crit: number };
export type Archetype = "tank" | "striker" | "agile" | "crit" | "balanced";

// Neutral monster before archetype and rarity. eva/crit are percentages. HP 100 keeps a
// COMMON 3v3 at a median of ~17 turns in simulation (see docs/ARENA.md).
const BASE: Stats = { hp: 100, atk: 20, def: 10, eva: 8, crit: 10 };

// hp/atk/def are multipliers; eva/crit replace the base percentage.
const ARCHETYPES: Record<Archetype, { label: string; hp: number; atk: number; def: number; eva: number; crit: number }> = {
  tank: { label: "🛡️ ถึก", hp: 1.2, atk: 0.9, def: 1.5, eva: 4, crit: 6 },
  striker: { label: "⚔️ สายตี", hp: 1.0, atk: 1.25, def: 0.8, eva: 6, crit: 12 },
  agile: { label: "💨 ว่องไว", hp: 0.85, atk: 1.05, def: 0.8, eva: 16, crit: 14 },
  crit: { label: "🎯 สายคริ", hp: 0.9, atk: 1.1, def: 0.9, eva: 10, crit: 20 },
  balanced: { label: "⚖️ สมดุล", hp: 1.05, atk: 1.0, def: 1.0, eva: 8, crit: 10 },
};

const TYPE_ARCHETYPE: Record<string, Archetype> = {
  Rock: "tank", Ground: "tank", Steel: "tank",
  Fire: "striker", Fighting: "striker", Dragon: "striker",
  Electric: "agile", Flying: "agile", Bug: "agile",
  Psychic: "crit", Ghost: "crit", Dark: "crit",
};

// Rarity scales hp/atk/def and adds flat percentage points to eva/crit.
const RARITY: Record<string, { scale: number; bonus: number }> = {
  COMMON: { scale: 1.0, bonus: 0 },
  RARE: { scale: 1.15, bonus: 1 },
  EPIC: { scale: 1.3, bonus: 2 },
  LEGENDARY: { scale: 1.45, bonus: 3 },
};

// Upper ends of each stat across all archetype/rarity combos, for drawing bars.
export const STAT_MAX: Stats = { hp: 175, atk: 36, def: 22, eva: 20, crit: 25 };

export function archetypeOf(typePrimary: string): Archetype {
  return TYPE_ARCHETYPE[typePrimary] ?? "balanced";
}

export function archetypeLabel(typePrimary: string) {
  return ARCHETYPES[archetypeOf(typePrimary)].label;
}

// Arena levels: each level above 1 adds LEVEL_STEP to HP/ATK/DEF, so a max-level
// COMMON (+27%) stays just below an EPIC (+30%) and evolving is still worth it.
export const LEVEL_MAX = 10;
export const LEVEL_STEP = 0.03;

export function levelScale(level = 1) {
  return 1 + LEVEL_STEP * (Math.min(LEVEL_MAX, Math.max(1, level)) - 1);
}

// XP needed to go from `level` to the next one.
export function xpToNext(level: number) {
  return level >= LEVEL_MAX ? 0 : 50 * level;
}

// Adds XP (xp is progress inside the current level) and rolls over levels.
export function addXp(level: number, xp: number, gained: number) {
  let nextLevel = level;
  let progress = xp + gained;
  while (nextLevel < LEVEL_MAX && progress >= xpToNext(nextLevel)) {
    progress -= xpToNext(nextLevel);
    nextLevel += 1;
  }
  if (nextLevel >= LEVEL_MAX) progress = 0;
  return { level: nextLevel, xp: progress, levelsGained: nextLevel - level };
}

export function computeStats(character: { rarity: string; type_primary: string; level?: number | null }): Stats {
  const archetype = ARCHETYPES[archetypeOf(character.type_primary)];
  const rarity = RARITY[character.rarity] ?? RARITY.COMMON;
  const scale = rarity.scale * levelScale(character.level ?? 1);
  return {
    hp: Math.round(BASE.hp * archetype.hp * scale),
    atk: Math.round(BASE.atk * archetype.atk * scale),
    def: Math.round(BASE.def * archetype.def * scale),
    eva: archetype.eva + rarity.bonus,
    crit: archetype.crit + rarity.bonus,
  };
}

// Official type chart (attacker → defenders), softened for kids. Each matchup is a
// step: super effective +1, resisted −1, immune −2 (treated as a strong resist, never 0).
// Steps from both defender types are summed before converting, so cancellations match
// the official game (e.g. Ice vs Fire/Flying stays neutral).
const STEP_MULTIPLIER: Record<number, number> = { 2: 2, 1: 1.5, 0: 1, [-1]: 0.7, [-2]: 0.5 };
const CHART: Record<string, { super: string[]; resist: string[]; immune: string[] }> = {
  Normal: { super: [], resist: ["Rock", "Steel"], immune: ["Ghost"] },
  Fire: { super: ["Grass", "Ice", "Bug", "Steel"], resist: ["Fire", "Water", "Rock", "Dragon"], immune: [] },
  Water: { super: ["Fire", "Ground", "Rock"], resist: ["Water", "Grass", "Dragon"], immune: [] },
  Electric: { super: ["Water", "Flying"], resist: ["Electric", "Grass", "Dragon"], immune: ["Ground"] },
  Grass: { super: ["Water", "Ground", "Rock"], resist: ["Fire", "Grass", "Poison", "Flying", "Bug", "Dragon", "Steel"], immune: [] },
  Ice: { super: ["Grass", "Ground", "Flying", "Dragon"], resist: ["Fire", "Water", "Ice", "Steel"], immune: [] },
  Fighting: { super: ["Normal", "Ice", "Rock", "Dark", "Steel"], resist: ["Poison", "Flying", "Psychic", "Bug", "Fairy"], immune: ["Ghost"] },
  Poison: { super: ["Grass", "Fairy"], resist: ["Poison", "Ground", "Rock", "Ghost"], immune: ["Steel"] },
  Ground: { super: ["Fire", "Electric", "Poison", "Rock", "Steel"], resist: ["Grass", "Bug"], immune: ["Flying"] },
  Flying: { super: ["Grass", "Fighting", "Bug"], resist: ["Electric", "Rock", "Steel"], immune: [] },
  Psychic: { super: ["Fighting", "Poison"], resist: ["Psychic", "Steel"], immune: ["Dark"] },
  Bug: { super: ["Grass", "Psychic", "Dark"], resist: ["Fire", "Fighting", "Poison", "Flying", "Ghost", "Steel", "Fairy"], immune: [] },
  Rock: { super: ["Fire", "Ice", "Flying", "Bug"], resist: ["Fighting", "Ground", "Steel"], immune: [] },
  Ghost: { super: ["Psychic", "Ghost"], resist: ["Dark"], immune: ["Normal"] },
  Dragon: { super: ["Dragon"], resist: ["Steel"], immune: ["Fairy"] },
  Dark: { super: ["Psychic", "Ghost"], resist: ["Fighting", "Dark", "Fairy"], immune: [] },
  Steel: { super: ["Ice", "Rock", "Fairy"], resist: ["Fire", "Water", "Electric", "Steel"], immune: [] },
  Fairy: { super: ["Fighting", "Dragon", "Dark"], resist: ["Fire", "Poison", "Steel"], immune: [] },
};

export const ALL_TYPES = Object.keys(CHART);
export const MULTIPLIER_MAX = 2;
export const MULTIPLIER_MIN = 0.5;

function step(attack: string, defend: string) {
  const row = CHART[attack];
  if (!row) return 0;
  if (row.super.includes(defend)) return 1;
  if (row.immune.includes(defend)) return -2;
  if (row.resist.includes(defend)) return -1;
  return 0;
}

// Multiplier for an attack of `attackType` hitting a defender with one or two types.
export function typeMultiplier(attackType: string, defender: { type_primary: string; type_secondary?: string | null }) {
  let steps = step(attackType, defender.type_primary);
  if (defender.type_secondary) steps += step(attackType, defender.type_secondary);
  return STEP_MULTIPLIER[Math.max(-2, Math.min(2, steps))];
}

type Typed = { type_primary: string; type_secondary?: string | null };

// Types this monster's primary-type attacks are strong against (single-type defenders).
export function strongAgainst(monster: Typed) {
  return ALL_TYPES.filter((type) => step(monster.type_primary, type) > 0);
}

// Attack types that hit this monster harder than normal, counting both of its types.
export function weakTo(monster: Typed) {
  return ALL_TYPES.filter((type) => typeMultiplier(type, monster) > 1);
}

export const CRIT_MULTIPLIER = 1.5;
export const MIN_DAMAGE = 5;

// (ATK × 2 − DEF) × type × random 0.9–1.1 × crit, at least MIN_DAMAGE.
// `roll` is a 0–1 random number so callers control randomness (and tests stay deterministic).
export function baseDamage(attackerAtk: number, defenderDef: number, multiplier: number, roll: number, crit: boolean) {
  const spread = 0.9 + roll * 0.2;
  const raw = (attackerAtk * 2 - defenderDef) * multiplier * spread * (crit ? CRIT_MULTIPLIER : 1);
  return Math.max(MIN_DAMAGE, Math.round(raw));
}
