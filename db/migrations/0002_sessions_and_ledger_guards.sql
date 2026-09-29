CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_sessions_user ON sessions(user_id);
CREATE INDEX idx_sessions_expiry ON sessions(expires_at);

CREATE TRIGGER point_transactions_reject_negative_balance
BEFORE INSERT ON point_transactions
WHEN NEW.points < 0
  AND (SELECT points_balance FROM children WHERE id = NEW.child_id) + NEW.points < 0
BEGIN
  SELECT RAISE(ABORT, 'INSUFFICIENT_POINTS');
END;

CREATE TRIGGER point_transactions_apply_balance
AFTER INSERT ON point_transactions
BEGIN
  UPDATE children
  SET points_balance = points_balance + NEW.points,
      updated_at = CURRENT_TIMESTAMP
  WHERE id = NEW.child_id;
END;
