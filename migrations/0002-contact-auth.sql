CREATE TABLE IF NOT EXISTS raja_auth_limits (
 key TEXT PRIMARY KEY,
 attempts INTEGER NOT NULL DEFAULT 0,
 expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS raja_auth_limits_expiry ON raja_auth_limits(expires_at);
