-- Arena rank points. Tiers come from shared/progression.ts; a loss never drops
-- the child below the tier they are in.
ALTER TABLE children ADD COLUMN arena_rp INTEGER NOT NULL DEFAULT 0 CHECK (arena_rp >= 0);

-- Tournaments: three AI rounds in one room. `stage` is the round being played,
-- `stage_teams` holds every round's opponents (JSON), and `parent_team` the current one.
ALTER TABLE arena_rooms ADD COLUMN mode TEXT NOT NULL DEFAULT 'DUEL' CHECK (mode IN ('DUEL','TOURNAMENT'));
ALTER TABLE arena_rooms ADD COLUMN stage INTEGER NOT NULL DEFAULT 1 CHECK (stage BETWEEN 1 AND 3);
ALTER TABLE arena_rooms ADD COLUMN stage_teams TEXT;

-- Set once when a finished room is scored (rank, achievements, arena quests):
-- the guard against scoring twice, and the summary for the result screen.
ALTER TABLE arena_rooms ADD COLUMN results TEXT;
CREATE INDEX idx_arena_rooms_child_xp_day ON arena_rooms(child_id, xp_day);

CREATE TABLE arena_achievements (
  child_id TEXT NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  room_id TEXT,
  unlocked_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (child_id, code)
);

-- Rank-up bonuses, achievements, and arena quests each pay out once.
DROP INDEX idx_point_transactions_reward_reference;

CREATE UNIQUE INDEX idx_point_transactions_reward_reference
ON point_transactions(reference_type, reference_id)
WHERE reference_type IN ('QUEST', 'STREAK', 'DEX_SET', 'ARENA', 'ARENA_ITEM', 'ARENA_RANK', 'ACHIEVEMENT', 'ARENA_QUEST');
