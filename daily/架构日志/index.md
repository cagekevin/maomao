# 架构日志 · 增量审计账本（Architecture Log）

> **定位**：本目录是「架构师心法」驱动的**增量架构审计**落盘处。目标：近期一个区域一个区域排查系统架构问题，逐步还清技术债。
> **视角**：一切审计从**数据流**出发——先定位「这条链路在哪些文件、谁产生、谁消费、落哪」，再判架构问题。
> **维护者**：架构师心法（`/.codebuddy/commands/架构师心法.md` §七）。每验证完一个区域，由它更新本 index + 对应 `<区域>.md` + 刷新 `spec/DATAFLOW.md`。
> **关联**：区域链路真源 = `spec/DATAFLOW.md`（数据流文件夹，架构师一并维护）；债明细真源 = 各区域架构日志（分片），轻量索引 = `daily/架构日志/债务.md`（位于架构日志内，一行一债，禁 ADR）；`spec/TECH-DEBT.md` 已废弃只读。

---

## 区域清单（审计进度）

> 状态：`待审计` / `审计中` / `已验证(无债)` / `已验证(有债待还)` / `待翻新` / `已还清` / `已退役`。
> 每区一份 `<NN>-<区域>-<YYYY-MM-DD>.md`（结构见 `_template.md`，同区多次审计各写新日期文件、不覆盖旧档）。

| # | 区域 | 数据流主文件（审计起点） | 状态 | 日志 |
| - | ---- | ---------------------- | ---- | ---- |
| 01 | 生成链路（主链路：节点→任务中心→回填） | `components/base/api/generate.ts` · `hooks/useNodeGeneration.ts` · `scriptbox/scriptBoxEngine.ts` | **已还清（剩持平/待翻新）** 7 轮；余 TD-01-5/6/7 持平待裁定、**TD-01-8 待用户拍板翻新**（合约编排壳）、TD-01-9/11/12/13 待裁定 | [01-生成链路-2026-09-12.md](01-生成链路-2026-09-12.md) · [二轮深探](01-生成链路-二轮深探-2026-09-12.md) · [三轮深探](01-生成链路-三轮深探-2026-09-12.md) · [四轮深探](01-生成链路-四轮深探-2026-09-12.md) · [可行性收口](01-生成链路-可行性收口-2026-09-12.md) · [六轮·recover模型修正](01-生成链路-六轮-自下而上重探与recover模型修正-2026-09-12.md) · [七轮·收敛正确性验证](01-生成链路-七轮-收敛正确性验证-2026-09-12.md) |
| 02 | 存储 / 持久化 | `components/base/core/contentStore.ts` | **已还清（剩 3 债待裁定）** 15 轮；**已结清 TD-02-1…12/15/16/17/18/19/20/21/22/24/25**；余 TD-02-13（@见 03/12·待用户拍板 label 化）/23（SSOT 双真·与 25 同源规划）/25残留；**元结构债 MD-14-1/2/3 已解决** | [首轮](02-存储-持久化-2026-09-11.md) · [二轮](02-存储-持久化-二轮深扫-2026-09-12.md) · [三轮](02-存储-持久化-三轮-就绪度与快照schema-2026-09-12.md) · [四轮](02-存储-持久化-四轮-nodeDataSchema-2026-09-12.md) · [五轮](02-存储-持久化-五轮-产出声明-2026-09-12.md) · [六轮](02-存储-持久化-六轮-低息清偿与普查-2026-09-12.md) · [七轮](02-存储-持久化-七轮-禁止过多兜底透镜-2026-09-12.md) · [八轮](02-存储-持久化-八轮-契约地基与失败分类收口-2026-09-12.md) · [九轮](02-存储-持久化-九轮-复杂度落点图谱-2026-09-12.md) · [十轮](02-存储-持久化-十轮-根因与诚实结果契约-2026-09-12.md) · [十一轮](02-存储-持久化-十一轮-正确性最终审计-2026-09-12.md) · [十二轮·诚实结果契约落地](02-存储-持久化-十二轮-诚实结果契约落地-2026-09-13.md) · [十三轮·静默吞与入口红线闸](02-存储-持久化-十三轮-静默吞与入口红线闸-2026-09-13.md) · [十四轮·元结构审计](02-存储-持久化-十四轮-元结构审计-2026-09-13.md) · [十五轮·TD02收尾](02-存储-持久化-十五轮-TD02收尾-2026-09-13.md) |
| 03 | 资产 / 素材 | `api/filesApi.ts`（assetStore 已删 → 子域退役并入 12） | **已还清（剩 1 条设计权衡）** 5 轮；**7 债 6 清**（四轮：03-7 假缩略图/03-8 扩展名回退链/03-9 canonical 命名/03-10 注释/03-12 TypeError 诚实分类；五轮：03-6 契约微漂移 4 处全清；03-11 已于 02 区十三轮清）；余 **TD-03-13**（可观测性设计权衡，登记项）；TD-03-5 改判非债 | [首轮](03-资产-素材-2026-09-11.md) · [二轮](03-资产-素材-二轮-中层filesApi与区域定界-2026-09-12.md) · [三轮·底层正确性与兜底](03-资产-素材-三轮-底层正确性与兜底审计-2026-09-12.md) · [四轮·正确性硬伤修复](03-资产-素材-四轮-正确性硬伤修复-2026-09-13.md) · [五轮·契约微漂移收口](03-资产-素材-五轮-契约微漂移收口-2026-09-13.md) |
| 04 | 画布 / 节点 | `canvas/NodePalette` · `canvas/nodePrefs` · `hooks/useGenerateNode.ts` | **已验证(有债待还)** 15 轮；**已结清 TD-04-1…19/23/24/25/26/27**（十四轮：23 prefs 默认值派生单一真源 + 配套 10 个测试 mock 改 importOriginal；26 删死副作用 import；十五轮：**24+25+27 母体**——选中派生链重构为「nodes 单源实时派生 + 内容签名短路」，删 updater 副作用与 onNodesChangeForEdges，覆盖删除/undo-redo；媒体提取器下沉 base/canvas 消层位倒置；`nodesRef`/`pendingMediaNodes` 经取证修正描述后保留）；余 **TD-04-21**（升级专项：取证推翻"行为等价"假设） | [首轮](04-画布-节点-2026-09-11.md) · [二轮](04-画布-节点-二轮深扫-2026-09-11.md) · [三轮](04-画布-节点-三轮底层-2026-09-11.md) · [四轮](04-画布-节点-四轮建节点收口-2026-09-11.md) · [五轮](04-画布-节点-五轮横向共性-2026-09-11.md) · [六轮](04-画布-节点-六轮-TD04-15深挖-2026-09-12.md) · [七轮](04-画布-节点-七轮-TD04-16尺寸写回-2026-09-12.md) · [八轮](04-画布-节点-八轮-TD04-17edge写回-2026-09-12.md) · [九轮](04-画布-节点-九轮-编组字段与整理写回-2026-09-12.md) · [十轮](04-画布-节点-十轮-覆盖完备性自检-2026-09-12.md) · [十一轮](04-画布-节点-十一轮-补审三缺口-2026-09-12.md) · [十二轮](04-画布-节点-十二轮-剩余缺口补审-2026-09-12.md) · [十三轮·自下而上深化](04-画布-节点-十三轮-自下而上深化研究-2026-09-13.md) · [十四轮·死import与prefs派生](04-画布-节点-十四轮-死import与prefs派生-2026-09-13.md) · [十五轮·选中派生链重构](04-画布-节点-十五轮-选中派生链重构-2026-09-13.md) |
| 05 | 提示词 | `prompt/promptManager.ts` · `prompt/promptHubStore.ts` · `prompt/PromptInput.tsx` | **已还清（10 债全清）**（清偿轮 2026-09-13：TD-05-4 删二次导出 · 05-5 口径更正+正则工厂 · 05-6 兜底口径统一+行号对齐 · 05-7 抽 `runLoad` 删死 useCallback · 05-8 修「最近使用」不刷新 · 05-9 删死 prop `presetPrompts` · 05-10 运行期 schema 守卫） | [05-提示词-2026-09-12.md](05-提示词-2026-09-12.md) |
| 06 | 编辑 / 查看 | `nodes/useImageHoverActions.tsx` · `editors/*` · `utils/imageCompress·imageUpscale·faceMosaic·previewUrl` | **已还清（9 债全清）**（清偿轮 2026-09-13：TD-06-7 URL 原语下沉 `core/utils` 消环+两实现合一（40+ 消费方零改动）· 06-8 **债描述修正**——非"派生写成副作用"而是**异步 stale closure 覆盖**，改 updater 形式 + 行为测试**先红后绿**实证"无实害"不成立） | [06-编辑-查看-2026-09-12.md](06-编辑-查看-2026-09-12.md) |
| 07 | 3D / 深度视频 | `components/director3d/*` · `depthVideo/*` | **已还清（剩持平待裁定）**；TD-07-3（project.ts 巨模块）/TD-07-4（App.tsx）**判非债·已裁定** | [07-3D-深度视频-2026-09-12.md](07-3D-深度视频-2026-09-12.md) |
| 08 | localTool 后端（服务端 `:18080`） | `localTool/src/routes/generate.ts` · `relay-poll.ts` · `generateEngine.ts` | 已还清 | [首轮](08-localTool-后端-2026-09-11.md) · [媒体与转发](08-localTool-后端-媒体与转发-2026-09-11.md) · [再评估](08-localTool-后端-再评估-2026-09-11.md) · [四轮](08-localTool-后端-四轮深扫-2026-09-11.md) · [五轮·底层](08-localTool-后端-五轮底层-2026-09-11.md) |
| 09 | 类型诚实性（横切：假收窄/无守卫断言） | `docs/类型诚实性审计-假收窄清单.md` · `contracts.ts`（闸：`type-check` · `check:strict-src` · `check:any`） | **已还清**（显式断言面 F1–F37 + src 侧隐式 any 1435→0 + 显式 any 6 处清 0）；仅余 **TD-09-2 tests 侧 1323 处「待翻新」**（不阻塞主链路） | [首轮](09-类型诚实性-2026-09-11.md) · [隐式any复核](09-类型诚实性-隐式any复核-2026-09-12.md) |
| 10 | 云同步（Cloud） | `components/base/store/cloudSync.ts` | 已还清 | [10-云同步-2026-09-11.md](./10-云同步-2026-09-11.md) |
| 11 | AI 助手（含表格）🆕自主新增 | `agent/conversation/conversationStore.ts` · `agent/runtime/useAgentChat.ts` · `agent/canvas/useCanvasAgentTools.ts` · `panels/AgentPanel.tsx` | 已验证(无债)（12 债全还清） | [11-AI助手-2026-09-11.md](./11-AI助手-2026-09-11.md) |
| 12 | 文件管理（资源素材库 / 画布资产引用层收口）🆕自主新增 | `components/base/store/resourceStore.ts` · `api/filesApi.ts` · `localTool/src/utils/fileStore.ts` · `localTool/src/routes/resources.ts` · `nodes/AssetNode.tsx`（跨 02/03/04/08 横切） | 审计中（设计态，待实施） | [12-文件管理-资源素材库与画布资产引用层收口-2026-09-12.md](./12-文件管理-资源素材库与画布资产引用层收口-2026-09-12.md) · 总览 [../../docs/122-文件管理架构总览-资源素材库与画布资产引用层收口-2026-09-12.md](../../docs/122-文件管理架构总览-资源素材库与画布资产引用层收口-2026-09-12.md) |

> **区域 02 说明（二轮深扫 2026-09-12，复杂度导向，状态回退）**：用户要求「架构师角度＝减少复杂度，别管会不会复现」→ 全量 grep 普查落盘调用点 + refs 实证，**推翻上轮「`kvGet/kvSet` 裸 import 仅存在于 `contentStore` 内部」的结论** → 按 §七 规则 6 状态回退得「已验证(有债待还)」。
> 本轮**以「复杂度错位」而非「bug」立项**（8 条 M#，见区域文件 §二）：M1 失败语义无分类（两类异质复杂度压进一个 catch）/ M2 入口缺协议原语致抽象泄漏 / M3 同键三路三口径 / M4「未加载＝不存在」同值 + 就绪度成隐式时序契约 / M5 快照 schema 无单一真源（≥6 处，**区域 04 的 TD-04-15/16/17/19 全是它的复利**）/ M6 假护栏与死抽象 / M7 同语义两处写点 / M8 红线只有注释无机器。
> **本轮已落地**：TD-02-1（M1+M2+M3+M8）——contentStore 增失败分类 + KV 版本/CAS 严格族原语，`projectStore`/`useCanvasSync` 改委托，`check:arch` 加规则 6 防回潮；度量 认知单元 4→2、跨层跳跃 2~3→1、改动半径 3→1，`type-check`/`test`（含 localTool 252）/`build` 全绿。
> **健康项 + 「有意分叉、非债禁统一」**：备份导入整页 reload（全量重建）vs 云同步定向 rehydrate（只动配置域）——语义不同，强行统一会引入部分 rehydrate 不完整的新洞。详见区域文件 §三/§七。
>
> **区域 02 六轮·收尾追加（2026-09-12，问答触发二次复查）**：用户问「素材改名/移动是否后端做、前端只发信号」→ 核实分工**确实如此**（物理文件与库内引用改写全在后端 `applyResourceIdentityChange` 一次做完五件事：路径安全/409 判重/renameSync/表行迁移/rescan 口径补建 + `rewriteUrlReferences`；前端负责**同会话内存态**：列表项 + `textCache` + `publish('resource:renamed')` → App 改写画布节点、taskStore 改写内存任务；前后端共用同一份四态改写纯函数）。但**复查出新缺口 2 条**：**TD-02-13（中息）**`rewriteUrlReferences` 直改 `kv.value` 不推进 `_version` → 违反"版本所有权移交服务端"协议 → 其他窗口 CAS 基线仍有效，可用内存旧 url 覆盖后端改写（3s 轮询也发现不了）；修复须**成对**（后端推版本 + 前端刷新基线，否则改名窗口自己 409 自撞）→ 待用户拍板；**TD-02-14（低息）**改写失败只 `console.error`、返回值无信号 → 画布/任务 404 破图而 UI 无提示（已核实**不会**误删文件，resources 新行已建）。另澄清一处"看着像债但不是"：`EVENTS['resource:renamed'].from` 行号漂移 —— `check-events` 只做**文件级**匹配、行号仅审计参考，属被容忍的已知取舍。
>
> **区域 02 六轮（2026-09-12，低息债批量清偿 + 存量普查）**：**TD-02-3/4/5/6/8/10 一次全清** —— ① 修假护栏：`d3dPersistence.getChannel()` 恒真守卫（BroadcastChannel 从未建立、跨窗口提示形同虚设 + 类型为 bug 背书）→ 句柄状态语义化（undefined/null）+ 2 例「首调建立/次调复用」；② 删第二真相：`backupStore.getCurrentProjectId()` 委托 `projectStore.getCurrentProject().id`（不再从存储重推导、不落后 300ms 内存态）；③ 修丢更新：`useNodePrefs.set` 抽 `mergeNodePrefs` 以**存储最新**为基准合并 patch（原写本实例整份 prev → 同类型多节点末写胜），并把副作用移出 setState updater；附**行为变更**：defaults 不再落盘（改代码默认值对新节点立即生效）；④ 死抽象删除：`storageQuota.analyzeAgentConversationPressure`（恒 null API）+ `resourceStore.loadResources`（src 零调用 → 内部化 `reloadFromStorage` 供 onStorageReady 复用、测试出口改名 `__resetForTest`）；⑤ 删除语义补齐：后端 `handleKvDelete` 键与 `<key>_version` 同删 + `projectStore` 删手工补删（删除后重建不再拿旧 CAS 基线）；⑥ 同构两份收一处：`orphanGc` 抽 `queryReferenceSources`/`toUploadRelPath`/`addUrlRefs`/`addKvRefs`，健康报表与 GC 回收**同一实现**。**自加护栏**：`check-node-data` 新增**表2d 无产出声明一致性**（进 `--strict`，负例探针验证：临时把 gridMergeNode 塞进无产出集 → 精确报 `assetUrl` + exit 1）。**普查（当轮即还，不留债）**：新登记并**当轮还清 TD-02-12**（KV 键同步读无机器守卫 → `check-arch` **规则 7**：AST + 受限静态求值识别 `contentGet(<KV 键>)`，豁免 contentStore/base-storage/director3d，自带「解析源为空即 fail-loud」自检，**3 轮负例探针**验证前缀字面量/精确键/import 常量+拼接均命中并 exit 1）；核实 3 处"疑似绕过唯一入口"为**有意设计非债**（`director3d-custom-poses` native 键、accountsStore 注入 MAIN world 操作目标站点存储、storageQuota 只读枚举）；顺手清 lint 唯一告警（未用 import）→ **lint 0 problem**。验证：单测 191 文件/2446 例绿、后端 252 例绿、type-check 0 错、check:health/check:arch/check-node-data --strict 全绿、smoke ALL PASS、build ✓。
>
> **区域 02 五轮（2026-09-12，产出声明：读侧猜 → 写侧声明）**：**TD-02-11 全清** —— `useConnectedInputs.ts` 的上游产出契约拆成**三张写侧表**：`SINGLE_OUTPUT_FIELDS`（单 URL 产出，**字段名显式**：assetNode/imageGenerateNode/panorama/director3d→`assetUrl`、videoGenerate→`videoUrl`）+ `NODE_OUTPUTS`（复合：剧本盒多端口 / 图片盒子多图 / 抽帧·切分·拼图的 `extractedImages[]`）+ `NO_OUTPUT_NODE_TYPES`（group/ghostTarget + **faceMosaic/loop/videoProcess 经核实无自有产出**，结果经 spawn 子节点交付）+ `SPECIAL_OUTPUT_TYPES`（textGenerateNode 特判）。`genericOutput`（`assetUrl>videoUrl>resultUrl` 三字段猜测）**降级为只服务未登记类型的最后安全网**，已登记类型的猜测归零；`genericOutputOk` 第二份手写白名单**删除**，覆盖率交给**可测纯函数 `uncoveredOutputNodeTypes()` + 单测**（新增节点漏登记即红，不再只是 dev console 噪音）。`check-node-data.mjs` 的读侧字段解析随迁（并进解析器自检）。**行为变更（诚实登记）**：三条测启发式的旧用例（assetNode+resultUrl 等假设性组合）改为锁真实字段契约 + 新增「安全网只服务未登记类型」「无产出类型不进安全网」用例；`docs/120` 阶段 3 已按此方案落地并留实施记录。验证：全量单测 191 文件 / 2440 例绿、check:arch 6 条绿、check-node-data --strict 绿、type-check 0 错、smoke ALL PASS。
>
> **区域 02 四轮（2026-09-12，nodeDataSchema：data 契约真源）**：TD-02-7 主体收口 —— 新建 `canvas/nodeDataSchema.ts`（`NODE_DATA_DEFAULTS` + `defaultNodeData`）作**新建 data 初值的唯一真源**，`NodePalette` 删除全部 `data:` 登记与 `PaletteNodeDef.data`、回归**纯 UI 目录**；消费者（`App.tsx`/`useCanvasAgentTools`/`ssrRegression.test`）改指新真源；`check-node-data.mjs` 改指 `NODE_DATA_DEFAULTS` 并删掉已无用的 palette 解析器与 `templateNode` 死登记；**顺手修掉浅合并导致的「新建节点共享同一可变数组」隐患**（改 `structuredClone` + 单测钉死）。**本轮确立三张表分工**（UI 目录 / data 初值 / 结构默认），并**明确刻意不派生** `interface`（会丢字段级类型=仪式化分层）与 `NODE_OUTPUTS`（不同关注点），二者改由 `check:node-data --strict` **机器对账**——理由写入各表头注释防误改。文档同步 5 处（NEW-NODE-GUIDE 注册表改 6 处 / CONTEXT 改 4 处同步 / DATAFLOW / NodeShell / TemplateNode）。新登记 **TD-02-11**（产出语义仍靠读侧启发式 → 静默空产出，@见 04）。
>
> **区域 02 三轮（2026-09-12，落盘 + 就绪度 + 工具加固）**：① **TD-02-2 全清** —— L1 `isStorageReady()/onStorageReady()` 把「就绪度」升为一等状态、L2 `loadFromLocal` 未就绪**不写假真相**（去掉「未加载＝不存在」的粘性缓存）、L3 `projectStore/resourceStore/appSettings` 未就绪不回写种子且就绪后重读（隐式时序契约消除）。② **TD-02-7 部分清** —— 新建 `base/canvas/canvasSnapshotSchema.ts` 作「落盘保留白名单」唯一真源（`NODE_KEEP`/`EDGE_KEEP`），`projectStore` 改消费、`groupNodes.test` 删手抄副本改 import；data 形状（①②③④⑥）待收。③ **TD-02-9（新，已清）** —— 发现 `check-node-data` 因 `.ts` 类型标注 + `indexOf` 抢命中 + 抹白抹掉字符串而**恒解析空集却长期报「0 缺口」**（假护栏，对账结论唯一依据失效数月）；三处修复 + 新增**解析器自检 fail-loud**（任一解析源为空 → 告警且 `--strict` exit 1）+ 负例探针验证。④ 新登记 TD-02-10（后端 KV 删除不清理 `_version` 兄弟键，`@见 08`）。
>
> **区域 10 说明**：用户（审计发起方）点名优先审计的「云同步」未在原始 9 区计划内，属跨「存储/持久化」边界的专用同步层（自有引擎 + GAS 网关 + 冲突判定），故追加为第 10 区。审计发现 3 债（[F-云B]/[F-云A]/[F-云C]），**全部于 2026-09-11 当场根源收敛并验证**，状态 = 已还清（TD-12）。
> 注：本区 3 债 ≠ 区域 02 的 F1（下载云端后各 store 内存态不刷新 → KV 新/内存旧，见 `spec/TECH-DEBT.md` **TD-13 已解决**）。两者根因不同（本区在 cloudSync 引擎内部，F1 在 store 边界）；F1 的 rehydrate 代码已于 2026-09-11 **并入本区 cloudSync.ts**（原独立 cloudRehydrate.ts 删除，downloadConfig 写回后自触发），故"引擎"与"重水合"二合一为单一模块。云同步区「已还清」含本区 3 引擎债（TD-12）+ TD-13 重水合（已并入本区）+ TD-14 排除清单隐私缺口（已解决）；F1 债本登记在区域 02、修复落在本区模块——跨区互指保留以便溯源。
>
> **区域 11 说明**：**自主新增**（规则第 1 条）。原 10 区把 AI 助手整个子系统吸进「01 生成链路」的两行脚注（`agentRuntime → chatStream`），而它实为独立子系统（会话状态层 8 文件 + 运行时 12 文件 + 工具层 3 文件 + 表格 23 文件 + `AgentPanel.tsx` 1899 行），故追加为第 11 区（编号顺延 `max(10)+1`）。
> 审计结论：结构总体健康——会话状态层 6 文件**单向无环**拆分合格（非过度抽象）；SSOT 六项唯一（会话/快照/表格/运行态/长期记忆/输入态）；三条运行期 Guard 均实测有效；静默 no-op 已出声。`runModeRegistry.ts` 整模块及 `AI-ASSISTANT-REDUNDANCY-CUT.md` 提案已 100% 落地（实测文件不存在、全仓仅 6 条注释）。
> **债（9 轮 9 债，全部已还清）**：TD-11-1（`TS2698`）→ TD-16；TD-11-2（草稿双写/双 SSOT）+ TD-11-3（`UseAgentChatReturn` 回传 store 写操作）→ TD-17（第 3 轮）；**第 4 轮用户质问「真的结清了吗」→ 复核推翻第 3 轮结论**，发现 TD-11-4（4 处切对话/收尾静默清草稿 → 丢用户输入，利息率**高**，已修）；**第 5 轮**：TD-11-5 窄接口化（5 原子写 + 语义动作 `resetCurrentConversationToEmpty`，8 调用点全改 + 删 2 处 no-op）；**第 6 轮**：运行态字段生命周期对账 → TD-11-6（删 `workflowRuntime.ts` 生产级死代码/第二真相）+ TD-11-7（`creditGatePreview` 本地副本切对话不重置 → 卡片跨对话残留，**高**）；**第 7 轮**：子代理**独立**复核交叉验证（§六.5）；**第 8 轮**：工具执行链路 → TD-11-8（4 处裸调 `ctx.setEdges` 绕过 canvasHost；根因 canvasHost 缺 `removeEdges` 原语），把红线升级为 **`check:arch` AST 机器强制**；**第 9 轮**：TD-11-9（`MUTATING_TOOLS` 零覆盖 → 20 工具对账用例 + 负例验证；单飞锁超时静默 → 补日志）。**工具层 + 表格域模型层 + 表格 UI 组件层均已审完**（第 10 轮 TD-11-10：运行态不变量 `validateWorkspace` 接通生产侧 + 列合并 `mergeColumnsByLabel` 收口；第 11 轮 TD-11-11：F8 假成功修复 + F1 互斥收口 SSOT + F2/F3/F4/F7 偿还，F5/F6/F9 持平/设计介入登记）。**设计介入债已补还（2026-09-11 收尾轮）**：TD-11-11 的 **F6**（卡片接口改位置式 `string[][]` + `AssistantTablePanel` 删「按列名→Record」转换，同名列静默丢值根因消除 + 2 防回潮测试）、TD-11-12 的 **③**（`agentRuntime` 隐式 any → 定义 `RoundTripCtx`/`ToolCallCtx`/`StreamDelta`/`ToolExecResult` 契约，`roundTrip`/`runToolCalls` 及内部参数全部显式类型 + 删 `result?.nodeId` 死分支），两债现全结清；仅余 F5/F9 持平登记待翻新。
> **方法论沉淀**：① 语义迁移必须复核原防御逻辑是否仍成立；② 测试须**行为断言 + 先红后绿**（实现断言是自证式的）；③ 审计结论应由**独立路径**复核，不自证。见区域文件 §六.2 / §六.3 / §六.4 / §六.5。
> **已裁定（2026-09-11 用户确认）**：`pendingImageNodes`（画布选中待引用图）不随对话切换清空 = **有意设计**（选中图属画布全局概念，非 per-conversation 数据），**非债、不改**。后续 AI 勿当残留 bug 清理（与 TD-11-4/11-7 形态相似性质相反）。
> **改判留痕**：第 1 轮列的「`useAgentChat` 6 职责／1138 行」候选经量化**改判为非债**——注释占 31.6%、`send` 主循环是不可约编排时序、已充分下沉（agentCore/agentRuntime/agentMessages/agentAttachments/inputStateMachine/workflowState），再切要么成环要么造碎片；是合格深模块（窄接口厚实现）。理由见区域文件 §五.1。

> **区域 04 覆盖度说明（2026-09-12 十轮自检）**：区域 04「已还清」= **已发现的债已还清**（9 轮 19 债），**≠ 审计覆盖完备**。十轮逐文件对账后仍有未深审模块，高价值三处：`hooks/useAssetDropPaste.ts`（「素材/文本/图片/节点组上画布」5+ 入口，551 行，**0 覆盖**）· `hooks/useConnectedInputs.ts`（143 fan-in 数据流枢纽，仅二轮浅判「不切」）· `ui/NodeShell.tsx` 本体（所有节点公共骨架，未深审本体）。详见 [04-画布-节点-十轮-覆盖完备性自检-2026-09-12.md](./04-画布-节点-十轮-覆盖完备性自检-2026-09-12.md)。**十一轮已补审** `useAssetDropPaste`（修复 **TD-04-20**）/`useConnectedInputs`/`NodeShell`；**十二轮已补审** `nodePrefs`（**TD-04-23**）/`useCanvasShortcuts`/`useAssetDragToCanvas`/`lod`（**TD-04-22**）。**十三轮（2026-09-13 自下而上深化）已补审** `useContextMenu`/`canvasContextMenu.tsx`（**TD-04-26** 死副作用 import）/`ArrangeConfirm`/`App.tsx` 编排残留（selectedAssetNodes 同步链 **TD-04-24** · getNodeMedia 层位 **TD-04-25** · nodesRef hack **TD-04-27**）/`nodes` 17 节点本体抽样（11 节点解构 `useReactFlow().setNodes/setEdges` 抽样健康，非债）。区域 04 状态回退为**已验证(有债待还)**（TD-04-24/25/26/27 待还）。横切发现：`tsconfig` `noImplicitAny:false` 的**隐式 any 面** `@见区域 09`。另：`nodes/*.tsx` 节点组件本体在区域 04↔06 之间**无主**（04 声明不属本区、06 定义是 `editors/*`），待裁定归属。

> **文件名约定（recency-at-a-glance）**：每区每轮审计一个独立文件，命名 `<NN>-<区域>-<YYYY-MM-DD>.md`（如 `01-生成链路-2026-09-11.md`）。
> 同区多次审计**各写新日期文件、不覆盖旧档**——文件名即显示最近在动哪块、历史可追溯，且避免单文件膨胀。

---

## 区域治理规则（架构师自主裁量，不必等用户确认）

> 清单**不是封闭**的。审计/排障中发现清单外情况，架构师**自主处置并落盘留痕**，禁止因漏列就跳过不记。

1. **自主加区（漏列）**：审计/排障中发现未覆盖的数据流区域 → 自主追加一行，编号顺延 `max(NN)+1`，状态「审计中」，并在该区域下加一段说明「为何漏列/从哪发现」（或补 备注 列）。区域 10「云同步」即此例。
2. **区域拆分**：某区实为 ≥2 个独立关注点（如生成链路含主入口 + 剧本盒第二入口）→ 拆为 `<NN>a`/`<NN>b` 或新编号，原区标「已拆分→见 NNx/NNy」。
3. **合并/去重**：两区域实为同一数据流 → 合并，保留低编号，另一标「已并入 NN」。
4. **退役/死区**：区域对应代码已删或无数据流 → 标「已退役」，保留历史文件不删、**编号不回收**（防链接断裂）。
5. **跨区归属**：症状在 A 区、根因在 B 区 → A 区文件记录并 `@见 B区`，债项归 B 区（债 ID 绑定首次发现区，`债务.md` 锚点写 B 区文件）。
6. **状态回退**：已还清区被新代码打回 → 重开（新日期文件），状态回「有债待还」，备注 `回退：<日期> <原因>`。
7. **待翻新 ≠ 债**：需重构翻新但不算「现在不能动的债」→ 状态「待翻新（转架构5步法）」，**不进 `债务.md`**（该索引仅收「确是债且现在不能动」）。
8. **单区仍膨胀**：某区一轮审计产出过大 → 不塞进一个文件，按子关注点拆 `<NN>-<子主题>-<日期>.md`，`index.md` 日志列链多文件。

---

## 审计闭环（每区一步）

1. **定位（自底向上）**：读 `spec/DATAFLOW.md` 该区域链路，先按「层（底→顶）」定位其**类型/契约/定义地基**，拿到文件清单。
2. **实证（先地基后消费者）**：从地基文件起，对每个主文件跑 `node scripts/mv-sync-refs.mjs refs <file>`——先看类型/契约定义，再沿 fan-in（谁 import 它）向上逐级实证最新数据流，确认 DATAFLOW 是否过期漂移。
3. **审**：套用架构师心法 Phase 1–4（溯源/定海/切割/探债）+ 静默自检清单（§五），从数据流角度判问题。
4. **落盘**：写 `daily/架构日志/<NN>-<区域>-<YYYY-MM-DD>.md`（按 `_template.md`，不覆盖旧档），更新本 index 状态与「日志」列链接。
5. **刷新数据流**：若 DATAFLOW.md 与实际不符，就地追加 `更新(<日期>, refs实证): ...`（禁静默删旧链路）。
6. **记债**：确属债且现在不能动的 → 明细写本区 `<NN>-<区域>-<日期>.md` 的「探债」段，摘要追加 `daily/架构日志/债务.md` 一行。**`spec/TECH-DEBT.md` 已废弃（2026-09-11），只读勿追加**（历史债留作参考；新债一律进架构日志）。
7. **下一区**：进入清单下一个 `待审计` 区域。

> 实证工具即 CLAUDE.md §5.4 的 `mv-sync-refs.mjs`：`refs <file>` 查数据流/依赖最快，不需要为搞清楚链路启动子代理全库乱搜。
