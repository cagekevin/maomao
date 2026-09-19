# TASK-006 · 核实base-store15件分域

> ⚠️ **你只能写这一个文件**：`docs/agent 批量任务/TASK-006-核实base-store15件分域.md`。碰任何其他文件（含源码）视为任务失败。

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
- 请先 `ls -1 src/components/base/store/` 列出全部文件，再逐个判断（**不要只列我给的**）

## 输出格式（填在下表，直接在**本文件**里追加）

| # | 件（当前路径） | 非测试消费方 | 数据落点 | 界面位置 | **建议归属** | 置信度(高/中/低) | 一句话依据 |
|---|----------------|--------------|----------|----------|--------------|------------------|------------|
| 1 | `ls -1 src/components/base/store/` |  |  |  |  |  |  |

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

- 已知：`base/store` 15 个文件里住着**约 8 个域**（docs/DOMAIN-MODULES.md §3.6 有记载）。典型成员可能包括：`projectStore`（项目域）· `resourceStore`（素材域）· `taskStore`（任务域）· `accountsStore`（多开/账号）· `contentStore`（横切 KV）· `backupStore`（备份）· `nodeRuntimeStore`（节点运行时）等 —— **请以 `ls` 的实际结果为准，不要照抄我这份**。
- 判断要点：每个 store 管的**数据属于哪个域**（`resourceStore` 管素材 ⇒ 素材域；`taskStore` 管任务 ⇒ 任务域），**谁写它**（写入者跨不跨域），**它落哪个存储键**。
- 注意 `contentStore` 这类**横切 KV**（被所有域共用）应**留在 base**（或 base/core），不搬。
- 请给出一张「store → 域」的映射表，并指出**哪些 store 其实该跟某个域的 UI 件合并到同一个域目录**。

---

# 审计报告（TASK-006 · 只读，仅写本文件）

## 0 · 假设与方法说明（显式注明）

- **文件名校正**：你给的路径 `…/TASK-006-做任务` 不存在；实际文件是 `docs/agent 批量任务/TASK-006-核实base-store15件分域.md`，本报告即写入此文件。
- **清单来源**：先 `ls -1 src/components/base/store/` 得到**实际 15 件**（见下表），未照抄任务书"特别提示"里的示例（`contentStore`、`generationContract` 不在本目录实际文件里——`contentStore` 在 `base/core/`，`generationContract` 已在前序批次改名为 `generationOrchestration`）。**扩展**：清单 15 件全部纳入，其中 `skillStore` 未被 §3.6 的九组分组覆盖，按 ls 实际发现补入。
- **证据方法**：对每个文件跑了 `node scripts/mv-sync-refs.mjs refs <file>`，取「① 模块引用」段内 `src/components/**` 的非测试 import 消费方；读头注自述（职责/数据流/存储键）；并用 `grep` 复勘 `App.tsx` 直接消费与若干跨目录消费。
- **判据优先级**：① 界面位置（长在哪儿）② 数据落点（真源）③ 同形态不拆 ④ 被 App 消费≠横切（仅当"只有 App 消费"才偏横切，但凡有业务语义 P1 仍归域）。

## 1 · 逐件判定表（7+1 列）

> 非测试消费方 = `mv-sync-refs` ①段 import 命中（已排除 `tests/` 与字符串残引）；数据落点取自头注；置信度「中」均注明缺什么。

| # | 件（当前路径） | 非测试消费方（实测） | 数据落点 | 界面位置 | **建议归属** | 置信度 | 一句话依据 |
|---|---|---|---|---|---|---|---|
| 1 | `base/store/accountsStore.ts` | `panels/sections/AccountsSettings.tsx`、`store/cloudSync.ts` | localStorage `KEY_YIMAO_ACCOUNTS`（cookie 环境集合） | 设置页"账号"段 / TopNav 多开视图的数据 | **`components/account/`**（账号·多开域） | 高 | 数据=多开账号环境，唯一业务消费方是账号设置页+云同步重水合，属用户可感知"多开" |
| 2 | `base/store/agentModelStore.ts` | `agent/panels/AgentPanel.tsx`、`agent/runtime/useAgentChat.ts`、`panels/sections/AgentChatSettings.tsx` | localStorage `KEY_AGENT_CHAT_MODEL`/`KEY_AGENT_HISTORY_TURNS` | AI 助手面板 + 设置页"AI 聊天"段 | **`components/agent/`**（agent 域） | 中 | 生产消费方**全在 agent 域**（AgentPanel/useAgentChat），数据=AI 助手聊天用的模型偏好；§3.6 归"供应商"是按字面归类，按 P1/P5 应归 agent（缺：你否"供应商"还是"agent"的口径） |
| 3 | `base/store/appSettings.ts` | `panels/sections/OtherSettings.tsx`、`store/autoSync.ts`、`store/cloudSync.ts`、`utils/assetUrl.ts` | localStorage `app_settings` | 设置页"其他设置" + 各 UI 开关 | **`components/settings/`**（设置域） | 高 | 应用设置真源，消费方=设置页 UI+云同步/自动同步读开关；被 App 消费(判据#4字面)但有业务语义(P1)→仍属设置域 |
| 4 | `base/store/autoSync.ts` | `App.tsx`（启动调度）；内部→`cloudSync` | 无自有存储，调 `cloudSync` 上传/下载 | 无直接界面（静默定时同步，仅冲突 toast） | **`components/cloud/`**（云同步域，与 cloudSync 同住） | 中 | 是 cloudSync 的定时调度器（单向→cloudSync），关注点=云同步；唯一消费方是 App 启动它，按事实属云同步域非横切（缺：调度器是否要独立成"同步"子域的裁定） |
| 5 | `base/store/backupStore.ts` | `canvas/useCanvasEventSubscriptions.ts`（自动备份订阅）、`App.tsx`（引用） | 派生自 `contracts` 键登记表 + `projectStore` 画布快照 + kv | 导出/导入（通常在设置或菜单，无专属界面位） | **不搬（横切/系统级聚合器，留 `base/store` 或 `base/system`）** | 中 | 它聚合**所有域**的存储做导入导出，唯一真实 import 消费方是画布自动备份订阅，不属于任何单一业务域，无"界面位置"；若产品把导出/导入 UI 放设置页则可并入设置域（缺：导出/导入按钮实际所在页签） |
| 6 | `base/store/cloudSync.ts` | `store/autoSync.ts`、`store/accountsStore.ts`(reloadAccounts)、`store/providerStore.ts`(reloadProviders)、`store/appSettings.ts`(reloadAppSettings) | localStorage(设置类 `getSyncKeys`) + GAS 云端 | TopNav 同步按钮（`uploadConfig/downloadConfig`） | **`components/cloud/`**（云同步域） | 高 | 云端同步适配层，消费方=autoSync 调度+账号/供应商/设置重水合，界面在 TopNav；属"云同步"关注点 |
| 7 | `base/store/generationOrchestration.ts` | `hooks/useNodeGeneration.ts`、`scriptbox/scriptBoxEngine.ts`、`panels/GeneratedView.tsx` | 编排→写 `taskStore` + `node.data(resultUrl)` | 节点生成流程 + 剧本盒生成 + 生成结果页 | **`components/generation/`**（生成能力域，与 `api/relay` 同族） | 中 | 生成编排序列唯一实现，被画布节点 hook+剧本盒+生成页三处消费，是跨内容类型的共享生成链路(对齐 §3.1.3.1 generate 中继)，归生成能力域（缺：落 `components/generation/` 还是并入 `api/relay/` 的裁定） |
| 8 | `base/store/nodeRuntimeStore.ts` | `video/nodes/VideoProcessNode.tsx` + `useNodeRuntime`(hooks，被各画布节点用) | **内存 Map，不落盘** | 各画布节点的 loading/error/progress 瞬态 | **`components/canvas/`**（画布域·节点机制） | 高 | 节点瞬态运行态，消费方全是画布节点/节点 hook，不落盘随节点生命周期；§3.6 归"生成编排"是按字面，数据形态(节点 loading)是画布机制 |
| 9 | `base/store/projectStore.ts` | `panels/GeneratedView.tsx`、`panels/ProjectSelector.tsx`、`panels/ResourceLibrary.tsx`、`panels/TopNav.tsx`、`store/backupStore.ts`、`store/resourceStore.ts`、`scriptbox/ScriptBoxAssetPicker.tsx` | localTool `/api/projects` + localStorage（双写） | TopNav 项目选择 + 画布按项目隔离 | **`components/project/`**（项目域） | 高 | 项目列表/当前项目的唯一真源，界面在 TopNav 项目选择+画布按项目隔离；被 App 消费(判据#4字面)但有业务语义(P1)→仍属项目域 |
| 10 | `base/store/providerStore.ts` | `agent/panels/AgentPanel.tsx`、`panels/sections/AgentChatSettings.tsx`、`panels/sections/ApiSettings.tsx`、`store/cloudSync.ts`、`scriptbox/GearSettings.tsx` | localTool `/api/providers` | 设置页"API 配置"/"AI 聊天"段 + 剧本盒设置 | **`components/provider/`**（供应商域，新建） | 高 | 供应商(API/模型)数据层，消费方=设置页供应商/聊天配置+云同步+剧本盒；属"供应商"关注点(§3.6 ⑤) |
| 11 | `base/store/resourceStore.ts` | `media/providers/canvasSource.ts`、`media/providers/librarySource.ts`、`panels/ResourceLibrary.tsx`、`canvas/nodes/AssetNode.tsx`、`canvas/nodes/ImageGenerate.tsx`、`scriptbox/ScriptBoxAssetPicker.tsx`、`scriptbox/StepAssets.tsx`、`scriptbox/scriptBoxEngine.ts` | localStorage + 后端 `resources` 表（`contentId`） | 素材库面板(`ResourceLibrary`) + 节点素材引用 | **`components/resource/`**（素材域，新建） | 高 | 素材库真源(§3.1.2 素材域数据真源)，被画布节点/素材面板/media 来源/剧本盒≥4 域消费但数据属素材域(P1)；且与素材 UI 应同域 |
| 12 | `base/store/settingRegistry.ts` | `panels/sections/OtherSettings.tsx`、`store/appSettings.ts` | 静态声明表（无存储） | 设置页渲染 | **`components/settings/`**（设置域，与 appSettings 同住） | 高 | 应用设置的声明式真源，消费方=OtherSettings(渲染)+appSettings(派生默认)，与 appSettings 同属设置域 |
| 13 | `base/store/skillStore.ts` | `agent/panels/AgentPanel.tsx`、`panels/sections/SkillSettings.tsx` | localStorage `KEY_AGENT_SKILLS` | AI 助手面板 skill + 设置页 skill 管理 | **`components/agent/`**（agent 域） | 高 | AI 助手 Skill 系统数据层，消费方全是 agent 域(AgentPanel/SkillSettings)；§3.6 九组未列它，是按 ls 实际发现的第 15 件 |
| 14 | `base/store/taskCompletionBus.ts` | `store/taskStore.ts`(`publishTaskCompleted`) | eventBus publish（无自有存储） | 任务完成→节点回填(`useNodeGeneration` 订阅 `agent:task-completed`) | **`components/task/`**（任务域，与 taskStore 同住） | 高 | 任务完成信号唯一发布入口，唯一消费方=taskStore(发布)+节点 hook(订阅)，是任务域内部件 |
| 15 | `base/store/taskStore.ts` | `agent/canvas/canvasPlanExecutor.ts`、`agent/canvas/useCanvasAgentTools.ts`、`agent/panels/AgentPanel.tsx`、`panels/LeftPanel.tsx`、`panels/TaskCenter.tsx`、`api/pollTask.ts`、`store/generationOrchestration.ts`、`canvas/nodes/AssetNode.tsx`、`canvas/nodes/ImageGenerate.tsx`、`canvas/upstreamLink.ts` | localTool `/api/tasks` | 任务中心(`TaskCenter`，LeftPanel 页签) | **`components/task/`**（任务域，新建） | 高 | 任务中心真源，被 agent/画布/面板/api/scriptbox≥4 域消费但数据属任务域(P1)；与 TaskCenter UI 应同域；被 App 消费(判据#4字面)但有业务语义仍属任务域 |

## 2 · store → 域 映射表 + 应并入的域 UI

| store | 域 | 目标目录（部分待新建） | 应同目录合并的域 UI 件 |
|---|---|---|---|
| accountsStore | 账号·多开域 | `components/account/` | `panels/sections/AccountsSettings.tsx` |
| agentModelStore | agent 域 | `components/agent/` | `AgentPanel`、`panels/sections/AgentChatSettings.tsx`、`SkillSettings` |
| skillStore | agent 域 | `components/agent/` | 同上 |
| appSettings | 设置域 | `components/settings/` | `panels/sections/OtherSettings.tsx` 等设置页 UI |
| settingRegistry | 设置域 | `components/settings/` | 同上 |
| cloudSync | 云同步域 | `components/cloud/` | TopNav 同步按钮 |
| autoSync | 云同步域 | `components/cloud/` | 同上 |
| providerStore | 供应商域 | `components/provider/` | `panels/sections/ApiSettings.tsx`、`AgentChatSettings`、`scriptbox/GearSettings` |
| resourceStore | 素材域 | `components/resource/` | `panels/ResourceLibrary.tsx`/`ResourceStrip`/`ResourcePreview`（S2-9 已规划迁素材域） |
| taskStore | 任务域 | `components/task/` | `panels/TaskCenter.tsx`、`LeftPanel` 任务页签 |
| taskCompletionBus | 任务域 | `components/task/` | 同上 |
| projectStore | 项目域 | `components/project/` | `panels/ProjectSelector.tsx`、`TopNav` |
| nodeRuntimeStore | 画布域 | `components/canvas/` | 各画布节点（消费方） |
| generationOrchestration | 生成能力域 | `components/generation/`（或 `api/relay/`） | `hooks/useNodeGeneration`、`scriptBoxEngine` 的生成链路 |
| backupStore | （横切/系统级） | 留 `base/` | 无专属 UI 域 |

## 3 · 三段汇总

### 3.1 该搬的（件 → 目标目录，按目标目录分组）

- **`components/account/`**：`accountsStore.ts`
- **`components/agent/`**：`agentModelStore.ts`、`skillStore.ts`
- **`components/settings/`**：`appSettings.ts`、`settingRegistry.ts`
- **`components/cloud/`**（新建·云同步域）：`cloudSync.ts`、`autoSync.ts`
- **`components/provider/`**（新建·供应商域）：`providerStore.ts`
- **`components/resource/`**（新建·素材域）：`resourceStore.ts`
- **`components/task/`**（新建·任务域）：`taskStore.ts`、`taskCompletionBus.ts`
- **`components/project/`**（新建·项目域）：`projectStore.ts`
- **`components/canvas/`**：`nodeRuntimeStore.ts`
- **`components/generation/`**（新建·生成能力域，或并入 `api/relay/`）：`generationOrchestration.ts`

> 除 `backupStore` 外，其余 **14 件均应按域迁出 `base/store`**（与 §8 S2-4/S2-8「`base/` 只留横切层」目标一致）。

### 3.2 不该搬的（件 + 为什么）

- **`backupStore.ts`**：建议**留 `base/`**（横切/系统级聚合器）。它不是任何单一业务域的私有物——它读取 `contracts` 键登记表 + 各域存储做全量导入导出，唯一真实 import 消费方是 `canvas/useCanvasEventSubscriptions`（自动备份订阅），无专属界面位。按 P1 它有"备份"语义但是**跨域聚合**性质，归不进单一域；若后续确认导出/导入按钮挂在设置页，则可并入设置域。
- **特别提示——判据#4 的边界**：`appSettings`/`autoSync`/`cloudSync`/`projectStore`/`taskStore` 这 5 件**被 `App.tsx` 直接消费**。按判据#4 字面会判"横切不搬"，但按 **P1（有无业务语义）** 它们都是各自域的**真源**（设置/云同步/项目/任务），且 §2.5 明确 `App.tsx` 是装配层、不计为消费域。⇒ **不因此判横切**，仍按上表搬入各自域目录。

### 3.3 新发现的问题 / 我可能判错的地方

1. **§3.6 分组与本审计冲突两处**（以事实为准，提请你拍板）：
   - `agentModelStore`：§3.6 归"供应商(⑤)"，但生产消费方**全在 agent 域**（AgentPanel/useAgentChat），数据=AI 助手聊天的模型偏好 ⇒ 我判 **agent 域**。若你坚持"选供应商模型=供应商域"，则它该去 `components/provider/`。
   - `nodeRuntimeStore`：§3.6 归"生成编排(⑨)"，但它是**节点 loading/error/progress 内存瞬态**（不落盘、随节点生命周期），消费方全是画布节点 ⇒ 我判 **画布域**。若你把它视作"生成运行态"则归生成域。
2. **`skillStore` 漏登记**：§3.6 的九组分组的 14 件未含 `skillStore`（实际第 15 件），且它明确属 agent 域。说明 §3.6 的"8 域"清单不完整，需在 §3.6 补"⑩agent 域含 agentModelStore+skillStore"（或按上面 1 拆分）。
3. **`backupStore` 无归属域**：§3.6 把它单列为"③备份"但"备份"不是最终域清单里的一级域；它本质跨域聚合器，建议明确裁定"留 base/横切"或"并入设置域"，不要悬空。
4. **任务书示例与实测不符**：特别提示里的 `contentStore`、`generationContract` 不在本目录——前者在 `base/core/`（横切 KV，本就不在这 15 件里），后者已在前序批次改名 `generationOrchestration`。读者别再找这两个名。
5. **云同步簇的内部耦合**：`cloudSync` 反向 import 了 `accountsStore`/`providerStore`/`appSettings` 的 `reload*` 函数（重水合），`autoSync` 又 import `cloudSync`+`appSettings`。搬移时这三者要**同批**迁入 `components/cloud/`（或云同步域），且 `accountsStore`/`providerStore`/`appSettings` 的 `reload*` 导出需随其宿主域一起迁、再更新 cloudSync 的 import 路径（C2 跨层移位须先解反向引用）。
6. **`generationOrchestration` 落点二选一**：它与 `base/api/{generate,pollTask,relayProxy}`（中继域）同属"生成链路"，可并入 `api/relay/`；也可独立成 `components/generation/`。建议与中继域门面（S2-3）一并裁定，避免生成链路拆成两处。

## 4 · 验收点：跨≥2 域消费的件（判它归哪、为什么）

**有，且不止一件。** 逐件列出（按实测 import 消费方跨的域）：

| 件 | 跨域消费方 | 归哪 | 为什么 |
|---|---|---|---|
| `resourceStore` | 画布(canvas nodes)/素材面板(media·panels)/剧本盒(scriptbox) ≥4 域 | **素材域** | 数据真源是素材库（P1 有业务语义），跨域消费走它的门面，不改归属（补充规则"跨域消费不改归属"） |
| `taskStore` | agent/canvas/panels/api/scriptbox ≥4 域 | **任务域** | 任务中心真源，多域消费=中继性质而非横切（P1） |
| `projectStore` | panels/backup/resource/scriptbox 等多域 | **项目域** | 项目真源 |
| `providerStore` | agent/panels/cloudSync/scriptbox | **供应商域** | 供应商数据真源 |
| `appSettings` | 设置/autoSync/cloudSync/assetUrl | **设置域** | 设置真源 |
| `agentModelStore` | agent/设置页 | **agent 域**（见冲突 1） | AI 助手聊天配置，consumer 全在 agent |
| `generationOrchestration` | canvas/scriptbox/panels | **生成能力域** | 生成编排共享链路 |

**结论**：这些件虽被 ≥2 个不同域消费，但**全部是某域的真源/能力**（有业务语义，P1），不因此判横切；按"数据属哪个域"定归属，跨域消费方走其门面即可。唯一真正"无单一归属、建议留 base"的是 `backupStore`（聚合器）。

---

> 本报告全程只读，未改任何源码/未建文件/未提交，仅写入本 `TASK-006` 文件。
