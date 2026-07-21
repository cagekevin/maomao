# AI06 · 深化审计：模块4 画布 ReactFlow handlers 代码级坐实

> 阶段：门4 对抗审计延伸 ｜ 方法：源码 grep + read_file 逐条坐实
> 放置范围：仅 `docs/AI06/`，未触碰 `App.js`/`config.js`/dist（红线§3.1）。
> 配套：纠正 `04-module4-canvas.md` handler 行号偏差 + 补重名坑（延续阶段0 的 Xr/Zr/Jn 重名主题）。

## 1. 关键发现：handler 是 `Y.useCallback` 局部赋值，非 `function` 声明
`04` 文档按 func-mapping 标 `xn`@L31883 等，但 func-mapping 记的是 func 声明式行号，实际在画布组件内这些 handler 是 **`let xn = Y.useCallback(...)` 局部赋值**。直接 grep `function xn(` 会落空，必须用 `xn =` 形式。真实行号如下（均已 read_file 坐实）。

## 2. ReactFlow handler 真实行号表（修正 04 §2）
| 混淆名 | 可读名 | 真实定义行 | 04 文档原标 | 修正 |
|--------|--------|-----------|------------|------|
| `xn` | onConnect | **L31883** `let xn = Y.useCallback` | L31883(对) | ✅ |
| `Cn` | onPaneContextMenu | **L31933** | L31933(对) | ✅ |
| `wn` | onNodeContextMenu | **L31947** | L31947(对) | ✅ |
| `En` | onSelectionContextMenu | **L31958** | L31958(对) | ✅ |
| `On` | onSelectionEnd | **L31968** | L31968(对) | ✅ |
| `kn` | onNodeClick | **L31980** | L31981 | ❌ 差1，实为 **L31980** |
| `An` | onPaneClick | **L31993** | L31994 | ❌ 差1，实为 **L31993** |
| `Fr` | onConnectEnd | **L36245** `let Fr = Y.useCallback` | L36195 | ❌ 实为 **L36245** |
| `jt` | onNodeDragStop | **L31513** `jt = Y.useCallback` | L31514 | ❌ 差1，实为 **L31513** |

> ReactFlow props 装配块 `onConnect:xn`/`onPaneContextMenu:Cn`/`onDrop:Lr`/`onConnectEnd:Fr` @**L37125-37139** 坐实 ✅（引用点，非定义点）。

## 3. 重名坑（阶段0 主题延续）：`Lr` / `Ir` 各有两处定义
画布模块内 `Lr`/`Ir` 在**不同作用域**被重复定义，func-mapping 错锚需厘清：

### 3.1 `Lr` 的两处定义
- **L1700** `function Lr(e, t, n)`：缩略图 resize URL 拼接（`_resize_${t}.jpg` / `_frame1_resize_${t}.jpg`），属模块2 资源工具函数。
- **L36293** `let Lr = Y.useCallback(e => {...})`：**画布 onDrop 拖放建节点**（读 `application/x-yimao-template` / `application/x-mutiwindow-task` / `dataTransfer.files` → `Z(...)` spawnNode）。这才是 ReactFlow `onDrop:Lr`@L37138 指向的 `Lr`。
- **结论**：`04` 文档说「`Lr`(onDrop)@L36293」方向对，但混淆字典未注明与 L1700 重名；func-mapping 若把 `Lr` 锚为单一含义则错。

### 3.2 `Ir` 的两处定义
- **L1695** `function Ir(e)`：缩略图尺寸取整（`Fr` 数组 [200..1000] 最近档），模块2 工具。
- **L36290** `let Ir = Y.useCallback(e => { e.preventDefault(); e.dataTransfer.dropEffect='copy' })`：**画布 onDragOver**。ReactFlow `onDragOver:Ir`（装配块 L37138 附近）。
- **结论**：同理，`Ir` 在画布域 = onDragOver，与 L1695 resize 工具重名。

> ⚠️ 这是阶段0 已识别的"重名陷阱"在模块4 的再现：`Xr`/`Zr`/`Jn` 之外，`Lr`/`Ir` 也存在模块级 vs 局部双重定义。引用必须带行号 + 作用域限定。

## 4. 持久化链路坐实（修正 04 §3）
- `Q.saveCanvasStateWithVersion` 实现 @**L1650**（非 04 所写 L1642）；调用 @L31728（`await Q.saveCanvasStateWithVersion(en.current, r, t)`）✅。
- 存储键 `Z.CANVAS_STATE_PREFIX = 'canvas-state-v1-'` @**L1283**；全键 `canvas-state-v1-{id}` @L1295 ✅。
- 画布清空：`Sr.default.removeItem(\`canvas-state-v1-${e}\`)` @L44299 ✅。
- 空画布保护：L1652 `if (!t.nodes || t.nodes.length === 0) return ...跳过保存` ✅。

## 5. 数据字段白名单坐实（修正 04 §5）
- `ov`(序列化允许字段白名单) @**L42001**：`new Set('prompt.text.content...'.split('.'))`（节点 data 可持久化字段）。
- `sv`(UI/回调字段黑名单) @**L42002**：`new Set('id.label.type.loading...onGenerate...'.split('.'))`（不入库的运行时字段）。
- 两处均为 `var ov`/`sv` 模块级赋值，坐实 ✅（与 var-mapping L177-178 一致）。

## 6. 门4 对抗结论
- 模块4 全部 ReactFlow handler 真实行号已坐实，04 文档有 4 处偏差（`kn`/`An`/`Fr`/`jt` 差1或错行）已在新文档纠正。
- 暴露新重名坑：`Lr`(L1700 resize vs L36293 onDrop)、`Ir`(L1695 取整 vs L36290 onDragOver) —— 须带作用域限定引用，func-mapping 若单一锚点则错。
- 持久化链路（`Q.saveCanvasStateWithVersion`@L1650 + `CANVAS_STATE_PREFIX`@L1283 + 白名单 `ov`/`sv`@L42001/42002）全绿 ✅。

## 7. 门3 校验增量
新增/修正引用（handler `xn`/`Cn`/`wn`/`En`/`On`/`kn`/`An`/`Fr`/`jt`/`Lr`/`Ir` 真实行号、`Q.saveCanvasStateWithVersion`@L1650/L31728、`CANVAS_STATE_PREFIX`@L1283、`ov`/`sv`@L42001/42002、装配块 L37125-37139）均经 grep/read_file 坐实 ✅。
