#!/usr/bin/env node
/**
 * localTool 数据库 VACUUM 压缩工具
 * ------------------------------------------------------------
 * 用途：localTool 用 sql.js（纯内存 + 全量 export 落盘）。迁移/删除数据后，
 *       文件可能残留空洞不缩小（sql.js export 不自动 VACUUM）。本工具手动
 *       触发 VACUUM，把已瘦身的内容反映到磁盘大小，加速后续 saveDb 全量序列化。
 *
 * 安全措施：
 *   1. 自动检测 localTool 端口（默认 18080）——服务运行中则拒绝执行，
 *      避免与运行中的服务产生写冲突、损坏数据库。
 *   2. 先备份 localtool.db 到 backups/（带时间戳），可随时回滚。
 *   3. 执行 PRAGMA integrity_check 完整性检查，通过后才 VACUUM。
 *   4. VACUUM 失败不覆盖原库。
 *
 * 用法：
 *   cd localTool
 *   node scripts/vacuum-localtool-db.mjs [--port 18080]
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';

const DATA_DIR = path.join(os.homedir(), '.maomao-localtool');
const DB_PATH = path.join(DATA_DIR, 'localtool.db');
const BACKUP_DIR = path.join(DATA_DIR, 'backups');

// 解析端口参数
const portArgIdx = process.argv.indexOf('--port');
const LOCALTOOL_PORT = portArgIdx >= 0 ? parseInt(process.argv[portArgIdx + 1], 10) : 18080;

function checkPortInUse(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => resolve(true)); // EADDRINUSE → 端口被占
    server.once('listening', () => server.close(() => resolve(false)));
    server.listen(port, '127.0.0.1');
  });
}

if (!fs.existsSync(DB_PATH)) {
  console.error(`[ABORT] 数据库不存在: ${DB_PATH}`);
  process.exit(1);
}

// ── 1. 检查 localTool 是否在运行 ──
const inUse = await checkPortInUse(LOCALTOOL_PORT);
if (inUse) {
  console.error(`[ABORT] localTool 正在运行（端口 ${LOCALTOOL_PORT} 被占用）。请先停止 localTool 再执行，避免写冲突损坏数据库。`);
  process.exit(1);
}
console.log(`[1] 端口 ${LOCALTOOL_PORT} 空闲，localTool 未运行 ✓`);

// ── 2. 备份 ──
fs.mkdirSync(BACKUP_DIR, { recursive: true });
const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const bakPath = path.join(BACKUP_DIR, `localtool.db.${ts}.prevacuum.bak`);
fs.copyFileSync(DB_PATH, bakPath);
console.log(`[2] 已备份 -> ${bakPath} (${(fs.statSync(bakPath).size / 1024 / 1024).toFixed(1)}MB)`);

// ── 3. 打开库 + 完整性检查 ──
const initSqlJs = (await import('sql.js')).default;
const SQL = await initSqlJs();
const db = new SQL.Database(fs.readFileSync(DB_PATH));

const before = fs.statSync(DB_PATH).size;
console.log(`[3] 库当前大小: ${(before / 1024 / 1024).toFixed(1)}MB`);

try {
  const res = db.exec('PRAGMA integrity_check');
  const result = res.length && res[0].values.length ? res[0].values[0][0] : '?';
  if (result !== 'ok') {
    console.error(`[ABORT] 完整性检查未通过: ${result}`);
    db.close();
    process.exit(1);
  }
  console.log('[3] integrity_check: ok ✓');
} catch (e) {
  console.error('[ABORT] 完整性检查异常:', e.message);
  db.close();
  process.exit(1);
}

// ── 4. VACUUM ──
try {
  db.run('VACUUM');
  console.log('[4] VACUUM 完成 ✓');
} catch (e) {
  console.error('[4] VACUUM 失败，原库未覆盖:', e.message);
  db.close();
  process.exit(1);
}

const data = db.export();
fs.writeFileSync(DB_PATH, Buffer.from(data));
db.close();

const after = fs.statSync(DB_PATH).size;
console.log(`[5] 压缩后大小: ${(after / 1024 / 1024).toFixed(1)}MB`);
console.log(`    释放: ${((before - after) / 1024 / 1024).toFixed(1)}MB`);
console.log('\n完成。如需要回滚，可恢复备份:', bakPath);
