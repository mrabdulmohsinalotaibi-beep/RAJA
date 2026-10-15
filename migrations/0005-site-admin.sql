CREATE TABLE IF NOT EXISTS raja_admin_accounts (
 id TEXT PRIMARY KEY, phone TEXT NOT NULL UNIQUE, name TEXT NOT NULL,
 role TEXT NOT NULL CHECK(role IN ('owner','admin')), disabled INTEGER NOT NULL DEFAULT 0 CHECK(disabled IN (0,1)),
 password_salt TEXT, password_hash TEXT, password_iterations INTEGER, recovery_hash TEXT,
 activation_hash TEXT, activation_expires INTEGER, credential_version INTEGER NOT NULL DEFAULT 1,
 created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, last_login INTEGER
);
CREATE TABLE IF NOT EXISTS raja_admin_sessions (
 session_id TEXT PRIMARY KEY, admin_id TEXT NOT NULL REFERENCES raja_admin_accounts(id),
 credential_version INTEGER NOT NULL, expires_at INTEGER NOT NULL, created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS raja_admin_sessions_expiry ON raja_admin_sessions(expires_at);
CREATE TABLE IF NOT EXISTS raja_admin_audit (
 id TEXT PRIMARY KEY, actor_id TEXT NOT NULL, action TEXT NOT NULL, target TEXT NOT NULL DEFAULT '',
 created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS raja_admin_audit_time ON raja_admin_audit(created_at DESC);
CREATE TABLE IF NOT EXISTS raja_user_controls (
 user_id TEXT PRIMARY KEY REFERENCES raja_accounts(id), suspended INTEGER NOT NULL DEFAULT 0 CHECK(suspended IN (0,1)),
 updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS raja_site_settings (
 id INTEGER PRIMARY KEY CHECK(id=1), title TEXT NOT NULL DEFAULT 'رَجْع | RAJA', announcement TEXT NOT NULL DEFAULT '',
 registration_open INTEGER NOT NULL DEFAULT 1, downloads_enabled INTEGER NOT NULL DEFAULT 1,
 version INTEGER NOT NULL DEFAULT 1, updated_at INTEGER NOT NULL DEFAULT 0
);
INSERT OR IGNORE INTO raja_site_settings(id) VALUES(1);
