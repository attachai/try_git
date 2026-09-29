ALTER TABLE child_characters ADD COLUMN status TEXT NOT NULL DEFAULT 'OWNED';
ALTER TABLE child_characters ADD COLUMN evolved_at TEXT;

CREATE UNIQUE INDEX idx_child_character_one_owned
ON child_characters(child_id, character_id)
WHERE status = 'OWNED';

CREATE TABLE evolution_transactions (
  id TEXT PRIMARY KEY,
  child_id TEXT NOT NULL REFERENCES children(id) ON DELETE RESTRICT,
  from_child_character_id TEXT NOT NULL REFERENCES child_characters(id) ON DELETE RESTRICT,
  to_child_character_id TEXT NOT NULL REFERENCES child_characters(id) ON DELETE RESTRICT,
  from_character_id TEXT NOT NULL REFERENCES characters(id) ON DELETE RESTRICT,
  to_character_id TEXT NOT NULL REFERENCES characters(id) ON DELETE RESTRICT,
  points_used INTEGER NOT NULL CHECK (points_used >= 0),
  evolved_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_evolution_transactions_child
ON evolution_transactions(child_id, evolved_at DESC);
