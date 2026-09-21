/**
 * logDebug — 本地工具侧的 **debug 开关**（与前端 `logger.debug` 同构；默认全关、安静）。
 *
 * 【为什么需要它（2026-09-21）】此前 localTool **没有任何 debug 通道**：
 *   前端的约定是「模块位开启才 console 输出，且**不上报后端**（属排查噪音，**不污染日志文件**）」
 *   （`base/core/log/logger.ts:135` + `docs/调试日志总览.md` §一），而 `logWriter.initLogWriter`
 *   只接管 `['log','info','warn','error']` ⇒ 在 localTool 里写 Node 原生 `console.debug` 会落进**黑洞**：
 *   不落盘、不进日志面板、也不受任何开关控制（实测：补丁掉 `console.log` 后 `console.debug`
 *   仍走原生实现，不经补丁）。于是「后端也想留一条默认安静、需要时能查」这件事**没有实现路径**，
 *   只能二选一：warn（落盘+上屏=常态刷屏）或 info（落盘但永久留在文件里）。
 *
 * 【同一套语义，不另造第二个开关】命名与判定逐条对齐前端 `config.ts` 的 `isDebugModuleOn`：
 *   · 模块位登记表 `LOG_DEBUG_MODULES`（对应前端 `DEBUG_MODULES`）——**新增模块只在此登记**；
 *   · 总开关 `LOG_DEBUG_ALL=1`（对应 `VITE_DEBUG_ALL`）⇒ 全开（含未登记模块，同前端判定顺序）；
 *   · 单模块 `LOG_DEBUG_<MODULE>=1`（对应 `VITE_DEBUG_<MODULE>`）；
 *   · 未登记模块一律 false（登记表就是闸，禁止散起第二个开关）；
 *   · **实时读 env、不做顶层缓存**（同前端 `isDebugModuleOn` 的"实时读"约定，避免两份心智模型）。
 *
 * 【为什么输出走 `console.log` 而不是 `console.debug`（本模块存在的技术理由）】
 *   `console.log` 被 `logWriter` 接管 ⇒ **落盘**（`localtool_18080_*.log`，可 grep、可对账），
 *   而"是否推给前端日志面板"仍由既有 `LOG_BROADCAST_LEVEL`（默认 warn）决定 ⇒ 开了开关也不会刷屏
 *   （level=log → 1 < warn → 不广播）。即：**留账与惊动是两件事，分别由本开关与广播阈值管**。
 *   ⚠️ 不要改回 `console.debug`（见上：那是黑洞，开了开关也看不见）。
 *
 * 【用法】`logDebug('task', 'upsertTask:client-redundant', { task_id, cols })`
 *   —— 只在「这条记录对排查有用」时才用；铁律同前端：**只记录高价值、不可还原的**，
 *   常态噪音不进本档（否则等于把日志文件换个人污染）。
 */

import { logTs } from './relayHeaders.js';

/**
 * 后端 debug 模块位登记表（对应前端 `config.ts::DEBUG_MODULES`）。
 * **新增模块只在此登记一行**；禁止为某个模块单开一个环境变量以外的散开关。
 */
export const LOG_DEBUG_MODULES: readonly string[] = ['task'];

/** env 开关判定：只认字面 '1'（与前端 `VITE_DEBUG_*==='1'` 同口径，避免 'true'/'yes' 三套写法） */
function envFlag(name: string): boolean {
  return (process.env[name] || '').trim() === '1';
}

/**
 * 某模块位是否开启（**实时读 env，无缓存**）。
 * 判定顺序与前端一致：总开关 → 模块位登记 → 单模块 env。
 */
export function isLogDebugOn(module?: string): boolean {
  if (envFlag('LOG_DEBUG_ALL')) return true;
  if (!module) return false;
  if (!LOG_DEBUG_MODULES.includes(module)) return false;
  return envFlag(`LOG_DEBUG_${module.toUpperCase()}`);
}

/** detail 序列化：日志**绝不允许**因不可序列化对象（循环引用/BigInt）而抛断主链路 */
function safeJson(detail: unknown): string {
  try {
    return JSON.stringify(detail) ?? String(detail);
  } catch {
    return String(detail);
  }
}

/**
 * 输出一条 debug。关闭时**零开销**（先判开关，连字符串都不拼）。
 * 行格式与前端 `logger.debug` 对齐，便于同一把 grep 同时捞出前后端：
 *   `[debug] HH:mm:ss | <module> | <action> | <detail json>`
 */
export function logDebug(module: string, action: string, detail?: unknown): void {
  if (!isLogDebugOn(module)) return;
  const time = logTs().slice(11); // 'YYYY-MM-DD HH:mm:ss' → 'HH:mm:ss'
  const tail = detail === undefined ? '' : ` | ${safeJson(detail)}`;
  // 经 console.log（被 logWriter 接管 → 落盘；面板可见性由 LOG_BROADCAST_LEVEL 决定）
  console.log(`[debug] ${time} | ${module} | ${action}${tail}`);
}
