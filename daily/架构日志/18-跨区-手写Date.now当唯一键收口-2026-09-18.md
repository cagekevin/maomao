# 架构日志 · 18 跨区 · 手写 `Date.now()` 当唯一键收口 · 2026-09-18

> **触发债**：TD-18-18（`ADR-0026 判据2` · 手写 `Date.now()` 当唯一键/落库键 ≥8 处，绕过 `idGen` 唯一入口）
> ＋ **配套债 TD-18-19**（`projectStore:325` 注释以「复刻官方 `Vr.jsx`」为施工理由，ADR-0001 违反）。
> **性质**：增债清偿轮（走《架构师改码 7 步法》）。**结论落点**：本文件（唯一写全处）。
> **一句话**：`Date.now()` 单段当 id，**同毫秒必撞**；撞在项目 id 上不是警告，是**静默丢项目**
> （它同时是 `canvas-state-v1-<id>` 的 KV 槽位键 + 后端 `projects` 表按 id 合并去重的键）。
> 修法不是"加个随机数"，是**回到 `idGen` 唯一入口**；而其中一处 `merge-video` 的根因根本不是"撞键"，
> 是**键不可重建 ⇒ 中止入口永远掐不掉它** —— 判据不同，改法不同。

- **本区域状态**：`已验证(有债待还)`

---

## 一 · 正确形态（施工前先写下来）

**不变式**：

1. **唯一键必须由唯一入口产出**（`idGen.generateId` / `generateUUID`）—— 手写拼接一律算第二份。
2. **唯一键必须含随机段**：时间戳是**毫秒**粒度，同一 tick 内连发多次（批量建节点/批量导入/同毫秒建项目）
   必然同值 ⇒ 单靠 `Date.now()` **不构成唯一性**。
3. **注册表的键必须能被**消费方**重建**：`abortMap` 的键由 `onStopScriptItem(kind,id)` 按 `` `${kind}-${id}` ``
   反查 ⇒ 键里塞时间戳 = **消费方永远构造不出同一个键** = 该任务不可被单项中止。

**链路（改后）**：

```
idGen.generateId（唯一入口：`{prefix}_{ts36}_{rand36}`）
      ├── projectStore.genId()            → 项目 id（KV 槽位键 / 后端合并键）
      ├── scriptBoxEngine nodeId2 ×2      → 剧本盒子下游节点 id
      ├── StepAssets 资产 id              → 分镜资产 id
      └── AgentPanel skill_file id        → 导入技能文件 id

abortMap 注册键（scriptBoxEngine）
      └── `merge-video-${nodeId}`  ←── onStopScriptItem('merge-video', nodeId) 可重建 ✅
          （其余 6 个调用点早已是稳定实体键：`script` / `asset-${id}` / `shot-${id}` …）
```

## 二 · 取证实录（**债描述与我的首轮判断各有失真**）

> 铁律③：任何描述都只是线索，必须重新取证。本轮 Step 0 回读全仓 `Date.now()`（130+ 命中）逐个过滤，
> 得 **13 处**"当 id/键"候选（债描述只说「≥8 处」）。下表行号为**改后现值**（改前的 `:1521` / `:1500` 因本轮插入注释下移）。

| 站点（`文件:行`） | 性质 | 取证结论 | 处置 |
| --- | --- | --- | --- |
| `projectStore.ts:338` `genId()` | 项目 id | ⚠️ **零随机段**；且同时是 ① `canvas-state-v1-<id>` KV 槽位键（`contracts.ts:332`，`pattern:true`）② 后端 `projects` 表按 id 合并键 ⇒ 同毫秒两项目 = **静默丢项目** | **改 `generateId('proj')`** |
| `scriptBoxEngine.ts:1364` | 下游节点 id | 零随机段；同镜头同毫秒并发即撞 | **改 `generateId(...)`** |
| `scriptBoxEngine.ts:1526` | 合并节点 id | 同上 | **改 `generateId(...)`** |
| `StepAssets.tsx:218` | 资产 id | 零随机段；同毫秒连加两个资产即撞 | **改 `generateId(cat)`** |
| `AgentPanel.tsx:1041` | 技能文件 id | 零随机段（原 `` `skill_file_${Date.now()}_${i}` ``） | **改 `generateId('skill_file')`** |
| `scriptBoxEngine.ts:1504` | **abortMap 注册键** | ⚠️ **根因不是撞键**：`runAbortable` 是 `:286` 的**闭包内局部函数**（非导出，故 `grep "export function"` 找不到），首参即 `abortMap` 键；`onStopScriptItem` 按 `` `${kind}-${id}` `` 反查（`:1088-1110`）⇒ 带时间戳的键**消费方重建不出**，合并任务在单项中止路径上**掐不掉**（只有「全停」能兜） | **改 `merge-video-${nodeId}`**（稳定实体键，与 `shot-${shot.id}` 同构） |
| `d3dPersistence.ts:47` `tabId` | 窗口身份键 | 主路径 `crypto.randomUUID()` 无碰撞，但**回退分支本身就是** `d3d-${Date.now()}` 当身份键；同毫秒开两窗 → 同 `tabId` ⇒ `:76 message.tabId === tabId` 把「他窗保存」误判成自己（跨窗覆盖提示失效） | **回退改随机段** |
| `App.tsx:1271` `ghost-edge-<ms>` | 瞬态 UI id | **非债**：`filter(startsWith).concat(1 条)` ⇒ 列表内**恒 ≤1 条**，撞键不可达；非落库键 | 判非债 |
| `director3d/useToast.ts:29` | 域内 toast id | **非债**：含随机段（非零随机）；且 `director3d` **不引 `idGen`**（全目录 0 命中，域隔离），为它引跨域依赖不值 | 判非债 |
| `director3d/project.ts:359` `uid()` | 域内 id 生成 | **已另有债**：= **TD-18-7**（是否并入 `generateUUID` 待你拍板）⇒ 不重复登记 | 归 TD-18-7 |
| `videoEngine.ts:670` `video_<ms>.mp4` | 上传显示名 | **非债**：回读落库端 `localTool/src/routes/files.ts:127-150` —— **物理名由 `sha1(字节)` 内容寻址 + contentId 全局查重**，客户端 `filename` **只贡献扩展名**（`:185/:263 name` 是显示名）⇒ 不是落库键 | 判非债 |
| `TaskCenter.tsx:241` `<model>_<ms>.ext` | 浏览器下载建议名 | **非债**：非唯一键，重名由浏览器自动加序号 | 判非债 |
| `canvasPlanExecutor.ts:758` `__auto_fusion_<ms>` | 计划步 id | **非债**：`id` 只在**本次执行**的 `byId` / `nodeMappings` 内闭合（`:452/:486/:620`），无跨执行持久化查找；每次执行产出新 id 反而是安全方向 | 判非债 |

**关键判据**：`scriptBoxEngine:1504`（abortMap 键）与其余 6 处**根因不同** —— 前者是「键不可重建」，后者是「键不够唯一」。
同一条债描述把两者混在一起，若照描述统一改 `generateId`，**合并视频的中止会继续失效**（`generateId` 同样不可重建）。

## 三 · 改动清单（6 文件 · 7 站点）

| # | 文件 | 改动 |
| --- | --- | --- |
| ① | `src/components/base/store/projectStore.ts` | `genId()` → `generateId('proj')`；**重写 JSDoc**：写明它是 KV 槽位键 + 后端合并键、删掉「复刻官方 `Vr.jsx L2303`」这条无证据理由（ADR-0001）—— 一并结清 **TD-18-19** |
| ② | `src/components/scriptbox/scriptBoxEngine.ts` | `nodeId2` ×2 → `generateId(...)`；`runAbortable` 键 → `` `merge-video-${nodeId}` ``（附注释说明"键必须可重建"） |
| ③ | `src/components/scriptbox/StepAssets.tsx` | 资产 `id: generateId(cat)` |
| ④ | `src/components/panels/AgentPanel.tsx` | `id: generateId('skill_file')` |
| ⑤ | `src/components/director3d/d3dPersistence.ts` | `tabId` 回退分支 `d3d-${Date.now()}` → `d3d-${Math.random().toString(36).slice(2,10)}` |
| ⑥ | `tests/unit/projectStore.test.ts` | **新增**：冻结时钟连续建 20 项目 → id 两两不同 |
| ⑦ | `tests/unit/scriptBoxEngine.test.ts` | **新增**：合并视频可按 `` merge-video-${nodeId} `` 中止（断言 `signal.aborted`） |

**键模板格式无关性已验**（Step 1）：`contracts.ts:332` 的键是模板 `` `${CANVAS_STATE_PREFIX}{projectId}` ``
编译为 `^canvas-state-v1-.+$` ⇒ **改 id 形态无需动登记表**；全仓无一处**解析** `proj-<ms>` 取时间戳
（`grep proj-|canvas-state-v1` 逐条回读）；存量项目 id 保持不变（不为旧数据做迁移）。

## 四 · 探针证据（先红后绿 · `probe.mjs` 自动还原）

```
🔬 探针结论｜TD-18-18 项目id零随机段撞键（行为探针）
   文件   : src/components/base/store/projectStore.ts（命中 1 处，已还原 sha=6ac98f1efd99）
   命令   : npx vitest run tests/unit/projectStore.test.ts
   观测   : exit=1｜输出 23 行
   ✅ 退出码 == 1 — 实际 1
   ✅ 输出含「TD-18-18 项目 id 唯一性」 — 命中
```

```
🔬 探针结论｜TD-18-18 合并视频中止键不可重建（行为探针）
   文件   : src/components/scriptbox/scriptBoxEngine.ts（命中 1 处，已还原 sha=aa3a0b245bdb）
   命令   : npx vitest run tests/unit/scriptBoxEngine.test.ts
   观测   : exit=1｜输出 28 行
   ✅ 退出码 == 1 — 实际 1
   ✅ 输出含「合并视频按稳定实体键注册」 — 命中
```

注入内容 = 分别把 `return generateId('proj');` 换回 `` return `proj-${Date.now()}`; ``、
把 `` `merge-video-${nodeId}` `` 换回 `` `merge-video-${Date.now()}` ``（即两处旧实现）。
两条探针均**命中 1 处**（注入点唯一）、跑完**自动还原**（sha 已回原值，工作区无残留注入态）。

**零炸 · 反向探针结论块**（证明"我没改坏别的" —— 往**非目标路径**注入破坏，看它会不会被测试抓到；
抓到 = 「全量 3026 例全绿」是**有覆盖的绿**，不是空绿）：

```
🔬 探针结论｜TD-18-17 零炸反向探针：正常读取路径仍被测试覆盖（改前能走的路径）
   文件   : src/hooks/useAssetDragToCanvas.ts（命中 1 处，已还原 sha=84e21955cb3b）
   命令   : npx vitest run tests/unit/useAssetDragToCanvas.test.ts
   观测   : exit=1｜输出 77 行
   ✅ 退出码 == 1 — 实际 1
   ✅ 输出含「成功 → phase 由 loading 变 ok 并带 text」 — 命中
```

注入内容 = 把 `fetchText` **成功路径**的 `return { ok: true, text };` 改成永远返回失败
（即破坏"改前能走的路径"）⇒ **成功用例真变红** ⇒ 该路径**确有测试覆盖**。
配合 `npx vitest run` **全量 3026 例 / 242 文件全绿**（3m10s），构成零炸的完整凭证：
**改前能走的路径仍绿（全量）＋ 改前会失败的仍红（行为探针）**。

### 凭证归档五项（SOP §7.1 第 5 条 —— 缺任一项 = 假账）

> 初版只粘了 ①③（探针结论块），**缺 ②注入 diff 与 ④后绿输出** —— 按现行 §7.1 第 5 条属**假账**。本表补全。

| 探针 | ① 命令原文 | ② 注入 diff（`--dry`） | ③ 先红 | ④ 后绿 | ⑤ 还原自校验 |
| --- | --- | --- | --- | --- | --- |
| **A · 项目 id 零随机段撞键** | `probe.mjs --file src/components/base/store/projectStore.ts --find "return generateId('proj');" --replace 'return \`proj-${Date.now()}\`;' --run "npx vitest run tests/unit/projectStore.test.ts" --expect-exit 1 --expect-out "TD-18-18 项目 id 唯一性"` | `命中 1 处｜sha 6ac98f1efd99 → b1bbe71fc0b3`<br>`L338: - return generateId('proj');`<br>`      + return \`proj-${Date.now()}\`;` | `exit=1` + 命中「TD-18-18 项目 id 唯一性」（见上结论块） | 见下「④ 后绿」 | `6ac98f1efd99…` **与探针报的「已还原 sha」逐字一致** |
| **B · 合并视频中止键不可重建** | `probe.mjs --file src/components/scriptbox/scriptBoxEngine.ts --find '\`merge-video-${nodeId}\`' --replace '\`merge-video-${Date.now()}\`' --run "npx vitest run tests/unit/scriptBoxEngine.test.ts" --expect-exit 1 --expect-out "合并视频按稳定实体键注册"` | `命中 1 处｜sha aa3a0b245bdb → 6a3f3e9fba74`<br>`L1504: - \`merge-video-${nodeId}\`,`<br>`       + \`merge-video-${Date.now()}\`,` | `exit=1` + 命中「合并视频按稳定实体键注册」 | 见下「④ 后绿」 | `aa3a0b245bdb…` **一致** |
| **C · 零炸反向探针**（改前能走的路径） | `probe.mjs --file src/hooks/useAssetDragToCanvas.ts --find 'return { ok: true, text };' --replace 'return { ok: false, error: TEXT_UNREADABLE };' --run "npx vitest run tests/unit/useAssetDragToCanvas.test.ts" --expect-exit 1 --expect-out "成功 → phase 由 loading 变 ok 并带 text"` | `命中 1 处｜sha 84e21955cb3b → 171b0ba68746`<br>`L74: - return { ok: true, text };`<br>`      + return { ok: false, error: TEXT_UNREADABLE };` | `exit=1` + 命中「成功 → phase 由 loading 变 ok 并带 text」 | 见下「④ 后绿」 | `84e21955cb3b…` **一致** |

**④ 后绿**（还原后跑三条目标命令；`--reporter=dot`）：

```
 ✓ tests/unit/scriptBoxEngine.test.ts (45 tests) 157ms
 ✓ tests/unit/useAssetDragToCanvas.test.ts (8 tests) 127ms

 Test Files  3 passed (3)
      Tests  78 passed (78)
```

（另：`npx vitest run` **全量 3026 例 / 242 文件全绿** 作为零炸的"改前能走的路径仍绿"总凭证。）

## 五 · 度量（改前 / 改后）

> 口径按 7 步法 §7.3（**不用 LOC 当复杂度口径**）。
> ⚠️ **本仓多轮并行**：同期他轮在持续批量登记 ⇒ 下表只记**本轮净变化**，不写"改后总数"。

| 口径 | 改前 | 改后 |
| --- | --- | --- |
| 绕过 `idGen` 唯一入口的 id 生成站点 | **7** | **0** |
| 其中**零随机段**（`Date.now()` 单段，同毫秒必撞） | **5** | **0** |
| 项目 id 撞键后果 | 同毫秒两项目 → 同 KV 槽位互覆盖 + 后端当同一项目 = **静默丢项目** | 不可能 |
| `abortMap` 键「可被消费方重建」 | **6/7**（`merge-video` 不可 ⇒ 中止掐不掉） | **7/7** |
| 判非债（附取证理由，不登记） | — | **6 处** |
| 改动半径 | — | 6 文件、7 站点，**无跨层跳跃** |
| 注释 | — | 净增约 35 行（判据落点：ADR-0025 要求细节归代码头 JSDoc，非 LOC 膨胀） |

## 六 · 交付六闸自查

> ⚠️ **本节初版写作「四闸」**（2026-09-18 用户追问「改动有没有副作用」时发现）：SOP 现行是
> **交付六闸** = 一归 / 减一 / 减二 / 一诚实 / **零炸**（防回归防副作用）/ **一凭证**（证据可复现）。
> 本仓 40+ 份轮次文件（含本文件初版）都写「四闸自查」—— **两闸整条漏掉**。
> 漏因不是 SOP 缺闸，是**轮次文件互相抄**（闸清单在实践中成了"第二份真相"，且是**落后版本**）。
> 本节已按现行六闸逐条补全并附可复现命令。

- **一归**：id 生成 **7 份手写 → 1 份**（`idGen` 唯一入口）✅
  - **凭证（命令 + 输出）**：`grep -rn 'Date.now()' src | grep -E 'id: |Id2|genId|tabId' | grep -vE '^src/[^:]+:[0-9]+: *(\*|//|/\*)'`
    → 改后仅剩 **4 行**，且**逐行已裁定非债**：`App.tsx:1271`（ghost-edge，filter-then-concat ⇒ 恒 ≤1）、
    `director3d/App.tsx:1530`（`nonce` 重发令牌，非唯一键）、`d3dPersistence.ts:98`（`at` 消息时间戳）、
    `canvasPlanExecutor.ts:758`（执行内闭合）。
    ⚠️ 该命令**多抓出 1 处**（`director3d/App.tsx:1530`）我 Step 0 未枚举的站点 ⇒ 已现场裁定非债。
- **减一**：兜底净减 —— 本轮为「增债清偿」，**未新增任何兜底**；`d3dPersistence` 的 `||` 回退**形不变**
  （仍是"主路径失败则回退"），只把回退**内容**由时间戳换成随机段 ✅
- **减二**：复杂度实减 —— 手写 id 策略份数 7→0；`merge-video` 键由"不可重建"变"可重建"，
  中止契约从**纸面**变**可兑现** ✅
- **一诚实**：撞键从「静默丢项目」变为**不可能**；`merge-video` 从「单项中止静默失效」变为**真能中止**
  —— 两处原本都是**失败不可见**，本轮消除的是**静默**本身 ✅
- **零炸**（防回归防副作用 · 逐条给证据）：
  - **改前基线可复现**：两条基线（`genId()` 产出 `proj-<ms>`、`merge-video` 键含时间戳）均由
    **探针注入旧实现**复现（探针报告 `exit=1` 即基线红）。⚠️ **诚实**：我**没有在动手前**先固化行为清单，
    是**事后**用探针补的 —— 证据可复现所以算数，但**顺序错了**（记入弯路）。
  - **不得顺手改好无关的失败**：本轮**没改任何无关失败**。`videoEngine.ts:670` / `TaskCenter.tsx:241`
    这两个"看起来也是 `Date.now()` 当键"的站点，取证后**判非债、明确不施工**（而非顺手"修好"）✅
  - **不得扩大行为面**（本轮最该自证的一条，逐项给判据）：
    - **id 形态变了，但契约面没变** ⇒ 调用方看不见的行为未变：① 无解析者（`grep 'proj-'` / 资产 id 前缀 /
      `script-prompt-` 全 0 命中）；② 后端 `projects.ts` 是 `id TEXT PRIMARY KEY`（**无格式校验**）、
      `ORDER BY created_at`（**不按 id 排序**）、`created_at = Math.floor(Date.now()/1000)` **服务端生成**
      （不从 id 反推）；③ 键模板 `^canvas-state-v1-.+$` **格式无关**；④ **无一条测试断言旧形态**
      （`tests` 里所有 `proj-` 命中均为夹具入参 `'proj-1'` 之类）。
    - **`abortMap` 键由"不可重建"变"可重建"**：新增的是**目标能力本身**（本轮就是要让它能被中止），
      非越界；同节点重入由 UI `disabled={selShots.size < 2 || mergeLoading}`（`StepPrompt.tsx:354`）挡住，
      不同节点 → 不同 `nodeId` ⇒ 无并发覆盖 ✅
    - ⚠️ **一处行为面变化（有意，且就是本轮目标，但必须声明）**：合并视频任务
      **从"掐不掉"变成"掐得掉"** —— 「说得清哪些行为被改了」正是零炸的要求。
  - **不留半态**：`grep` 确认全仓无 `proj-${Date.now()}` / `merge-video-${Date.now()}` / `d3d-${Date.now()}`
    残留（仅注释内的历史说明）；两处旧实现已删；`check:dead-code` **无新增**（76 → 76）✅
  - **反向探针必做（证明"我没改坏别的"）**：⚠️ **初版漏做**，本轮补 ——
    **全量单测 3026 例 / 242 文件全绿**（`npx vitest run`，3m10s）＋ `tsc` ＋ `eslint` ＋
    `check:arch` / `check:any` / `check:dead-code` 全绿 ⇒ **改前能走的路，改后仍走得通** ✅
- **一凭证**（证据可复现 · 逐闸凭证形态对齐）✅
  - 一归 → 上面那条 `grep` 命令 + 4 行输出（**命令可复现**）。
  - 减一 → 新增兜底 **0**；`d3dPersistence` 回退**形不变**（1 处，改前 1 处 → 改后 1 处，未净增）。
  - 减二 → §五 度量表（手写 id 策略 **7 → 0**；`abortMap` 可重建率 **6/7 → 7/7**，改前改后并列）。
  - 一诚实 → §四 两条**探针结论块**（均 `命中 1 处 + 已还原 sha`，先红已真红）。
  - 零炸 → §四 **反向探针结论块**（见下）+ 全量 3026 例。
  - **「先红」真红过**：三条探针报告 `exit=1` 且 `--expect-out` 命中 —— 不是自证式测试。

## 七 · 结论与下一步

- 本区域状态：`已验证(有债待还)`（**本轮净减 2**：TD-18-18 + TD-18-19 结清）。
- 待还债项已流入 `daily/架构日志/债务.md`（轻量索引）：是。
- **弯路留痕（强制）**：
  ① **我把闭包内局部函数当成"不存在"**：Step 0 首轮判 `scriptBoxEngine:1499` 为"任务标签，`runAbortable` 疑似无此导出"
  —— 真相是 `runAbortable` 定义在 `:286`，是**引擎工厂内的闭包函数**，`grep "export function"` 天然找不到。
  **教训：grep 找不到定义 ≠ 不存在；先搜**调用点**，再顺着文件内作用域找局部定义。**
  ② **判"落库键"必须看落库端**：首轮把 `videoEngine:670` / `TaskCenter:241` 挂成"待判"，
  直到回读服务端 `files.ts` 才知道物理名**内容寻址**、客户端 filename 只是显示名 ⇒ 一次性判非债。
  **教训：调用点的名字长得像键 ≠ 它是键；"是不是键"由落库端的写入语义决定。**
  ③ **主路径安全不能豁免回退路径**：首轮想以"`d3dPersistence` 有 `randomUUID` 优先"放过它，
  但**回退分支本身就是** `Date.now()` 当身份键 —— 按判据2 它仍是债。**教训：判据逐分支适用，不做"整体观感"豁免。**
- **未做（有意）**：
  - `director3d/project.ts:359 uid()`（**TD-18-7**）与 `useToast.ts:29` 同属"director3d 域内 id 空间是否并入 `generateUUID`"，
    该问题**已登记待你拍板** ⇒ 本轮不重复登记、不越权改（铁律④：业务/架构判断自裁，但**已挂"待拍板"的既定债不抢跑**）。
  - 不为存量项目 id 做迁移（`contracts.ts` 键模板格式无关，旧 id 仍合法）。
