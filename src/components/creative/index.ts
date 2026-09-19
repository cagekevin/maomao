/**
 * 创作库域门面 —— `src/components/creative/` 的**唯一对外出口**。
 *
 * 【域边界】域根 = `components/creative/`（与 `agent/` · `canvas/` · `videoEditor/` 同级）：
 *   · `creativePresets.ts`  —— 预设字典模型（类型 + 归一/收集/写入原语）
 *   · `creativeCatalog.ts`  —— 目录（style/filter/motion/mj 四类，数据来自 `data/*.json`）
 *   · `promptManager.ts`    —— 提示词预设管理（localStorage 持久化 + 搜索/映射）
 *   · `CreativeLibrary.tsx` · `CreativeLibraryButton.tsx` · `views/`  —— UI 层
 * 落点与判据见 `docs/DOMAIN-MODULES.md §2.6 / §7`。
 *
 * 【建面判据（§2.7 二级判据）】域外消费点直连的是**实现件**（`creativePresets`），不是天然入口 ⇒ **必建**。
 * 收益：域内重排（拆 `views/`、改 `catalog` 结构）不再波及域外。
 *
 * 【宽窄红线】只露域外**真实需要**的符号 —— 需要时再按需加，不预先"把域内所有东西
 *   re-export 一遍"（宽门面 = 假收口）。
 *
 * 【★ TD-22-68 断环（2026-09-20）：门面只露 UI 入口，字典**纯逻辑原语不再经此转发**】
 *   原先 `normalizeChipFieldWrite` 经本门面被 `agent/canvas/agentCanvasHost` 与
 *   `hooks/useNodeData` 消费 ⇒ 那两处（**逻辑层**）为了一个纯函数 import 了本门面（**含 UI 组件**）
 *   ⇒ 逻辑层依赖 UI 层，形成 7 跳结构环（useNodeData → CreativeLibraryButton → FullscreenModal
 *   → FullscreenShell → modalLayer → uiHooks → useNodeData）。
 *   修法 = **摆正依赖方向**：逻辑层直连纯逻辑模块 `creativePresets.ts`（它只依赖 promptChips）；
 *   本门面只继续露**画布节点真正需要的 UI 入口 + 其配套类型/写入原语**。
 *   ⚠️ 别再把纯逻辑原语加回本门面 —— 那会让逻辑消费者重新依赖 UI 门面，环必复发。
 */
/* UI 入口（画布节点用它开预设库） */
export { default as CreativeLibraryButton } from './CreativeLibraryButton.tsx';

/* 预设字典写入原语（画布节点经门面消费；toDictEntry 产出的 entry 供胶囊落地） */
export { toDictEntry } from './creativePresets.ts';

/* 预设字典类型（画布节点的 props/state 形参） */
export type { CreativePreset, CreativePresetsDict } from './creativePresets.ts';
