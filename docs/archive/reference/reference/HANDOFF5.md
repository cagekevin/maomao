# 猫猫AI画布 · Handoff 4（2026-07-20）

> 承接 HANDOFF3.md。本文记录 2026-07-20 对画布**全鼠标交互**的架构评估、根因定位与已落地修复。
> **默认工作上下文仍是 V1（原版引擎），画布组件在 `src/_engine/App.js`，React Flow 版本 `@xyflow/react` ^12.3.6。**

---

## 0. 本回合做了什么（一句话）

1. **全鼠标交互评估**：盘点画布全部 14 个鼠标 handler + 4 个模式开关，定位 6 项问题（2×P1 / 2×P2 / 2×P3）。
2. **根治 P1#1 + P1#2 + P2#1**：删除自建 `ctrlHeld` 键态体系，改用 React Flow 12 原生键码，彻底消除"Cmd+Tab 切走后左键拖拽变框选"的卡死 bug 与 ctrl 键冲突。
3. **更新映射表**：`docs/func-mapping.txt` 修正 `On` 误标并新增 14 个 handler；`docs/var-mapping.txt` 新增画布状态变量段。
4. **按用户要求保留**：连线/ghost/双击删边/滚轮取向均不动（"连线不动，现在好好的"）。

---

## 1. 全鼠标交互清单（已坐实）

ReactFlow props 接线证据：`App.js` L37074–37091。

| 鼠标动作 | handler | 混淆名 | 定义 | 实际行为 |
|---|---|---|---|---|
| 左键空白拖拽 | onPaneDrag | — | — | 平移（默认） |
| 左键+Ctrl/Cmd 拖拽 | selectionKey | — | — | 框选（原生键码） |
| 空格+左键拖拽 | panActivationKey | — | — | 平移（新增） |
| 右键空白/节点/选区 | onPaneContextMenu / onNodeContextMenu / onSelectionContextMenu | `Cn` / `wn` / `En` | L31933 / L31947 / L31958 | 弹对应菜单（type: canvas/node/selection） |
| 框选结束(多选) | onSelectionEnd | `On` | L31968 | 延时 50ms 若选中>1 弹选区菜单 |
| 左键点节点 | onNodeClick | `kn` | L31981 | 仅多连模式 `Et` 下建连 |
| 左键点空白 | onPaneClick | `An` | L31994 | 关菜单、退多连模式 |
| 连线拖出 | onConnect | `xn` | L31883 | 建边（同侧校验、反向纠正、批量连） |
| 连线落空 | onConnectEnd | `Fr` | L36195 | 建 ghost-target/ghost-edge + connection 菜单 |
| 拖放 | onDrop / onDragOver | `Lr` / `Ir` | L36243 / L36240 | 模板/任务/文件 → 建节点 |
| 节点拖动结束 | onNodeDragStop | `jt` | L31514 | → requestGroupResize 重算分组 |
| 视口移动 | onMoveStart / onMoveEnd | `bt` / `xt` | L31381 / L31384 | 置/清"移动中"标志 |
| 双击边 | onEdgeDoubleClick | `Yr` | L36570 | 直接删边（未走撤销栈） |
| 滚轮 | — | — | — | 走 RF 默认 = 缩放（未自定义） |

---

## 2. 问题分级与处置

| 问题 | 严重度 | 根因 | 处置 |
|---|---|---|---|
| 框选卡死（Cmd+Tab 后变框选） | P1 | 自建 `ctrlHeld` 监听 `window` keyup，切窗丢事件 | **已根治**：改用 RF 原生键码，其 `useKeyPress` 自带 `blur`/`Meta` 重置（`node_modules/@xyflow/react/dist/esm/index.js` L463 / L452） |
| ctrl 键与 RF 内置多选键冲突 | P1 | 自建翻转 vs RF `multiSelectionKeyCode`(Mac=Meta) 同键 | **已根治**：同一键只声明一次 |
| 右键语义漂移（ctrl+右键变平移） | P2 | `panOnDrag: ctrlHeld ? [2] : true` | **已根治**：移除 `[2]`，右键恒为菜单 |
| ghost 节点残留 | P2 | 清理依赖 `K.type!=='connection'` 状态机 | **未做**（用户要求连线不动） |
| 滚轮取向（触控板滚不动画布） | P3 | 未配置，默认滚轮=缩放 | **未做**（用户放弃） |
| 双击删边无撤销 | P3 | `Yr` 直接 `G(...)` 绕过 `trackUndo` | **未做**（用户不需要） |

> 注：P2#2 / P3#1 / P3#2 经用户确认保持现状，理由分别是"连线好好的别动""不要滚轮改动""双击删边不需要撤销"。

---

## 3. 已落地改动（`src/_engine/App.js`）

### 3.1 删除自建 `ctrlHeld` 键态体系
- 删除 `let [ctrlHeld, setCtrlHeld] = Y.useState(false);`（原 L31402）
- 删除整个 `useEffect`（原 L37033–37039，监听 `window` keydown/keyup → `setCtrlHeld`）

### 3.2 ReactFlow props 改为声明式（原 L37117–37120）
```jsx
nodesDraggable: true,
nodesConnectable: true,
selectionOnDrag: false,
panOnDrag: true,
selectionKeyCode: [`Control`, `Meta`],
multiSelectionKeyCode: [`Control`, `Meta`],
panActivationKeyCode: `Space`,
```
- 左键拖拽恒为平移；按住 Ctrl/Cmd 拖拽=框选；同键多选；空格+拖拽=平移。
- 右键恒为上下文菜单（去掉 `panOnDrag:[2]` 怪态）。

### 3.3 提交
- `a48f497` — `fix: 用 RF12 原生键码替换自建 ctrlHeld，根治框选卡死/键冲突/右键怪态`（1 文件，+6/−10）
- lint 0 错误；`ctrlHeld`/`setCtrlHeld` 引用 0 处残留。

---

## 4. 映射表更新

### 4.1 `docs/func-mapping.txt`
- **修正**：原 `On = onSelectionContextMenu`（@31899）误标——`On` 实为 `onSelectionEnd`（L31968），真正的 `onSelectionContextMenu` 是 `En`（L31958）。
- **新增** ReactFlow 鼠标交互 handler 段：`xn/Cn/wn/En/On/An/kn/Fr/Ir/Lr/jt/bt/xt/Yr` 共 14 条（含 @行号与接线证据 L37074–37091）。

### 4.2 `docs/var-mapping.txt`
- **新增** 画布状态段：`Et`(multiConnectMode) / `Dt` / `K`(contextMenu) / `ve`(setContextMenu) / `Ue`(closeMenuSetter) / `W`(setNodes) / `G`(setEdges) / `Qt`(nodesArray) / `$t`(edgesArray)。

---

## 5. 验证与残留风险

- **已验证**：`ctrlHeld` 全仓 0 引用；props 区域正确；`read_lints` 0 错误；`git` 已提交。
- **待人工验证**：Mac 上 Cmd+Tab 切走再回来，左键拖拽应恢复为平移（不再卡框选）；按住 Ctrl/Cmd 拖拽应为框选。
- **残留风险**：无代码级风险。P2#2 ghost 残留为已知可接受项（用户主动保留）。

---

## 6. 后续可选项（用户暂未采纳）

1. **P2#2 ghost 清理**：把 `Fr` 的 ghost 增删移入连线菜单组件 `useEffect` 的 return（卸载即清理），删除 `App.js` L36573 依赖 `K.type` 的 effect。
2. **P3#1 滚轮**：Figma 式 `panOnScroll:true` + `zoomOnScroll:false` + `zoomActivationKeyCode:'Control'`，并设 `minZoom/maxZoom`。
3. **P3#2 双击删边**：改走画布 `trackUndo` 包装删除 + "已删除·撤销"轻提示。
