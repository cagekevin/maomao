/**
 * 数据库初始化 — sql.js（纯 WASM，跨平台，无需编译）
 * 封装兼容 better-sqlite3 风格的查询接口
 */

import initSqlJs, { type Database as SqlJsDatabase } from 'sql.js';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';

export function getDataDir(): string {
  const envDir = process.env['MAOMAO_DATA_DIR'];
  if (envDir) return envDir;
  return path.join(os.homedir(), '.maomao-localtool');
}

export function getUploadDir(): string {
  return path.join(getDataDir(), 'uploads');
}

/** 备份目录：与主库隔离，避免主库损坏时备份一同被清 */
export function getBackupDir(): string {
  return path.join(getDataDir(), 'backups');
}

/** 本地文件可访问 base（files 路由前缀）。多处拼 URL 共用，避免硬编码漂移 */
export const LOCAL_FILE_BASE = 'http://127.0.0.1:18080/files/';

let _db: SqlJsDatabase | null = null;

// ── 备份 / 导出 配置 ──
const BACKUP_KEEP = 7;                 // 保留最近 N 份 db 备份，自动清理更旧的
const BACKUP_EXPORT_KEEP = 7;          // 保留最近 N 份 JSON 导出
const DAILY_BACKUP_INTERVAL = 24 * 60 * 60 * 1000; // 每日自动备份间隔（24h）
let _backupTimer: ReturnType<typeof setTimeout> | null = null;

/** 每天这个时刻触发一次结构化导出（本地凌晨 3:00，近似，足够兜底） */
const DAILY_EXPORT_HOUR = 3;

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

  // 清理上次异常退出可能残留的临时文件，避免其影响后续判断
  cleanupTempFiles();

  const dbPath = path.join(dataDir, 'localtool.db');
  const SQL = await initSqlJs();

  if (fs.existsSync(dbPath)) {
    const fileBuffer = fs.readFileSync(dbPath);
    try {
      _db = new SQL.Database(fileBuffer);
      // 冒烟测试：能读到表结构才算健康，避免「文件头损坏但构造未抛错」的隐性坏库
      _db.exec("SELECT name FROM sqlite_master WHERE type='table'");
    } catch (err) {
      // 数据库损坏（常见如 file is not a database / out of memory）。绝不能因此让服务起不来。
      // 把损坏文件改名备份（不删除，留数据给用户自行抢救），再用空库重建，保证服务可用。
      console.error('');
      console.error('  ⚠️  ═══════════════════════════════════════════════');
      console.error('  ⚠️  检测到数据库损坏，正在自动重建（损坏文件已备份）：');
      console.error(`  ⚠️  文件: ${dbPath}`);
      console.error(`  ⚠️  报错: ${(err as Error).message}`);
      try {
        const bak = `${dbPath}.corrupt.${Date.now()}`;
        fs.renameSync(dbPath, bak);
        console.error(`  ⚠️  备份: ${bak}`);
      } catch (renameErr) {
        // 备份失败（文件被占用等）仍继续重建，避免死循环
        console.error(`  ⚠️  备份失败: ${(renameErr as Error).message}`);
      }
      console.error('  ⚠️  历史任务/资源/KV 记录已清空，上传图片(./uploads)不受影响。');
      console.error('  ⚠️  ═══════════════════════════════════════════════');
      console.error('');
      _db = null;
    }
  }

  if (!_db) {
    _db = new SQL.Database();
  }

  initTables(_db);
  return _db;
}

// VACUUM 触发阈值：db 文件超过该大小（字节）时，下次落盘前先执行 VACUUM 回收
// 删除记录/空洞释放的页面，防止 sql.js 全量 export 导致文件只增不减、膨胀到数百 MB。
// 50MB 对本地 KV/tasks 来说已算异常偏大，达到即压缩。
const VACUUM_THRESHOLD = 50 * 1024 * 1024;

/** 持久化到磁盘（原子写：先写临时文件再替换，避免写盘中途中断损坏主库） */
export function saveDb(): void {
  if (!_db) return;

  const dbPath = path.join(getDataDir(), 'localtool.db');

  // 文件已异常偏大时先 VACUUM 压缩，再导出落盘（压缩后文件显著减小）
  if (fs.existsSync(dbPath) && fs.statSync(dbPath).size > VACUUM_THRESHOLD) {
    try {
      _db.exec('VACUUM');
    } catch (err) {
      // VACUUM 失败通常意味着库已损坏（如 file is not a database / malformed）。
      // 此时全量 export 也会得到坏文件，先标记，交由下方原子写 / 损坏兜底处理。
      console.error(`  ⚠️  VACUUM 失败（库可能已损坏）：${(err as Error).message}`);
    }
  }

  const data = _db.export();
  const buffer = Buffer.from(data);

  // 原子写：写 .tmp 临时文件成功后 rename 覆盖主文件。
  // 即便进程在写盘中途被杀/断电，主文件仍是上次完整的快照，不会被写坏。
  const tmpPath = `${dbPath}.tmp`;
  fs.writeFileSync(tmpPath, buffer);
  fs.renameSync(tmpPath, dbPath);
}

/** 启动时清理上次异常退出可能残留的临时文件 */
export function cleanupTempFiles(): void {
  const dataDir = getDataDir();
  const tmpPath = path.join(dataDir, 'localtool.db.tmp');
  try {
    if (fs.existsSync(tmpPath)) {
      fs.unlinkSync(tmpPath);
      console.log('  🧹 已清理残留的数据库临时文件 localtool.db.tmp');
    }
  } catch { /* 忽略清理失败 */ }
}

// ═══════════════════════════════════════════════════════════════════
// 备份 & 导出 —— 数据安全防线（性能/安全平衡版）
// 目标：提示词(prompt)、任务记录等有价值数据绝不因数据库损坏而丢失。
// 平衡策略：
//   · 备份是纯文件拷贝，成本低 → 启动时 + 每日各做一次；用「日期戳去重」，
//     同一天多次启动不重复备份，避免频繁重启产生海量文件与 IO。
//   · 导出较重（全量序列化）→ 仅每日定时一次，且只导关键字段，不做启动导出。
// ═══════════════════════════════════════════════════════════════════

function fmtDay(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}`;
}

function fmtStamp(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${fmtDay(d)}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

/** 按前缀清旧文件，只保留最近 keep 个 */
function pruneByPrefix(dir: string, prefix: string, keep: number): void {
  try {
    if (!fs.existsSync(dir)) return;
    const files = fs.readdirSync(dir)
      .filter(f => f.startsWith(prefix))
      .sort(); // 文件名带日期时间戳，字典序即时间序
    while (files.length > keep) {
      const oldest = files.shift()!;
      try { fs.unlinkSync(path.join(dir, oldest)); } catch { /* 忽略 */ }
    }
  } catch { /* 忽略 */ }
}

/** 备份当前 db 文件到 backups/（日期去重：同一天只备份一份；仅备份健康库） */
export function backupDb(force = false): string | null {
  try {
    if (!_db) return null;
    const dataDir = getDataDir();
    const dbPath = path.join(dataDir, 'localtool.db');
    if (!fs.existsSync(dbPath)) return null;

    const backupDir = getBackupDir();
    if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });

    // 日期去重：今天已有备份则跳过（除非 force 强制再备一份），避免频繁重启刷 IO/占盘
    const today = fmtDay();
    if (!force && fs.existsSync(backupDir)) {
      const hasToday = fs.readdirSync(backupDir).some(f => f.startsWith(`localtool.db.${today}`));
      if (hasToday) return null;
    }

    // 冒烟：主库必须健康才备份，否则备份无意义
    _db.exec("SELECT count(*) FROM sqlite_master");

    const backupPath = path.join(backupDir, `localtool.db.${fmtStamp()}.bak`);
    fs.copyFileSync(dbPath, backupPath);
    pruneByPrefix(backupDir, 'localtool.db.', BACKUP_KEEP);
    console.log(`  💾 已自动备份数据库 → ${backupPath}`);
    return backupPath;
  } catch (err) {
    console.error(`  ⚠️ 数据库备份失败：${(err as Error).message}`);
    return null;
  }
}

/** 把 tasks/resources 关键字段导出为可读 JSON（每日一次；只导轻量字段，避免 IO 与序列化成本） */
export function exportDataJson(force = false): string | null {
  try {
    if (!_db) return null;
    const backupDir = getBackupDir();
    if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });

    // 日期去重：今天已导出则跳过（除非 force）
    const today = fmtDay();
    if (!force && fs.existsSync(backupDir)) {
      const hasToday = fs.readdirSync(backupDir).some(f => f.startsWith(`data.export.${today}`));
      if (hasToday) return null;
    }

    // 只导关键字段；prompt/result_url/created_at 等轻量列，不导出大的 JSON 响应字段
    const tasks = queryAll(_db, `SELECT task_id, node_id, prompt, result_url, thumbnail_url, model_name, channel_name, custom_output_type, progress, created_at, error_msg FROM tasks ORDER BY created_at DESC`);
    const resources = queryAll(_db, `SELECT id, url, type, source, folder, name, page_url, page_title, is_favorite, timestamp FROM resources ORDER BY timestamp DESC`);

    const payload = {
      exportedAt: new Date().toISOString(),
      counts: { tasks: tasks.length, resources: resources.length },
      tasks,
      resources,
    };

    const filePath = path.join(backupDir, `data.export.${fmtStamp()}.json`);
    fs.writeFileSync(filePath, JSON.stringify(payload), 'utf-8');
    pruneByPrefix(backupDir, 'data.export.', BACKUP_EXPORT_KEEP);
    console.log(`  📄 已导出结构化数据 → ${filePath} (tasks=${tasks.length}, resources=${resources.length})`);
    return filePath;
  } catch (err) {
    console.error(`  ⚠️ 结构化导出失败：${(err as Error).message}`);
    return null;
  }
}

/** 启动每日自动备份/导出调度（在服务监听成功后调用一次即可；用 unref 不阻塞进程退出） */
export function startBackupSchedule(): void {
  if (_backupTimer) return;
  _backupTimer = setInterval(() => {
    try { backupDb(); } catch { /* 忽略 */ }
    try { exportDataJson(); } catch { /* 忽略 */ }
  }, DAILY_BACKUP_INTERVAL);
  if (typeof _backupTimer.unref === 'function') _backupTimer.unref();
}

let _saveTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * 安全删除本地文件：只删 18080 本地文件，跳过远程 URL。
 * 删前检查是否有其他 task/resource 仍引用该 URL，有引用则跳过。
 * @returns true = 已删除，false = 跳过或不存在
 */
export function deleteLocalFile(db: any, dbUrl: string): boolean {
  if (!dbUrl.startsWith(LOCAL_FILE_BASE)) return false;

  const relativePath = dbUrl.slice(LOCAL_FILE_BASE.length);
  const diskPath = path.join(getUploadDir(), relativePath);

  if (!fs.existsSync(diskPath)) return false;

  // 检查是否有其他 task 或 resource 仍引用此 URL
  const taskRefs = queryOne(db,
    'SELECT COUNT(*) as cnt FROM tasks WHERE result_url = ? OR thumbnail_url = ?',
    [dbUrl, dbUrl]
  ) as { cnt: number } | undefined;
  const resRefs = queryOne(db,
    'SELECT COUNT(*) as cnt FROM resources WHERE url = ?',
    [dbUrl]
  ) as { cnt: number } | undefined;
  if ((taskRefs?.cnt ?? 0) > 0 || (resRefs?.cnt ?? 0) > 0) return false;

  fs.unlinkSync(diskPath);
  return true;
}

/**
 * 防抖落盘：500ms 内多次调用只落一次。
 * 所有写路由（KV/tasks/resources）写完后调用此函数，
 * 确保非优雅退出时最多丢 500ms 数据。
 */
export function debouncedSaveDb(): void {
  if (_saveTimer) clearTimeout(_saveTimer);
  _saveTimer = setTimeout(() => {
    _saveTimer = null;
    saveDb();
  }, 500);
}

function initTables(db: any): void {
  db.run(`CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at INTEGER NOT NULL DEFAULT (unixepoch()))`);
  db.run(`CREATE TABLE IF NOT EXISTS tasks (task_id TEXT PRIMARY KEY, node_id TEXT, prompt TEXT, result_url TEXT, thumbnail_url TEXT, error_msg TEXT, custom_output_type TEXT, channel_name TEXT, model_name TEXT, progress INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL DEFAULT 0, not_found_count INTEGER NOT NULL DEFAULT 0, custom_result_data TEXT, custom_raw_response TEXT, request_data TEXT, response_data TEXT, media_meta TEXT, extra_fields TEXT)`);
  db.run(`CREATE TABLE IF NOT EXISTS resources (id TEXT PRIMARY KEY, url TEXT NOT NULL, type TEXT NOT NULL, source TEXT, folder TEXT, name TEXT, page_url TEXT, page_title TEXT, is_favorite INTEGER NOT NULL DEFAULT 0, timestamp INTEGER NOT NULL DEFAULT 0)`);
  db.run(`CREATE TABLE IF NOT EXISTS projects (id TEXT PRIMARY KEY, name TEXT NOT NULL, is_last_opened INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL DEFAULT 0)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks(created_at)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_tasks_progress ON tasks(progress)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_resources_timestamp ON resources(timestamp)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_resources_type ON resources(type)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_resources_folder ON resources(folder)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_resources_is_favorite ON resources(is_favorite)`);

  // 迁移：旧数据库可能缺列（前端 task 对象带这些字段时会 INSERT 报错）
  try { db.run(`ALTER TABLE tasks ADD COLUMN type TEXT`); } catch { /* 列已存在 */ }
  try { db.run(`ALTER TABLE tasks ADD COLUMN status TEXT`); } catch { /* 列已存在 */ }
  try { db.run(`ALTER TABLE tasks ADD COLUMN error_message TEXT`); } catch { /* 列已存在 */ }
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

/** 开始事务 */
export function beginTx(db: any): void {
  db.run('BEGIN');
}

/** 提交事务 */
export function commitTx(db: any): void {
  db.run('COMMIT');
}

/** 回滚事务 */
export function rollbackTx(db: any): void {
  db.run('ROLLBACK');
}
