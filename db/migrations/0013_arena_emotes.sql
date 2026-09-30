-- Emoji reactions sent during a battle. Kept apart from `state`/`version` so
-- sending one never makes the other player's next move stale.
ALTER TABLE arena_rooms ADD COLUMN emotes TEXT;
ALTER TABLE arena_rooms ADD COLUMN emote_seq INTEGER NOT NULL DEFAULT 0;
