-- PIN for the profile picker login. Parents keep their email password in
-- password_hash and use pin_hash for the PIN; children's PIN stays in
-- password_hash, where it already lives.
ALTER TABLE users ADD COLUMN pin_hash TEXT;
