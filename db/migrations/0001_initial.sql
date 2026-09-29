PRAGMA foreign_keys = ON;

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE,
  password_hash TEXT,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('PARENT','CHILD')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE families (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE family_members (
  id TEXT PRIMARY KEY,
  family_id TEXT NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  relation TEXT NOT NULL CHECK (relation IN ('FATHER','MOTHER','GUARDIAN','CHILD')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (family_id, user_id)
);

CREATE TABLE children (
  id TEXT PRIMARY KEY,
  family_id TEXT NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  user_id TEXT UNIQUE REFERENCES users(id) ON DELETE SET NULL,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  points_balance INTEGER NOT NULL DEFAULT 0 CHECK (points_balance >= 0),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE point_transactions (
  id TEXT PRIMARY KEY,
  child_id TEXT NOT NULL REFERENCES children(id) ON DELETE RESTRICT,
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('EARN','DEDUCT','PURCHASE','EVOLUTION','REVERSAL','ADMIN_ADJUSTMENT')),
  points INTEGER NOT NULL CHECK (points <> 0),
  reason TEXT NOT NULL,
  reference_type TEXT,
  reference_id TEXT,
  reversed_transaction_id TEXT REFERENCES point_transactions(id) ON DELETE RESTRICT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE characters (
  id TEXT PRIMARY KEY,
  external_id TEXT,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  type_primary TEXT NOT NULL,
  type_secondary TEXT,
  image_url TEXT NOT NULL,
  price INTEGER NOT NULL CHECK (price >= 0),
  rarity TEXT NOT NULL DEFAULT 'COMMON',
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0,1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE evolution_paths (
  id TEXT PRIMARY KEY,
  from_character_id TEXT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  to_character_id TEXT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  point_cost INTEGER NOT NULL CHECK (point_cost >= 0),
  UNIQUE (from_character_id, to_character_id)
);

CREATE TABLE child_characters (
  id TEXT PRIMARY KEY,
  child_id TEXT NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  character_id TEXT NOT NULL REFERENCES characters(id) ON DELETE RESTRICT,
  acquired_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  acquisition_type TEXT NOT NULL CHECK (acquisition_type IN ('PURCHASE','EVOLUTION','GRANT')),
  evolved_from TEXT REFERENCES child_characters(id) ON DELETE SET NULL
);

CREATE TABLE purchase_transactions (
  id TEXT PRIMARY KEY,
  child_id TEXT NOT NULL REFERENCES children(id) ON DELETE RESTRICT,
  character_id TEXT NOT NULL REFERENCES characters(id) ON DELETE RESTRICT,
  points_used INTEGER NOT NULL CHECK (points_used >= 0),
  purchased_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_family_members_family ON family_members(family_id);
CREATE INDEX idx_children_family ON children(family_id);
CREATE INDEX idx_point_transactions_child_created ON point_transactions(child_id, created_at DESC);
CREATE INDEX idx_characters_active_price ON characters(is_active, price);
CREATE INDEX idx_child_characters_child ON child_characters(child_id);
CREATE INDEX idx_purchase_transactions_child ON purchase_transactions(child_id, purchased_at DESC);
