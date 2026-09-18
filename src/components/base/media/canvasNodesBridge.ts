/**
 * 画布节点「只读快照」桥（横切地基 · 零 React / 零存储依赖）。
 *
 * ════════════════════════════════════════════════════════════════
 * 【为什么必须存在（docs/136 §一 的硬理由）】
 * `App.tsx` 里画布与剪辑器是**兄弟节点**：
 *   App.tsx:<ReactFlowProvider><Canvas /></ReactFlowProvider>
 *   App.tsx:{videoEditorOpen && <div className="ve-scope …"><EditorShell/></div>}
 * 剪辑器**不在 `ReactFlowProvider` 树内** → `useReactFlow()` 不可用，
 * 结构上拿不到 `nodes`。故需要一条**非 React 的只读通道**。
 *
 * 【语义约束（铁律）】
 *  · 它是**投影**，不是状态。真源**永远是** `App` 的 `nodes`。
 *  · **单向**：只有 App 写（`setCanvasNodesSnapshot`），其他模块只读。
 *    禁止任何模块拿它当"能改画布"的通道。
 *  · **不做持久化**（同 `core/editorSession.ts`）——不 import contentStore / localStorage，
 *    由测试做源码级断言锁死。
 *
 * 【已知边界（多窗口，非 bug · docs/136 P2-2）】
 * `canvasSyncBus` 用 `BroadcastChannel` 同步的是**落盘后的画布快照**，**不广播内存里的 nodes**。
 * 故多窗口同开时，本快照只反映**本窗口**的 nodes —— 另一个窗口改了画布，这里看不到（除非落盘后重载）。
 * **这是既有架构边界，不要当 bug 修**：剪辑器「画布」Tab 可能显示本窗口的节点列表。
 * ════════════════════════════════════════════════════════════════
 */
import type { Node } from '@xyflow/react';

/** 当前快照（模块级会话态；引用赋值，零拷贝）。 */
let snapshot: Node[] = [];

/**
 * 写入快照（**唯一写入口**，由 App 在 nodes 变化的 effect 里调用）。
 *
 * 【TD-02-50】原「订阅式读 + 引用相等短路」零生产消费（无订阅方，"不通知"就无从观察）⇒ 已随幽灵预留清偿删除。
 * 现只保留写 / 读两个入口；将来真出现订阅消费方时再建，别提前预留。
 */
export function setCanvasNodesSnapshot(nodes: Node[]): void {
  snapshot = Array.isArray(nodes) ? nodes : [];
}

/** 非 React 读（provider 的 `list()` 用）。 */
export function getCanvasNodesSnapshot(): Node[] {
  return snapshot;
}
