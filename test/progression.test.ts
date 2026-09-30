import { describe, expect, it } from "vitest";
import { emptyTally } from "../shared/arena";
import {
  ACHIEVEMENT_CODES, applyRp, ARENA_QUEST_CODES, DAILY_ARENA_QUESTS, dailyQuests, questProgress, rankFor, RANKS, rpDelta, unlockedBy,
  type Career, type Game,
} from "../shared/progression";

const game = (over: Partial<Game> = {}): Game => ({
  won: true, mode: "DUEL", difficulty: "NORMAL", teamSize: 3, alive: 2, lastHpShare: 1, finisher: "ATTACK", tally: emptyTally(), ...over,
});
const career = (over: Partial<Career> = {}): Career => ({ wins: 1, streak: 1, themesWon: [], maxLevel: 1, ...over });

describe("arena rank", () => {
  it("maps rank points to tiers", () => {
    expect(rankFor(0)).toMatchObject({ key: "BRONZE", next: { key: "SILVER", min: 100 } });
    expect(rankFor(99).key).toBe("BRONZE");
    expect(rankFor(100).key).toBe("SILVER");
    expect(rankFor(5000)).toMatchObject({ key: "MASTER", next: null });
    expect(RANKS.map((rank) => rank.min)).toEqual([...RANKS.map((rank) => rank.min)].sort((a, b) => a - b));
  });

  it("never drops a child out of a tier they reached", () => {
    expect(applyRp(105, -8)).toBe(100);
    expect(applyRp(130, -8)).toBe(122);
    expect(applyRp(3, -8)).toBe(0);
    expect(applyRp(95, 25)).toBe(120);
  });

  it("scores duels by difficulty and tournaments by rounds cleared", () => {
    expect(rpDelta({ mode: "DUEL", difficulty: "EASY", won: true, stagesCleared: 0 })).toBe(15);
    expect(rpDelta({ mode: "DUEL", difficulty: "HARD", won: true, stagesCleared: 0 })).toBe(35);
    expect(rpDelta({ mode: "DUEL", difficulty: "HARD", won: false, stagesCleared: 0 })).toBe(-8);
    expect(rpDelta({ mode: "TOURNAMENT", difficulty: "HARD", won: true, stagesCleared: 3 })).toBe(75);
    expect(rpDelta({ mode: "TOURNAMENT", difficulty: "NORMAL", won: false, stagesCleared: 1 })).toBe(7);
  });
});

describe("arena achievements", () => {
  it("unlocks from the finished game and the child's record", () => {
    expect(unlockedBy(game(), career())).toEqual(["FIRST_WIN"]);
    expect(unlockedBy(game({ won: false }), career({ wins: 0, streak: 0 }))).toEqual([]);
    expect(unlockedBy(game({ alive: 3, finisher: "ULTIMATE", difficulty: "HARD" }), career({ wins: 10, streak: 3 })))
      .toEqual(expect.arrayContaining(["WINS_10", "STREAK_3", "HARD_WIN", "FLAWLESS", "ULT_FINISH"]));
    expect(unlockedBy(game({ alive: 1, lastHpShare: 0.2 }), career())).toContain("COMEBACK");
    expect(unlockedBy(game({ teamSize: 1, alive: 1, lastHpShare: 0.2 }), career())).not.toContain("COMEBACK");
    expect(unlockedBy(game({ mode: "TOURNAMENT", difficulty: "HARD" }), career())).toEqual(expect.arrayContaining(["CHAMPION"]));
    expect(unlockedBy(game({ mode: "TOURNAMENT", difficulty: "HARD" }), career())).not.toContain("HARD_WIN");
    const themes = ["VOLCANO", "BEACH", "FOREST", "SNOWPEAK", "SPACE", "STADIUM"];
    expect(unlockedBy(game(), career({ themesWon: [...themes, "BEACH"], maxLevel: 10 }))).toEqual(expect.arrayContaining(["ALL_THEMES", "MAX_LEVEL"]));
    expect(unlockedBy(game(), career({ themesWon: themes.slice(1) }))).not.toContain("ALL_THEMES");
    expect(new Set(ACHIEVEMENT_CODES).size).toBe(ACHIEVEMENT_CODES.length);
  });
});

describe("arena daily quests", () => {
  it("picks the same distinct quests all day, varying by child and day", () => {
    const today = dailyQuests("child-a", "2026-09-30");
    expect(today).toHaveLength(DAILY_ARENA_QUESTS);
    expect(new Set(today).size).toBe(DAILY_ARENA_QUESTS);
    expect(dailyQuests("child-a", "2026-09-30")).toEqual(today);
    today.forEach((code) => expect(ARENA_QUEST_CODES).toContain(code));
    const variety = new Set(Array.from({ length: 30 }, (_, i) => dailyQuests("child-a", "2026-10-" + String(i + 1).padStart(2, "0")).join()));
    expect(variety.size).toBeGreaterThan(10);
  });

  it("adds progress across today's games, capped at the target", () => {
    const tally = { ...emptyTally(), ults: 1, crits: 2 };
    expect(questProgress("PLAY_2", [game(), game(), game()])).toBe(2);
    expect(questProgress("WIN_1", [game({ won: false })])).toBe(0);
    expect(questProgress("ULT_2", [game({ tally }), game({ tally })])).toBe(2);
    expect(questProgress("CRIT_3", [game({ tally })])).toBe(2);
    expect(questProgress("WIN_NORMAL", [game({ difficulty: "EASY" })])).toBe(0);
    expect(questProgress("WIN_NORMAL", [game({ difficulty: "EASY", mode: "TOURNAMENT" })])).toBe(1);
  });
});
