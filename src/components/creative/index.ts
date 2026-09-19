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
 * 【宽窄红线】只露域外**真实需要**的 6 个符号（`refs` 实测的 5 个域外消费者：
 * `agent/canvas/agentCanvasHost` · `canvas/nodes/{Image,Text,Video}Generate` · `hooks/useNodeData`）。
 * 域内件（`catalogByKind` · `PRESET_KINDS` · `CreativeLibrary` 等）**不在此暴露** —— 需要时再按需加，
 * 不预先"把域内所有东西 re-export 一遍"（宽门面 = 假收口）。
 */
/* UI 入口（画布节点用它开预设库） */
export { default as CreativeLibraryButton } from './CreativeLibraryButton.tsx';

/* 预设字典原语（值） */
export { normalizeChipFieldWrite, toDictEntry } from './creativePresets.ts';

/* 预设字典类型 */
export type {
  CreativePreset,
  CreativePresetsDict,
  CreativePresetEntry,
} from './creativePresets.ts';
