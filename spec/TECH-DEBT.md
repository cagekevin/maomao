# spec/TECH-DEBT.md · 技术债登记（单一固定文件）

> **定位**：全仓库唯一的技术债留痕文件。由「系统治理5步法」Step 7 主动追加，也可由任何 AI 在发现"现在不能动、但确是债"时追加。**单一文件、只追加、不分散、不建 ADR**（CLAUDE.md 决策铁律）。
> **读者**：下一个 AI。目的是让债可见、不被聊天淹没、不被误删。
> **不写**：备选方案否决理由（属决策过程，不落盘）；讲"为什么这么设计"的注释不挪到这里（留原处）。

## 登记格式

每条债固定结构（复制追加，不删既有条）：

```
### [TD-<序号>] <一句话现象>
- 状态：待处理 / [已解决 <日期>]
- 归类：还债 / 持平 / 增债（必填；增债须答"多少·为何·何时还"三问）
- 利息率：高（核心链路：生成/模型/对话/落盘） / 中（边缘功能） / 低（纯内部）
- 偿还计划(owner)：谁负责还 + 触发条件或具体动作（**拒绝"以后再说"的无头债**）
- 现象：<现在观察到的问题>
- 根因：<为何产生 / 是哪个前置闸门漏了>
- 为何现在不动：<风险 / 依赖 / 时机未到>
- 建议处理时机：<什么条件下再动>
- 登记于：<日期> · 来源：<系统治理 / 写码时发现>
```

**防膨胀规则**：债还清后**标记** **`[已解决 <日期>]`** **而非删除**（保留"曾是什么坑"的决策价值）；本文件只追加、只标状态，不整体清空。`Temp/governance-*.md` 是一次性快照，可过期清理，非权威。

## 已登记债

### \[TD-1] apiRegistry 校验只有登记表侧，白名单/fn 豁免洞致「前端真实调用」方向零覆盖
- 归类：已还 · 利息率：高（核心链路 api 契约） · 偿还计划(owner)：已结清（docs/103 §4 全量，2026-09-04）

- 状态：\[已解决 2026-09-04] —— 按 `docs/103` §4 全量实施（详见文末「TD-1 实施记录」）。`npm run check:api` error 0 / warn 0 / info 9（新增 1 条为反向扫描的 providerApi 变量化 helper 显式标注）；反向扫描 32 处字面量调用全命中登记、0 失配。四类豁免洞验证：注入「ACTIVE fn 夹描述」→ error fn 形态非法；「模块无导出」→ warn 幽灵ACTIVE；「providerApi 方法名拼错」→ warn 对象缺方法；「未登记调用点」→ error 反向差集。顺带修复盲区⑤（后端无路由时不再跳过 fn 校验）。

- 现象：`check-api-contract.cjs` 全程以登记表为出发点；① fn 夹描述后缀（如 `filesApi.read (二进制流)`）触发 FN\_CHAIN\_RE 豁免 → ACTIVE 幽灵不报（`filesApi.ts` 实测无 read/list 导出）；② `模块.对象.方法` 只验第一层导出，providerApi 方法名拼错永不发现；③ MODULE\_FILES 5 项手工白名单（`agentRuntime` 为死映射），未映射模块静默 info 不失败；④ 登记 fn ≠ 真实消费入口（relayProxy 三条登记底层原语，`base/api/index.ts` 不导出 relayProxy，真入口是 `generate.ts` 门面）。

- 根因：R5（2026-08-22）为「防未来」设计的保守豁免规则，未把「源码实际 HTTP 调用点 → 登记表」做反向对账；`MODULE_FILES` 靠人手同步真源。

- 为何现在不动：实测全量对账后确认无红色级路径失配（L3 收口已清），暴露面以登记语义错位为主；改造非紧急，需按 `docs/103-api契约校验盲区与全量扫描-审计与演进-2026-09-04.md` §4 顺序（先 4.2 fn 数据形态清洗，再 4.3 反向方向 D）分 commit 做，避免盲区打开的瞬时噪音与误伤。

- 建议处理时机：下次动 check-api / apiRegistry 时一并；或新端点登记重复出现"漏登记→info 才暴露"时优先。

- 登记于：2026-09-04 · 来源：系统治理（apiRegistry 白名单盲区研究）

#### TD-1 实施记录（2026-09-04，docs/103 §4 全量）

- **4.1** `check-api-contract.cjs` 废除 `MODULE_FILES` 手工白名单 → `buildModuleIndex()` 目录自动发现（base/api/\*.ts 文件名 + 全仓 src 导出符号双索引，删 `agentRuntime` 死映射）。

- **4.2** `FN_CHAIN_RE` 改严格形态（`^[\w$]+(\.[\w$]+)*$`，允许单符号模块如 `useLocalToolStatus`）；ACTIVE 的 fn 夹描述 → error（描述移入 registry `note` 字段）；新增 `extractConstObjectKeys` 两层校验（`模块.对象.方法` 同时验对象字面量含方法）。`fileRead` 修假登记 → RESERVED（前端零消费）。

- **4.3** 新增 `scanFrontendCallSites` 反向方向 D：源码 `httpRequest/httpPost/httpRequestLogged` 字面量调用点 → 登记表差集；未登记 → error，任意 URL 下载 / 非 `/api/` 前缀豁免，变量化 helper → info 显式标注。

- **4.4** relayProxy 三条 ACTIVE 新增 `consumer` 字段（`generate.generateImage/generateVideo/chatCompletions/chatStream` 门面），原语 + 门面双查。

- **同步**：`contracts.ts apiRegistry` 形态注释补 `note?/consumer?` 字段说明；`docs/28-R5` 补「盲区审计见 103」指针。

### \[TD-2] apiRegistry 登记滞后：后端已实现 5 条路由未登记 + `filesApi.list` 白登记
- 归类：已还 · 利息率：中（登记滞后，前端零消费） · 偿还计划(owner)：已结清（2026-09-04，补登 5 条 + 改占位）

- 状态：\[已解决 2026-09-04] —— 已在 `contracts.ts apiRegistry` 补登 5 条（`logsStream` ACTIVE/sse、`localPatchCrop|Merge|Fingerprint` + `gatewayTask` RESERVED/code-data），并把 `filesList.fn` 从幽灵的 `filesApi.list` 改为占位形态 `'(前端零消费·未实现)'`（对齐既有 RESERVED 条目惯例）。`check:api` info 13 → 8，登记 55 → 60 条，error/warn 仍 0。**注意：TD-1（免责豁免洞）本身未解决**，本条只清其暴露面。

- 现象：`npm run check:api` 输出 info 级 6 项 —— ① 后端有、前端未登记：`[GET] /api/logs/stream`、`[GET] /api/v1/gateway/task/{x}+`、`[POST] /api/local-patch/crop|merge|fingerprint`；② `fn缺失(保留待实现): filesApi.list`（`filesApi` 模块实测无 `list` 导出）。error/warn 均为 0，故不阻断构建。

- 根因：登记表为单向手工维护，后端新增路由无强制回写闸；TD-1 的保守豁免使 info 级不失败，滞后可长期静默。

- 为何现在不动：滞后项均为工具/探测类端点，前端零消费，不影响运行时；改登记表属施工动作，需与 TD-1 的 fn 形态清洗一起做，避免两次改同一文件产生冲突。

- 建议处理时机：与 TD-1 同批次处理；或新增后端路由时顺手补登记。

- 登记于：2026-09-04 · 来源：系统治理（全身体检 Step 3，check:api 取证）

### \[TD-3] `scripts/sync-mapping.mjs` 是假入口：目标文件已不存在
- 归类：已还 · 利息率：低（死脚本） · 偿还计划(owner)：已结清（2026-09-04 git rm + 删 npm script）

- 状态：\[已解决 2026-09-04] —— 已 `git rm scripts/sync-mapping.mjs` + 删 `npm run sync:mapping` + 删 `scripts/README.md` 对应行；`npm run build` + `test:smoke` 验证通过。节点中文名→英文 type 的唯一真源仍为 `contracts.ts NODE_TYPES`（无需替代脚本）。

- 现象：npm script `sync:mapping → node scripts/sync-mapping.mjs`，脚本用途为"同步 `docs/node-types-map.md`"，但该文件**已不存在**（CLAUDE.md 头部已注明"不存 `docs/node-types-map.md`"）。脚本仍挂在 `package.json`，跑即无意义或报错。

- 根因：节点类型真源收口到 `contracts.ts NODE_TYPES` 后，旧映射文档下线，但脚本与 npm script 未同步清理。

- 为何现在不动：属删除动作（删脚本 + 删 npm script），治理不擅自动删除；且需先确认是否有人工使用习惯（改指 `contracts.ts` 也是一种处理方向）。

- 建议处理时机：下次清理 scripts 或调整 npm scripts 时一并。

- 登记于：2026-09-04 · 来源：系统治理（全身体检 Step 1/3）

### \[TD-4] `spec/CONTEXT.md` §红线仍把已退役的 `/api/proxy` 系列列为保护对象
- 归类：已还 · 利息率：低（文档红线误导） · 偿还计划(owner)：已结清（2026-09-04 追加失效说明，未删原句）

- 状态：\[已解决 2026-09-04] —— 已按「追加失效说明」处理（**未删原句**）：在 `spec/CONTEXT.md` §169 原红线下方补 `⚠️ 已失效 2026-09-03（生成入口收口）` 段，写明三项退役、新行为（统一 `POST /api/generate` + `config.ts apiBase`）、仍有效的四项，并点明代码里的「旧 /api/proxy 已退役」注释是留痕而非待恢复项。

- 现象：`spec/CONTEXT.md:169`「字符串契约零损伤」条目仍列 `proxyMode=local-tool`、`/api/proxy`、`x-proxy-url`，与 `CLAUDE.md` §5.4.4 / §5.7「2026-09-03 收口退役、禁止恢复」矛盾。后续 AI 读 CONTEXT 会被误导去"保护"已死契约。

- 根因：2026-09-03 生成入口收口时只更新了 CLAUDE.md，未同步 CONTEXT 对应条目（跨文件决策同步漏项）。

- 为何现在不动：按 CLAUDE §5.2，过时言论要删必须一并写明"为何过时/新行为是什么"，属内容性修改（非删码），需用户确认措辞后再动。

- 建议处理时机：下次改 CONTEXT §五 或动代理/转发链路时，按"追加已失效说明"方式修正。

- 登记于：2026-09-04 · 来源：系统治理（全身体检 Step 5）

### \[TD-5] 4 个 ≥1490 行的主力模块，职责过宽（浅模块/大模块信号）
- 归类：增债（**复利中，但已认领 owner · 持平决策已入账**） · 利息率：高（核心链路大模块，单点改动回归成本极高） · 偿还计划(owner)：**架构师（2026-09-11 认领）**——下次要在这几个文件做较大改动前，先转「架构5步法」评估切分；已为每文件立「暂不切分」红线理由（见下）。

- 状态：**[持平已入账 2026-09-11]（重测行数 + 6 文件红线理由 + 认领 owner；不再是无主复利）**

- **重测（2026-09-11，`wc -l`，与账本数字一致）**：`VideoProcessNode.tsx` 2089 · `src/App.tsx` 1619 · `GridSplitNode.tsx` 1236 · `useCanvasAgentTools.ts` 1817 · `scriptBoxEngine.ts` 2156 · `AgentPanel.tsx` 1899（合计 10816 行）。数字准确，无需修正。

- **每文件「暂不切分」红线理由（持平决策，须入账）**：
  1. `VideoProcessNode.tsx`(2089)：视频处理主流程，状态/时间线/转码耦合高，拆分需先抽 `timelineTracks` 子模块且回归面极大 → **持平**；红线：新功能优先下沉到 `nodes/videoProcess/` 子模块，禁止在本文件顶部堆新顶层 state。
  2. `src/App.tsx`(1619)：组合根（provider 装配 + 路由壳），拆组合根本身价值低 → **持平**；红线：只做薄装配，新业务面板不得塞进 App，须抽到 `panels/`。
  3. `GridSplitNode.tsx`(1236)：临界体积，helper 已较独立 → **持平**；红线：超过 1500 行即触发强制抽取（先提 `useGridSplitLogic`）。
  4. `useCanvasAgentTools.ts`(1817)：Agent 工具 hook，按工具分发、耦合在 store → **持平**；红线：新增工具走 `agent/tools/*` 注册，勿在 hook 内加分支。
  5. `scriptBoxEngine.ts`(2156)：剧本引擎，内部已按阶段分区（解析/生成/校验）→ **持平**；红线：保持「单文件内分区」现状，拆分仅当某分区 >800 行。
  6. `AgentPanel.tsx`(1899)：面板聚合，子面板可抽但当前稳定 → **持平**；红线：新增子面板走 `panels/agent/*`，不扩主文件。
  - **统一护栏**：上述文件任何「较大改动」前须先跑 `check:health` + 该文件单测；若某次改动已自然抽出子模块，更新本红线阈值。持平≠不监控。


- 现象：`VideoProcessNode.tsx` 1635 行 → 实测 **2089** 行；`src/App.tsx` 1537 → **1619**；`GridSplitNode.tsx` 1027 → **1236**（三处均在复利增长，原登记数字已失真）。原登记路径也已失效：`useCanvasAgentTools.ts` 实为 `src/components/agent/canvas/useCanvasAgentTools.ts`（**1817** 行）、`scriptBoxEngine.ts` 实为 `src/components/scriptbox/scriptBoxEngine.ts`（**2156** 行）、`AgentPanel.tsx` 实为 `src/components/panels/AgentPanel.tsx`（**1899** 行）。单点改动影响面大、回归成本高，且体积持续膨胀。

- 根因：功能持续叠加，未按"架构5步法"做过职责切分；引擎/面板类文件天生易膨胀。

- 为何现在不动：治理层只标信号、不越级触发翻新；是否拆分属架构决策，且这些文件当前全绿（类型检查 + 测试通过），拆分收益/风险需用户权衡。

- 建议处理时机：下次要在这几个文件里做较大功能改动时，先转"架构5步法"评估切分。

- 登记于：2026-09-04 · 来源：系统治理（全身体检 Step 4）

### \[TD-6] `Temp/` 占 809M：多个一次性实验工程未清理
- 归类：已还 · 利息率：低（磁盘/搜索噪声） · 偿还计划(owner)：已结清（2026-09-04 删 4 工程，809M→1.3M）

- 状态：\[已解决 2026-09-04] —— 已删 4 个一次性实验工程 `three-js-editor`(386M) / `3d-studio`(310M) / `monoform-previs-studio`(83M) / `webglstudio`(28M)，`Temp/` 809M → **1.3M**。保留：全部 `deepening-*.md`、`governance-*.md`、`re-explore-收口`、小工具 `diag_*.mjs`、`keyframe-animation-tool` / `prisma-3d` / `bak` / `_unused`（合计约 1.3M，有决策价值或体量可忽略）。

- 现象：`Temp/` 曾占 809M —— `three-js-editor` 386M、`3d-studio` 310M、`monoform-previs-studio` 83M、`webglstudio` 28M（另有一批 `deepening-*.md` 一次性分析文档）。目录已 gitignore，不进仓库，但实占磁盘且会干扰全仓 grep（本次取证多次被 `Temp/*` 的 lock/报告污染）。

- 根因：实验/参考工程直接落在工作区 `Temp/` 下，用完未归档或删除。

- 为何现在不动：删除属破坏性操作，且可能仍有参考价值；需用户点名哪些可删。

- 建议处理时机：磁盘紧张或下次做全仓搜索被噪声干扰时，按子目录逐个确认清理。

- 登记于：2026-09-04 · 来源：系统治理（全身体检 Step 1）

### \[TD-7] `STORAGE_KEYS.backend` 三态（local/kv/native）无法表达「KV 主通道 + localStorage 降级副本 + 独立超时」形态

- 状态：**[已解决 2026-09-11]（拍板选方案A并实施）**
- 归类：增债（已还） · 利息率：中（存储地基） · 偿还计划(owner)：架构师 · 已于 2026-09-11 选 A 结清

- 现象：`d3dPersistence.ts` 无法走 `contentStore`，必须绕过（裸调 `kvGet/kvSet` 带独立 `KV_TIMEOUT` + `sGet/sSet` 降级副本）。`contentStore` 内建的 `writeKvWithFallback` 无独立超时、且 P2-F1 成功后清副本——与 d3d 的「双通道」形态语义冲突。

- 根因：`STORAGE_KEYS.backend` 枚举三态只表达了「落哪个后端」，表达不了 d3d 这种「KV 主通道 + local 降级副本 + 独立超时」的组合形态。

- **真选项（带成本，需拍板）**：
  - **方案A（推荐）：为 STORAGE_KEYS entry 增加可选 `fallback?` / `timeout?` 字段**（向后兼容，老 entry 不受影响）。`d3dPersistence` 收编进 `contentStore`，由它统一走「KV 主通道 + local 降级副本 + 独立超时」。`contentStore.writeKvWithFallback` 支持 per-entry 超时且不盲目清副本。成本：扩展 `contracts.ts` STORAGE_KEYS 契约 + 改 `d3dPersistence` 写回约 1 处；利息中，且消除裸调点、恢复单一实现。
  - **方案B：引入第四态 `kv+local`**。需在状态机/读写路径全链路新增分支，影响所有 storage 调用方；成本高、利息高，且「第四态」语义一旦定错会波及全仓库——**不推荐**。
  - **方案C：维持现状（d3d 继续裸调）**。债持续复利，违反「存储单一实现」原则，每次 storage 重构都要记得绕开 d3d——**不推荐**。

- 建议处理时机：已无需；仅当后续新增第三后端（如 remote）时，在 contentStore 内另起 `backends/` 小节扩展，勿回退到裸调。

- **实施记录（2026-09-11 · 方案A 落地）**：
  - `contracts.ts` `StorageKeyMeta` 新增 `fallback?` / `timeout?` 两个 per-key 选项（向后兼容，老 entry 不受影响）；`director3d-project` 与 `director3d-project-{nodeId}` 登记 `backend:'kv' + fallback:true + timeout:KV_TIMEOUT`。
  - `contentStore.ts` 新增 `resolveMeta(key)` 读取 per-key 选项；`writeKvWithFallback` / `readKvWithFallback` 支持 per-key 独立超时，且 `fallback=true` 时 KV 成功后**保留**本地降级副本（不再盲目 `sRemove`）；导出 `contentSetKvWithFallback` / `contentGetKvWithFallback` 双通道原语（写入返回实际落点 `kv|local`，读取返回 `{value, from}` 供迁移判定）。
  - `d3dPersistence.ts` 的 `writeProject` / `hydrateProject` 改为委托上述原语，**彻底移除裸调 `kvGet/kvSet/sGet/sSet/withTimeout`**，双通道形态由唯一登记表驱动；跨窗口冲突提示、广播、`local→KV` 一次性迁移等语义原样保留。
  - 回归测试：`tests/unit/d3dPersistence.td7.test.ts`（5 用例）锁死「d3d 走 contentStore 单源 + 登记表 fallback/timeout」；`tsc --noEmit` 0 错，d3d / contentStore 测试全绿（共 71+5）。

- 登记于：2026-09-04 · 来源：存储板块中间层折叠（storage-fold，方案 §3.Phase 3）；2026-09-11 架构师审计补真选项 + 拍板方案A

### \[TD-8] `node.data` 无单一契约真源：同一节点的 data 形状由五处各自表述，结果字段语义靠读侧启发式兜底

- 状态：**部分解决（2026-09-11）**——「字段声明失真」类已收口（详见文末「TD-8 实施记录」）；**未解决**：① `nodeDataSchema` 单源表仍未立（五处各自表述的骨架没变）、② 结果字段语义仍靠读侧 `genericOutput` 启发式兜底、③ 节点写回分散——原「9 个节点无 `patchData`（手写 `setNodes` 写回）」经 2026-09-11 复核**严重误报**：实际仅 `videoProcessNode`(9 处裸写回/2089 行高风险) 与 `assetNode`(走 `replaceNodeImage` 助手，已单源化) 为特例保留；`imageBoxNode`/`gridSplitNode`/`gridMergeNode` 已于 2026-09-11 收口为 `useNodeData().patchData`，`textGenerateNode`/`videoGenerateNode` 早在各自文件用 `useNodeData`（工具漏判），`scriptBoxNode` 走引擎机制（详见残留①）。

- 现象：同一节点的 data 由五处分别定义，彼此无对账——① `NodePalette.ts` palette `data:{}`（新建默认）、② 各节点文件本地 `interface XxxData`、③ `useConnectedInputs.ts` 的 `NODE_OUTPUTS` + `genericOutput`（读上游产出）、④ `nodeDefaults.ts`（只补结构，不碰 data）、⑤ `projectStore.sanitizeNodes`（node 级白名单，data 整包透传）。后果两类：
  **（a）字段声明失真 ——【已解决 2026-09-11，见实施记录】**：原状为 16 个节点 data interface 全带 `[key: string]: unknown` 索引签名，写错字段名无编译期拦截（首轮实测 `GridSplitNode.data.imageUrl` 未声明、读取处只能 `as string | undefined` 硬转；`VideoProcessNode` 写 `outputName/outputInfo` 不在 interface）。新行为：索引签名已全删，`npm run check:node-data` 对「索引签名回退」硬拦。
  **（b）结果字段语义靠读侧启发式 ——【未解决】**：`genericOutput` 用「`imageUrl` > `videoUrl` > `resultUrl` 优先级 + 扩展名判型」兜底猜产出，写侧各写各的字段名（`gifResult`/`extractedImages`/`images[]`/`rows` 等），猜错即静默空产出（无报错）。

- 根因：节点体系早期按「一个节点一个文件、字段自由」批量复刻，从未建立 data 契约登记表；后来 `useNodeData`（写回）与 `mediaType`（判型）各自收口，但**数据结构本身**始终无单源。收口只收了口径（怎么写），没收形状（写什么）。

- 为何现在不动：属架构级改动（要引出 `nodeDataSchema` 单源表 + 由它派生 palette 默认值 / 读侧产出声明 / dev 期校验），改动面覆盖 17 个节点 + 快照兼容；且当前**无运行时报错**（读侧启发式事实上接住了大多数情形），优先级低于功能开发。需先评审「schema 单源 vs 维持现状」再动。

- 现有量化工具（已落地，勿重复造）：`npm run check:node-data`（`scripts/check-node-data.mjs`）——三张表：字段缺口（interface / palette 默认 / 本节点自写，已区分「子节点规格」「跨节点写」两类非自身字段）、结果字段命名（写侧 vs 读侧是否认识）、读写路径分布；另出「清空遗留字段」清单与「豁免表过期」自检。**已以 `--strict` 挂 `npm run check:health`**（字段缺口 ≠ 0 或结果字段读侧不认 ≠ 0 即失败，下次缺口再涨会被体检拦下）；不挂 prebuild/pretest。本节点自用的例外走脚本内 `RESULT_EXEMPT`（须带原因，且自动校验是否过期）。

- 首轮体检结果（2026-09-11，可作为后续收口基线）：字段缺口 13 处 → 已修 13 处（本节点 interface 补声明 5：`GridSplitNode`+`ScriptBoxNode` 改 extends 真源、`VideoProcessNode`+3；palette 幽灵默认值删 3：`assetNode.images`、`videoProcessNode.trimStart/trimEnd`、`expanded` 注入范围收窄到 `INPUT_PANEL_NODE_TYPES`）；**残留**：结果字段读侧不认 3（`videoProcessNode` 的 `gifResult/outputName/outputInfo`，经 spawn 子节点交付，属 CONTEXT §五审计豁免）、清空遗留字段 5（`assetNode.imageUrl/url`、`videoProcessNode.errorMessage/videoUrl/audioUrl`）、无 `patchData` 的节点 10 个（M5 手写 `setNodes` 写回靶子清单）。

- 建议处理时机：① 下次要在 ≥3 个节点同时加/改结果字段时（先立 schema 再改，避免又一次五处同改）；② 清理「清空遗留字段」与「无 patchData 节点」时一并（两者同属 M5 类的剩余面）；③ 若 `check-node-data` 的缺口数在后续迭代中重新上涨，说明当前「各节点自持」模式不可持续，即为动 schema 的信号。

- **残留子项（须各自认领 owner，`check:node-data --strict` 已自动盯防缺口回涨）**：
  - **残留① 无 `patchData` 节点 —— 2026-09-11 复核后大幅修正（原「8 个」清单严重过期）**：
    - ✅ **本轮已收口（手写 `setNodes` 写回 → `useNodeData().patchData`，与 `patchNodeDataById` 逐字等价、0 行为变化；均带单测守门，`tsc`+测试全绿）**：`imageBoxNode`（1 处样板 → 删 `useReactFlow`+手写 `updateData`）、`gridSplitNode`（5 处）、`gridMergeNode`（2 处）。
    - ⚠️ **清单误报，本已收敛（非债，移出清单）**：`textGenerateNode` / `videoGenerateNode` —— 全文早已 `const { patchData, patchDebounced } = useNodeData(id)`（各自 79/111 行）；`check:node-data` 的「无 patchData」启发式漏判了它们（与残留② 同机制：工具只看「是否直接出现 `patchData` 字面」，误把已收口节点标成无）。
    - ℹ️ **非手写靶子，跳过**：`scriptBoxNode` —— 全文 0 处 `setNodes`/`useNodeData`，写回走 `scriptBoxEngine` 引擎机制，不属本清单。
    - 🔶 **剩余真债（刻意保留，非遗漏）**：
      · `videoProcessNode`（9 处裸 `setNodes`，2089 行高风险）—— 按 TD-5 红线「新功能下沉子模块、禁止顶部堆新顶层 state」，本轮不动；owner=videoProcess 负责人，下次大改时一并收口。
      · `assetNode` —— 写回委托 `replaceNodeImage({...}, setNodes, ...)` 共享助手（已是单源助手，非逐节点样板）；保留现状，仅在重构该助手时顺带收口。
    - **结论**：残留① 实际可清的「逐节点手写 setNodes 样板」已全部清零（imageBox/gridSplit/gridMerge）；剩余 videoProcessNode/assetNode 为「高风险 / 已助手化」特例，按红线保留。**与残留② 同理**——`check:node-data` 的「无 patchData」判定有漏判（误把已用 `useNodeData` 的节点标成无），**不能作为唯一依据，改动前须人工核对实际写回机制**。
  - **残留② 清空遗留字段 —— 2026-09-11 复核后修正（原「5 个」为误报，实际仅 2 个真死）**：
    - ✅ 已清（真遗留死写）：`videoProcessNode.videoUrl` / `videoProcessNode.audioUrl` —— 该 interface 从未声明、无任何读取，只在两处 `setNodes` 补丁里被写 `undefined`（旧设计残留）。已于 2026-09-11 删除这两处死写（`VideoProcessNode.tsx` 约 1096/1255 行），`tsc` + `check:node-data` 全绿。
    - ⚠️ `check:node-data` 仍列 3 个「写 undefined」实为用户字段，**非债，保留**：
      · `assetNode.imageUrl`（活跃：写回 + `data.imageUrl || data.url` 读取渲染）；
      · `assetNode.url`（**刻意存量兼容层** docs/118 §7.3 ⑤：防旧快照破图，读兼容、写唯一）；
      · `videoProcessNode.errorMessage`（活跃：成功/取消后置 `undefined` 是正常清错，JSX 实时渲染错误信息）。
    - 结论：`check:node-data` 的「清空遗留字段」启发式对「运行时正常置 undefined」有**误报**，不能作为删除依据；删除前须人工确认 interface 声明 + 实际读取面。残留② 实际可清项已清零。

- 登记于：2026-09-11 · 来源：写码时发现（node.data 契约对账首轮普查）

#### TD-8 实施记录（2026-09-11，L2「写路径收口到真类型」）

- **做了什么**：把 16 个节点 data interface 的 `[key: string]: unknown` 索引签名全删（`AssetNode`/`ImageBoxNode`/`GridSplitNode`/`GridMergeNode`/`PanoramaNode`/`Director3DNode`/`FaceMosaicNode`/`LoopNode`/`VideoExtractNode`/`VideoProcessNode`/`GroupNode`/`ScriptBoxNode`/`TextGenerate`/`ImageGenerate`/`TemplateNode`/`VideoGenerate`）。探针先行：先删 `GridSplitNode` 一个 → `tsc` 零错误，才推全量；全量删除后仅 **5 处**编译错误（远比预期小），逐个修完后 src+tests 双 `tsc` 全绿。

- **删索引签名逼出来的真实问题（都是它原本掩盖的）**：
  ① `ImageGenerate` 下载兜底读 `data.name`（该节点 data 无 `name`，恒 `undefined`）——被索引签名 + `as` 掩盖成"看起来有兜底"，已删死分支；
  ② `ScriptBoxCallbacks`（回调真源）漏登 **5 个**引擎实际注入的回调（`onGenerateAssetImage`/`onGenerateAllAssetImages`/`onStopScriptItem`/`onRetryAssetImageUpload`/`onUploadAllAssetImages`/`onUploadAssetImage`/`onPickAssetImage` 中的漏项）——已按引擎注入点补齐真源；
  ③ `StepShots`/`StepAssets` 各自重抄了一份 callbacks 子集接口（各带索引签名）——已删，统一引用 `ScriptBoxCallbacks`；
  ④ `useGenerateNode` / `useScriptBoxEngine` 的 `data?: Record<string, unknown>` 会反向逼节点加回索引签名——改 `data?: object` + 就地收窄（各 1 处）。

- **配套护栏**：`check-node-data` 新增「索引签名回退」检查（表1），命中即计入缺口 → `--strict` 下 `check:health` 失败。负例已验证会红。

- **验证**：`type-check`（src + tests）0 错；`test:unit` 187 文件 / 2400 用例全绿；`check:health` ✅ 无错误。

- **教训（给后续 AI）**：① 索引签名的真实代价平时看不出来，**只有在 `tests/tsconfig` 也参与类型检查时才暴露**（本次 6 个回调漏登错误只出现在 tests 配置里）；② 删索引签名的成本远低于直觉（16 文件 → 5 错误），"怕改动大所以不收"的假设不成立；③ 真源类型（`ScriptBoxTop`/`ScriptBoxCallbacks`）本身也会漏登，收口时要顺手对账真源 vs 实际写入点。

### \[TD-9] FaceMosaicNode 手动上传的图片不落盘：`data.imageUrls` 有声明有默认值，但从不写回 → 刷新丢手传图
- 归类：部分还 · 利息率：中（输入落盘语义） · 偿还计划(owner)：主体已结清（2026-09-11 口径 A）；独立项见 TD-10

- 状态：**主体已解决（2026-09-11，口径 A）** —— `FaceMosaicNode` 上传即写回 `data.imageUrls`（只写持久 URL）+ 2 条契约测试；遗留见文末附件（`blob:` 类入口维持会话内不落盘；`ImageBoxNode` base64 属独立项，另立）。

- 现象：`FaceMosaicNode.data.imageUrls` 在 palette 有默认 `[]`、组件用 `useState(data.imageUrls || [])` 初始化读，但 `onUpload` 只 `setLocalImages(...)`，**全库无任何写回点**。后果：手动上传的图（`uploadFileToLocal` 成功时是持久 `/files/canvas/face_mosaic/...` URL）刷新后消失；上游连线来的图不受影响（每次实时读 `connected`）。

- 根因：本节点定位是「输入 → 打码 → 结果 spawn `assetNode` 子节点」，输入被当成一次性素材（对齐 CONTEXT §五 审计豁免只保证「结果」不丢）；但接口 + palette 默认值又声明了 `imageUrls`，暗示过「要记住上传源」——**声明与行为不一致**（同批体检已删掉本节点另外 3 个同类幽灵字段 `resultUrls`/`resultInfo`/`errorMessage`，它们确认只是预览态）。

- 为何现在不动：属**行为决策**——「输入用完即弃」vs「输入也要持久」。且落盘有边界：`previewUrls.create(file)` 降级出的 `blob:` URL 不可持久（刷新即死链），只能写回非 `blob:` 的持久 URL，需要写成「过滤后写回」而不是无脑写。

- 建议处理时机：① 用户反馈「打码节点上传的图刷新没了」时立即做；② 或与其它节点（如 VideoExtractNode 同样读 `data.videoUrl` 当输入源）一起统一「输入源是否随快照落盘」的口径时做——**口径要一次定，别只改一个节点**。

- 登记于：2026-09-11 · 来源：写码时发现（node.data 契约对账 → 确认 FaceMosaic 结果字段语义时顺带发现）

#### TD-9 附件：上传入口 × 落盘口径清单（2026-09-11 普查，供一次定全局口径）

普查范围：`src/components/nodes/` 下所有 `type="file"` 入口（9 个节点）。

| 节点 | 上传 handler | 上传物去向 | 刷新后 | 存储形态 |
| --- | --- | --- | --- | --- |
| `AssetNode` | 上传/拖入/粘贴 | `replaceNodeImage` → `data.imageUrl` | ✔ 保留 | `/files/` 持久 URL（落盘失败回退内联 dataURL） |
| `ImageGenerate` | `handleRefFileSelect` | `patchData({images})` | ✔ 保留 | `/files/`（`resolveNodeImageUrl`）——**正确样板** |
| `ImageBoxNode` | `onFileInput`→`addImages`→`updateData` | `data.images` | ✔ 保留 | **base64 整图 dataURL**（`fileToDataUrl` 直存）→ 快照膨胀 |
| `VideoProcessNode` | `onUpload` | `data.sourceVideoUrl/sourceVideoName` | ✔ 保留 | 上游/落盘 URL |
| `FaceMosaicNode` | `onUpload` | 仅本地 `localImages` | ✗ 丢 → ✔ 已修 | **已产出 `/files/` 持久 URL，只是没写回** → 现写回 `data.imageUrls`（见文末「落地」） |
| `TextGenerate` | `uploadImage` | 仅本地 `images` state | ✗ 丢 | `previewUrls.create` → `blob:`；`data.images` 保留为**注入通道** |
| `VideoExtractNode` | `onUpload` | 仅本地 `videoUrl/videoName` state | ✗ 丢 | `previewUrls.create` → `blob:`；`data.videoUrl/videoName` 保留为**注入通道** |
| `TemplateNode` | `() => showToast('上传处理')` | 无 | — | 模板样例占位，未实现 |
| `VideoGenerate` | **input 无 `onChange`** | 无 | — | 死入口（= docs/119 §五 L1）—— **已修 2026-09-11：删除无意义死上传入口，节点无「节点内上传」语义** |

**判据（2026-09-11 修正 —— 来自本轮踩坑，按字段性质分两类，别看「有没有写入方」一刀切）**：
- **结果类字段**（本节点产出：`faceMosaic.resultUrls/resultInfo/errorMessage`）：**必须有本节点写入方**，否则就是"读了永远拿不到的默认值"→ **删**。已删。
- **输入类字段**（外部可预置：`videoExtract.videoUrl/videoName`、`textGenerate.images`、`faceMosaic.imageUrls`）：**允许作为「只读注入通道」存在**（零内部写入方 ≠ 该删）。
  ⚠️ **踩坑记录**：本轮曾按"全库零写入方"把 `videoExtract.videoUrl/videoName` 删掉，**直接打断 6 个测试的预置入口**（该文件 6 个用例全靠 `data:{videoUrl}` 给节点喂视频源；Agent 的 `update_node_any_field` 也能写）→ 已回退，改为在 interface 注释里标明"注入通道、本节点不写回"。
  另：palette 的空默认值（如 `videoUrl: ''`）有额外作用 —— 让 `get_node_details` 能看到该字段，等于**向 AI 声明入口存在**，不要顺手删。

**口径定稿**：
- **落地 A**：`FaceMosaicNode.onUpload` 落盘成功即写回 `data.imageUrls`（只写非 `blob:` 的持久 URL）；配套 2 条契约测试（成功写回 / 落入 blob 兜底时不写回）。
- **不做 B**：`blob:` 入口改走 `uploadFileToLocal` —— 代价是上传耗时段 + 磁盘占用，等真实用户反馈再评估。
- **放弃 C**：一刀切删声明 —— 输入类字段是既存注入通道（测试/Agent 都在用），删了是静默砍能力。

**独立项（不属本口径，另立）**：`ImageBoxNode` 把整张 base64 存进 `data.images[].url` → 与 §5.4.9「图像入节点落盘策略唯一实现（`filesApi`）」不符，属快照膨胀问题，应在下次动图片盒子时单独收口。

- 登记于：2026-09-11 · 来源：写码时发现（node.data 契约对账 → 确认 FaceMosaic 结果字段语义时顺带发现）

### \[TD-10] ImageBoxNode 把整张图片 base64 直存 `data.images[].url` → 快照膨胀 + 违反落盘唯一实现契约

- 状态：**[已解决 2026-09-11]** —— 已把 `readFiles` 从「File→dataURL 直存」改为委托 `filesApi.resolveNodeImageUrl`（§5.4.9 File 源唯一落盘策略：multipart 直传 → 持久 `/files/` URL，仅极端失败才兜底 dataURL），`addImages` 只把持久 URL 写进 `node.data.images[].url`。新增回归测试锁死「禁止 dataURL 内联」（`tests/unit/ImageBoxNode.test.tsx` TD-10 用例）。`tsc --noEmit` 0 错、ImageBoxNode 14 测试全绿。
- 现象：`ImageBoxNode.tsx:299` `readFiles` 用 `fileToDataUrl(f)` 把上传/粘贴/拖入的图片读成完整 base64 dataURL，经 `addImages` 写进节点 `data.images[].url`（`ImageBoxNode.tsx:289/310/334`）。快照序列化时整张图以 dataURL 内联进 `node.data`，节点/项目文件随图片数量与尺寸线性膨胀，加载与 diff 成本上升。
- 根因：绕过 CLAUDE.md §5.4.9「图像入节点落盘策略唯一实现（`filesApi`）」契约——该契约规定 dataURL 源应走 `filesApi.saveInlineToLocal`（立即上屏 → 落盘 `/files/` → 成功才换持久 URL），禁止把整图 dataURL 塞进节点 data。本节点早于收口或漏改，自写一套直存。
- 归类：增债（历史产生，本期登记） · **利息率：中**（边缘功能，但膨胀作用于全局快照读写，影响保存/加载/历史对比全链路）· **已还**（债清，回归测试看守）
- 为何当时不动：属独立项（不属 TD-9 的输入落盘口径）；当前渲染正常、不报错，仅快照体积问题；改它会触及上传/粘贴/拖入三条入口与 `addImages` 写回，需与「图片盒子」相关改动同批，避免孤立改一处。
- 偿还计划（owner：架构师 · 已于 2026-09-11 结清）：把 `readFiles` 的 dataURL 直存改为委托 `filesApi.resolveNodeImageUrl`，`addImages` 只存持久 `/files/` URL（参照 `AssetNode`/`useAssetDropPaste` 已收口出口）；`data.images[].url` 类型契约保持 `string`（持久 URL 与极端 dataURL 兜底均合法，未做假收窄）。
- 建议处理时机：已无需，债已清；仅当后续发现快照仍含内联时复查 `resolveNodeImageUrl` 落盘失败兜底路径。
- 登记于：2026-09-11 · 来源：架构师审计（TD-9 附件「独立项」正式立项）

### \[TD-11] VideoGenerateNode 上传 input 无 `onChange` → 死入口（选择文件无任何反应）

- 状态：**[已解决 2026-09-11]（决策：删除死入口，不实现上传路径）**
- 归类：增债（已还） · 利息率：中 · 偿还计划(owner)：架构师 · 已于 2026-09-11 结清
- 现象（修复前）：`VideoGenerateNode` 的 `HoverToolbar` 带一个「上传图片、视频或音频素材」按钮 → 触发隐藏 `<input type="file">`，但该 input 没有 `onChange` 处理器，用户选择文件后既不上屏、也不写回 `data`，是复刻时从别的节点错带进来的死入口。
- 根因：① 早期复刻时把「上传」按钮/input 模板整段搬入，但本节点从未绑定 `onChange`；② 更根本——**该节点本就没有「节点内上传」的语义**：参考图来源是「连线上游产出（useConnectedInputs）+ 提示词里 `@{id:label}` 素材芯片（resolvePromptChips）」两条既有通道，节点本地再开一条上传落盘路径既冗余又无消费方。死入口错在「误以为该节点需要上传」，而非「漏绑事件」。
- **修复决策（2026-09-11，经确认）**：不做「选择文件 → 写回 data + 上屏」式实现（那会凭空造一条无语义的平行上传通道）；直接**删除死入口**——移除 `HoverToolbar` 的 upload 按钮、`fileRef`、隐藏 `<input type="file">` 及 `onUpload` 处理器（共 4 处）。节点参考图能力由既有两条通道完整覆盖，删除后零功能损失。
- 验证：`tsc --noEmit` 0 错；`grep fileRef|onUpload|Plus|type="file"` 在该文件 0 命中（无悬挂引用）；lint 0 警告。
- 登记于：2026-09-11 · 来源：架构师审计（TD-9 附件普查「死入口」正式立项）

### \[TD-13] 云同步「下载云端」直写 contentStore / providerApi 但不触发各 store 内存态 rehydrate → KV 新值、内存旧值（SSOT 裂痕）
- 状态：**待处理**
- 归类：增债（历史缺口） · 利息率：中（个人单机配置域，刷新即恢复、无丢数据，但「下载后配置不一致」是真实 SSOT 裂痕） · 偿还计划(owner)：架构师
- 现象：手动路径 `App.tsx:535` 下载成功后 `setTimeout(() => window.location.reload(), 1200)` 用**整页 reload** 兜底；自动路径 `autoSync.ts:65` 显式「绝不 reload」（正确，不该冲掉正在画的画布）→ 自动下载的账号/设置/Skill/provider 配置 **KV 是新值、内存态是旧值**，toast 自承「部分设置刷新后生效」，直至手动刷新才一致。
- 根因：各 store（accountsStore / appSettings / skillStore / providerStore 等）是「模块级内存态 + `useSyncExternalStore`」，只在 `load()` 时从 contentStore 读一次，此后内存态即 UI 唯一真源，且**不订阅 contentStore 的 KV 变更**；`cloudSync.restoreLocal / downloadConfig` 直写 contentStore / providerApi 后**无 store rehydrate 钩子** → 「末端收敛」没做（甩给用户「刷新后生效」）。属 store 边界缺口，非 reload 补丁问题。
- 为何现在不动：属 store 边界改造（给多 store 加 `reload` 入口 + 改手动/自动两路下载调用），且自动路径「绝不 reload」刻意保留（避免冲画布），改坏风险在中；当前个人单机、刷新即恢复，利息中。
- 建议处理时机：下次动云同步 / store 层时一并；或用户反馈「自动下载后某设置没生效」时优先。
- 偿还计划（owner：架构师）：给 `accountsStore/appSettings/skillStore/providerStore` 各暴露 `reload()` 入口；`cloudSync.downloadConfig` 成功后（手动 + 自动两路复用）统一精准 rehydrate，替换手动路径的 `window.location.reload()` 末端补丁；补「下载后内存态与 KV 一致」单测防回归。
- 登记于：2026-09-11 · 来源：架构师审计（区域 02 存储/持久化，F1）

### \[TD-12] 云同步（cloudSync）数据流：末端静默吞错 + projects 真相源裂痕

- 状态：**已解决 2026-09-11**（[F-云B]/[F-云A]/[F-云C] 全部结清）
- 归类：增债（历史产生，本期登记） · **利息率：高**（核心链路：云备份/恢复是用户数据安全的最后一道，sync 静默失败 = 用户误信"已备/已恢复"）· **已还 [F-云B]/[F-云A]/[F-云C]**
- 现象（修复前）：① `restoreLocal` / `collectLocalData` 四处理想 `catch{/* ignore */}` / `catch{/* skip */}`——下载某域写失败仍返回 `ok:true`，用户被告知"恢复成功"但数据没回来；上传某域读取失败则悄悄不上传，包是残缺的却当完整报。② `projects` 被云同步收集（经 localStorage 直读）又在 `restoreLocal` 走 `saveProjects` 写回 localTool backend，而 app 内 `projectStore` 以内存态为唯一源 + 双写 backend，`contracts.ts:185` 登记 `store:'projectStore.js'`——云同步绕过 projectStore 造了第二真相源。
- 根因：① 云同步被设计成"尽力而为 ad-hoc 同步"，写/读失败视为可忽略，违反「错误必须真实透传」（CONTEXT 第一原则 + 架构铁律2）。这恰是 `projectStore`「根因修复」（projectStore.ts:177-202,244-249）反复踩的同一坑（saveProjects 静默失败）在 cloudSync 重演。② 把"有独立 backend 跨端真通道的领域实体（projects）"塞进通用 LS 同步循环，未走领域 store 边界收口。
- 为何当时不动（[F-云C]）：`CloudSyncEngine.callGateway` 的 `catch(err){ throw new Error(err.message) }` 把原错误类型/stack/network 压平成字符串，属 GAS 黑盒限制下的次要项；影响排障透明度，不阻断功能。
- 偿还计划（owner：架构师）：
  - **[F-云B] 已结清 2026-09-11**：`projects` 加入 `SYNC_EXCLUDE`（cloudSync.ts），从源头既不传也不收；删除 `restoreLocal` 里永远走不到的 `saveProjects(ls.projects)` 死路径、`getCurrentProjectId` 死函数、`project` 领域开关；测试侧锁定"上传包无 projects、下载零写回"（cloudSync.test.ts）。
  - **[F-云A] 已结清 2026-09-11**：`collectLocalData` 返回 `{ls, skipped}`、`restoreLocal` 返回 `{written, failed}`，失败域结构化汇聚并上抛；`uploadConfig`/`downloadConfig` 不再以 `ok:true` 掩盖（下载部分失败 → `ok:true` 带 `partial.failed`，全失败 → `ok:false`）；`TopNav`/`autoSync` 如实 `showToast` 告警（warning/error）；新增 2 条单测锁死。
  - **[F-云C] 已结清 2026-09-11**：`callGateway` 的 `catch(err){ throw new Error(err.message) }` 改为 `if (err instanceof Error) throw err; else throw new Error(..., { cause: err })`——原错误类型/stack/network 信息不再被压平成 message 字符串；新增单测锁死「网络失败原 TypeError 子类上浮」。
- 建议处理时机：[F-云C] 下次动 cloudSync 网关/错误分类时一并；其余已无需复查。
- 登记于：2026-09-11 · 来源：架构师数据流审计（用户对 Cloud 模块发起）

