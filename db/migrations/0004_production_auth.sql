ALTER TABLE families ADD COLUMN join_code TEXT;

CREATE UNIQUE INDEX idx_families_join_code
ON families(join_code)
WHERE join_code IS NOT NULL;

CREATE INDEX idx_children_display_name
ON children(family_id, display_name);
