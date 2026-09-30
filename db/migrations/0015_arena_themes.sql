-- Arena theme picked (or rolled) when the room is created: backdrop, weather pool,
-- and one house rule applied by shared/arena.ts.
ALTER TABLE arena_rooms ADD COLUMN theme TEXT;
