-- Arena levels live on the child's owned copy. xp is progress inside the
-- current level; evolving copies both to the new form.
ALTER TABLE child_characters ADD COLUMN level INTEGER NOT NULL DEFAULT 1 CHECK (level BETWEEN 1 AND 10);
ALTER TABLE child_characters ADD COLUMN xp INTEGER NOT NULL DEFAULT 0 CHECK (xp >= 0);

-- Set once when a finished room hands out XP (the guard against paying twice),
-- and used for the daily XP-room limit. xp_awards is a JSON summary for the result screen.
ALTER TABLE arena_rooms ADD COLUMN xp_day TEXT;
ALTER TABLE arena_rooms ADD COLUMN xp_awards TEXT;
