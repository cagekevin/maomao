/**
 * 前端日志（排查用，不建 UI）。
 *
 * 统一输出格式，方便控制台过滤/后端排查：
 *   [log] 14:23:45 | 生成 | success | {nodeId, type}
 *
 * level 对齐 console 方法：info / warn / error。
 * 接真系统：把 console 换成上报 /api/logs（或 postMessage 给 localTool），格式不变。
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

/**
 * 记录一条操作日志。
 * @param {string} category 分类（建节点/删节点/连线/生成/项目…）
 * @param {string} action   动作（如 'create'）
 * @param {*}      detail   详情（可 JSON 序列化）
 * @param {'info'|'warn'|'error'} level
 */
export function log(category, action, detail, level = 'info') {
  const msg = `[log] ${fmtTime()} | ${category} | ${action}${detail != null ? ` | ${stringify(detail)}` : ''}`
  if (level === 'error') console.error(msg)
  else if (level === 'warn') console.warn(msg)
  else console.log(msg)
}

export const logger = {
  log,
  info: (cat, act, det) => log(cat, act, det, 'info'),
  warn: (cat, act, det) => log(cat, act, det, 'warn'),
  error: (cat, act, det) => log(cat, act, det, 'error')
}
