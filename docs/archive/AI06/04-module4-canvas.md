# AI06 · 模块4：画布引擎与节点

> 审计日期：2026-07-21 ｜ 行号快照会漂移，动手前重 grep。
> 锚点以 func-mapping ReactFlow 段（L178-193）+ 实 grep 坐实。

## 1. 运转图景
ReactFlow 画布：拖放建节点(`Lr`=onDrop) / 连线(`xn`=onConnect) / 右键菜单(`Cn`/`wn`) / 框选(`En`/`On`) / 节点点击(`kn` 多连模式) / 连线落空(`Fr`)。3D 导演台 `Th`(Director3DNode) 接入。

## 2. 核心混淆字典（ReactFlow handler，func-mapping 已坐实+实 grep）
| 混淆名 | 可读名 | 行号 | 作用 |
|--------|--------|------|------|
| `Lr` | onDrop（画布域局部） | **L36293** `let Lr = Y.useCallback` | 模板/任务/文件→建节点（props@L37138）。⚠️ 重名：`Lr`@L1700 是缩略图 resize 函数（模块2 工具），非此 |
| `Ir` | onDragOver（画布域局部） | **L36290** `let Ir = Y.useCallback` | 设 dropEffect='copy'。⚠️ 重名：`Ir`@L1695 是缩略图尺寸取整函数，非此 |
| `xn` | onConnect | **L31883** `let xn = Y.useCallback` | 建边/同侧校验/批量连 |
| `Cn` | onPaneContextMenu | **L31933** | 画布右键菜单 |
| `wn` | onNodeContextMenu | **L31947** | 节点右键菜单 |
| `kn` | onNodeClick | **L31980**（非 L31981） | 多连模式建连 |
| `Fr` | onConnectEnd | **L36245**（非 L36195） `let Fr = Y.useCallback` | 连线落空→ghost |
| `En` | onSelectionContextMenu | **L31958** | 多选右键 |
| `On` | onSelectionEnd | **L31968** | 框选结束 |
| `An` | onPaneClick | **L31993**（非 L31994） | 关菜单/退多连 |
| `jt` | onNodeDragStop | **L31513**（非 L31514） | 拖动结束重算分组 |
> 注：所有 handler 是 `Y.useCallback` 局部赋值（非 `function` 声明），grep `function xn(` 会落空。真实行号见 `13-module4-canvas-handlers.md`。
| `Th` | Director3DNode | var-mapping L187 | 3D导演台节点 |
| `Z`(建节点) | spawnNode | ARCH L36215 | 创建节点加入画布 |

## 3. 关键数据流
- ReactFlow props 装配块 @L37125-37139：`onConnect:xn`/`onNodeClick:kn`/`onPaneContextMenu:Cn`/`onDrop:Lr`/`onConnectEnd:Fr`。
- 画布持久化：ReactFlow `onChange` → `Q.saveCanvasStateWithVersion`(**@L1650实现**/@L31728调用，原写 L1642 偏差) → localforage `canvas-state-v1-{id}`(L1283)。**注意**：ARCHITECTURE 称 `canvas-state-change` 为 CustomEvent，实源码为直接调 Q 持久化，非字面事件名（文档表述待纠）。
- 多连模式：`Et`(multiConnectMode, var-mapping L249) 下 `kn` 建连；`Dt` setter 退出。

## 4. 存疑 Bug / 雷
- **新增自定义节点/连线规则**与现有混淆逻辑冲突面：新增节点须走 `Z`(spawnNode) + 注册到 spawnable 集合(L4141)，避免与 `data.*` 字段白名单 `ov`/`sv`(var-mapping L177-178) 冲突。
- 撤销/重做：直接 `setNodes/setEdges`(W/G)，不经 `onNodesChange`（PROJECT_ORIGIN §4.5 注）。
- Ctrl+拖拽框选：`ctrlHeld` 动态切 `panOnDrag`/`selectionOnDrag`（仅认 Control/Meta）。

## 5. 边界契约
| 类型 | 名称 | 位置 | 说明 |
|------|------|------|------|
| 组件 props | ReactFlow handlers | App.js L37125-37139 | 接线块 |
| 存储键 | `canvas-state-v1-{id}` | Z.CANVAS_STATE_PREFIX L1283 | 画布持久化 |
| 函数 | `Q.saveCanvasStateWithVersion` | App.js L1642 | 落盘 |
| 数据字段白名单 | `ov`/`sv` | var-mapping L177-178 | 序列化控制 |

## 6. 校验门
行号 grep + func-mapping 双重坐实 ✅。
