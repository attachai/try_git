-- Arena rooms: a parent opens a room with a 4-digit code, a child joins,
-- picks up to 3 monsters, and the two take turns. The whole battle lives in
-- `state` (JSON from shared/arena.ts); `version` guards every write so a
-- double tap or two devices acting at once can't both apply.
CREATE TABLE arena_rooms (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL,
  parent_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  child_id TEXT REFERENCES children(id) ON DELETE SET NULL,
  difficulty TEXT NOT NULL CHECK (difficulty IN ('EASY','NORMAL','HARD')),
  prize INTEGER NOT NULL CHECK (prize BETWEEN 0 AND 200),
  auto_parent INTEGER NOT NULL DEFAULT 0 CHECK (auto_parent IN (0,1)),
  status TEXT NOT NULL CHECK (status IN ('WAITING','PICKING','BATTLE','FINISHED','CANCELLED')),
  parent_team TEXT NOT NULL,
  state TEXT,
  version INTEGER NOT NULL DEFAULT 0,
  winner TEXT CHECK (winner IN ('CHILD','PARENT')),
  reward_points INTEGER NOT NULL DEFAULT 0,
  reward_day TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- A code is unique only among rooms still in play, so codes can be reused later.
CREATE UNIQUE INDEX idx_arena_rooms_open_code
ON arena_rooms(code)
WHERE status IN ('WAITING','PICKING','BATTLE');

CREATE INDEX idx_arena_rooms_parent ON arena_rooms(parent_user_id, created_at DESC);
CREATE INDEX idx_arena_rooms_child ON arena_rooms(child_id, created_at DESC);

-- Arena rewards pay out once per room.
DROP INDEX idx_point_transactions_reward_reference;

CREATE UNIQUE INDEX idx_point_transactions_reward_reference
ON point_transactions(reference_type, reference_id)
WHERE reference_type IN ('QUEST', 'STREAK', 'DEX_SET', 'ARENA');
