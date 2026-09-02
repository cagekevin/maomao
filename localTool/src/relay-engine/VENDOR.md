# VENDOR.md · relay-engine（vendored 协议引擎 · 已本地按链路重排）

> **本目录源自第三方 ai-relay-kit，但已按"请求链路"本地重排目录结构（2026-09-02），不再与上游目录布局一致。**
> 因此：**不要用 `cp -R <上游>/. relay-engine/` 直接覆盖**（会与本地重排冲突）。需升级时先读第 3 节"升级与上游同步"。

## 1. 来源
- 上游：`/Users/kevin/Downloads/ai-relay-kit`
- 用途：声明式模型协议引擎（`submit/poll/response` 三段数据化），供 localTool 的 relay 端点调用（走 kit 门面 `relay.generate.*`，不绕开 kit）。
- vendoring 日期：2026-09-02
- 原 vendoring 方式：`cp -R <kit>/src/. relay-engine/`（整包拷）

## 2. 当前目录结构（已按请求链路归位）

```
relay-engine/
├── 1-intent/     意图层（原 generate/）：image/video/text/audio/run
│                 把"生图/视频/聊天"意图翻译成协议变量，交给 2-engine 执行
├── 2-engine/     协议引擎层（原 protocol/）：executor/schema/variables/body/response/…
│                 提交/轮询/取结果 —— kit 的心脏
├── 4-types/      类型层（原 types/）：connection/protocol/stream/…
├── core/         传输/底座层：transport/polling/base-url/http-utils/stream-parser/…
│                 （含 host-store/host-types/tauri-transport 宿主接缝，Node 仅用底座部分）
├── relay.ts      门面：createRelay()
├── contract.ts   Generate* 入参/出参契约类型
├── capabilities.ts / index.ts   能力清单 / 包根 re-export
├── _aux/         外围（非一条生成请求的主干链）：deps(宿主桩)/docs(读文档)/providers(内置厂商目录)/share(连接分享)/stations(中转站解析)
└── upstream/     kit 从原项目抽的旧实现（OpenAI 同步生图/文本等），1-intent 的 image/text 无自定义协议时兜底引用
```

**主干请求链**：`1-intent`(意图) → `2-engine`(引擎) → `4-types`(类型) + `core`(传输底座)，`relay.ts/contract.ts` 为对外门面。
**外围**：`_aux/` 下各目录（被门面连带、非主干链）；`upstream/`（旧兜底）。

## 3. 升级与上游同步（重要）
- 上游目录结构仍是旧的（`protocol/ core/ types/ generate/ providers/ …`），与本目录**本地重排结构不一致**。
- **不要 `cp -R` 直接覆盖**（会按上游旧结构塞回来、与本地 `1-intent/2-engine/…` 错位）。
- 如需升级 kit：把上游改动按新结构同步进来，或用 `scripts/ts-migrate.mjs move-dir --root localTool/src` 把上游新文件归到对应链路层（见 scripts 用法）。

## 4. 浏览器 API 位置（勿被 Node 运行拉到）
- `_aux/docs/reader.ts`、`upstream/imageUtils.ts`、`upstream/videoInputValidation.ts` 含 `window/document/FileReader` 等浏览器全局。
- 这些在边缘/外围模块，主干链（1-intent/2-engine/core/4-types）不 import 它们；esbuild 打包 Node 端不会被拉到。

## 5. 真实入口
- **推荐走 kit 门面**：`createRelay()`（`relay-engine/relay.ts`）→ `relay.generate.image/video/...`；localTool 经 `relay-facade.ts` 拿单例并注入 `fetchWithProxy` 传输层。
- 逃生舱（自定义提交/轮询）：`relay-engine/2-engine/executor.ts` 的 `executeModelProtocol` / `submitModelProtocol` / `buildModelProtocolPollDriver`（relay-poll 后端轮询句柄用）。
- 真实签名（实测，非文档推测）：
  - `executeModelProtocol(options: ExecuteModelProtocolOptions): Promise<ExecuteModelProtocolResult>`（单对象入参）
  - `SubmitModelProtocolOptions = { apiKey, baseUrl, protocol, variables, signal? }`

## 6. 禁止
- 本目录是 vendored 引擎；**主干层（1-intent/2-engine/core/4-types/relay/contract）逻辑改动**应去上游或经适配层，避免本地硬改后无法升级。
- 外围 `_aux/` 与 `upstream/` 为 kit 附带，若确认无用可后续按需剔除（动前先 grep 确认无引用，见 `docs/91-relay接入收敛到kit门面-PRD` 的分类）。
