#!/usr/bin/env node
/**
 * 查任务 / 查图 / 查视频 / 丢图体检 —— 本地库排查工具（AI 首选）
 * ------------------------------------------------------------
 * 【就是干这个的】用户说「查一下这个任务 / 查这张图 / 图不见了 / 刷新没图 / 丢图」时，
 *   用它一条命令断言"这个任务/图此刻到底在哪一层断的"：
 *   - 查一条任务全链路（数据库+后端+前端日志）      → 直接贴 id：`--lifecycle <id>`
 *   - 查某节点历次生成结果                          →  `--task <node_id>`
 *   - 三层一致性断言（画布↔任务中心↔磁盘）          →  `--consistency [proj]`
 *   - 全库丢图体检                                  →  `--lost-check`
 *   - 画布结构体检（节点/边）                       →  `--canvas-health [proj]`
 *   - 拿 thread_id 直查 Lovart 上游状态/结果        →  `--lovart-status / --lovart-result`
 * 次要用途：通用查库（--tables/--table/--sql/--search/--kv）+ VACUUM 压缩（--vacuum）。
 *
 * 数据都来自 localTool 的 sql.js 数据库（~/.maomao-localtool/localtool.db）+ 磁盘 + 日志，
 * 不依赖前端运行，只读安全，服务运行时也可调用（--vacuum 除外）。
 *
 * 表结构（见 localTool/src/db/database.ts initTables）：
 *   - kv        (key TEXT PRIMARY KEY, value TEXT, updated_at INTEGER)  画布快照 canvas-state-v1-<projId>
 *   - tasks     (task_id, node_id, prompt, result_url, thumbnail_url, error_msg,
 *                custom_output_type, channel_name, model_name, progress,
 *                created_at, not_found_count, custom_result_data, custom_raw_response,
 *                request_data, response_data, media_meta, extra_fields, type, status, error_message,
 *                thread_id, poll_task_id)
 *   - resources (id, url, type, source, folder, name, page_url, page_title,
 *                is_favorite, timestamp)
 *
 * 用法（cd localTool 后执行）：
 *   # ── 查任务 / 图 / 视频（AI 改 bug 首选）──
 *   node scripts/task-inspect.mjs --lifecycle <id>  一条任务全链路（id 可为 task_id / thread_id / node_id）
 *   node scripts/task-inspect.mjs <task_id>         自然语言：直接贴 id 即查全链路（等价 --lifecycle）
 *   node scripts/task-inspect.mjs --task <node_id>  某节点历次生成比对
 *   node scripts/task-inspect.mjs --consistency [proj]  三层一致性断言（画布↔任务中心↔磁盘）
 *   node scripts/task-inspect.mjs --lost-check      全库丢图体检
 *   node scripts/task-inspect.mjs --canvas-health [proj]  画布节点/边体检
 *   # ── 通用查库 / 日志 / 压缩 ──
 *   node scripts/task-inspect.mjs --tables / --table tasks / --sql "..." / --search k / --kv k
 *   node scripts/task-inspect.mjs --logs [关键词]
 *   node scripts/task-inspect.mjs --vacuum          压缩数据库（需先停 localTool）
 *   # ── 连 Lovart 上游 ──
 *   node scripts/task-inspect.mjs --lovart-status <thread_id>
 *   node scripts/task-inspect.mjs --lovart-result <thread_id>
 *
 * 环境变量：
 *   MAOMAO_DATA_DIR  指定数据目录（默认 ~/.maomao-localtool），单测/隔离环境用。
 *   LOVART_ACCESS_KEY/LOVART_SECRET_KEY/LOVART_BASE_URL/HTTPS_PROXY  供 --lovart-* 使用。
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import tls from 'node:tls';
import crypto from 'node:crypto';
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
  console.log(`localTool 数据库维护 + 图片/视频生命周期排查工具（AI 排查"一张图/视频从生成到画布到上游"全链路 + 丢图断言）
用法:
  node scripts/task-inspect.mjs --tables       列出所有表及行数
  node scripts/task-inspect.mjs --table <表名> [--limit N]  查看表列 + 前 N 行(默认20)
  node scripts/task-inspect.mjs --sql "<SQL>" [--arg v]...  直接执行只读 SQL（? 占位符用 --arg）
  node scripts/task-inspect.mjs --search <关键字>  在 kv/tasks/resources 模糊搜索
  node scripts/task-inspect.mjs --kv <键名>   查 kv 表（支持模糊匹配，值截断200字符）
  node scripts/task-inspect.mjs --table <表> --json  结果以 JSON 数组输出
  node scripts/task-inspect.mjs --logs [关键词]  查日志（关键词可为 download/upload/proxy/error 等前缀）
  node scripts/task-inspect.mjs --task <node_id>  同一节点的所有任务进度/结果URL比对
  node scripts/task-inspect.mjs <id>              直接贴 id 查全链路（等价 --lifecycle；id 可为 task_id / thread_id / node_id，AI 说"查任务"直接用这个）
  node scripts/task-inspect.mjs --lifecycle <id>  完整生命周期一键查（数据库 + 后端日志 + 前端日志全链路；id 可为 task_id / thread_id(Lovart上游室外ID) / node_id）
  node scripts/task-inspect.mjs --lovart-status <thread_id>  直接拿 Lovart 上游 thread_id 查任务状态（是否结束；HMAC 签名）
  node scripts/task-inspect.mjs --lovart-result <thread_id>  拿 Lovart 上游 thread_id 查任务结果（出图URL/生成文本；同上凭据/base 约定）
  node scripts/task-inspect.mjs --canvas-health [proj]  画布数据结构体检（节点/边统计 + 无id边/重复id边/悬空边高亮；缺省取最近更新的快照）
  node scripts/task-inspect.mjs --lost-check   丢图体检（tasks/磁盘/资源一致性 + 日志异常）
  node scripts/task-inspect.mjs --consistency [proj]  【三层一致性断言】画布快照节点 imageUrl ↔ 任务中心 result_url ↔ 磁盘文件 三方 URL 是否对得上（定位"刷新丢图/错位"根因）
  node scripts/task-inspect.mjs --vacuum      压缩数据库（需先停 localTool，自动备份+完整性检查）
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

// ── 走代理的 HTTPS GET（CONNECT 隧道）──
// 连 Lovart 必须走 VPN/代理（直连超时，CLAUDE.md §五.1）。原生 fetch 不走系统代理，这里用
// node:net + node:tls 手动实现 HTTP CONNECT 隧道，代理来源：环境变量 HTTPS_PROXY/HTTP_PROXY/ALL_PROXY
// 或探测本机常见代理端口（与网关 lovart_client._detect_proxy_url 一致）。

// 异步探测代理端口（返回可用端口或 null）
function probeProxyPort(timeoutMs = 500) {
  const ports = [7897, 7890, 1087, 1080, 8888, 8118];
  return new Promise((resolve) => {
    let i = 0;
    const tryNext = () => {
      if (i >= ports.length) return resolve(null);
      const port = ports[i++];
      const sock = net.connect(port, '127.0.0.1');
      sock.setTimeout(timeoutMs);
      sock.once('connect', () => { sock.destroy(); resolve(port); });
      sock.once('error', () => { sock.destroy(); tryNext(); });
      sock.once('timeout', () => { sock.destroy(); tryNext(); });
    };
    tryNext();
  });
}

// 发起一次走代理（或直连）的 HTTPS GET，返回 { status, body }。resolveProxy 为 true 时先探测代理。
function lovartGet(host, pathStr, headers, proxyHost, proxyPort) {
  return new Promise((resolve, reject) => {
    const connect = (proxy) => {
      if (proxy) {
        // CONNECT 隧道
        const sock = net.connect(proxy.port, proxy.host, () => {
          sock.write(`CONNECT ${host}:443 HTTP/1.1\r\nHost: ${host}:443\r\n\r\n`);
        });
        let cb = '';
        sock.on('data', (d) => {
          cb += d.toString();
          if (cb.includes('\r\n\r\n')) {
            const status = cb.split('\r\n')[0];
            if (!status.includes('200')) return reject(new Error(`代理 CONNECT 失败: ${status}`));
            // 隧道建立 → 升级 TLS
            const t = tls.connect({ socket: sock, servername: host }, () => {
              const req = t.request ? t.request({ method: 'GET', path: pathStr, headers }) : null;
              // 用 raw 写 HTTP 请求（兼容 tls socket 无 request 方法）
              t.write(`GET ${pathStr} HTTP/1.1\r\nHost: ${host}\r\n${Object.entries(headers).map(([k, v]) => `${k}: ${v}`).join('\r\n')}\r\nConnection: close\r\n\r\n`);
              readResponse(t, resolve, reject);
            });
            t.on('error', (e) => reject(new Error(`TLS 失败: ${e.message}`)));
          }
        });
        sock.on('error', (e) => reject(new Error(`代理连接失败: ${e.message}`)));
      } else {
        // 直连
        const t = tls.connect({ host, port: 443, servername: host }, () => {
          t.write(`GET ${pathStr} HTTP/1.1\r\nHost: ${host}\r\n${Object.entries(headers).map(([k, v]) => `${k}: ${v}`).join('\r\n')}\r\nConnection: close\r\n\r\n`);
        });
        t.on('error', (e) => reject(new Error(`直连失败: ${e.message}`)));
        readResponse(t, resolve, reject);
      }
    };
    connect(proxyHost && proxyPort ? { host: proxyHost, port: proxyPort } : null);
  });
}

function readResponse(stream, resolve, reject) {
  let raw = '';
  stream.on('data', (c) => { raw += c.toString(); });
  stream.on('end', () => {
    const split = raw.indexOf('\r\n\r\n');
    if (split < 0) return reject(new Error('无效 HTTP 响应'));
    const head = raw.slice(0, split);
    const body = raw.slice(split + 4);
    const statusLine = head.split('\r\n')[0];
    const status = parseInt(statusLine.split(' ')[1], 10) || 0;
    resolve({ status, body });
  });
  stream.on('error', (e) => reject(new Error(`读取响应失败: ${e.message}`)));
}

// ── 拿 Lovart 上游 thread_id 直接向 Lovart 查任务信息 ──
// 对齐 apimart-gateway/lovart_client.py 的 HMAC-SHA256 签名（GET /v1/openapi/chat/{status|result}?thread_id=xxx）。
// endpoint: '/v1/openapi/chat/status'（任务状态）或 '/v1/openapi/chat/result'（任务结果：出图URL/文本）。
// 凭据：环境变量 LOVART_ACCESS_KEY / LOVART_SECRET_KEY（与网关一致）；base 默认 https://lgw.lovart.ai，可用 LOVART_BASE_URL 覆盖。
// 需联网连 Lovart（VPN/代理），脚本自动走 HTTPS_PROXY 等环境变量代理或探测本机代理端口。
async function runLovartQuery(threadId, endpoint, label) {
  const ak = process.env['LOVART_ACCESS_KEY'] || getArg('--ak', '');
  const sk = process.env['LOVART_SECRET_KEY'] || getArg('--sk', '');
  if (!ak || !sk) {
    console.error('[ABORT] 缺少 Lovart 凭据。请设置环境变量 LOVART_ACCESS_KEY / LOVART_SECRET_KEY（或 --ak / --sk）。');
    process.exit(1);
  }
  const base = (process.env['LOVART_BASE_URL'] || 'https://lgw.lovart.ai').replace(/\/+$/, '');
  const method = 'GET';
  const pathStr = endpoint;
  const host = base.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  const fullPath = `${pathStr}?thread_id=${encodeURIComponent(threadId)}`;

  // HMAC-SHA256 签名：sig = HMAC(sk, "{method}\n{path}\n{ts}")
  const ts = String(Math.floor(Date.now() / 1000));
  const sig = crypto.createHmac('sha256', sk).update(`${method}\n${pathStr}\n${ts}`).digest('hex');
  const headers = {
    'X-Access-Key': ak,
    'X-Timestamp': ts,
    'X-Signature': sig,
    'X-Signed-Method': method,
    'X-Signed-Path': pathStr,
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) LovartRelay/1.0',
    'Content-Type': 'application/json',
  };

  console.log(`正在向 Lovart 查询任务状态: thread_id=${threadId}`);
  console.log(`GET ${base}${fullPath}\n`);

  // 代理探测：环境变量优先，其次探测本机代理端口
  const envProxy = (() => {
    for (const k of ['HTTPS_PROXY', 'https_proxy', 'HTTP_PROXY', 'http_proxy', 'ALL_PROXY', 'all_proxy']) {
      const v = process.env[k];
      if (v) {
        try { const u = new URL(v); return { host: u.hostname, port: Number(u.port) || 7890 }; } catch { /* ignore */ }
      }
    }
    return null;
  })();
  let res;
  let lastErr = null;
  // 尝试顺序：环境变量代理 → 探测到的端口 → 直连
  const attempts = [];
  if (envProxy) attempts.push(envProxy);
  attempts.push(null); // 直连兜底
  if (!envProxy) {
    const probe = await probeProxyPort();
    if (probe) attempts.push({ host: '127.0.0.1', port: probe });
  }
  for (const proxy of attempts) {
    try {
      res = await lovartGet(host, fullPath, headers, proxy?.host, proxy?.port);
      if (res) break;
    } catch (e) {
      lastErr = e;
      if (proxy) console.error(`  ↳ 代理 ${proxy.host}:${proxy.port} 失败: ${e.message}`);
    }
  }
  if (!res) {
    console.error(`[ERROR] 请求 Lovart 失败（直连/代理均不可达）: ${lastErr?.message}`);
    process.exit(1);
  }

  let data = null;
  try { data = JSON.parse(res.body); } catch { /* 非 JSON */ }

  if (res.status >= 400) {
    const msg = data && (data.message || data.error) || `HTTP ${res.status}`;
    console.error(`[ERROR] Lovart 返回 ${res.status}: ${msg}`);
    process.exit(1);
  }

  // 与网关 _request 一致：优先取 data 层；data.code!=0 视为业务错误
  if (data && typeof data === 'object' && data.code) {
    console.error(`[ERROR] Lovart 业务错误 code=${data.code}: ${data.message || '未知'}`);
    process.exit(1);
  }
  const payload = (data && typeof data === 'object' && 'data' in data) ? data.data : data;

  console.log(`=== Lovart 任务${label} ===`);
  console.log(JSON.stringify(payload, null, 2));
  const status = payload && payload.status;
  if (status) console.log(`\n状态: ${status}`);
  // 结果里可能带 artifacts（图片/视频/文本），status 结束时可额外提示
  const items = payload && payload.items;
  if (items && Array.isArray(items) && items.length) console.log(`\n含 ${items.length} 个结果项（可查看 artifacts 取 URL）`);
}

// 查任务状态（是否结束）
async function runLovartStatus(threadId) {
  return runLovartQuery(threadId, '/v1/openapi/chat/status', '状态');
}

// 查任务结果（出图 URL / 生成文本）
async function runLovartResult(threadId) {
  return runLovartQuery(threadId, '/v1/openapi/chat/result', '结果');
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

// ── 三层一致性断言：画布快照节点 URL ↔ 任务中心 result_url ↔ 磁盘文件 ──
// 目标：帮 AI 定位"刷新丢图 / 画布与任务中心错位 / 文件缺失"这类 bug 的根因。
// 对每个画布节点的媒体 URL，交叉校验：
//   [A] 画布快照里有该 URL 吗？               （无 → 快照没写回，刷新必丢）
//   [B] 任务中心 tasks 里该 nodeId 有 completed+result_url 吗？（无 → 任务中心断链）
//   [C] 该 URL 对应的磁盘文件存在吗？          （无 → 文件没落盘 / 已删）
// 输出：每个节点三列状态，标出具体断点。
function runConsistencyCheck(db, projectId) {
  const prefix = 'canvas-state-v1-';
  let key = null;
  if (projectId) {
    key = `${prefix}${projectId}`;
    const exists = queryOneLike(db, `SELECT key FROM kv WHERE key = ?`, [key]);
    if (!exists) {
      console.log(`[ABORT] 未找到画布快照: ${key}`);
      console.log('  可用画布快照：');
      listCanvasKeys(db).forEach((k) => console.log(`    ${k}`));
      return;
    }
  } else {
    const row = listCanvasKeys(db, true);
    if (!row) { console.log('(无画布快照)'); return; }
    key = row.key;
    console.log(`(未指定 projectId，取最近更新的画布快照: ${key})\n`);
  }
  const row = queryOneLike(db, `SELECT key, value, updated_at FROM kv WHERE key = ?`, [key]);
  if (!row) { console.log(`(无记录: ${key})`); return; }
  let state = null;
  try { state = JSON.parse(row.value); } catch (e) { console.log(`[ERROR] 画布快照 JSON 解析失败: ${e.message}`); return; }
  const nodes = Array.isArray(state.nodes) ? state.nodes : [];

  console.log(`=== 三层一致性断言（画布 ↔ 任务中心 ↔ 磁盘）===\n`);
  console.log(`项目快照: ${key}`);
  console.log(`节点数: ${nodes.length}\n`);

  // 磁盘根目录：~/maomao-localtool/uploads（与脚本的 DATA_DIR 一致）
  const uploadsRoot = path.join(DATA_DIR, 'uploads');
  const toDiskPath = (url) => {
    // http://127.0.0.1:18080/files/<subfolder>/<name> → ~/.maomao-localtool/uploads/<subfolder>/<name>
    const m = /\/files\/([^?#]+)/.exec(url || '');
    if (!m) return null;
    return path.join(uploadsRoot, decodeURIComponent(m[1]));
  };

  // 收集节点媒体 URL（含 imageUrl / videoUrl / images[] 数组 / poster 等）
  const collectMediaUrls = (n) => {
    const urls = [];
    const d = (n && n.data) || {};
    for (const k of ['imageUrl', 'videoUrl', 'thumbnailUrl', 'poster', 'url']) {
      if (typeof d[k] === 'string' && d[k]) urls.push({ field: k, url: d[k] });
    }
    if (Array.isArray(d.images)) {
      for (const it of d.images) {
        const u = typeof it === 'string' ? it : (it && it.url);
        if (typeof u === 'string' && u) urls.push({ field: 'images[]', url: u });
      }
    }
    return urls;
  };

  let okCount = 0, issueCount = 0, orphanCount = 0;
  for (const n of nodes) {
    const nodeId = n && n.id;
    const type = (n && n.type) || '(无type)';
    const urls = collectMediaUrls(n);
    if (!urls.length) continue; // 无媒体的节点跳过

    // [B] 任务中心：该 nodeId 最近的 completed + result_url
    const taskRow = queryOneLike(db,
      `SELECT task_id, status, result_url, created_at FROM tasks WHERE node_id = ? AND status = 'completed' AND result_url IS NOT NULL AND result_url <> '' ORDER BY created_at DESC LIMIT 1`,
      [nodeId]);

    console.log(`\n■ ${type} ${nodeId}`);
    for (const { field, url } of urls) {
      const isLocal = /\/files\//.test(url);
      const diskPath = toDiskPath(url);
      const diskExists = diskPath ? fs.existsSync(diskPath) : null;
      const taskMatches = taskRow && taskRow.result_url === url;
      const hasTaskUrl = !!(taskRow && taskRow.result_url);

      // [A] 画布快照里有该 URL（这里本身就是，恒 true；真正要断的是"是否落本地"）
      let a = isLocal ? '本地URL' : (url.startsWith('data:') ? 'base64内联' : (url.startsWith('blob:') ? 'blob临时⚠️' : '远程/其他'));
      let b = hasTaskUrl ? (taskMatches ? `任务中心一致✓` : `任务中心另有URL⚠️`) : `任务中心无记录✗`;
      let c = diskExists === null ? '非本地(不查磁盘)' : (diskExists ? '磁盘存在✓' : '磁盘缺失✗');

      const problematic = !isLocal || url.startsWith('blob:') || (diskExists === false) || (hasTaskUrl && !taskMatches);
      if (problematic) { issueCount++; if (!hasTaskUrl && !url.startsWith('data:')) orphanCount++; }
      else okCount++;

      console.log(`  [${field}] ${String(url).slice(0, 90)}`);
      console.log(`      A=${a} | B=${b} | C=${c}${problematic ? '  ⚠️' : ''}`);
    }
  }

  console.log(`\n=== 一致性断言结束 ==="`);
  console.log(`正常节点: ${okCount} 处 | 异常: ${issueCount} 处 | 画布有但任务中心无: ${orphanCount} 处`);
  console.log(`提示: A=blob临时 → 刷新会失效; B=无记录/不一致 → 任务中心与画布错位; C=磁盘缺失 → 文件未落盘或已删。`);
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

// ── 画布数据结构体检：对齐「AI 排查画布问题」的第一步 ──
// 输出：节点/边统计 + 无 id 边 + 重复 id 边 + 悬空边（source/target 指向不存在的节点）。
// 目的：用户报画布任何问题（节点/边/布局/保存），AI 先跑本命令拿当前真实快照，再回应，
// 避免「各说各话」。UI 视觉类查不到，需结合日志/截图（见 CLAUDE.md 排查铁律）。
function runCanvasHealth(db, projectId) {
  // 1) 找目标快照 key：给定 projectId → canvas-state-v1-<projId>；缺省 → 最近更新的 canvas 快照
  const prefix = 'canvas-state-v1-';
  let key = null;
  if (projectId) {
    key = `${prefix}${projectId}`;
    const exists = queryOneLike(db, `SELECT key FROM kv WHERE key = ?`, [key]);
    if (!exists) {
      console.log(`[ABORT] 未找到画布快照: ${key}`);
      console.log('  可用项目（--tables 里 kv 键含 canvas-state-v1- 前缀）：');
      listCanvasKeys(db).forEach((k) => console.log(`    ${k}`));
      return;
    }
  } else {
    const row = listCanvasKeys(db, true); // 最近更新的一条
    if (!row) {
      console.log('(无画布快照，画布为空)');
      return;
    }
    key = row.key;
    console.log(`(未指定 projectId，取最近更新的画布快照: ${key})\n`);
  }

  const row = queryOneLike(db, `SELECT key, value, updated_at FROM kv WHERE key = ?`, [key]);
  if (!row) {
    console.log(`(无记录: ${key})`);
    return;
  }
  // updated_at 是 SQLite unixepoch()（秒级），需 ×1000 转毫秒（区别于 tasks.created_at 的毫秒级）
  const ts = row.updated_at ? new Date(Number(row.updated_at) * 1000).toISOString() : '?';
  let state = null;
  try {
    state = JSON.parse(row.value);
  } catch (e) {
    console.log(`[ERROR] 画布快照 JSON 解析失败: ${e.message}`);
    return;
  }
  const nodes = Array.isArray(state.nodes) ? state.nodes : [];
  const edges = Array.isArray(state.edges) ? state.edges : [];

  console.log(`=== 画布数据结构体检 ===`);
  console.log(`项目快照: ${key}`);
  console.log(`保存时间: ${ts}`);
  console.log(`节点数: ${nodes.length} | 边数: ${edges.length}\n`);

  // 2) 节点类型分布 + 节点 id 唯一性
  const nodeIds = new Set();
  const dupNodeIds = [];
  const typeCount = {};
  for (const n of nodes) {
    const id = n && n.id;
    if (typeof id === 'string') {
      if (nodeIds.has(id)) dupNodeIds.push(id);
      nodeIds.add(id);
    }
    const t = (n && n.type) || '(无type)';
    typeCount[t] = (typeCount[t] || 0) + 1;
  }
  console.log('节点类型分布:');
  for (const [t, c] of Object.entries(typeCount)) console.log(`  ${t}: ${c}`);

  // 3) 边体检：无 id / 重复 id / 悬空边
  const noIdEdges = [];
  const dupEdgeIds = [];
  const edgeIdSeen = new Set();
  const danglingEdges = [];
  const missingIdCount = 0;
  for (const e of edges) {
    const id = e && e.id;
    if (typeof id !== 'string' || !id) {
      noIdEdges.push(e);
      continue;
    }
    if (edgeIdSeen.has(id)) dupEdgeIds.push(id);
    edgeIdSeen.add(id);
    const s = e.source, t = e.target;
    if ((typeof s !== 'string' || !nodeIds.has(s)) || (typeof t !== 'string' || !nodeIds.has(t))) {
      danglingEdges.push({ id, source: s, target: t });
    }
  }

  console.log('\n边体检:');
  if (!noIdEdges.length && !dupEdgeIds.length && !danglingEdges.length) {
    console.log('  ✓ 无问题（全部边都有唯一 id 且两端节点存在）');
  } else {
    if (noIdEdges.length) {
      console.log(`  ✗ 无 id 边: ${noIdEdges.length} 条（EdgeRenderer 会用 undefined 作 key → 重复 key 警告）`);
      for (const e of noIdEdges.slice(0, 10)) console.log(`      ${e.source || '?'} → ${e.target || '?'}`);
    }
    if (dupEdgeIds.length) {
      console.log(`  ✗ 重复 id 边: ${dupEdgeIds.length} 条`);
      for (const id of [...new Set(dupEdgeIds)].slice(0, 10)) console.log(`      ${id}`);
    }
    if (danglingEdges.length) {
      console.log(`  ✗ 悬空边（source/target 指向不存在节点）: ${danglingEdges.length} 条`);
      for (const e of danglingEdges.slice(0, 10)) console.log(`      ${e.id}: ${e.source} → ${e.target}`);
    }
  }

  console.log('\n=== 体检结束。若发现无 id/重复/悬空边，即为数据结构问题；UI 视觉类问题请结合截图/日志排查。 ===');
}

// 列出所有 canvas 快照 key（可排除 _version 后缀）；onlyLatest 时返回 updated_at 最大的一条
function listCanvasKeys(db, onlyLatest = false) {
  const prefix = 'canvas-state-v1-';
  const rows = queryAllLike(db,
    `SELECT key, updated_at FROM kv WHERE key LIKE ? AND key NOT LIKE '%_version'`,
    [`${prefix}%`]);
  rows.sort((a, b) => Number(a.updated_at) - Number(b.updated_at));
  if (onlyLatest) return rows.length ? rows[rows.length - 1] : null;
  return rows.map((r) => r.key);
}

// ── 完整生命周期：一键查一个任务的「数据库记录 + 后端日志 + 前端日志」全链路 ──
// 输入可以是：
//   - task_id    （如 task_msu70t3m_hug53）
//   - thread_id  （Lovart 上游真实 ID，即 task_id 去掉 task_ 前缀，如 msu70t3m_hug53）—— 网关日志的
//                 [poll]/[confirm] 行用 thread=xxx 记录，此模式能把「室外 ID（上游 thread_id）」与本地
//                 task 记录、全链路日志关联起来，是打通全链路日志的核心查询键。
//   - node_id    （如 textNode-xxx）—— 列出该节点所有任务。
// 自动判定：不以 task_/task- 开头且「task_+id」在 tasks 表命中 → 按 thread_id（转 task_id）查；
//           否则按 node_id 查任务列表。
// 前端日志已由 logger.js 上报 localTool POST /api/logs，落盘带 [frontend] 前缀（localTool/src/routes/logs.ts）。
function runLifecycle(db, id) {
  const isTask = /^task[_-]/.test(id);
  const taskId = isTask ? id : 'task_' + id; // thread_id → task_id（全链路日志里两种格式都会出现）
  let mode = isTask ? 'task_id' : 'thread_id';
  // 标题的 mode 需在判定后输出，但判定依赖 rows；先占位，query 后回填 mode 再打印
  console.log(`=== 任务完整生命周期查询: ${id} ===\n`);

  // 1) 数据库记录
  let rows;
  if (isTask) {
    rows = queryAllLike(db, `SELECT * FROM tasks WHERE task_id = ?`, [id]);
  } else {
    // 先按 thread_id 转 task_id 精确查（室外 ID 直达）；未命中再按 node_id 查任务列表
    rows = queryAllLike(db, `SELECT * FROM tasks WHERE task_id = ?`, [taskId]);
    if (!rows.length) {
      rows = queryAllLike(db, `SELECT task_id, node_id, status, progress, model_name, custom_output_type, created_at, result_url, error_msg FROM tasks WHERE node_id = ? ORDER BY created_at DESC`, [id]);
      mode = rows.length ? 'node_id' : 'thread_id';
    }
  }

  console.log(`(按 ${mode} 查询)`);

  if (rows.length) {
    if (mode === 'node_id') {
      console.log(`[数据库] node ${id} 共 ${rows.length} 条任务（按创建时间倒序）:`);
      console.log('  task_id | status | progress | model | type | created_at | 结果形态 | error');
      for (const r of rows) {
        const url = r.result_url || '';
        const form = url.startsWith('data:') ? 'base64' : /127\.0\.0\.1:18080\/files/.test(url) ? '本地文件' : /^https?:\/\//.test(url) ? '远程URL⚠️' : url ? '其他' : '(无)';
        const err = (r.error_msg || r.error_message || '').toString().slice(0, 40);
        console.log(`  ${r.task_id} | ${r.status} | ${r.progress} | ${r.model_name} | ${r.custom_output_type || '-'} | ${r.created_at} | ${form} | ${err}`);
      }
    } else {
      console.log('[数据库] tasks 完整记录（含全部诊断字段）:');
      for (const [k, v] of Object.entries(rows[0])) {
        let s = v === null || v === undefined ? 'NULL' : (typeof v === 'string' ? v : JSON.stringify(v));
        if (s.length > 500) s = s.slice(0, 500) + `…(+${s.length - 500})`;
        console.log(`  ${k}: ${s}`);
      }
    }
  } else {
    console.log(mode === 'node_id' ? '[数据库] 该 node 无任务记录' : '[数据库] 该 task_id/thread_id 无记录');
  }

  // 1.5) 诊断推算（仅单任务模式）：用 submit_ack_at 埋点反推「前端→网关确认」耗时
  // 注：completed_at / poll_count 需前端埋点（当前未启用），故仅展示已落库的 submit_ack_at。
  if (mode !== 'node_id' && rows.length) {
    const r = rows[0];
    const created = r.created_at, ack = r.submit_ack_at;
    console.log(`\n[诊断] 网关确认耗时（锚点B埋点 submit_ack_at）:`);
    const fmt = (ms) => ms == null ? 'NULL（前端未落到网关/旧任务）' : `${(ms / 1000).toFixed(1)}s`;
    const localToGateway = ack != null && created != null ? ack - created : null; // 前端→网关确认接单
    console.log(`  前端接单(created_at)→网关确认接单(submit_ack_at): ${fmt(localToGateway)}`);
    if (localToGateway != null && localToGateway > 5000) {
      console.log(`  初步判断: 卡在「前端→网关」段（localTool/代理/VPN 抖？建议查网关日志 thread=${r.thread_id || 'N/A'}）`);
    } else if (localToGateway != null) {
      console.log(`  初步判断: 前端→网关段正常（生图慢/链路卡需 completed_at+poll_count，当前未启用）`);
    } else {
      console.log(`  初步判断: 数据不足（submit_ack_at 为空，非网关异步提交任务或旧任务）`);
    }
  }

  // 2) 日志时间线（后端日志 + 前端上报日志，同文件 localtool_18080.log）
  // 日志里同一任务两种格式都出现：[poll]/[confirm] 用 thread=xxx，[submit]/[submit:parse] 用 task_id=task_xxx。
  // 因此按 id 与 task_+id 双键匹配，确保 thread_id 能贯通 submit→poll 全链路。
  console.log(`\n[日志] 全链路时间线（数据库 + 后端 [backend/服务] + 前端 [frontend]）:`);
  const lines = readLogLines();
  const hit = lines
    .map((l, i) => ({ i: i + 1, l }))
    .filter(x => x.l.includes(id) || x.l.includes(taskId));
  if (!hit.length) {
    console.log('  (日志中无该 task_id/thread_id/node_id 的记录)');
  } else {
    // 标注来源：前端上报行含 [frontend]，其余为后端
    for (const x of hit) {
      const src = x.l.includes('[frontend]') ? '前端' : '后端';
      console.log(`  [${src}] L${x.i}: ${x.l}`);
    }
  }

  console.log(`\n=== 生命周期查询完成。若数据库中 request_data/response_data/result_url 为空，且日志无该任务记录，说明任务数据链路中断（未落库/未落日志）。 ===`);
}

// 兼容 sql.js 的带参查询（queryAllLike 处理 ? 占位）
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

  // 0.15) 直接拿 Lovart 上游 thread_id 查任务状态/结果（不需开库，需联网 + 凭据）
  if (hasArg('--lovart-status') || hasArg('--lovart-result')) {
    const isResult = hasArg('--lovart-result');
    const tid = isResult ? getArg('--lovart-result') : getArg('--lovart-status');
    if (!tid) {
      console.error(`[ABORT] 缺少 thread_id。用法: --lovart-${isResult ? 'result' : 'status'} <thread_id>`);
      process.exit(1);
    }
    if (isResult) await runLovartResult(tid);
    else await runLovartStatus(tid);
    return;
  }

  const db = await openDb();

  // 0.2) 同节点任务比对
  if (hasArg('--task')) {
    runTaskCompare(db, getArg('--task'));
    db.close();
    return;
  }

  // 0.2.1) 完整生命周期（数据库 + 后端日志 + 前端日志 全链路一键查）
  // 自然语言：直接贴一个 id（task_id / thread_id / node_id）也等价 --lifecycle，AI 不用记前缀。
  const bareId = argv[0] && !argv[0].startsWith('--') ? argv[0] : null;
  if (bareId) {
    runLifecycle(db, bareId);
    db.close();
    return;
  }
  if (hasArg('--lifecycle')) {
    runLifecycle(db, getArg('--lifecycle'));
    db.close();
    return;
  }

  // 0.2.2) 画布数据结构体检（AI 排查画布问题的第一步）
  if (hasArg('--canvas-health')) {
    runCanvasHealth(db, getArg('--canvas-health') || null);
    db.close();
    return;
  }

  // 0.25) 三层一致性断言（画布 ↔ 任务中心 ↔ 磁盘）
  if (hasArg('--consistency')) {
    runConsistencyCheck(db, getArg('--consistency') || null);
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
