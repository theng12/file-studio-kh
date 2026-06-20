import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { app } from 'electron';
import Database from 'better-sqlite3';

let db: Database.Database | null = null;

function dbPath(): string {
  return join(app.getPath('userData'), 'data', 'file-studio-kh.sqlite');
}

function migrate(database: Database.Database): void {
  database.pragma('journal_mode = WAL');
  database.pragma('foreign_keys = ON');

  database.exec(`
    CREATE TABLE IF NOT EXISTS app_state (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS recent_roots (
      id TEXT PRIMARY KEY,
      root_path TEXT NOT NULL UNIQUE,
      label TEXT NOT NULL,
      last_opened_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS scan_batches (
      id TEXT PRIMARY KEY,
      root_path TEXT NOT NULL,
      started_at TEXT NOT NULL,
      finished_at TEXT,
      status TEXT NOT NULL,
      file_count INTEGER NOT NULL DEFAULT 0,
      folder_count INTEGER NOT NULL DEFAULT 0,
      total_bytes INTEGER NOT NULL DEFAULT 0,
      error_message TEXT
    );

    CREATE TABLE IF NOT EXISTS scanned_files (
      id TEXT PRIMARY KEY,
      scan_batch_id TEXT NOT NULL,
      root_path TEXT NOT NULL,
      relative_path TEXT NOT NULL,
      folder_relative_path TEXT NOT NULL,
      filename TEXT NOT NULL,
      extension TEXT NOT NULL,
      file_type TEXT NOT NULL,
      size_bytes INTEGER NOT NULL,
      modified_at TEXT NOT NULL,
      width INTEGER,
      height INTEGER,
      tags_json TEXT NOT NULL DEFAULT '[]',
      status TEXT NOT NULL DEFAULT 'needs_review',
      content_hash TEXT,
      perceptual_hash TEXT,
      FOREIGN KEY (scan_batch_id) REFERENCES scan_batches(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_scanned_files_batch ON scanned_files(scan_batch_id);
    CREATE INDEX IF NOT EXISTS idx_scanned_files_type ON scanned_files(file_type);
    CREATE INDEX IF NOT EXISTS idx_scanned_files_extension ON scanned_files(extension);
    CREATE INDEX IF NOT EXISTS idx_scanned_files_folder ON scanned_files(folder_relative_path);

    CREATE TABLE IF NOT EXISTS action_previews (
      id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL,
      root_path TEXT NOT NULL,
      operation_type TEXT NOT NULL,
      request_json TEXT NOT NULL,
      item_count INTEGER NOT NULL,
      ready_count INTEGER NOT NULL,
      conflict_count INTEGER NOT NULL,
      invalid_count INTEGER NOT NULL,
      skipped_count INTEGER NOT NULL,
      folders_to_create_json TEXT NOT NULL DEFAULT '[]'
    );

    CREATE TABLE IF NOT EXISTS action_preview_items (
      id TEXT PRIMARY KEY,
      preview_id TEXT NOT NULL,
      file_id TEXT NOT NULL,
      original_relative_path TEXT NOT NULL,
      proposed_relative_path TEXT,
      status TEXT NOT NULL,
      message TEXT,
      FOREIGN KEY (preview_id) REFERENCES action_previews(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_action_previews_created ON action_previews(created_at);
    CREATE INDEX IF NOT EXISTS idx_action_preview_items_preview ON action_preview_items(preview_id);

    CREATE TABLE IF NOT EXISTS action_operations (
      id TEXT PRIMARY KEY,
      preview_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      root_path TEXT NOT NULL,
      operation_type TEXT NOT NULL,
      applied_count INTEGER NOT NULL,
      failed_count INTEGER NOT NULL,
      skipped_count INTEGER NOT NULL,
      undo_status TEXT NOT NULL DEFAULT 'not_undone'
    );

    CREATE TABLE IF NOT EXISTS action_operation_items (
      id TEXT PRIMARY KEY,
      operation_id TEXT NOT NULL,
      file_id TEXT NOT NULL,
      original_path TEXT NOT NULL,
      target_path TEXT,
      status TEXT NOT NULL,
      message TEXT,
      undo_status TEXT NOT NULL DEFAULT 'not_undone',
      undo_message TEXT,
      FOREIGN KEY (operation_id) REFERENCES action_operations(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_action_operations_created ON action_operations(created_at);
    CREATE INDEX IF NOT EXISTS idx_action_operation_items_operation ON action_operation_items(operation_id);
  `);

  addColumnIfMissing(database, 'scanned_files', 'width', 'INTEGER');
  addColumnIfMissing(database, 'scanned_files', 'height', 'INTEGER');
  addColumnIfMissing(database, 'scanned_files', 'content_hash', 'TEXT');
  addColumnIfMissing(database, 'scanned_files', 'perceptual_hash', 'TEXT');
  addColumnIfMissing(database, 'action_previews', 'affected_bytes', 'INTEGER NOT NULL DEFAULT 0');
}

function addColumnIfMissing(database: Database.Database, table: string, column: string, type: string): void {
  const columns = database.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  if (!columns.some((item) => item.name === column)) {
    database.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`).run();
  }
}

export const DatabaseService = {
  get(): Database.Database {
    if (db) return db;
    mkdirSync(dirname(dbPath()), { recursive: true });
    db = new Database(dbPath());
    migrate(db);
    return db;
  },
};
