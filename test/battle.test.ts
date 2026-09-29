import { describe, expect, it } from "vitest";
import { baseDamage, computeStats, STAT_MAX, strongAgainst, typeMultiplier, weakTo } from "../shared/battle";

describe("battle stats", () => {
  it("matches the design examples", () => {
    expect(computeStats({ rarity: "COMMON", type_primary: "Fire" })).toEqual({ hp: 80, atk: 25, def: 8, eva: 6, crit: 12 });
    expect(computeStats({ rarity: "EPIC", type_primary: "Fire" })).toEqual({ hp: 104, atk: 33, def: 10, eva: 8, crit: 14 });
    expect(computeStats({ rarity: "COMMON", type_primary: "Rock" })).toEqual({ hp: 96, atk: 18, def: 15, eva: 4, crit: 6 });
    expect(computeStats({ rarity: "RARE", type_primary: "Electric" })).toEqual({ hp: 78, atk: 24, def: 9, eva: 17, crit: 15 });
    expect(computeStats({ rarity: "LEGENDARY", type_primary: "Psychic" })).toEqual({ hp: 104, atk: 32, def: 13, eva: 13, crit: 23 });
  });

  it("keeps every combo within the bar maximums", () => {
    for (const rarity of ["COMMON", "RARE", "EPIC", "LEGENDARY"]) {
      for (const type of ["Rock", "Fire", "Electric", "Psychic", "Water"]) {
        const stats = computeStats({ rarity, type_primary: type });
        for (const key of Object.keys(stats) as (keyof typeof stats)[]) {
          expect(stats[key]).toBeLessThanOrEqual(STAT_MAX[key]);
        }
      }
    }
  });

  it("takes 2 to 7 plain hits to knock out a same-rarity monster", () => {
    const types = ["Rock", "Fire", "Electric", "Psychic", "Water"];
    for (const rarity of ["COMMON", "RARE", "EPIC", "LEGENDARY"]) {
      for (const a of types) {
        for (const d of types) {
          const attacker = computeStats({ rarity, type_primary: a });
          const defender = computeStats({ rarity, type_primary: d });
          const hits = Math.ceil(defender.hp / baseDamage(attacker.atk, defender.def, 1, 0.5, false));
          expect(hits).toBeGreaterThanOrEqual(2);
          expect(hits).toBeLessThanOrEqual(7);
        }
      }
    }
  });
});

describe("type matchups", () => {
  it("softens the official chart", () => {
    expect(typeMultiplier("Fire", { type_primary: "Grass" })).toBe(1.5);
    expect(typeMultiplier("Water", { type_primary: "Fire" })).toBe(1.5);
    expect(typeMultiplier("Fire", { type_primary: "Water" })).toBe(0.7);
    expect(typeMultiplier("Electric", { type_primary: "Ground" })).toBe(0.5);
    expect(typeMultiplier("Normal", { type_primary: "Water" })).toBe(1);
  });

  it("combines dual types and clamps to 0.5–2", () => {
    // Rock vs Fire/Flying is ×4 officially → capped at ×2.
    expect(typeMultiplier("Rock", { type_primary: "Fire", type_secondary: "Flying" })).toBe(2);
    expect(typeMultiplier("Grass", { type_primary: "Fire", type_secondary: "Flying" })).toBe(0.5);
    expect(typeMultiplier("Ice", { type_primary: "Grass", type_secondary: "Poison" })).toBe(1.5);
    // ×2 and ×0.5 cancel out like the official chart.
    expect(typeMultiplier("Ice", { type_primary: "Fire", type_secondary: "Flying" })).toBe(1);
    // An immunity plus a weakness nets to resisted, never zero.
    expect(typeMultiplier("Ground", { type_primary: "Electric", type_secondary: "Flying" })).toBe(0.7);
  });

  it("lists strengths and weaknesses", () => {
    expect(strongAgainst({ type_primary: "Fire" })).toEqual(["Grass", "Ice", "Bug", "Steel"]);
    expect(weakTo({ type_primary: "Fire", type_secondary: "Flying" })).toEqual(["Water", "Electric", "Rock"]);
  });

  it("applies crit and a minimum", () => {
    expect(baseDamage(25, 15, 1, 0.5, false)).toBe(35);
    expect(baseDamage(25, 15, 1, 0.5, true)).toBe(53);
    expect(baseDamage(5, 30, 0.5, 0, false)).toBe(5);
  });
});
