# TASK-025 · 域主：`canvas`

> **先读 `TASK-022-总纲-域籍判定与交叉验证规程（全批必读）.md`** —— 判据、四件证据、成因代号、输出格式、交叉验证协议全在那里，本文件只给**你的领地**和**本域特有事项**。
> **你只能写这个文件**：`docs/agent 批量任务/TASK-025-域主-canvas.md`。**碰任何其他文件视为失败。**
> **本轮只登记，不搬。**（不许 `git mv`、不许改 `src/**`）

## 1. 领地（逐件，不许抽样）

```
src/components/canvas/**       # 约 50 件，递归全部
```

实测子目录：`contract/` · `structure/` · `shell/` · `parts/` · `topology/` · `edges/` · `nodes/`，域根有 `index.ts` · `toolRegistry.ts` · 其它散件。
**不含**（别越界）：`base/**`（TASK-028）· `src/hooks/**`（TASK-029）· 别域的 `nodes/`（已按域分居，不在你地）。

## 2. 本域计划内结构（判「域内错位」的比对基准）

来自 `docs/plan/域归位-最终执行计划.md` §3（**目标**，不是现状）：

```
canvas/
├── contract/    nodeDataSchema · nodeDefaults · nodePrefs · canvasSnapshotSchema
├── structure/   groupNodes · deriveNodes · historyStack · structuralSnapshot
│                arrangePack · ArrangeConfirm · CanvasEdgesContext
├── shell/       NodePalette · lazyNode · lod · PromptInput · promptChips · promptLayout
│                promptMention · FullscreenEditor · HoverToolbar · canvasContextMenu
│                ResourceStrip · CanvasToolbar · EmptyCanvasGuide · ContextMenu
├── parts/       NodeShell · NodeTitle · CustomHandle · GenerateButton · GeneratingOverlay
│                ExpandablePanel · ResizeFullscreenHandle · JianyingIcon · ToolbarButton
├── topology/    upstreamLink · useCanvasEventSubscriptions · canvasHotkeys
├── toolRegistry.ts   ← **计划指定留域根**（1 件，不足 ≥3 件门槛；**不建** registry/）
└── nodes/       GroupNode · GhostTargetNode · _template/ · Director3DNode（例外）
```

**留域根的唯一例外**：`toolRegistry.ts`。除它 + `index.ts` + 计划另有注明的装配入口外，域根出现任何件 = **域根散件**。

## 3. 本域特有事项（必须逐条给结论）

1. **域根散件（D1）**：域根实际有 `backupStore.ts` 等件。**逐件**判：它属本域哪一层（视图/机制/能力）⇒ 应入哪个子目录。若你认为它**不属本域**，按 §4 走（四件证据），别自己搬。
2. **`edges/` 不在计划树里（判据缺口 · 必答）**：实测有 `edges/`，但计划 §3 的 canvas 树**没列它**（计划把 `CanvasEdgesContext` 放 `structure/`、把 `CometParticles` 放 `edges/`）。请给结论：`edges/` 是 ① 计划漏写应补 ② 应并入 `structure/`。写进「判据缺口」并给依据，**不要**自行认定。
3. **`nodes/` 分居复核（本域最重要的一问）**：
   - `git log --oneline -1 9e3e41e9` 是「拆 `canvas/nodes` —— 11 件节点按产品 cat 归位」，即**上一轮已经把 11 件节点按域搬走**。
   - 你的活：判**现在留在 `canvas/nodes/` 的每一件是否都该留**（画布机制件），以及**域内其余地方是否还藏着本该在别的能力域的节点**。
   - 判据只用 L1 两条（界面长在哪 / 数据落哪）。**"节点都该在 nodes/ 下"不是判据。**
4. **`App.tsx` 直连收口**：计划要求 `App.tsx` 里 `from './components/canvas/<内部件>'` **= 0**（只余门面 + 显式装配入口 ⓐ：`buildNodeTypeComponents` · `CustomEdge` · `ConnectionLine` · `CanvasEdgesProvider` · `LodProvider` · `ArrangeConfirm` · `GhostTargetNode`）。请实测现状并列出**仍直连本域内部件**的行（`文件:行`）。
5. **`index.ts` 门面**：是否把 `contract/` · `structure/` · `topology/` 的内部件**全部**外泄（门面应是收口而非敞口）——给结论。
6. **`parts/` 是否混职责（D3）**：`parts/` 里应只有"零件"（`NodeShell` · `NodeTitle` · `CustomHandle` · `GenerateButton` …）。若发现 store / 算法件混入 ⇒ 假子域。
7. **域内分层方向（D4）**：对 `structure/` · `parts/` · `topology/` 各抽 3 件跑 `refs`，看有没有**能力层反向依赖视图层**（例：`structure/` import `shell/`）。
8. **域内成环**：canvas 是"节点机制中枢"，最易成环。请对本域内部 import 做一次环检查（用 `grep -rn "^import" src/components/canvas | ...` 人工看，**不许新建脚本**），有环就登记。

## 4. 线索（只是线索 · 不是结论 · 可能已过期）

> **不要照抄**。每条用 `refs`/`ls`/`grep` 现场复核；对不上按实测记录，并标进「描述过期」。

- `TD-25-20`：`base/core/nodeSizePatch.ts` —— 判"应属 canvas"但**被 `base/core/uiHooks`（54 refs）消费 ⇒ 可能成因 D 锁死**。这件的**判定权在 TASK-028（base 域主）**，你这边只在**收到它送来时**复核；本轮不必主动判。
- `TD-25-21`：`base/store/backupStore.ts`（仅被画布相关件消费）—— 同上，是否搬到 canvas 由 base 域主报送。
- `TD-25-27` / `TD-25-28`：`src/hooks/useCanvasHistory.ts` · `useContextMenu.ts` → 若真属 canvas，由 TASK-029 报送，你复核。
- **成因 B 的真实案例（必须复核本域内有无同类残留）**：2026-09-19 A2 把节点搬出 `canvas/nodes` 后，两处闸仍拼旧路径 ⇒ `npm run build` 硬红（`check-node-handles` 豁免失灵）+ `check-node-data` 3 条路径 stale。请跑：
  ```bash
  grep -rn "canvas/nodes" src scripts tests docs --include='*.ts' --include='*.tsx' --include='*.mjs' --include='*.cjs' --include='*.json' --include='*.md'
  ```
  把**仍指向旧路径**的位置列进「旧路径残留」（文件:行 → 旧路径 → 影响）。
- `TD-18-34`：「画布域分裂」原始描述写的是 `base/canvas` —— **该目录已不存在**（成因 G 实例）。请查清这笔记的真实所指（若有分裂，分裂点在哪）。

## 5. 输出

按 **TASK-022 §7** 的格式（主表 + 8 个末尾小节）。**域籍判定列只许四种**。

## 6. 验收补充（除 TASK-022 §9 外）

- [ ] `find src/components/canvas -type f | sort` 的**每一件**都在主表出现。
- [ ] 「`nodes/` 分居复核」对 `nodes/` 现存**每一件**给了独立判定 + L1 证据。
- [ ] 「`edges/` 不在计划树」「域根散件」「App.tsx 直连」「门面外泄」四问**各有明确结论**。
- [ ] 跑过第 4 条的 `grep` 并把旧路径残留列全。
