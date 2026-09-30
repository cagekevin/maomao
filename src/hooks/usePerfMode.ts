import { useAppSettingsSelector } from '@/components/base/store/appSettings.ts';

/**
 * 性能模式开关（窄 hook，只吐一个 boolean）。
 *
 * 【为什么单独存在（docs/plan/139 §6.3）】
 * 大部分降级由 CSS 承接（`.react-flow.perf-on`），JS 侧**零降级态消费者**。
 * 唯一的例外是**视频解码**：`display:none` 是否真停解码无定论（plan §十），
 * 需要节点侧条件渲染占位 / 不挂 `<video>`（并保持「已隐藏」提示可见 —— 红线 5）。
 *
 * 【为什么不算「降级态 JS 副本」（§4.1 例外成立）】
 * 它直读设置值（`appSettings.performanceMode`），不是从 DOM / 缩放派生的镜像；
 * 开关是低频手动操作 ⇒ 只在用户点开关时重渲一次，没有原设计「跨阈值高频重渲」的问题。
 *
 * 【消费者必须收窄】只给需要停解码的视频类节点（目标 ≤3），不许扩散。
 * 🔍 `grep -rn "usePerfMode" src` → 命中数 ≤ 视频类节点数。
 */
export function usePerfMode(): boolean {
  return useAppSettingsSelector((s) => s.performanceMode);
}
