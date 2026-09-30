// Arena progression rules shared by the Worker and the UI: rank tiers, one-time
// achievements, daily arena quests, and tournament rounds. Pure, no storage.
import type { Tally } from "./arena";

export type Difficulty = "EASY" | "NORMAL" | "HARD";
export type RankKey = "BRONZE" | "SILVER" | "GOLD" | "DIAMOND" | "MASTER";

// `bonus` is paid the first time the child reaches the tier.
export const RANKS: { key: RankKey; icon: string; label: string; min: number; bonus: number }[] = [
  { key: "BRONZE", icon: "🥉", label: "บรอนซ์", min: 0, bonus: 0 },
  { key: "SILVER", icon: "🥈", label: "ซิลเวอร์", min: 100, bonus: 50 },
  { key: "GOLD", icon: "🥇", label: "โกลด์", min: 250, bonus: 100 },
  { key: "DIAMOND", icon: "💎", label: "ไดมอนด์", min: 500, bonus: 150 },
  { key: "MASTER", icon: "👑", label: "มาสเตอร์", min: 900, bonus: 200 },
];
export const RP_WIN: Record<Difficulty, number> = { EASY: 15, NORMAL: 25, HARD: 35 };
export const RP_LOSS = 8;
// Tournament rank points by the tournament's difficulty: per round cleared, plus the title.
export const TOURNAMENT_RP: Record<Difficulty, { stage: number; champion: number }> = {
  EASY: { stage: 10, champion: 20 },
  NORMAL: { stage: 15, champion: 30 },
  HARD: { stage: 20, champion: 45 },
};

export function rankFor(rp: number) {
  const index = RANKS.reduce((found, rank, i) => (rp >= rank.min ? i : found), 0);
  const next = RANKS[index + 1] ?? null;
  return { ...RANKS[index], index, rp, next: next ? { key: next.key, icon: next.icon, label: next.label, min: next.min } : null };
}

// A loss can take RP away but never drops the child out of a tier they reached.
export function applyRp(rp: number, delta: number) {
  return Math.max(rankFor(rp).min, rp + delta);
}

export function rpDelta(result: { mode: "DUEL" | "TOURNAMENT"; difficulty: Difficulty; won: boolean; stagesCleared: number }) {
  if (result.mode === "TOURNAMENT") {
    const rp = TOURNAMENT_RP[result.difficulty];
    return rp.stage * result.stagesCleared + (result.won ? rp.champion : -RP_LOSS);
  }
  return result.won ? RP_WIN[result.difficulty] : -RP_LOSS;
}

// Tournament rounds, each against a fresh AI team that gets tougher.
export const TOURNAMENT_STAGES: { label: string; icon: string }[] = [
  { label: "รอบคัดเลือก", icon: "🥊" },
  { label: "รอบรองชนะเลิศ", icon: "⚔️" },
  { label: "รอบชิงชนะเลิศ", icon: "👑" },
];

// Opponents per round for each tournament difficulty: `pool` picks the rarities (as in
// a duel of that difficulty), `scale` the stats (lower than a duel because HP carries
// over), `levelBonus` levels above the child team's average.
// Simulated champion rate (AI vs AI, 2,000 runs) for a Lv.1 COMMON/RARE team /
// a Lv.3 team with EPICs / a Lv.5 team with anything:
//   EASY 48% / 65% / 70% · NORMAL 22% / 41% / 46% · HARD 7% / 18% / 24%
type TournamentRound = { pool: Difficulty; scale: number; levelBonus: number };
export const TOURNAMENT_LEVELS: Record<Difficulty, TournamentRound[]> = {
  EASY: [{ pool: "EASY", scale: 0.75, levelBonus: 0 }, { pool: "EASY", scale: 0.8, levelBonus: 0 }, { pool: "NORMAL", scale: 0.85, levelBonus: 1 }],
  NORMAL: [{ pool: "EASY", scale: 0.75, levelBonus: 0 }, { pool: "NORMAL", scale: 0.8, levelBonus: 1 }, { pool: "HARD", scale: 0.9, levelBonus: 2 }],
  HARD: [{ pool: "NORMAL", scale: 0.8, levelBonus: 1 }, { pool: "HARD", scale: 0.9, levelBonus: 1 }, { pool: "HARD", scale: 0.95, levelBonus: 2 }],
};

// What a finished room tells the achievement check.
export type Career = {
  wins: number;
  streak: number; // current win streak, including this room
  themesWon: string[];
  maxLevel: number;
};
export type Game = {
  won: boolean;
  mode: "DUEL" | "TOURNAMENT";
  difficulty: Difficulty;
  teamSize: number;
  alive: number; // child monsters still standing at the end
  lastHpShare: number; // the last one's HP share when only one survived
  finisher: string | undefined;
  tally: Tally;
};

type Achievement = { icon: string; label: string; detail: string; points: number; test: (game: Game, career: Career) => boolean };
export const ACHIEVEMENTS = {
  FIRST_WIN: { icon: "🎖️", label: "ชัยชนะแรก", detail: "ชนะ Arena ครั้งแรก", points: 20, test: (g, c) => g.won && c.wins >= 1 },
  WINS_10: { icon: "🔟", label: "นักสู้ตัวจริง", detail: "ชนะครบ 10 ห้อง", points: 50, test: (_, c) => c.wins >= 10 },
  WINS_50: { icon: "🏆", label: "ตำนาน Arena", detail: "ชนะครบ 50 ห้อง", points: 150, test: (_, c) => c.wins >= 50 },
  STREAK_3: { icon: "🔥", label: "ร้อนแรง", detail: "ชนะติดกัน 3 ห้อง", points: 30, test: (_, c) => c.streak >= 3 },
  STREAK_7: { icon: "☄️", label: "หยุดไม่อยู่", detail: "ชนะติดกัน 7 ห้อง", points: 80, test: (_, c) => c.streak >= 7 },
  HARD_WIN: { icon: "😤", label: "ไม่กลัวยาก", detail: "ชนะห้องระดับยาก หรือเป็นแชมป์ทัวร์นาเมนต์ระดับยาก", points: 40, test: (g) => g.won && g.difficulty === "HARD" },
  FLAWLESS: { icon: "✨", label: "ไร้รอยขีดข่วน", detail: "ชนะด้วยทีม 3 ตัวโดยไม่เสียสักตัว", points: 40, test: (g) => g.won && g.teamSize === 3 && g.alive === 3 },
  COMEBACK: { icon: "🦸", label: "พลิกเกม", detail: "ชนะด้วยตัวสุดท้ายที่ HP เหลือไม่ถึง 25%", points: 40, test: (g) => g.won && g.teamSize > 1 && g.alive === 1 && g.lastHpShare < 0.25 },
  ULT_FINISH: { icon: "💥", label: "ปิดจ็อบ", detail: "ปิดเกมด้วยท่าไม้ตาย", points: 30, test: (g) => g.won && g.finisher === "ULTIMATE" },
  COMBO_3: { icon: "🔗", label: "นักคอมโบ", detail: "ทำคอมโบธาตุ 3 ครั้งในห้องเดียว", points: 40, test: (g) => g.tally.combos >= 3 },
  ALL_THEMES: { icon: "🗺️", label: "นักเดินทาง", detail: "ชนะครบทั้ง 6 สนาม", points: 100, test: (_, c) => new Set(c.themesWon).size >= 6 },
  MAX_LEVEL: { icon: "🌟", label: "ปั้นสุดทาง", detail: "มีตัวละครถึง Lv.10", points: 100, test: (_, c) => c.maxLevel >= 10 },
  CHAMPION: { icon: "👑", label: "แชมป์", detail: "ชนะทัวร์นาเมนต์ครบ 3 รอบ", points: 100, test: (g) => g.won && g.mode === "TOURNAMENT" },
} satisfies Record<string, Achievement>;
export type AchievementCode = keyof typeof ACHIEVEMENTS;
export const ACHIEVEMENT_CODES = Object.keys(ACHIEVEMENTS) as AchievementCode[];

export function unlockedBy(game: Game, career: Career): AchievementCode[] {
  return ACHIEVEMENT_CODES.filter((code) => ACHIEVEMENTS[code].test(game, career));
}

// Daily arena quests: three from the pool per child per Thailand-time day.
type QuestRule = { icon: string; label: string; target: number; points: number; progress: (game: Game) => number };
export const ARENA_QUESTS = {
  PLAY_2: { icon: "⚔️", label: "สู้ใน Arena 2 ห้อง", target: 2, points: 15, progress: () => 1 },
  WIN_1: { icon: "🏆", label: "ชนะ 1 ห้อง", target: 1, points: 20, progress: (g) => (g.won ? 1 : 0) },
  WIN_NORMAL: { icon: "😤", label: "ชนะระดับกลางขึ้นไปหรือทัวร์นาเมนต์", target: 1, points: 25, progress: (g) => (g.won && (g.mode === "TOURNAMENT" || g.difficulty !== "EASY") ? 1 : 0) },
  ULT_2: { icon: "💥", label: "ใช้ท่าไม้ตาย 2 ครั้ง", target: 2, points: 15, progress: (g) => g.tally.ults },
  COMBO_1: { icon: "🔗", label: "ทำคอมโบธาตุ 1 ครั้ง", target: 1, points: 15, progress: (g) => g.tally.combos },
  SUPER_5: { icon: "💪", label: "ตีได้เปรียบธาตุ 5 ครั้ง", target: 5, points: 15, progress: (g) => g.tally.supers },
  CRIT_3: { icon: "🎯", label: "ตีคริติคอล 3 ครั้ง", target: 3, points: 15, progress: (g) => g.tally.crits },
  SWITCH_1: { icon: "🔄", label: "สลับตัวกลางเกม 1 ครั้ง", target: 1, points: 10, progress: (g) => g.tally.switches },
} satisfies Record<string, QuestRule>;
export type ArenaQuestCode = keyof typeof ARENA_QUESTS;
export const ARENA_QUEST_CODES = Object.keys(ARENA_QUESTS) as ArenaQuestCode[];
export const DAILY_ARENA_QUESTS = 3;

function hash(text: string) {
  let value = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    value ^= text.charCodeAt(i);
    value = Math.imul(value, 16777619) >>> 0;
  }
  return value;
}

// Same three quests all day for a child, different across children and days.
export function dailyQuests(childId: string, day: string): ArenaQuestCode[] {
  let seed = hash(childId + ":" + day);
  const pool = [...ARENA_QUEST_CODES];
  const picked: ArenaQuestCode[] = [];
  while (picked.length < DAILY_ARENA_QUESTS && pool.length > 0) {
    seed = (Math.imul(seed, 1103515245) + 12345) >>> 0;
    picked.push(pool.splice(seed % pool.length, 1)[0]);
  }
  return picked;
}

export function questProgress(code: ArenaQuestCode, games: Game[]) {
  const rule = ARENA_QUESTS[code];
  return Math.min(rule.target, games.reduce((sum, game) => sum + rule.progress(game), 0));
}
