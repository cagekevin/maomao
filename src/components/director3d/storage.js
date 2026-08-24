// 统一 localStorage 持久化封装（director3d）。
// 目的：把「读取 / 写入 / 删除 + 失败处理」收敛为一处，供 project.js 与 App.jsx 复用，
//   避免各调用点散写 localStorage.* 且失败被静默吞掉。
// 失败可见：读写/删除失败统一走 log.error 记录（本项目统一日志层），调用方仍按各自语义兜底。
import { log } from './log.js'

/**
 * 读取并 JSON 解析。key 不存在 / 解析失败均返回 fallback（默认 null）。
 * 解析失败（脏数据）会记录日志。
 */
export function readJson(key, fallback = null) {
  try {
    const raw = localStorage.getItem(key)
    if (raw == null) return fallback
    return JSON.parse(raw)
  } catch (error) {
    log.error('localStorage 读取/解析失败', { key }, error)
    return fallback
  }
}

/**
 * JSON 序列化并写入。成功返回 true，失败记录日志并返回 false。
 */
export function writeJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
    return true
  } catch (error) {
    log.error('localStorage 写入失败', { key }, error)
    return false
  }
}

/**
 * 删除指定 key。成功返回 true，失败记录日志并返回 false。
 */
export function removeKey(key) {
  try {
    localStorage.removeItem(key)
    return true
  } catch (error) {
    log.error('localStorage 删除失败', { key }, error)
    return false
  }
}