import { describe, expect, it } from "vitest";
import { activeFighter, aiSwitchTarget, aiTurn, applyAction, ArenaError, carryOver, chooseAiAction, makeTeam, mvp, parentLevelFor, startBattle, startNextStage, TOURNAMENT_HEAL, ULT_MAX, type BattleState, type Rng } from "../shared/arena";

const mon = (id: string, type_primary: string, rarity = "COMMON", type_secondary: string | null = null) =>
  ({ id, name: id, image_url: "", rarity, type_primary, type_secondary });

// Returns scripted rolls in order, then 0.5 forever.
function script(...rolls: number[]): Rng {
  return () => (rolls.length ? rolls.shift()! : 0.5);
}
// Never evades, never crits, middle damage spread.
const steady: Rng = () => 0.99;

function battle(child = [mon("Charmander", "Fire")], parent = [mon("Bulbasaur", "Grass")]) {
  return startBattle(makeTeam(child), makeTeam(parent));
}

describe("arena engine", () => {
  it("alternates turns, starting with the child", () => {
    let state = battle();
    expect(state.turn).toBe("CHILD");
    expect(() => applyAction(state, "PARENT", "ATTACK", steady)).toThrow(ArenaError);
    state = applyAction(state, "CHILD", "ATTACK", steady);
    expect(state.turn).toBe("PARENT");
    state = applyAction(state, "PARENT", "ATTACK", steady);
    expect(state).toMatchObject({ turn: "CHILD", round: 2 });
  });

  it("applies type advantage, crits, and evasion", () => {
    // Charmander (ATK 25) vs Bulbasaur (Grass, DEF 10): (50-10) x 1.5 = 60 at a 0.5 spread roll.
    const state = applyAction(battle([mon("Charmander", "Fire")], [mon("Bulbasaur", "Grass", "COMMON", "Poison")]), "CHILD", "ATTACK", script(0.99, 0.99, 0.5));
    const bulbasaur = activeFighter(state, "PARENT");
    expect(bulbasaur.stats.hp - bulbasaur.hp).toBe(60);
    expect(state.log.at(-1)).toContain("ได้เปรียบธาตุ ×1.5");

    const critical = applyAction(battle(), "CHILD", "ATTACK", script(0.99, 0, 0.5));
    expect(critical.log.at(-1)).toContain("คริติคอล");

    const dodged = applyAction(battle(), "CHILD", "ATTACK", script(0));
    expect(dodged.log.at(-1)).toContain("หลบได้");
    expect(activeFighter(dodged, "PARENT").hp).toBe(activeFighter(dodged, "PARENT").stats.hp);
  });

  it("charges energy, spends it on a sure-hit special, and applies its status", () => {
    let state = battle();
    expect(() => applyAction(state, "CHILD", "SPECIAL", steady)).toThrow("พลังไม่พอ");
    // Child: +1 per turn, +1 extra for guarding, +1 when hit.
    state = applyAction(state, "CHILD", "GUARD", steady); // energy 2
    state = applyAction(state, "PARENT", "ATTACK", steady); // child hit → 3
    expect(state.teams.CHILD.energy).toBe(3);
    // Specials skip the evade roll: the rolls are crit (none) then damage spread.
    state = applyAction(state, "CHILD", "SPECIAL", script(0.99, 0.5));
    expect(state.teams.CHILD.energy).toBe(1);
    expect(activeFighter(state, "PARENT").statuses).toEqual([{ kind: "BURN", turns: 2 }]);
    expect(state.log.join("\n")).toContain("เปลวเพลิง");
  });

  it("guard halves the next hit", () => {
    const hurt = (s: BattleState) => activeFighter(s, "CHILD").stats.hp - activeFighter(s, "CHILD").hp;
    let open = applyAction(battle(), "CHILD", "ATTACK", steady);
    open = applyAction(open, "PARENT", "ATTACK", steady);
    let guarded = applyAction(battle(), "CHILD", "GUARD", steady);
    guarded = applyAction(guarded, "PARENT", "ATTACK", steady);
    expect(hurt(guarded)).toBe(Math.round(hurt(open) / 2));
  });

  it("burn ticks at the end of the burned monster's turn and then expires", () => {
    // Onix resists fire, so it survives the special and the burn ticks that follow.
    let state = battle([mon("Charmander", "Fire")], [mon("Onix", "Rock")]);
    state.teams.CHILD.energy = 3;
    state = applyAction(state, "CHILD", "SPECIAL", steady);
    const afterHit = activeFighter(state, "PARENT").hp;
    state = applyAction(state, "PARENT", "GUARD", steady);
    const onix = activeFighter(state, "PARENT");
    expect(afterHit - onix.hp).toBe(Math.round(onix.stats.hp * 0.08));
    expect(onix.statuses).toEqual([{ kind: "BURN", turns: 1 }]);
    state = applyAction(state, "CHILD", "GUARD", steady);
    state = applyAction(state, "PARENT", "GUARD", steady);
    expect(activeFighter(state, "PARENT").statuses).toEqual([]);
  });

  it("sends in the next monster, gives the last one a boost, and declares a winner", () => {
    let state = battle([mon("Charizard", "Fire", "LEGENDARY")], [mon("A", "Grass"), mon("B", "Grass")]);
    state.teams.PARENT.fighters[0].hp = 1;
    state = applyAction(state, "CHILD", "ATTACK", steady);
    expect(state.teams.PARENT.active).toBe(1);
    expect(state.log.join("\n")).toContain("ฮึดสู้");
    state.teams.PARENT.fighters[1].hp = 1;
    state = applyAction(state, "PARENT", "GUARD", steady);
    state = applyAction(state, "CHILD", "ATTACK", steady);
    expect(state.winner).toBe("CHILD");
    expect(mvp(state)?.name).toBe("Charizard");
    expect(() => applyAction(state, "PARENT", "ATTACK", steady)).toThrow("จบแล้ว");
  });

  it("gives small teams extra HP", () => {
    const solo = makeTeam([mon("Squirtle", "Water")]);
    const trio = makeTeam([mon("Squirtle", "Water"), mon("B", "Water"), mon("C", "Water")]);
    expect(solo.fighters[0].stats.hp).toBe(Math.round(trio.fighters[0].stats.hp * 1.2));
  });

  it("does not mutate the previous state", () => {
    const state = battle();
    applyAction(state, "CHILD", "ATTACK", steady);
    expect(state.turn).toBe("CHILD");
    expect(state.log).toHaveLength(1);
  });

  it("finishes a full AI-vs-AI battle in a reasonable number of turns", () => {
    const team = () => [mon("Charmander", "Fire"), mon("Squirtle", "Water"), mon("Pikachu", "Electric", "RARE")];
    let state = startBattle(makeTeam(team()), makeTeam(team()));
    let turns = 0;
    let seed = 42;
    const rng: Rng = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
    while (!state.winner && turns < 200) {
      state = applyAction(state, state.turn, chooseAiAction(state, state.turn, rng), rng);
      turns += 1;
    }
    expect(state.winner).not.toBeNull();
    expect(turns).toBeGreaterThan(8);
    expect(turns).toBeLessThan(60);
  });
});

describe("parent level scaling", () => {
  it("uses the child team's average level, rounded down", () => {
    expect(parentLevelFor([])).toBe(1);
    expect(parentLevelFor([1])).toBe(1);
    expect(parentLevelFor([3, 4, 4])).toBe(3);
    expect(parentLevelFor([10, 10, 9])).toBe(9);
  });
});

describe("battle events", () => {
  it("records each beat with increasing sequence numbers", () => {
    let state = battle([mon("Charmander", "Fire")], [mon("Bulbasaur", "Grass")]);
    state = applyAction(state, "CHILD", "ATTACK", script(0.99, 0, 0.5));
    const [attack, hitEvent] = state.events!;
    expect(attack).toMatchObject({ seq: 1, kind: "attack", side: "CHILD", index: 0, type: "Fire" });
    const bulbasaur = activeFighter(state, "PARENT");
    expect(hitEvent).toMatchObject({ seq: 2, kind: "hit", side: "PARENT", crit: true, multiplier: 1.5, hp: bulbasaur.hp, max: bulbasaur.stats.hp });

    state = applyAction(state, "PARENT", "ATTACK", script(0));
    expect(state.events!.slice(-2).map((e) => e.kind)).toEqual(["attack", "miss"]);
    expect(state.eventSeq).toBe(4);
  });

  it("emits special, status, faint, switch, and win", () => {
    let state = battle([mon("Charizard", "Fire", "LEGENDARY")], [mon("A", "Grass"), mon("B", "Grass")]);
    state.teams.CHILD.energy = 3;
    state.teams.PARENT.fighters[0].hp = 1;
    state = applyAction(state, "CHILD", "SPECIAL", steady);
    expect(state.events!.map((e) => e.kind)).toEqual(["special", "hit", "faint", "switch"]);
    expect(state.events![0]).toMatchObject({ move: "เปลวเพลิง" });
    expect(state.events![3]).toMatchObject({ side: "PARENT", index: 1 });

    state = applyAction(state, "PARENT", "GUARD", steady);
    expect(state.events!.at(-1)).toMatchObject({ kind: "guard", side: "PARENT" });
    state.teams.PARENT.fighters[1].hp = 1;
    state = applyAction(state, "CHILD", "ATTACK", steady);
    expect(state.events!.slice(-2).map((e) => e.kind)).toEqual(["faint", "win"]);
  });

  it("keeps only the latest events", () => {
    let state = battle([mon("Onix", "Rock")], [mon("Onix2", "Rock")]);
    delete state.weatherUntil; // keep the field fixed so only guard events count
    for (let i = 0; i < 50; i++) state = applyAction(state, state.turn, "GUARD", steady);
    expect(state.events!.length).toBe(40);
    expect(state.eventSeq).toBe(50);
    expect(state.events![0].seq).toBe(11);
  });
});

describe("ultimate", () => {
  it("fills the gauge from hits, taking hits, and guarding", () => {
    let state = battle([mon("Onix", "Rock")], [mon("Onix2", "Rock")]);
    state = applyAction(state, "CHILD", "ATTACK", steady);
    expect(state.teams.CHILD.ult).toBe(15);
    expect(state.teams.PARENT.ult).toBe(10);
    state = applyAction(state, "PARENT", "GUARD", steady);
    expect(state.teams.PARENT.ult).toBe(20);
  });

  it("needs a full gauge, hits for x2.2 with the special's effect, and resets", () => {
    const base = battle([mon("Charmander", "Fire")], [mon("Onix", "Rock")]);
    expect(() => applyAction(base, "CHILD", "ULTIMATE", steady)).toThrow("หลอดไม้ตาย");

    const special = structuredClone(base);
    special.teams.CHILD.energy = 3;
    const afterSpecial = applyAction(special, "CHILD", "SPECIAL", steady);
    const ult = structuredClone(base);
    ult.teams.CHILD.ult = 100;
    const afterUlt = applyAction(ult, "CHILD", "ULTIMATE", steady);

    const dealt = (s: BattleState) => activeFighter(s, "PARENT").stats.hp - activeFighter(s, "PARENT").hp;
    // Same base damage, x2.2 instead of x1.6 (burn tick happens later, on the parent's turn).
    expect(dealt(afterUlt) / dealt(afterSpecial)).toBeCloseTo(2.2 / 1.6, 1);
    expect(afterUlt.teams.CHILD.ult).toBe(0);
    expect(afterUlt.teams.CHILD.energy).toBe(1); // no energy spent, +1 end of turn
    expect(activeFighter(afterUlt, "PARENT").statuses).toEqual([{ kind: "BURN", turns: 2 }]);
    expect(afterUlt.events!.find((e) => e.kind === "ultimate")).toMatchObject({ move: "นรกเพลิง", type: "Fire" });
  });

  it("is halved by guard and used by the AI when ready", () => {
    let state = battle([mon("Charmander", "Fire")], [mon("Onix", "Rock")]);
    state.teams.PARENT.ult = 100;
    expect(chooseAiAction(state, "PARENT", steady)).toBe("ULTIMATE");
    state = applyAction(state, "CHILD", "GUARD", steady);
    state = applyAction(state, "PARENT", "ULTIMATE", steady);
    expect(state.log.join("\n")).toContain("ลดครึ่ง");
  });
});

describe("field, combos, switching, items", () => {
  const dealt = (s: BattleState) => activeFighter(s, "PARENT").stats.hp - activeFighter(s, "PARENT").hp;

  it("boosts and weakens by field and changes the field every 4 rounds", () => {
    const hitIn = (weather: "CLEAR" | "SUN" | "RAIN") =>
      dealt(applyAction(startBattle(makeTeam([mon("Charmander", "Fire")]), makeTeam([mon("Onix", "Normal")]), weather), "CHILD", "ATTACK", steady));
    expect(hitIn("SUN") / hitIn("CLEAR")).toBeCloseTo(1.2, 1);
    expect(hitIn("RAIN") / hitIn("CLEAR")).toBeCloseTo(0.8, 1);

    let state = startBattle(makeTeam([mon("A", "Rock")]), makeTeam([mon("B", "Rock")]), "SUN");
    for (let i = 0; i < 8; i++) state = applyAction(state, state.turn, "GUARD", () => 0.5);
    expect(state.round).toBe(5);
    expect(state.weather).not.toBe("SUN");
    expect(state.weatherUntil).toBe(9);
    expect(state.events!.at(-1)).toMatchObject({ kind: "weather", weather: state.weather });
  });

  it("marks with water, then shocks with electric for a combo", () => {
    let state = battle([mon("Squirtle", "Water"), mon("Pikachu", "Electric")], [mon("Onix", "Normal")]);
    state = applyAction(state, "CHILD", "ATTACK", steady);
    expect(activeFighter(state, "PARENT").statuses.map((s) => s.kind)).toContain("WET");
    state = applyAction(state, "PARENT", "GUARD", steady); // WET ticks down to 1
    state = applyAction(state, "CHILD", "SWITCH", steady, 1);
    expect(activeFighter(state, "CHILD").name).toBe("Pikachu");
    expect(state.events!.slice(-2).map((e) => e.kind)).toEqual(["recall", "switch"]);
    state = applyAction(state, "PARENT", "ATTACK", steady);
    // WET expired at the end of the parent's second turn, so re-apply it to test the shock.
    state.teams.PARENT.fighters[0].statuses = [{ kind: "WET", turns: 2 }];
    state = applyAction(state, "CHILD", "ATTACK", steady);
    expect(state.events!.some((e) => e.kind === "combo" && e.combo?.includes("ช็อตไฟฟ้า"))).toBe(true);
    expect(activeFighter(state, "PARENT").statuses.map((s) => s.kind)).not.toContain("WET");
  });

  it("shatters a frozen target for a guaranteed crit", () => {
    const state = battle([mon("Onix", "Rock")], [mon("Mew", "Normal")]);
    state.teams.PARENT.fighters[0].statuses = [{ kind: "FREEZE", turns: 2 }];
    const after = applyAction(state, "CHILD", "ATTACK", steady);
    expect(after.events!.find((e) => e.kind === "hit")).toMatchObject({ crit: true });
    expect(after.log.at(-1)).toContain("แตกกระจาย");
  });

  it("rejects bad switches and lets a paralyzed monster switch out", () => {
    const state = battle([mon("A", "Water"), mon("B", "Fire")], [mon("C", "Rock")]);
    expect(() => applyAction(state, "CHILD", "SWITCH", steady, 0)).toThrow("ตัวสำรอง");
    expect(() => applyAction(state, "CHILD", "SWITCH", steady, 5)).toThrow("ตัวสำรอง");
    state.teams.CHILD.fighters[0].statuses = [{ kind: "PARALYZE", turns: 2 }];
    expect(applyAction(state, "CHILD", "SWITCH", () => 0, 1).teams.CHILD.active).toBe(1);
  });

  it("uses a carried item once", () => {
    const state = battle([mon("Squirtle", "Water")], [mon("Onix", "Rock")]);
    expect(() => applyAction(state, "CHILD", "ITEM", steady)).toThrow("ไม่มีไอเทม");
    state.teams.CHILD.item = { kind: "POTION", used: false };
    state.teams.CHILD.fighters[0].hp = 10;
    const after = applyAction(state, "CHILD", "ITEM", steady);
    const squirtle = activeFighter(after, "CHILD");
    expect(squirtle.hp).toBe(10 + Math.round(squirtle.stats.hp * 0.3));
    expect(after.teams.CHILD.item).toEqual({ kind: "POTION", used: true });
    const back = applyAction(after, "PARENT", "GUARD", steady);
    expect(() => applyAction(back, "CHILD", "ITEM", steady)).toThrow("ไม่มีไอเทม");
  });

  it("has the AI switch away from a bad matchup", () => {
    const state = battle([mon("Squirtle", "Water")], [mon("Charmander", "Fire"), mon("Bulbasaur", "Grass")]);
    state.turn = "PARENT";
    expect(aiSwitchTarget(state, "PARENT")).toBe(1);
    const after = aiTurn(state, "PARENT", () => 0.1);
    expect(after.teams.PARENT.active).toBe(1);
  });
});

describe("arena themes and field events", () => {
  const themed = (theme: Parameters<typeof startBattle>[3], child = [mon("Squirtle", "Water")], parent = [mon("Onix", "Rock")]) =>
    startBattle(makeTeam(child), makeTeam(parent), "CLEAR", theme);
  // Rolls: never trigger random field events (0.99 ≥ chance) unless asked.
  const guardRound = (s: BattleState) => applyAction(applyAction(s, "CHILD", "GUARD", steady), "PARENT", "GUARD", steady);

  it("erupts lava every 3 rounds on non-fire monsters", () => {
    let state = themed("VOLCANO", [mon("Charmander", "Fire")], [mon("Onix", "Rock")]);
    state = guardRound(guardRound(state)); // start of round 3
    expect(state.round).toBe(3);
    const onix = activeFighter(state, "PARENT");
    expect(onix.stats.hp - onix.hp).toBe(Math.round(onix.stats.hp * 0.05));
    expect(activeFighter(state, "CHILD").hp).toBe(activeFighter(state, "CHILD").stats.hp);
    expect(state.events!.some((e) => e.kind === "field" && e.fieldEvent === "LAVA")).toBe(true);
  });

  it("heals water monsters on the beach", () => {
    let state = themed("BEACH");
    state.teams.CHILD.fighters[0].hp = 50;
    state = applyAction(state, "CHILD", "GUARD", steady);
    const squirtle = activeFighter(state, "CHILD");
    expect(squirtle.hp).toBe(50 + Math.round(squirtle.stats.hp * 0.03));
  });

  it("makes specials cheaper in space and keeps the weather clear", () => {
    let state = themed("SPACE");
    expect(state.weather).toBe("CLEAR");
    expect(state.weatherUntil).toBeUndefined();
    state.teams.CHILD.energy = 2;
    expect(() => applyAction(state, "CHILD", "SPECIAL", steady)).not.toThrow();
  });

  it("cheers in the stadium on a super-effective hit", () => {
    const state = themed("STADIUM", [mon("Squirtle", "Water")], [mon("Charmander", "Fire")]);
    const after = applyAction(state, "CHILD", "ATTACK", steady);
    expect(after.teams.CHILD.ult).toBe(15 + 10);
    expect(after.events!.some((e) => e.fieldEvent === "CHEER")).toBe(true);
  });

  it("can freeze on hit at the snow peak", () => {
    const state = themed("SNOWPEAK", [mon("Onix", "Rock")], [mon("Mew", "Normal")]);
    // Rolls: evade no, crit no, spread, then the 10% freeze roll.
    const after = applyAction(state, "CHILD", "ATTACK", script(0.99, 0.99, 0.5, 0.05));
    expect(activeFighter(after, "PARENT").statuses.map((s) => s.kind)).toContain("FREEZE");
  });

  it("rolls at most two random field events, from round 3", () => {
    let state = themed(undefined, [mon("Onix", "Rock")], [mon("Onix2", "Rock")]);
    delete state.weatherUntil;
    for (let i = 0; i < 30; i++) state = applyAction(state, state.turn, "GUARD", () => 0.01);
    const events = state.events!.filter((e) => e.kind === "field");
    expect(state.fieldEvents).toBe(2);
    expect(events).toHaveLength(2);
    expect(state.events!.find((e) => e.kind === "field")!.seq).toBeGreaterThan(0);
  });

  it("gives the gift to the side that's behind", () => {
    let state = themed(undefined, [mon("A", "Rock")], [mon("B", "Rock")]);
    delete state.weatherUntil;
    state = guardRound(state);
    state.teams.CHILD.fighters[0].hp = 10;
    // Round 2 → 3: event chance roll 0.1 (< 0.2), kind roll 0.9 → GIFT.
    state = applyAction(state, "CHILD", "GUARD", steady);
    state = applyAction(state, "PARENT", "GUARD", script(0.1, 0.9));
    expect(state.events!.find((e) => e.fieldEvent === "GIFT")).toMatchObject({ side: "CHILD" });
  });
});

describe("tallies and tournaments", () => {
  it("counts crits, super-effective hits, and the finishing move", () => {
    let state = battle([mon("Charmander", "Fire")], [mon("Bulbasaur", "Grass")]);
    state = applyAction(state, "CHILD", "ATTACK", script(0.99, 0, 0.5));
    expect(state.tally?.CHILD).toMatchObject({ crits: 1, supers: 1, ults: 0 });
    expect(state.tally?.PARENT.crits).toBe(0);

    state.teams.PARENT.fighters[0].hp = 1;
    state.turn = "CHILD";
    state.teams.CHILD.ult = ULT_MAX;
    state = applyAction(state, "CHILD", "ULTIMATE", steady);
    expect(state.winner).toBe("CHILD");
    expect(state.finisher).toBe("ULTIMATE");
    expect(state.tally?.CHILD.ults).toBe(1);
  });

  it("loads battles saved before tallies existed", () => {
    const state = battle();
    delete state.tally;
    expect(applyAction(state, "CHILD", "ATTACK", steady).tally).toBeUndefined();
  });

  it("carries the child team into the next round, healed and revived", () => {
    const state = battle([mon("Charmander", "Fire"), mon("Squirtle", "Water")]);
    const [first, second] = state.teams.CHILD.fighters;
    first.hp = 0;
    second.hp = Math.round(second.stats.hp * 0.2);
    second.statuses = [{ kind: "BURN", turns: 2 }];
    state.teams.CHILD.active = 1;
    state.teams.CHILD.energy = 4;
    state.teams.CHILD.ult = 70;
    state.teams.CHILD.item = { kind: "POTION", used: true };
    state.tally!.CHILD.combos = 2;
    state.winner = "CHILD";

    const team = carryOver(state.teams.CHILD);
    expect(team.fighters[0].hp).toBe(Math.round(first.stats.hp * TOURNAMENT_HEAL));
    expect(team.fighters[1].hp).toBe(Math.min(second.stats.hp, second.hp + Math.round(second.stats.hp * TOURNAMENT_HEAL)));
    expect(team.fighters[1].statuses).toEqual([]);
    expect(team).toMatchObject({ active: 0, energy: 0, ult: 70, item: { kind: "POTION", used: true } });

    const next = startNextStage(state, makeTeam([mon("Geodude", "Rock")]));
    expect(next).toMatchObject({ winner: null, round: 1, turn: "CHILD" });
    expect(next.tally?.CHILD.combos).toBe(2);
    expect(next.teams.PARENT.fighters[0].name).toBe("Geodude");
    // The previous round's state is untouched.
    expect(state.teams.CHILD.fighters[0].hp).toBe(0);
  });
});
