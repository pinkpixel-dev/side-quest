-- The player's collection, so it follows them to a new device. Photos live in R2 under
-- `<user id>/creatures/<creature id>.jpg`.
CREATE TABLE creatures (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  id TEXT NOT NULL,
  creature TEXT NOT NULL,
  has_photo INTEGER NOT NULL DEFAULT 0,
  discovered_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, id)
);
