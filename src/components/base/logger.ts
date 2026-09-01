/**
 * 前端日志（排查用，不建 UI）。
 *
 * 统一输出格式，方便控制台过滤/后端排查：
 *   [log] 14:23:45 | 生成 | success | {nodeId, type}
 *
 * level 对齐 console 方法：info / warn / error。
 * 已接真系统：console 输出 + fire-and-forget 上报 localTool POST /api/logs
 * （localTool 打 [frontend] 前缀落盘 localtool_18080.log，与后端日志同文件，全链路 grep）。
 *
 * ─────────────────────────────────────────────
 * 【重要】只记录「高价值、不可还原」的日志：
 *   ✔ 生成 start/success/fail（含 nodeId/type/prompt/结果 url）——排查丢图/失败
 *   ✔ 错误/异常（error level）——排查崩溃/接口报错
 *   ✔ 项目 切换/新建/删除 ——数据迁移/隔离相关
 *
 * 不要记录结构操作（建节点/删节点/连线/删线/改属性）——
 * 这些可从画布快照 nodes/edges + 历史栈 undo/redo 完整还原，
 * 记了只会产生大量噪音、淹没真正有价值的日志。不要加这类埋点。
 * ─────────────────────────────────────────────
 */

import { formatTime } from './utils.ts'
import { isDebugModuleOn, API_BASE } from './config.ts'

/** 日志级别（对齐 console 方法） */
export type LogLevel = 'info' | 'warn' | 'error'
/** debug 模块开关（config.js DEBUG_MODULES 位） */
export interface DebugOpts { module?: string }

function stringify(detail: unknown): string {
  if (detail == null) return ''
  if (typeof detail === 'string') return detail
  try {
    return JSON.stringify(detail)
  } catch {
    return String(detail)
  }
}

// 上报去重：同一 (category+action) 在极短时间内的批量上报合并，避免高频噪音刷爆日志文件。
const _lastReport: { key: string; ts: number } = { key: '', ts: 0 }
const REPORT_MIN_GAP = 200 // ms

// fire-and-forget 上报到 localTool（POST /api/logs）。失败静默、不阻塞主链路。
function reportToBackend(p: { category: string; action: string; detail: unknown; level: string; taskId?: string; nodeId?: string }): void {
  const { category, action, detail, level, taskId, nodeId } = p
  const now = Date.now()
  const key = `${category}:${action}:${stringify(detail)}`
  if (key === _lastReport.key && now - _lastReport.ts < REPORT_MIN_GAP) return
  _lastReport.key = key
  _lastReport.ts = now
  try {
    fetch(`${API_BASE}/api/logs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        timestamp: new Date().toISOString(),
        level,
        category,
        action,
        detail,
        taskId: taskId || '',
        nodeId: nodeId || ''
      }),
      keepalive: true
    }).catch(() => {}) // fire-and-forget：日志上报失败静默；本文件内禁止调 logger 自身（会递归）
  } catch {
    /* 静默 */
  }
}

/**
 * 记录一条操作日志。
 * 同时：console 输出 + fire-and-forget 上报 localTool（POST /api/logs → [frontend] 落盘）。
 * 这样后端/AI 能 grep 数据库 + 后端日志 + 前端日志 全链路查一个任务的完整生命周期。
 * @param category 分类（建节点/删节点/连线/生成/项目…）
 * @param action 动作（如 'create'）
 * @param detail 详情（可 JSON 序列化）
 * @param level 级别
 */
export function log(category: string, action: string, detail?: unknown, level: LogLevel = 'info'): void {
  const levelTag = level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'info'
  // 从 detail 中提取 taskId / nodeId，便于按任务/节点全链路 grep（对齐后端 logs.ts 落盘 tag）
  // detail 为 unknown 已收窄成 object，读取其可能存在的字段需按 Record 窄化
  let taskId = ''
  let nodeId = ''
  if (detail && typeof detail === 'object') {
    const dv = detail as Record<string, unknown>
    if (typeof dv.taskId === 'string') taskId = dv.taskId
    if (typeof dv.task_id === 'string') taskId = dv.task_id
    if (typeof dv.nodeId === 'string') nodeId = dv.nodeId
    if (typeof dv.node_id === 'string') nodeId = dv.node_id
  }
  const tags = [taskId ? `#taskId=${taskId}` : '', nodeId ? `#nodeId=${nodeId}` : ''].filter(Boolean).join(' ')
  const msg = `[${levelTag}] ${formatTime(undefined, { mode: 'time' })} | ${category} | ${action}${detail != null ? ` | ${stringify(detail)}` : ''}${tags ? ` | ${tags}` : ''}`
  if (level === 'error') console.error(msg)
  else if (level === 'warn') console.warn(msg)
  else console.log(msg)

  reportToBackend({ category, action, detail, level, taskId, nodeId })
}

export const logger: {
  log: typeof log
  info: (category: string, action: string, detail?: unknown) => void
  warn: (category: string, action: string, detail?: unknown) => void
  error: (category: string, action: string, detail?: unknown) => void
  debug: (category: string, action: string, detail?: unknown, opts?: DebugOpts) => void
} = {
  log,
  info: (category, action, detail) => log(category, action, detail, 'info'),
  warn: (category, action, detail) => log(category, action, detail, 'warn'),
  error: (category, action, detail) => log(category, action, detail, 'error'),
  /**
   * debug 级别：仅当指定模块位（logger.debug 第 4 参 { module }）开启时 console 输出，且不上报后端
   * （属排查噪音，不污染日志文件）。模块位集中 config.js 的 DEBUG_MODULES，默认全部安静。
   * 用法：logger.debug('AI助手', '动作', { detail }, { module: 'agent' })
   *      logger.debug('assetStore', '[SEND] 进入', { ... }, { module: 'asset' })  // 等价旧 DEBUG_ASSET
   */
  debug: (category, action, detail, opts) => {
    const module = opts && opts.module
    if (!isDebugModuleOn(module)) return
    const msg = `[debug] ${formatTime(undefined, { mode: 'time' })} | ${category} | ${action}${detail != null ? ` | ${stringify(detail)}` : ''}`
    console.log(msg)
  }
}
