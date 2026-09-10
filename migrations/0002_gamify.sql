
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS profiles (
  user_id TEXT PRIMARY KEY NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL DEFAULT '无名修士',
  xp INTEGER NOT NULL DEFAULT 0,
  checkin_streak INTEGER NOT NULL DEFAULT 0,
  last_checkin_date TEXT,
  xp_award_date TEXT,
  xp_award_count INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS profiles_xp_idx ON profiles(xp DESC);

CREATE TABLE IF NOT EXISTS friendships (
  id TEXT PRIMARY KEY NOT NULL,
  requester_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  addressee_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted')),
  created_at INTEGER NOT NULL,
  UNIQUE (requester_id, addressee_id)
);

CREATE INDEX IF NOT EXISTS friendships_requester_idx ON friendships(requester_id);
CREATE INDEX IF NOT EXISTS friendships_addressee_idx ON friendships(addressee_id);

CREATE TABLE IF NOT EXISTS collab_tasks (
  id TEXT PRIMARY KEY NOT NULL,
  title TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'work',
  estimate TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT '',
  owner_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  friend_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  done INTEGER NOT NULL DEFAULT 0,
  done_by TEXT,
  created_at INTEGER NOT NULL,
  completed_at INTEGER
);

CREATE INDEX IF NOT EXISTS collab_tasks_owner_idx ON collab_tasks(owner_id);
CREATE INDEX IF NOT EXISTS collab_tasks_friend_idx ON collab_tasks(friend_id);
