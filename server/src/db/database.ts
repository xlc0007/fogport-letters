import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  player_name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active')),
  turn_count INTEGER NOT NULL DEFAULT 0 CHECK (turn_count >= 0),
  location_id TEXT NOT NULL,
  clock_minutes INTEGER NOT NULL DEFAULT 0,
  ended_at TEXT,
  stats_json TEXT NOT NULL,
  summary TEXT NOT NULL,
  memories_json TEXT NOT NULL,
  unresolved_clues_json TEXT NOT NULL,
  opening_narration TEXT NOT NULL,
  opening_suggestions_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS session_items (
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  item_id TEXT NOT NULL,
  position INTEGER NOT NULL,
  PRIMARY KEY (session_id, item_id)
);

CREATE TABLE IF NOT EXISTS session_flags (
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  flag_id TEXT NOT NULL,
  value INTEGER NOT NULL CHECK (value IN (0, 1)),
  PRIMARY KEY (session_id, flag_id)
);

CREATE TABLE IF NOT EXISTS session_relations (
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  npc_id TEXT NOT NULL,
  value INTEGER NOT NULL CHECK (value BETWEEN 0 AND 100),
  known_fact_ids_json TEXT NOT NULL,
  PRIMARY KEY (session_id, npc_id)
);

CREATE TABLE IF NOT EXISTS turns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  turn_number INTEGER NOT NULL CHECK (turn_number >= 1),
  player_action TEXT NOT NULL,
  narration TEXT NOT NULL,
  suggested_actions_json TEXT NOT NULL,
  proposed_events_json TEXT NOT NULL,
  accepted_events_json TEXT NOT NULL,
  memory_updates_json TEXT NOT NULL,
  summary_after TEXT NOT NULL,
  state_snapshot_json TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('qwen', 'demo', 'safe-fallback')),
  warning TEXT,
  clock_after INTEGER,
  rule_notes_json TEXT NOT NULL DEFAULT '[]',
  highlights_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL,
  UNIQUE (session_id, turn_number)
);

CREATE INDEX IF NOT EXISTS idx_turns_session_number
  ON turns (session_id, turn_number);
`;

export function openDatabase(databasePath: string): Database.Database {
  fs.mkdirSync(path.dirname(databasePath), { recursive: true });
  const db = new Database(databasePath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.pragma("busy_timeout = 5000");
  db.exec(SCHEMA);
  migrateDatabase(db);
  return db;
}

function migrateDatabase(db: Database.Database): void {
  const migrate = db.transaction(() => {
    ensureColumn(db, "sessions", "clock_minutes", "INTEGER NOT NULL DEFAULT 0");
    ensureColumn(db, "sessions", "ended_at", "TEXT");
    ensureColumn(db, "turns", "clock_after", "INTEGER");
    ensureColumn(
      db,
      "turns",
      "rule_notes_json",
      "TEXT NOT NULL DEFAULT '[]'",
    );
    ensureColumn(
      db,
      "turns",
      "highlights_json",
      "TEXT NOT NULL DEFAULT '[]'",
    );

    db.prepare(
      `UPDATE sessions
       SET clock_minutes = MIN(turn_count * 10, 180)
       WHERE clock_minutes = 0 AND turn_count > 0`,
    ).run();

    db.prepare(
      `UPDATE turns
       SET clock_after = MIN(turn_number * 10, 180)
       WHERE clock_after IS NULL`,
    ).run();
  });

  migrate();
}

function ensureColumn(
  db: Database.Database,
  table: string,
  column: string,
  definition: string,
): void {
  const rows = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{
    name: string;
  }>;
  if (rows.some((row) => row.name === column)) return;
  db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}
