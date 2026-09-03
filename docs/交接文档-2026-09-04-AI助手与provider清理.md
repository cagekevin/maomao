# 交接文档 · AI 助手统一后端 + provider 清理（2026-09-04）

> 给接手 AI。**先读根目录** **`CLAUDE.md`（项目认知）+ 本文件**。写码决策读 `spec/CONTEXT.md`、测试读 `spec/TEST-GUIDE.md`。
> 本文件记：已完成/可用的现状、**没做完的任务（含用户点名的大任务「清理垃圾」）**、下一个 AI 必须知道的关键信息。

***

## 0. TL;DR（一句话）

- **魔搭流式已通**；AI 助手前端已配好，**不用后端再改**。

- **apimart**（内置 api.apib.ai）后端 测试连接/拉取模型 curl 都通，但用户**前端仍报失败（疑缓存未刷新）**，且他已配好几个模型能聊天，**暂不深究**。

- 大量改动**未 commit**（git status 约 36 个文件）。

- **下一大任务 = 清理垃圾**（废文件/废代码/死注释/过时文档），清单见 §2.1。

***

## 1. 已完成 & 可用的现状

### 1.1 后端统一生成入口（Step 6 收口）

- **统一入口** **`POST /api/generate`**，按 capability 分流：

  - `chat` → 同步（非 9004 厂商走通用 `kit.chat()`；9004/lovart 走 LOVART preset 剥 data. 信封）；
    带 tools → `chatWithTools`（非流式）或 `relayChatStream`（SSE 流式打字机）。

  - `image/video` → 异步句柄（submit 即返 taskId + GET attach）。

- `/api/relay` 后端路由已删除；前端 `relayProxy.relayChat` 改打 `/api/generate`。

### 1.2 后端关键修复

- `resolveBaseUrl`（relay.ts 与 relay-poll.ts）：**先读用户配置文件** **`base_url`** **→ 兜底内置 defaultBaseUrl**。
  修复了 modelscope/纯配置厂商报「未配置接口地址」。

- relay chat 同步按 provider 分流出站（fetch server）：非 9004 → 通用 OpenAI；9004 → LOVART preset。

- `testConnection` / `fetchProviderModelCatalog`：**无内置目录定义但有** **`base_url`** **的纯配置厂商**也按通用 OpenAI 探测/拉取，不再报「未知厂商目录」。

### 1.3 provider「用户配置层」增删（前端）

- 设置页：已用厂商（enabled）过滤展示；「增加厂商」从候选启用；「移出厂商」（置 enabled=false 可逆）。

- 模型清单：手动增删单项 + 「拉取模型→勾选」**合并去重**（`mergeModelLists`，不覆盖手输项）。

- 详情 header `base_url` 可编辑（`updateProviderField`）。

- 节点模型下拉 `ModelSelect` 改**扁平**：一次列出所有已配置模型（带厂商 badge），无「服务商→模型」两级/返回按钮。

### 1.4 AI 助手

- 模型下拉只用「已启用厂商的 `chat_models`」，剔硬编码 `AGENT_MODELS` 兜底（未配的不显示）。

- 非流式：后端同步 + 前端 roundTrip 兼容 relay 信封 `{code,data:{text}}` 解析（原来按 OpenAI choices 解析不到 → 空）。

- **魔搭流式已通**（用户确认）：base\_url=`https://api-inference.modelscope.cn/v1`，key=`ms-...`。

### 1.5 乱码 provider 清理（用户情绪点）

- `.env` 删除 `API_PROVIDER_P_MT1C86V0_XXEYNA_KEY`、`API_PROVIDER_P_MT1H4YCB_SFR3GU_KEY` 两行 + 关联注释。

- 磁盘删除 `~/.maomao-localtool/providers/p_mt1h4ycb_sfr3gu.json`。

- 前端 `providerStore.emptyProvider` 不用 `generateId('p')` 造随机 id → 改可读占位 `__unknown__`；删除 `generateId` import。

- 现在 `.env` 只留真实厂商 key：`LOVART` / `MODELSCOPE` / `APIMART`。

***

## 2. 未做完 / 待办

### 2.1 ★ 大任务：清理垃圾（用户 2026-09-04 点名，最重要）

候选清单（已核实当前仍存在、属废弃/过时，接手 AI 逐个 grep 再删，勿误删本人会用的）：

1. **注释/文档里残留** **`/api/relay`** **字样**（路由已删，注释过时会误导）：

   - `src/components/base/README.md` L25（写 chatApi→/api/relay，实际已改 /api/generate）

   - `src/components/base/api/index.ts` L11

   - `src/components/base/config.ts` L159

   - `src/components/base/api/pollTask.ts` L17 / L95 / L118

   - `src/components/base/api/chatApi.ts` L5、`relayProxy.ts` L20 / L244

   - → 统一改为「/api/generate 统一入口」描述，别留 /api/relay。

2. **排障 console.log**：

   - `localTool/src/relay.ts` L173 `[relay-chat-image] ...` —— 确认 chat 参考图正常后可删（旧交接 §4.3 同款）。

   - `taskStore.ts` done/fail 的 `logger.debug` 排障埋点，确认无排查需要后可删/降级。

3. **旧代理/自轮询链路**：确认 `/api/proxy`、`proxyGenerate`、`pollTask` 前端自轮询、`taskStore` ensurePolling 等是否仍被消费 → 无则整文件删除（它们已被 relay 替代）。

4. **过时文档**：`docs/` 里标的「规划中/已过时」方案、历史排查笔记，按 CLAUDE §七原则核对清理（保留"已完成"真源文档）。

5. **其它死代码**：`AGENT_MODELS`（config.ts 仍定义、AgentPanel 不再用，但 `agentConfig.ts` L43/152 还引——确认后者是否还在用，再定删留）、`buildAllModels` 改造后可能的孤立消费点。

> 原则：**每删一处先 grep 确认无引用**；宁可少删不留误导，不删还在用的。

### 2.2 其它未完成（前期交接 Step 4/8/9，可继续）

- **Step 4 · chat 流式按 provider config 标记**：魔搭已在 relay 流式通，但「按 config/providers JSON 里 streaming 字段决定流/非流」的统一机制未做（现靠请求端 stream 标记 + tools 判断）。

- **Step 8 · 拆 9004、relay 直连 Lovart 原生**（远期，见 docs/99）。

- **Step 9 · 其它 12 厂商生成协议齐**（远期）。

***

## 3. 下一个 AI 必须知道的关键信息

1. **改后端必须 build + 重启才生效**：`cd localTool && npm run build`（产出 dist 单文件）→ 重启 localTool。
   `npm test` 只 tsc+测，**不产出 dist**。本次"chat 报 Missing frontTaskId"就是这个坑（跑旧 dist）。
   重启：`kill $(lsof -tiTCP:18080 -sTCP:LISTEN) && (nohup node dist/index.js &)`（在 localTool 目录）。

2. **本地数据真相源**：

   - 厂商配置：`~/.maomao-localtool/providers/*.json`（每个厂商一个，含 `base_url`/模型/enabled）。

   - key：只在 `localTool/.env`，形式 `API_PROVIDER_{ID_UPPER}_KEY`。**key 不入库、不回前端明文**。

   - 前端设置页数据 = `GET /api/providers`（配置文件 ∪ ai-relay 内置目录合并）。

3. **base\_url / key 前缀别混**：

   - `base_url` 真源 = **配置文件 base\_url**（`resolveBaseUrl` 已改，读配置优先）。

   - 魔搭：ModelScope 域的 `.../v1`，key 前缀 **`ms-`**。

   - DashScope（阿里云百炼）：`dashscope.aliyuncs.com/compatible-mode/v1`，key 前缀 **`sk-`**。别把魔搭配到 DashScope（会 401 invalid\_api\_key）。

   - APIMart：key 前缀 **`sk-`**。

4. **端口/网络**：localTool `:18080`、网关 `:9004`；连 Lovart/境外厂商需 VPN/代理（api.apimart.ai 等境外域名后端直连常 fetch failed，走代理才通）。

5. **工作树状态**：约 36 个文件未 commit（本轮 AI + 更早的迁移改动）。`cloudSync.ts` 是另一 AI 在改（现已 0 类型错），**提交前先合入它的改动，别覆盖**。

6. **红线速查（详见 CLAUDE.md）**：key 只进 .env · 前端只发意图(GenIntent)不拼出站 · base\_url/协议落入 config JSON · 生成入口唯一 /api/generate · 过时即删不双轨（但删前 grep）。

***

## 4. 验证命令

- 后端：`cd localTool && npm test`（181 用例）· `npm run build`

- 前端：`npm run type-check`（注意 cloudSync 他人文件）· `npm run build`（含 check:api/check:events）· `npm test`

- 连接/拉取：`POST /api/providers/{id}/test-connection`、`POST /api/providers/{id}/fetch-models`

***

## 5. 用户 2026-09-04 的口头状态（别回了又去改）

- **魔搭流式已成功**，不用再调。

- **apimart**：点测试连接/拉取模型前端仍不成功，但已配好几个模型能聊天 → **先别深究**。

- **AI 助手前端已设置好**，不用后端再改。

- **重点放在：清理垃圾**（§2.1）。

