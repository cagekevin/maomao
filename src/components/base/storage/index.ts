/**
 * base/storage · 存储底层实现深模块薄入口。
 *
 * 【深模块化（feat/base-api-deepmodule，2026-08-31）】
 * 把 base/ 的存储底层实现件收敛成「内部实现 + 薄入口」：外部只从本入口 import。
 * 内部件互引走同目录（如 storageQuota → ./storageAdapter）。
 *
 * 【范围】已收 2 件：storageAdapter/storageQuota（`kvStore` re-export 壳已于 2026-09-19 删除
 * —— TD-18-36，`CANVAS_STATE_PREFIX` 改由 core/contracts.ts 直供；`persistFailureBus` 已随
 * `persist:failed` 总线于 2026-09-17 删除：失败改由各站点经 `confirmPersist` 自确认）。
 * 注意：contentStore 是「横切存储唯一入口」（CONTEXT §④，dev 校验裸 key），留在 base/ 根
 * 作为对外统一入口；backupStore 依赖 contentStore/projectStore（上层备份编排），留在 base/ 根
 * （放本模块会与 projectStore→contentStore→storage 形成循环，2026-08-31 实测后撤回）。
 * contracts.ts EVENTS 表的 from/to 按 basename 匹配（check-events），本模块内文件改名不影响。
 */
export * from './storageAdapter.ts';
export * from './storageQuota.ts';
// 历史裸键迁移原语（2026-09-16 M7 收口）：裸访问点全仓收敛在本层，业务只经本 barrel 调其迁移语义 API。
export * from './legacyRawKey.ts';
