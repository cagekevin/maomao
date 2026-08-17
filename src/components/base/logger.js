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

function fmtTime() {
  const d = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

function stringify(detail) {
  if (detail == null) return ''
  if (typeof detail === 'string') return detail
  try {
    return JSON.stringify(detail)
  } catch {
    return String(detail)
  }
}

import { API_BASE } from './apiBase.js'

// 上报去重：同一 (category+action) 在极短时间内的批量上报合并，避免高频噪音刷爆日志文件。
const _lastReport = { key: '', ts: 0 }
const REPORT_MIN_GAP = 200 // ms

// fire-and-forget 上报到 localTool（POST /api/logs）。失败静默、不阻塞主链路。
function reportToBackend({ category, action, detail, level, taskId, nodeId }) {
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
    }).catch(() => {})
  } catch {
    /* 静默 */
  }
}

/**
 * 记录一条操作日志。
 * 同时：console 输出 + fire-and-forget 上报 localTool（POST /api/logs → [frontend] 落盘）。
 * 这样后端/AI 能 grep 数据库 + 后端日志 + 前端日志 全链路查一个任务的完整生命周期。
 * @param {string} category 分类（建节点/删节点/连线/生成/项目…）
 * @param {string} action   动作（如 'create'）
 * @param {*}      detail   详情（可 JSON 序列化）
 * @param {'info'|'warn'|'error'} level
 */
export function log(category, action, detail, level = 'info') {
  const levelTag = level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'info'
  const msg = `[${levelTag}] ${fmtTime()} | ${category} | ${action}${detail != null ? ` | ${stringify(detail)}` : ''}`
  if (level === 'error') console.error(msg)
  else if (level === 'warn') console.warn(msg)
  else console.log(msg)

  // 从 detail 中提取 taskId / nodeId，便于按任务/节点全链路 grep
  let taskId = ''
  let nodeId = ''
  if (detail && typeof detail === 'object') {
    if (typeof detail.taskId === 'string') taskId = detail.taskId
    if (typeof detail.task_id === 'string') taskId = detail.task_id
    if (typeof detail.nodeId === 'string') nodeId = detail.nodeId
    if (typeof detail.node_id === 'string') nodeId = detail.node_id
  }
  reportToBackend({ category, action, detail, level, taskId, nodeId })
}

export const logger = {
  log,
  info: (cat, act, det) => log(cat, act, det, 'info'),
  warn: (cat, act, det) => log(cat, act, det, 'warn'),
  error: (cat, act, det) => log(cat, act, det, 'error')
}
