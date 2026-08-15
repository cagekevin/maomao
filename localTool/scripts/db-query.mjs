#!/usr/bin/env node
/**
 * localTool 数据库维护 CLI（查库 + 压缩）
 * ------------------------------------------------------------
 * 用途：查询 localTool 的 sql.js 数据库（~/.maomao-localtool/localtool.db），
 *       省去每次手写 initSqlJs 打开库的样板；并内置 VACUUM 压缩能力。
 *       查询为【只读】——绝不写库、绝不触发落盘，可放心在服务运行时查看；
 *       VACUUM 压缩会写盘，故自动检测 localTool 是否在运行，运行中则拒绝执行。
 *
 * 表结构（见 localTool/src/db/database.ts initTables）：
 *   - kv        (key TEXT PRIMARY KEY, value TEXT, updated_at INTEGER)
 *   - tasks     (task_id, node_id, prompt, result_url, thumbnail_url, error_msg,
 *                custom_output_type, channel_name, model_name, progress,
 *                created_at, not_found_count, custom_result_data, custom_raw_response,
 *                request_data, response_data, media_meta, extra_fields, type, status, error_message)
 *   - resources (id, url, type, source, folder, name, page_url, page_title,
 *                is_favorite, timestamp)
 *
 * 用法（cd localTool 后执行）：
 *   node scripts/db-query.mjs --tables                      列出所有表及行数
 *   node scripts/db-query.mjs --table tasks                 查看 tasks 表所有列 + 前 20 行
 *   node scripts/db-query.mjs --table tasks --limit 5       限制行数
 *   node scripts/db-query.mjs --sql "SELECT * FROM kv"     直接执行任意只读 SQL
 *   node scripts/db-query.mjs --sql "SELECT * FROM tasks WHERE task_id=?" --arg abc123
 *   node scripts/db-query.mjs --search keyword             在 kv/tasks/resources 里模糊搜关键字
 *   node scripts/db-query.mjs --kv 键名模糊匹配             查 kv 表（值默认截断前 200 字符）
 *   node scripts/db-query.mjs --table tasks --json         以 JSON 数组输出（便于 jq/AI 分析）
 *   node scripts/db-query.mjs --sql "..." --json           同上，任意 SQL 结果转 JSON
 *   node scripts/db-query.mjs --vacuum                     压缩数据库（需先停 localTool，自动备份+完整性检查）
 *
 * 环境变量：
 *   MAOMAO_DATA_DIR  指定数据目录（默认 ~/.maomao-localtool），单测/隔离环境用。
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { fileURLToPath } from 'node:url';
import initSqlJs from 'sql.js';

const DATA_DIR = process.env['MAOMAO_DATA_DIR'] || path.join(os.homedir(), '.maomao-localtool');
const DB_PATH = path.join(DATA_DIR, 'localtool.db');
const BACKUP_DIR = path.join(DATA_DIR, 'backups');
// localTool 日志目录（脚本同级 ../logs）。fileURLToPath 正确处理 Windows 盘符/中文路径。
const LOGS_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'logs');

// 端口参数（--vacuum 用）：检测 localTool 是否运行，运行中拒绝压缩
function getPortArg(def) {
  const i = argv.indexOf('--port');
  return i >= 0 ? parseInt(argv[i + 1], 10) : def;
}

function checkPortInUse(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => resolve(true)); // EADDRINUSE → 端口被占
    server.once('listening', () => server.close(() => resolve(false)));
    server.listen(port, '127.0.0.1');
  });
}

const argv = process.argv.slice(2);

function usage() {
  console.log(`localTool 数据库维护工具（查库 + 查日志 + 压缩）
用法:
  node scripts/db-query.mjs --tables                列出所有表及行数
  node scripts/db-query.mjs --table <表名> [--limit N]  查看表列 + 前 N 行(默认20)
  node scripts/db-query.mjs --sql "<SQL>" [--arg v]...  直接执行只读 SQL（? 占位符用 --arg）
  node scripts/db-query.mjs --search <关键字>        在 kv/tasks/resources 模糊搜索
  node scripts/db-query.mjs --kv <键名>             查 kv 表（支持模糊匹配，值截断200字符）
  node scripts/db-query.mjs --table <表> --json     结果以 JSON 数组输出
  node scripts/db-query.mjs --logs [关键词]          查日志（关键词可为 download/upload/proxy/error 等前缀）
  node scripts/db-query.mjs --task <node_id>        同一节点的所有任务进度/结果URL比对
  node scripts/db-query.mjs --lost-check            丢图体检（tasks/磁盘/资源一致性 + 日志异常）
  node scripts/db-query.mjs --vacuum                 压缩数据库（需先停 localTool，自动备份+完整性检查）
库路径: ${DB_PATH}
日志目录: ${LOGS_DIR}
环境变量: MAOMAO_DATA_DIR 可指定数据目录（默认 ~/.maomao-localtool）
`);
}

function getArg(name, def) {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : def;
}

function hasArg(name) {
  return argv.indexOf(name) >= 0;
}

// ── 打开库（只读，不初始化表、不触发任何写）──
async function openDb() {
  if (!fs.existsSync(DB_PATH)) {
    console.error(`[ABORT] 数据库不存在: ${DB_PATH}`);
    process.exit(1);
  }
  const SQL = await initSqlJs();
  return new SQL.Database(fs.readFileSync(DB_PATH));
}

// ── VACUUM 压缩（从 vacuum-localtool-db.mjs 并入，逻辑一致）──
async function runVacuum(port) {
  if (!fs.existsSync(DB_PATH)) {
    console.error(`[ABORT] 数据库不存在: ${DB_PATH}`);
    process.exit(1);
  }
  // 1. 检查 localTool 是否在运行（写冲突会损坏库）
  const inUse = await checkPortInUse(port);
  if (inUse) {
    console.error(`[ABORT] localTool 正在运行（端口 ${port} 被占用）。请先停止 localTool 再压缩，避免写冲突损坏数据库。`);
    process.exit(1);
  }
  console.log(`[1] 端口 ${port} 空闲，localTool 未运行 ✓`);

  // 2. 备份
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const bakPath = path.join(BACKUP_DIR, `localtool.db.${ts}.prevacuum.bak`);
  fs.copyFileSync(DB_PATH, bakPath);
  console.log(`[2] 已备份 -> ${bakPath} (${(fs.statSync(bakPath).size / 1024 / 1024).toFixed(1)}MB)`);

  // 3. 打开库 + 完整性检查
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

  // 4. VACUUM
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
}

// ── 打印执行结果：db.exec 返回 [{columns, values}] ──
// json=true 时输出 JSON 数组（保留原始值，不截断），便于 jq / AI 后续处理
function printResult(execResult, maxColWidth = 60, json = false) {
  if (json) {
    if (!execResult.length || !execResult[0].values.length) {
      console.log('[]');
      return;
    }
    const { columns, values } = execResult[0];
    const rows = values.map(row => {
      const obj = {};
      columns.forEach((c, i) => { obj[c] = row[i]; });
      return obj;
    });
    console.log(JSON.stringify(rows));
    return;
  }
  if (!execResult.length) {
    console.log('(无结果)');
    return;
  }
  const { columns, values } = execResult[0];
  if (!values.length) {
    console.log(`(0 行，列: ${columns.join(', ')})`);
    return;
  }
  // 表头
  console.log(columns.join(' | '));
  console.log('-'.repeat(Math.max(20, columns.join(' | ').length)));
  for (const row of values) {
    const cells = row.map((v, i) => {
      if (v === null || v === undefined) return 'NULL';
      let s = typeof v === 'string' ? v : String(v);
      // 长文本截断，避免刷屏
      if (s.length > maxColWidth) s = s.slice(0, maxColWidth) + `…(+${s.length - maxColWidth})`;
      return s;
    });
    console.log(cells.join(' | '));
  }
  console.log(`\n(${values.length} 行)`);
}

// ── 日志读取：localTool/logs/*.log，按关键词过滤，显示最近 N 行 ──
function readLogLines() {
  const files = [];
  try {
    for (const f of fs.readdirSync(LOGS_DIR)) {
      if (f.endsWith('.log')) files.push(path.join(LOGS_DIR, f));
    }
  } catch { /* 日志目录不存在则空 */ }
  const lines = [];
  for (const f of files) {
    try {
      const content = fs.readFileSync(f, 'utf8');
      lines.push(...content.split(/\r?\n/).filter(Boolean));
    } catch { /* 忽略单个文件读取失败 */ }
  }
  return lines;
}

function runLogs() {
  const filter = getArg('--logs');            // --logs <关键词> 或 --logs 仅传（此时 filter=undefined）
  const keyword = typeof filter === 'string' ? filter : null;
  const limit = parseInt(getArg('--limit', '100'), 10) || 100;
  // 预定义日志前缀，方便按类型过滤：--logs download / upload / proxy / error / official / passthrough
  const prefixMap = { download: 'download', upload: 'upload', proxy: 'proxy', error: 'error', official: 'official', passthrough: 'passthrough' };
  const prefix = prefixMap[keyword] || null;
  let lines = readLogLines();
  // 高亮关键异常，便于一眼看到问题
  const abnormal = lines.filter(l => /download.*FAIL|upload.*400|\[error\]|Failed to download|ERR|stream error/i.test(l));
  if (prefix) {
    if (prefix === 'proxy') {
      // proxy 前缀覆盖 [proxy] 与 [proxy:stream]/[proxy:rewrite] 等所有子类型
      lines = lines.filter(l => /\[proxy(?:\]|:)/.test(l));
    } else {
      lines = lines.filter(l => l.includes(`[${prefix}]`));
    }
  } else if (keyword) lines = lines.filter(l => l.toLowerCase().includes(keyword.toLowerCase()));
  const shown = lines.slice(-limit);
  console.log(`日志目录: ${LOGS_DIR}（共 ${readLogLines().length} 行，按${keyword ? ` '${keyword}'` : ' 全部'}过滤，显示最近 ${limit} 行）\n`);
  for (const l of shown) console.log(l);
  if (abnormal.length) {
    console.log(`\n⚠️  异常记录（${abnormal.length} 条）:`);
    for (const l of abnormal.slice(-15)) console.log('  ' + l);
  }
  if (!shown.length) console.log('(无匹配日志)');
}

// ── 同节点任务比对：列出某 node 的所有任务，各条进度/status/结果URL/是否本地 ──
function runTaskCompare(db, nodeId) {
  const allow = /^[\w.-]+$/;   // 防注入：node_id 一般是 promptNode-xxx / img_xxx
  if (!allow.test(nodeId)) {
    console.error('[ABORT] 非法 node_id 格式');
    process.exit(1);
  }
  const rows = queryAllLike(db, `SELECT task_id, node_id, status, progress, model_name, custom_output_type, created_at, result_url, error_msg FROM tasks WHERE node_id = ? ORDER BY created_at DESC`, [nodeId]);
  if (!rows.length) {
    console.log(`(该 node 无任务记录: ${nodeId})`);
    return;
  }
  console.log(`node ${nodeId} 共 ${rows.length} 条任务（按创建时间倒序）:`);
  console.log('task_id | status | progress | model | type | created_at | 结果形态 | error');
  console.log('-'.repeat(100));
  for (const r of rows) {
    const url = r.result_url || '';
    const form = url.startsWith('data:') ? 'base64' : /127\.0\.0\.1:18080\/files/.test(url) ? '本地文件' : /^https?:\/\//.test(url) ? '远程URL⚠️' : url ? '其他' : '(无)';
    const err = (r.error_msg || r.error_message || '').toString().slice(0, 40);
    console.log(`${r.task_id} | ${r.status} | ${r.progress} | ${r.model_name} | ${r.custom_output_type || '-'} | ${r.created_at} | ${form} | ${err}`);
  }
  // 汇总
  const remoteCount = rows.filter(r => /^https?:\/\//.test(r.result_url || '') && !/127\.0\.0\.1/.test(r.result_url || '')).length;
  const failCount = rows.filter(r => r.status && r.status !== 'completed').length;
  if (remoteCount) console.log(`\n⚠️  其中 ${remoteCount} 条结果 URL 是远程（未落本地盘，资源面板可能没有）`);
  if (failCount) console.log(`⚠️  其中 ${failCount} 条未完成/失败`);
}

// ── 丢图体检：全局比对 tasks/results/磁盘，把"可能丢的图"列出来 ──
function runLostCheck(db) {
  console.log('=== 丢图体检（tasks ↔ resources ↔ 磁盘 一致性比对）===\n');

  // 1) tasks 里结果 URL 为远程的（未落本地盘 → 资源面板不会有）
  const remoteTasks = queryAllLike(db, `SELECT task_id, node_id, model_name, created_at, result_url FROM tasks WHERE result_url IS NOT NULL AND result_url <> ''`);
  const remoteOnly = remoteTasks.filter(r => /^https?:\/\//.test(r.result_url) && !/127\.0\.0\.1|localhost/.test(r.result_url));
  console.log(`[1] tasks 中结果 URL 为远程 CDN 的（未本地化，资源面板无）: ${remoteOnly.length} 条`);
  for (const r of remoteOnly.slice(0, 20)) {
    console.log(`    ${r.task_id} | ${r.model_name} | ${r.created_at} | ${String(r.result_url).slice(0, 80)}`);
  }

  // 2) 失败/未完成任务
  const failed = queryAllLike(db, `SELECT task_id, node_id, status, progress, error_msg, created_at FROM tasks WHERE status IS NOT NULL AND status != 'completed'`);
  console.log(`\n[2] tasks 中未完成/失败的任务: ${failed.length} 条`);
  for (const r of failed.slice(0, 20)) {
    console.log(`    ${r.task_id} | status=${r.status} | progress=${r.progress} | ${(r.error_msg || r.error_message || '').toString().slice(0, 50)}`);
  }

  // 3) 磁盘 upload/tasks 文件数 vs resources 表 folder=tasks 记录数（应一致）
  const uploadDir = path.join(DATA_DIR, 'uploads');
  const diskTasksDir = path.join(uploadDir, 'tasks');
  let diskCount = 0;
  try {
    if (fs.existsSync(diskTasksDir)) diskCount = fs.readdirSync(diskTasksDir).filter(f => !f.startsWith('.')).length;
  } catch { /* ignore */ }
  const resRow = queryOneLike(db, `SELECT COUNT(*) AS cnt FROM resources WHERE folder = 'tasks'`);
  const resCount = resRow ? Number(resRow.cnt) : 0;
  console.log(`\n[3] 磁盘 upload/tasks 文件数=${diskCount} vs resources 表 folder=tasks=${resCount} → ${diskCount === resCount ? '一致 ✓' : `不一致 ✗（差 ${diskCount - resCount}）`}`);

  // 4) 最近日志里的下载失败/上传400（需先补留痕，见 daily/2026-08-14）
  const lines = readLogLines();
  const downloadFail = lines.filter(l => /\[download\].*FAIL/i.test(l));
  const upload400 = lines.filter(l => /\[upload\] 400/i.test(l));
  console.log(`\n[4] 日志中的下载失败/上传400:`);
  console.log(`    下载失败 [download] FAIL: ${downloadFail.length} 条`);
  for (const l of downloadFail.slice(-10)) console.log('    ' + l);
  console.log(`    上传400 [upload] 400: ${upload400.length} 条`);
  for (const l of upload400.slice(-10)) console.log('    ' + l);

  console.log('\n=== 体检结束。若 [1][2][4] 有命中，说明存在丢图/失败，需结合日志定位。===');
}

// 兼容 sql.js 的带参查询（db-query 里 queryAllLike 处理 ? 占位）
function queryAllLike(db, sql, params = []) {
  const stmt = db.prepare(sql);
  try { stmt.bind(params); } catch { /* 无占位符 */ }
  const columns = [];
  for (let i = 0; i < stmt.getColumnNames().length; i++) columns.push(stmt.getColumnNames()[i]);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}
function queryOneLike(db, sql, params = []) {
  return queryAllLike(db, sql, params)[0];
}

async function main() {
  if (hasArg('--help') || hasArg('-h') || argv.length === 0) {
    usage();
    process.exit(0);
  }

  // 0) VACUUM 压缩（写盘操作：检测端口防运行中冲突，自动备份+完整性检查）
  if (hasArg('--vacuum')) {
    await runVacuum(getPortArg(18080));
    return;
  }

  // 0.1) 查日志（不需开库）
  if (hasArg('--logs')) {
    runLogs();
    return;
  }

  const db = await openDb();

  // 0.2) 同节点任务比对
  if (hasArg('--task')) {
    runTaskCompare(db, getArg('--task'));
    db.close();
    return;
  }

  // 0.3) 丢图体检
  if (hasArg('--lost-check')) {
    runLostCheck(db);
    db.close();
    return;
  }

  // 1) 列出所有表及行数
  if (hasArg('--tables')) {
    const r = db.exec(`SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name`);
    const tables = r.length ? r[0].values.map(v => v[0]) : [];
    console.log(`表列表（共 ${tables.length} 个）:`);
    for (const t of tables) {
      const cnt = db.exec(`SELECT COUNT(*) FROM "${t}"`);
      const n = cnt.length ? cnt[0].values[0][0] : 0;
      console.log(`  ${t}: ${n} 行`);
    }
    db.close();
    return;
  }

  // 2) 按表查看
  if (hasArg('--table')) {
    const table = getArg('--table');
    const limit = parseInt(getArg('--limit', '20'), 10) || 20;
    // 白名单：只允许内置表名，防 SQL 注入
    const allow = ['kv', 'tasks', 'resources'];
    if (!allow.includes(table)) {
      console.error(`[ABORT] 不允许的表名: ${table}（仅支持 ${allow.join('/')}）`);
      db.close();
      process.exit(1);
    }
    const cols = db.exec(`PRAGMA table_info(${table})`);
    console.log(`表 ${table} 列:`);
    if (cols.length) {
      console.log('  ' + cols[0].values.map(v => v[1]).join(', '));
    }
    console.log('\n前 ' + limit + ' 行:');
    printResult(db.exec(`SELECT * FROM ${table} LIMIT ${limit}`), 60, hasArg('--json'));
    db.close();
    return;
  }

  // 3) 直接执行只读 SQL
  if (hasArg('--sql')) {
    const sql = getArg('--sql');
    // 收集 --arg 参数
    const args = [];
    for (let i = 0; i < argv.length; i++) {
      if (argv[i] === '--arg' && argv[i + 1] !== undefined) args.push(argv[i + 1]);
    }
    // 安全：禁止写语句
    const forbid = /\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|VACUUM|ATTACH|DETACH|REPLACE)\b/i;
    if (forbid.test(sql)) {
      console.error('[ABORT] 只读工具：禁止执行写语句。如需写库请用 localTool 接口或停止服务后操作。');
      db.close();
      process.exit(1);
    }
    try {
      const stmt = db.prepare(sql);
      try {
        stmt.bind(args);
      } catch (e) {
        // 无占位符时忽略 bind 错误（如 SELECT 1）
      }
      const columns = [];
      for (let i = 0; i < stmt.getColumnNames().length; i++) columns.push(stmt.getColumnNames()[i]);
      const rows = [];
      while (stmt.step()) rows.push(stmt.getAsObject());
      printResult([{ columns, values: rows.map(r => columns.map(c => r[c])) }], 60, hasArg('--json'));
      stmt.free();
    } catch (e) {
      console.error('[SQL 执行失败]', e.message);
      process.exit(1);
    }
    db.close();
    return;
  }

  // 4) kv 表查询
  if (hasArg('--kv')) {
    const key = getArg('--kv');
    const like = `%${key}%`;
    const stmt = db.prepare('SELECT key, value, updated_at FROM kv WHERE key LIKE ? ORDER BY updated_at DESC LIMIT 50');
    stmt.bind([like]);
    const rows = [];
    while (stmt.step()) rows.push(stmt.getAsObject());
    stmt.free();
    if (!rows.length) {
      console.log(`(无匹配 key: ${key})`);
    } else {
      for (const r of rows) {
        let val = r.value || '';
        if (val.length > 200) val = val.slice(0, 200) + `…(+${val.length - 200})`;
        console.log(`[${r.key}] (updated_at=${r.updated_at})`);
        console.log(`  ${val}\n`);
      }
      console.log(`(${rows.length} 个匹配 key)`);
    }
    db.close();
    return;
  }

  // 5) 全局模糊搜索
  if (hasArg('--search')) {
    const kw = getArg('--search');
    const like = `%${kw}%`;
    const results = [];
    // kv
    {
      const stmt = db.prepare("SELECT 'kv' AS src, key AS id, value AS content, updated_at AS ts FROM kv WHERE key LIKE ? OR value LIKE ? LIMIT 10");
      stmt.bind([like, like]);
      while (stmt.step()) results.push(stmt.getAsObject());
      stmt.free();
    }
    // tasks
    {
      const stmt = db.prepare("SELECT 'tasks' AS src, task_id AS id, prompt AS content, created_at AS ts FROM tasks WHERE prompt LIKE ? OR task_id LIKE ? LIMIT 10");
      stmt.bind([like, like]);
      while (stmt.step()) results.push(stmt.getAsObject());
      stmt.free();
    }
    // resources
    {
      const stmt = db.prepare("SELECT 'resources' AS src, id AS id, COALESCE(name,'') || ' | ' || COALESCE(url,'') AS content, timestamp AS ts FROM resources WHERE name LIKE ? OR url LIKE ? LIMIT 10");
      stmt.bind([like, like]);
      while (stmt.step()) results.push(stmt.getAsObject());
      stmt.free();
    }
    if (!results.length) {
      console.log(`(未找到包含 "${kw}" 的记录)`);
    } else {
      for (const r of results) {
        let c = r.content || '';
        if (c.length > 120) c = c.slice(0, 120) + `…`;
        console.log(`[${r.src}] ${r.id}  (ts=${r.ts})`);
        console.log(`  ${c}\n`);
      }
      console.log(`(${results.length} 条匹配)`);
    }
    db.close();
    return;
  }

  usage();
  db.close();
}

main().catch((e) => {
  console.error('[ERROR]', e.message);
  process.exit(1);
});
