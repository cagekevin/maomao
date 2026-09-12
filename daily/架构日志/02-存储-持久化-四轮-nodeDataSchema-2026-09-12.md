# 架构日志 · 存储 / 持久化 · 四轮（nodeDataSchema：data 契约真源）· 2026-09-12

> **文件名**：`02-存储-持久化-四轮-nodeDataSchema-2026-09-12.md`。区域 02 第四轮（同区多轮各写新档）。
> **视角**：延续「复杂度错位」判据；本轮兑现 **TD-02-7 主体**（画布快照 / 节点 data 契约的唯一真源）。
> **一句话**：把「节点 data 有哪些字段、初值是什么」这份知识从 **UI 目录**里搬出来，三张表各归其位；并明确**刻意不派生**的两处（防后人"好心"改成仪式化分层）。

---

## 一、本轮消除的复杂度错位（M5 主体）

### 1.1 错位复述
`NodePalette.ts` 是「UI 目录」（label/icon/分类/组件引用），却同时持有 `paletteNodes[].data`（**新建节点的 data 初值**）。两种关注点混在一张表里：菜单只想读 label/icon，却要连带维护数据字段表；而数据契约的另一半（落盘白名单）刚在上一轮才收口。加上 `check-node-data` 把「真源」写死在 palette 的文本形态上，**真源一动，对账工具就跟着瞎**（三轮 TD-02-9 的教训）。

### 1.2 收口动作（复杂度归位）

| # | 动作 | 落点 |
| - | - | - |
| 1 | 新建 `base/canvas/nodeDataSchema.ts`：`NODE_DATA_DEFAULTS`（各类型 data 字段 + 初值）+ `defaultNodeData(type)`（唯一入口，含 `expanded` 注入） | 数据契约**独立成模块** |
| 2 | `NodePalette` 删除全部 `data:` 登记、删 `PaletteNodeDef.data` 字段类型、删 `defaultNodeData` 与其 `INPUT_PANEL_NODE_TYPES` 依赖 | 回归**纯 UI 目录** |
| 3 | 消费者改指新真源：`App.tsx`（4 处调用）× 1、`useCanvasAgentTools`（create_node）× 1、`ssrRegression.test`（全节点渲染）× 1 | import 路径三处 |
| 4 | **顺手修一处可变实例隐患**：`defaultNodeData` 由浅合并改 **`structuredClone` 深拷贝** | 见 §1.4 |
| 5 | `check-node-data.mjs` 改指 `NODE_DATA_DEFAULTS`（单一对象比原「数组内嵌 `data:{`」解析简单），并**删除**已无用的 palette 解析器；`templateNode` 死登记项一并删 | 对账工具真源随迁 |
| 6 | 文档同步 5 处：`spec/NEW-NODE-GUIDE.md`（注册表 5 处→6 处并改判据）、`spec/CONTEXT.md`（新增节点 3 处→4 处同步）、`spec/DATAFLOW.md`（画布段三表分工）、`NodeShell.tsx` / `TemplateNode.tsx` 注册清单、`nodeDefaults.ts` 头注释互指边界 | 防后续 AI 登记到错的地方 |

### 1.3 三张表各管一件事（本轮确立，写进各文件头注释）
| 表 | 管什么 | 何时生效 |
| - | - | - |
| `NodePalette.paletteNodes` | **UI 目录**（type/label/icon/cat/component/badge） | 菜单/面板/nodeTypes 派生 |
| `nodeDataSchema.NODE_DATA_DEFAULTS` | **data 初值** | **仅新建节点那一刻** |
| `nodeDefaults.NODE_TYPE_DEFAULTS` | **结构默认**（width/height/style/initial\*） | 新建**与快照还原都补** |

> ⚠️ 三者刻意**不合并**：「data 初值」与「结构默认」的生命周期不同（后者在快照还原时也要补，前者绝不能——否则用默认值覆盖用户数据）。合并成一张表看似更收敛，实则会诱导后人用同一函数处理两种时机 → 静默覆盖用户内容。这是**真分缝**，不是遗漏。

### 1.4 顺手修掉的可变实例隐患
原实现 `{...注入, ...palette.data}` 是**浅合并**：`images: []` / `timelineTracks: []` / `overlayState: {...}` 这些字面量在真源里是**共享实例**，于是**每个新建节点共用同一个数组**——任一节点就地 `push` 即污染其它节点与后续新建节点。历史 palette.data 同样有此隐患（无人踩到不等于没有）。已在真源收口的同一轮改为 `structuredClone`，并用单测钉死（深拷贝 + 真源不被污染）。

### 1.5 刻意「不做」的两处（YAGNI 判断，留痕防误改）
- **不把节点 `interface XxxData` 改为由 `NODE_DATA_DEFAULTS` 派生**：运行时的值表推不出**字段级类型**（`images: []` 只能推出 `never[]`/`unknown[]`），强行派生将丢掉类型诚实性——那是**仪式化分层**。正确做法=「两视图 + 机器对账」：`interface` 管类型、`NODE_DATA_DEFAULTS` 管初值，`check:node-data --strict` 对账二者字段集。
- **不把 `NODE_OUTPUTS` 并入 data schema**：它描述的是「**怎么读这个节点的产出**」（按端口、可计算、可弃权返回 undefined），不是「data 有哪些字段」——两个不同关注点，合并会造出上帝表。

---

## 二、度量（改前 / 改后）

| 口径 | 改前 | 改后 |
| - | - | - |
| 「节点 data 初值」真源处数 | 2（paletteNodes.data + HIDDEN.data） | **1**（NODE_DATA_DEFAULTS） |
| `NodePalette` 承担的职责数 | 2（UI 目录 + 数据契约） | **1**（纯 UI 目录） |
| 「加一个 data 字段」要改的默认值处数 | 2（palette 两处数组） | **1** |
| 新建节点是否共享可变默认值 | 是（浅合并且真源为共享字面量） | **否**（深拷贝 + 单测钉死） |
| 对账工具真源的解析复杂度 | 数组内嵌 `data:{`（易被类型标注/格式漂移打瞎） | **一层对象**（+ 解析器自检 fail-loud） |
| 后续 AI 登记 data 的指路处数 | 3 处文档口径不一（palette.data / NODE_OUTPUTS 混淆） | 5 处文档统一（NEW-NODE-GUIDE 权威 + CONTEXT + NodeShell + TemplateNode + 各表头注释） |

---

## 三、验证（实跑）

- `npm run type-check` → 0 错（src + tests）；
- `npm run check:arch` → ✅ 无循环依赖 / 分层边界 / 存储唯一入口等 6 条规则全绿；
- `node scripts/check-node-data.mjs --strict` → ✅（默认值真源解析非空 → 自检通过；字段缺口 0）；
- 定向单测：`nodeDataSchema`(6) · `nodes/ssrRegression`(13) · `nodeDefaults`(10) · `deriveNodes`(8) · `nodePrefs`(6) · `nodePrefsRegression`(4) · `useArrangeCanvas`(6) · `useCanvasSync`(7) · `canvasAgentTools`(57) · `canvasContextMenu`(13) 全绿；
- `npm run test:smoke` → ALL PASS（nodeTypes 注册 10 项派生正常）。

---

## 四、探债

| TD-ID | 复杂度错位点 | 归类 | 爆炸半径 | 利息率 | 状态 |
| - | - | - | - | - | - |
| TD-02-7 | 快照 schema 无单一真源（≥6 处 + 测试手抄副本）→ 区域 04 的 TD-04-15/16/17/19 复利根因 | 还债 | 6+ 处 | 高 | **[已解决 2026-09-12]**（落盘白名单真源 = `canvasSnapshotSchema.ts`；data 初值真源 = `nodeDataSchema.NODE_DATA_DEFAULTS`；结构默认真源 = `nodeDefaults`；版本号 = `contracts`；interface/NODE_OUTPUTS 由 `check:node-data --strict` 机器对账而非派生——见 §1.5 的 YAGNI 判断） |
| **TD-02-11**（新，承接旧 `TD-8(b)`） | **产出语义仍靠读侧启发式**：`genericOutput` 按 `assetUrl > videoUrl > resultUrl` + 扩展名猜产出，写侧各写各的字段名（`gifResult`/`extractedImages`/`images[]`…）；猜错即**静默空产出**（无报错无日志） | 持平 | 读侧 `useConnectedInputs` + 全部产出节点 | 中 | 待还（**@见区域 04**；解法方向：产出声明从「读侧猜」改为「写侧声明」，由 `NODE_OUTPUTS` 强制覆盖每个有产出的类型，`check:node-data` 对账「有产出节点 ⊆ 已声明」） |

---

## 五、结论与下一步

- **区域状态**：`已验证(有债待还)`（本轮结清 TD-02-7 高息；余 TD-02-3/4/5/8/10/11 低-中息）。
- **本轮复杂度净变化**：新增 1 个数据契约模块（+1 文件），换来 `NodePalette` 减 1 项职责、2 处真源合 1、对账工具真源解析简化 + 死解析器/死登记项删除、一处共享可变实例隐患消灭。判定：**整体复杂度下降**。
- **下一步（建议）**：
  1. **TD-02-11**（中息，@见 04）—— 产出语义从「读侧启发式」改「写侧声明」，是 TD-02-7 收口后同一「数据契约」家族的最后一环；
  2. TD-02-3/4/5/8/10（低息随手还）。
- **DATAFLOW.md**：已追加 `更新(2026-09-12, 四轮)`（画布段三表分工 + 真源位置）。
