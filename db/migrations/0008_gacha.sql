-- Mystery box spins. Each spin debits points (PURCHASE ledger row with
-- reference_type 'GACHA') and grants one shop character the child doesn't own.
-- day is the calendar day in Thailand time, used for the daily spin limit.
CREATE TABLE gacha_spins (
  id TEXT PRIMARY KEY,
  child_id TEXT NOT NULL REFERENCES children(id) ON DELETE RESTRICT,
  character_id TEXT NOT NULL REFERENCES characters(id) ON DELETE RESTRICT,
  child_character_id TEXT NOT NULL REFERENCES child_characters(id) ON DELETE RESTRICT,
  rarity TEXT NOT NULL,
  points_used INTEGER NOT NULL CHECK (points_used >= 0),
  day TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_gacha_spins_child_day ON gacha_spins(child_id, day);
