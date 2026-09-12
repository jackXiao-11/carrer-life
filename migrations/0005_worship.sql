PRAGMA foreign_keys = ON;

-- 膜拜记录：每人每天对同一目标限一次（复合主键去重）
CREATE TABLE IF NOT EXISTS worships (
  worshipper_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  target_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (worshipper_id, target_id, date)
);

CREATE INDEX IF NOT EXISTS worships_target_idx ON worships(target_id);
