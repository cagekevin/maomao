/**
 * ghost 连线占位的单源常量（152-C5）——「从端口拖出到空白」的占位三件套：
 *   1. 假目标节点（id = GHOST_TARGET_ID、type = GHOST_TARGET_TYPE，GhostTargetNode 渲染为不可见）；
 *   2. 幽灵边（id 以 GHOST_EDGE_PREFIX 开头，fromNode → 假目标；用时间戳保证 id 唯一，
 *      固定 id 会在连续快速触发 onConnectEnd 时因 setState 批处理撞出重复 React key）。
 *
 * 【为什么收口】id / 边前缀此前以字面量散在 App.tsx 的 5 个消费点（建 ghost 1 处 +
 * 清理 2 处 + 防重入过滤 2 处）：任一处改字面量，其余各处即静默失配——清理失灵、
 * 幽灵线残留。收口后「写入与过滤共用同一常量」，拼写漂移在 type-check 层即不可能。
 *
 * 【范围裁定】type 字面量 `ghostTarget` 同时登记在 base/core/contracts.ts 的 NODE_TYPES
 * 注册表（键=值=组件注册名）与 useConnectedInputs 的排除清单 —— 那是**类型注册表**，
 * 不属本模块收口范围（依赖方向：base 层不反向 import canvas/contract；注册表自身已是单源）。
 */

/** 假目标节点的唯一 id（全画布同时至多一个 ghost-target）。 */
export const GHOST_TARGET_ID = 'ghost-target';

/** 假目标节点的类型名（与 NODE_TYPES.ghostTarget / GhostTargetNode 组件注册名一致）。 */
export const GHOST_TARGET_TYPE = 'ghostTarget' as const;

/** 幽灵边 id 的唯一前缀（所有清理点统一按它过滤）。 */
export const GHOST_EDGE_PREFIX = 'ghost-edge-';
