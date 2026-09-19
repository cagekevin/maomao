# TASK-031 · 裁判裁定（第二波 · `base` 域 + 全批终裁）

> **裁定人**：主 agent（裁判）· **日期**：2026-09-19
> **前置**：`TASK-030-裁定-第一波汇总裁定.md`（image/video/canvas/agent/scriptbox-settings-creative/hooks 六片）
> **本文件**：① 裁定 `base` 的 7 件送出 + 5 片；② 裁定 `base` 提的 7 个判据缺口；③ **全批终裁矩阵**（第二波不再派单，由裁判直接落判）。

---

## 一 · `base` 域（TASK-028）实测概况

96 件（84 源码 + 12 非代码）→ 真横切 50 · 宿主层 9 · **非横切件·应属 X 7** · 待核 18（16 被锁死 + 2 口径）· 非代码 12。

---

## 二 · 裁定 7 件送出（**全部认**，落点经裁判修正）

| # | 件 | 现位置 | 裁定落点 | 修正点 |
| --- | --- | --- | --- | --- |
| 1 | `canvasSyncBus.ts` | `base/core/` | `canvas/lib/` | 无 |
| 2 | `canvasNodesBridge.ts` | `base/media/` | `canvas/lib/` | 无 |
| 3 | `nodeMedia.ts` | `base/utils/media/` | `canvas/lib/` | 无 |
| 4 | `libraryBrowse.ts` | `base/media/` | **`resource/`（域根）** | 域主给"`resource/lib/`（备选域根）"；按 **D2 单件不建子目录** ⇒ 定域根 |
| 5 | `creative-library.css` | `base/panels/` | `creative/` | 无（前提：宿主层可依赖域，见裁定 §3-5） |
| 6 | `generationOrchestration.ts` | `base/store/` | **`generate/lib/`** | 域主给 `generate/lib/` ✓ |
| 7 | `Toggle.tsx` | `base/ui/form/` | **`settings/sections/`** | 域主给 settings ✓；按 D2 单件并进职责最近子目录 ⇒ `sections/` |

**第 1–3 件恰构成成片③（3 件 ≥ D2 门槛）** ⇒ `canvas/lib/` 一次到位。

### 🔴 裁判改判：成片②**拆两拨**（域主把 3 件整体给 `generate`，我拆分）

| 件 | 域主裁定 | **裁判改判** | 依据 |
| --- | --- | --- | --- |
| `generationOrchestration.ts` | `generate/lib/` | `generate/lib/` ✓ | 生成编排 |
| `nodeRuntimeStore.ts` | `generate/lib/` | **`task/`** | 任务是"生成任务"的生命周期行 |
| `taskCompletionBus.ts` | `generate/lib/` | **`task/`** | 计划 §3 **明写** `task/ = {taskStore, taskCompletionBus, TaskCenter}` |

⇒ 改判后 `task/` 域达标（`taskStore`+`taskCompletionBus`+`TaskCenter` = 3 件），`generate/lib/` 靠成片① 4 件达标。

### 成片①（生成链路 / AI 中继 4 件 · 960 行）—— **认，整片搬**
`base/api/{generate,relayProxy,pollTask}.ts` + `base/utils/imagePixel.ts` → `generate/lib/`
- **前置动作（必须）**：搬后 **摘 `base/api/index.ts` 的 `export * from './generate.ts'` 等 3 行**（域主已给"整片搬 + 桶摘 export"的方案）；`check-api-contract.cjs:175` 按**模块名**查导出 ⇒ 不受路径影响（已验）。

### 成片④（云同步 `cloudSync`+`autoSync`）· ⑤（`base/media/**` 9 件）—— **留原地**
- ④：实测 **0 业务域消费**（仅 App 装配 + 彼此）⇒ 不触发 L4。
- ⑤：`base/media/` = 协议层/域容器，**计划 §3 明列**，留。

### 成片⑥（图片媒体 9 件/1400 行）—— **不成立，标 G**
实测 `faceMosaic`/`imageUpscale` 已迁 `image/lib/`；`assetType`(9 域)·`assetUrl`(7 域)·`previewUrl`(3 域) 已是真横切；`imageCompress`·`useImageFallbackSrc`·`useMediaLoadFailed` 全被真横切件锁死。⇒ **TD-18-35 描述过期**。

---

## 三 · 裁定 `base` 的 7 个判据缺口

| # | 缺口 | 裁定 |
| --- | --- | --- |
| 1 | L3「≥3 域」是充分还是必要？13 件 0 域 · 3 件 2 域 | **2 域 + 零业务语义 ⇒ 归横切**（同 TASK-030 裁定 2）。**0 域件**：不触发 L4 ⇒ 维持；但**「0 域 + 无 App 装配消费」的登记为「待核（零消费·疑幽灵预留，ADR-0030）」** |
| 2 | barrel 中介导致 `refs` 系统性少报 fan-in | **采纳**：**经桶（`index.ts`）的消费计入域数**。⇒ 这条解释了我此前多次看到的"直连 1 处 / 实际 6 域"；**并要求后续所有域主按此口径复核** |
| 3 | 同形件（`agentKeys` / `videoEditorKeys` 键构造 SSOT）与 L4 冲突 | **采纳**：ADR-0040 补 **「契约原语 / 键构造 SSOT 例外」** ⇒ 留横切层。两件处置自洽 |
| 4 | `media` 不在目标域全集 | **不允许新立域名**；`base/media/` 作为协议层留原地（计划 §3 已列） |
| 5 | 宿主层可否依赖业务域样式 | **确认**（`panels` 已于 2026-09-19 改判宿主层·可依赖域）⇒ `base/panels/ImportMediaModal → creative/` 迁移后合法 |
| 6 | `videoEditor` 本批跳过 ⇒ 3 件无人认领 | **接受缺口**：`mediaRefTypes.ts`（判留）· `useMediaLoadFailed.ts`（锁死·留）· `videoEditor/ImportMediaModalHost.tsx`（**videoEditor 内部错位**，非 base 问题）⇒ 全部挂"待下一批" |
| 7 | D2 门槛下单件落点（`Toggle` / `libraryBrowse`） | **并进职责最近的现成子目录 / 域根**（已并入 §二表） |

---

## 四 · 🔴 全批终裁矩阵（第二波不派单 · 裁判直判）

### A · 跨域搬迁（**11 件**，全部已裁定，可直接执行）

| # | 件 | 从 | 到 | 依据 |
| --- | --- | --- | --- | --- |
| 1 | `backupStore.ts` | `canvas/`（域根） | `base/store/` | TASK-030 §二（全量 localStorage ≠ canvas） |
| 2 | `JianyingIcon.tsx` | `canvas/parts/` | `base/ui/` | TASK-030 §三（2 域 + 零业务语义） |
| 3 | `agentKeys.ts` | `base/core/` | `agent/runtime/` | 计划 §2 改判 + 实测 agent 5 / App 1 |
| 4 | `canvasSyncBus.ts` | `base/core/` | `canvas/lib/` | 本文件 §二 |
| 5 | `canvasNodesBridge.ts` | `base/media/` | `canvas/lib/` | 同上 |
| 6 | `nodeMedia.ts` | `base/utils/media/` | `canvas/lib/` | 同上 |
| 7 | `libraryBrowse.ts` | `base/media/` | `resource/` | 同上 |
| 8 | `creative-library.css` | `base/panels/` | `creative/` | 同上 |
| 9 | `generationOrchestration.ts` | `base/store/` | `generate/lib/` | 同上 |
| 10 | `nodeRuntimeStore.ts` · `taskCompletionBus.ts` | `base/store/` | `task/` | 裁判改判（计划 §3 明定 task 域） |
| 11 | `generate.ts` · `relayProxy.ts` · `pollTask.ts` · `imagePixel.ts` | `base/api` · `base/utils` | `generate/lib/` | 成片①（整片搬 + 桶摘 export） |

### B · 域内归位（**9 件**，零跨域风险）

| 件 | 从 | 到 | 域 |
| --- | --- | --- | --- |
| `useCopyNode.ts` · `useFitNodeRatio.ts` | `image/`（域根） | `image/hooks/`（新建） | image |
| `editors/cameraStudio.ts` | `image/editors/` | `image/editors/cameraParams/` | image |
| `agentTypes.ts` · `conversation/conversationTypes.ts` · `assistantTable/tableWorkspaceTypes.ts` | 三处散置 | `agent/contract/`（新建） | agent |

### C · 清理项
- 删 3 个 `.DS_Store`（`agent/` · `video/` · `creative/`）

### D · 闸/文档同步（**搬迁时必须同批做，否则假红**）
1. **`check-arch.mjs:1480` 规则 11 白名单**：`src/components/canvas/backupStore.ts` → `src/components/base/store/backupStore.ts`
2. **`check-arch.mjs` 规则 11 白名单**：`base/store/cloudSync.ts` 不变（未搬）
3. `base/api/index.ts`：摘掉搬到 `generate/lib/` 的 3 行 `export *`
4. 债回改：`TD-25-21`（处置有误）· `TD-25-11` / `TD-18-37` / `TD-18-35` / `TD-25-15` / `TD-25-17` / `TD-25-22` / `TD-18-36`（**均已偿或已过期** ⇒ resolve）· `TD-18-34`（描述过期）
5. 计划 §A5 行（删 `editors/index.ts`）**推翻** · §A6 行（`captureFrame`）**标过期**

### E · 明确不搬（登记为"已复核，维持"）
- `src/hooks/` **8 件全留**（TASK-030 §六）
- `base/store/{cloudSync,autoSync}` · `base/media/**` · `base/core/{agentKeys→已改判, videoEditorKeys}` · `base/utils/captureFrame` · `imageCompress` · `base/store/{taskStore,appSettings}`（§0.5 已裁）· `base/core/interaction/uiHooks.ts` 及 16 件被锁死件

---

## 五 · 执行顺序（裁判执行 · 逐域串行 · 每批后验证）

1. **批 1 · 域内归位（9 件）** → `npx tsc --noEmit` + `node scripts/check-arch.mjs`
2. **批 2 · 跨域（11 件）** → 同批同步闸白名单 + 桶摘 export → 同一套验证
3. **批 3 · 清理 + 台账回改/落账** → 删 `.DS_Store` · 债 resolve · 计划/闸回改 · 区域日志

**每批后验证门槛**：`tsc` 0 错 · `check-arch` 全绿 · 涉及节点的跑 `npm run build`（闸组 6 道）。

---

## 六 · 本轮已知缺口（接受 · 记录在案）

- `videoEditor/**`(259) · `director3d/**`(30)：**按用户裁定跳过** ⇒ 其内部错位无覆盖；`videoEditor/ImportMediaModalHost.tsx` 是其中一例。
- `src/hooks/` 的 L4 归属：已裁定（TASK-030 §六），但**尚未写进 ADR** —— 待落到 `docs/adr/`。
- 6 个新判据（L4-bis · 2 域件口径 · 契约原语例外 · 经桶计域 · 类型件随域/集中 · 域存在性门槛）**目前只在本裁定 + TASK-030 里**，未入 ADR。

---

# 附 · 执行记录（裁判自执行 · 2026-09-19）

> 工具：`node scripts/mv-sync-refs.mjs move <old> <new>`（逐件，未用 `move-dir`）。共 **21 个文件**（18 搬迁 + 3 清理）。

## 附-1 · 域内归位（6 件 · 零跨域风险 · 第一批）

| # | 件 | 从 | 到 |
| --- | --- | --- | --- |
| 1 | `useCopyNode.ts` | `image/`（域根散件） | `image/hooks/`（**新建**，落实 D3 增 `hooks/` 职责名） |
| 2 | `useFitNodeRatio.ts` | `image/`（域根散件） | `image/hooks/` |
| 3 | `cameraStudio.ts` | `image/editors/` | `image/editors/cameraParams/`（F-4 裁定：D2 优先） |
| 4 | `agentTypes.ts` | `agent/`（域根散件） | `agent/contract/`（**新建**） |
| 5 | `conversationTypes.ts` | `agent/conversation/` | `agent/contract/` |
| 6 | `tableWorkspaceTypes.ts` | `agent/assistantTable/` | `agent/contract/` |

## 附-2 · 跨域搬迁（12 件 · 三批）

| # | 件 | 从 | 到 | 裁定出处 |
| --- | --- | --- | --- | --- |
| 7 | `backupStore.ts` | `canvas/`（域根） | `base/store/` | TASK-030 §二（全量 localStorage ≠ canvas；推翻 TD-25-21） |
| 8 | `JianyingIcon.tsx` | `canvas/parts/` | `base/ui/` | TASK-030 §三（2 域件口径） |
| 9 | `agentKeys.ts` | `base/core/` | `agent/runtime/` | 计划 §2 改判 |
| 10 | `canvasSyncBus.ts` | `base/core/` | `canvas/lib/` | 成片③ |
| 11 | `canvasNodesBridge.ts` | `base/media/` | `canvas/lib/` | 成片③ |
| 12 | `nodeMedia.ts` | `base/utils/media/` | `canvas/lib/` | 成片③ |
| 13 | `libraryBrowse.ts` | `base/media/` | `resource/`（域根，D2 单件不建子目录） | TASK-031 §二 |
| 14 | `creative-library.css` | `base/panels/` | `creative/` | TASK-031 §二 |
| 15 | `generationOrchestration.ts` | `base/store/` | `generate/lib/` | 成片② |
| 16 | `nodeRuntimeStore.ts` | `base/store/` | `task/` | **裁判改判**（计划 §3 明定 task 域） |
| 17 | `taskCompletionBus.ts` | `base/store/` | `task/` | 同上 |
| 18 | `generate.ts` · `relayProxy.ts` · `pollTask.ts` · `imagePixel.ts` | `base/api` · `base/utils` | `generate/lib/` | 成片①（4 件，整片搬） |

> 附-2 实为 **15 个文件**（第 18 行含 4 件）。

## 附-3 · 清理（3 件）

`src/components/{agent,video,creative}/.DS_Store` — macOS OS 元数据，非源码件。

## 附-4 · 🔴 闸 / 白名单 / 桶 同步（**搬迁必做，否则假红**）

| # | 位置 | 动作 | 为什么 |
| --- | --- | --- | --- |
| 1 | `scripts/check-arch.mjs` 规则 11 白名单（`GETLOCALKEYS_LEGIT`） | `canvas/backupStore.ts` → `base/store/backupStore.ts` | 该件是新落点下的合法 `getLocalKeys()` 消费者；不同步 ⇒ 闸**假红**（实测报红 1 处） |
| 2 | `scripts/strict-src-whitelist.json` | 新增 `canvas/lib/` · `generate/lib/` · `task/` | 这三个新目录**收了原本受白名单覆盖的件**（`base/core`·`base/api`·`base/utils`·`base/store` 来的）⇒ 不同步则覆盖静默缩水（2026-09-19 已发生过一次 15→4 件） |
| 3 | `src/components/base/api/index.ts` | **摘掉 3 行** `export * from '…/generate' · '…/pollTask'` | 桶若继续 re-export 迁出件 ⇒ 横切层 `base/api` 反向依赖业务域 `generate` ⇒ 规则 2 **报红 2 处**（实测）；消费者改指 `@/components/generate/lib/*` |
| 4 | 测试随搬迁同步（4 处） | `mediaRef.test.ts` 路径 · `nodeImageWrite.test.ts` 路径 · `logger.test.ts` 清单+断言 · `mockPartialSpread.test.ts` `WATCHED` 正则 | 全是**测试里写死旧路径 / 断言比实际窄**（同一 B 类成因）。`WATCHED` 原要求 `\.tsx?$`，而同步工具产出仓库主导的**无后缀**写法 ⇒ 扫描基数假性掉到 <195（假绿） |
| 5 | `tests/unit/generate.test.ts` barrel 契约断言 | 改为「桶不再导出生成门面 + 门面由 `generate/lib/generate` 提供」 | 契约**因裁定而变**，断言须随之更新（不是回退） |

## 附-5 · 验证结果（全部实测 · 未含推断）

| 检查 | 命令 | 结果 |
| --- | --- | --- |
| 类型 | `npx tsc --noEmit` | **0 错**（摘桶后一度 16 错，全部随消费者改指清零） |
| 架构闸 | `node scripts/check-arch.mjs` | **✅ 通过**（含「未发现会 TDZ 的循环依赖」·「横切层无反向依赖业务域」） |
| build 闸组 | `node scripts/gates-run.mjs build` | **✅ 6 道全过** |
| strict-src | `node scripts/check-strict-src.mjs` | **✅ 白名单 20 目录 0 隐式 any** |
| 单测 | `npx vitest run` | 搬迁引入 4 个失败 ⇒ **全部修好复验通过**（logger 22/22） |

## 附-6 · 未处理（如实登记）

1. **死代码闸（push 阶段）基线漂移**：8 条新增 / 12 条消失。其中**本次搬迁造成 2 条**（`nodeMedia` · `nodeRuntimeStore` 路径变化 = 改名 churn），其余 6 条为历史遗留（`promptChips` 早期搬迁 · `flushPersist` 改名 · `kvStore` 删壳 · `videoEditor` 2 条）。按该闸自述禁令**不得**用 `--update-baseline` 把新增塞进基线 ⇒ 需逐条裁决（删 / 标 `@public` / 仅改基线内路径）。
2. **单测剩 1 个失败**：`tests/unit/vePanelLayoutContract.test.ts`（videoEditor 面板纵向分区契约 TD-22-50）—— 属**本批跳过域**，与本次搬迁无关。
3. **`videoEditor`(259) · `director3d`(30)**：按用户裁定跳过 ⇒ 域内错位无人扫（已知缺口）。
4. **`base/api/index.ts` 头注第 9 行**仍写「已收 7 件：httpClient/pollTask/generate/localToolApi/filesApi」—— 其中 `pollTask`/`generate` 已迁出，该行属**描述过期（G）**，待随文档层回改。
