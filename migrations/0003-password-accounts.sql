CREATE TABLE IF NOT EXISTS raja_accounts (
 id TEXT PRIMARY KEY,
 email TEXT NOT NULL COLLATE NOCASE UNIQUE,
 name TEXT NOT NULL,
 password_salt TEXT NOT NULL,
 password_hash TEXT NOT NULL,
 password_iterations INTEGER NOT NULL,
 recovery_hash TEXT NOT NULL,
 credential_version INTEGER NOT NULL DEFAULT 1,
 created_at INTEGER NOT NULL,
 updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS raja_password_sessions (
 session_id TEXT PRIMARY KEY,
 user_id TEXT NOT NULL,
 credential_version INTEGER NOT NULL,
 expires_at INTEGER NOT NULL,
 FOREIGN KEY (user_id) REFERENCES raja_accounts(id)
);
CREATE INDEX IF NOT EXISTS raja_password_sessions_user ON raja_password_sessions(user_id);
CREATE INDEX IF NOT EXISTS raja_password_sessions_expiry ON raja_password_sessions(expires_at);
