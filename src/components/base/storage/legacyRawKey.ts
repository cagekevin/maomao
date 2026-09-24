/**
 * 历史「裸 localStorage 键」访问原语（2026-09-16 · M7 裸写收口 · TD-02-33/36/37/39）。
 *
 * 【为什么需要它】M7 收口把若干**裸 localStorage 直写**的键（无 `yimao:` 前缀、不经 contentStore）
 * 收编进唯一入口。收编后物理键变为 `yimao:<键名>`（storageAdapter 统一加前缀），
 * 而**存量用户数据仍在旧裸键下** → 必须有一次「读旧键 → 写新键 → 删旧键」的迁移读，
 * 否则升级瞬间老用户的姿势库/字幕偏好静默丢失。
 *
 * 【为什么放在 base/storage（而不是各业务模块）】`src` 内除本层外**禁止直碰裸 localStorage**
 * （machine guard = `check:arch` 的「禁裸改本地存储」规则）。把这段唯一需要裸访问的代码留在
 * 底层实现层（与 storageAdapter 同层），业务侧只经 `base/storage/index.ts` barrel 调本文件的
 * **迁移语义** API —— 裸访问点数量由此从 N 收敛为 1，且新码不可能靠"import 一个通用裸读"绕过入口。
 *
 * 【纪律】本文件只服务**存量迁移**。
 *  - 新增键一律登记 `contracts.ts` 的 STORAGE_KEYS 并走 contentStore，**禁止**再往 `LEGACY_RAW_KEYS` 里加；
 *  - 迁移完成后（下一个大版本 / 确认无存量）本文件的集合应清空，届时可整体删除。
 */

// 【2026-09-17】本文件原无 import；`removeLegacyRawKey` 的 catch 里加了留痕 ⇒ 需 logger。
import { logger } from '../core/log/logger.ts';

/** 曾以裸 localStorage（无 `yimao:` 前缀）写过的键 —— **只减不增**（存量迁移用）。 */
const LEGACY_RAW_KEYS: ReadonlySet<string> = new Set<string>([
  'director3d-custom-poses', // → contracts.KEY_DIRECTOR3D_CUSTOM_POSES（TD-02-36/38/39）
  'editor-caption-language', // → contracts.KEY_EDITOR_CAPTION_LANGUAGE（TD-02-33/37）
  // 'editor-caption-model-id' 已删（2026-09-24）：转写模型固定为 tiny、不再有"模型偏好"，
  // 故它没有迁移目标 ⇒ 留着就是无人调用的死条目（本集合本就"只减不增"）。存量裸值不再被读，无害。
  'editor-caption-template-id', // → contracts.KEY_EDITOR_CAPTION_TEMPLATE_ID（TD-02-33/37）
]);

/** 历史裸键的读取结果（**判别联合**：把"没有"与"坏了"分开，禁把两者压成同一个 undefined）。 */
export type LegacyRawKeyRead =
  { status: 'missing' } | { status: 'ok'; value: unknown } | { status: 'corrupt'; raw: string };

/** 该键是否有历史裸键存量需要迁移。 */
export function isLegacyRawKey(key: string): boolean {
  return LEGACY_RAW_KEYS.has(key);
}

/**
 * 读历史裸键的值（JSON 解析）。
 * ⚠️ **迁移专用**，不是通用裸读入口 —— 业务码读数据一律 `contentGet/contentGetAsync`。
 *
 * 【为什么返回判别联合而非 `T | undefined`】"键不存在"（新用户，无需迁移）与"键损坏"（需可见 + 人工介入）
 * 是两种结论，压成同一个 `undefined` 就等于把后者藏起来。**失败可见性归调用方**（各模块有自己的
 * logger/reportDegrade 层），本文件只负责给出**可判别的事实**。
 * @param key 逻辑键名（本函数内部不加 `yimao:` 前缀，正是为了读旧物理位置）
 */
export function readLegacyRawKey(key: string): LegacyRawKeyRead {
  let raw: string | null;
  try {
    raw = localStorage.getItem(key);
  } catch {
    // localStorage 不可用（SSR / 受限环境）：等同"读不到"，不视为损坏
    return { status: 'missing' };
  }
  if (raw == null) return { status: 'missing' };
  try {
    return { status: 'ok', value: JSON.parse(raw) as unknown };
  } catch {
    return { status: 'corrupt', raw };
  }
}

/**
 * 删历史裸键（迁移成功后的清理 / 已废弃旧键的收尾）。
 * ⚠️ **迁移专用** —— 业务删键一律 `contentDelete/contentDeleteAsync`。
 * @param key 逻辑键名（不加前缀，删的正是旧物理位置）
 * @returns 是否删除成功（localStorage 不可用时 false）
 */
export function removeLegacyRawKey(key: string): boolean {
  try {
    localStorage.removeItem(key);
    return true;
  } catch (e) {
    // localStorage 不可用（隐私模式 / 受限环境）→ 未删成功；返回值已告知调用方，但**降级必留痕**。
    logger.debug('存储', '历史裸键删除失败（localStorage 不可用）', e);
    return false;
  }
}
