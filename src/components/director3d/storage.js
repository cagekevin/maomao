// 统一 localStorage 持久化封装（director3d）。
// 目的：把「读取 / 写入 / 删除 + 失败处理」收敛为一处，供 project.js 与 App.jsx 复用，
//   避免各调用点散写 localStorage.* 且失败被静默吞掉。
// 失败可见：读写/删除失败统一走 log.error 记录（本项目统一日志层），调用方仍按各自语义兜底。
//
// docs/45 收口：从纯 localStorage 升级为「localTool KV + localStorage 降级」双通道。
//   - 工程键（director3d-project / director3d-project-<nodeId>）→ 委托 base/d3dPersistence.writeProject
//     （内部：base64 先落盘 director3d 目录 → 写 KV；18080 不可达降级直写 localStorage）。
//     业务侧调用点签名不变（writeJson 仍同步返回，写是异步 fire-and-forget，内存态为权威）。
//   - 姿势库键（director3d-custom-poses）→ 仍只走同步 localStorage（量小频繁，不进 KV，避免无关键污染）。
// 读取仍同步（localStorage 种子），KV 覆盖交给 App 挂载后的 hydrateProject（读异步化见 App.jsx）。
import { log } from './log.js'
import * as d3dPersistence from '../base/d3dPersistence.ts'

/**
 * 读取并 JSON 解析。key 不存在 / 解析失败均返回 fallback（默认 null）。
 * 解析失败（脏数据）会记录日志。保留同步读取：作为启动种子（localStorage 降级值），
 * KV 权威覆盖由 App 挂载后的 hydrateProject 异步完成。
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
 * JSON 序列化并写入。
 * - 姿势库等非工程键：同步写 localStorage（原行为）。
 * - 工程键：委托 d3dPersistence.writeProject（异步 fire-and-forget），
 *   乐观返回 true（内存态为权威），写失败不阻塞编辑，由 writeProject 内部降级 + 日志暴露。
 * 返回 true/false 仅作「已受理 / 未受理」信号，不再代表「已落盘到浏览器」。
 */
export function writeJson(key, value) {
  if (!d3dPersistence.isProjectPersistenceKey(key)) {
    // 非工程键（如 director3d-custom-poses）保持同步 localStorage
    try {
      localStorage.setItem(key, JSON.stringify(value))
      return true
    } catch (error) {
      log.error('localStorage 写入失败', { key }, error)
      return false
    }
  }
  // 工程键：引擎/KV 收口，异步落盘（失败内部降级 localStorage 或记录错误，不在此抛）
  d3dPersistence.writeProject(key, value).catch(error => {
    log.error('director3d 工程写 KV 失败', { key }, error)
  })
  return true
}

/**
 * 删除指定 key。成功返回 true，失败记录日志并返回 false。
 * 仍只清 localStorage（旧版迁移清理用）；KV 侧不留显式 delete（同 key 覆盖写即幂等）。
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