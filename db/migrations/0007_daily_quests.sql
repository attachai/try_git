-- Daily quests: parents define repeatable quests, children mark them done
-- each day, and a parent approval awards the points. child_id NULL means the
-- quest is for every child in the family.
CREATE TABLE quests (
  id TEXT PRIMARY KEY,
  family_id TEXT NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  child_id TEXT REFERENCES children(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  points INTEGER NOT NULL CHECK (points BETWEEN 1 AND 1000),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0,1)),
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_quests_family_active ON quests(family_id, is_active);

-- day is the calendar day in Thailand time (YYYY-MM-DD).
CREATE TABLE quest_completions (
  id TEXT PRIMARY KEY,
  quest_id TEXT NOT NULL REFERENCES quests(id) ON DELETE CASCADE,
  child_id TEXT NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  day TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('PENDING','APPROVED','REJECTED')),
  submitted_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  reviewed_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (quest_id, child_id, day)
);

CREATE INDEX idx_quest_completions_child_day ON quest_completions(child_id, day);

-- A quest completion or a streak day can only ever pay out once.
CREATE UNIQUE INDEX idx_point_transactions_reward_reference
ON point_transactions(reference_type, reference_id)
WHERE reference_type IN ('QUEST', 'STREAK');
