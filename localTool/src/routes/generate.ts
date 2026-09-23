/**
 * routes/generate — 统一生成入口（Step 6：/api/relay 已并入，删薄壳）。
 *
 * 职责：前端意图 → relay 层（唯一协议执行出口）→ {code,data} 信封。
 * 端点内无 fetch / 轮询 / 字段抽取 / 落盘（C0/C5），协议执行收敛在 ai-relay kit。
 * relay 引擎 / 13 厂商 / relay-poll 完整保留。
 *
 * 单入口但内部按 capability 走各自数据流（capability 只是入参，勿按模态拆端点）：
 *   - chat        → 聊天数据流：同步 relayGenerate await 出文本，直接返 {code:0,data:{status:'completed',text}}
 *                    （聊天空丁无句柄、不建任务行、不进 relay-poll；【红线】chat 进 poller 会进度卡 90）
 *   - image/video → 图片/视频数据流：异步句柄，submit 即返 {code:0,data:{taskId}}，GET attach 收结果
 *
 *   GET  /api/generate/:frontTaskId  attach 查询 → progress / completed(url) / failed / not-found（仅 image/video）
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import { json, parseJsonBody, sendError } from '../utils/helpers.js';
import { submitGenerateTask, getGenerateStatus } from '../relay-poll.js';
import { normalizeOverrideMs } from '../budget.js';
import { isRelayCapability, type RelayCapability } from '../capability.js';
import { relayGenerate, relayChatStream } from '../generateEngine.js';

/** POST /api/generate —— 统一生成入口：按 capability 分流到聊天/图片/视频数据流。 */
export async function handleGenerateSubmit(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const body = (await parseJsonBody(req)) as Record<string, unknown> | null;
  if (!body) return sendError(res, 'Missing body', 400);

  const providerId = typeof body.providerId === 'string' ? body.providerId : 'lovart';
  const capability: RelayCapability | undefined = isRelayCapability(body.capability)
    ? body.capability
    : undefined;
  const model = typeof body.model === 'string' ? body.model : '';
  if (!capability) return sendError(res, 'Invalid or missing capability', 400);
  if (!model) return sendError(res, 'Missing model', 400);

  // 【143 · S3′ · 提级】`body.timeoutMs` 是**全能力通用**的 override（"调用方本次耐心"），
  // 原先只在 chat 分支里读 ⇒ **image/video 的 override 通道是死的**（`RelaySubmitInput.timeoutMs`
  // 明明被 `submitGenerateTask` 消费，却没人转发）。现提到能力分叉**之前**算一次，两处共用。
  // 合法性判据**不在本层**：调真源原语 `normalizeOverrideMs`（TD-08-63 收口）；非法 / 缺失 → undefined，
  // 交给真源默认；**不在这里自己编一个数**（编了就是第二份真相）。
  // ⚠️ **通道可达性（TD-08-53 复核）**：本层已把 override 转给两条分支，但**当前只有 chat 有消费方**
  //   （前端 `relayChat`/`relayChatStream` 写 `CHAT_TOTAL_TIMEOUT`）。image/video 的前端（`RelayIntent`）
  //   **有意不传** —— S4′ 已定「等待上限由后端 `budgetMs` 告知」。⇒ 那不是半态，是**对调用方开放的可选
  //   通道、当前暂无消费方**（不为它预建前端字段 —— 那才是 ADR-0030 说的幽灵预留）。
  const clientTimeoutMs = normalizeOverrideMs(body.timeoutMs);

  // ── 聊天数据流（前端 frontTaskId 有则透传，后端不消费——聊天无句柄、不建任务行）──
  if (capability === 'chat') {
    const tools = (Array.isArray(body.tools) ? body.tools : []) as unknown[];
    const hasTools = tools.length > 0;
    // 【TD-01-24 · 口径贯通 · 143 S5′ 回改】前端把**本次任务总预算**写在 `body.timeoutMs`——
    // 本层**只转发**给上游，不再让它按自己的默认值跑（那正是"前端先放弃、上游白跑"的根因）。
    // ⚠️ 该字段是**任务总预算**的位置，不是「等上游响应」段值：前端此前误传段值 120s，已改为总预算（S5′）。
    // ⚠️ 缺省时后端取**预算真源** `budgetMsFor('chat')`（`localTool/src/budget.ts`），不在此编数字。
    // AI 助手（带 tools）→ 默认流式打字机（SSE 透传，前端保留 tool_calls delta 解析）；
    // 显式请求流式或带工具 → 流式；否则同步 JSON 快路径。
    const wantStream = body.stream === true || hasTools;
    if (wantStream) {
      await relayChatStream(req, res, {
        providerId,
        model,
        messages: Array.isArray(body.messages)
          ? (body.messages as unknown[])
          : typeof body.prompt === 'string'
            ? [{ role: 'user', content: body.prompt }]
            : [],
        tools: hasTools ? tools : undefined,
        baseUrl: typeof body.baseUrl === 'string' ? body.baseUrl : undefined,
        timeoutMs: clientTimeoutMs,
      });
      return;
    }

    const out = await relayGenerate({
      providerId,
      capability,
      model,
      timeoutMs: clientTimeoutMs,
      prompt: typeof body.prompt === 'string' ? body.prompt : undefined,
      messages: Array.isArray(body.messages) ? (body.messages as unknown[]) : undefined,
      images: Array.isArray(body.images) ? (body.images as string[]) : undefined,
      temperature: typeof body.temperature === 'number' ? body.temperature : undefined,
      responseFormat: typeof body.response_format === 'string' ? body.response_format : undefined,
      persist: false, // 文本不落盘（聊天数据流）
    });
    if (!out.ok) {
      return json(res, {
        code: -1,
        data: { error: out.error || '聊天失败', providerId, capability },
      });
    }
    return json(res, {
      code: 0,
      data: {
        status: 'completed',
        kind: out.kind ?? 'text',
        text: out.text,
        providerId,
        model,
      },
    });
  }

  // ── 图片/视频数据流：异步句柄（frontTaskId 是句柄定位主键，必填）──
  const frontTaskId = typeof body.frontTaskId === 'string' ? body.frontTaskId : '';
  const nodeId = typeof body.nodeId === 'string' ? body.nodeId : '';
  const type = typeof body.type === 'string' ? body.type : '';
  if (!frontTaskId) return sendError(res, 'Missing frontTaskId', 400);

  const out = await submitGenerateTask({
    frontTaskId,
    nodeId,
    type,
    providerId,
    capability,
    model,
    prompt: typeof body.prompt === 'string' ? body.prompt : undefined,
    size: typeof body.size === 'string' ? body.size : undefined,
    images: Array.isArray(body.images) ? (body.images as string[]) : undefined,
    messages: Array.isArray(body.messages) ? (body.messages as unknown[]) : undefined,
    resolution: typeof body.resolution === 'string' ? body.resolution : undefined,
    duration: body.duration !== undefined ? String(body.duration) : undefined,
    baseUrl: typeof body.baseUrl === 'string' ? body.baseUrl : undefined,
    // 【143 · S3′】override 通道（原先漏转发 ⇒ 该字段对 image/video 完全无效）
    timeoutMs: clientTimeoutMs,
  });
  if (!out.ok)
    return json(res, {
      code: -1,
      data: { error: out.error || '提交失败', frontTaskId, budgetMs: out.budgetMs },
    });
  // 【143 · S3′】响应恒带 `budgetMs`（后端实际生效的预算）—— 生产者给全，前端不必自持等待上限。
  // 成功/失败**两条路径都带**：前端不必按路径分支判断"这个字段该不该有"（少一个分叉点）。
  return json(res, {
    code: 0,
    data: { taskId: out.frontTaskId, frontTaskId: out.frontTaskId, budgetMs: out.budgetMs },
  });
}

/** GET /api/generate/:frontTaskId —— attach 查询进度/结果。 */
export async function handleGenerateGet(
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
): Promise<void> {
  const frontTaskId = url.pathname.replace(/^\/api\/generate\//, '');
  if (!frontTaskId || frontTaskId.includes('/')) {
    return sendError(res, 'Missing frontTaskId', 400);
  }
  const st = await getGenerateStatus(frontTaskId);
  // 【TD-01-29】改 `switch` + **穷尽性守卫**：新增状态而此处漏处理 ⇒ `default` 里 `st` 不是 `never` ⇒ **编译报错**。
  //（原先的 `if` 链 + 末尾兜底会把漏掉的新状态**静默折成 `not-found`** —— 漏改不报、结论还错。）
  switch (st.status) {
    // 【143 · S3′】各分支都带 `budgetMs`（重 attach 时前端要能拿到，不能只靠 POST 那次）。
    case 'completed':
      return json(res, {
        code: 0,
        data: { status: 'completed', url: st.url, type: st.type, budgetMs: st.budgetMs },
      });
    case 'failed':
      return json(res, {
        code: 0,
        data: { status: 'failed', error: st.error, budgetMs: st.budgetMs },
      });
    // 【143 · S3′ · 修缺陷】`unknown` 是**第三终态**（TD-08-24：可能已生成，须用户核对），
    // 原 `if` 链**没有这个分支** ⇒ 落 404 ⇒ 前端把非 2xx 折成 `running` ⇒ **空等到超时**，
    // 恰好就是 TD-08-24 要防的形态（前端 `relayProxy` 的 unknown 分支因此**永远收不到**）。
    case 'unknown':
      return json(res, {
        code: 0,
        data: { status: 'unknown', error: st.error, threadId: st.threadId },
      });
    case 'running':
      return json(res, {
        code: 0,
        data: { status: 'running', progress: st.progress ?? 0, budgetMs: st.budgetMs },
      });
    // 【143 · S3′】`not-found` 由 **404 改为 200 + 明确状态**（生产者给全：HTTP 状态码不该承担业务语义）。
    // 原形态：404 ⇒ 前端对非 2xx **一律折成 `running`** ⇒ 「后端明确说没有」与「连不上」长得一样 ⇒ 空等。
    // ⚠️ **不折成 `unknown`**：`unknown` =「可能已生成，请到任务中心确认」，与「我这儿没这个任务」
    //   是**两个不同事实**，合并即撒谎（会把"无从判断"说成"可能已生成"）。
    case 'not-found':
      // 【D16】带可展示文案（生产者给全）：`not-found` 有两种成因（行不存在 / 后端从未持有该行），
      // 由后端各自给出，前端原样透出 —— 前端不再自拼错误文案（消费者只转发，三铁律）。
      return json(res, { code: 0, data: { status: 'not-found', error: st.error } });
    default: {
      // 【穷尽性守卫】走到这里 ⇒ `RelayTaskStatus` 新增了状态而本函数漏处理（此时 `st` 不是 `never` ⇒ 编译红）。
      const _exhaustive: never = st;
      return _exhaustive;
    }
  }
}
