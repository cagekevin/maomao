/**
 * 数据库初始化 — sql.js（纯 WASM，跨平台，无需编译）
 * 封装兼容 better-sqlite3 风格的查询接口
 */

import initSqlJs, { type Database as SqlJsDatabase } from 'sql.js';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';

export function getDataDir(): string {
  const envDir = process.env['YIMAO_DATA_DIR'];
  if (envDir) return envDir;
  return path.join(os.homedir(), '.yimao-localtool');
}

export function getUploadDir(): string {
  return path.join(getDataDir(), 'uploads');
}

let _db: SqlJsDatabase | null = null;

export async function getDb(): Promise<SqlJsDatabase> {
  if (_db) return _db;

  const dataDir = getDataDir();
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const uploadDir = getUploadDir();
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  const dbPath = path.join(dataDir, 'localtool.db');
  const SQL = await initSqlJs();

  if (fs.existsSync(dbPath)) {
    const fileBuffer = fs.readFileSync(dbPath);
    _db = new SQL.Database(fileBuffer);
  } else {
    _db = new SQL.Database();
  }

  initTables(_db);
  return _db;
}

/** 持久化到磁盘 */
export function saveDb(): void {
  if (!_db) return;
  const data = _db.export();
  const buffer = Buffer.from(data);
  const dbPath = path.join(getDataDir(), 'localtool.db');
  fs.writeFileSync(dbPath, buffer);
}

function initTables(db: any): void {
  db.run(`CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at INTEGER NOT NULL DEFAULT (unixepoch()))`);
  db.run(`CREATE TABLE IF NOT EXISTS tasks (task_id TEXT PRIMARY KEY, node_id TEXT, prompt TEXT, result_url TEXT, thumbnail_url TEXT, error_msg TEXT, custom_output_type TEXT, channel_name TEXT, model_name TEXT, progress INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL DEFAULT 0, not_found_count INTEGER NOT NULL DEFAULT 0, custom_result_data TEXT, custom_raw_response TEXT, request_data TEXT, response_data TEXT, media_meta TEXT, extra_fields TEXT)`);
  db.run(`CREATE TABLE IF NOT EXISTS resources (id TEXT PRIMARY KEY, url TEXT NOT NULL, type TEXT NOT NULL, source TEXT, folder TEXT, name TEXT, page_url TEXT, page_title TEXT, is_favorite INTEGER NOT NULL DEFAULT 0, timestamp INTEGER NOT NULL DEFAULT 0)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks(created_at)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_tasks_progress ON tasks(progress)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_resources_timestamp ON resources(timestamp)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_resources_type ON resources(type)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_resources_folder ON resources(folder)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_resources_is_favorite ON resources(is_favorite)`);
}

export function closeDb(): void {
  if (_db) {
    saveDb();
    _db.close();
    _db = null;
  }
}

// ── 兼容 better-sqlite3 风格的查询接口 ──

/** 执行 SQL，返回结果数组 */
export function queryAll(db: any, sql: string, params: unknown[] = []): any[] {
  const stmt = db.prepare(sql);
  stmt.bind(params as any[]);
  const rows: any[] = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
}

/** 执行 SQL，返回第一行 */
export function queryOne(db: any, sql: string, params: unknown[] = []): any | undefined {
  const rows = queryAll(db, sql, params);
  return rows[0];
}

/** 执行 INSERT/UPDATE/DELETE，返回 { changes } */
export function run(db: any, sql: string, params: unknown[] = []): { changes: number } {
  db.run(sql, params as any[]);
  return { changes: db.getRowsModified() };
}

/** 执行多条 SQL（事务） */
export function execMulti(db: any, statements: string[]): void {
  for (const sql of statements) {
    db.run(sql);
  }
}
