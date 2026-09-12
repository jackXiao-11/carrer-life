PRAGMA foreign_keys = ON;

-- 跨实例持久化限流（Cloudflare Workers 多实例内存计数不可靠）
CREATE TABLE IF NOT EXISTS rate_limits (
  key TEXT PRIMARY KEY NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  reset_at INTEGER NOT NULL
);
