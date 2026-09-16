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
//
// ── 更新(2026-09-16 · M7 裸写收口 · TD-02-36/38/39) ──
// 「非工程键直接**裸**写 localStorage」这一支**已收口**：改委托 contentStore，键在 contracts.ts
// 登记为 backend:'local'（⇒ 自动进 getLocalKeys() 派生的备份清单，不再漏备）。
// 原文「量小频繁，不进 KV」的**结论仍成立**（确实仍不进 KV），但它当时被实现成「绕过唯一入口直写裸键」——
// 那是把"不进 KV"误当"不登记、不过入口"：绕过入口 ⇒ 备份/监控/失败上报对该数据流全部失效。
// 物理键随之变为 `yimao:director3d-custom-poses`（storageAdapter 统一加前缀）→ 读取内含**一次性迁移读**。
// ── 更新(2026-09-16 二轮 · TD-02-42 结清) ──
// 工程键的「启动同步种子」原读**裸键**（`localStorage.getItem(key)`）—— 而工程键自 TD-7 方案A 起
// 由 contentStore 双通道托管（`fallback:true` ⇒ 镜像**保留**在 `yimao:` 前缀下）⇒ 该读**恒空**（新用户）
// 或读到 pre-TD-7 的**陈旧**工程（老用户）。现改读 `contentGetLocalMirror`（本地镜像原语）；
// 旧 `stageframe-project` 迁移读改走 `readLegacyRawKey`（历史裸键原语）。
// ⇒ 本文件**零裸 localStorage 访问**（`check:arch` 规则 11 的适配层豁免不再被需要）。
import { log } from './log.ts';
import * as d3dPersistence from './d3dPersistence.ts';
import type { D3dProject } from './d3dPersistence.ts';
// 【2026-09-16 收口】非工程键改走横切存储唯一入口（contentStore），不再裸写 localStorage。
import { contentGet, contentGetLocalMirror, contentSet } from '../base/core/contentStore.ts';
import { readLegacyRawKey, removeLegacyRawKey } from '../base/storage/index.ts';
import { KEY_DIRECTOR3D_CUSTOM_POSES } from '../base/core/contracts.ts';

/**
 * 一次性迁移读：旧**裸**键（`director3d-custom-poses`，无 `yimao:` 前缀）→ contentStore 新键。
 *
 * 【幂等】新键已有值（含"已判空并缓存"）即直接返回 → 不会重复迁移、不会覆盖新值。
 * 【不丢数据】第一步**迁移写成功**才删旧键；写失败保留旧键，下次读再试（宁慢勿丢）。
 */
function migrateLegacyPoseKeyOnce(key: string): void {
  if (key !== KEY_DIRECTOR3D_CUSTOM_POSES) return;
  if (contentGet(key) !== undefined) return; // 新键有值 → 无需迁移
  const legacy = readLegacyRawKey(key);
  if (legacy.status === 'missing') return; // 无存量（新用户）
  if (legacy.status === 'corrupt') {
    // 旧键不是合法 JSON：新版读不出、也无从迁移。**不静默** —— 否则用户只会看到"姿势库空了"。
    log.error('姿势库旧键内容损坏，已跳过迁移（旧键保留原样）', {
      key,
      rawLength: legacy.raw.length,
    });
    return;
  }
  try {
    contentSet(key, legacy.value);
  } catch (error) {
    log.error('姿势库旧键迁移写失败（保留旧键，下次重试）', { key }, error);
    return;
  }
  if (!removeLegacyRawKey(key)) {
    // 旧键没删掉不影响正确性（读侧只看新键；幂等分支下次直接返回），留痕以便排查
    log.error('姿势库旧键迁移后清理失败', { key });
  }
}

/**
 * 读取并 JSON 解析。key 不存在 / 解析失败均返回 fallback（默认 null）。
 * - **非工程键**（姿势库）：经 contentStore 读（唯一入口，带一次性迁移读）。
 * - **工程键**：读 **contentStore 本地镜像**（同步种子，供首帧渲染）—— 见文件头二轮更新。
 */
export function readJson(key: string, fallback: unknown = null) {
  if (d3dPersistence.isProjectPersistenceKey(key)) {
    // 工程键：读**本地镜像**（双通道降级副本，物理位置带 `yimao:` 前缀），不是 KV 真值 ——
    // KV 权威由 App 挂载后的 hydrateProject/contentGetKvWithFallback 覆盖。
    return contentGetLocalMirror(key) ?? fallback;
  }
  migrateLegacyPoseKeyOnce(key);
  const value = contentGet(key);
  // contentStore 对脏数据（不可 JSON 解析）返回 null → 与"键不存在"同样归 fallback（原实现语义）
  return value ?? fallback;
}

/**
 * JSON 序列化并写入。
 * - 姿势库等非工程键：经 contentStore 写 localStorage（原为裸写，2026-09-16 收口）。
 * - 工程键：委托 d3dPersistence.writeProject（异步 fire-and-forget），
 *   乐观返回 true（内存态为权威），写失败不阻塞编辑，由 writeProject 内部降级 + 日志暴露。
 * 返回 true/false 仅作「已受理 / 未受理」信号，不再代表「已落盘到浏览器」。
 *
 * 【非工程键的失败可见性】contentStore 的降级族**不因持久化失败抛错**（契约见其文件头），
 * 其失败经 `persist:failed` 事件（storageAdapter.reportPersistFailure）统一上报 → 全局监听器节流 toast。
 * 故此处布尔值只兜「契约违约」（如值不可 JSON.stringify）；调用方（App 姿势库持久化）不依赖它做用户提示。
 */
export function writeJson(key: string, value: unknown): boolean {
  if (!d3dPersistence.isProjectPersistenceKey(key)) {
    try {
      contentSet(key, value);
      return true;
    } catch (error) {
      log.error('姿势库写入失败', { key }, error);
      return false;
    }
  }
  // 工程键：引擎/KV 收口，异步落盘（失败内部降级 localStorage 或记录错误，不在此抛）
  // value 经调用方保证为 D3dProject（工程键路径），此处收窄供 writeProject 类型。
  d3dPersistence.writeProject(key, value as D3dProject).catch((error) => {
    log.error('director3d 工程写 KV 失败', { key }, error);
  });
  return true;
}
