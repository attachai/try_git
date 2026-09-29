# Database

Cloudflare D1 is the source of truth.

## Tables
- users
- families
- family_members
- children
- point_transactions
- characters
- evolution_paths
- child_characters
- purchase_transactions

## Ledger invariant
Historical point transactions are never silently edited or deleted by application flows. Corrections are modeled as REVERSAL transactions.

## Balance invariant
`children.points_balance >= 0` is enforced by schema and application logic.

## Atomic operations planned for later phases
Award/deduct:
- update balance
- insert ledger

Purchase:
- verify balance
- deduct balance
- insert PURCHASE ledger
- insert child character
- insert purchase record

Evolution:
- verify ownership/path/balance
- deduct balance
- insert EVOLUTION ledger
- create evolved ownership record

These operations must use D1 batch/transaction-safe behavior.
