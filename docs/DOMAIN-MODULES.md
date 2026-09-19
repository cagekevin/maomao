# 域模块化 · 鱼塘地图 / 冲突裁决 / 安全移名移位 SOP

> **🔄 会话交接（2026-09-19）**：接手请先读 **`docs/DOMAIN-MODULES-HANDOFF.md`** —— 真源地图 · 已完成批次 · 8 条硬坑清单 · 开工顺序。

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
| **画布域**(38) | `canvas/`（机制 17）· `canvas/nodes/`（节点 18）· `canvas/edges/`（边 3） —— **域根 = `components/canvas/`** |
| **图像编辑域** | `editors/*`（查看/裁剪/全景/相机） · `cameraParams`（相机参数） · 打码 |
| **`base/`** —— **目标形态：只留横切层**（2026-09-19 裁定，见 §7） | 横切：`core`·`utils`·`ui`·`api`·`storage`·`panels`（+ `media`，经 §3.1.4 C-1 裁定 = **横切媒体引用协议层**，非域）；**已迁出**：`canvas` ⇒ `components/canvas/` · `creative` ⇒ `components/creative/` · `depthVideo` ⇒ `components/video/depthVideo/` · `editors` ⇒ `components/editors/`；**待迁出**：`prompt`·`store`（+ 散件 `nodeImage.ts`） |
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

### 3.1 域清单（**按目录轴的中间产物 · 已被 §3.1.3 能力轴取代**）

> ⚠️ **本表是"按目录逐个取证"的过程产物，不是最终划分** —— 最终划分见 **§3.1.3（能力轴）**。
> 保留它的原因：它是 §3.1.1 / §3.1.2 三处修订的取证底账。**禁止按本表开工**。

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

**§3.1.2 再补三处修订（用户 2026-09-19 追问「素材库不也是一个专门的东西吗？素材生成啊」）**

| 项 | 现状（实测） | 处置 |
| --- | --- | --- |
| **+「素材域」** | 同一个"东西"散在 **3 处**：数据真源 `base/store/resourceStore.ts`（**17 处消费**）· UI `base/panels/{ResourceLibrary,ResourceStrip,ResourcePreview}` + `ImportMediaModal` · 来源适配 `base/media/providers/librarySource` | **补立**（数据 + UI + 来源适配收成一个域） |
| **+「生成域」** | 同样散在多处：`base/api/generate.ts`（唯一收口 4 函数）· `base/media/providers/generatedSource` · `base/panels/GeneratedView` · `base/store/{generationContract,nodeRuntimeStore}` | **补立**；**与素材域是不同数据源**（**用户 2026-09-17 已裁定**，见 `generatedSource.ts:12-18` 头注释原文） |
| **`base/media` 名不副实** | 它只被 **3 处**消费（`App.tsx` / `ImportMediaModal` / 测试），真实职责 = **「可引用媒体源」注册表**（`mediaRefRegistry` + `mediaRefTypes` + `libraryBrowse` + `providers/*`），被素材域 / 生成域 / 画布**共同**使用 | **收窄为「媒体引用协议层」**（接近横切契约性质）；"媒体引用**域**"这个命名是**名不副实** |

> 明细（各自边界与归属）**待逐个取证后重出 §3.1**（不预设合并方案）。

### 3.1.3 🔴 **划分轴修正：目录轴 → 能力轴**（2026-09-19 · 用户质疑「划分有大问题」引出）

**用户的质疑成立，而且问题不在某一处判错，在「轴」用错了**：

```
我用的轴：代码目录（base/canvas、nodes、edges、base/media、base/api …）
正确的轴：业务能力（产品/用户能说成"一个东西"的）
两条轴不一致 ⇒ 目录恰好内聚的蒙对；散在多目录的漏域；一目录多能力的被当成一个域
```

**决定性证据：产品自己在代码里写明了它的能力分法**

| 位置 | 产品的一级能力（原文） |
| --- | --- |
| `TopNav.tsx:69-71` | **画布** · **多开**（两个一级视图）+「设置」` :261` +「AI 助手」` :284` |
| `NodePalette.ts:106-109` | **文本工具 / 图片工具 / 视频工具 / 其他工具** |
| `LeftPanel.tsx:21-24` | **任务 / 生成 / 素材 / 提示词**（左栏四页签） |
| `SettingsFrame.tsx:25-30` | AI 助手 / 第三方API配置 / 账号 / 其他设置 / 存储监控 |
| `NODE_TYPES`（`contracts.ts`） | 16 种节点（`assetNode`…`ghostTarget`） |
| 后端 `localTool/src/routes/`(18) | 文件 / 生成 / 任务 / 项目 / 资源 / 供应商 / 平台 / 系统 / 日志 / KV / 代理(hf·iconify) / 局部编辑 / 管理 |

**产品的归类实测**：`图片`·`图片盒子`·`图片切分`·`图片拼图`·`全景图`·**`3D导演台`**·**`人脸打码`**·**`循环生成`** → 全归 **`cat:'image'`**；
`视频生成`·`视频抽帧`·`视频处理` → **`cat:'video'`**；`编组`·`剧本盒子` → **`cat:'other'`**（`NodePalette.ts:123-255`）。

**对照差距（这就是"大问题"）**：

| 产品轴（4 类工具） | 我的目录轴清单 | 差 |
| --- | --- | --- |
| **图片工具** | 拆成 图像编辑域 + 画布域(nodes) + 中继域 | ❌ **"图片"根本没作为能力域存在**；零件散 3 处 |
| **视频工具** | 塞在画布域 + `depthVideo` + 横切 | ⚠️ 已补「视频域」，但仍散 |
| **文本工具** | 拆成 提示词域 + 创作库域 + 中继域 | ❌ **"文本"没作为能力域存在**；零件散 3 处 |
| **其他工具**（编组/剧本盒子） | 画布域 + scriptbox | ✅ 基本一致 |

**⇒ 修正后的域清单（能力轴 · 采用产品/用户语言）**：

```
一级能力域（产品可感知：「一个东西」）
  图片能力  ⊃ 图片生成 · 图片盒子 · 图片切分 · 图片拼图 · 全景 · 3D导演台 · 人脸打码 · 循环生成 · 放大/压缩
  视频能力  ⊃ 视频生成 · 视频抽帧 · 视频处理 · 深度视频(sub) · 时间轴换算
  文本能力  ⊃ 文本生成 · 提示词输入 · 创作库预设
  素材能力  ⊃ 素材库 · 素材节点 · 导入 · 来源注册          （与"生成"不同数据源，用户 09-17 已裁定）
  生成能力  ⊃ 提交/轮询/落盘/结果来源                       （跨内容类型的共享链路）
  剪辑器    （videoEditor，独立应用）
  剧本盒子  （scriptbox）
  3D导演台  （director3d）
  AI 助手   ⊃ 对话 · 运行时 · 会话 · 表格(sub)
宿主 / 编排层
  画布      ⊃ 机制 · 节点宿主 · 边 · 编组   ← 产品把「编组」归 other，说明画布是**宿主**不是内容能力
基础设施域
  设置 · 多开/账号 · 云同步 · 供应商 · 文件 · 项目 · 任务 · 平台/系统 · 日志
横切层（无域前缀）
  契约(contracts) · 事件(eventBus) · 存储(contentStore) · HTTP · UI 原语 · logger · 遥测 · 媒体引用协议
```

**🔴 与旧清单的关系（防 SSOT 第二份）**：下方 **§3.1 的"目录轴清单"已被本节取代**，
仅作为「按目录逐文件取证」的**中间产物**保留（它的 §3.1.1 / §3.1.2 三处修订仍然有效并已并入本节能力轴）。

**待取证（下一步）**：能力轴的**文件级归属**逐条取证 —— 特别是
① 「图片能力」的零件清单（`imageGenerate` 节点 + `base/editors/*` + `gridSplit/merge` + `panorama` + `faceMosaic` + `imageUpscale/Compress/Pixel`）；
② 「文本能力」的零件清单（`textGenerate` + `base/prompt/*` + `base/creative/*`）；
③ 判断 `生成能力` 与三内容能力的分界（`generate.ts` 是共享链路还是各能力的私有）。

#### 3.1.3.1 文件级取证结论（第一批 · 2026-09-19）

**① 「生成链路」是共享基础设施，不是任何内容能力的私有** ✅ 判据成立

| 出口 | 调用点（实测） | 被几个能力用 |
| --- | --- | --- |
| `generateImage` | `nodes/ImageGenerate.tsx:319` · `nodes/_template/TemplateNode.tsx:274` · `scriptbox/scriptBoxEngine.ts`（头注 `:154` 自述走它） | 图片 · 剧本盒子 |
| `generateVideo` | `nodes/VideoGenerate.tsx:236` | 视频 |
| `chatCompletions` | `nodes/TextGenerate.tsx:210` · `agent/runtime/contextCompression.ts:149` · `scriptbox/scriptBoxEngine.ts`（`:153`） | 文本 · AI 助手 · 剧本盒子 |
| `chatStream` | `agent/runtime/agentRuntime.ts:227`（**唯一**） | AI 助手 |

⇒ 4 路出口被 **4 个不同能力**调用 ⇒ `base/api/generate.ts` 是**跨内容类型的共享链路**
⇒ 归「生成能力（AI 中继）」为**基础设施**，**不归**图片/视频/文本任何一方。这与 P1 判据（有业务语义 ⇒ 是域）一致：它是**独立的域**，只是被多域消费。

**② 🔴 反直觉发现：「提示词输入」与「创作库预设」不是"文本能力"的零件 —— 它们被图片/视频/文本三者共用**

| 件 | 实测消费方（域维度） | 新判定 |
| --- | --- | --- |
| `base/prompt/*`（`PromptInput`/`promptChips`/`promptLayout`…） | `nodes/{ImageGenerate, TextGenerate, VideoGenerate, _template/TemplateNode}` + `base/panels/FullscreenEditor` | **跨内容类型共享原语**（≠ 文本能力私有） |
| `base/creative/*`（`creativePresets`/`CreativeLibraryButton`…） | `nodes/{Image, Text, Video}Generate` + `agent/canvas/canvasHost` + `hooks/useNodeData` + 自身 views | **跨内容类型共享原语**（预设库可含图片/视频/文本提示词） |

⇒ **修正刚才的草稿**：不能写成「文本能力 ⊃ 提示词输入 · 创作库预设」；它们应保持**独立域（提示词域 / 创作库域）**，
被三个内容能力**共用**。内容能力（图片/视频/文本）的零件 = **该内容类型的节点 + 该内容类型专属的处理**；
**共享输入与共享预设留在共享域**。

**③ 「图片能力」的专属零件成立** ✅：`base/editors/*` 的消费方只在图片侧
（`nodes/ImageGenerate.tsx` · `nodes/useImageHoverActions.tsx`；`ImageZoomDialog` 除外——它是横切，10+ 消费方）。

**④ 🔴 命名歧义（新发现）**：**「生成」一词在代码里指两个不同东西**

| 词 | 指 | 位置 | 判定 |
| --- | --- | --- | --- |
| 「生成」 | **生成结果浏览**（左栏页签 = AI 产出的素材） | `LeftPanel.tsx:22`（`key:'generated'`）+ `base/media/providers/generatedSource` + `base/panels/GeneratedView` | 属**素材域**的一个来源 |
| 「生成」 | **生成链路**（提交/轮询/落盘） | `base/api/generate.ts` · `pollTask.ts` · `relayProxy.ts` | 属**生成能力/中继域** |

⇒ 两个"生成"必须**分别命名**（如 `generatedAssets`=生成结果来源 vs `generationRelay`=生成链路），否则就是撞名家族里的新成员。

**待取证（第二批）**：图片/视频/文本三个内容能力的**专属零件**逐条列出（含 `nodes/*` 16 个节点的**能力归属表**：
每个节点归哪个内容能力或哪个机制），以及 `nodes/_template/TemplateNode` 这个"蓝本"是否该留在源码树。

#### 3.1.3.2 节点能力归属表（第二批取证 · 每行实测其业务域 import）

| 节点 | 实测跨域依赖（业务域） | **能力归属** |
| --- | --- | --- |
| `ImageGenerate.tsx` | 中继 `base/api/index` · `creative` · `canvas` | **图片能力 ⊃ 生成**（共用 creative） |
| `ImageBoxNode.tsx` | `base/api/filesApi` · `base/editors/ImageZoomDialog` | **图片能力 ⊃ 图片盒子** |
| `GridSplitNode.tsx` | `base/panels/FullscreenShell` · `canvas` | **图片能力 ⊃ 切分** |
| `GridMergeNode.tsx` | `base/editors/{OverlayEditor,ImageZoomDialog}` · `canvas` | **图片能力 ⊃ 拼图** |
| `PanoramaNode.tsx` | `base/editors/PanoViewer` · `base/panels/*` · `canvas` | **图片能力 ⊃ 全景** |
| `FaceMosaicNode.tsx` | `base/editors/FaceMosaicEditor` · `ImageZoomDialog` · `canvas` | **图片能力 ⊃ 打码** |
| `VideoGenerate.tsx` | 中继 · `creative` · **`depthVideo`** · `canvas` | **视频能力 ⊃ 生成** |
| `VideoExtractNode.tsx` | （本次 grep 过滤了 `utils/`，**需复核**） | **视频能力 ⊃ 抽帧**（待复核实现落点） |
| `VideoProcessNode.tsx` | `base/store/nodeRuntimeStore` · `canvas` | **视频能力 ⊃ 处理** |
| `TextGenerate.tsx` | 中继 · `creative` · `canvas` | **文本能力 ⊃ 生成** |
| `AssetNode.tsx` | **`depthVideo`** · `canvas` · 中继 | **素材能力**（入口，内含视频子能力） |
| `ScriptBoxNode.tsx` | `scriptbox/*` ×6 | **剧本盒子（独立应用）** |
| `Director3DNode.tsx` | `director3d/Director3DOverlay` | **3D导演台（独立应用）** |
| **`GroupNode.tsx`** | **仅通用层** | **画布机制 ⊃ 编组** |
| **`GhostTargetNode.tsx`** | **仅通用层** | **画布机制**（连线占位，非真实节点） |
| **`LoopNode.tsx`** | **仅通用层**（`canvas` 除外） | **画布机制 ⊃ 循环**（产品归 `cat:image`，但依赖图说明它是编排机制） |
| **`useImageHoverActions.tsx`** | `base/editors/{ImageEditor,InlineImageCropper}` · `filesApi` | ⚠️ **不是节点**：图片能力的辅助 hook，**住在 `nodes/` = 游离物** |

**⇒ 结构性发现：`nodes/` 一个目录里混着四种东西**

| 种类 | 成员 | 按能力轴该去哪 |
| --- | --- | --- |
| **内容能力节点**（11） | 图片 6 + 视频 3 + 文本 1 + 素材 1 | 各自能力域 |
| **画布机制节点**（3） | `GroupNode` · `GhostTargetNode` · `LoopNode` | **画布域**（它们是编排机制，不是内容能力） |
| **能力辅助 hook**（1） | `useImageHoverActions` | 图片能力域（游离物归位） |
| **独立应用入口**（2） | `ScriptBoxNode` · `Director3DNode` | scriptbox / director3d（仅入口挂载点留在 `nodes/`） |

⇒ 这解释了为什么 `nodes/` 一直"像画布域又不全是"：**它是「画布机制节点 + 各能力的 UI 挂载点」的混合目录**（D15 的判定成立，并可细化为本表）。

**待取证（第三批）**：
① `VideoExtractNode` 的实现落点（是否走 `base/utils/captureFrame`）；
② 图片能力的**非节点零件**（`imageCompress`/`imageUpscale`/`imagePixel` 各属谁）；
③ `nodes/_template/TemplateNode` 这个"零生产消费的蓝本"是否该迁出源码树（D6）。

#### 3.1.3.3 第三批取证 · 🔴 **两笔"反向依赖"**（换能力轴后才看得见）

**零件归属（实测消费方）**：

| 零件 | 消费方 | 归属 |
| --- | --- | --- |
| `base/utils/captureFrame.ts` | `nodes/VideoExtractNode.tsx:19`（`drawVideoFrame`/`setCrossOriginForReadable`） | **视频能力 ⊃ 抽帧**（域物住横切层） |
| `base/utils/imageCompress.ts` | `base/editors/{ImageEditor,InlineImageCropper}` · `nodes/useImageHoverActions` · **`base/utils/assetUrl.ts`** | **图片能力**（域物住横切层） |
| `base/utils/imageUpscale.ts` | `nodes/useImageHoverActions` | **图片能力** |
| `base/utils/imagePixel.ts` | **`base/api/generate.ts`** | 数据是"图片像素表" ⇒ **图片能力**（见下方反向依赖 ②） |

**🔴 反向依赖 ①：横切层 → 图片能力**

```
src/components/base/utils/assetUrl.ts  →  src/components/base/utils/imageCompress.ts
```
`assetUrl` 是**横切层**（URL 处理，被多域消费），却依赖**图片能力的件** ⇒ 说明 `assetUrl` 里**混着图片处理职责**（它不只做 URL）。
⇒ 处置方向：把图片处理部分从 `assetUrl` 剥离，或将 `imageCompress` 保持为横切（**取决于**「压缩」是图片语义还是通用语义 —— 待判）。

**🔴 反向依赖 ②：基础设施（中继）→ 图片能力**

```
src/components/base/api/generate.ts  →  src/components/base/utils/imagePixel.ts
```
`generate.ts`（生成链路 = 基础设施，被 4 个能力共用）依赖 `imagePixel`（图片像素表）⇒
**基础设施依赖内容能力** ⇒ 以后加一种内容类型就要改基础设施（**换轴前看不见，因为那时 `imagePixel` 被当"通用工具"**）。

⇒ **这两笔是"能力轴"的即时收益**：只有先判定"谁是内容能力、谁是基础设施"，才看得出"基础设施依赖内容能力"是**方向反了**。

**⇒ 已登记的处置**：两笔均记入**待裁定清单**（不预设解法，需按 §2.1 判据逐条判"它到底是通用还是内容专属"）。

**待取证（第四批）**：`nodes/_template/TemplateNode`（零生产消费蓝本，D6）· `base/utils/assetUrl` 的真实职责边界 · `imagePixel` 归属裁决。

#### 3.1.3.4 第四批取证 · 三处裁决 + 🔴 **发现一个已深模块化的范本**

**① `TemplateNode` = 「非域物」开发蓝本（不是能力节点）**

| 证据 | 内容 |
| --- | --- |
| 自述 | `nodes/_template/TemplateNode.tsx:36`「【节点模板】TemplateNode —— 新建节点的**唯一权威蓝本**」 |
| 登记 | `contracts.ts:820`「原 `templateNode` 登记项已于 2026-09-11 删除（TD-04-5）——TemplateNode 是「新建节点参考蓝本」」 |
| 消费方 | **仅 2 个测试**（`tests/unit/TemplateNode{,.upstream}.test.tsx`）⇒ **零生产消费** |

⇒ 判定：它**不属于任何能力域**，是**开发参考蓝本**。**必须显式登记为"非域物"**，否则每次盘点都会被误归类
（陷阱证据：`contracts.ts:809` 说它的示例命名空间就叫 `imageGenerateNode` ⇒ 极易被当成图片能力节点）。

**② `assetUrl` 反向依赖的真因：它被塞了两个域的职责**（554 行）

| 导出符号分组 | 语义 | 归属 |
| --- | --- | --- |
| `isLocalFileUrl` · `toRelativeFileUrl` · `resolveAssetUrl` · `normalizeAssetUrl` · `buildThumbnailUrl` · `resolveAssetDisplayUrl` · `buildContentUrlResolver` · `assertMutuallyExclusiveAssetForm` | **URL 归一/解析/缩略** | **横切层** ✅ |
| `MAX_SEND_DIM` · `fileToDataUrl` · `normalizeAssetUrlForSend` · `normalizeAssetUrlsForSend` · `toImageContentBlocks` · `classifyImageType` · `summarizeAssetUrls` | **发送前图片处理**（压缩→编码→content blocks） | ⚠️ **图片/发送准备语义** |

消费方实测 **18+ 文件跨 9 个目录**（agent · api · editors · media · panels · ui · utils · nodes …）⇒ **它确实是横切层**。
⇒ **反向依赖 ① 的解法方向**：不是"横切依赖图片"，而是**把「发送前归一（压缩/编码/contentBlocks）」抽成独立件**，
`assetUrl` 只留 URL 语义（**这是拆分，不是改名**）。

**③ `imagePixel` 裁决：数据是图片语义，但被基础设施消费**

- 自述：`base/utils/imagePixel.ts:1`「图片比例 × 清晰度档位 → 精确像素 的查表工具（**唯一真源**）」，
  源自 `base/api/imageApi.ts` 迁出（L3 收口时拆出，"供 generate.ts 与测试复用"）
- 导出：`RATIO_PIXEL_TABLE` · `resolveImagePixel(ratio,size)`；**唯一生产消费 = `base/api/generate.ts:22`**
⇒ 判据冲突（按**数据语义**=图片能力；按**消费方**=中继）⇒ **列待裁定**：
  - 方案 A（倾向）：**调用方算像素，中继只收 `size` 字符串** ⇒ 中继不依赖它 ⇒ 方向修正；
  - 方案 B：承认中继要懂各内容类型参数 ⇒ 它成中继的适配器（会越来越胖）。
- **无论哪种，它现在住 `base/utils/`（横切层）= 住错位置**（域物住横切层）。

**④ 🔴 意外发现：`base/media/` 是**全仓唯一"已深模块化"的域** —— 它就是范本**

```
src/components/base/media/
  index.ts                ← ✅ 门面（域的唯一出口）
  mediaRefTypes.ts        ← 类型（契约）
  mediaRefRegistry.ts     ← 注册表（机制）
  libraryBrowse.ts        ← 能力
  canvasNodesBridge.ts    ← 与画布域的桥（唯一越界点，显式命名）
  providers/{index,canvasSource,generatedSource,librarySource}.ts  ← 分层（多来源 + 门面）
```

⇒ **这个域已经做到了我们要推广的形态**：门面唯一 · 分层清晰 · 跨域桥显式命名 · 来源可插拔。
⇒ **本次重构的验收标准可以照抄它**，不用我发明（呼应"本仓已有正确形态"的判据）。

**素材能力的零件清单（实测消费方）**：

| 件 | 消费方（域维度） | 判定 |
| --- | --- | --- |
| `base/media/*`（9，有门面） | `nodes/AssetNode` · `panels/ResourceLibrary` · `hooks/*` | **素材能力域**（范本） |
| `base/store/resourceStore.ts` | `media/providers/*` · `panels/ResourceLibrary` · `nodes/{AssetNode,ImageGenerate}` · `scriptbox/*` · `hooks/*` | **素材真源**（跨 5 域共享 = 基础设施性质，但数据属素材） |
| `base/panels/ResourceLibrary.tsx` | 左栏页签「素材」 | 素材能力的 UI 面 |
| `nodes/AssetNode.tsx` | 画布节点入口 | 素材能力的画布入口 |
| `base/panels/ResourceStrip.tsx` | `FullscreenEditor` · `nodes/{Image,Text,Video}Generate` · `TemplateNode` · `scriptbox/StepShots` | ⚠️ **跨能力共用 UI**（不是素材私有）⇒ 留通用面板层 |

**待取证（第五批）**：视频能力零件（`depthVideo`+`captureFrame`+`timebase`+`videoEditor` 边界）·
文本能力零件（`TextGenerate` 的实现依赖是否过薄）· `useNodeData`/`useConnectedInputs` 等 hooks 的域归属。

#### 3.1.3.5 第五批取证 · 视频能力散 7 处 / 文本能力"薄"的实证 / hooks 归属

**① 视频能力零件**：**散在 7 处**（登记里一笔未提 ⇒ 印证"视频域漏了"）

| # | 位置 | 件 |
| --- | --- | --- |
| 1 | `base/depthVideo/`（5：`DepthVideoModal`·`depthUrls`·`engine`·`loader`·`spawn`） | 深度视频子能力（**无 `index.ts` 门面**） |
| 2 | `base/utils/captureFrame.ts` | 抽帧（`VideoExtractNode:19` 实测消费） |
| 3 | `base/utils/videoEngine.ts` | ⚠️ 新发现 |
| 4 | `base/utils/timeline/{sourceTime,timeScale}.ts` | ⚠️ 新发现（时间轴换算） |
| 5 | `base/ui/VideoThumbnail.tsx` | 视频缩略图 |
| 6 | `hooks/useVideoPoster.ts` | 视频封面 |
| 7 | `base/core/videoEditorKeys.ts` | 快捷键（域物住横切层） |

+ 画布侧入口 `nodes/{VideoGenerate,VideoExtractNode,VideoProcessNode}`。
> 注意区分：`director3d/depth.tsx` · `director3d/panels/Timeline.tsx` 是 **3D 导演台自己**的时间轴，**不是**视频能力的件（防误并）。

**② 文本能力「薄」的实证 ⇒ 佐证新判据「域≠大模块」**

`TextGenerate.tsx` 的**全部 import（35 行）实测**：**100% 是共享原语**
（`NodeShell` `HoverToolbar` `ExpandablePanel` `GenerateButton` `ModelSelect` `PromptInput` `ResourceStrip` `FullscreenEditor` `GeneratingOverlay` `CreativeLibraryButton` `creativePresets` `uiHooks` + 7 个通用节点 hooks + `buildEffectivePrompt` `promptChips` `deriveNodes` `CanvasEdgesContext` `nodePrefs` `resolveProviderModel` `logger` `reportDegrade`）
＋ **唯一的专属出口调用**：`chatCompletions`（`:30`）· `saveTextToTasks`（`:29`）。

⇒ 判定：**文本能力仍应是独立域**（产品有一级入口「文本工具」、有独立数据形态 text），
但它的**域大小 = 1 节点 + 2 出口**。⇒ **实例化 §2.4 P3 判据：域是归属单位，深度是实现质量，二者独立**
（"域小"不是"不该是域"；做法是**先把归属定对、再谈深度**）。

**③ hooks 归属：25 个里 22 个是域专用** ⇒ R1 冲突取证成立

| 组 | hooks | 归属 |
| --- | --- | --- |
| 画布/节点域专用（15） | `useCanvasHistory` `useCanvasShortcuts` `useCanvasSync` `useConnectedInputs` `useCopyNode` `useDisconnectSource` `useEdgeData` `useFitNodeRatio` `useGenerateNode` `useNodeData` `useNodeExpanded` `useNodeField` `useNodeGeneration` `useNodeRename` `useSyncNodeData` | 画布域 / 节点机制 |
| 素材·画布交互（4） | `useAssetDegrade` `useAssetDragToCanvas` `useAssetDropPaste` `useResourceMoveToFolder` | 素材/画布交互 |
| 各应用域（3） | `useScriptBoxEngine`（剧本）· `useVideoPoster`（视频）· `useArrangeCanvas`（画布） | 各自域 |
| 可能通用（3） | `useStoreSelector` · `useLocalToolStatus` · `useContextMenu` | 横切（待复核） |

⇒ **与 V2 §4.1「跨域 hooks 放 `src/hooks/`」判据冲突**（22/25 其实是域专用）⇒ 需**修订 §4.1 或迁移 hooks**（R1）。

**④ 🔴 命名撞名家族再扩：「文本/prompt」一词覆盖 5 个不同域**

| 叫法 | 实际属域 | 位置 |
| --- | --- | --- |
| 提示词（输入/社区库） | **提示词域**（跨内容能力共用） | `base/prompt/*` |
| 预设/创作库 | **创作库域** | `base/creative/*` |
| 表格提示词 | **AI 助手 ⊃ 表格** | `agent/assistantTable/assistantTablePrompt` |
| 剧本提示词 | **剧本盒子** | `scriptbox/scriptBoxPrompt*` ×3 |
| 相机参数提示词 | **图片能力 ⊃ 3D/相机** | `base/editors/cameraParams/cameraPrompt` |

⇒ 这 5 处**必须分别命名**（`promptInput` / `creativePreset` / `assistantTablePrompt` / `scriptBoxPrompt` / `cameraPrompt`），
否则就是「生成」二义之后**第 2 个同名词二义家族**。

**待取证（第六批）**：`base/canvas`(18) 与 `base/core`(18) 的逐文件归属（画布机制 vs 横切）· `scriptbox`/`director3d` 的内部结构是否已是深模块 · `src/types` 与 `base/ui` 的边界。

#### 3.1.3.6 第六批取证 · 🔴 **推翻我的一个粗判：`base/core` 大体是干净的横切层**

判据：逐文件统计**消费方所属域集合**（≥2 域 = 横切；=1 域 = 该域专用）。实测（`base/core` 18 文件）：

| 判定 | 文件（消费方数） |
| --- | --- |
| ✅ **横切**（14） | `logger`(87) · `utils`(55) · `toastStore`(51) · `idGen`(45) · `contracts`(34) · `config`(33) · `uiHooks`(33) · `degrade`(31) · `contentStore`(26) · `eventBus`(14) · `confirmStore`(9) · `modalLayer`(6) · `backendLogStream`(1·启动期) · `logger` 家族 |
| ⚠️ **域专用**（4） | `agentKeys`(6·全在 agent 侧) · **`canvasHotkeys`(1·nodes)** · **`canvasSyncBus`(3·画布侧)** · **`videoEditorKeys`(1·videoEditor)** |
| ❓ **单消费者待判**（1） | `editorSession`(1·App.tsx) |

⇒ **更正我的粗判**：我此前说"`base/core` 是垃圾桶、5 个域物" —— 实测是 **14/18 是干净的横切**，只有 **4 个域物**混入。
⇒ **对结论的影响**：`base/core` **不需要重排**，只需**迁出 4 个域物**（成本远小于我原先的估计）。

**`base/canvas` 逐文件判定（18 文件）：整体是画布域实体**，不是横切

| 消费方数 | 文件 |
| --- | --- |
| 11 | `CanvasEdgesContext` · `deriveNodes` |
| 10 | `nodeDefaults` |
| 7 | `nodePrefs` |
| 3 | `lod` |
| 2 | `groupNodes` · `nodeMedia` |
| 1 | `ArrangeConfirm`(App) · `NodePalette`(App) · `canvasContextMenu`(App) · `canvasSnapshotSchema`(base) · `historyStack`(hooks) · `lazyNode`(App) · `nodeDataSchema`(App) · `structuralSnapshot`(hooks) · **`toolRegistry`(agent)** · `upstreamLink`(App) · `useCanvasEventSubscriptions`(App) |

⇒ 消费方**全在画布侧**（App · nodes · hooks · base · edges · agent）⇒ **原 `base/canvas/` 整体归画布域** ✅（含画布域内部件，单消费者是"被 App 装配"，正常）。
⇒ 唯一跨域点：`toolRegistry` 被 **agent** 消费 1 处 ⇒ 那是 **AI 操作画布的桥**（显式命名即可，不必拆）。
⇒ 修正后的画布域构成：**机制 17 + `nodes/`(18 挂载点) + `edges/`(3) + `App.tsx` 装配**，
再加 `base/core/{canvasHotkeys,canvasSyncBus}` 归位进来；`agent/canvas/` 归 agent 域（D15）。
⇒ **域根落点（2026-09-19 裁定 · S2-1 执行）= `src/components/canvas/`**：机制件住域根，`nodes/`、`edges/` 为子域目录。
判据见 §2.6 与 §7 修订记录 —— 核心是 **N5「域目录须有门面」要求「域 = 一个目录」**，跨 3 目录的域建不了单一 `域/index.ts`。

**⇒ 第六批净收益**：**把"横切层要重排"降级为"迁出 4 个域物"**（成本估计从"大"降到"小"）。

#### 3.1.3.7 第七批取证 · 深模块范本普查（**3 个，不是 1 个**）

| 域 | 门面 | 结构 | 判定 |
| --- | --- | --- | --- |
| `agent/` | ✅ `index.ts` | 已分层（runtime/conversation/assistantTable/canvas…） | **范本 ①** |
| `videoEditor/` | ✅ `index.ts` | 257 文件、内部分层（engine/…） | **范本 ②**（但内部命名违规多） |
| `base/media/` | ✅ `index.ts` | 门面 + providers 分层 + registry + types | **范本 ③**（形态最干净） |
| `scriptbox/` | ❌ | **17 文件平铺**，但**命名全带 `scriptBox` 前缀** ✅ | "命名已合规、未收口" |
| `director3d/` | ❌ | 22 项，**通用名重灾区**（见下） | "未收口 + 命名违规最多" |
| `base/depthVideo/` | ❌ | 5 文件平铺 | 未收口 |
| `nodes/` · `edges/` | ❌ | 见 §3.1.3.2（混合目录） | 待拆 |

⇒ 修正：**有门面的顶层域是 2 个（`agent`/`videoEditor`）+ 子域 1 个（`base/media`）= 3 个范本**，
不是我先前说的 1 个。**这 3 个就是"深模块"的现成样板**（形态照抄，无需发明）。

**🔴 `director3d/` 是命名违规重灾区（新发现）**：`App.tsx` · `useToast.ts` · `log.ts` · `storage.ts` ·
`ConfirmDialog.tsx` · `history.ts` · `project.ts` · `panels/` · `models.tsx` · `tracks.ts` —— **全部是通用名、零 `d3d`/`director` 前缀**。
⇒ 其中 `useToast` · `log` · `storage` · `ConfirmDialog` 属**撞名家族**（与 `base/core/toastStore` · `logger` · `base/storage` · `base/ui` 同义），
⇒ **需回补撞名清单**（我此前的扫描只覆盖 `export const/function/type/interface/class`，可能漏掉 `director3d` 这批）。

> ⚠️ **审计 A3 就地标注（例外优先）**：`director3d` 属**已登记例外**（本文件 §6「已裁定例外（禁重审）」＋ V2 日志 §七「`director3d` 域多处自成一套（`ErrorBoundary` / `log.ts`），属**已登记例外，未纳入收口**」）
> ⇒ **本清单只作记录，本计划不施工**；若要给 `director3d` 加前缀，须**另开裁定撤销该例外**（不在 S1/S2 批次内）。

**`src/types/`（5 文件）**：`asset.ts` · `errors.ts` · `index.ts` · `provider.ts` · `gifenc.d.ts` — 小而清晰，**保持横切**。
**`base/ui/`（24 文件）**：UI 原语横切层（与 `videoEditor/ui/ui/` 28 个的关系见 §3.1.3.1 ④ 家族，待裁定）。

**待验证（第八批）**：① **"有门面"是否真被走** —— 域外是否绕过 `videoEditor/index.ts`、`agent/index.ts` 直连内部文件（若无视同无门面）；
② `director3d` 通用名导出的完整撞名清单；③ `nodes/` 拆分后的挂载点保留方案。

#### 3.1.3.8 第八批取证 · **好消息（门面真被走）** + **结构病（上帝文件）**

**① 好消息：门面机制在本仓"是有效的"，不是摆设**

| 域 | 域外直连内部文件 | 判定 |
| --- | --- | --- |
| `agent/` | **0 处** | ✅ 门面 **100% 被遵守** |
| `videoEditor/` | **1 处**（`App.tsx → videoEditor/panels/dock/VideoEditorDock.tsx`） | ✅ 基本被遵守（仅漏装配点） |

⇒ **结论**：推广门面**风险低**（本仓已有 3 个成功实例 + 域外几乎不绕行）⇒ **"补门面"可以放心做**。
⇒ 也说明 `videoEditor/index.ts` 那次收口是**真收口**（不是只建文件）。

**② 结构病：`director3d/project.ts` 是「上帝文件」（~80 个导出）**

实测该文件导出（节选）：类型 12 个（`ProjectShot` `EntityType` `ProjectCamera` `ProjectLighting`…）+ 常量 20+（`CAMERA_ID` `FPS_OPTIONS` `ASPECT_RATIOS` `DEFAULT_*` `initialObjects`…）+ 数学工具（`radToDeg` `degToRad` `lerp` `lerpAngle` `uid`）+ 归一化函数（`normalizeProjectData` `normalizeCameraKeyframes`…）+ 路径采样（`pathPositionAtFrame` `pathTangentAtFraction` `bakePathKeyframes`…）+ 导出尺寸（`exportDimensionsForAspect`）

⇒ **这是"深模块"的反面：浅而宽**（一个文件横跨 6 个关注点）⇒ 即便给它加门面，门面也是 80 个导出的"宽接口"。
⇒ 同类：`rig.ts`（关节/预设/插值混装）· `tracks.ts`（16 个轨道函数）· `history.ts`（undo/redo + 常量）
⇒ 通用名：`uid` ｜ `log` ｜ `useToast` ｜ `storage{readJson,writeJson}` ｜ `history` ｜ `project` ｜ `ConfirmDialog` ｜ `App` ｜ `panels`

**③ 🔴 由此识别出一个新问题类别：域内结构病（浅宽接口 / 上帝文件）**

| 类别 | 症状 | 属哪个阶段 | 实例 |
| --- | --- | --- | --- |
| 命名病 | 通用名 / 域写错 | Stage 1 | `director3d/*` 通用名 · `canvasHost` |
| 位置病 | 域物住横切 / 混住 | Stage 1 | `base/utils` 9 图片物 · `nodes/` 混四种 |
| **结构病** | **浅宽接口 / 上帝文件 / 无门面** | **Stage 2** | `director3d/project.ts`(~80) · `nodes/` · `scriptbox/`(17 平铺) |

⇒ **重要顺序修正**：`director3d` 这类域**不能"先加门面再拆内部"**（否则门面也会是宽接口）⇒
**必须先拆内部关注点，再加门面**（对这类域，Stage 1 只做**改名**，门面留到 Stage 2）。

**⇒ 第八批净收益**：给出**"哪些域可以现在补门面、哪些必须先拆内"**的判据（有结构病的域 = 先拆内）。


### 3.1.4 🔴🔴 **DATAFLOW 对照：域清单的真源在 `spec/DATAFLOW.md`，我这份是第四份**（2026-09-19 · 用户提示「Data flow 你看了没有」引出）

**用户提示是对的，而且它揭示的比"轴错了"更深一层。** `spec/DATAFLOW.md`（691 行 · 17 节）**本身就是按"链路"分节的**，
而它的 §十七 原文写着：

> - 想改某个**域**的行为（生成 / 存储 / 资产 / 画布 / 提示词 / 编辑 / 3D / 视频） → 按本索引该链路的文件清单逐个看**文件头注释**再动

⇒ **DATAFLOW 的「链路」＝ 本仓的「域」，且它是带 `refs` 实证、有 §维护规矩 的现状真源。**

**本仓"域清单"的实际持有者（实测 5 处）**：

| # | 文档 | 它持有什么 | 状态 |
| --- | --- | --- | --- |
| 1 | **`spec/DATAFLOW.md`** | **17 条链路 = 现状域清单**（带 refs 实证 + §维护规矩 + 禁写清单） | ✅ **权威 · 活的** |
| 2 | `spec/CONTEXT.md` | 规则适用性地图（路由表 + 例外）· §一·五 顶层架构 · §五·五 director3d 边界 | ✅ 活的（ADR-0025 定位） |
| 3 | **`docs/ARCHITECTURE.md`** | **旧 4 层架构**（① App.jsx ② base/ ③ components/*.jsx ④ scriptbox/）+ 命名规范 §六 | 🔴 **已 stale**（见下） |
| 4 | `docs/BASE-CAPABILITIES.md` | base 能力说明 | 待核 |
| 5 | **`docs/DOMAIN-MODULES.md`**（本文件） | **我又写了一份"能力轴域清单"** | ⚠️ **第四份** |

**⇒ 三条叠加才是"划分有大问题"的全部**：

| 层 | 问题 | 状态 |
| --- | --- | --- |
| (a) 轴 | 我用**目录轴**，该用**能力轴** | 已修（§3.1.3） |
| (b) 源 | 我继承了 **`docs/ARCHITECTURE.md` 的旧 4 层**（`.jsx` 时代：App / base / 节点 / scriptbox） | **新发现** |
| (c) 落点 | **`spec/DATAFLOW.md` 已有现状域清单（17 链路），我又造第 4 份** ⇒ 违反 ADR-0025「按内容类别归位」+ CLAUDE §5.4·9「同一规则只写一份」 | **新发现 · 必须改** |

#### (b) `docs/ARCHITECTURE.md` 已 stale —— 实测证据

| 它写的 | 现状 |
| --- | --- |
| `App.jsx` · `PromptNode.jsx` · `TextNode.jsx` · `DiscountVideoNode.jsx` · `NodePalette.jsx` · `CustomHandle.jsx` · `base/hooks.js` | 全为 `.tsx`/`.ts`，且**前三个已改名**（DATAFLOW §十六：`PromptNode→ImageGenerate` · `TextNode→TextGenerate` · `DiscountVideoNode→VideoGenerate`） |
| §二 架构分层＝**4 层**（① App ② base ③ 节点 ④ scriptbox） | 现状是 **19+ 域**（DATAFLOW 17 条链路） |

⇒ **它就是"目录轴"的历史来源** —— 旧 4 层里 `base` 是"通用基座"、节点在根目录，正是被我照抄成"目录轴"的那套。
⇒ 处置（**新登记**）：`docs/ARCHITECTURE.md` 要么**改为指向 DATAFLOW**（保留设计原则 §一，删/迁 §二 分层与 §七.1 过期范本表），要么显式标注 **stale**。**不修的后果 = 下一个 AI 还会照它分域。**

#### (c) 落点裁定：本文件从此**只留 DATAFLOW 没有的东西**

| 内容类别 | 唯一归属（ADR-0025 / ADR README §一） | 本文件怎么做 |
| --- | --- | --- |
| **现状域清单 / 链路 / fan-in** | **`spec/DATAFLOW.md`** | **引用，不复制**。§3.1.3 的能力轴清单**降级为"对 DATAFLOW 的差异清单"**（下表） |
| **判据**（P1–P5 / F1–F6 / N1–N8） | `docs/adr/` | 逐条判"跨面 ⇒ 落 ADR"（**ADR-0038 已示范**：F5 已落 ADR） |
| **计划 / 阶段 / 进度 / 施工顺序 / 验证** | 本文件（计划侧） | 保留（这是本文件的正当职责） |
| **已改名旧→新** | **`spec/DATAFLOW.md §十六`**（自述「全文唯一一份」） | **每批改名后登记到那里**，不在本文件另记 |
| **轮次结论与证据** | `daily/架构日志/<NN>-*.md` | 本文件只留指针 |

#### DATAFLOW 与我的清单：**冲突 4 条（应采纳 DATAFLOW）+ 一致 3 条（互为佐证）**

| # | DATAFLOW 的裁定（带实证） | 我的清单 | 处置 |
| --- | --- | --- | --- |
| **C-1** | §三′ `base/media/` = **横切地基**；红线「**禁 import 任何非 base 目录**」；两入口共用（画布导入 + 剪辑器导入） | 我 §3.1.3.4 判它是"素材能力域的范本" | **采纳 DATAFLOW**：`base/media/` = **横切媒体引用协议层**；素材域另由 §五（`filesApi` + `resourceStore`）承接 |
| **C-2** | §十三 hooks = **横切编排层**（"节点/画布/store 写回归口"；`useNodeData` ← 24 · `useConnectedInputs` ← 33 · `useStoreSelector` 全 store 基座） | 我 §3.1.3.5 判"22/25 是域专用" | **采纳 DATAFLOW**：hooks 保持横切；`useNodeData` 是**写回唯一真源**（`check:arch` 规则 5 在守）⇒ P3 修正应写"hooks 是横切编排层" |
| **C-3** | §七 提示词链路 = **一条**（`prompt/*` + `creative/*` 5 分区同链） | 我拆"提示词域 + 创作库域" | 采纳 DATAFLOW 的**同一链路**；是否拆域留待 §4 裁定（不影响施工批次） |
| **C-4** | §八 编辑/查看 = **独立链路**；且 §八 明确 `cameraParams` 与 3D 摄影棚 `cameraStudio` 是**两套独立功能** | 我先判"画布子层"、后判"图片能力专属" | 采纳 DATAFLOW：**编辑/查看是独立关注点**（`editors/*` + `imageCompress/imageUpscale/faceMosaic/previewUrl` + 查看器） |
| **C-5** | §15.1 把 `imagePixel.ts` 列在**横切纯函数**（"无独立数据流"≠"≥2 域消费"） | 我判"图片能力件" | **两者不矛盾**：DATAFLOW 的"横切登记"= **无自己的数据流**；我的是**数据语义归属**。裁定见 §4（D 系列） |
| ✅ 一致 1 | §十 视频链路清单含 `videoEngine` `captureFrame` `encoderProbe` `timeline/sourceTime` `useVideoPoster` `VideoThumbnail` `depthVideo/*` | 我 §3.1.3.5 判"视频零件散 7 处" | **互为佐证**（DATAFLOW 早知它们同链） |
| ✅ 一致 2 | §一 `generate.ts` 消费方 = 4 生成节点 + `scriptBoxEngine` + `agentRuntime` + `contextCompression` | 我 §3.1.3.1 的 4 路出口取证 | **互为佐证** |
| ✅ 一致 3 | §三 `kvStore.ts` = **re-export 壳**（不参与读写链路） | 我 （TD-18-36）判"浅壳" | **互为佐证**（DATAFLOW 已写死这条） |

#### 新发现的文档债（本文件登记，**不另开口**）

| # | 债 | 证据 | 处置 |
| --- | --- | --- | --- |
| 文-1 | **`docs/ARCHITECTURE.md` stale**（`.jsx` 时代 4 层 + 已改名范本表） | §二 / §七.1 实测引用 `App.jsx`·`PromptNode.jsx`·`DiscountVideoNode.jsx` | 改指向 DATAFLOW 或标 stale（**否则下一个 AI 照它分域**） |
| 文-2 | **域清单四份并存**（DATAFLOW/CONTEXT/ARCHITECTURE/DOMAIN-MODULES） | 五处持有者表 | 本文件已降级为"差异清单"；ARCHITECTURE 见 文-1 |
| 文-3 | `docs/BASE-CAPABILITIES.md` 与 DATAFLOW §十五 15.1~15.3 可能重叠 | 待核 | 下批核 |

### 3.2 画布域四组：**可合并**（J1 查实）

| 关系 | 结论 | 证据 |
| --- | --- | --- |
| `base/canvas` → `nodes` | 有 | `NodePalette.ts:18-29`（静态 import 12 节点）；`lazyNode.tsx:127-129` |
| `nodes` → `base/canvas` | 密集 | `VideoProcessNode.tsx:22,52,53`；`ImageGenerate.tsx:41-43` 等 11 文件 |
| `edges` → `base/canvas` | 弱（1 处） | `ConnectionLine.tsx:4` → `lod.tsx` |
| `agent/canvas` → `base/canvas` | **单向**，反向 0 | `useCanvasAgentTools.ts:8-10`；`canvasHost.ts:28` |
| **文件级循环** | **无**（`no-circular` 红线成立） | `NodePalette.ts:17` 自述；回指的 A 文件不 import 它 |
| **架构例外边** | `base → nodes` 在 `check-arch.mjs:218-221` 的 `BASE_ALLOWLIST` 里 | 合并时**必须保留该边语义** |
| **判定** | A/B/C 合并为画布域（**域根 = `components/canvas/`**，见 §2.6 落点裁定）；`agent/canvas` 归 **agent**（单向 + 消费方全在 agent 侧） | — |

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
| **D12** 🔴 | `src/hooks/` 25 个 hook 的归属 | **改判（审计 A1）**：原判「21 个域专用 ⇒ 全部迁回域内」**统计口径错** —— 实测 `useNodeData` fan-in **23**（跨 canvas/nodes/agent/scriptbox）· `useConnectedInputs` **33**，且 `spec/DATAFLOW.md §十三` 定位 hooks = **横切编排层（写回归口）**、`useNodeData.patchData` 是 `node.data` **写回唯一真源**（`check:arch` 规则 5 守）。⇒ **逐个二分**：**编排机制类留横切**（`useNodeData`/`useStoreSelector`/`useCanvasSync`/`useConnectedInputs`/`useGenerateNode`/`useNodeGeneration`/`useEdgeData`/`useDisconnectSource`/`useNodeRename`）；**真域私有迁回**（`useScriptBoxEngine`→scriptbox · `useVideoPoster`→视频 · `useArrangeCanvas`→画布壳 · `useAssetDropPaste`/`useResourceMoveToFolder`→素材·画布交互）。⚠️ `useConnectedInputs` **不得进 `base/`**（import `scriptbox` ⇒ 触发 `check-arch` 规则 2） | §9 A1 · DATAFLOW §十三 |
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

### 5.4.2 🔴 落账纪律：**债号只能由命令产出**（A8 执行细则 · 2026-09-19 实证）

**实证（本轮）**：我在轮次文件里**先写了债号 `TD-03-19`、之后才去登记** —— 而命令实际分配 `TD-03-21`。
更糟的是：`TD-03-19` **是一个真实存在且已结清的历史债号**（被 `03-跨区-十轮-发送能力边界裁定-2026-09-18.md`
与 `02-跨区-文本链路四态收口审计-2026-09-18.md` 引用）。

⇒ **撞真实号比编假号更危险**：`check:doc-refs` **只验"债号存在"，不验"该号指的事与引用上下文是否相符"**
⇒ 撞号引用会**静默通过**，后人按号去查会读到完全不相干的内容（比幽灵债号更难发现）。

**强制动作（顺序不可颠倒）**：

```
① 先 `node scripts/debt.mjs add …`（或 resolve/show）拿到**真实债号**
② 再把该号写进轮次文件 / 计划 / 注释
③ 收尾 `node scripts/debt.mjs audit`（锚点断链巡检）
```

**禁止**：先在文档里写号、后去登记（= 预支状态）；用"看着像下一个号"的号（撞号静默）。

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

## 6 · 命名规范（N1–N9）

> **🔴 判据本体已归位 `ADR-0039`（生效 2026-09-19 · 审计 A6）** —— N1 域前缀（**判据=撞名**）· N2 文件名=主导出名 · N3 `*Store` 仅真源 · N4 `Contract` 专属 `contracts.ts` · N5 域目录须有门面、跨域只走门面 · N6 横切不放域物 / 通用物不装域 · N7 前缀用**域名原词** · N8 只改符号 + 路径（→ `ADR-0038`）· N9 前缀只取「域」级。
> **本节只留「现状表」**（§6.1 前缀表 · §6.2 撞名→新名）；**判据冲突时以 `ADR-0039` 为准**（本节不再复制 N 条正文，防 A7 漂移）。

### 6.1 前缀表（**按能力轴重出** · 审计 A5 处置 · 2026-09-19）

**取证（实测 `export` 符号按前缀计数）**：`video` 7 · `relay` 7 · `videoEditor` 5 · `agent` 4 · `canvas` 3 · `media` 3 · `camera` 3 · `prompt` 2 · `text` 1 · `task` 1 · `provider` 1 ·
**`node` 0 · `edge` 0 · `editor` 0 · `image` 0 · `scriptBox` 0 · `creative` 0 · `setting` 0 · `cloud` 0 · `playbook` 0 · `mosaic` 0**

⇒ **结论：导出符号级的前缀在本仓基本不存在**（10 个域实测 0）——**这不是"补几个前缀"，而是"每个域先定原词"**。19 处撞名正是这个缺口的症状。

| 域（用 `DATAFLOW` 链路名 · 原词） | 规范前缀 | 现状（已带前缀导出数） | 处置 |
| --- | --- | --- | --- |
| AI 助手 | `agent` | 4 ✅ | 保持 |
| AI 助手 ⊃ 表格 | `assistantTable` | 0 | 新增（目录名已是 `assistantTable`） |
| 画布（机制 + 宿主） | `canvas` | 3 ✅ | 保持 |
| 画布 ⊃ 节点机制 | `node` | **0** | **新增**（`nodeDataSchema`/`nodeDefaults`/`nodePrefs`/`nodeMedia` 文件名已有、导出无） |
| 画布 ⊃ 边 | `edge` | **0** | 新增 |
| **图片能力** | `image` | **0** | **新增**（`imageCompress`/`imageUpscale`/`imagePixel` 文件名已有、导出无） |
| **视频能力** | `video` | 7 ✅ | 保持 |
| **文本能力** | `text` | 1 | 保持（薄域） |
| 剪辑器 | `videoEditor` | 5 ✅ | 保持（**禁缩写 `ve`**，N7） |
| 编辑 / 查看（§八） | `editor` | **0** | 新增（`editors/*`；与 `videoEditor` 撞名的部分靠 `image` 段区分） |
| 图片 ⊃ 打码 | `mosaic` | **0** | 新增（域内子目录级，N9） |
| 3D 导演台 | `director3d` | — | **例外（禁重审）**，见 §9 A3 |
| 视频 ⊃ 深度 | `depthVideo` | 0 | 新增（**子域级**，N9） |
| 素材 / 资产 | `resource`（数据）· `media`（引用协议）· `file`（落盘） | `media` 3 ✅ | ⚠️ **三分**（DATAFLOW §三′/§五 是三条不同层：协议/数据/落盘） |
| 提示词 | `prompt` | 2 ✅ | 保持 |
| 创作库 | `creative` | **0** | 新增 |
| 剧本盒子 | `scriptBox` | **0** | 新增（文件名已有前缀、导出无） |
| 生成链路 / 中继 | `relay` | 7 ✅ | 保持 |
| 任务 | `task` | 1 | 保持 |
| 设置 | `setting` | **0** | 新增（**单数**，对齐 `settingRegistry`） |
| 账号 / 多开 | `account` | **0** | 新增（对齐 `accountsStore`） |
| 云同步 | `cloud` | **0** | 新增（对齐 `cloudSync`） |
| 供应商 | `provider` | 1 | 保持 |
| 后端（`localTool`，独立世界） | `relay` 等 | — | 后端**本期不改**（D21） |

**横切层不加前缀**（`logger`/`contentStore`/`contracts`/`eventBus`/`idGen`/`toastStore`/`uiHooks`/`utils`/`config`/`degrade`/`confirmStore`/`modalLayer`）。

### 6.2 撞名 → 新名 映射（**S1-1 的执行依据** · 逐条取证）

| 撞名 | 分属域 | 新名 | 前提复核 |
| --- | --- | --- | --- |
| `logger` | 横切 · `videoEditor/lib` | `videoEditorLogger` | ✅ TD-18-42 前提成立（横切 `logger` 87 处） |
| `toast` | 仅 `videoEditor/lib`（实测 **1 处**） | `videoEditorToast` | ⚠️ **TD-18-43 的"撞名"前提不成立**（全仓无第二 `toast`）⇒ 按 N1 判据**不违规**；仅"名太通用" ⇒ **降级为 N7 改名（低成本可选）** |
| `uid` | `agent/conversation` · `director3d` | `agentUid`（d3d 属例外） | 实测 2 处 |
| `log` | `base/core` · `director3d` | 横切 `logger` 已存在 ⇒ d3d 侧属例外 | 实测 2 处 |
| `ChatMessage` | `agent/runtime` · `base/api` · `base/utils` | 按各自域前缀 | 三域撞名 |
| `MediaType` | `base/canvas` · `videoEditor/types` | `canvasMediaType` / `videoEditorMediaType` | 跨域 |
| `Timeline` | `director3d/panels` · `videoEditor/ui/...` | d3d 例外；`videoEditorTimeline` | 跨域 |
| `Conversation` / `ConversationMemory` | `agent/conversation` · `base/utils` | `agentConversation*` | 跨域 |
| `subscribe` | `agent/assistantTable` · `agent/conversation` · `base/core` | 横切保留；agent 侧加前缀 | 三处 |
| `removeResource` / `flushPersist` / `detectAssetType` | `base/store` · `scriptbox` · `agent/conversation` · `base/utils` | 按消费域前缀 | 跨域 |
| `FlowPosition` / `PanelState` / `TimelineTrack` | `base/core` · `hooks` · `base/store` · `videoEditor/ui` · `nodes` | 按域前缀 | 5 处 |
| `ExportFormat` / `ExportQuality` / `TimelineElement` | videoEditor 域内两处 | `videoEditor*` | 域内（另有别名问题） |
| `CameraLens` / `describeCameraLens` | `base/editors` · `base/editors/cameraParams` | 域内子域级（N9） | 域内撞名 |

> **诚实边界**：本表只覆盖 `export {function,const,type,interface,class}` 形态。**`export default` 与 `export { a, b }` 尚未扫**（且 `director3d` 那批通用名——`useToast`/`storage`/`history`/`project`/`tracks`——因属**已登记例外**未计入）⇒ S1-1 执行时补扫，**清单可能再增**。

**已裁定例外（禁重审）**：可编辑元素判据（ADR-0031 · TD-18-10~13）· 提示词域三件（TD-18-39）· `filesApi` 落盘域（TD-02-66）· `director3d`（V2 日志 §七）。

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
| 2026-09-19 | 「媒体引用域」是素材库域 | 名不副实 ⇒ 收窄为**媒体引用协议层**；素材库/生成各自成域 | §3.1.2 |
| 2026-09-19 | 素材库 = 一个域 | 同一"东西"散在 **3 处**（`resourceStore` + 素材 UI + `librarySource`）⇒ 补立 **「素材域」** | §3.1.2 |
| 2026-09-19 | 「生成」无独立域 | 补立 **「生成域」**；与素材域**不同数据源**（用户 2026-09-17 已裁定） | §3.1.2 |
| 2026-09-19 | 🔴 **用「代码目录」这条轴分域** | **改用「业务能力」轴**（产品在代码里已写死：`NodePalette.ts:106-109` 文本/图片/视频/其他工具）⇒ 目录轴清单降为中间产物 | §3.1.3 |
| 2026-09-19 | 「文本能力 ⊃ 提示词输入 · 创作库预设」 | **错**：`base/prompt` 与 `base/creative` **被图片/视频/文本三个节点共用** ⇒ 是**跨内容类型的共享域**，不是文本能力的零件 | §3.1.3.1 |
| 2026-09-19 | 「生成」一词唯一 | **二义**：左栏页签「生成」= 生成**结果**（属素材域）vs `generate.ts` = 生成**链路**（属中继域）⇒ 必须分别命名 | §3.1.3.1 |
| 2026-09-19 | `nodes/` 是画布域的子域 | **一个目录混四种东西**：内容能力节点 11 + 画布机制节点 3 + 能力辅助 hook 1 + 独立应用入口 2 | §3.1.3.2 |
| 2026-09-19 | 「本仓没有域清单」 | **错**：`spec/DATAFLOW.md` 的 **17 条链路就是现状域清单**（§十七 原文把"链路"当"域"用）⇒ 本文件的能力轴清单**降级为"对 DATAFLOW 的差异清单"** | §3.1.4 |
| 2026-09-19 | `base/media/` 是"素材能力域的范本" | **采纳 DATAFLOW §三′**：它是**横切地基**（两入口共用 + 红线禁 import 非 base）；素材域由 §五 承接 | §3.1.4 C-1 |
| 2026-09-19 | hooks「22/25 是域专用」 | **采纳 DATAFLOW §十三**：hooks 是**横切编排层**（写回归口；`useNodeData` ← 24） | §3.1.4 C-2 |
| 2026-09-19 | 提示词域 + 创作库域拆两个 | DATAFLOW §七 二者**同一条链路** ⇒ 是否拆域留待裁定 | §3.1.4 C-3 |
| 2026-09-19 | 编辑/查看 = 画布子层 | **采纳 DATAFLOW §八**：是**独立关注点/链路** | §3.1.4 C-4 |
| 2026-09-19 | —（新发现） | **`docs/ARCHITECTURE.md` 已 stale**（`.jsx` 时代 4 层 + 已改名范本表）⇒ 它是"目录轴"的历史来源 | 文-1 |
| 2026-09-19 | D12「hooks 21 个域专用 ⇒ 迁回域内」 | **改判**：统计口径错（`useNodeData` 23 · `useConnectedInputs` 33 跨域）⇒ **编排机制留横切 / 真域私有迁回**（DATAFLOW §十三） | §9 A1 |
| 2026-09-19 | §6 N8「符号 + 字符串标识一起改」 | **回改原文**（与 D19/ADR-0038 矛盾）⇒ 只保证「符号 + 文件路径」一致，运行时字符串默认不改 | §9 A2 |
| 2026-09-19 | §3.1.3.7 列 `director3d` 命名违规 | **就地标注**：`director3d` 属**已登记例外** ⇒ 只记录不施工（例外优先） | §9 A3 |
| 2026-09-19 | —（审计） | 新增 §9 最终审计（5 通过 / 7 问题 / 1 附带；3 项必须修已当场修） | §9 |
| 2026-09-19 | §6 前缀表（**目录轴时代**，无 `image`/`video`/`text`） | **按能力轴重出**（§6.1）；实测**导出符号级前缀基本不存在**（`node`/`edge`/`editor`/`image`/`scriptBox`/`creative`/`setting`/`cloud` 全为 **0**）⇒ 19 处撞名的根因 | §9 A5 |
| 2026-09-19 | TD-18-43「`toast` 撞名」 | **前提复核不成立**：全仓 `toast` 导出**仅 1 处**（`videoEditor/lib`，实测）⇒ 按 N1 判据**不违规**，降级为 N7「名太通用」可选改名 | §6.2 |
| 2026-09-19 | 素材域前缀（旧表只写 `media`） | **按 DATAFLOW 三分**：`media`（引用协议·横切地基 §三′）· `resource`（数据 SSOT §五）· `file`（落盘 `filesApi` §五） | §6.1 |
| 2026-09-19 | §6 持有 N1–N9 **判据正文** | **判据本体归位 `ADR-0039`**（生效）；§6 只留现状表（§6.1/§6.2）+ 指针 | §9 A6 |
| 2026-09-19 | §6.2 撞名清单写 "19 条" | **实测 23 组**；并按 N1 判据过滤出 **4 组「域内重复」不违规**（`ImageGenTemplate` 两处均在 scriptbox · `ExportFormat`/`ExportQuality`/`TimelineElement` 均在同一域）⇒ 不做改动 | §8 |
| 2026-09-19 | `FlowPosition` 列入"改名" | **改判「收口」**：两处**同形同义**（`{x,y}` + 逐字相同的注释）⇒ 属**探测重复**（ADR-0031 二分）⇒ 删重复定义 + `import type` 复用，**非改名** | §8 S1-1b |
| 2026-09-19 | `subscribe` 四处并列 | **区分**：`eventBus.subscribe` = 横切唯一通道（保留）；`toastStore.subscribe` 被 `ToastContainer` 外部消费 ⇒ 消歧为 `subscribeToasts`；agent 两处留 S1-1c | §8 S1-1b |
| **2026-09-19** | **§3.4「游离物 11 件都该迁出横切层」** | **判据被推翻（用户质疑"横切有必要拆吗"）**：① `agentKeys` 头注自述"收在 base/core（叶层零业务依赖）"+ 被 App/agent/backupStore 三处共用 ⇒ **横切契约** ② `canvasSyncBus` **DATAFLOW §15.2 原文已登记为横切基础设施** ③ `legacyRawKey` 消费方**只有 base/storage/index** ⇒ base 自有 ④ `arrangePack` 消费方**只有横切 hooks** ⇒ 横切原语 ⑤ `videoEditorKeys` 与 `contracts.ts`/`agentKeys` **同族（键构造器）** ⑥ `sourceTime` **DATAFLOW §十 原文「跨域唯一映射原语」** ⇒ 横切 ⑦ `editorSession`/`useMediaLoadFailed` 消费者**在 base 内**（`modalLayer`/`base/ui/VideoThumbnail`）⇒ **迁出即违反规则 2** ⑧ `imageUpscale`/`videoEngine`/`timeScale` 目标域**无落点** ⇒ D20 前提不成立 ⑨ `encoderProbe` 目标 d3d 属**例外** ⑩ `canvasHotkeys` 目标 `base/canvas` 最终落点由 **S2-1** 决定 | §8 S1-3 |
| **2026-09-19** | 「base 里的件被业务域消费 = 违规」 | **方向搞反**：`check-arch` 规则 2 原文是「**base/ 禁 import 任何非 base 目录**」⇒ base 被业务域消费是**正确单向**、**现状实测零违规**；真正会制造违规的是**把它们迁出**（base 内仍有消费者） | §7 · §8 S1-3 |
| **2026-09-19** | **D7「`notify()` 5 处调用恒为 no-op ⇒ 删 `listeners` + `notify` 全部调用」** | **🔴 登记写错，照它执行会破坏落盘**：`notify()` 内是 `persistDebounced.schedule(); listeners.forEach(...)` —— **`schedule()` 是素材库落盘的唯一触发点**（P4 落盘节流），只有 `listeners.forEach` 那一行是 no-op。⇒ **改判**：只删 `listeners`（声明 + 那 1 行）+ `notify` **正名为 `schedulePersist`**（6 处），**落盘副作用全部保留** | §8 S1-7 |
| **2026-09-19** | D8「`i18n.ts` 空壳」 | **确认已泄漏成用户可见 bug**：`t(key) => key` 直接把英文 key 返回，而 `sounds-store`/`use-editor-actions` 用它做 `toast.error/loading/success` ⇒ **英文提示直接上屏**（如 "Failed to save sound"）⇒ 19 处改中文直写 + 删空壳件 | §8 S1-7 |
| **2026-09-19** | §3.4 #6「`kvStore` 唯一引用 = `storage/index.ts:16`」 | **不准**：实测 **5 个消费者含 2 处 `vi.mock`**；但逐条核清后**成本远小于表面**（`kvGet/kvSet/kvDelete` 零消费者 · `projectStore.test` 的 mock 是纯 no-op · `logger.test` 那行只是软证据）⇒ 已删壳并 repoint；**顺带断掉「因为测试 import 它所以保留它」的自证循环** | §8 S1-4 ③ |
| **2026-09-19** | 工具「`rename` 只改文件名 + 同步 import」 | **两处缺口（新登记）**：① 对 `.css` **会丢扩展名**（`main.tsx` 的 import 被写成无扩展名，Vite 解析失败风险）② **不改写无扩展名 import**（如 `tailwind.config.ts` 的 `./src/.../ve-tailwind-colors`）⇒ 改名后**静默漏改、只在构建期暴露**。本批已手工收敛；**债号 TD-17-22 / TD-17-23**（area 17） | §8 S1-4 ② |
| **2026-09-19** | 「`base/` 是**「横切层 + 域」的容器**」→ 域（含 `canvas`）住 `base/` 内是设计内的 | **目标形态改为：`base/` 只留横切层；域一律住 `components/<域>/`**（`canvas` 已迁出 ⇒ `components/canvas/`）。**判据**：① N5「域目录须有门面」要求「域 = 一个目录」，跨 3 目录的域建不了单一 `域/index.ts`（§2.7 门面模型）；② §3.1.3.7 的 3 个范本（`agent/`·`videoEditor/`）都是 `components/` 下顶层域目录，画布是一级视图应同级；③ 域全迁出后 `base/` 变纯横切层 ⇒ **规则 2 的前提（base = 地基）从近似假设变成事实**，横切/域之分由目录结构承载，不再靠登记表。**待办**：`creative`·`depthVideo`·`editors`·`media`·`prompt`·`store` 六个域同样迁出（§8 S2-8） | §2.6 · S2-1 |

---

## 9 · 最终审计（2026-09-19 · 自审 · 标准 = **可复现，不引用自己的结论**）

**审计方法**：① 每条论断回原始命令复跑；② 与既有真源（`spec/DATAFLOW.md` · `docs/adr/` · V2 日志）对撞；③ 查**计划内部自相矛盾**。

### 9.1 通过项（5）

| # | 审计项 | 复现结果 |
| --- | --- | --- |
| ✅1 | fan-in 数可复现 | `useConnectedInputs` 33 ✅ 完全一致；其余差异为**口径**（见 A4） |
| ✅2 | **进度表真实性** | `Step A 首批（videoEditor 门面）` 与 `Step A 第二批（depthVideo 门面）已撤销回退` **均有日志**（`daily/架构日志/21-跨区-…`）⇒ 不是自述 |
| ✅3 | §4 裁决完整性 | D1–D21 共 21 条，**逐条带依据**（P 判据 / ADR / 用户裁定） |
| ✅4 | §3.4 游离物与 D14/D18 一致 | #8 已就地标注「**推翻**（D14）」⇒ 无两处矛盾 |
| ✅5 | ADR-0038 锚点有效 | 本文件 §5.1 **F5** + §4 **D19** 均存在且一致 |

### 9.2 问题项（7 · 按严重度）

| # | 严重度 | 问题 | 证据（可复现） | 处置 |
| --- | --- | --- | --- | --- |
| **A1** | 🔴 **自相矛盾** | **D12「`src/hooks/` 21 个域专用 hook 迁回域内」的统计口径错** | 实测 `useNodeData` fan-in **23**（跨 canvas/nodes/agent/scriptbox）· `useConnectedInputs` **33**；`spec/DATAFLOW.md §十三` 明确把 hooks 定位为「**横切编排层 · 节点/画布/store 写回归口**」，且 `useNodeData.patchData` 是 `node.data` **写回唯一真源**（由 `check:arch` 规则 5 守）⇒ 它们**不是域专用** | **D12 改为逐条二分**：编排机制类（`useNodeData`/`useStoreSelector`/`useCanvasSync`/`useConnectedInputs`/`useGenerateNode`）**留横切**；真域私有（`useScriptBoxEngine`→scriptbox · `useVideoPoster`→视频 · `useArrangeCanvas`→画布壳）**迁回**。⇒ **S2-6 批次按新口径重排** |
| **A2** | 🔴 **A7 违反** | **§6 的 N8 原文未回改** —— 仍写「改名两套身份**一起改**：符号 + 字符串标识」 | 与 §4 **D19** + **ADR-0038**（生效）+ §7 修订记录**三处矛盾**（正是 A7「回改原文」要防的漂移） | **§6 N8 就地改**为「只保证**符号名 + 文件路径**两套身份一致；**运行时字符串默认不改**（ADR-0038）」 |
| **A3** | 🔴 **裁决冲突** | §3.1.3.7 列的 **`director3d` 命名违规清单** vs §6「已裁定例外：`director3d`」+ V2 日志「`director3d` 属**已登记例外，未纳入收口**」 | V2 日志（`daily/架构日志/18-跨区-…`）§七 遗留 3 原文 | **例外优先**：`director3d` 的通用名**记录但不施工**（§3.1.3.7 就地标注"例外范围内"）；若要撤例外须**另开裁定** |
| **A4** | 🟡 不可复现 | **fan-in 数字未标口径** —— §3.1.3 表内多有裸数字 | 同一条数：`logger` 计划写 87 / 我 grep 实测 **113**（含 tests）；`contentStore` 45 / **53**；`contracts` 34 / **38**；`useNodeData` 24 / **23** | 全表补口径：统一标 **`refs` 工具输出**（DATAFLOW §维护规矩要求"带 refs 实证"），不用自定义 grep |
| **A5** | 🟡 过期 | **§6 前缀表是"目录轴时代"产物** | 表内为 `canvas`/`node`/`edge`/`editor`/`mosaic`/`media`/`prompt`…，**无 `image`/`video`/`text`** ⇒ 与 §3.1.3 能力轴不一致 | 按**能力轴重出前缀表**（S1-1 开工前必须定，否则前缀会取错） |
| **A6** | 🟡 落点 | **N1–N9 属"确立新约定"** ⇒ 按 `docs/adr/README` §二.2 应写 ADR | `adr search 命名` 仅命中 ADR-0038（改名**边界**）· ADR-0033（配置常量）⇒ **无"命名规范"ADR** | 落一条新 ADR（域前缀 + 门面 + `*Store`），本文件 §6 只留指针 |
| **A7** | 🟢 文档债 | **文-3 核实成立且更重叠**：`docs/BASE-CAPABILITIES.md`(241 行) §八「**新增能力该放哪**」＝**落点判据**；§三（toast）↔ DATAFLOW §15.2、§五（图片编辑）↔ DATAFLOW §八 | 其 §八 / §三 / §五 实测 | §八 判据应进 ADR；§三/§五 与 DATAFLOW 重叠处改指针 |

### 9.3 附带发现（1）

| # | 发现 |
| --- | --- |
| B1 | **`D6`（`TemplateNode` 迁出 `src/`）与 DATAFLOW §十六 已登记的「`nodes/TemplateNode.tsx` → `nodes/_template/`（参考蓝本，非活节点）」是两个不同动作** —— 后者**已完成**。⇒ D6 需明确"是否仍要迁出 `src/`"，否则会被当成未做的动作重做一遍 |

### 9.4 放行判据（**能不能开工**）

```
必须修（自相矛盾级）：A1 · A2 · A3        ← 都是"同一件事两处说法不同"，不修则施工必乱
开工前必须定：      A5（前缀表，S1-1 依赖它）
随批修：            A4（口径）
单独落：            A6（命名规范 ADR）· A7（文档债）· B1（D6 明确化）
```

**结论：计划主体（§1–§5）成立、可施工；但 §6 与 §3.1.3 的 A1/A2/A3 必须先对齐，否则第一批改名就会取错前缀 / 迁错 hook。**

---

## 8 · 阶段计划与进度表

### Stage 1 · 命名与位置（零行为变更）

> **🔴 批次切分口径（N9 推论）**：**按「子域」切，不按「域」切** —— 大域（videoEditor 258 / agent 56 / 画布 60）一次做完＝单次 diff 巨大、说不清零炸；按子域切则每批 10–40 文件、可独立验证可回滚。

| 批次 | 范围（子域级） | 债号 | 改动面 |
| --- | --- | --- | --- |
| S1-1 | 撞名收口（19 名；含 `toast` 前提复核 —— 全仓无第二个 `toast` 定义） | TD-18-42/43 | 19 名 |
| S1-2 | 域写错 + 通用物提级（`canvasHost`→`agentCanvasHost`；`cn` 提级） | TD-18-34 | 4 / 45 |
| S1-3 | 域物迁出横切层（§3.4 #1#2#3#11） | **🚫 整批延后（2026-09-19 判决 · 用户质疑"横切有必要拆吗"引出）** —— 11 件逐条判：**0 件可迁 · 6 件改判不迁 · 5 件延后**。判据见 §7；两条根因：① **规则 2 方向被搞反**（base 的件被业务域消费 = 正确方向、现状零违规；真正制造违规的是「迁出」）② **D20 前提不成立**（画布域/图片能力/视频能力落点未定死）+ 收益不可测（撞名已在 S1-1 清零） | — |
| S1-4 | 文件名歧义/误导名/浅壳（`assets.ts`/`generationContract`/`kvStore`/`ve-`） | **部分已做（①②）** | ✅ **① 误导名 + 违反 N4**：`generationContract`（头注自述「**生成编排原语**」，而 `Contract` 一词专属 `contracts.ts`）⇒ `generationOrchestration.ts` + 4 符号改名（`runGenerationOrchestration` 18 处 / 4 文件）；✅ **② 违反 N7**：`ve-tailwind-colors.ts`→`videoEditorTailwindColors.ts` · `ve-theme.css`→`videoEditorTheme.css`（⚠️ **工具丢了 CSS 扩展名 + 漏了无扩展名 import，已手工收敛**）；`.ve-scope` / `--ve-*` 属**运行时字符串** ⇒ **按 ADR-0038 有意保留**并在文件头登记；✅ **③ `kvStore` 删壳（TD-18-36）**：⚠️ 登记与文件头注**都不准**——登记说"`storage/index` 唯一引用"，实测 **5 个消费者含 2 处 `vi.mock`**；**但逐条核清后成本远小于表面**：`kvGet/kvSet/kvDelete` **零消费者** · `projectStore.test` 的 mock 是**纯 no-op**（spread 原值后覆盖成同值）· `logger.test` 那行只是"依赖解析未断"软证据 ⇒ 删壳 + repoint（`CANVAS_STATE_PREFIX` 改由 `core/contracts.ts` 直供）+ 测试改名 `kvApi.test.ts`；**顺带断掉「因为测试 import 它、所以保留它」的自证循环**（ADR-0030 形态）；同步 `spec/DATAFLOW.md` 现状（§三 + §十六，按 §维护规矩就地改）；🚫 `assets.ts` vs `asset.ts` 差一个 s ⇒ **按 N1 判据不构成违规，不做** |
| S1-5 | 门面补齐（19 域中 15 缺） | TD-18-41④ | 15 域 |
| S1-6 | 目录名与内容对齐（`components/panels`→agent；后端 relay 归位） | 新 | 6 + 3 |
| S1-7 | 死代码/假机制（D6–D10） | **部分已做（D7 改判 · D8 · D9）** | ✅ **D8**：`i18n.ts` 空壳（`t(key)=>key`）**已泄漏成用户可见 bug**（`toast.error(i18next.t('Failed to save sound'))` ⇒ 英文 key 直接上屏）⇒ 19 处改中文直写 + 删空壳；✅ **D7 改判**：登记称「`notify()` 5 处调用**恒为 no-op**」**是错的** —— `notify()` 内 `persistDebounced.schedule()` 是**落盘唯一触发点**，照登记删会**破坏素材库落盘**；实测死代码只有 `listeners`（无 `add`）⇒ 删 1 行 + `notify` 正名 `schedulePersist`(6 处)；✅ **D9**：空目录 `cutia-ui-icons/` 已删；⏸ D10（后端 ⇒ D21 延后）· D6（B1 待明确） |

### Stage 2 · 深模块化

| 批次 | 范围 |
| --- | --- |
| **S2-1** | 画布域合并 —— ✅ **已完成**（S2-1a 节点/边迁入 + S2-1b 机制件迁入 + S2-1b-pre 解 2 条跨层边）。**域根 = `components/canvas/`**（落点裁定见 §2.6 / §7）。`check-arch` 白名单边**已整体删除**（规则 2 收窄后不再需要，见 §7） |
| S2-2 | 图像编辑域成型（逻辑 + UI 同目录） |
| S2-3 | AI 中继域成型（`api/relay/` + 门面，对齐后端 `ai-relay/`） |
| S2-4 | `base/store` 按 8 域拆出非真源 |
| S2-5 | videoEditor：`engine/lib` 拆关注点、工具层三合一、UI 两套收口 |
| S2-6 | `src/hooks` **逐条二分**：编排机制留横切 / 真域私有迁回（**D12 已改判 · 见 §9 A1**） |
| S2-7 | 后端：`routes/utils` 域物归位 + `ai-relay` 门面收口 |
| **S2-8** | **其余域迁出 `base/`** ⇒ `components/<域>/`（`creative` ✅ · `depthVideo` ✅ · `editors` ✅ · `prompt` · `store`；`media` 经 §3.1.4 C-1 裁定为**横切协议层**，**不迁**）。**它是「base/ 只留横切层」这个目标形态的收尾**（§2.6 / §7 裁定）；S2-2 与 S2-4 落地时**顺带做**，不另开批。**手法已跑通三轮**：搬移 → 手动后置工序 → 门面 → 收口 → 计划回改 |
| **S2-1c** | 画布域门面 `canvas/index.ts` + 域外消费点收口（建面判据见 §2.7：域外直连的是**实现件** ⇒ 必建） |

### Stage 3 · 契约与验收

失败判别联合落到各域边界 · 域前缀对账（建闸前过「建闸前置评审」）· `DATAFLOW`/`CONTEXT`/`ADR` 同步。

### 进度表

| 项 | 状态 | 证据 |
| --- | --- | --- |
| **规则 2 作用域修正**（从「整个 base/」收窄到「base/ 的横切子目录」） | **已完成** | `BASE_ALLOWLIST` 整体删除；负例探针双向验证（横切子目录跨出 base → 红 · 域→域 → 绿） |
| **S2-1 画布域合并** | **已完成** | 域根 = **`components/canvas/`**（机制 17 + `nodes/`18 + `edges/`3）。**前置**：解 2 条「横切→画布域」真缺陷（`withNodeSize`→`base/core/nodeSizePatch.ts` · `nodeMedia`→`base/utils/nodeMedia.ts`）。工具缺陷登记 **TD-17-27** |
| **S2-1c 画布域门面** | **已完成** | `canvas/index.ts`（21 符号）；收口 8 个域外消费点（13 处 import → 8 条）。**装配层例外**：`App.tsx` 直连 11 处（组合根，强行走门面需露 ~17 符号 = 宽门面） |
| **S2-8 试点：`creative` 迁出 `base/`** | **已完成** | 域根 = `components/creative/`（8 源文件 + `data/`2 + 门面 6 符号）；收口 5 个域外消费点（12 处 import）。**共享视觉语言** `creative-library.css` 下沉 `base/panels/`（否则横切面板 `ImportMediaModal` import 域 = 违规）。**手法已跑通**，可铺开到其余 4 个域 |
| **S2-8 第 2 个：`depthVideo` 迁出 `base/`** | **已完成** | 域根 = **`components/video/`**（新建 · 视频域部分成型）；`depthVideo/` 入驻（5 件），门面 2 符号；收口 2 个域外消费点（`canvas/nodes/{AssetNode,VideoGenerate}` —— 同能力被 2 宿主消费，正是 §2.3.1 P4 判据）。**待迁入**：§3.1.3.5 的其余视频零件（散 7 处） |
| **S2-8 第 3 个：`editors` 迁出 `base/`** | **已完成** | 域根 = `components/editors/`（10 源文件 + `cameraParams/` 子目录），门面 13 符号；收口 6 个域外消费点（12 处 import）。**前置剥离（D18 裁定）**：`ImageZoomDialog` 有 10 个消费方横跨 canvas/agent/scriptbox/base-panels ⇒ 是**横切件**，移出域 ⇒ `base/ui/`（否则 `base/panels` 横切反向依赖域 = 违规） |
| 第一步（分清有哪些鱼） | **已完成** | §2–§4，含 7 处更正；5 个子 Agent 取证 |
| 安全移名/移位 SOP | **已完成** | §5 |
| **P1 修闸盲区（硬前置）** | **已完成** | `daily/架构日志/17-跨区-闸判据对准TDZ红线与结构环登记-2026-09-19.md`；工具债 **TD-17-21 已解决** · 结构环债 **TD-22-68 待还** |
| **P2 外部引用对账机器化** | **已完成** | `scripts/scan-outside-refs.mjs`（改前记清单 → 改后复跑旧片段必须 0；`--all` 盘点：259 引用/40 断链）；债 **TD-24-7 待还** |
| **P3 F5 落 ADR** | **已完成** | **ADR-0038**（生效，架构师 2026-09-19） |
| **Step A 首批：videoEditor 门面** | **已完成** | `daily/架构日志/21-跨区-域模块化StepA建门面批次-2026-09-19.md` §一–四（域外消费点 1→0；tsc 0 错；无 TDZ 环新增） |
| **Step A 第二批：depthVideo 门面** | **已撤销**（弯路） | 同文件 §五：粒度错（子域当域）+ 门面错层级；已完整回退（tsc 0 错 / 586 文件 / 环未增） |
| **按 P5 重出 §3.1 域清单** | **已完成** | §3.1.3（能力轴：产品 `NodePalette` 文本/图片/视频/其他 = 决定性证据）+ §3.1.4（**DATAFLOW 对照**：冲突 4 条采纳 DATAFLOW / 一致 3 条互证） |
| **§3.1.3.1~.8 八批取证** | **已完成** | 生成链路共享性 · 节点能力归属表（16 节点）· 两笔反向依赖 · `TemplateNode` 蓝本 · `base/media` 范本 · hooks 归属 · 门面实测（`agent` 0 处绕行）· 上帝文件 `director3d/project.ts` |
| **§9 最终审计** | **已完成** | 5 通过 / 7 问题 / 1 附带；**A1（D12 改判）· A2（N8 回改）· A3（d3d 例外）已修** |
| **A5 前缀表按能力轴重出** | **已完成** | §6.1（导出符号级前缀实测 **10 域为 0**）· §6.2（撞名→新名 19 条） |
| **A6 命名规范落 ADR** | **已完成** | **ADR-0039**（生效 · `adr audit` **0 问题** / 65 行一页）；§6 改为指针 |
| **S1-1 收口完成（最终复扫）** | **✅ 已完成** | 剩余同名导出 **6 组全部合法**：`log`（director3d **已登记例外**）· `TimelineElement` / `ExportFormat` / `ExportQuality`（**域内** videoEditor）· `StreamDelta`（**域内** agent/runtime）· `ImageGenTemplate`（**域内** scriptbox）⇒ **跨域撞名 = 0** |
| **S1-2 第 ① 组：域写错（`canvasHost` → `agentCanvasHost`）** | **已完成** | 符号 `CanvasHostCtx`→`AgentCanvasHostCtx`(12/5) · `CanvasHost`→`AgentCanvasHost`(2/1) · `createCanvasHost`→`createAgentCanvasHost`(18/4)；文件 `canvasHost.ts`→`agentCanvasHost.ts` + 测试同名迁移；**域文件地图 `agent/index.ts` 指针已回改**；旧名残留 = **0** |
| **S1-2 第 ② 组：`cn` 提级** | **🚫 改判不做（推翻 §3.4 #7）** | 实测 `clsx`/`tailwind-merge` **全仓仅 `videoEditor/utils/ui.ts` 一处**引用，`base/ui` **完全不用**类名合并 ⇒ `cn` 是**编辑器自研 UI kit 的配套原语**（D14 已裁两套 UI 不合并），**不是"通用物混进域"**；提级 = 制造只有 1 个域用的**假横切** ⇒ 不做 |
| **A4 fan-in 口径 · A7 文档债 · B1** | 待做 | 随批修 / 单独落（§9.2 / §9.3） |
| **S1-1 范围实测（23 组 · 非 19）** | **已完成** | 具名导出撞名全扫（含 `subscribe`(4) / `StreamDelta` / `__resetForTest` / `ImageGenTemplate` 等 §6.2 未列者）；**并按 N1 判据过滤出"域内重复"不违规者** |
| **S1-1a 首片：`logger` → `videoEditorLogger`** | **已完成** | 符号 94 处 / 28 文件（`rename-symbol --file` 限定源文件，全域内闭环）· 文件 `lib/logger.ts` → `lib/videoEditorLogger.ts`；验证：**tsc 0 错 · `check:arch` ✅ · 外部引用无新增 · 受影响单测 13 文件 / 97 例全绿**；`vi.mock` 风险 = 0 |
| **S1-1b 六组（base 侧）** | **已完成** | ① `detectAssetType`→`resourceDetectAssetType`(9 处/2 文件) ② `__resetForTest`→`resetProjectStoreForTest`(3/2) ③ `__resetForTest`→`resetResourceStoreForTest`(7/4) ④ `PanelState`→`VideoEditorPanelState`(18/6) ⑤ `toastStore.subscribe`→`subscribeToasts`(6/3) ⑥ **`FlowPosition` 改判为「收口」**（同形同义 = 探测重复 ⇒ 删重复定义、`import type` 复用，非改名）；验证：**tsc 0 错 · `check:arch` ✅ · 受影响单测 7 文件 / 170 例全绿（exit=0）** |
| **S1-1c-1 三组（agent 侧 · 不涉类型）** | **已完成** | ① `uid`→`agentUid`(8/2) ② `flushPersist`→`agentFlushPersist`(12/5) ③ `flushPersist`(resourceStore)→`resourceFlushPersist`(5/2) ④ `subscribe`→`agentConversationSubscribe`(13/5) ⑤ `subscribe`→`agentAssistantTableSubscribe`(2/1)；**钩子抓到真实回归**：`useAgentChat.hook.test.ts` 的 `vi.mock` **对象键**未随改名变（工具按 ADR-0038 不动对象键）⇒ 订阅静默失效、6 例红 ⇒ 已修；并核查 6 个「`test-affected` 按 stem 选不中」的 mock 测试（175 例全绿）；注释旧名已回改 |
| **S1-1c-2（类型件）** | **已完成** | ① `volumePolicy` 的 `ChatMessage`/`Conversation`/`ConversationMemory` **实测全仓零 import**（死导出）⇒ 按 **ADR-0030** 去 `export` 收私有 ⇒ **消歧零 churn**（原判"须与文件迁移同批"**被推翻**：不必迁文件，消歧只需收私有）② `agentCore.ChatMessage`→`agentChatMessage`(41/7) ③ `generate.ChatMessage`→`relayChatMessage`(7/2)；**类型改名无 `vi.mock` 风险**（type 运行时被擦除）；相关测试 6 文件 / 77 例全绿；残留旧名全为注释 |
| **S1-1d/e（videoEditor + scriptbox/editors 侧）** | **已完成** | ① `Timeline`(videoEditor 侧)→`VideoEditorTimeline`(3/2；d3d 侧例外不动) ② `MediaType`：`nodeMedia` 侧**死导出**⇒**去 export**（零 churn；videoEditor 侧保留）③ `TimelineTrack`：`VideoProcessNode` 侧**死导出**⇒去 export（videoEditor 侧保留）④ `removeResource`(scriptbox)→`scriptBoxRemoveResource`(6/3) ⑤ `CameraLens`/`describeCameraLens`(cameraStudio)→`CameraStudioLens`/`describeCameraStudioLens`(8/2 · 2/1，**对齐该文件既有 `CameraStudio*` 家族**)；**导出复扫：三处撞名全部消除**；**0 个测试 mock 本批模块 ⇒ 无假绿面** |
| S1-1 … S2-7 | 待做 | — |
