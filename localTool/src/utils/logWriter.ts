/**
 * 进程内日志接管：按天轮转 + 自动删除过期日志，零运维不爆盘。
 * -------------------------------------------------------------------
 * 背景：旧方案靠 launch-all.ps1 的 Start-Process -RedirectStandardOutput 把
 * stdout 重定向到单文件 localTool/logs/localtool_18080.log，无轮转、无删旧，
 * 长期运行单文件无限膨胀，需手动清理。
 *
 * 本模块在 localTool 进程内接管 console.log/info/warn/error：
 *   - 按天写文件：logs/localtool_18080_YYYY-MM-DD.log（新一天自动开新文件）
 *   - 启动时自动删除 N 天前的日志文件（默认 7 天，可用 LOG_KEEP_DAYS 覆盖）
 *   - 仍同步 console 输出（启动脚本/前台可见）
 *
 * 因接管发生在进程内，launch-all.ps1 不应再重定向 stdout/err（否则双写单文件）。
 * ⚠️ 改动日志机制时注意：本模块已接管 console → 自动写日志文件，
 *    launch-all.ps1 里 localTool 的 Start-Process 必须【不带】-RedirectStandardOutput/Error，
 *    否则与这里重复写文件。若再新增启动脚本，同样别对 localTool 做 stdout/err 重定向。
 * 日志目录与 task-inspect.mjs 的 LOGS_DIR（localTool/logs）保持一致，查询脚本
 * readLogLines 已读全部 .log，按天轮转天然兼容。
 */
import fs from 'node:fs';
import type { ServerResponse } from 'node:http';
import path from 'node:path';
import { getLogsDir } from '../paths.js';

// localTool/logs（路径真源 paths.ts，与 task-inspect.mjs 的 LOGS_DIR 一致）
const LOGS_DIR = getLogsDir();
const BASE_NAME = 'localtool_18080';

// ── 实时日志广播（SSE）：所有经 write() 的日志行同时推给已连接的前端日志面板 ──
// 维护一个轻量 client 集合（每项为一个 SSE 响应的 ServerResponse）；
// 断连由 routes/logs.ts 的 req 'close' 事件移除，避免内存泄漏。
const _sseClients = new Set<ServerResponse>();

/** 注册一个 SSE 客户端（routes/logs.ts 的 handleLogsStream 调用） */
export function addLogClient(res: ServerResponse): void {
  _sseClients.add(res);
}

/** 移除一个 SSE 客户端（连接关闭时调用） */
export function removeLogClient(res: ServerResponse): void {
  _sseClients.delete(res);
}

/**
 * 广播级别阈值：只有 ≥ 该级别的日志才推给前端 SSE（日志面板 / F12 镜像），
 * 其余（高频 info/log 噪音）只落盘 + 服务端终端，不再刷前端。
 * 可用环境变量 LOG_BROADCAST_LEVEL 覆盖（值：debug < info < log < warn < error，默认 warn）。
 */
function broadcastMinLevel(): number {
  const order: Record<string, number> = { debug: 0, info: 1, log: 1, warn: 2, error: 3 };
  const raw = (process.env['LOG_BROADCAST_LEVEL'] || 'warn').trim().toLowerCase();
  return order[raw] ?? 2;
}

/** 把一行日志广播给所有已连接客户端（失败静默，绝不影响主链路写文件） */
function broadcastLog(line: string, level: string): void {
  if (_sseClients.size === 0) return;
  const order: Record<string, number> = { debug: 0, info: 1, log: 1, warn: 2, error: 3 };
  if ((order[level] ?? 1) < broadcastMinLevel()) return; // 低于阈值：不推前端（仅落盘 + 服务端终端）
  for (const res of _sseClients) {
    try { res.write(`data: ${line}\n\n`); } catch { /* 单客户端写入失败忽略，不影响其他 */ }
  }
}


let _stream: fs.WriteStream | null = null;
let _currentDate = '';
let _inited = false;

/** 取日志保留天数（默认 7），环境变量 LOG_KEEP_DAYS 可覆盖 */
function getKeepDays(): number {
  const v = Number(process.env['LOG_KEEP_DAYS'] || '7');
  return Number.isFinite(v) && v > 0 ? Math.floor(v) : 7;
}

function dateStr(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** 确保今天的日志文件流打开（跨天自动切换新文件） */
function ensureStream(): fs.WriteStream {
  const today = dateStr(new Date());
  if (_stream && _currentDate === today) return _stream;
  // 关闭旧流（若跨天）
  if (_stream) {
    try { _stream.end(); } catch { /* ignore */ }
    _stream = null;
  }
  try { fs.mkdirSync(LOGS_DIR, { recursive: true }); } catch { /* ignore */ }
  const file = path.join(LOGS_DIR, `${BASE_NAME}_${today}.log`);
  _stream = fs.createWriteStream(file, { flags: 'a' });
  _currentDate = today;
  return _stream;
}

/** 删除 N 天前的轮转日志文件（仅删本模块命名的文件，启动时调用） */
function cleanupOldLogs(): void {
  const keepDays = getKeepDays();
  const cutoff = Date.now() - keepDays * 24 * 3600 * 1000;
  try {
    for (const f of fs.readdirSync(LOGS_DIR)) {
      if (!f.startsWith(`${BASE_NAME}_`) || !f.endsWith('.log')) continue;
      const m = f.match(/_(\d{4}-\d{2}-\d{2})\.log$/);
      if (!m) continue;
      const ts = new Date(`${m[1]}T00:00:00`).getTime();
      if (Number.isFinite(ts) && ts < cutoff) {
        try { fs.unlinkSync(path.join(LOGS_DIR, f)); } catch { /* 删除失败不阻断 */ }
      }
    }
  } catch { /* logs 目录不存在则跳过 */ }
}

function write(level: string, args: unknown[]): void {
  const ts = new Date().toISOString();
  const msg = args.map((a) =>
    typeof a === 'string' ? a : (() => { try { return JSON.stringify(a); } catch { return String(a); } })()
  ).join(' ');
  const line = `${ts} [${level}] ${msg}\n`;
  try { ensureStream().write(line); } catch { /* 日志写失败不阻断业务 */ }
  // 实时广播给前端日志面板（SSE）；低于阈值的噪音不推前端（仅落盘 + 服务端终端）。
  // client 为空时 broadcastLog 内部直接返回，零开销。
  broadcastLog(line, level);
  // 同步到原始 console（前台/启动脚本可见）
  const orig = (console as unknown as Record<string, (...a: unknown[]) => void>)[`_orig_${level}`] || console[level as 'log'];
  try { orig.call(console, ...args); } catch { /* ignore */ }
}

/**
 * 初始化日志接管。重复调用幂等（仅首次生效）。
 * 需在服务启动早期调用，以捕获后续所有 console 输出。
 */
export function initLogWriter(): void {
  if (_inited) return;
  _inited = true;

  // 先清理过期日志，再接管 console
  cleanupOldLogs();

  const methods: Array<'log' | 'info' | 'warn' | 'error'> = ['log', 'info', 'warn', 'error'];
  for (const m of methods) {
    const orig = console[m].bind(console);
    (console as unknown as Record<string, unknown>)[`_orig_${m}`] = orig;
    console[m] = ((...args: unknown[]) => write(m, args)) as typeof console.log;
  }
  console.log(`[logWriter] 日志接管：${LOGS_DIR}/${BASE_NAME}_YYYY-MM-DD.log（保留 ${getKeepDays()} 天，自动轮转+清理）`);
}
