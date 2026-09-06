/**
 * base/storage · 存储底层实现深模块薄入口。
 *
 * 【深模块化（feat/base-api-deepmodule，2026-08-31）】
 * 把 base/ 的存储底层实现件收敛成「内部实现 + 薄入口」：外部只从本入口 import。
 * 内部件互引走同目录（如 kvStore/storageQuota → ./storageAdapter）。
 *
 * 【范围】已收 4 件：storageAdapter/kvStore/storageQuota/persistFailureBus。
 * 注意：contentStore 是「横切存储唯一入口」（CONTEXT §④，dev 校验裸 key），留在 base/ 根
 * 作为对外统一入口；backupStore 依赖 contentStore/projectStore（上层备份编排），留在 base/ 根
 * （放本模块会与 projectStore→contentStore→storage 形成循环，2026-08-31 实测后撤回）。
 * contracts.ts EVENTS 表的 from/to 按 basename 匹配（check-events），本模块内文件改名不影响。
 */
export * from './storageAdapter.ts';
export * from './kvStore.ts';
export * from './storageQuota.ts';
export * from './persistFailureBus.ts';
