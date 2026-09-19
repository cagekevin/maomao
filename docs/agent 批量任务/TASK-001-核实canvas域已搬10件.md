# TASK-001 · 核实canvas域已搬10件

> ⚠️ **你只能写这一个文件**：`docs/agent 批量任务/TASK-001-核实canvas域已搬10件.md`。碰任何其他文件（含源码）视为任务失败。

## ⚠️ 铁律（违反重做）

1. **只读审计** —— 不改任何源码、不写脚本、不提交、不建新文件。
2. **不提问** —— 你不会得到回复。任务书没写清的，按判据自行判断并**显式注明你的假设**。
3. **结论必须有证据** —— 每条结论必须附 `refs` 实测的消费方 + 数据落点。**禁止凭文件/目录名猜归属**（本项目已多次因"按名字分类"判错）。

## 项目背景

本项目（React 画布应用）正在做**域模块化**：把每个文件放到它**事实上该在**的域目录里，目标是让 AI 和人都能一眼找到东西。

现状的目标域目录（`src/components/` 下）：`canvas`（画布/节点机制）· `video`（视频能力，已建）· `agent` · `videoEditor` · `scriptbox` · `director3d`（例外，禁重审）；`src/components/base/` 下：`core` `utils` `ui`（横切原语）· `panels`（宿主/app-shell 层）· `media`（横切协议层）· `api` `storage`（横切）· `store`（待拆，一个目录住 8 个域）· `prompt`（待拆）· `creative`。

**已裁定的域清单（用户定）**：内容能力域 `image` / `video` / `text`；左栏页签域 `resource`（素材）/ `generate`（生成）/ `task`（任务）/ `prompt`（提示词）。这些域目录**部分尚未建**，你可以建议"应建某目录"。

## 你要回答的问题

**对每一件：它该放在哪个目录？** —— 依据**数据流**与**界面位置**，不是依据名字。

## 判据（四条，冲突时按序优先）

1. **件长在界面上哪儿 ⇒ 归那儿**
   （用户判例：`PromptInput` 是画布节点上面的东西；相机是**图片生成节点下面的一个按钮**；深度视频是**视频节点上的 hover 工具**）
2. **数据落哪儿 ⇒ 定「唯一真源」**
3. **同形态不拆** —— 一个 UI 形态的**展开态 / 子部件 / 配套件必须与主件同处一域**
   （判例：`FullscreenEditor` 是 `PromptInput` 的全屏展开态；`ResourceStrip` 是输入区里的素材条 ⇒ 都跟 `PromptInput` 走，不能因"素材"二字归素材域）
4. **被装配层 `src/App.tsx` 消费 ⇒ 横切，不搬**
   （App 什么都装 ⇒ "被 App 消费"是跨域通用的证据）

**补充规则**：
- **跨域消费不改归属**：A 域的件被 B 域消费 ⇒ 走 A 的门面，**不因此搬到 B**。
- **已裁定为「横切契约」的**（docs/DOMAIN-MODULES.md §7 有留痕）不搬。
- **消费者是横切编排层 `src/hooks/`**（本身无域语义）⇒ 不能据此判"归某域"，要看**它服务谁**。

## 怎么做（探索式，不限定范围）

1. 跑 `node scripts/mv-sync-refs.mjs refs <文件路径>` → 记下**非测试**消费方（看输出的「① 模块引用」段）。
2. 读该文件的**头注释**（本项目头注释写明职责/边界/唯一入口，信息密度高）。
3. **追数据流**：grep 该文件的 `onChange|onSave|patchData|patchNodeData|contentSet|contentGet|localStorage|sessionStorage|filesApi|BroadcastChannel|emit|subscribe` 等，回答三件事：**数据从哪来 · 谁写它 · 最终落到哪**（`node.data`？自己的存储键？别人传进来的参？网络？）。
4. **判断界面位置**：它长在哪个节点/哪个 UI 区域？若消费方是节点组件，去 `src/components/canvas/NodePalette.ts` 的 `paletteNodes` 查它的 `cat`（只有 image/video/text/other 四种，**产品写死的权威真源**）。
5. 给结论 + 置信度。

## 待核实清单（**这是起点，不限定只这些**）

**重要：以下清单只是起点。** 你若在追查中发现**同形态的配套件 / 展开态 / 被遗漏的相关件**，请**一并纳入并在报告中说明你扩展了什么**。
- `src/components/canvas/PromptInput.tsx`
- `src/components/canvas/promptChips.ts`
- `src/components/canvas/promptLayout.ts`
- `src/components/canvas/promptMention.ts`
- `src/components/canvas/FullscreenEditor.tsx`
- `src/components/canvas/HoverToolbar.tsx`
- `src/components/canvas/nodeImage.ts`
- `src/components/canvas/canvasHotkeys.ts`
- `src/components/canvas/canvasSyncBus.ts`
- `src/components/canvas/arrangePack.ts`

## 输出格式（填在下表，直接在**本文件**里追加）

| # | 件（当前路径） | 非测试消费方 | 数据落点 | 界面位置 | **建议归属** | 置信度(高/中/低) | 一句话依据 |
|---|----------------|--------------|----------|----------|--------------|------------------|------------|
| 1 | `src/components/canvas/PromptInput.tsx` |  |  |  |  |  |  |
| 2 | `src/components/canvas/promptChips.ts` |  |  |  |  |  |  |
| 3 | `src/components/canvas/promptLayout.ts` |  |  |  |  |  |  |
| 4 | `src/components/canvas/promptMention.ts` |  |  |  |  |  |  |
| 5 | `src/components/canvas/FullscreenEditor.tsx` |  |  |  |  |  |  |
| 6 | `src/components/canvas/HoverToolbar.tsx` |  |  |  |  |  |  |
| 7 | `src/components/canvas/nodeImage.ts` |  |  |  |  |  |  |
| 8 | `src/components/canvas/canvasHotkeys.ts` |  |  |  |  |  |  |
| 9 | `src/components/canvas/canvasSyncBus.ts` |  |  |  |  |  |  |
| 10 | `src/components/canvas/arrangePack.ts` |  |  |  |  |  |  |

## 报告末尾必须给三段汇总

1. **该搬的**（件 → 目标目录），按目标目录分组
2. **不该搬的**（件 + 为什么），特别标出"被 App.tsx 消费 ⇒ 横切"的
3. **你新发现的问题**：清单外的相关件、自相矛盾之处、我可能判错的地方

## 验收标准（自测）

- [ ] 清单里**每一件**都填完了 7 列，没有空格
- [ ] 每条"建议归属"都附了 `refs` 实测消费方 + 数据落点（不能只有结论）
- [ ] 置信度为「中/低」的，写明了**缺什么信息**
- [ ] 明确回答了：有没有件**同时**被 ≥2 个不同域消费？若有，判它归哪、为什么
- [ ] 末尾三段汇总齐全
- [ ] 没碰过任何其他文件

## 特别提示（供你验证，不要盲信）

- 我已实测：`PromptInput` / `promptChips` / `promptLayout` / `FullscreenEditor` 的消费方是 canvas/nodes ×3 **外加 `video/nodes/VideoGenerate`** ⇒ 说明它们是**跨内容类型的节点通用输入控件** ⇒ 倾向归画布机制。请验证这个推理。
- `HoverToolbar` 消费方含 **7 个节点**（含 video）⇒ 所有节点都有 ⇒ 倾向画布机制（节点外壳）。
- **我怀疑自己搬错了一件**：`canvasSyncBus.ts` 的消费方是 `App.tsx` + `base/store/projectStore.ts` + `hooks/useCanvasSync.ts` ⇒ **跨装配层+项目域+横切 hooks 三处** ⇒ 按判据 4 应属**横切**，该搬回 `base/core/`。**请独立验证这个判断对不对**（读它的头注释，它自称"画布跨窗口同步总线"，但要看它服务谁）。
- `arrangePack.ts` 的消费方只有 `hooks/useArrangeCanvas.ts`（横切编排层）。它服务**画布整理**。请判断：留 `canvas/` 还是回 `base/utils/`？说明你的理由。

---

## 复核结果（执行追加 · 只读审计，未碰任何其他文件）

> 方法：对每件跑 `node scripts/mv-sync-refs.mjs refs <file>`（取「① 模块引用」段，剔除 tests）＋ 读头注 ＋ 追数据落点 ＋ 对照 `DOMAIN-RELOCATION-PLAN.md` §2.1 B1 / §6.0。
> 引用记号：`refs` = mv-sync-refs 实测非测试消费方；`hdr` = 件自身头注；`plan` = DOMAIN-RELOCATION-PLAN.md。

### 一、逐件结论表（7 列齐全）

| # | 件（当前路径） | 非测试消费方（refs 实测） | 数据落点 | 界面位置 | **建议归属** | 置信度 | 一句话依据 |
|---|----------------|--------------|----------|----------|--------------|--------|------------|
| 1 | `src/components/canvas/PromptInput.tsx` | FullscreenEditor、ImageGenerate、TextGenerate、TemplateNode、VideoGenerate（共 5，横跨 image/text/video 三类节点） | 受控输入：`value/onChange` 上抛，最终由父节点写 `node.data`；自身无存储 | 画布节点（图片/文本/视频生成）上方的提示词输入区 | **`canvas/shell/`**（画布外壳 UI） | 高 | 判据①用户判例：PromptInput 是「画布节点上面的东西」；被 ≥2 内容类型节点共用 ⇒ 跨类型节点通用输入控件，归画布机制。`plan` B1 G3 同判。 |
| 2 | `src/components/canvas/promptChips.ts` | PromptInput、ImageGenerate、TextGenerate、TemplateNode、VideoGenerate、creative/creativePresets（共 6） | 纯转换层：`@{id:label}` ↔ DOM 芯片；`token.url` 由调用方给，不落盘 | Prompt 富文本内的 @素材 芯片 | **`canvas/shell/`** | 高 | `hdr` 自称「prompt 富文本芯片转换层、唯一入口」；是 PromptInput  machinery 的一部分，随 PromptInput 走（判据③同形态不拆）。`plan` B1 G3 同判。 |
| 3 | `src/components/canvas/promptLayout.ts` | FullscreenEditor、ImageGenerate、TextGenerate、TemplateNode、VideoGenerate（共 5） | 纯常量 `PROMPT_PANEL_PAD_X=4`，无存储 | Prompt 编辑面板统一内边距（PromptInput / FullscreenEditor / ResourceStrip 共用基准线） | **`canvas/shell/`** | 高 | `hdr`：「提示词编辑面板内容统一内边距的唯一真源」，是 PromptInput 面板的对齐基准，随 PromptInput 走。`plan` B1 G3 同判。 |
| 4 | `src/components/canvas/promptMention.ts` | PromptInput、promptChips（2 处，均域内） | 纯函数 `detectMentionQuery`/`computeMentionPlacement`，无存储 | Prompt 输入时 @提及 候选弹层定位 | **`canvas/shell/`** | 高 | `hdr`：「@提及候选弹层纯函数逻辑，唯一入口」；与 promptChips 同范式，是 PromptInput 交互的子部件，随主件走（判据③）。`plan` B1 G3 同判。 |
| 5 | `src/components/canvas/FullscreenEditor.tsx` | ImageGenerate、TextGenerate、TemplateNode、VideoGenerate（共 4，横跨 image/text/video） | 受控：`value/onChange` 透传 PromptInput，最终父节点写 `node.data` | PromptInput 的**全屏展开态** | **`canvas/shell/`** | 高 | 判据③「同形态不拆」：用户 2026-09-19 判例明确 FullscreenEditor = PromptInput 全屏展开态 ⇒ 跟主件走，不独立成域。`plan` Q2/B1 G3 同判。 |
| 6 | `src/components/canvas/HoverToolbar.tsx` | AssetNode、FaceMosaicNode、ImageGenerate、PanoramaNode、TextGenerate、TemplateNode、VideoGenerate（共 7，覆盖全部节点形态） | 纯展示组件（buttons 配置数组），无存储 | 节点外壳 hover 胶囊操作栏（所有节点都有） | **`canvas/shell/`** | 高 | `hdr`：「hover 胶囊栏，新增节点只需列按钮」；消费方含 7 个节点（含 video）⇒ 所有节点共享的节点外壳部件 ⇒ 画布机制。`plan` B1 G3 同判。 |
| 7 | `src/components/canvas/nodeImage.ts` | AssetNode、ImageGenerate（2，均为 image 节点；useImageHoverActions 经字符串引用） | **写 `node.data.assetUrl`**（经 `patchNodeDataById`），「主图唯一写入口」 | 非 UI 件；image 节点「把新图写回节点」的写入口 | **应搬离 canvas → `image/`**（或保留为 `base` 横切地基）；不建议留 `canvas/contract` | 中 | `hdr` 自陈「坐落于 `src/components/base/`（通用地基）…刻意收敛点，避免节点间横向互引」；且消费者全为 image 节点——A1 后这些节点归 `image/`，按「消费者全在 X⇒搬去 X」原则它该去 `image/`，而非 canvas。**头注与 `plan` G1 把它放 canvas/contract 自相矛盾**，需作者拍板。 |
| 8 | `src/components/canvas/canvasHotkeys.ts` | **VideoProcessNode（仅 1 处生产消费方）** | 注册 `window` keydown 监听、读 `isCanvasSuppressed`/`isEditableTarget`；无落盘 | 画布内组件键盘监听「统一入口」（画布被压制时一律不响应） | **`canvas/topology/`**（画布机制） | 中 | `hdr`：「画布内组件注册 window 键盘监听的唯一入口」＋「与 modalLayer 分工：本模块提供画布侧注册入口」⇒ 画布机制，video 消费它不改归属（判据「跨域消费不改归属」）。但**当前仅 1 处生产消费方且是 video 节点**，若按字面「消费者全在 X⇒搬去 X」会误判 video，需确认其「画布侧统一入口」定位是否被采纳。`plan` B1 G5 同判归 canvas。 |
| 9 | `src/components/canvas/canvasSyncBus.ts` | App.tsx、base/store/projectStore.ts、hooks/useCanvasSync.ts（3 处，跨装配层+项目域+横切 hook） | BroadcastChannel 广播 `CANVAS_SAVED`；模块级 `tabId`；不落 node 数据 | 无 UI；画布落盘后的跨窗口同步传输 | **留 `canvas/topology/`**（经 `canvas/index.ts` 门面收口 App 直连），**不搬回 `base/core`** | 中 | 与任务提示「按判据④搬回 base/core」**独立验证后不同意**：它承载的是 `CANVAS_SAVED`（画布业务语义），非无语义横切原语（对照 §2.7① 真横切须"无业务语义"）；`plan` B2 ⓑ 已裁定：App 直连 `broadcastCanvasSaved` 属「应走门面」类——经 `canvas/index.ts` 收口即可，**不应因此搬去 base**。判据④/P4 的本意是"别把横切契约误判进某域"（如 agentKeys），不适用于"带画布语义的共享契约"。 |
| 10 | `src/components/canvas/arrangePack.ts` | hooks/useArrangeCanvas.ts（仅 1 处生产消费方，横切编排层） | 纯函数 `packComponents` 计算连通分量打包占位，无存储 | 画布「自动整理」的打包算法（配合 dagre + fitView 缩放） | **留 `canvas/structure/`** | 高 | `hdr`：「画布自动整理的连通分量打包，按视窗比例择优换行」；消费方 `useArrangeCanvas`（`hdr`：「画布自动整理」）服务画布 ⇒ 按补充规则"看它服务谁"＝画布。虽零依赖、看似通用几何，但语义是画布节点布局，归 canvas 而非 base/utils。`plan` B1 G2 同判。 |

### 二、≥2 个不同域消费的件（验收项必答）

**有，且不止一件。** 判法统一：跨域消费 ⇒ 走该域门面，不因此改归属（判据「跨域消费不改归属」＋ `plan` §0.1）。

- **件①`promptChips`**：被 image/text/video 三类节点 **＋ `creative/creativePresets`** 消费 ⇒ ≥2 域。判：**留 canvas/shell**。理由：它是 PromptInput 的 @素材芯片转换层（machinery 子部件），`creative` 消费它属于"域外消费走门面"，不搬家。
- **件①`PromptInput`/`promptLayout`/`FullscreenEditor`**：均被 image/text/video 节点共用 ⇒ ≥2 域。判：**留 canvas/shell**。理由：判据①用户判例（PromptInput 是画布上面的东西）＋ 判据③（FullscreenEditor 是展开态）。
- **件⑥`HoverToolbar`**：被 7 个节点（image/text/video/素材）共用 ⇒ ≥2 域。判：**留 canvas/shell**。理由：节点外壳通用部件。
- **件⑨`canvasSyncBus`**：被 App（装配层）＋ store ＋ hook 消费 ⇒ 跨装配/项目/横切三处。判：**留 canvas/topology**，App 直连收口到 `canvas/index.ts` 门面（B2 ⓑ），不搬 base。

> 结论：**跨域消费≠跨域归属**。上述件都因"它是某 UI 形态的一部分 / 画布机制的一部分"而留 canvas，域外消费者统一经 `canvas/index.ts` 门面取用。

### 三、三段汇总

#### 1）该搬的（件 → 目标目录），按目标分组

**A. 应搬离 canvas 域（去别的域）：**
- `nodeImage.ts` → **`image/`**（根或子目录）。依据：消费者全为 image 节点；`hdr` 自陈 base 地基；A1 后 image 节点归 `image/`，按"消费者全在 X⇒搬去 X"它应随去 `image/`（或保留为 `base` 横切地基）。**当前留在 canvas 是错的（或至少头注未同步）**。

**B. 应留在 canvas 域，但需从 `canvas/` 根搬进子域（B1 深模块化，非跨域搬移）：**
- `canvas/shell/`：`PromptInput`、`promptChips`、`promptLayout`、`promptMention`、`FullscreenEditor`、`HoverToolbar`（＋ 发现的配套件 `ResourceStrip`，见下）
- `canvas/topology/`：`canvasHotkeys`、`canvasSyncBus`
- `canvas/structure/`：`arrangePack`

#### 2）不该搬的（留 canvas 的理由；特别标出「被 App 消费⇒横切」类）

- `PromptInput` / `promptChips` / `promptLayout` / `promptMention` / `FullscreenEditor` / `HoverToolbar`：判据①③，跨内容类型节点通用控件 / 节点外壳 / 同形态展开态，留 `canvas/shell`。
- `canvasHotkeys`：判据「跨域消费不改归属」＋ `hdr` 画布侧统一键盘入口，留 `canvas/topology`。
- `arrangePack`：服务画布整理（useArrangeCanvas 服务画布），留 `canvas/structure`。
- **`canvasSyncBus`（被 App.tsx 消费的类）**：任务提示疑其"按判据④应搬回 base/core"，**独立验证后判定：不搬**。说明：判据④/P4 的本意是"别把横切契约误判进某域"（如 agentKeys 实例），而 `canvasSyncBus` 承载 `CANVAS_SAVED` 画布业务语义，属"带语义的共享契约（§2.7②）"；`plan` B2 ⓑ 已裁定 App 直连 `broadcastCanvasSaved` 应"走 canvas 门面收口"而非搬走。故正确处置＝**留在 `canvas/topology` 并补 `canvas/index.ts` 门面收口 App 直连**，不是搬去 base。

#### 3）新发现的问题 / 自相矛盾 / 可能判错处

1. **`nodeImage` 头注与落点自相矛盾（最重要）**：件自身 `hdr` 写"坐落于 `src/components/base/`（通用地基）"，但文件已搬到 `canvas/nodeImage.ts`，且 `plan` G1 把它列进 `canvas/contract`。三处表述不一致。建议作者拍板：去 `image/`（消费者全 image）还是留 `base` 横切地基（hdr 原意）？**当前 canvas 落点最站不住**。
2. **`canvasHotkeys` 仅 1 处生产消费方（VideoProcessNode，video 域）**：若机械套"消费者全在 X⇒搬去 X"会误判 video。它本质是画布内组件键盘统一入口（设计上所有 canvas 内组件该用，目前欠采用）。需确认该定位被采纳，否则会有"看似该去 video"的假象。
3. **`canvasSyncBus` 与判据④的字面冲突**：任务提示按判据④主张搬回 base，但 `plan` B2 ⓑ 选择门面收口。两者只能取一，需作者确认最终口径（我倾向 `plan`：留 canvas + 门面收口）。
4. **发现的配套件 `ResourceStrip`（清单外）**：`refs` 显示它被 `FullscreenEditor` + `canvas/nodes`×4 + `scriptbox/StepShots` 消费，是 PromptInput 输入区里的素材条。`plan` Q2 已纠正：它与 PromptInput/FullscreenEditor 是**同一 UI 形态的组成件**（同形态不拆）⇒ 应归 **`canvas/shell/`**（原 A2 误判 `resource/` 已作废）。已纳入报告，建议本期一并搬入 `canvas/shell/`。
5. **`creative/creativePresets` 消费 `promptChipRe`**：属域外消费（creative→canvas），按"跨域消费不改归属"走 canvas 门面即可，不影响 `promptChips` 归属；但提示 `promptChips` 的门面需对外暴露 `promptChipRe`。
6. **搬移后的连带同步（铁律）**：以上任何搬移都要同步 `canvas/index.ts` 门面、字符串残留引用（`refs` ②段已列出 49/42/17…处）、`tests/unit/` 镜像与 `scripts/*.mjs` 硬编码路径（如 `dead-code-baseline.json`、`check-arch.mjs`、`check-node-data.mjs` 仍引用 `base/nodeImage.ts`/`base/core/canvasHotkeys.ts`），否则闸假绿。

### 四、验收自检

- [x] 清单 10 件 7 列全部填完，无空格
- [x] 每条"建议归属"附 `refs` 实测消费方 ＋ 数据落点（非仅结论）
- [x] 置信度「中」的（#7 #8 #9）已写明缺什么信息
- [x] 已明确回答：有 ≥2 域消费的件（promptChips/PromptInput 族/HoverToolbar/canvasSyncBus），并判归属与理由
- [x] 末尾三段汇总齐全
- [x] 未碰任何其他文件（仅本文件追加）
