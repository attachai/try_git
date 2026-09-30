-- The field condition rolled when a room is created, shown to the child while
-- picking a team; the battle then changes it every few rounds.
ALTER TABLE arena_rooms ADD COLUMN weather TEXT;

-- A carried item is paid for when used, once per room.
DROP INDEX idx_point_transactions_reward_reference;

CREATE UNIQUE INDEX idx_point_transactions_reward_reference
ON point_transactions(reference_type, reference_id)
WHERE reference_type IN ('QUEST', 'STREAK', 'DEX_SET', 'ARENA', 'ARENA_ITEM');
