# ai-relay 平台适配器规范（ADAPTER_SPEC）

> **目的**：ai-relay 里所有「命令式原生协议平台」（不是 OpenAI 兼容、不能塞进声明式 preset 的）统一用 **一个平台 = 一个适配器文件夹** 接进来。本规范定义适配器的**统一对外接口、目录范式、硬性红线、测试要求**。后续新增任何平台，**照本规范在 `providers/<id>/` 建文件夹**，不改 ai-relay 主逻辑、不改后端 relay 主路。

---

## 0. 何时用适配器 vs 声明式 preset

| 平台形态 | 归属 |
|---|---|
| OpenAI 兼容 + 请求/响应可用「提交 task_id → 轮询 → 取 url/text」声明式描述 | 声明式 **preset**（存量 12+ 平台，暂不迁移） |
| chat-thread / 多产物 / confirm 门 / pre-flight（project、上传、set_mode）等**表达不进声明式**的原生协议 | **命令式适配器** `providers/<id>/`（终局，本规范） |

> 迁移方向：存量平台后续逐个迁到适配器；新平台默认适配器。9004(lovart) 为过渡态，跑通直连后删除。

---

## 1. 目录范式（一个平台 = 一个文件夹，命名 `providers/<id>/`）

```
ai-relay/providers/<id>/
├── index.ts             # ★ 唯一对外出口（barrel，唯一允许裸名的文件）
│                          # 对外只暴露统一接口（见 §2），内部按 model/模态路由
├── <id>_config.ts       # 平台常量：path 前缀 / 鉴权类型 / 超时 / 模型规格表 / 错误类型枚举
├── <id>_contract.ts     # 共享类型 + 依赖注入接口（transport / fetch 等测试注入点）
├── <id>_client.ts       # 上游 HTTP 原语：鉴权 + 各端点方法；剥离上游信封
├── <id>_project.ts      # （若需）资源/会话创建 + 按凭证缓存 + 失效自愈
├── <id>_prompt.ts       # prompt 工程：模型名进自然语言 / 结构化工具路由
├── <id>_attachments.ts  # （若需）URL/base64→字节→上游上传
├── <id>_task.ts         # 轮询状态机 + 结果整形 + 总超时
├── <id>_stream.ts       # （chat 流式用）合成 OpenAI chunk SSE
├── <id>_errors.ts       # 错误信封（上游文案原样透传）
└── __tests__/           # 测试（见 §5）
```

**命名铁律**：目录内所有模块文件必须带 `<id>_` 前缀（`<id>_client.ts` / `<id>_task.ts` …），**仅 `index.ts`（对外出口）裸名**。避免与 ai-relay 主模块/其他平台模块混淆归属。

---

## 2. 统一对外接口（`index.ts` 只暴露这些，缺一不可）

适配器必须支持三类能力 + 统一异步任务原语。**后端 relay 只认这套接口**，不认平台差异。

```ts
// ── 同步/阻塞直调（单测 / 内部复用；出图后返回） ──
generateImage(profile, opts) → Promise<string[]>       // 图片，多产物归一
generateVideo(profile, opts) → Promise<{ url: string }> // 视频主产物

// ── 统一异步任务原语（★ 后端异步句柄用，不丢图） ──
submitTask(profile, opts) → Promise<{ handle: AsyncHandle; /* 可序列化快照 */ }>
pollTaskOnce(profile, { handle }) → Promise<{ status: 'running'|'completed'|'failed';
                                              urls?: string[]; error?: string }>

// ── chat 流式 ──
streamChat(profile, opts) → Promise<Response>  // 合成 OpenAI chat.completion.chunk SSE
```

**关键：为何要 `submitTask` + `pollTaskOnce` 两段式（而不是只有阻塞 `generateImage`）？**

后端 image/video 是「提交 → DB 落库 → 后台句柄轮询 → 前端 GET attach」的**异步模型**（图片丢了可不行）。阻塞式一次等到出图无法进句柄。故适配器必须拆成：
- `submitTask`：只提交，**不等终态**，返回一个**可 JSON 序列化的句柄快照**（存上游任务 id + 恢复所需的一切，**凭证不入快照**，重启按平台重读）。
- `pollTaskOnce`：对句柄打一次状态 → 归一到 `running/completed/failed`。

> `handle` 必须能被 `structuredClone`/`JSON.stringify` 序列化，供 DB 落库与重启恢复重建句柄。凭证只驻内存（`.env`），不进快照。

---

## 3. 依赖注入接口（`<id>_contract.ts`）

适配器**不得**在文件顶层把 HTTP 写死成不可替换——要为测试提供注入点，使单测能**不打真上游**地断言请求体：

```ts
/** 出站传输窄接口。生产实参 = ai-relay/httpTransport 的 stableRequest；测试注入 fake。 */
export type AdapterTransport = (opts: StableRequestOptions) =>
  Promise<{ response: Response; resolvedBaseUrl: string }>;

export interface <Id>Profile {
  baseUrl: string;
  auth: AuthConfig;              // 统一走中央 httpTransport auth（hmac/bearer/...），不自写
  timeoutMs?: number;
  signal?: AbortSignal;
  transport?: AdapterTransport;  // 测试注入
  fetchImpl?: typeof fetch;      // 附件下载/外部抓取的注入点（测试）
  pollIntervalMs?: number;       // 测试提速
  doneRecheckMs?: number;        // 测试提速
}
```

**红线**：任何 HTTP 都必须经注入的 `transport`（默认 = 中央 `stableRequest`）。适配器内**不自写重试/签名/超时循环**（这些在中央 httpTransport）。

---

## 4. 硬性红线（可机检，见 §5 测试）

| # | 红线 | 说明 |
|---|---|---|
| R1 叶子 | 适配器只 import `../httpTransport`、`../types`、必要 helper；**绝不 import `../generate`、`../index`、`../relay`** | 不反向依赖外层，避环 |
| R2 鉴权归中央 | HMAC/bearer 等鉴权头由中央 `httpTransport` 的 auth 分支构造；适配器只传 `auth` | 不自写签名/重试 |
| R3 传输归中央 | 所有 HTTP 走注入 transport（默认 `stableRequest`） | 重试/上限/取消/文案透传全现成 |
| R4 信封剥离 | 上游 `{code,message,data}` 信封在 `<id>_client` 剥离；`code≠0` 抛带**原始 message** 的错，禁翻译/静默 | 用户看上游原话 |
| R5 模型必显式 | 任何一次真实提交：结构化工具路由（`tool_config`/等价）**或**自然语言路（prompt 含可读模型名）**至少一条生效**；绝不裸发"用默认模型" | 用户强约束 |
| R6 错误类型 | 定义 `<id>_err_types` 枚举，失败归一到 `no_artifact/abort/timeout/upstream/...`，供上层区分 | 不吞错 |
| R7 凭证不进库 | 句柄快照/DB **不含** AK/SK 明文 | 重启按平台重读 `.env` |
| R8 阻塞可用 | 适配器既给阻塞直调又给异步原语，两端互不依赖对方副作用 | 可单测/可进句柄 |

---

## 5. 测试要求

- **单测（不打真上游）**：放 `localTool/test/<id>_*.test.js`（Node 原生 test runner `node --test` + tsx），用注入 fake transport/fetch 断言：
  - 请求体含模型名/结构化工具（R5）、HMAC/鉴权头透传（R2/R3）
  - 信封剥离与 `code≠0` 原话透传（R4/R6）
  - project 单例缓存 + 失效自愈、附件失败阻断、轮询超时/`pending→confirm`
  - `pollTaskOnce` 归一 running/completed/failed；句柄快照可 `JSON.stringify` 往返
- **结构守门（CI）**：R1/R2/R3 用 grep：`providers/<id>/` 内不得出现 `from '../generate|../index|../relay`、不得自写 `createHmac`/`fetch(`（附件下载除外，走注入）。
- **集成 smoke（真打上游）**：仅直连跑通后，对 `providers/<id>` 跑真实 image+video+chat 各一次；不进单测默认执行。

---

## 6. 新增平台 checklist（照抄模板改）

1. 复制 `providers/lovart/` 目录 → 改名 `providers/<id>/`，文件加 `<id>_` 前缀。
2. 改 `<id>_config.ts`：模型规格表 / path 前缀 / 错误枚举。
3. 改 `<id>_client.ts`：各端点方法 + 信封剥离（协议不同则改，别硬套 lovart 的 project/upload/chat——没有就别建空文件）。
4. 实现统一接口 `index.ts`：`generateImage/generateVideo/submitTask/pollTaskOnce/streamChat`（能力缺失的可 `throw new Error('not supported')`，但签名必须齐，后端不用猜）。
5. 满足 §4 全部红线 + §5 测试。
6. 在 `ai-relay/index.ts createRelay` 加 providerId 分流（若有）；在 `providerCatalog.ts` 注册平台与模型清单。

---

## 7. 与后端 relay 的关系

后端 image/video 异步句柄（relay-poll）与 chat（generateEngine）是**唯一消费方**。它们只调：
- image/video：`submitTask` → 落 DB（快照）→ 句柄循环 `pollTaskOnce` → 落盘/attach
- chat：`streamChat`

9004 退役后，后端只剩适配器这一条路，relay 是纯消费者，越收越拢。
