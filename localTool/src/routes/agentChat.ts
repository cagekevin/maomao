/**
 * 子模块 — AI 操控画布：A1 本地 Agent chat（SSE 透传）
 *
 * 定位（见 docs/27-AI操控画布-定稿方案.md）：
 * - 官方 A1 画布助手前端黑盒已内置完整闭环（30 画布工具 + Agent 多轮循环 + 浏览器端
 *   实时执行器 lr()）。后端只缺一个「支持 tools/tool_calls 的 LLM 中转端点」。
 * - 本处理器接收前端 POST /api/agent/:id/chat，把 messages+tools 透传给一个支持
 *   function calling 的 OpenAI 兼容 LLM，并原样透传 SSE（含 tool_calls delta）。
 *
 * ⚠️ 关键前提（docs/27 §4）：
 * - 现有 apimart-gateway /v1/chat 是 Lovart 纯中转，【不返回 tool_calls】，
 *   无法驱动 A1 工具循环。故必须配一个支持 function calling 的 OpenAI 兼容端点。
 *
 * 配置：全量走 localTool/.env（无 dotenv 依赖，由 index.ts 启动时 loadDotEnv() 注入）。
 * 换 LLM（DeepSeek/魔搭/通义/OpenAI）只改 .env，不用动代码：
 * - LLM_CHAT_BASE_URL             支持 function calling 的 OpenAI 兼容端点（必配）
 * - LLM_CHAT_API_KEY              该端点密钥
 * - LLM_CHAT_MODEL                模型 ID（必配；覆盖前端传来的 defaultModel）
 * - LLM_CHAT_TIMEOUT_MS           上游总超时毫秒（含流透传，默认 120000）
 * - AI_CANVAS_ENHANCE             '0' 关闭「画布操作准则」system 注入，默认开
 * - AI_CANVAS_SYSTEM_PROMPT_FILE  外部准则提示词文件绝对路径；缺省用内置常量
 *
 * 实现要点（对齐 docs/27 §3.2 / §6 / §10.6）：
 * - 前端已把入参 messages 里的 role:'system' 过滤掉（shared.js:2586-2591），
 *   故后端收到的 messages 不含 system，直接 unshift 本地准则 system，不要写"追加"。
 * - 请求头声明 Accept-Encoding: identity 主动规避 gzip；若上游仍返回压缩，解压后再透传。
 * - 若上游返回非 SSE（如 JSON 错误体），读成文本、包成 `data: {json}\n\n` 再写回，
 *   避免前端因缺 data: 前缀解析失败。
 * - 工具调用 delta（id/name/arguments 分片）由前端累积器合并，后端无需处理。
 * - 多轮上下文由前端每轮带全量 messages，本层无状态透传即可。
 */

import type { IncomingMessage, ServerResponse } from 'node:http';
import { Readable } from 'node:stream';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createGunzip, createInflate, createBrotliDecompress } from 'node:zlib';
import { parseJsonBody, sendError } from '../utils/helpers.js';
import { fetchWithProxy } from '../utils/netProxy.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── 配置集中读取（惰性，.env 由 index.ts 启动时注入）──
interface AgentChatConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
  timeoutMs: number;
  enhance: boolean;
  rules: string;
}
function getConfig(): AgentChatConfig {
  // 准则提示词：可用外部文件覆盖（LLM_CHAT_SYSTEM_PROMPT_FILE），否则用内置常量。
  let rules = CANVAS_AGENT_RULES;
  const rulesFile = process.env.AI_CANVAS_SYSTEM_PROMPT_FILE;
  if (rulesFile) {
    try {
      rules = fs.readFileSync(path.resolve(rulesFile), 'utf-8');
    } catch {
      console.error(`[agent-chat] 读不到准则文件 "${rulesFile}"，回退内置常量`);
    }
  }
  return {
    baseUrl: process.env.LLM_CHAT_BASE_URL || '',
    apiKey: process.env.LLM_CHAT_API_KEY || '',
    model: process.env.LLM_CHAT_MODEL || '',
    timeoutMs: Number(process.env.LLM_CHAT_TIMEOUT_MS) || 120_000,
    enhance: process.env.AI_CANVAS_ENHANCE !== '0', // 默认开启准则注入
    rules,
  };
}

/** 前端系统 prompt 中已含 A1 自身约束；本地准则仅做「画布操作范式」增强。 */
const CANVAS_AGENT_RULES = `你是 1mao 画布助手，正在帮助用户操作当前打开的画布。

【基本原则】
- 用户要求操作画布时，默认目标就是当前已打开的画布。先调用 list_nodes 了解现有节点，
  再执行任务；不要臆造节点 id，不要假设画布为空。
- 不要模拟鼠标点击，不要要求用户手动复制 JSON。直接用工具完成画布操作。

【读取】
- 操作前先 list_nodes（获取全部节点 id/type/标题/坐标）。
- 需要看节点内容时用 get_node_details；需要连线结构用 list_edges。

【创建】
- 新建节点用 create_node，type 枚举：textNode（文本）、promptNode（提示词/生成配置）、
  discountVideoNode（视频）、imageNode（图片）。
- 提示词/生成配置节点务必填 prompt；图片节点填 label 作说明。
- 批量创建多个同类节点用 batch_create_nodes；多个并行连线用 batch_connect_nodes。

【修改与生成】
- 改节点用 update_node（白名单字段 prompt/label/selectedModel/aspectRatio/resolution/seconds/text）。
- 改任意原始字段才用 update_node_raw，且只改必要字段，不要抹掉其他 data。
- 用户要求生成内容时，用 trigger_generation 触发已有节点（先确保该节点有提示词），
  或 create_node(promptNode, prompt=...) 后 trigger_generation。
- 生成任务提交后应说明「已在画布开始生成」，不要在没有结果时声称「已生成」。

【组织】
- 相关节点用 connect_nodes 连线表达数据流（source→target）。
- 调整布局用 move_node；删除用 delete_node（会连带删线）。
- 放大/缩小视口用 zoom_in/zoom_out；定位节点用 focus_node。`;

/**
 * 把上游 response body 解码成 Node Readable 流（按 content-encoding 解压）。
 * 本地/未压缩直通；gzip/deflate/br 自动解压。
 */
function decodeUpstreamBody(upstream: Response): Readable {
  const bodyStream = Readable.fromWeb(upstream.body as any);
  const ce = (upstream.headers.get('content-encoding') || '').toLowerCase();
  if (ce.includes('gzip')) return bodyStream.pipe(createGunzip());
  if (ce === 'deflate') return bodyStream.pipe(createInflate());
  if (ce === 'br') return bodyStream.pipe(createBrotliDecompress());
  return bodyStream;
}

/**
 * 逐块透传上游 SSE 字节流。
 * - 上游声明 SSE 且非压缩 → 原样透传（前端自己解析 data: 前缀与 tool_calls delta）。
 * - 上游压缩 → 先解压再透传。
 * - 非 SSE 由调用方单独处理（见 handleAgentChat）。
 */
async function pipeUpstreamBody(res: ServerResponse, upstream: Response): Promise<void> {
  const stream = decodeUpstreamBody(upstream);
  try {
    for await (const chunk of stream) {
      if (!res.writableEnded) res.write(chunk);
    }
  } catch (e) {
    const msg = String((e as Error)?.message || e).replace(/"/g, '\\"');
    if (!res.writableEnded) res.write(`data: {"error":"${msg}"}\n\n`);
  } finally {
    if (!res.writableEnded) res.end();
  }
}

/**
 * POST /api/agent/:id/chat — A1 画布助手聊天（SSE 透传）。
 * - 接收前端组装好的 { messages, tools, tool_choice, stream, temperature }。
 * - 可选插入「画布操作准则」system（默认开启，AI_CANVAS_ENHANCE='0' 关闭）。
 * - 透传到支持 function calling 的 LLM，原样回传 SSE（含 tool_calls delta）。
 */
export async function handleAgentChat(
  req: IncomingMessage,
  res: ServerResponse,
  agentId: string,
): Promise<void> {
  const cfg = getConfig();
  if (!cfg.baseUrl) {
    return sendError(res, 'LLM_CHAT_BASE_URL not configured (see localTool/.env)', 500);
  }

  // 1. 读 body（保留前端信号以便取消透传）
  let payload: Record<string, unknown>;
  try {
    payload = (await parseJsonBody(req)) as Record<string, unknown>;
  } catch {
    return sendError(res, 'invalid json', 400);
  }
  if (!payload || typeof payload !== 'object') {
    return sendError(res, 'invalid json', 400);
  }

  const { model, messages, tools, tool_choice, temperature } = payload;
  if (!Array.isArray(messages) || messages.length === 0) {
    return sendError(res, 'messages required', 400);
  }

  const msgs = [...(messages as Record<string, unknown>[])];

  // 2. 可选插入「画布操作准则」system（前端已过滤入参 system，直接 unshift）
  if (cfg.enhance) {
    msgs.unshift({ role: 'system', content: cfg.rules });
  }

  // 3. 透传上游（带超时，覆盖整个请求+流透传；前端取消信号联动）
  const controller = new AbortController();
  const frontSignal = (req as any).signal as AbortSignal | undefined;
  if (frontSignal) frontSignal.addEventListener('abort', () => controller.abort());

  let upstream: Response;
  try {
    // 用 fetchWithProxy：外部 LLM（魔搭/DeepSeek 等）在本机可能需经代理才能访问（同 Lovart）。
    // 注意：若走代理，SSE 流式会被缓冲成一次性返回（打字机效果退化），但功能正确、
    // 前端仍能解析 tool_calls 并执行画布操作。
    upstream = await fetchWithProxy(cfg.baseUrl, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'Accept-Encoding': 'identity', // 主动规避 gzip（见 §10.6）
        ...(cfg.apiKey ? { Authorization: `Bearer ${cfg.apiKey}` } : {}),
      },
      body: JSON.stringify({
        // 模型：优先 env 配置的 LLM_CHAT_MODEL（覆盖前端传来的 defaultModel，如 gpt-4o-mini）
        model: cfg.model || (model as string),
        messages: msgs,
        ...(Array.isArray(tools) && tools.length
          ? { tools, tool_choice: (tool_choice as string) || 'auto' }
          : {}),
        stream: true,
        temperature: typeof temperature === 'number' ? temperature : 0.6,
      }),
    });
  } catch (e) {
    return sendError(res, `upstream error: ${(e as Error).message}`, 502);
  }

  // 4. SSE 透传
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  });
  res.flushHeaders?.();

  // 超时覆盖整个透传阶段（不只连接）：流透传期间若上游挂起，仍会断流
  const timer = setTimeout(() => controller.abort(), cfg.timeoutMs);

  const ctype = (upstream.headers.get('content-type') || '').toLowerCase();

  // 4.1 上游是 SSE → 原样透传（含 tool_calls delta）
  if (ctype.includes('text/event-stream')) {
    console.log(`[agent-chat] ${agentId} | SSE 透传开始 | ${cfg.baseUrl} | ${new Date().toISOString().replace('T',' ').slice(0,19)}`);
    try {
      await pipeUpstreamBody(res, upstream);
    } finally {
      clearTimeout(timer);
    }
    return;
  }

  // 4.2 上游非 SSE（如 JSON 错误体）→ 读文本、包成 data: 行再写回（见 §6/§10.6）
  try {
    const stream = decodeUpstreamBody(upstream);
    let text = '';
    for await (const chunk of stream) text += chunk.toString('utf-8');

    if (!res.writableEnded) {
      // 若上游是合法 JSON，原样塞进 data: 行（保持 JSON 不被破坏）；
      // 否则按 SSE 文本行输出，仅转义换行避免打断 data: 协议。
      let line: string;
      try {
        line = JSON.stringify(JSON.parse(text)); // 合法 JSON → 原样重序列化
      } catch {
        line = text.replace(/\r?\n/g, '\\n'); // 非 JSON → 转义换行
      }
      res.write(`data: ${line}\n\n`);
      res.write('data: [DONE]\n\n');
    }
  } catch (e) {
    const msg = String((e as Error)?.message || e).replace(/"/g, '\\"');
    if (!res.writableEnded) res.write(`data: {"error":"${msg}"}\n\n`);
  } finally {
    clearTimeout(timer);
    if (!res.writableEnded) res.end();
  }
}
