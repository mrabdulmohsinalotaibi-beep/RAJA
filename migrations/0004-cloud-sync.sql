CREATE TABLE IF NOT EXISTS raja_sync (
 subject TEXT PRIMARY KEY,
 data TEXT NOT NULL,
 version INTEGER NOT NULL DEFAULT 1,
 updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS raja_cloud_files (
 subject TEXT NOT NULL,
 id TEXT NOT NULL,
 name TEXT NOT NULL,
 mime TEXT NOT NULL,
 size INTEGER NOT NULL,
 at INTEGER NOT NULL,
 object_key TEXT NOT NULL,
 upload_id TEXT,
 status TEXT NOT NULL CHECK(status IN ('uploading','ready','deleted')),
 expires_at INTEGER NOT NULL,
 PRIMARY KEY(subject,id)
);
CREATE INDEX IF NOT EXISTS raja_cloud_files_owner_status ON raja_cloud_files(subject,status);
CREATE TABLE IF NOT EXISTS raja_upload_parts (
 subject TEXT NOT NULL,
 file_id TEXT NOT NULL,
 part INTEGER NOT NULL,
 etag TEXT NOT NULL,
 size INTEGER NOT NULL,
 PRIMARY KEY(subject,file_id,part),
 FOREIGN KEY(subject,file_id) REFERENCES raja_cloud_files(subject,id) ON DELETE CASCADE
);
