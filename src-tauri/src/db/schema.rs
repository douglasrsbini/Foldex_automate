use rusqlite::{Connection, Result};
use std::path::PathBuf;

pub fn get_db_path() -> PathBuf {
    let mut path = dirs::home_dir().unwrap_or_else(|| PathBuf::from("."));
    path.push(".foldex.db");
    path
}

pub fn init_database() -> Result<()> {
    let conn = Connection::open(get_db_path())?;

    conn.execute_batch(
        "
        CREATE TABLE IF NOT EXISTS rules (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            custom_code TEXT NOT NULL UNIQUE,
            name TEXT NOT NULL,
            source_directory TEXT NOT NULL,
            logic_operator TEXT NOT NULL DEFAULT 'AND',
            conflict_policy TEXT DEFAULT 'AUTONUMBER',
            is_active INTEGER NOT NULL DEFAULT 1,
            is_sentinel_active INTEGER NOT NULL DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS rule_filters (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            rule_id INTEGER NOT NULL,
            field_name TEXT NOT NULL,
            operator TEXT NOT NULL,
            value TEXT NOT NULL,
            logic_connector TEXT DEFAULT 'AND',
            FOREIGN KEY (rule_id) REFERENCES rules(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS rule_actions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            rule_id INTEGER NOT NULL,
            action_type TEXT NOT NULL,
            target_pattern TEXT NOT NULL,
            sequence_order INTEGER DEFAULT 0,
            FOREIGN KEY (rule_id) REFERENCES rules(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS audit_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            batch_id TEXT NOT NULL,
            rule_id INTEGER,
            action_type TEXT NOT NULL,
            original_path TEXT NOT NULL,
            destination_path TEXT,
            file_size_bytes INTEGER NOT NULL,
            status TEXT NOT NULL,
            executed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            is_reversible INTEGER NOT NULL DEFAULT 1,
            file_hash_sha256 TEXT,
            prev_log_hash TEXT,
            current_log_hash TEXT,
            windows_user TEXT
        );

        CREATE TABLE IF NOT EXISTS app_license (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            user_email TEXT,
            license_key TEXT,
            plan_name TEXT NOT NULL DEFAULT 'Demonstração (Trial)',
            source_channel TEXT NOT NULL DEFAULT 'TRIAL',
            expires_at TEXT,
            is_activated INTEGER NOT NULL DEFAULT 0,
            activated_at DATETIME
        );

        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );

        INSERT OR IGNORE INTO settings (key, value) VALUES ('autopilot_mode', 'REALTIME');
        INSERT OR IGNORE INTO settings (key, value) VALUES ('autopilot_delay', '3');
        INSERT OR IGNORE INTO settings (key, value) VALUES ('autopilot_notifications', 'true');
        "
    )?;

    // Migrações seguras
    let _ = conn.execute("ALTER TABLE audit_logs ADD COLUMN file_hash_sha256 TEXT", []);
    let _ = conn.execute("ALTER TABLE audit_logs ADD COLUMN prev_log_hash TEXT", []);
    let _ = conn.execute("ALTER TABLE audit_logs ADD COLUMN current_log_hash TEXT", []);
    let _ = conn.execute("ALTER TABLE audit_logs ADD COLUMN windows_user TEXT", []);
    let _ = conn.execute("ALTER TABLE rules ADD COLUMN is_sentinel_active INTEGER DEFAULT 0", []);
    let _ = conn.execute("ALTER TABLE rules ADD COLUMN conflict_policy TEXT DEFAULT 'AUTONUMBER'", []);

    Ok(())
}