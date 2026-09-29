-- Pokédex set bonuses are paid as EARN rows with reference_type 'DEX_SET'.
-- Extend the one-payout-per-reference index to cover them.
DROP INDEX idx_point_transactions_reward_reference;

CREATE UNIQUE INDEX idx_point_transactions_reward_reference
ON point_transactions(reference_type, reference_id)
WHERE reference_type IN ('QUEST', 'STREAK', 'DEX_SET');
