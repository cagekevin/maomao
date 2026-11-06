/**
 * 存储监控 · 数据源（纯函数层）。
 *
 * 【职责】为「设置 → 更多设置 → 存储监控」提供存储占用/配额的计算逻辑，纯函数可单测。
 *   现存一块：浏览器存储配额（IndexedDB/Cache）估算 + 配额受压判定。
 *
 * 【为什么放这】本项目无 `src/services/` 目录，纯逻辑统一在 `src/components/base/`
 *   （对齐 contentStore.js / kvStore.js / storageAdapter.js）。磁盘扫描（Tauri 版文档里的
 *   getProjectDataDir / readDir）在 Chrome 扩展沙箱做不了，故本模块不含磁盘扫描。
 *
 * ── 数据流（下个 AI 改这前必读）──
 *  StorageMonitor（UI）挂载 → runScan()：
 *   └─ estimateBrowserStorage()  → navigator.storage.estimate()
 *         浏览器分配的 IndexedDB/Cache 配额（maomao 主体不写 IndexedDB；剪辑器**素材元数据**仍写在
 *         IndexedDB，见 videoEditor/engine/services/storage/service.ts → usage 未必为 0。原句「不写 IndexedDB」
 *         是假陈述，2026-09-16 TD-02-32 修正）
 *
 * 【口径（与 UI 约定）】
 *   - estimateBrowserStorage()：navigator.storage.estimate() → IndexedDB + Cache Storage 用量。
 *
 * 【红线】本模块只读存储，不写、不删。任何清理动作必须走 contentStore 唯一入口，禁止散写。
 *
 * 【⚠️ 清理建议（若下个 AI 做「清理」，先读这条）】
 *   当前二期只做只读画像，不含清理。若后续加清理，务必：
 *   1. 只删「缓存/可重建」类键，且二次确认（如 yimao_prompt_hub_cache 提示词社区缓存、
 *      可安全重建的派生数据）；禁止直接删用户主数据键（projects/画布快照/账号/会话）。
 *   2. 删除走 contentStore 唯一入口（contentDelete / contentDeleteAsync），禁止散写 sRemove/裸键。
 *      KV 键（canvas-state-v1-*、yimao_accounts 等）存在 localTool 后端，前端删不走 localStorage，
 *      需走 kvStore.storageDelete，且删后要处理跨端同步。
 *   3. 删除前确认无引用（grep 该键的读方）；删后重扫刷新 UI。
 *   4. 「无用大对象」判定需谨慎：真正确认可删，要靠业务语义（如过期缓存、已导出的历史快照），
 *      别凭大小猜。（原第 4 条后半句提本模块 byteLength 只估内容字节无法区分——该助手与
 *      analyzeStorageByKeys 已随 2026-11-06 死代码清理移除，见下。）
 *
 * 【2026-11-06 死代码清理（B3）】删除 estimateChromeStorage / analyzeStorageByKeys /
 *   enumerateLocalEntries / mapKeyToDomain / DOMAIN_LABELS / DomainAggregate / byteLength
 *   —— StorageMonitor 的「chrome.storage/localStorage 占用卡」与「按 domain 画像卡」已被健康报表
 *   取代（见 StorageMonitor.tsx 文件头注释），上述符号生产零消费者（仅测试自引用）。
 *   保留 STORAGE_PRESSURE_RATIO / estimateBrowserStorage / estimateStoragePressure（活链路）。
 *   enumerateLocalEntries 的记忆点已同步进 storageAdapter.ts 文件头。
 */
/** 配额受压预警阈值：用量比例 ≥ 此值时视为「即将用尽」（对齐文档 STORAGE_PRESSURE_RATIO） */
export const STORAGE_PRESSURE_RATIO = 0.85;

// 更新(2026-09-12 / TD-02-8)：analyzeAgentConversationPressure 已删除——会话键迁 KV 后该函数
// 恒返回 null（「已弃用却保留 API」= 死抽象：调用方早已移除、留着只会被误用为"预警仍在生效"）。
// 真正兜底会话体积的是 volumePolicy 的 L3 预算降级（applyConversationBudget），与本地存储配额无关。

/**
 * 估算浏览器存储配额（navigator.storage.estimate）。
 * @returns {Promise<{usage:number, quota:number, ratio:number} | null>}
 *   环境不支持（无 navigator.storage.estimate）返回 null。
 */
export async function estimateBrowserStorage(): Promise<{
  usage: number;
  quota: number;
  ratio: number;
} | null> {
  if (typeof navigator === 'undefined' || !navigator.storage?.estimate) return null;
  const { usage = 0, quota = 0 } = await navigator.storage.estimate();
  return { usage, quota, ratio: quota > 0 ? usage / quota : 0 };
}

/**
 * 判断配额是否受压（用量比例 ≥ STORAGE_PRESSURE_RATIO）。
 * @param {number} ratio 用量比例（0~1）
 * @returns {{ underPressure: boolean }}
 */
export function estimateStoragePressure(ratio: number): { underPressure: boolean } {
  return { underPressure: typeof ratio === 'number' && ratio >= STORAGE_PRESSURE_RATIO };
}
