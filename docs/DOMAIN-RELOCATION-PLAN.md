# 域归位计划（两阶段）

> **用户 2026-09-19 定的结构**：
> **第一步：先把每个文件夹「放动」—— 进行过滤**（件不在它该在的文件夹 ⇒ 搬过去）
> **第二步：再对这个文件夹内进行过滤**（文件夹内部整理 ⇒ 深模块）
>
> **本文件与 `docs/DOMAIN-MODULES.md` 的分工**：
> · `DOMAIN-MODULES.md` = **判据真源**（§2.0 按事实归属 · §2.0-bis 域 = 用户能指着说的东西 · §3.0 界面位置地图）
> · **本文件 = 施工计划**（两阶段 · 批次 · 每批的验证）
> · `spec/DATAFLOW.md` = **链路/依赖真源**（不定义目录，见 §1.4）

---

## 0 · 判据（先钉死，否则每批都要重吵）

### 0.1 什么决定「件住哪儿」

```
① 件长在界面上哪儿  ⇒ 归那儿（用户判例：PromptInput 是画布上面的东西 · 相机是图片生成节点下的按钮 · 深度视频是视频节点上的 hover 工具）
② 数据落哪儿        ⇒ 定「唯一真源」（数据流轴在这里上岗）
③ 谁跨域消费它      ⇒ 定「门面该露什么」
④ 🔴 同形态不拆      ⇒ 一个 UI 形态的**展开态 / 子部件 / 配套件必须与主件同处一域**
```

**④ 的判据（用户 2026-09-19 指出后立）**：不是「它管的数据叫什么」，而是「**它在界面上是谁的一部分**」。
- ✅ `FullscreenEditor` = `PromptInput` 的**全屏展开态** ⇒ 跟 `PromptInput` 走
- ✅ `ResourceStrip` = prompt 输入区里的**素材条** ⇒ 跟 `PromptInput` 走（不因"素材"二字归素材域）
- ✅ 相机 = 图片生成节点下的**按钮** ⇒ 跟图片节点走
- ⚠️ 反例（我犯的）：把 `ResourceStrip` 判给 `resource/`、`FullscreenEditor` 判给 `canvas/shell/` ⇒ **把一组拆成两域** ✗

**跨域消费不改归属**：A 域的件被 B 域消费 ⇒ 走 A 的门面，**不因此把件搬到 B**。

**禁止**用「名字」判归属（实测三例名字骗人：`prompt/PromptInput` 数据落节点 data · `editors/ImageEditor` 写回同一节点 · `promptHubStore` 落自己的缓存键）。
**禁止**用「宿主数 ≥2 ⇒ 独立能力」（已被用户否掉：`depthVideo` 被 2 节点消费，仍只是视频节点上的 hover 工具）。
**禁止**用「理论上更优雅」或「这样更好找」当理由（好找是**结果**，不是判据）。

### 0.2 深模块 = 验收指标（三条，**机器可测**）

| # | 指标 | 目标 | 实测基线（2026-09-19） |
| --- | --- | --- | --- |
| **① 口子窄** | **消费方文件数**（不是 import 条数） | **1~2** | `agent` **1** ✅ · `videoEditor` **2** ✅ · `director3d` 1 ✅ · **`canvas` 9 ✗** |
| **② 全走门面** | 域外消费是否都经 `域/index.ts` | **100%** | `creative`/`editors`/`video` 100% ✅ · **`canvas` 0%（App.tsx 直连 16 条）✗** |
| **③ 域内有分层** | 大域必须有**子域** | 有 | `videoEditor` 有 ✅ · **`canvas` 机制 17 件平铺 ✗** |

> **范本说明（诚实标注）**：`agent`(56 文件/1 消费方) 与 `videoEditor`(258/2) 是本仓**既有先例**，
> **不是本计划的成果**。它们只证明「**大域 + 窄口**」可行，**不证明**本方法有效 ——
> 本方法要**自己做出一个**才算数（见阶段二 B1：拿 `canvas` 做）。

---

## 1 · 阶段一 · 跨目录归位（「把每个文件夹放动」）

### 1.1 判据

> **一个件的消费者全部落在同一处 X，而它现在不在 X ⇒ 搬去 X。**
> （消费者 = 域，不含装配层 `App.tsx` / `main.tsx`；不含横切编排层 `src/hooks/`）

### 1.2 🔴 三个前提修正（**不修则判不准**）

| # | 前提 | 为什么 | 处置 |
| --- | --- | --- | --- |
| **P1** | **`canvas/nodes/` 混装**（内容能力节点 11 + 画布机制节点 3 + 辅助 hook 1 + 应用入口 2 —— §3.1.3.2 已判定） | 它让「消费者全在 canvas」**失去区分力**：视频/图片/剧本节点的件消费者**全落在 canvas/nodes** ⇒ 全被误判「归 canvas」（实证：`videoEngine`→canvas · `imageUpscale`→canvas · `ScriptBoxFullscreen`→canvas，三条都自相矛盾） | **先做 A1 拆 `nodes/`** |
| **P2** | **门面文件**（`域/index.ts`）会被扫成「消费者在域外」 | 门面是域的**对外出口**，消费者在域外是**正常的** | 扫描时**排除** `**/index.ts` |
| **P3** | **已登记例外**（`director3d` · §6「禁重审」） | 例外优先，不施工 | 扫描时**排除** director3d 相关 |
| **P4** | **被装配层 `App.tsx` 消费的件 ⇒ 横切，不搬** | App 是装配层（§2.5 不计为消费域），它什么都装 ⇒ **被 App 消费 = 跨域通用**的证据，不是"归某个域"的证据。<br>**实证**：`base/core/agentKeys.ts` 被 **App + agent 5 处**共用 ⇒ 我的扫描（discard 装配层后只剩 agent）误判"归 agent"，但 §7 早已裁定它是**横切契约** | 扫描时**不能简单 discard 装配层** —— 命中即**排除**（不搬） |

### 1.3 批次

| 批 | 内容 | 依据 | 状态 |
| --- | --- | --- | --- |
| **A1** | **拆 `canvas/nodes/`**：内容能力节点归各内容能力（图片 6 / 视频 3 / 文本 1 / 素材 1）· 画布机制节点留 canvas（`GroupNode` `GhostTargetNode` `LoopNode`）· 独立应用入口归各应用（`ScriptBoxNode`→scriptbox · `Director3DNode`→director3d） | §3.1.3.2 归属表 | **待做 · 前置** |
| **A2** | **拆 `base/panels` 的域 UI**（7 件：`FullscreenEditor` `HoverToolbar`→canvas 已做 ✅ · `ResourceStrip` `ResourceLibrary` `ResourcePreview`→素材域 · `GeneratedView`→生成域 · `TaskCenter`→任务域） | §8 S2-9 | 部分（2/7） |
| **A3** | **拆 `base/prompt`**（4 件 → canvas 已做 ✅ · `PromptHub` `promptHubStore` → 提示词域） | §3.1.3.5 ⑥ | 部分（4/6） |
| **A4** | **全仓归位**：用**修好的**扫描器（排除 P2/P3）+ **`refs` 逐件复核** | 本文件 §3 | **待做** |
| **A5** | `components/editors/` → `image/editors/`，删 `editors/` | §5 Q3 裁定 | **待做** |
| **A6** | **拆 `base/store`** —— ⚠️ **它是 A2/A3 的前置**：`resource`/`task`/`generate` 三个域的**真源**都在这里，不拆则 UI 件归位了也是"半个域" | §3.6（一个目录住 8 个域） | **待做 · 前置** |
| **A7** | **中继域**（原 S2-3）：`base/api/{generate,pollTask,relayProxy}` → `api/relay/` + 门面，对齐后端 `ai-relay/`；**生成链路的件不建域**（跨域流程） | §8 S2-3 | **待做** |
| **A8** | **测试与闸同步**：`tests/unit/` 平铺 ⇒ 镜像域结构；`scripts/` 硬编码路径 ⇒ 同步旧路径（`_smoke_checks.cjs` · `check-node-data.mjs` · `check-node-handles.mjs` · `dead-code-baseline.json` · `strict-src-whitelist.json`） | §2.5 / §2.7④ | **待做** |
| **A9** | **DATAFLOW 回改**：每批搬完后同步 `spec/DATAFLOW.md` 的链路清单与 §十六（已改名表） | DATAFLOW §维护规矩 | **每批必做** |
| ~~A5~~ | ~~搬 `editors/` 到图片能力域~~ | §7 已判「`components/editors/` 落点错」 | **待定落点**（图片能力域尚无目录） |

#### A1 明细 · **完整搬移映射表**（`cat` = 产品写死的权威真源）

| 节点 | `cat` | 当前路径 | **目标路径** | 判据 |
| --- | --- | --- | --- | --- |
| `ImageGenerate` | image | `canvas/nodes/` | **`image/nodes/`** | 图片能力 |
| `ImageBoxNode` | image | `canvas/nodes/` | **`image/nodes/`** | 图片能力 |
| `GridSplitNode` | image | `canvas/nodes/` | **`image/nodes/`** | 图片能力 |
| `GridMergeNode` | image | `canvas/nodes/` | **`image/nodes/`** | 图片能力 |
| `PanoramaNode` | image | `canvas/nodes/` | **`image/nodes/`** | 图片能力 |
| `FaceMosaicNode` | image | `canvas/nodes/` | **`image/nodes/`** | 图片能力 |
| `LoopNode` | image | `canvas/nodes/` | **`image/nodes/`** | 图片能力 |
| `AssetNode` | image | `canvas/nodes/` | **`image/nodes/`** | 图片能力（图片视频素材节点） |
| `VideoGenerate` | video | ~~canvas/nodes/~~ | ✅ **`video/nodes/`（已搬）** | 视频能力 |
| `VideoExtractNode` | video | ~~canvas/nodes/~~ | ✅ **`video/nodes/`（已搬）** | 视频能力 |
| `VideoProcessNode` | video | ~~canvas/nodes/~~ | ✅ **`video/nodes/`（已搬）** | 视频能力 |
| `TextGenerate` | text | `canvas/nodes/` | **`text/nodes/`** | 文本能力 |
| `GroupNode` | other | `canvas/nodes/` | **留 `canvas/nodes/`** | 画布机制（`refs`：仅 `NodePalette` + 2 测试） |
| `GhostTargetNode` | （例外） | `canvas/nodes/` | **留 `canvas/nodes/`** | 例外已登记 |
| `ScriptBoxNode` | other | `canvas/nodes/` | **`scriptbox/`** | 独立应用入口 |
| `Director3DNode` | image | `canvas/nodes/` | **留（director3d 例外，禁重审）** | §6 已登记 |
| `useImageHoverActions.tsx` | — | `canvas/nodes/` | **`image/`**（根） | 图片 hover 能力（被图片类节点用） |
| `_template/TemplateNode.tsx` | （非活） | `canvas/nodes/_template/` | **留**（参考蓝本，TD-04-5） | 非活节点，不占 registry |

**A1 验收**：`canvas/nodes/` 只剩 **画布机制节点**（`GroupNode` · `GhostTargetNode` · `_template/`）；
其余 12 件各归其能力域。**域外消费复测**：`base/utils/{imageUpscale,videoEngine,timeline/*}` 不再被一律误判"归 canvas"。

#### A2 明细 · `base/panels` 域 UI（**`refs` 已查证**）

| 件 | `refs` | **目标路径** |
| --- | --- | --- |
| `FullscreenEditor.tsx` | canvas/nodes ×4 | ✅ **`canvas/`（已搬）** |
| `HoverToolbar.tsx` | canvas/nodes ×7 | ✅ **`canvas/`（已搬）** |
| `ResourceLibrary.tsx` | 1 处：`LeftPanel` | **`resource/`** |
| `ResourcePreview.tsx` | 3 处：panels 内 + test | **`resource/`** |
| `ResourceStrip.tsx` | 17 处：canvas ×5（`FullscreenEditor` + nodes ×4）+ `scriptbox/StepShots` | 🔴 **改为 `canvas/shell/`** —— 见下方「同形态不拆」 |
| `GeneratedView.tsx` | 2 处：`LeftPanel` + test | **`generate/`** |
| `TaskCenter.tsx` | 2 处：`LeftPanel` + test | **`task/`** |

> 🔴 **2026-09-19 纠正（用户指出）：`FullscreenEditor` 就是 `PromptInput` 的**全屏展开态**，
> `ResourceStrip` 是展开态里的**素材条** —— 三者是**同一个 UI 形态的组成件**。
> 我此前的 A2 把 `ResourceStrip` 判给 `resource/`、B1 把 `FullscreenEditor` 判给 `canvas/shell/` ⇒ **自相矛盾**（§5 Q2 的裁定**作废**）。
>
> **⇒ 新增硬规则「同形态不拆」**：**一个 UI 形态的展开态 / 子部件 / 配套件，必须与主件同处一域。**
> 判据不是「它管的数据叫什么」（素材引用 ⇒ 素材域），而是「**它在界面上是谁的一部分**」（是 prompt 输入区的一部分 ⇒ 跟 prompt input 走）。
>
> **⇒ 修正后这一组 6 件全部归 `canvas/shell/`**：
> `PromptInput` · `promptChips` · `promptLayout` · `promptMention` · `ResourceStrip` · `FullscreenEditor`
> （`ResourceStrip` 被 `scriptbox/StepShots` 消费 = **域外消费** ⇒ 走 `canvas` 门面，**不因此改归属**。）
| **留 `base/panels`（宿主层，§7 已改判）** | — | app-shell：`LeftPanel` · `PanelBar` · `TopNav` · `SettingsFrame` · `ProjectSelector` · `EmptyCanvasGuide` · `sections/*`；横切 UI kit：`FullscreenModal` · `FullscreenShell` · `ImportMediaModal(+Host)` · `LocalToolConnectModal` · `panel-kit.css` · `creative-library.css` |

#### A3 明细 · `base/prompt`（拆两块）

| 件 | 消费者 | **目标路径** | 状态 |
| --- | --- | --- | --- |
| `PromptInput.tsx` | canvas/nodes ×4 + `FullscreenEditor` | **`canvas/`** | ✅ 已搬 |
| `promptChips.ts` | canvas/nodes ×4 + `PromptInput` + `creativePresets` | **`canvas/`** | ✅ 已搬 |
| `promptLayout.ts` | canvas/nodes ×4 + `FullscreenEditor` | **`canvas/`** | ✅ 已搬 |
| `promptMention.ts` | `PromptInput` · `promptChips`（域内） | **`canvas/`** | ✅ 已搬 |
| `PromptHub.tsx` | 1 处：`LeftPanel` | **`prompt/`** | 待搬 |
| `promptHubStore.ts` | 1 处：`PromptHub` | **`prompt/`** | 待搬 |

#### A4 明细 · 全仓归位（**须在 A1 之后**，`refs` 逐件复核）

已查证可搬（§1.5）：`base/ui/NodeShell.tsx`→canvas · `base/ui/CometParticles.tsx`→canvas ·
`base/ui/attachmentCover.tsx`→agent · `base/utils/volumePolicy.ts`→agent ·
`base/core/videoEditorKeys.ts`→videoEditor · `base/ui/Select.tsx`→scriptbox
**不搬**：`base/core/agentKeys.ts`（横切契约，§7）· `base/panels/ImportMediaModalHost.tsx`（跨装配层）
**剩 24 件候选**：A1 拆完后**逐件 `refs` 复核**再定，不批量照抄扫描器结果。

#### A5 明细 · `components/editors/` → **`image/editors/`**（§5 Q3 裁定）

| 件 | 目标 |
| --- | --- |
| `ImageEditor` · `InlineImageCropper` · `OverlayEditor` · `FaceMosaicEditor` · `PanoViewer` | **`image/editors/`** |
| `CameraStudioPanel` · `cameraStudio.ts` · `cameraParams/*`（4 件） | **`image/editors/`**（相机是图片生成节点下的按钮，§2.0-bis 用户判例） |
| `index.ts` | **删**（并入 `image/index.ts` 的门面，不留双门面） |

**A5 验收**：`components/editors/` 目录消失；`image/editors/` 承接 10 件。

### 1.4 每批后置验证（**不做无意义的测试**）

| 本批改了什么 | 必跑 |
| --- | --- |
| 纯搬移 / 改 import 路径 | `tsc` + `check:arch` + **`vite build`**（碰 `.css` 必跑 —— tsc 查不出 CSS） |
| 改了 `vi.mock` 涉及的件 | **`grep -rn "vi.mock.*<被搬模块>" tests`** 核对（Handoff 硬坑 #1） |
| 每批都做 | **三条指标复测**（§0.2，用 §3 的脚本）· 外部引用复跑（`scan-outside-refs`） |

---

### 1.5 ✅ 已用 `refs` 机械查证的件（**不靠我的脚本**）

> 查证工具：`node scripts/mv-sync-refs.mjs refs <file>`（看「**① 模块引用**」段）
> **纪律**：凡是要搬的件，**必须先用 `refs` 查一遍再动手**；我的 Python 扫描只用来**批量找候选**，
> **不能用来定案**（本会话它已错 3 次）。

| 件 | `refs` 结果 | 判定 |
| --- | --- | --- |
| `base/ui/NodeShell.tsx` | **35 处，全在 canvas**（`lazyNode` + `nodes/` ×11+） | ✅ **归 canvas**（节点通用外壳，与 `PromptInput` 同判例） |
| `base/ui/CometParticles.tsx` | 4 处，**全在 `canvas/edges/`**（`Comet` + `ConnectionLine`） | ✅ **归 canvas** |
| `base/ui/attachmentCover.tsx` | 2 处，全在 agent（`AgentMessage` · `AgentPanel`） | ✅ **归 agent** |
| `base/utils/volumePolicy.ts` | 4 处（agent 2 + tests 2） | ✅ **归 agent** |
| `base/core/videoEditorKeys.ts` | 2 处（`videoEditor/.../storage/service` + test） | ✅ **归 videoEditor** |
| `base/ui/Select.tsx` | 1 处（`scriptbox/GearSettings`） | ✅ **归 scriptbox** |
| `base/core/agentKeys.ts` | **7 处：App.tsx + agent 5 + test** | ❌ **假阳性** ⇒ **横切契约，不搬**（§7 已裁定） |
| `base/panels/ImportMediaModalHost.tsx` | 2 处：**App.tsx + videoEditor** | ❌ **假阳性** ⇒ 跨装配层，**不搬** |
| `base/utils/imageUpscale.ts` | 3 处，消费者 `canvas/nodes/useImageHoverActions` | ⚠️ **P1 阻塞**：§3.1.3.4 判**图片能力**，但消费者在 `nodes/` ⇒ 须等 A1 |
| `base/utils/videoEngine.ts` | 3 处，消费者 `canvas/nodes/VideoProcessNode` | ⚠️ **P1 阻塞**：§3.1.3.5 判**视频能力**，但消费者在 `nodes/` ⇒ 须等 A1 |
| `base/panels/ResourceLibrary.tsx` | **1 处**：`LeftPanel` | ✅ **归素材域**（左栏「素材」页签专用） |
| `base/panels/GeneratedView.tsx` | 2 处：`LeftPanel` + test | ✅ **归生成域**（左栏「生成」页签专用） |
| `base/panels/TaskCenter.tsx` | 2 处：`LeftPanel` + test | ✅ **归任务域**（左栏「任务」页签专用） |
| `base/panels/ResourcePreview.tsx` | 3 处：panels 内 + test | ✅ **归素材域** |
| **`base/panels/ResourceStrip.tsx`** | **17 处：`canvas` ×5 + `scriptbox/StepShots`** | ⚠️ **判不准** ⇒ 见 §6 待裁定 |

**⇒ 小结**：查证 15 件，**11 件成立、2 件假阳性、2 件被 P1 阻塞**。
**结论：A4（全仓归位）必须在 A1（拆 `nodes/`）之后做**，否则约 1/5 的件判不准。
**另**：左栏 4 个页签件（`ResourceLibrary`/`GeneratedView`/`TaskCenter`）**各自只被 `LeftPanel` 消费**
⇒ 它们分属**素材/生成/任务**三个域，不是"面板层"的东西 ⇒ 但**这三个域还没有目录**（见 §6）。

---

## 2 · 阶段二 · 文件夹内过滤（深模块化）

> **阶段一只保证「件在正确的文件夹」；阶段二保证「文件夹内部有结构」。**
> 只有阶段二做完，才谈得上「深模块」（§2.6 三层：域 → 子域 → 深模块）。

### 2.1 **B1 · `canvas` 域内切子域**（G1–G5，依 §3.7）

`canvas/` 现状：**域根平铺 28 件** + `nodes/`(18) + `edges/`(3)。按 §3.7 归属：

| 子域（**目标目录**） | 件（从 `canvas/` 域根搬入） | 子域门面该露什么 |
| --- | --- | --- |
| **`canvas/contract/`**<br>G1 节点数据契约 (5) | `nodeDataSchema` · `nodeDefaults` · `nodePrefs` · `canvasSnapshotSchema` · `nodeImage` | `defaultNodeData` · `applyNodeTypeDefaults` · `INPUT_PANEL_NODE_TYPES` · `ASSET_NODE_SIZE` · `injectNodePrefs` · `sanitizeSnapshotNodes/Edges` |
| **`canvas/structure/`**<br>G2 结构变更与历史 (7) | `groupNodes` · `deriveNodes` · `historyStack` · `structuralSnapshot` · `arrangePack` · `ArrangeConfirm` · `CanvasEdgesContext` | `deleteNodesWithCascade` · `normalizeNodeParents` · `HistoryStack` · `apply/extractStructuralSnapshot` · `isSameStructure` · `CanvasEdgesProvider` |
| **`canvas/shell/`**<br>G3 画布外壳 UI (10) | `NodePalette` · `lazyNode` · `lod` · `PromptInput` · `promptChips` · `promptLayout` · `promptMention` · `FullscreenEditor` · `HoverToolbar` · `canvasContextMenu` | `LodProvider/useLod` · `prefetchHeavyNode` · `menuForState` · `PromptInput`（节点装配用） |
| **`canvas/registry/`**<br>G4 注册表 (1) | `toolRegistry` | `registerTool` · `getTools`（agent 桥） |
| **`canvas/topology/`**<br>G5 事件拓扑 / 同步 (4) | `upstreamLink` · `useCanvasEventSubscriptions` · `canvasSyncBus` · `canvasHotkeys` | `useUpstreamAutoTrigger` · `useProjectBackupIO` · `broadcastCanvasSaved` |
| **域根** | `index.ts`（门面）· `nodes/`（画布机制节点：`GroupNode` · `GhostTargetNode` · `_template/`）· `edges/` | — |

**子域门面形态**：`canvas/<子域>/index.ts`，只露上表右列；**子域内部件不外露**。
**域门面 `canvas/index.ts`** = 各子域门面聚合 + **装配入口**（见 B2）。

**B1 验收**：`canvas/` 域根散件 = **0**（只剩 `index.ts` + 2 个子目录）；5 个子域各 ≥3 件 ✅；
指标 ③（域内有分层）达标。

### 2.2 **B2 · `canvas` 收口**（指标 ② 0% → 100%）

`App.tsx` 现有 **16 条直连内部件**（`refs`/grep 实测），分两类处置：

| 类 | 条目 | 处置 |
| --- | --- | --- |
| **ⓐ 装配入口**（App 必须直连，**属装配契约不是域内部件**） | `buildNodeTypeComponents`(NodePalette) · `CustomEdge` · `ConnectionLine`（建 edgeTypes） · `CanvasEdgesProvider` · `LodProvider` · `ArrangeConfirm` · `GhostTargetNode`(例外登记) | **保留直连**，但门面里**显式命名**为装配入口段（注释标明「这是装配契约，勿当内部件」） |
| **ⓑ 应走门面** | `defaultNodeData` · `applyNodeTypeDefaults` · `INPUT_PANEL_NODE_TYPES` · `injectNodePrefs` · `groupNodes` 系列（5 符号） · `broadcastCanvasSaved` · `useProjectBackupIO` · `useUpstreamAutoTrigger` · `menuForState`+`MenuActionCtx` · `prefetchHeavyNode` · `useLod` | **收进 `canvas/index.ts`**，`App.tsx` 改走门面 |

**验收**：`App.tsx` 里 `from './components/canvas/<内部件>'` 的条数 = **只余 ⓐ 类**；ⓑ 类 = **0**。

### 2.3 **B3 · 其余域内切子域**

| 域 | 现状 | 待办 |
| --- | --- | --- |
| `agent`(56) | 已有子域（panels/runtime/conversation/assistantTable） | 已达范本形态，仅补门面遵守率 |
| `videoEditor`(258) | 已有子域（engine/ui/hooks-cutia/…） | 已达范本形态；§8 S2-5 的内部重构另计 |
| `scriptbox`(17) | 平铺 | 按 Step* / Gear / Schema 切子域 |
| 新域（图片/视频/素材/生成/任务…） | A1–A4 拆出来后再切 | 同 B1 手法 |

### 2.4 **B4 · 门面补齐**

判据（§2.7）：**域外直连「实现件」⇒ 必建门面**；**域外只连「天然入口」⇒ 可选**。
建面后必须**同时收口消费点**（§2.7 判过的 `agent/index.ts` 教训：**光窄不够，门面会被架空**）。

---

### 2.5 域内文件**怎么放置**（目录形态 · 强制）

```
components/<域>/
├── index.ts                 ← 域门面（唯一对外出口）
├── <子域A>/
│   ├── index.ts             ← 子域门面（域内可直连子域件；域外只能经域门面）
│   ├── <件1>.ts
│   └── <件2>.tsx
├── <子域B>/ …
└── <域根散件>.ts            ← 仅当它确实不属于任何子域；目标 = 0
```

| 规则 | 说明 |
| --- | --- |
| **一个件只在一处** | S1 一名一址；重复/浅壳一律删（N3/ADR-0053） |
| **子域 ≥3 件** | 不满 3 件**并入相邻子域**（否则是"假子域"）。<br>⚠️ **此条只约束「子域」，不约束「域」** —— 域由「用户能指着说的东西」定，可以只有 1~2 件（如 `text` 1 件 · `prompt` 2 件） |
| **旧目录必须消失** | 域归位后**不留同名旧目录**（`base/prompt/` · `components/editors/` 都要删）<br>⇒ 否则出现两个 `prompt` / 两个 `editors`，AI 必然找错 |
| **域根只放门面** | 域根散件目标 **0**；现在 `canvas/` 有 27 件散在域根 ⇒ **B1 正是为它** |
| **测试镜像域结构** | `tests/unit/<域>/…`（现状平铺，随 B1 一并调整） |
| **门面位置** | 域门面 `域/index.ts`；子域门面 `域/<子域>/index.ts`（**子域门面不对外**） |

### 2.6 域内文件**怎么写**（命名 · 头注 · 门面 · 厚实现）

**① 命名**
- 件名 = `<域前缀><职责>`（例：`nodeDataSchema` · `canvasSyncBus`）
- **判据：名字里的域前缀 = 它管的「数据/概念」属于哪个域，不是「它被谁调用」**
- 🔴 实测三例名字骗人 ⇒ **每批搬移时必须复查名字**：
  `promptChips`（实为 `@{id:label}` **素材引用**芯片）· `promptLayout`（实为**跨域**对齐基准）· `promptMention`（`@提及` 是**通用输入能力**）

**② 头注必写 6 项**（每个件，缺一不可）

```ts
/**
 * <一句话职责>
 *
 * 【为什么住这里】<归属判据 + 依据章节>        ← 没有这句 = 归属不清，AI 找不到
 * 【唯一真源 / 唯一入口】<数据只有一个写者 / 功能只有一个入口>   ← 有则必写
 * 【关键边】<谁消费我 → 我消费谁>              ← 用 refs 实测，不写凭印象
 * 【禁止】<禁手写等价实现 / 禁绕过本入口>       ← 有则必写
 * 【改动连带点】<改这里还要动哪儿>              ← 有则必写
 */
```

**③ 门面写法**（`域/index.ts` 模板）

```ts
/**
 * <域>门面 —— `components/<域>/` 的**唯一对外出口**。
 *
 * 【域边界】<域根 + 子域 + 各子域职责一句话>
 * 【建面判据（§2.7）】域外直连的是**实现件**（不是天然入口）⇒ **必建**
 * 【宽窄红线】只露域外**真实需要**的符号（refs 实测）；域内件**不暴露** ——
 *            宽门面 = 假收口（把内部结构换个地方暴露）
 * 【装配入口】<若 App.tsx 必须直连的项，在此显式命名并注明"这是装配契约，不是内部件">
 */
/* ── 子域 A ── */
export { a, b } from './<子域A>/index.ts';
export type { AType } from './<子域A>/index.ts';
```

**④ 深模块的「厚实现」怎么达成**

| 三要素 | 做法 | 验收（机器可测） |
| --- | --- | --- |
| **窄门面** | 对外符号 ≤ 域外真实需要（一个不多） | 门面符号数；**删掉未被消费的 re-export**（本会话 canvas/creative 门面各删过 5 个） |
| **厚实现** | 门面背后可以有**很多**文件 —— 厚度不设上限 | 域内文件数（多 = 正常，不是病） |
| **唯一真源** | 数据**只有一个写者** | `refs` 验：写入者数 = 1（>1 即要收口） |

**⑤ 判「是不是深模块」的三问**（每个子域都问）
1. 它的对外入口是**窄**的吗？（≤ 少数几个符号）
2. 它背后**厚**吗？（有实现，不是转发）
3. 它管的**数据只有一个写者**吗？

### 2.7 跨域 / 跨项目的件**怎么办**（三类处置）

| 类 | 判据 | 处置 | 例 |
| --- | --- | --- | --- |
| **① 真横切**（无业务语义） | 被 **≥3 域**消费 + **无任何业务概念** | **留** `base/{core,utils,ui}`，**不搬** | `logger` · `idGen` · `clamp` · `assetUrl` |
| **② 共享契约**（有业务语义 + 跨域） | 被多域消费**且**含业务概念；§7 有裁定留痕 | **独立小域** + 窄门面，**或**按 §7 裁定留横切（二者必居其一，**不悬空**） | `agentKeys`（§7 已裁定横切契约）· `contracts.nodeHandle` |
| **③ 域间桥**（单向） | A → B 单向、**反向 0** | **显式命名**（`XxxBridge`）+ 门面登记 + 注释标「桥」；**不因为有了桥就合并两个域** | `base/media/canvasNodesBridge` · `canvas/toolRegistry`（agent 桥） |

**④ 仓外 / 跨项目**
- 本仓**单仓**，无跨仓件；`scripts/*.mjs` 的闸若**硬编码域清单/路径** ⇒ **每批搬移后必须同步**。
- 🔴 **本会话踩过的假绿**（搬移后闸扫不存在的目录 ⇒ 静默通过）：
  `scripts/_smoke_checks.cjs` · `check-node-data.mjs` · `check-node-handles.mjs` ·
  `dead-code-baseline.json` · `strict-src-whitelist.json`
  ⇒ **铁律：每批搬移后跑 `grep -rn "<旧路径>" scripts tests` 复扫**（本会话已执行）。

---

**B1 是本方法的第一个自证**：做完之后 `canvas` 应当达到 `agent`/`videoEditor` 的形态
（消费方 1~2 · 全走门面 · 域内有子域）。**做不到就说明方法有问题，回去改方法，不是改指标。**

---

## 3 · 测量器（**可复现 · 必须先自检**）

> **血泪教训（本会话 3 次测量出错）**：
> ① 解析 import 时漏 `<dir>/index.ts` ⇒ **所有走门面的 import 全没计入** ⇒ 报「域外消费 0」（假的）
> ② 报「import 条数」而不是「**消费方文件数**」⇒ 数字虚高（`creative` 9 文件报 12）
> ③ 拿既有先例（`agent`/`videoEditor`）当自己方法的证据 ⇒ 循环论证
> ⇒ **铁律：脚本先用「已知答案的用例」自检通过，再报数；报「消费方文件数」，不报 import 条数。**

**三条指标的测法**：
1. **口子窄**：域外消费**方文件数**（去重文件，不是 import 条数）
2. **全走门面**：域外 import 的说明符里，指向 `域/index.ts` 的条数 ÷ 总条数
3. **域内有分层**：域内子目录数 ≥2（且每个子目录 ≥3 件）

**脚本必做的自检**：拿一个已知答案验证（例：`@/components/creative` 必须解析到
`src/components/creative/index.ts`；`canvas/HoverToolbar.tsx` 的消费方必须全在 `canvas/`）。

---

## 4 · 现状基线（2026-09-19 实测 · 供每批复测对比）

| 目录 | 文件数 | **消费方文件** | 判定 |
| --- | --- | --- | --- |
| `agent` | 56 | **1** | ✅ 深模块范本（既有） |
| `videoEditor` | 258 | **2** | ✅ 深模块范本（既有） |
| `director3d` | 28 | 1 | ✅（已登记例外） |
| `creative` | 9 | 5 | ⚠️ 口子不够窄 |
| `editors` | 12 | 6 | ⚠️ 落点待定（应属图片能力） |
| `video` | 6 | 2 | ✅ 口子窄，但域太小（视频零件待迁入） |
| `scriptbox` | 17 | 3 | ⚠️ |
| **`canvas`** | **39** | **9**（`App.tsx` 直连 16 条） | ✗ **三项全不达标** |
| `base/core` | 19 | 189 | 横切层（合理） |
| `base/utils` | 24 | 93 | 横切层（合理） |
| `base/ui` | 25 | 41 | 横切层（合理） |
| `base/store` | 15 | 34 | ✗ 一个目录住 8 个域（§3.6） |
| `base/panels` | 28 | 21 | 宿主层（§7 已改判） |
| `base/prompt` | 6 → **2** | 7 → ? | 拆中（A3 已完成 4/6） |
| `base/storage` | 4 | 12 | 横切 |
| `base/media` | 9 | 5 | 横切协议层（§3.1.4 C-1） |
| `base/api` | 8 | 49 | 横切 |

---

## 5 · ✅ 已按目标裁定（**目标：最正确 · 最清晰 · 最简单**）

> **用户 2026-09-19**：「**如何让它最正确、最清晰、最简单？**这就是目标。照着目标来。」
> ⇒ 三个词各对应一条硬约束：**最正确 = 符合事实归属 · 最清晰 = 与界面一致 · 最简单 = 不发明、照产品。**

| # | 问题 | 裁定 | 依据（三词各落一条） |
| --- | --- | --- | --- |
| **Q1** | 能力域建不建目录？ | **照产品的 `cat` 建 `image` / `text`（`video` 已有）；左栏照界面建 `resource` / `generate` / `task` / `prompt`** | 正确：`cat` 是产品写死的权威真源<br>清晰：与用户在节点面板/左栏看到的**完全一致**<br>简单：**不发明新分类**，照抄产品与界面 |
| **Q2** | `ResourceStrip` 归哪？ | 🔴 **作废 → 改为 `canvas/shell/`** | ~~正确：它管的是素材引用~~<br>**我在这里判错了**：按「数据叫什么」判归属是错的。<br>按 §0.1 ④「同形态不拆」：它是 **prompt 输入区的一部分**（`FullscreenEditor` 里就嵌着它）⇒ **跟 `PromptInput` 走**。<br>被 `scriptbox/StepShots` 消费 = 域外消费 ⇒ 走门面，不改归属。 |
| **Q3** | `components/editors/` 落点？ | **并进 `image/`，删掉 `components/editors/`** | 正确：§3.0 表 C 实测挂在**图片类节点**上<br>清晰：找图片编辑 ⇒ 去图片域<br>简单：**并入新域，不新增目录** |
| **Q4** | 左栏 4 页签？ | **任务→`task` · 生成→`generate` · 素材→`resource` · 提示词→`prompt`** | 正确：各只被 `LeftPanel` 消费，分属四域<br>清晰：页签名 = 目录名<br>简单：一一对应，无映射成本 |

**⇒ 域清单（最终）**：`canvas` · `image` · `video` · `text`（内容能力）· `resource` · `generate` · `task` · `prompt`（左栏）· `agent` · `videoEditor` · `scriptbox` · `director3d`（独立应用）。
**不建目录的**（件数 <3，按 §2.5「子域 ≥3 件」）：多开（`accountsStore` 1 件）· 设置（`SettingsFrame` 1 件）⇒ **暂留 `base/panels`**，长大后独立。

---

## 6 · 🔴 嵌套目录总表（**由 DATAFLOW 17 条链路导出** · 这是最终结构）

> **来源说明**：`spec/DATAFLOW.md` 把每个件平铺在 17 条链路里（事实）。**本表把它嵌套化** ——
> 链路 → 域 → 子域 → 件。

### 6.0 链路可信，链路名不可信

按 DATAFLOW 的**件清单**定归属；**链路标题不作判据**（标题与内容冲突时以内容为准）。

```
src/components/
├── canvas/                    ← DATAFLOW §六 画布/节点（16 件）
│   ├── contract/    G1  nodeDataSchema · nodeDefaults · nodePrefs · canvasSnapshotSchema · nodeImage
│   ├── structure/   G2  groupNodes · deriveNodes · historyStack · structuralSnapshot · arrangePack
│   │                    ArrangeConfirm · CanvasEdgesContext
│   ├── shell/       G3  NodePalette · lazyNode · lod · PromptInput · promptChips · promptLayout
│   │                    promptMention · FullscreenEditor · HoverToolbar · canvasContextMenu · ResourceStrip
│   ├── registry/    G4  toolRegistry
│   ├── topology/    G5  upstreamLink · useCanvasEventSubscriptions · canvasHotkeys
│   └── nodes/            GroupNode · GhostTargetNode · _template/   （画布机制节点）
│
├── image/                     ← DATAFLOW §八（编辑/查看）+ §九（相机）
│   ├── nodes/       ImageGenerate · ImageBoxNode · GridSplitNode · GridMergeNode
│   │                PanoramaNode · FaceMosaicNode · LoopNode · AssetNode
│   ├── editors/     ImageEditor · InlineImageCropper · OverlayEditor · FaceMosaicEditor
│   │                PanoViewer · CameraStudioPanel · cameraStudio · cameraParams/
│   └── hover/       useImageHoverActions        （裁剪/标记/压缩的 hover 动作入口）
│   ⚠️ 建好后 **`components/editors/` 必须消失**，不留同名目录
│
├── video/                     ← DATAFLOW §十（视频，全量重审）
│   ├── nodes/       VideoGenerate · VideoExtractNode · VideoProcessNode   ✅ 已建
│   ├── depthVideo/  （已建；是视频节点上的 hover 工具，非"子域"）
│   └── （待迁）     utils/videoEngine · utils/timeline/{sourceTime,timeScale}
│                    utils/captureFrame · ui/VideoThumbnail · core/videoEditorKeys
│
├── text/                      ← DATAFLOW §六（cat=text）
│   └── nodes/       TextGenerate
│
├── creative/                  ← DATAFLOW §七（创作库 5 分区）✅ 已建
├── resource/                  ← DATAFLOW §五（资产/素材）：resourceStore · ResourceLibrary · ResourcePreview
├── generate/                  ← **左栏「生成」页签**（产出物列表视图）：GeneratedView
├── task/                      ← **左栏「任务」页签**（异步任务中心）：taskStore · TaskCenter
├── prompt/                    ← **左栏「提示词」页签**：PromptHub · promptHubStore
│   ⚠️ 建好后 **`base/prompt/` 必须消失**，不留同名目录
│
│   ⚠️ **「生成」有两个含义，不要混（这正是"名字不可信"的一例）**：
│   · **DATAFLOW §一 生成链路** = **跨域流程**（agent → api/relay → 任务 → 结果 → 回填节点）
│     ⇒ **不是一个域**，其件各留 `base/api`（出站/轮询/代理）与 `agent/runtime`，**不建目录**
│   · **左栏「生成」页签** = 已生成产出物的**列表视图** ⇒ 这才是域 `generate/`，只放 `GeneratedView` 这类列表件
│
├── agent/                     ← DATAFLOW §二（已有，含 assistantTable/表格子系统）
├── videoEditor/               ← DATAFLOW §十（已有，258 件）
├── scriptbox/                 （已有）
└── director3d/                （已登记例外，禁重审）

src/components/base/           ← 横切层（目标形态：只留横切）
├── core/ utils/ ui/           ← 被 ≥3 域消费 + 无业务语义 ⇒ 留
├── api/ storage/ media/       ← 横切协议层（media 经 §3.1.4 C-1 裁定）
├── panels/                    ← 宿主/app-shell 层（§7 已改判，合法依赖各域）
└── store/                     ← ⚠️ 待拆（一个目录住 8 个域）⇒ TASK-006
```

**⇒ 一句话**：**外层目录 = 用户能指着说的「东西」；内层子目录 = 关注点切片；件在最里层。**
DATAFLOW 的链路**照旧维护**（它是依赖/数据流真源，不定义目录）。

---

## 7 · 开工顺序（一屏版）

```
阶段一（先放动）
  A6 拆 base/store       ← 前置：resource/task/generate 的真源在这
  A1 拆 canvas/nodes/    ← 前置：否则判据失效（P1）
  A2 拆 base/panels 域 UI（2/7 已做）
  A3 拆 base/prompt      （4/6 已做；建 components/prompt/ 后删 base/prompt/）
  A5 editors → image/editors（删 components/editors/）
  A4 全仓归位（修好的扫描器 + refs 逐件复核）
  A7 中继域 api/relay/
  A8 测试与闸同步        ← 不做则闸假绿
  A9 DATAFLOW 回改       ← 每批必做
       ↓ 每批：tsc + check:arch + vite build + vi.mock 核对 + 三条指标复测
阶段二（再内部过滤）
  B1 canvas 切子域（G1–G5）  ← 本方法的第一个自证
  B2 canvas 收口 App.tsx（16 条 → 只余装配入口）
  B3 其余域切子域
  B4 门面补齐
```

**每批收工必须做的三件事**：① 提交（一笔）② 回改 `DOMAIN-MODULES.md` 的相关节 ③ 三条指标复测并记进本文件 §4 基线表。
