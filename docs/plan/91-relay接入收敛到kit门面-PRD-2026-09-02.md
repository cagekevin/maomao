# 91-relay 接入收敛到 kit 门面 · PRD（升级 kit、不绕开、落盘最小侵入）

> 状态：PRD 编制中（第 1 层骨架 + M1 细化已确认；M2~M5 待细化）
> 日期：2026-09-02
> 关联：`docs/relay-kit-integration-plan.md`（早期总纲）、`docs/relay-kit-execution-plan.md`（A~E 执行）、`docs/90-生成链路-relay-轮询后端化-执行方案-2026-09-02.md`（R1~R7）、vendored `localTool/src/relay-engine/`（上游 `/Users/kevin/Downloads/ai-relay-kit`）
> 铁律（用户确认）：**绝不绕开 kit**；kit 已有能力就复用，缺的才加；**落盘不依赖 kit**（最小侵入）。

---

## 1. 定位与背景（第 1 层 · State 1）

### 1.1 问题
当前 relay 接入**绕开了 kit 的高级门面（`generate.*`）**，自建了 `relay-presets`（9004 协议声明表）+ 裸 executor（`relay-route.ts`/`relay-poll.ts`/`relay-common.ts`）这一层。用户判断：这等于"自己又做一份"，与"用 kit 这个通用中转引擎"背道而驰。

### 1.2 现状核查（可追溯依据）
- kit 本身是完整的声明式协议引擎，`contract.ts`/`relay.ts` 是它给"接入方"设计的正门（`RelayCredential`/`RelayModelRef.executionProfile`/`GenerateImageInput`/`GenerateVideoInput`/`GenerateMediaResult.taskId` 断点续查）。
- kit 内部**不对称**（已读代码确认）：
  - `generate/video.ts`、`generate/audio.ts` → 已走**协议驱动** `runModel`/`resolveModelRef`/`resolveProtocol`（能吃自定义 sync/async `ModelExecutionProtocol`）。
  - `generate/image.ts`、`generate/text.ts` → 仍是**老硬编码 upstream 路径**（`generate/image` → `upstream/openai/image.ts`，OpenAI 同步 `/images/generations`，不支持自定义异步）。
- 仓库内除 `relay-engine/` 外，**无任何代码使用** `generate.image`/这套门面（当前是不可达死代码 → 升级无回归风险）。
- 9004（`apimart-gateway`，本机 `127.0.0.1:9004`）是**异步网关**：提交返回 task_id → 轮询 `/v1/tasks/{id}` → 结果。kit 高级 image 门面（同步 OpenAI）承载不了，故之前被迫绕开自建。

### 1.3 目标
让 9004 的 image/video（自定义异步协议）**通过 kit 的正规机制跑通**：
- kit 引擎负责提交/轮询/取结果 URL；
- image 门面补齐到与 video/audio 对称的协议驱动；
- 落盘 `/files/` **不依赖 kit**，继续走我们既有链路；
- 后期可再收口/优化，但**当前铁律是绝不绕开 kit**。

### 1.4 非目标（明确不做，防范围蔓延）
- 不把 9004 焊死注册成 kit 内置 catalog/preset（本机网关 ≠ kit 内置外部站；用户已表示进内置与否无所谓，本 PRD 按"喂数据给 kit 引擎"处理，后期可收口）。
- 不重写 kit 引擎本体逻辑，只补"image 门面缺失的协议驱动能力"。

---

## 2. 模块清单（第 1 层 · State 2，已确认）

| 模块 | 一句话职责 |
|---|---|
| **M1 · kit 门面对称升级** | 把 `generate/image.ts` 补齐到与 `generate/video.ts` 一致的协议驱动（走 `runModel`），使 image 能吃自定义 sync/async 协议 |
| **M2 · 9004 异步协议接入** | 把 9004 image/video 表达为 `ModelExecutionProtocol` 喂给 kit 引擎（门面/逃生舱），删除并行自建 `relay-presets` 查询表 |
| **M3 · 后端轮询句柄（可 attach）** | `/api/generate` 用 kit `lowLevel.submit/poll` + `http.pollTask` 持句柄逐轮打点，不自写 fetch/驱动（保刷新不丢图） |
| **M4 · 落盘（独立，不依赖 kit）** | kit 只返回结果 url；落盘 `/files/` 走既有 `saveRemoteUrl`/前端 `saveResultToTasks` |
| **M5 · 薄端点接线** | `/api/relay`、`/api/generate` 只做"前端意图 → kit 调用"翻译 + `{code,data}` 信封 + `[relay]` 日志 |

**模块关系**：M1 是 M2/M3 的地基（image 门面先能吃异步协议）；M2 用门面（阻塞），M3 用逃生舱（可 attach），共用同一份 9004 `ModelExecutionProtocol` 数据；M4 与 M1~M3 正交（完全不进 kit）；M5 是纯薄接线。

---

## 3. 约束清单（第 1 层 · State 4，已确认 C0–C6）

### 3.1 跨模块约束（锚定所有细化）
- **C0 · 不绕 kit**：所有"提交/轮询/取结果 URL"必须经 kit（门面 `generate.*` 或逃生舱 `lowLevel.*`）；kit 之外不再出现第二套 fetch/轮询/字段抽取引擎逻辑。
- **C1 · 落盘零依赖 kit**：kit 只负责返回结果 url；落盘 `/files/` 一律走既有 `saveRemoteUrl`/前端 `saveResultToTasks`；kit 不感知我们的 `/files/` 语义。

### 3.2 模块约束
- **C2（M1）**：`generate.image` 支持自定义 `ModelExecutionProtocol`（含 async）；**未提供自定义协议时，默认行为不回归现状**（保留 OpenAI 同步 + edits-multipart 参考图）。
- **C3（M2）**：9004 image/video 协议经 kit `protocol.parse/validate` 校验后喂给门面（`RelayModelRef.executionProfile={preset:'custom',protocol}` 或 `input.protocol`）；删除并行自建 `relay-presets` 查询表与裸拼装。
- **C4（M3）**：`/api/generate` 用 kit `lowLevel.submit` + `lowLevel.poll`（或 `http.pollTask`）持句柄逐轮，不回归 90 号 R1~R4（提交返 taskId → GET attach → 重启恢复）。
- **C5（M4）**：落盘只收 kit 返回的 http 外链 url；对 data:/同源 `resultFetchUrl` 结果先归一成可落盘的 http/文件再走 `saveRemoteUrl`，否则显式报"该协议结果形态不支持落盘"，不静默落坏。
- **C6（M5）**：薄端点信封 `{code,data}` + `stage`/错误分类透传（不压成"生成失败"）；过 `check:api`；日志并入 `[relay]` 词根体系。

---

## 4. 风险与陷阱（第 1 层 · State 3，已确认）

1. M1 升级 image 门面时，把现有 OpenAI 同步生图改坏（默认协议语义与 `upstream/openai/image.ts` 不等价）。
2. M2/M3 共用 9004 协议对象，但门面(阻塞)与逃生舱(可 attach)对同一协议的处理可能不一致 → 一处通一处不通。
3. M4 落盘看似独立，但 kit 返回 url 形态（http / data: / resultFetchUrl 同源 base64）决定落盘走哪条；data:/fetchUrl 与现在 `saveRemoteUrl`（只认 http）对不上会静默落坏。

---

## 5. 第 2 层细化 — M1 · kit 门面对称升级（已确认）

### 5.1 M1 子模块（State 2）
- **M1-1 · image 入口协议驱动化**：重写 `generate/image.ts`，镜像 `generate/video.ts` 结构（`resolveModelRef` → `resolveProtocol` → 组 variables → `runModel` → 返回 `{urls, taskId?}`）。
- **M1-2 · image 变量映射**：定义 image 协议变量集（`model/prompt/size/n/imageUrls`），与 kit `PROTOCOL_VARIABLES` 对齐。
- **M1-3 · 默认行为保留**：调用方未提供自定义协议时，image 默认行为与现状等价（不回归 OpenAI 同步 + edits-multipart 参考图）；若 `runModel` 默认 preset 语义不等价，走一条"无协议 → 回退 `upstream/openai/image.ts`"保留路径。

### 5.2 M1 约束（State 4，已确认）
- **M1-C1**：`generate.image(input)` 在提供了自定义协议（`input.protocol` 或 `model.executionProfile.custom`）时，走 `runModel` 协议驱动（复用 kit `resolveModelRef/resolveProtocol/runModel`，与 video/audio 同一底座）。→ 支撑 C0
- **M1-C2**：image 变量映射只填 kit `PROTOCOL_VARIABLES` 已声明的变量（`model/prompt/size/n/imageUrls`），不发明新变量名。→ 支撑 C3
- **M1-C3**：未提供自定义协议时，默认行为不回归现状（保留 OpenAI 同步生图 + edits-multipart 参考图）。→ 支撑 C2
- **M1-C4**：支持异步时正确返回 `{urls?, taskId?}`（`GenerateMediaResult` 契约）：同步无 taskId、异步有 taskId。→ 支撑 M3 断点续查
- **验证标准**：(1) `generate.image` 传 9004 异步 image 协议 → 出 url + taskId；(2) 不传协议 → 现有 OpenAI 同步图正常；(3) 与 video/audio 走同一 `runModel`，无第二条协议执行路径。

### 5.3 M1 陷阱（State 3）
- 默认协议若直接套 `getDefaultCustomProtocol('image')`（sync openai-image，无 n-batch/edits 参考图处理），与现状 `upstream/openai/image.ts` 行为不等价 → regress。
- 一旦 image 支持异步，`GenerateMediaResult` 需带 `taskId`；调用方未准备好"异步可能不立即出 url"会误判失败。
- image 的 `size`（像素）与 video 的 `resolution`/`duration` 变量不同，映射错字段即发非法请求。

---

## 6. 第 2 层细化 — M2 · 9004 异步协议接入 kit 门面（已确认）

### 6.1 M2 子模块
- **M2-1** 9004 协议收拢为纯数据（保留 LOVART_IMAGE/VIDEO 为 kit `ModelExecutionProtocol`，按 providerId+capability 取用）
- **M2-2** 经 kit 门面执行（image=`relay.generate.image`[依赖 M1]、video=`relay.generate.video`，协议经 `input.protocol`/`executionProfile` 喂 kit）
- **M2-3** 删并行自建层（删 `presets[capability][provider]` 查询表 + 裸 `executeModelProtocol` 正式路径）

### 6.2 M2 约束
- **M2-C1**：9004 协议保留为 kit `ModelExecutionProtocol` 纯数据，按 providerId+capability 取用，不含逻辑（提交/轮询/取结果全靠 kit）。→ C0/C3
- **M2-C2**：relay 端点 image/video 经 kit 门面执行（image=`relay.generate.image`、video=`relay.generate.video`），协议喂 kit；不得以裸 `executeModelProtocol` 作正式路径。→ C0
- **M2-C3**：`/api/relay`(同步阻塞)走门面；`/api/generate`(可attach)归 M3 用 kit `lowLevel`；M2 不删 relay-poll 轮询句柄。→ C4
- **M2-C4**：9004 参考图(imageUrls/image_urls)与 size 变量经 kit 变量表归一；接不住则按 M1/M2 变量映射补齐，不在 kit 外另写拼装。→ C3
- **M2-C5**：删并行 `presets[capability][provider]` 查询表 + 裸拼装；协议数据归属 kit 层。→ C3
- **验证**：(1) `relay.generate.image`(9004 async) 出图+taskId；(2) `relay.generate.video`(9004 async) 出视频+taskId；(3) relay 端点不再 import 裸 `executeModelProtocol` 作正式路径；(4) `/api/generate` 刷新恢复不回归。

---

## 7. 第 2 层细化 — M3 · 后端轮询句柄可 attach（已确认）

### 7.1 M3 子模块
- **M3-1** 统一轮询出口到 kit `lowLevel`（`createRelay().lowLevel.submit/poll`），唯一协议执行出口
- **M3-2** 句柄持久化 + 可 attach（request_data 快照 + poll_task_id + GET attach + cancel）
- **M3-3** 重启恢复扫描 `initRelayPoller`

### 7.2 M3 约束
- **M3-C1**：`/api/generate` 轮询统一走 kit `lowLevel`（唯一出口），relay-poll 不再散 import `protocol/executor` 深层。→ C0
- **M3-C2**：M3 保持"逃生舱可 attach"形态（提交返 taskId + GET attach + cancel），**不退化成门面 generate.* 阻塞式**（否则丢刷新恢复）。→ C4
- **M3-C3**：轮询驱动能力复用 kit（`lowLevel.poll`/driver），不自写 fetch/鉴权/字段抽取。→ C0
- **M3-C4**：句柄落库 + GET attach + cancel + 重启恢复保持 90 号 R1-R4 能力，不回归。→ C4
- **M3-C5**：协议执行全程 key 不入库、只驻内存（重启按 providerId 重读 .env）。→ key 红线
- **验证**：(1) 提交返 taskId；(2) GET 重复 attach 到同一句柄；(3) cancel 停轮询落 failed；(4) 重启恢复续跑；(5) relay-poll 不 import 裸 `protocol/executor`。

---

## 8. 第 2 层细化 — M4 · 落盘最小侵入（已确认）

### 8.1 M4 子模块
- **M4-1** 复用既有落盘（`persistResultUrl`/后端 `saveRemoteUrl`、前端 `saveResultToTasks`）
- **M4-2** 结果形态归一（http 外链/本地 /files//data:同源 base64）
- **M4-3** 落盘与 kit 解耦

### 8.2 M4 约束
- **M4-C1**：落盘唯一入口是既有 `persistResultUrl`/`saveRemoteUrl`(后端)与 `saveResultToTasks`(前端)；**kit 不参与落盘、不感知 /files/**。→ C1
- **M4-C2**：http 外链→`saveRemoteUrl` 落 `/files/tasks/`；已是 /files/ 本地→原样不二次外传。→ C1/C5
- **M4-C3**：kit 返回 data:/同源 base64(resultFetchUrl)→先归一成可落盘 http/文件再落盘；无法归一则**显式报"该协议结果形态不支持落盘"**，不静默落坏。→ C5
- **M4-C4**：落盘失败回退原 url（宁显示外链不丢），console.error 留痕不吞错。→ 失败可见
- **验证**：(1) 9004 http 外链→/files/ 正常；(2) 已 /files/ 不二次外传；(3) resultFetchUrl 不静默失败；(4) 落盘失败有日志回退外链。

---

## 9. 第 2 层细化 — M5 · 薄端点接线（已确认）

### 9.1 M5 子模块
- **M5-1** `/api/relay` 同步薄壳（意图 → kit 门面 generate.* → `{code,data}`）
- **M5-2** `/api/generate` 异步薄壳（意图 → kit lowLevel 提交返 taskId + 后端轮询句柄）
- **M5-3** 信封/日志/错误统一（`{code,data}` + stage 分类 + `[relay]` + check:api）

### 9.2 M5 约束
- **M5-C1**：两端点只做"意图→kit 翻译 + 信封"，协议执行全在 kit（M1/M2/M3），端点内无 fetch/轮询/字段抽取/落盘。→ C0
- **M5-C2**：两端点共用 `buildRelayContext`，不各自拼装。→ C3
- **M5-C3**：返回统一 `{code,data}`，成功对齐前端 `GenerationResult`；错误带 stage+分类透传。→ C6
- **M5-C4**：新增/改动端点登记 router.ts routes + contracts.ts apiRegistry，过 check:api。→ C6
- **M5-C5**：日志 `[relay]` 词根并入现有体系，记 providerId/capability/model/stage，脱敏不打 key。→ C6
- **验证**：(1) `/api/relay` 出图/视频；(2) `/api/generate` 提交+GET attach+cancel；(3) check:api 过；(4) 日志无 key；(5) 端点内无裸协议/落盘逻辑。

---

## 10. 施工顺序（依赖关系，写码按此分批）
M1 → M2 → M3 → M5（M4 落盘可并行独立做）。理由：
- M2-image 依赖 M1（image 门面先协议驱动）；M2-video 不依赖 M1（video 已协议驱动）。
- M5-1(同步门面) 依赖 M1/M2；M5-2(异步可attach) 依赖 M3。
- M4 正交，任意时点可落。

---

## 11. 一句话总结
**升级 kit：把 `generate.image` 补齐到协议驱动（与 video/audio 对称），9004 的异步协议作为数据喂给 kit 引擎跑通；绝不绕开 kit、落盘不依赖 kit。** 加平台 = 在 kit 协议层加数据，不再是自建一层。
