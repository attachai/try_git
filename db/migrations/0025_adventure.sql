CREATE TABLE adventure_progress (
  child_id TEXT PRIMARY KEY REFERENCES children(id) ON DELETE CASCADE,
  cleared INTEGER NOT NULL DEFAULT 0 CHECK(cleared BETWEEN 0 AND 120),
  xp INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE adventure_runs (
  id TEXT PRIMARY KEY,
  child_id TEXT NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  stage_id INTEGER NOT NULL CHECK(stage_id BETWEEN 1 AND 120),
  day TEXT NOT NULL,
  state TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'BATTLE' CHECK(status IN ('BATTLE','FINISHED','ABANDONED')),
  stars INTEGER NOT NULL DEFAULT 0 CHECK(stars BETWEEN 0 AND 3),
  xp INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX adventure_one_active ON adventure_runs(child_id) WHERE status = 'BATTLE';
CREATE INDEX adventure_daily ON adventure_runs(child_id, day);
CREATE TABLE adventure_records (
  child_id TEXT NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  stage_id INTEGER NOT NULL,
  stars INTEGER NOT NULL,
  PRIMARY KEY(child_id, stage_id)
);
-- Count starts, including losses, replays and abandoned battles. The trigger is
-- atomic with INSERT, so parallel requests cannot exceed the daily allowance.
CREATE TRIGGER adventure_start_guard BEFORE INSERT ON adventure_runs BEGIN
  SELECT CASE WHEN (SELECT COUNT(*) FROM adventure_runs WHERE child_id = NEW.child_id AND day = NEW.day) >= 5
    THEN RAISE(ABORT, 'ADVENTURE_DAILY_LIMIT') END;
  SELECT CASE WHEN NEW.stage_id > COALESCE((SELECT cleared FROM adventure_progress WHERE child_id = NEW.child_id), 0) + 1
    THEN RAISE(ABORT, 'ADVENTURE_LOCKED') END;
END;
-- Progress, first-clear XP and best stars commit with the winning state update.
CREATE TRIGGER adventure_finish AFTER UPDATE OF status ON adventure_runs
WHEN OLD.status = 'BATTLE' AND NEW.status = 'FINISHED' BEGIN
  INSERT INTO adventure_progress(child_id, cleared, xp) VALUES(NEW.child_id, 0, 0) ON CONFLICT DO NOTHING;
  UPDATE adventure_progress SET
    xp = xp + CASE WHEN NEW.stars = 0 OR NEW.stage_id > cleared THEN NEW.xp ELSE 0 END,
    cleared = MAX(cleared, CASE WHEN NEW.stars > 0 THEN NEW.stage_id ELSE 0 END)
    WHERE child_id = NEW.child_id;
  INSERT INTO adventure_records(child_id, stage_id, stars)
    SELECT NEW.child_id, NEW.stage_id, NEW.stars WHERE NEW.stars > 0
    ON CONFLICT(child_id, stage_id) DO UPDATE SET stars = MAX(stars, excluded.stars);
END;
