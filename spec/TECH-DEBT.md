# spec/TECH-DEBT.md · 技术债登记（单一固定文件）

> **定位**：全仓库唯一的技术债留痕文件。由「系统治理5步法」Step 7 主动追加，也可由任何 AI 在发现"现在不能动、但确是债"时追加。**单一文件、只追加、不分散、不建 ADR**（CLAUDE.md 决策铁律）。
> **读者**：下一个 AI。目的是让债可见、不被聊天淹没、不被误删。
> **不写**：备选方案否决理由（属决策过程，不落盘）；讲"为什么这么设计"的注释不挪到这里（留原处）。

## 登记格式

每条债固定结构（复制追加，不删既有条）：

```
### [TD-<序号>] <一句话现象>
- 状态：待处理 / [已解决 <日期>]
- 现象：<现在观察到的问题>
- 根因：<为何产生 / 是哪个前置闸门漏了>
- 为何现在不动：<风险 / 依赖 / 时机未到>
- 建议处理时机：<什么条件下再动>
- 登记于：<日期> · 来源：<系统治理 / 写码时发现>
```

**防膨胀规则**：债还清后**标记** **`[已解决 <日期>]`** **而非删除**（保留"曾是什么坑"的决策价值）；本文件只追加、只标状态，不整体清空。`Temp/governance-*.md` 是一次性快照，可过期清理，非权威。

## 已登记债

### \[TD-1] apiRegistry 校验只有登记表侧，白名单/fn 豁免洞致「前端真实调用」方向零覆盖

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

- 状态：\[已解决 2026-09-04] —— 已在 `contracts.ts apiRegistry` 补登 5 条（`logsStream` ACTIVE/sse、`localPatchCrop|Merge|Fingerprint` + `gatewayTask` RESERVED/code-data），并把 `filesList.fn` 从幽灵的 `filesApi.list` 改为占位形态 `'(前端零消费·未实现)'`（对齐既有 RESERVED 条目惯例）。`check:api` info 13 → 8，登记 55 → 60 条，error/warn 仍 0。**注意：TD-1（免责豁免洞）本身未解决**，本条只清其暴露面。

- 现象：`npm run check:api` 输出 info 级 6 项 —— ① 后端有、前端未登记：`[GET] /api/logs/stream`、`[GET] /api/v1/gateway/task/{x}+`、`[POST] /api/local-patch/crop|merge|fingerprint`；② `fn缺失(保留待实现): filesApi.list`（`filesApi` 模块实测无 `list` 导出）。error/warn 均为 0，故不阻断构建。

- 根因：登记表为单向手工维护，后端新增路由无强制回写闸；TD-1 的保守豁免使 info 级不失败，滞后可长期静默。

- 为何现在不动：滞后项均为工具/探测类端点，前端零消费，不影响运行时；改登记表属施工动作，需与 TD-1 的 fn 形态清洗一起做，避免两次改同一文件产生冲突。

- 建议处理时机：与 TD-1 同批次处理；或新增后端路由时顺手补登记。

- 登记于：2026-09-04 · 来源：系统治理（全身体检 Step 3，check:api 取证）

### \[TD-3] `scripts/sync-mapping.mjs` 是假入口：目标文件已不存在

- 状态：\[已解决 2026-09-04] —— 已 `git rm scripts/sync-mapping.mjs` + 删 `npm run sync:mapping` + 删 `scripts/README.md` 对应行；`npm run build` + `test:smoke` 验证通过。节点中文名→英文 type 的唯一真源仍为 `contracts.ts NODE_TYPES`（无需替代脚本）。

- 现象：npm script `sync:mapping → node scripts/sync-mapping.mjs`，脚本用途为"同步 `docs/node-types-map.md`"，但该文件**已不存在**（CLAUDE.md 头部已注明"不存 `docs/node-types-map.md`"）。脚本仍挂在 `package.json`，跑即无意义或报错。

- 根因：节点类型真源收口到 `contracts.ts NODE_TYPES` 后，旧映射文档下线，但脚本与 npm script 未同步清理。

- 为何现在不动：属删除动作（删脚本 + 删 npm script），治理不擅自动删除；且需先确认是否有人工使用习惯（改指 `contracts.ts` 也是一种处理方向）。

- 建议处理时机：下次清理 scripts 或调整 npm scripts 时一并。

- 登记于：2026-09-04 · 来源：系统治理（全身体检 Step 1/3）

### \[TD-4] `spec/CONTEXT.md` §红线仍把已退役的 `/api/proxy` 系列列为保护对象

- 状态：\[已解决 2026-09-04] —— 已按「追加失效说明」处理（**未删原句**）：在 `spec/CONTEXT.md` §169 原红线下方补 `⚠️ 已失效 2026-09-03（生成入口收口）` 段，写明三项退役、新行为（统一 `POST /api/generate` + `config.ts apiBase`）、仍有效的四项，并点明代码里的「旧 /api/proxy 已退役」注释是留痕而非待恢复项。

- 现象：`spec/CONTEXT.md:169`「字符串契约零损伤」条目仍列 `proxyMode=local-tool`、`/api/proxy`、`x-proxy-url`，与 `CLAUDE.md` §5.4.4 / §5.7「2026-09-03 收口退役、禁止恢复」矛盾。后续 AI 读 CONTEXT 会被误导去"保护"已死契约。

- 根因：2026-09-03 生成入口收口时只更新了 CLAUDE.md，未同步 CONTEXT 对应条目（跨文件决策同步漏项）。

- 为何现在不动：按 CLAUDE §5.2，过时言论要删必须一并写明"为何过时/新行为是什么"，属内容性修改（非删码），需用户确认措辞后再动。

- 建议处理时机：下次改 CONTEXT §五 或动代理/转发链路时，按"追加已失效说明"方式修正。

- 登记于：2026-09-04 · 来源：系统治理（全身体检 Step 5）

### \[TD-5] 4 个 ≥1490 行的主力模块，职责过宽（浅模块/大模块信号）

- 状态：待处理

- 现象：`VideoProcessNode.tsx` 1635 行、`src/App.tsx` 1537 行、`useCanvasAgentTools.ts` 1507 行、`scriptBoxEngine.ts` 1493 行（另有 `AgentPanel.tsx` 1130、`GridSplitNode.tsx` 1027）。单点改动影响面大、回归成本高。

- 根因：功能持续叠加，未按"架构5步法"做过职责切分；引擎/面板类文件天生易膨胀。

- 为何现在不动：治理层只标信号、不越级触发翻新；是否拆分属架构决策，且这些文件当前全绿（类型检查 + 测试通过），拆分收益/风险需用户权衡。

- 建议处理时机：下次要在这几个文件里做较大功能改动时，先转"架构5步法"评估切分。

- 登记于：2026-09-04 · 来源：系统治理（全身体检 Step 4）

### \[TD-6] `Temp/` 占 809M：多个一次性实验工程未清理

- 状态：\[已解决 2026-09-04] —— 已删 4 个一次性实验工程 `three-js-editor`(386M) / `3d-studio`(310M) / `monoform-previs-studio`(83M) / `webglstudio`(28M)，`Temp/` 809M → **1.3M**。保留：全部 `deepening-*.md`、`governance-*.md`、`re-explore-收口`、小工具 `diag_*.mjs`、`keyframe-animation-tool` / `prisma-3d` / `bak` / `_unused`（合计约 1.3M，有决策价值或体量可忽略）。

- 现象：`Temp/` 曾占 809M —— `three-js-editor` 386M、`3d-studio` 310M、`monoform-previs-studio` 83M、`webglstudio` 28M（另有一批 `deepening-*.md` 一次性分析文档）。目录已 gitignore，不进仓库，但实占磁盘且会干扰全仓 grep（本次取证多次被 `Temp/*` 的 lock/报告污染）。

- 根因：实验/参考工程直接落在工作区 `Temp/` 下，用完未归档或删除。

- 为何现在不动：删除属破坏性操作，且可能仍有参考价值；需用户点名哪些可删。

- 建议处理时机：磁盘紧张或下次做全仓搜索被噪声干扰时，按子目录逐个确认清理。

- 登记于：2026-09-04 · 来源：系统治理（全身体检 Step 1）

