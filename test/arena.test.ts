import { describe, expect, it } from "vitest";
import { activeFighter, applyAction, ArenaError, chooseAiAction, makeTeam, mvp, parentLevelFor, startBattle, type BattleState, type Rng } from "../shared/arena";

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
    for (let i = 0; i < 50; i++) state = applyAction(state, state.turn, "GUARD", steady);
    expect(state.events!.length).toBe(40);
    expect(state.eventSeq).toBe(50);
    expect(state.events![0].seq).toBe(11);
  });
});
