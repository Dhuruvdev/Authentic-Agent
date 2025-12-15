import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";
import path from "path";
import fs from "fs";

const DB_PATH = path.join(process.cwd(), "api", "nothinghide", "data", "breaches.db");

const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const sqlite = new Database(DB_PATH);
sqlite.pragma("journal_mode = WAL");

export const db = drizzle(sqlite, { schema });

export function initializeDatabase() {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS breach_sources (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      domain TEXT,
      breach_date TEXT,
      added_date TEXT DEFAULT CURRENT_TIMESTAMP,
      description TEXT,
      data_classes TEXT,
      pwn_count INTEGER DEFAULT 0,
      is_verified INTEGER DEFAULT 1,
      is_sensitive INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS breached_emails (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email_hash TEXT NOT NULL,
      breach_source_id INTEGER NOT NULL,
      added_date TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (breach_source_id) REFERENCES breach_sources(id)
    );

    CREATE INDEX IF NOT EXISTS email_hash_idx ON breached_emails(email_hash);
    CREATE INDEX IF NOT EXISTS breach_source_idx ON breached_emails(breach_source_id);

    CREATE TABLE IF NOT EXISTS password_hash_prefixes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      prefix TEXT NOT NULL,
      suffix TEXT NOT NULL,
      count INTEGER DEFAULT 1,
      breach_source_id INTEGER,
      FOREIGN KEY (breach_source_id) REFERENCES breach_sources(id)
    );

    CREATE INDEX IF NOT EXISTS prefix_idx ON password_hash_prefixes(prefix);

    CREATE TABLE IF NOT EXISTS scan_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      input_type TEXT NOT NULL,
      input_hash_prefix TEXT,
      result_found INTEGER DEFAULT 0,
      scan_date TEXT DEFAULT CURRENT_TIMESTAMP,
      ip_hash TEXT
    );
  `);
  
  console.log("[NothingHide] Database initialized at", DB_PATH);
}

export { sqlite };
