# 域模块化 · 鱼塘地图 / 冲突裁决 / 安全移名移位 SOP

> **最终目标（用户 2026-09-19）**：把每个域构造成**新模块**，从而**提升改码效率**。位置划分与改名都是服务于这个目标的手段。
> **定位**：本文件是域模块化的**唯一蓝图**。
> **效力**：`CLAUDE.md` 物理红线 > `docs/adr/` 判据 > **本文件** > 区域日志。
> **判据真源分工（防 SSOT 第二份）**：
> - 判据本体 → `docs/adr/`（`adr.mjs add`），本文件只引用。
> - **改名四步法**（符号 + 字符串标识 + 文件名）→ `docs/节点重命名安全操作手册-2026-09-08.md`，本文件只引用。
> - 执行证据 → `daily/架构日志/` 轮次文件。
> **推进方式**：做一段 → 回填 §8 进度表。

---

## 1 · 第一步的目标：分清有哪些鱼

**一句话**：把 `src/` 与 `localTool/src/` 的**每一个文件**判定为「装配层 / 横切地基 / 域 / 游离物」之一，给出真实归属与可复现证据。

**为什么必须先做**：名字由域决定、位置由域决定。域判错 → 名字必错（实证：`canvasHost` 住 agent 域却叫 canvas）。

**产出物**：① 鱼塘地图（§2）② 归属判定（§3）③ 游离物清单（§3.4）④ 冲突裁决（§4）。

**完成判据（缺一不算做完）**：
- [ ] **无空格**：每个文件都能在归属表找到一行（含"待批次取证"也算有归属）；
- [ ] **可复现**：每条判定带 `file:line` 或 import 命中证据；
- [ ] **处置明确**：游离物每项写明「迁出 / 提级 / 删壳 / 删死代码」；
- [ ] **无未决冲突**：与既有约定/裁定冲突处**已裁决**（§4），或明确标为"需用户拍板"（当前：0 项）；
- [ ] **旧错判已回改**：§7 修订记录载明被推翻的判断。

---

## 2 · 判据（**本文件最核心的一节** —— 判据错了，后面全错）

### 2.1 四类水/鱼

| 类 | 判据 | 命名 |
| --- | --- | --- |
| **装配层** | 进程入口/根装配（`App.tsx`·`main.tsx`·`localTool/src/index.ts`） | 无名缀 |
| **横切地基** | **无业务语义**的通用原语（`logger`/`clamp`/`contentSet`/`httpRequest`/`idGen`/`contracts`） | **通用名** |
| **域** | 面向**同一业务关注点**的一坨（**含业务语义**）——**哪怕被多域消费** | **域前缀强制** |
| **游离物** | 住在与真实归属不符的位置 | 迁出/提级/删壳 |

### 2.2 🔴 **判据修正 P1（推翻我上一版）**：「被 ≥2 域消费 = 横切」**不成立**

**错在哪**：把"共享程度"当成了"性质"。反例——`base/store/taskStore`（被 12 处跨域消费）、`base/api/generate`（被 scriptbox+agent+canvas 消费）、`base/media/mediaRefRegistry`（被 videoEditor+panels 消费）：它们**全是某域的真源/能力**，不是"通用原语"。

**正确判据**：**看它有没有业务语义**。

| 判据 | 例子 | 类 |
| --- | --- | --- |
| 无业务语义（不含任何域的数据/概念） | `logger` · `contracts` · `contentStore` · `idGen` · `utils.ts` · `httpClient` · `pagedList` · `assetType` · `uploadDirs` | **横切** |
| 有业务语义（管某域的数据/能力），只是**被多域消费** | `taskStore`（任务）· `generate`（生成门面）· `filesApi`（文件落盘）· `mediaRefRegistry`（媒体引用）· `projectStore`（项目） | **域** |

**推论**：横切层的文件数大幅减少；`base/api/generate` **不是横切**，是「AI 中继域」的门面；`base/store` 的 6 个真 store **不是横切**，各属自己的域。

### 2.3 🔴 **判据修正 P2**：**域边界由「关注点」定，不由「消费者」定**

**错在哪**：我上一版因为 `base/editors` 的 11 个文件"只被画布节点消费"就把它们判给画布域。**那是把"谁在用"当成了"它属于谁"** —— 照此逻辑，所有被节点消费的能力（提示词/创作库/深度视频/媒体引用）都该归画布域，**域就不存在了**。

**正确判据**：**画布域 = 画布自身那一坨**（机制 + 节点组件 + 边组件）；被节点消费的**能力**各归**自己的能力域**（节点只是该能力的 UI 入口）。

⇒ **连带修正**：`base/editors/*` + `base/utils/faceMosaic.ts` 合成 **「图像编辑域」**（逻辑与 UI 同目录），**不归画布域**。这同时干净地解决了 TD-18-37。

### 2.3.1 🔴 **判据修正 P4**：「**被某宿主消费**」**不是**归属判据（用户 2026-09-19 质疑引出）

**错在哪**（我犯了两次，第二次是自查发现的）：
把「消费者是画布节点 ⇒ 归画布域」当判据 ⇒ 等同"谁在用就归谁"。第一次错在 `base/editors`（已由 P2 纠正），
**第二次仍留在 `base/utils` 的 6 个文件上**。

**正确判据（两条）**：

1. **归属看「关注点」，不看「谁在用」**。节点只是**入口/宿主**，不是域。
2. 🔑 **硬判据：同一个物被 ≥2 个不同宿主消费 ⇒ 它不属于任何宿主的私有物**（必是独立能力）。
   实证：`base/depthVideo` 被 `nodes/VideoGenerate.tsx:22,23` **和** `nodes/AssetNode.tsx:40,41` 同时消费
   ⇒ 若它是"视频节点上的一个按钮"，`AssetNode` 就不该有它 ⇒ **它是独立能力域**（"按钮"只是入口）。

**连带修正（我此前判错，本轮登记）**：

| 文件 | 旧判（错） | **新判（按关注点）** |
| --- | --- | --- |
| `base/utils/videoEngine.ts`（抽帧/裁剪/拼接/GIF） | 画布域 | **视频处理能力** |
| `base/utils/captureFrame.ts`（抽帧） | 横切（"多域共用"） | **视频处理能力**（多宿主 ≠ 横切，见 P1 与本节） |
| `base/utils/timeline/{sourceTime,timeScale}.ts` | 画布域 | **视频处理能力**（时间轴换算） |
| `base/utils/imageUpscale.ts` | 画布域 | **图像编辑/处理能力**（与 §2.3 图像编辑域同族） |

⇒ 由此**新增候选域：视频处理域**（`videoEngine` + `captureFrame` + `timeline/*` + 视频处理节点侧实现），
其"已收好的范本"就是 `base/depthVideo`。**归属明细待下一批按此判据逐个取证后落表**（不预设）。

### 2.3.2 🟢 **判据补充 P5**：**用户可感知性**是域的一级证据（用户 2026-09-19 给出）

**用户视角原话（当证据用，**不当作分类方案**）**：一级是**画布**；画布里边按内容分，而
「**视频 / 图片 / 文本 / AI 助手 / AI 助手的表格 / 多开 / 设置 / 其他**」每一种在用户看来都是**「一个东西」**。

**为什么要用它**：在此之前我的域判据**只有代码侧证据**（import 方向、消费者数）⇒ 只能回答"谁在用谁"，
**回答不了"这条边界对用户是否有意义"**。用户可感知性是**独立的一路证据**；两路交叉才能定**粒度**：

| 代码侧（≥2 宿主消费？） | 用户侧（能说成"一个东西"？） | 判定 |
| --- | --- | --- |
| 是（非私有物） | 是 | ✅ **一级域** |
| 是 | 否 | ✅ **能力 / 子域** → 归到"它能被用户感知的那个母域"下 |
| 否（只 1 个宿主） | 否 | 内部实现（不建域、不建门面） |

**交叉校验（用它审我的清单 —— 当场查出 1 处粒度错 + 2 个漏域）**：

| 用户的"一个东西" | 我的清单 | 差异与处置 |
| --- | --- | --- |
| **视频** | ❌ **我没立**：零件被塞进画布域（`base/utils/videoEngine` · `captureFrame` · `timeline/*`）与 `depthVideo` | **补立「视频域」**；`depthVideo` **降为其子域**（用户感知不到"深度视频"是独立一个东西） |
| **图片** | 拆成 图像编辑域 + `imageCompress/Upscale/Pixel`（横切）+ 图像类节点 | 复核：图像处理原语与图像编辑域**是否同一关注点**（待取证） |
| 文本 | 拆成 提示词域 + 创作库域 + `TextGenerate` | **保持分层**（输入侧 / 预设数据层，已裁定不合并 TD-18-39） |
| AI 助手 | `agent`(48) | ✅ 一致 |
| **AI 助手的表格** | `agent/assistantTable`(22) | ✅ 一致；用户与助手**并列**说 ⇒ 支持它作为独立子域 + **自己的门面** |
| **多开** | ❌ 我塞进"云同步域 / 账号环境组" | **补立「多开 / 账号域」** |
| 设置 | 设置域 | ✅ 一致 |
| 其他 | `videoEditor` · `scriptbox` · `director3d` · 素材库 · 创作库 · 深度视频 | ✅ 均可被用户感知（保留） |

⇒ **净结果：域清单 19 → 20**（+「视频域」+「多开/账号域」；`depthVideo` 由一级域降为视频域子域）。
**明细待按此判据逐个取证后重出 §3.1**（不预设合并方案）。

### 2.4 🔴 **判据修正 P3**：`src/hooks/` 的约定要收窄

V2 §4.1 原文「**跨域** hooks 放 `src/hooks/`」被实测误用成"所有 hook 都放那"。实测 25 个里 **21 个是域专用**（`useNodeData`/`useNodeGeneration`/`useConnectedInputs`/`useCanvas*`…）。
⇒ **正确约定**：`src/hooks/` 只放**跨域** hooks（`useStoreSelector`/`useLocalToolStatus`/`useVideoPoster`）；**域专用 hook 回域内**。V2 §4.1 需回改。

### 2.5 计数口径

`App.tsx`（装配层）**不计**为消费域；只被装配层消费的物 → 记「单消费者」，不算跨域。

### 2.6 🟢 域是**分层**的（大域里有小域）—— 2026-09-19 取证回答

**是，大域里有小域，而且这是域的自然形态。** 实测三层：

```
域（19 个）          ← 边界
└─ 子域（关注点切片）
   └─ 深模块（形态：窄门面 + 厚实现 + 唯一真源）   ← 最终目标
```

**层级实证**：

| 大域 | 子域（实测规模） |
| --- | --- |
| **videoEditor**(258) | `engine`(102；**内还有第二层**：`core`门面 / `commands`38 / `lib`22 / `services`21 / `timeline`10) · `ui`(79) · `hooks-cutia`(29) · `constants`(14) · `types`(12) · `stores`(9；内还有 `keybindings/migrations`) · `utils`(4) · `lib`(3) · `data`(3) |
| **agent**(56) | `assistantTable`(22) · `runtime`(12) · `conversation`(8) · `canvas`(3) |
| **画布域** | `base/canvas`（机制） · `nodes`（节点） · `edges`（边） |
| **图像编辑域** | `editors/*`（查看/裁剪/全景/相机） · `cameraParams`（相机参数） · 打码 |
| **`base/`** —— **它不是域，是「横切层 + 域」的容器** | 横切：`core`·`utils`·`ui`·`api`·`storage`；**域**：`canvas`·`creative`·`depthVideo`·`editors`·`media`·`prompt`·`store` |
| **`base/store`**(15) | **直接住着 8 个域**（§3.6） |

**子域真实存在的硬证据 —— 域内子域撞名 8 组**（若子域只是目录，不该有独立命名冲突）：

| 撞名 | 分居 | 类型 |
| --- | --- | --- |
| `ExportFormat` · `ExportQuality` | `videoEditor/engine/services/renderer` ⨯ `videoEditor/types` | 域内子域 |
| `TimelineElement` | `videoEditor/types` ⨯ `videoEditor/ui/editor/panels/timeline` | 域内子域 |
| `subscribe` | `agent/assistantTable` ⨯ `agent/conversation` | 域内子域 |
| `CameraLens` · `describeCameraLens` | `base/editors` ⨯ `base/editors/cameraParams` | **父目录 ⨯ 子目录** |
| `ChatMessage` | `base/api` ⨯ `base/utils` | 跨域 |
| `detectAssetType` | `base/store` ⨯ `base/utils` | 跨域 |

**⇒ 推论（重要）**：`base/` **不是域**。这解释了此前一个说不通的地方 —— 「域物住 base」是**伪命题**：错的只是「域物住进了**横切的**那几个子目录（`core`/`utils`/`api`/`storage`）」；而 `base/editors`、`base/store` 本身就是**域容器**，住在里面不算住错。

**🔴 新规则 N9 · 前缀取到哪一级**：
- **默认只取「域」级** —— 子域信息由**目录**承载，不进名字 ⇒ `engine/lib/i18n.ts` 的 `i18next` → `videoEditorI18n`，**不**写 `videoEditorEngineI18n`。
- **同域内子域撞名时**：最通用的那个用域级前缀，其余加子域段 ⇒ `<域><子域><名>`（如渲染器的 `ExportFormat` → `videoEditorRendererExportFormat`）。
- 判据：**前缀只需保证「被跨域消费时能唯一指认」**（与 N1 同源）。

### 2.7 门面要建几个（**建面判据** —— 域数 ≠ 门面数）

**不是"每域一个"。判据 = 有没有域外消费者。**

| 情形 | 建门面？ | 理由 |
| --- | --- | --- |
| **有域外消费点**（≥1 个域外文件 import 其内部） | **必建** | 否则域外依赖内部结构 ⇒ 内部一改就波及域外 ⇒ **域模块化失效** |
| **只被本域内消费** | **不建** | 纯维护成本（re-export 面要跟内部演化走），零收益 |
| 子域：被 **≥2 个兄弟子域**消费，或**域外直连它** | **建**（子域门面） | 限制横向耦合 |
| 子域：只被父域内 **1 处**消费 | **不建** | 实证：`videoEditor/stores/keybindings/migrations`（单消费者）⇒ 私有实现细节 |
| 已有"天然单入口"（如 `depthVideo` 的 `DepthVideoModal`） | **仍建** | 单入口 ≠ 门面：`depthVideo/spawn.ts` 同样被域外直连 |

**🔍 门面收益的二级判据（用户 2026-09-19 质疑 `depthVideo` 时校准）**：

| 域外直连的是什么 | 门面 | 收益 |
| --- | --- | --- |
| **非入口的内部件**（如直连 `engine/lib/xxx`、`nodeDataSchema` 这类实现） | **必建** | **大**：这是真收口 —— 域内重排不再波及域外 |
| **恰好是域的天然入口**（如 `depthVideo` 的 `DepthVideoModal` + `spawn`） | **可选**（已建则留） | **小**：只锁定"入口不许改名/移位"；建议同时**只做目录收敛**，不必为它单独排一批 |

> 实证：`base/depthVideo`（5 文件）域外只直连它的 2 个天然入口 ⇒ 门面是小收益但真收益的动作（收益 = 2 个入口名被声明为对外面）。

**层级（N5 细化）**：域门面 `域/index.ts` · 子域门面 `域/子域/index.ts`。
**二者不重复导出**：子域门面负责 **子域↔子域**，域门面负责 **域↔域**（域门面只 re-export 子域门面 + 域根件）。

**🔴 宽窄红线**：门面只露**稳定的对外面**（类型 + 少数入口）。**宽门面 = 假收口**（把内部结构换个地方暴露，等价于没建）。
实证反面：`agent/index.ts` 只露 5 个符号（够窄），但**被架空** —— `AgentPanel.tsx:100-116` 与
`TableWorkspacePanel.tsx:29-35` **绕过门面直连深层** ⇒ **光窄不够，必须同时收口消费点**（= Step A 的 A2）。

**预计新建清单（依实测域外消费点）**：

| 类别 | 域 | 依据 |
| --- | --- | --- |
| **新建**（约 12 个） | `videoEditor`(1 真实 +2 例外) · `base/prompt`(nodes×4 + panels) · `base/creative`(nodes×3 + hooks + agent) · `base/depthVideo`(nodes×2) · `base/editors` 图像编辑域(nodes×6+) · `scriptbox`(nodes×7) · **中继域**（`api/relay/index.ts`，被 3 域消费） · `base/store` 拆分后各域 · **画布域**（Stage 2 合并后） | §3 各节 |
| **已有、需收口** | `agent`（门面被架空）· `base/api` · `base/media` · `base/storage` · 后端 `ai-relay` | §3.3 / §3.7 |
| **不建** | `director3d`（已登记例外）· 各"单消费者子域" · 域外消费点 = 0 的域 | §2.7 判据 |

⇒ **约 12 个新建，不是 19 个。**

**附带收益**：门面落成后 **跨域依赖图 = 门面图**（可审计）；且 P1 修好的闸**能看见 barrel 边** ⇒
门面若引入环会当场被抓（不会像以前那样"建了门面、埋了环、闸还绿"）。

---

## 3 · 归属判定（查实 2026-09-19 · 5 个子 Agent 取证）

### 3.1 域清单（**19 个**）

| # | 域 | 位置 | 文件 | 门面 |
| --- | --- | --- | --- | --- |
| 1 | **agent** | `agent/` + `components/panels/`(6) + `base/core/agentKeys` + `base/utils/volumePolicy` | 56 | ✅ |
| 2 | **videoEditor** | `videoEditor/`(258) + `base/core/{videoEditorKeys,editorSession}` + `base/utils/useMediaLoadFailed` | 262 | ❌ |
| 3 | **画布域** | `base/canvas`(18) + `nodes`(18) + `edges`(3) + `base/panels/{HoverToolbar,FullscreenEditor}` + `base/core/{canvasHotkeys,canvasSyncBus}` + `base/utils/{imageUpscale,videoEngine,arrangePack,timeline/*}` + `base/nodeImage` + `src/hooks` 画布系 | ~60 | ❌ |
| 4 | **图像编辑域** | `base/editors/*`(11) + `base/utils/faceMosaic.ts` | 12 | ❌ |
| 5 | **媒体引用域** | `base/media/`(9) | 9 | ✅ **范本** |
| 6 | **提示词域** | `base/prompt/`(6) | 6 | ❌ |
| 7 | **创作库域** | `base/creative/`(8) | 8 | ❌ |
| 8 | **深度视频域** | `base/depthVideo/`(5) | 5 | ✅ **范本** |
| 9 | **scriptbox** | `scriptbox/`(17) | 17 | ❌ |
| 10 | **director3d** | `director3d/`(27) + `base/utils/encoderProbe` + `base/storage/legacyRawKey` | 29 | ❌ 已登记例外 |
| 11 | **AI 中继域** | `base/api/{generate,pollTask,relayProxy}` + `agent/runtime` 的 SSE 解析 | 4 | ❌ |
| 12 | **文件域** | `base/api/filesApi.ts` + 后端 `utils/fileStore.ts` 等 | — | — |
| 13 | **项目域** | `base/store/projectStore.ts` | 1 | ❌ |
| 14 | **任务中心域** | `base/store/{taskStore,taskCompletionBus}` | 2 | ❌ |
| 15 | **设置域** | `base/store/{appSettings,settingRegistry}` | 2 | ❌ |
| 16 | **云同步域** | `base/store/{cloudSync,autoSync}` + `accountsStore` | 3 | ❌ |
| 17 | **供应商域** | `base/store/{providerStore,agentModelStore}` | 2 | ❌ |
| 18 | **生成编排域** | `base/store/{generationContract,nodeRuntimeStore}` | 2 | ❌ |
| 19 | **后端 ai-relay** | `localTool/src/ai-relay/` | 12+39 | ✅ **范本** |

> **结论**：`base/store` 一个目录里住着 **8 个域**；真 store 只有 6 个。

**§3.1.1 已确认的三处修订（按 P5 用户可感知性 · 2026-09-19）**：

| 项 | 原判 | 改为 | 依据 |
| --- | --- | --- | --- |
| **+「视频域」** | 无此域（零件散在画布域/横切） | **补立**：`base/depthVideo`（子域）+ `base/utils/{videoEngine,captureFrame,timeline/*}` + 视频类节点的能力实现 | 用户能说成"视频是一个东西"；且这些件被 ≥2 宿主消费（非私有物） |
| **+「多开/账号域」** | 塞在"云同步域/账号环境组" | **补立** | 用户能说成"多开是一个东西" |
| **`depthVideo` 降级** | 一级域（#8） | **视频域的子域** | 代码侧：被 2 宿主消费 ⇒ 是能力；**用户侧：说不出"深度视频是一个东西"** ⇒ 粒度定高了 |
| **门面** | 曾建 `base/depthVideo/index.ts` | **已完整撤销** | 门面建在**错层级**（子域不该有自己的对外门面）⇒ 将来必拆重建，按减二闸现在撤 |

### 3.2 画布域四组：**可合并**（J1 查实）

| 关系 | 结论 | 证据 |
| --- | --- | --- |
| `base/canvas` → `nodes` | 有 | `NodePalette.ts:18-29`（静态 import 12 节点）；`lazyNode.tsx:127-129` |
| `nodes` → `base/canvas` | 密集 | `VideoProcessNode.tsx:22,52,53`；`ImageGenerate.tsx:41-43` 等 11 文件 |
| `edges` → `base/canvas` | 弱（1 处） | `ConnectionLine.tsx:4` → `lod.tsx` |
| `agent/canvas` → `base/canvas` | **单向**，反向 0 | `useCanvasAgentTools.ts:8-10`；`canvasHost.ts:28` |
| **文件级循环** | **无**（`no-circular` 红线成立） | `NodePalette.ts:17` 自述；回指的 A 文件不 import 它 |
| **架构例外边** | `base → nodes` 在 `check-arch.mjs:218-221` 的 `BASE_ALLOWLIST` 里 | 合并时**必须保留该边语义** |
| **判定** | A/B/C 合并为画布域；`agent/canvas` 归 **agent**（单向 + 消费方全在 agent 侧） | — |

### 3.3 关键更正（推翻我上一版 4 处）

| # | 原判 | 查实结论 | 证据 |
| --- | --- | --- | --- |
| C1 | `base/utils` 9 图片物 → 媒体处理域 | 横切 3（`imageCompress`/`captureFrame`/`useImageFallbackSrc`）+ 域专用 5（见 §3.4）+ 单消费者 1（`externalizeInline` 仅 `App.tsx:123`） | import 穷举 |
| C2 | `base/editors` → 归画布域 | **改判**：图像编辑域（独立能力域）；`ImageZoomDialog` 是横切（3 域消费） | §2.3 P2 |
| C3 | `modalLayer` → videoEditor | **横切**（canvas+editors+agent 共用） | `useCanvasShortcuts.ts:3`；`OverlayEditor.tsx:44`；`AssistantTablePanel.tsx:59` |
| C4 | `base/panels` 全通用 | 多数 app-shell（仅 App）；`HoverToolbar`/`FullscreenEditor` 属画布域 | `VideoGenerate.tsx:13` 等 7 处 |

### 3.4 游离物清单（处置四选一）

| # | 位置 | 真实归属 | 处置 | 证据 |
| --- | --- | --- | --- | --- |
| 1 | `base/core/{agentKeys,videoEditorKeys,editorSession,canvasHotkeys,canvasSyncBus}` | agent / videoEditor / 画布域 | **迁出** | `editorSession.ts:1-63` 头注自述剪辑器会话态 |
| 2 | `base/utils/{imageUpscale,videoEngine,arrangePack,timeline/sourceTime,timeline/timeScale,useMediaLoadFailed}` | 画布域 / videoEditor | **迁出** | `useImageHoverActions.tsx:6`；`VideoProcessNode.tsx:40,50` |
| 3 | `base/utils/encoderProbe.ts` · `base/storage/legacyRawKey.ts` | director3d | **迁出** | `director3d/App.tsx:244`；`director3d/project.ts:32` |
| 4 | `base/api/{generate,pollTask,relayProxy}.ts` | AI 中继域 | **迁出**为 `api/relay/` + 门面 | §3.5 |
| 5 | `base/store` 的 12 个非项目域文件 | 各自域（§3.1 #14–#18） | **迁出** | §3.6 |
| 6 | `base/storage/kvStore.ts` | **无**（浅壳） | **删壳** | 26 行纯 re-export；`storage/index.ts:16` 唯一引用 |
| 7 | `videoEditor/utils/*`（`cn` · platform · string · browser） | **通用物**混进域 | **提级**到横切层 | `utils/ui.ts:4`（`cn` 全仓唯一，45 处消费全在域内） |
| 8 | `videoEditor/ui/ui/*`（26 件基础件） | 通用 UI 原语 | **提级/合并**至 `base/ui` | 与 `base/ui` 只重 2 组（select · context-menu） |
| 9 | `components/panels/`(6+css) | **agent** | **迁出** | 6/6 消费方在 agent 侧 |
| 10 | `videoEditor/ve-tailwind-colors.ts` · `ve-theme.css` · 类名 `ve-scope` | videoEditor | **去缩写**（`ve`→`videoEditor`） | `tailwind.config.ts:3` |
| 11 | `base/nodeImage.ts` | 画布域 | **迁出** | `nodes/AssetNode.tsx`、`ImageGenerate.tsx` |
| 12 | 后端 `{generateEngine,relay-poll,providerConfigStore}.ts`（住根） | 后端中继域 | **迁出** | `routes/generate.ts:18-20` |
| 13 | 后端 `utils/{fileStore,orphanGc,resolveLocalImages,base64Externalize}.ts` | 文件/媒体域（直连 db） | **迁出** | `utils/fileStore.ts:34` |
| 14 | 后端 `routes/` 内业务函数（`files.ts:366`、`tasks.ts:199`） | 服务层（被 `relay-poll.ts:40-41` **反向依赖**） | **迁出** | 路由层当服务层用 |

### 3.5 AI 中继域

- 依赖链**单向**：`relayProxy`（底座）← `generate` + `pollTask`。
- **命名违例**：`relayProxy` 全带 `relay*` ✅；`generate.ts` 的 `generateImage/generateVideo/chatCompletions/chatStream` ❌；`pollTask.ts` 的 `initTaskRecovery` ❌。
- **门面缺口**：`api/index.ts:17-24` **未收 `relayProxy`**。
- **外泄**：`agent/runtime/agentRuntime.ts:483-503` 自行解析 SSE。

### 3.6 `base/store` 15 文件（J5 查实）

**真源仅 6 个**：`accountsStore` · `appSettings` · `nodeRuntimeStore` · `projectStore` · `providerStore` · `taskStore`。
分组：①设置(`appSettings`+`settingRegistry`) ②云同步(`cloudSync`+`autoSync`) ③备份(`backupStore`) ④账号(`accountsStore`) ⑤供应商(`providerStore`+`agentModelStore`) ⑥项目(`projectStore`) ⑦素材(`resourceStore`) ⑧任务(`taskStore`+`taskCompletionBus`) ⑨生成编排(`generationContract`+`nodeRuntimeStore`)。

### 3.7 第三层：子域图（2026-09-19 深挖 · 5 子 Agent）

| 域 | 子域数 | 子域 | 先做成深模块 |
| --- | --- | --- | --- |
| **agent**(56) | 4 | `runtime`(12) · `canvas`(3) · `conversation`(8) · `assistantTable`(22) | **assistantTable** |
| **videoEditor**(262) | engine 内 5 + 外 9 | **engine**：`core`(11,门面) · `commands`(38) · `lib`(22) · `services`(21) · `timeline`(10)；**外**：`ui`(79) · `hooks-cutia`(29) · `constants`(14) · `types`(12) · `stores`(9) · `utils`(4) · `lib`(3) · `data`(3) | — |
| **画布域**(~60) | `base/canvas` 5 组 + 2 | **G1 节点数据契约** · **G2 结构变更与历史** · **G3 画布外壳 UI** · G4 注册表 · G5 事件拓扑 · `nodes`（**挂载点层**） · `edges`（叶子） | **G1 / G2** |
| **图像编辑域** | 3 | 查看编辑 · 相机(`cameraStudio`+`cameraParams`) · 打码 | **相机类** |
| **媒体引用域**(9) | 2 | `providers/`(4) · refs-core(registry/types/browse/bridge) | **mediaRefRegistry**（已是深模块） |
| **提示词域**(6) | 2 | 输入富文本组(PromptInput/chips/mention/layout) · 社区库组(PromptHub/Store) | **promptChips** |
| **创作库域**(8) | 2 | 数据层(catalog/presets/promptManager/data) · 展示层(Library/Button/views) | **creativePresets** |
| **深度视频域**(5) | 1 | —（UI+逻辑同目录，**范本**，无需再拆） | — |
| **后端 ai-relay**(~41) | 4 | `protocol/`(13，平铺但隐含 3 层语义) · `providers/lovart/`(10，范式) · `manifests/`(5，纯数据) · 顶层(12) | **protocol/** |

**① `engine/lib`(22) 的 grab-bag 拆解 → 实为 6 个关注点**

| 关注点 | 文件 | 判定 |
| --- | --- | --- |
| 键位动作系统 | `actions/*`(4) | 自成闭环（definitions↔registry↔types，与 lib 其余零耦合）⇒ 独立深模块 |
| 预览交互几何 | `preview/*`(3) | 唯一消费者 `use-preview-interaction` ⇒ 独立 |
| 渐变渲染 | `gradients/*`(3) | 唯一消费者 `renderer/nodes/color-node` ⇒ **下沉 renderer**，不是 lib 通用 |
| 媒体处理 | `media/*`(4) | 被 core/commands/lib/ui/hooks 四方消费 ⇒ 可独立 |
| 转写/字幕 | `lib/transcription/caption.ts` ⨯ `services/transcription/*`(3) | **同一关注点被劈成两处** |
| 导出 | `lib/export.ts` ⨯ `services/renderer/scene-exporter` ⨯ `lib/media/audio.ts` | 三方分散 |
| 其余 | `i18n`(空壳) · `iconify-api`(真实出站客户端，被 `contracts.ts:1042` 登记) · `time`(强绑 fps) · `drag-data` · `scenes` | 逐条处置见 §3.4 |

**② 层位倒置（新发现 5 处）**

| 倒置 | 证据 |
| --- | --- |
| `constants` → `engine` | `constants/subtitle-constants.ts:1` import `engine/timeline/element-utils` |
| `types` → `constants` | `types/stickers.ts:1` · `types/language.ts:1` |
| `base/core/contracts.ts` 登记 **engine 实体** | `:1042-1061`（`iconify-api` / `hf-proxy`） |
| `base/core/contracts.ts` 登记 **域内 storage 键** | `:659-671` |
| `EditorShell` 绕过域内适配层 | `EditorShell.tsx:35-36` 直接用 `base/core/*`，不走 `lib/logger`/`lib/toast` |

**③ SSOT 第二份 + 真环（含闸盲区）**

- **`ExportFormat` / `ExportQuality` 两份平行定义**：`engine/services/renderer/scene-exporter.ts:18-19` ⨯ `videoEditor/types/export.ts:7-8`（引擎未复用底层单源）。
- **真环（barrel 环）**：`core/index.ts` → `managers/timeline-manager.ts:39`（引 `commands/timeline` barrel）→ `…/add-transition.ts:2`（值引 `engine/core`）→ 回路。同形另有 scene / project 两条。
- ⚠️ **闸盲区（工具债）**：`scripts/check-arch.mjs:153-166` 的 `resolveSourceFile` **缺「目录→index」回退**，而它自称复用的 `scripts/ts-exts.cjs:91-94` **有**该回退 ⇒ **一切经 barrel 的边解析为 `null`、不产生边** ⇒ `no-circular` 与规则 2 / 4′ 同时漏。见 §4 D13。

**④ 子域级撞名**：见 §2.6（8 组）。

---

## 4 · 冲突裁决（**全部已判，无需拍板**）

| # | 冲突 | 裁决 | 依据 |
| --- | --- | --- | --- |
| **D1** | 「≥2 域消费 = 横切」vs `generate`/`taskStore` 被多域消费却是域能力 | **判据改为"有无业务语义"**；`generate` 属中继域 | §2.2 P1 |
| **D2** | `base/editors` 只被画布节点消费 → 归画布域？ | **否**；域边界由关注点定 ⇒ 图像编辑域 | §2.3 P2 |
| **D3** | V2 §4.1「hooks 放 src/hooks」vs 实测 21/25 是域专用 | **收窄为"只放跨域 hooks"**；V2 需回改 | §2.4 P3 |
| **D4** | 打码是否独立域 | **不独立**：并入图像编辑域（逻辑 + UI 同目录） | 同关注点（TD-18-37 原意） |
| **D5** | 中继域改名 vs L3 裁定「4 个具名导出签名逐字不变」 | **可改**。L3 那句是**施工纪律**（防当时调用点漂移），不是永久命名冻结；用户 2026-09-19 域前缀裁定**晚于且优先于**它。**连带必须同步改** `tests/unit/generate.test.ts` 的 #8（barrel 契约）/ #10（别名）断言，并在轮次文件写明"公开面变更导致断言更新"，**不算买绿灯** | `generate.ts:2-7`；`generate.test.ts:305-315` |
| **D6** | `nodes/_template/TemplateNode.tsx` 零生产消费 | **保留但迁出 `src/`**（`contracts.ts:814` 记载为"新建节点蓝本、非活节点"）—— 零消费实现不宜留源码目录（污染 dead-code 闸与读者认知） | `contracts.ts:814-815` |
| **D7** | `resourceStore.listeners` | **死代码 + 假机制**：`:87` 声明、`:281` `forEach`，**全仓无 `.add`** ⇒ `notify()`（5 处调用）恒为 no-op。**删 `listeners` + `notify` 全部调用** | grep 实证 |
| **D8** | `engine/lib/i18n.ts` 空壳（`t(key)` 返回 key） | **假实现，且已泄漏到用户可见**：`sounds-store.ts:70` `toast.error(i18next.t('Failed to save sound'))` ⇒ **英文 key 直接当提示上屏**（同文件 `text-speech-panel.tsx:6` 已注"i18next 已随直写中文移除"）。**处置：把 ~N 处改为中文直写 → 删桩** | 实证 2 处 |
| **D9** | `videoEditor/ui/cutia-ui-icons/` | **空目录 ⇒ 删** | `ls -a` 只有 `.` `..` |
| **D10** | 后端 `routes/requestModes.ts` | **未挂载死文件 ⇒ 删**（`router.ts` 无引用） | `router.ts:143-166` 路由表无此项 |
| **D11** | `App.tsx` 是否算消费域 | **不算**（装配层） | §2.5 |
| **D12** | `src/hooks/` 21 个域专用 hook | **迁回域内**（画布/节点系回画布域；videoEditor 系回 videoEditor）；⚠️ `useConnectedInputs` **不得进 `base/`**（它 import `scriptbox` ⇒ 触发 `check-arch` 规则 2 反向依赖红线），只能落域层 | §2.4 P3 · §3.7 |
| **D13** | `check-arch.mjs` 解析器缺「目录→index」回退 ⇒ **barrel 环抓不到**（闸盲区） | **工具债，当场修**（A10）：补回退 + 跑负例探针证明它**真会红**；修完预计暴露 3 条 barrel 环 ⇒ **同批拆环**（`managers/timeline-manager.ts:39` 等由 barrel 改直引） | `check-arch.mjs:153-166` vs `ts-exts.cjs:91-94` |
| **D14** | `videoEditor/ui/ui`(31) 是否合并进 `base/ui` | **不合并**（**推翻** §3.4 #8）：`base/ui` 是**宿主 kit**（App/nodes/agent/scriptbox 共用），`ui/ui` 是编辑器自研无 radix 原语 + `--ve-*` token 绑定；真重复仅 3 对（`select` / `context-menu` / `switch↔Toggle`）⇒ **改名消歧，不搬家** | §3.7 |
| **D15** | `nodes/`(18) 是否画布域子域 | **是「画布域的节点宿主子域」**：实测它是**各能力域的 UI 挂载点表**（`ScriptBoxNode`→scriptbox · `Director3DNode`→director3d · `FaceMosaicNode`→图像编辑 …），画布自身节点只有 `GroupNode`/`GhostTargetNode`。⇒ 留画布域作宿主层，但**节点的能力实现必须在各能力域内**（禁在 `nodes/` 写业务） | §3.7 |
| **D16** | `stores/keybindings/migrations`(2) 是否独立小域 | **不是**：单消费者（`keybindings-store.ts:11,148`），是 store 的**私有实现细节** ⇒ 不提级 | §3.7 |
| **D17** | `hooks-cutia/timeline/*`(14) 迁回哪里 | **回 timeline 面板目录**（`ui/editor/panels/timeline/`），不是"回域内" —— 它们是该面板的私有实现 | §3.7 |
| **D18** | `ImageZoomDialog` 归属 | **横切**（10+ 消费方横跨 nodes/panels/scriptbox/base-panels）⇒ 从图像编辑域**剥离** | §3.7 |
| **D19** 🔴 | 改名时「符号 + 字符串标识一起改」（N8）是否 **默认动作** | **写反了，必须纠正**：**运行时字符串默认不改**（存储键 / 节点类型串 / uploads 子目录 / URL）—— 改键 = 存量数据失联，属**业务破坏**；本仓既有红线「目录名不改，防存量 URL 破链」（`filesApi.ts` 头）。N8 收窄为：**只保证"符号与文件路径"两套身份一致**；字符串要动必须单独成批 + 用户接受数据重置。**→ 已落 `ADR-0038`（生效）** | F5 · ADR-0038 |
| **D20** 🔴 | 「先全批改名、再全批移位」 | **不最优**：同一文件被 churn 两次 ⇒ 90 个 `vi.mock` + 外部清单要同步两遍。改为 **一批 = 一次 `move` 完成"位置 + 名字"**（工具支持）；**前提 = 目标形态已定死**，未定则不许开工。跨层移位保留"先解除反向引用再搬" | F6 · §5.3 |
| **D21** | **后端本期不改** | **用户裁定（2026-09-19）**：后端先不动 ⇒ §3.4 #12/#13/#14 与批次 **S2-7 全部延后**；前端批次的**次序不受影响**（前后端是两套世界，V2 §5-E） | 用户指令 |

> **结论：本计划原版 4 处硬洞已堵** —— ① 外部引用靠人肉清单（漏改症状静默：构建破 / 闸假绿）→ 加「外部引用复跑=0 差异」+ 强制 build；② 闸盲区 D13 未修 → **Step A 建门面会制造看不见的环**、Step C 的 `check:arch` 绿不算证据 ⇒ **D13 是施工的硬前置**；③ N8 写反 → D19；④ 顺序判据不最优 → D20。

---

## 5 · 安全移名 / 移位 SOP（**每一步的前后都不能错**）

> **依据**：《节点重命名安全操作手册》（符号 + 字符串标识 + 文件名 四步）＋本仓工具约束（`mv-sync-refs.mjs` 的事务模型）＋实测坑。

### 5.1 🔴 四条前置铁律（不遵守必乱）

| # | 铁律 | 为什么（实测） |
| --- | --- | --- |
| **F1** | **工具只扫 `src` + `tests`** | `mv-sync-refs.mjs:154` `SCAN_ROOTS = [src, tests]` ⇒ **域外引用会漏改**，见 §5.2 清单 |
| **F2** | **工具不改字符串** | import 说明符会改，但 `vi.mock('…生成.ts')` 这类**字符串路径**（实测 **90 个测试文件**）、node type / STORAGE_KEYS / EVENTS 一律不动 |
| **F3** | **一次只做一件事** | 同一批里既改名又移动 ⇒ diff 巨大、说不清"哪些行为被改"（违反零炸闸） |
| **F4** | **不留半态** | 旧名/旧路径/旧注释/旧测试桩不许残留；门面建成后域外不得再直指内部 |
| **F5** 🔴 | **运行时字符串默认不改** | 存储键（`STORAGE_KEYS`/KV key）· 节点类型串（`NODE_TYPES`/prefs 键）· uploads 子目录 · URL —— **改名只动「符号名 + 文件路径」，不动这些字符串**。依据：本仓既有红线「目录名不改，防存量 URL 破链」（`filesApi.ts` 头）；改键 = 存量数据失联，属**业务破坏**不是结构重构。要改必须**单独成批 + 用户接受数据重置** |
| **F6** 🔴 | **一批 = 一个文件的一次完整迁移** | 目标形态（**位置 + 名字**）都定死后，用**一次** `move` 完成（`mv-sync-refs move` 支持顺带改名）；**禁止**"先全批改名、再全批移位"——同一文件被 churn 两次 ⇒ 那 90 个 `vi.mock` + 外部清单要同步**两遍**，漏一次的机会翻倍 |
| **F7** | **改前必须能回滚** | `rename` **无 undo 命令**（只有 `move-dir --undo`）⇒ 改名批的回滚手段 = git：开工前记起点 sha + 确认工作区干净 |

### 5.2 前置检查清单（每批开工前逐条过）

```bash
# ① fan-in
node scripts/mv-sync-refs.mjs refs <文件>
# ② 全仓穷举（含扫描根之外）—— 工具漏改的部分靠这条兜住
grep -rn "<旧路径或旧符号>" . --exclude-dir=node_modules --exclude-dir=.git
# ③ 基线（改前必须全绿，否则没有"防回归"可言）
npx tsc --noEmit && npm run check:arch && npx vitest run tests/unit/<相关>.test.ts
```

**扫描根之外的「活引用」清单（实测 · 改名/移位必须同步）**：

> **P2 已机器化**：`node scripts/scan-outside-refs.mjs <旧路径片段>`
> —— **改名前**跑旧片段记清单 → **改名/移位后用同一旧片段复跑 → 命中必须为 0**（非 0 = 漏同步）。
> `--all` 做周期性盘点（实测基线：根外源码路径引用 259 处 / 断链 40 处，母体 = TS 化迁移后描述未回改）。
> 它不是闸（未登记 `gates.manifest`），是施工期侦察助手。

| 文件 | 内容 | 处置 |
| --- | --- | --- |
| `tailwind.config.ts:3` | `components/videoEditor/ve-tailwind-colors` | **手工同步**（构建期依赖！改错破 build） |
| `vitest.config.ts` | 5 处 `components/{agent,director3d,nodes,panels,scriptbox}/` | 手工同步 |
| `vite.config.ts` | `components/base/lazyNode.jsx`（**已过期**：真实是 `.tsx`） | 手工同步 + 修正过期 |
| `CLAUDE.md` | 8 处源码路径 | 手工同步（**回改原文**，A7） |
| `scripts/**`（21 文件） | `check-arch.mjs`（`VE_*_REL` 常量）· `dead-code-baseline.json` · `strict-src-whitelist.json` · `check-node-*.mjs` 等 | **闸与 baseline 必须同批改**，否则闸假绿/假红 |
| `.codebuddy/commands/**` · `spec/**` · `docs/**`（规范类） | 路径与符号引用 | 手工同步 |
| `localTool/**` | 后端自有路径 | 手工同步 |
| `daily/**` · `Temp/**` · `docs/plan/**`（历史快照） | 历史记录 | **不改**（历史不可改写） |

**字符串面检查（F2）—— 实测 90 个测试文件含 `vi.mock` 字符串路径**：

```bash
# ① 本批路径片段被多少测试 mock（>0 ⇒ 这些测试必须逐一核对，见下方"假绿陷阱"）
grep -rl "vi\.mock('.*<本批路径片段>" tests
# ② 登记表串：改名前确认本批没动 contracts.ts 的键名/事件名/节点类型串（红线见 ADR-0038）
grep -n "<旧符号>" src/components/base/core/contracts.ts
# ③ 复用 refs 的「② 字符串残留引用」段逐条判：是不是运行时键（是 ⇒ 不改，ADR-0038）
node scripts/mv-sync-refs.mjs refs <本批文件>
```

### 🔴 5.2.1 Step A 专属陷阱：**建门面会让 `vi.mock` 静默失效（假绿）**

**机理**：测试 mock 的是**深路径**（实测：`filesApi.ts`×29 · `toastStore.ts`×23 · `logger.ts`×23 · `NodeShell.tsx`×18 …），
而 mock「门面」的只有 4 处。一旦 Step A 把消费点**改走门面**，被测代码就不再 import 那条深路径
⇒ vitest 的 `vi.mock('…深路径…')` **不再拦截**、**且不报错**，真模块被执行 ⇒ **测试静默失真（可能仍绿）**。

**判据（可机器验证）**：**被 mock 的路径，生产侧必须仍有 import**。

```bash
# 本批改动后：列出 mock 了"本批可能被改走门面"的测试
grep -rl "vi\.mock('.*<域路径片段>" tests
# 逐条确认：该路径生产侧是否仍有人 import（0 import 且仍有 mock ⇒ 该 mock 已失效 = 假绿）
node scripts/mv-sync-refs.mjs refs <被 mock 的那个文件>
```

**处置**：把该测试的 mock 路径**同步改为门面路径**（或改为 `importOriginal` 展开，见 V2 §4.7 桩约定），
并在轮次文件写明"公开面变更导致 mock 路径更新" —— **不算买绿灯**（判据变了，不是断言被放宽）。

### 🔵 5.2.2 门面的**合法例外**（不算"绕过门面"）

| 例外 | 为什么 | 处置 |
| --- | --- | --- |
| **构建期消费**（`tailwind.config.ts` / `vite.config.ts` / `vitest.config.ts`） | 这些由 Node/tsx 在**构建期加载**；若走门面会把整域依赖图拉进构建配置 | 直引**零依赖纯数据**文件（如 `ve-tailwind-colors.ts`）；且该文件**必须保持零依赖** |
| **CSS 副作用导入**（`main.tsx` → `ve-theme.css`） | CSS 不在 TS 模块图内，无环风险 | 保持直引，计入"域外直连"时标注为例外 |
| **入口/门面自身** | 它就是要 import 内部 | — |

### 5.3 施工顺序（**门面优先 → 改名 → 移位 → 清尾巴**）

```
Step A · 建门面（只新增，不动存量）—— **分两级**
   A1 给**域**加 index.ts（re-export 现有文件，内容零逻辑）
   A1.5 大域再给**子域**加门面（videoEditor/engine、agent/runtime…）—— 大域内部先竖墙，内部重构就不互相干扰
   A2 域外消费点改走门面（App.tsx / vitest.config / tailwind.config 等）
   → 验证：tsc + 相关单测    【收益：此后内部怎么动，都不再波及域外】
        ↓
Step B · 改名（符号 + 文件名，**位置不动**）—— 风险最低，先行
   B1 rename-symbol <旧> <新> --file <域内文件>   ← 必须带 --file（防改掉别域同名符号）
   B2 rename <文件> <新文件名>                    ← import 说明符自动同步
   B3 **手工同步字符串面**：vi.mock 路径 / 登记表 / 活配置 / 闸 / 文档
   → 验证：tsc + 相关单测 + check:arch    【先做不动路径的，因为路径一变会同时触发闸与外部引用】
        ↓
Step C · 移位（位置）
   C1 **域内归位**（域 → 自己的域）：无反向依赖风险，先做
   C2 **跨层归位**（base ↔ 域）：**必须与"解除另一侧引用"同批** ——
      否则 `base/**` 会反向依赖业务域，`check:arch` 分层红线立刻红
   C3 用 move / move-dir（事务型：Plan→Move→Commit，物理失败自动丢弃）
   → 验证：tsc + check:arch + check:dead-code + **build 阶段闸**（check:node-* / keys）
        ↓
Step D · 清尾巴
   D1 删壳（kvStore）· 删空目录（cutia-ui-icons）· 删未挂载死文件（requestModes）
   D2 删假机制（resourceStore.listeners）· 拆假实现（i18n 桩 → 中文直写）
   D3 迁出蓝本（_template 离开 src/）
   D4 **回改原文**：CLAUDE.md / V2 §4.1 / DATAFLOW / CONTEXT / ADR
```

**为什么要求「位置 + 名字一次到位」**（**修正**：原判"先全批改名、再全批移位"**不最优**）：
- 两步做 ⇒ 同一文件被 churn **两次**，而每次都要同步 90 个 `vi.mock` 与外部活引用清单 ⇒ **同步动作做两遍 = 漏一次的机会翻倍**（F6）；
- `mv-sync-refs move <file> <新路径>` **可顺带改名**（手册 §"move"：目标为新文件路径 = 移动并改名），所以"一次到位"**工具上本来就支持**；
- 前提：该批文件的**目标形态已定死**（位置与名字都由 §3 判定表给出）。若目标未定 ⇒ **别开工**（回去补判定），而不是"先随便改个名"。

**唯一的强制次序（跨层移位 C2）**：**先解除反方向引用，再搬**。
反例后果：把域物从 `base/utils` 迁到 `组件域/`，而 `base/utils/assetUrl.ts:32` 还 import 它 ⇒ **`base/**` 反向依赖业务域**，`check-arch` 规则 2 立刻红。
⇒ 每笔跨层移位开工前，必须跑一次「**反向引用穷举**」：

```bash
grep -rn "from '.*<拟迁出的文件名>" src/components/base --include='*.ts' --include='*.tsx'
```

**grab-bag 的例外（如 `engine/lib` 22）**：按子域切**切不动它**（消费者散在 core/commands/services/ui/hooks 五处）。
⇒ 顺序改为：**先给 grab-bag 竖墙（内部按关注点建子目录 + 门面）→ 再按关注点搬出**。

### 5.5 第一批的定案（**架构师直接判，不请示**）

**判：第一批 = `videoEditor/index.ts` 域门面（+ 收口它的域外消费点）。**

**为什么是它**（判据：成本最低 × 收益最大 × 边界已定）：

| 候选 | 域外消费点 | 内部子域 | 为什么不是它先 |
| --- | --- | --- | --- |
| **videoEditor**(258) ✅ | **1 个真实**（`App.tsx:95` 的 `EditorShell`）＋2 个已定例外（构建期 tailwind / CSS 副作用） | 9 个 | — 成本最低、收益最大、**边界已定** |
| `base/canvas`(18) | **13 个**（App.tsx 直连） | 5 组 | ⚠️ **会先撞白名单、再拆白名单**：它的 `NodePalette.ts` / `lazyNode.tsx` 是 `check-arch` 的 `BASE_ALLOWLIST` 例外边（base→nodes）；建门面后边从 `index.ts` 出发 ⇒ **白名单失效 ⇒ 闸红** ⇒ 只能"加白名单项"（清单式母体）或"门面不露它"（门面不完整）。**而 Stage 2 画布域合并后这条边自然变域内边、白名单消失** ⇒ 先建 = 两次 churn |
| `base/store`(15→8 域) | 多 | 8 | 需先拆分（Stage 2），否则门面建在错的层级 |
| `src/hooks`(25) | 多 | — | 21 个是域专用，需先归位（Stage 2） |

**本批范围（只新增 + 收口，零逻辑变更）**：
1. 新增 `src/components/videoEditor/index.ts`：re-export 域对外**窄接口**（先只露 `EditorShell` + 其 props 类型）
2. `App.tsx:95` 由深路径改走门面
3. 记例外：`tailwind.config.ts:3`（构建期）、`main.tsx:10`（CSS 副作用）**保持直引**，在门面文件头写清理由

**开工前必做**（§5.2 / §5.2.1）：`refs` + `vi.mock` 路径核对（本批改了 1 条 import 边 ⇒ 核对 mock 了 `videoEditor/EditorShell` 的测试）+ 记起点 sha + `--dry` 预览。

### 5.4 每批后置验证（**按"本批改了什么"选，不是照清单全跑**）

> 🔴 **纪律（用户 2026-09-19 校准）**：**不做无意义的测试。** 验证项按「本批的**风险类型**」选 ——
> 纯 re-export / 改 import 路径这类**零行为变化**的改动，跑全量单测 = 浪费且掩盖真信号。

| 本批改了什么 | **必跑** | **不必跑**（边际价值≈0，及理由） |
| --- | --- | --- |
| **纯 re-export / import 路径**（无行为） | `tsc` + `check:arch`（**新 barrel 会不会成环 = 唯一真风险**） | 全量单测（tsc 已证解析）· `build`（解析方式与 tsc 一致）· 死代码闸（新文件已被消费） |
| **符号改名**（含导出面变化） | `tsc` + **相关**单测 + `check:arch` | 全量单测 · `build` |
| **文件移位** | `tsc` + `check:arch` + `check:dead-code` + **`build`**（路径进构建图） | 全量单测 |
| **改数据 / 逻辑**（有行为） | `tsc` + 相关单测 + **反向探针** + `build` | — |
| **碰被 tailwind/vite/vitest 引用的文件** | **必 `build`**（这三个不在 push 闸覆盖内，tsc 也查不出） | — |
| **碰节点域**（`NODE_TYPES` / nodeDataSchema…） | **build 阶段闸**：`check:node-types` / `check:node-handles` / `check:node-data` / `check:keys` | — |
| **跨层移位**（`base/` ↔ 域） | `check:arch`（反向依赖红线）+ 反向引用穷举（§5.3） | — |
| **改共享地基**（`base/core` / `utils`…） | 全量单测（消费者太多，相关集 ≈ 全量） | — |
| **每批都跑** | **外部引用复跑**（P2 工具：改前记清单 → 改后跑同一片段必须 0）· 记起点 sha | — |
| **首次开工**（校准用） | 全量单测绿基线（**只做一次**，用于后续"与基线对比"） | — |

### 5.4.1 每批后置验证（完整清单 · 仅在**该批风险覆盖到时**逐项执行）

| 验证 | 命令 | 判据 |
| --- | --- | --- |
| 类型 | `npx tsc --noEmit` | 0 错 |
| 相关单测 | `npx vitest run tests/unit/<相关>` | 全绿（**且改前先红过**：先注入违规看它红） |
| 架构闸 | `npm run check:arch`（含 `no-circular` 红线） | 全绿 |
| 死代码 | `npm run check:dead-code` | 无新增孤儿 |
| 构建期闸 | `npm run check:node-types` / `check:node-handles` / `check:node-data` / `check:keys`（**在 build 阶段，不在 push**） | 全绿 |
| 文档对账 | `node scripts/check-doc-refs.mjs` | 0 违规 |
| **反向探针** | 改前能跑的路径仍绿 + 改前会失败的仍失败 | 零炸闸 |
| **构建**（新增·强） | `npm run build` | **只要该批碰了被 `tailwind.config.ts` / `vite.config.ts` / `vitest.config.ts` 引用的文件，就必须跑** —— 这三个**不在 push 闸覆盖内**，`tsc` 也查不出 |
| **外部引用复跑**（新增·强） | 见 §5.2 的穷举命令 | 改后**再跑一次**，与改前清单做差 ⇒ **差异必须为 0**（人工同步兜底） |
| **回滚准备**（新增） | `git rev-parse HEAD` + `git status --short` | 开工前记录起点、确认工作区干净；**改名批无 undo 命令**（只有 `move-dir --undo`），回滚靠 git |

> **顺序铁律**：`check:strict-src` 与全量 `vitest` **别并发**（实测内存争用被 SIGTERM，exit 137）。

---

## 6 · 命名规范（N1–N8）

| # | 规则 |
| --- | --- |
| N1 | 域专用导出必须带域前缀（camelCase，**域名原词不缩写**）。判据 = **撞名**：全仓同名导出 ≥2 处且分属不同域 ⇒ 违规 |
| N2 | 文件名 = 主导出名；纯类型文件用 `<域>Types.ts` |
| N3 | `*Store.ts` 仅状态真源 |
| N4 | `Contract` 一词专属 `core/contracts.ts` |
| N5 | 域目录必须有 `index.ts` 门面；跨域只准 import 门面 |
| N6 | 横切层不得放域专用物；通用物不得装进域 |
| N7 | 前缀用域名原词（`videoEditor` ✅ / `ve` ❌） |
| N8 | 改名两套身份一起改：符号 + 字符串标识 |
| **N9** | **前缀只取「域」级**（子域靠目录承载）；**同域内子域撞名**时，其余者加子域段 `<域><子域><名>`（§2.6） |

**前缀表**：`agent` · `agentCanvas` · `videoEditor` · `canvas` · `node` · `edge` · `editor`（图像编辑域）· `mosaic`（域内子目录）· `scriptBox` · `media` · `prompt` · `creative` · `relay` · `task` · `settings` · `cloud` · `provider` · `playbook`。横切层**不加前缀**。

**已裁定例外（禁重审）**：可编辑元素判据（ADR-0031 · TD-18-10~13）· 提示词域三件（TD-18-39）· `filesApi` 落盘域（TD-02-66）· `director3d`。

---

## 7 · 修订记录（回改原文，防 SSOT 漂移）

| 日期 | 被推翻 | 改为 | 依据 |
| --- | --- | --- | --- |
| 2026-09-19 | 「≥2 域消费 = 横切」 | 判据 = **有无业务语义** | §2.2 P1 |
| 2026-09-19 | 「`base/editors` 归画布域」 | **图像编辑域**（域边界由关注点定） | §2.3 P2 |
| 2026-09-19 | 「V2 §4.1 hooks 全放 src/hooks」 | 只放**跨域** hooks | §2.4 P3 |
| 2026-09-19 | 「`base/utils` 9 图片物 → 媒体域」 | 横切 3 / 域专用 5 / 单消费者 1 | §3.3 C1 |
| 2026-09-19 | 「`modalLayer` 属 videoEditor」 | 横切 | §3.3 C3 |
| 2026-09-19 | 「`base/panels` 全通用」 | 多数 app-shell；2 个属画布域 | §3.3 C4 |
| 2026-09-19 | 「域 13 笔债」 | 域 **19 个**（`store/` 内含 8 个域） | §3.1 |
| 2026-09-19 | 「域是平的」「`base/` 是一个域」 | **域分三层**（域→子域→深模块）；`base/` 是「横切层 + 域」的容器，不是域 | §2.6 |
| 2026-09-19 | 「所有域专用导出一律加域前缀」 | 前缀只取**域**级；仅**同域内子域撞名**时才加子域段 | N9 |
| 2026-09-19 | 「`videoEditor/ui/ui` 提级/合并进 `base/ui`」 | **不合并**（宿主 kit vs 编辑器自研原语），只改名消歧 | D14 |
| 2026-09-19 | 「`stores/keybindings/migrations` 是独立小域」 | 不是，是 store 私有实现细节 | D16 |
| 2026-09-19 | 「`hooks-cutia/timeline/*` 迁回域内」 | 更准：迁回 **timeline 面板目录** | D17 |
| 2026-09-19 | 「`engine/lib` 是 engine 内部工具集」 | 实为 **6 个关注点的 grab-bag** | §3.7① |
| 2026-09-19 | N8「符号 + 字符串标识一起改」 | **运行时字符串默认不改**（改键 = 数据失联）；N8 只保证符号与文件路径一致 | D19 |
| 2026-09-19 | 「先全批改名 → 再全批移位」 | **一批 = 一次 `move` 完成位置+名字**（避免两轮 churn） | D20 |
| 2026-09-19 | 验证清单缺 build 与外部引用复跑 | 补两项强验证 + 回滚准备 | §5.4 |
| 2026-09-19 | 「验证按清单全跑」 | **按"本批改了什么"选**（9 行风险矩阵）；零行为变化类改动不跑全量单测 | §5.4 |
| 2026-09-19 | 「有域外消费点就必建门面」 | 二级判据：**直连非入口内部件 ⇒ 必建**；**只直连天然入口 ⇒ 可选、收益小** | §2.7 |
| 2026-09-19 | 「`depthVideo` 是独立域」 | **视频域的子域**（用户感知不到 ⇒ 粒度定高了）；门面已撤 | §2.3.2 · §3.1.1 |
| 2026-09-19 | 域判据只有代码侧证据 | **补第 3 路证据源：用户可感知性**（P5） | §2.3.2 |

---

## 8 · 阶段计划与进度表

### Stage 1 · 命名与位置（零行为变更）

> **🔴 批次切分口径（N9 推论）**：**按「子域」切，不按「域」切** —— 大域（videoEditor 258 / agent 56 / 画布 60）一次做完＝单次 diff 巨大、说不清零炸；按子域切则每批 10–40 文件、可独立验证可回滚。

| 批次 | 范围（子域级） | 债号 | 改动面 |
| --- | --- | --- | --- |
| S1-1 | 撞名收口（19 名；含 `toast` 前提复核 —— 全仓无第二个 `toast` 定义） | TD-18-42/43 | 19 名 |
| S1-2 | 域写错 + 通用物提级（`canvasHost`→`agentCanvasHost`；`cn` 提级） | TD-18-34 | 4 / 45 |
| S1-3 | 域物迁出横切层（§3.4 #1#2#3#11） | TD-18-35 | ~30 import |
| S1-4 | 文件名歧义/误导名/浅壳（`assets.ts`/`generationContract`/`kvStore`/`ve-`） | TD-18-45/40/36 | 27 / 3 / 6 |
| S1-5 | 门面补齐（19 域中 15 缺） | TD-18-41④ | 15 域 |
| S1-6 | 目录名与内容对齐（`components/panels`→agent；后端 relay 归位） | 新 | 6 + 3 |
| S1-7 | 死代码/假机制（D6–D10） | 新 | 5 类 |

### Stage 2 · 深模块化

| 批次 | 范围 |
| --- | --- |
| S2-1 | 画布域合并（四组 → 1 域，保留 `check-arch` 白名单边语义） |
| S2-2 | 图像编辑域成型（逻辑 + UI 同目录） |
| S2-3 | AI 中继域成型（`api/relay/` + 门面，对齐后端 `ai-relay/`） |
| S2-4 | `base/store` 按 8 域拆出非真源 |
| S2-5 | videoEditor：`engine/lib` 拆关注点、工具层三合一、UI 两套收口 |
| S2-6 | `src/hooks` 域专用 hook 回域（D12） |
| S2-7 | 后端：`routes/utils` 域物归位 + `ai-relay` 门面收口 |

### Stage 3 · 契约与验收

失败判别联合落到各域边界 · 域前缀对账（建闸前过「建闸前置评审」）· `DATAFLOW`/`CONTEXT`/`ADR` 同步。

### 进度表

| 项 | 状态 | 证据 |
| --- | --- | --- |
| 第一步（分清有哪些鱼） | **已完成** | §2–§4，含 7 处更正；5 个子 Agent 取证 |
| 安全移名/移位 SOP | **已完成** | §5 |
| **P1 修闸盲区（硬前置）** | **已完成** | `daily/架构日志/17-跨区-闸判据对准TDZ红线与结构环登记-2026-09-19.md`；工具债 **TD-17-21 已解决** · 结构环债 **TD-22-68 待还** |
| **P2 外部引用对账机器化** | **已完成** | `scripts/scan-outside-refs.mjs`（改前记清单 → 改后复跑旧片段必须 0；`--all` 盘点：259 引用/40 断链）；债 **TD-24-7 待还** |
| **P3 F5 落 ADR** | **已完成** | **ADR-0038**（生效，架构师 2026-09-19） |
| **Step A 首批：videoEditor 门面** | **已完成** | `daily/架构日志/21-跨区-域模块化StepA建门面批次-2026-09-19.md` §一–四（域外消费点 1→0；tsc 0 错；无 TDZ 环新增） |
| **Step A 第二批：depthVideo 门面** | **已撤销**（弯路） | 同文件 §五：粒度错（子域当域）+ 门面错层级；已完整回退（tsc 0 错 / 586 文件 / 环未增） |
| **按 P5 重出 §3.1 域清单** | **待做**（下一步） | 已确认 3 处修订见 §3.1.1 |
| S1-1 … S2-7 | 待做 | — |
