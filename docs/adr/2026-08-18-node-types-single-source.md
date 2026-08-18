# ADR-002 · nodeTypes 单源化（NodePalette 派生）

**日期**：2026-08-18
**状态**：已采纳
**来源**：架构5步法 · State 1-5（候选 2）

## 背景

`App.jsx` 手写 `nodeTypes`（16 条 `type → 组件`）与 `NodePalette.paletteNodes` 双维护，漏登记 = 节点建不出来（FINAL-057 B，中风险回归陷阱）。新增节点需 4 处同步。

## 决策

`NodePalette` 每项新增 `component` 字段（存画布渲染组件，与 `icon` 字段区分：icon=工具栏小图标，component=画布组件），新增导出 `buildNodeTypeComponents()` 派生 `{ type → 组件 }`。`App.jsx` 改为：

```js
const nodeTypes = {
  ...buildNodeTypeComponents(),
  director3dNode: Director3DNode, // WebGL 重依赖，palette 不持 component
  ghostTarget: GhostTargetNode,   // 连线占位节点
}
```

新增常规节点只需改 palette 一处；新增节点 4 处同步降为 3 处。

## 依赖分类

**In-process**（纯前端内存态）。无 Adapter、无 Port。

## 关键例外（风控锁定）

- **`director3dNode` 不放入 palette 的 component**：它依赖 WebGL + `import.meta.glob`，无法 SSR。若 palette import `Director3DNode`，`regression_test.cjs`（SSR 渲染 palette 目录）会连带加载 director3d TS → `import.meta.env.BASE_URL` 在 cjs 下崩。故 director3dNode 由 App.jsx 派生后显式补充。
- **`ghostTarget`** 为连线占位节点，palette 不登记，App.jsx 补充。
- **`buildNodeTypeComponents` 遍历全部 palette**（含无 builtin 标记项），不能只取 builtin；顶部快捷 HIDDEN（textNode/promptNode/discountVideoNode）必须并入。

## 循环依赖核查

已验证：节点组件均不反向 import `NodePalette`，`NodePalette → 节点组件` 无环。仅 `AgentPanel.jsx`（非 nodeTypes 节点）经 `useCanvasAgentTools` 依赖 palette，不构成环。

## 测试

`tests/unit/nodeTypes.test.js`（5 用例）：派生映射覆盖 / HIDDEN 并入 / component 字段完整性（director3dNode 例外）/ builtin 非空。

## 备选方案（未采纳）

- **独立 nodeRegistry 模块**：为消除 16 条平行表另建 registry + 重构 palette 全部导出 + App.jsx import，改动 3+ 文件数十行，Leverage 不抵成本，且 palette 已承担「节点目录单源」，重复抽象。
- **palette 直接 import 全部节点组件（含 director3d）**：使 NodePalette 变重、破坏 SSR regression（已实测失败），故 director3dNode 单独除外。
