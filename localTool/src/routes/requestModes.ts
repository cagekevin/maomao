/**
 * 子模块 — 请求形态层（对齐 docs/api-接入/06-实现规格 模块 2）
 *
 * 目标：让 image_request_mode 4 形态真正驱动生图端点/body/响应解析（消灭死字段，PRD 翻车点 1）；
 * 聊天新增 responses 形态（gpt-5.6 工具调用）。本文件是可验证的纯函数基准层（数据真相源，
 * 同 protocolAdapters.ts 定位）；前端 src/components/base/requestModes.js 镜像同规则供请求路径消费。
 *
 * 形态选择优先级（M2-5）：手动指定 image_request_mode > 自动探测 > 默认 openai。
 *
 * 纯函数、无 IO：不触发网络/写盘，便于单测锁定"形态分派 / body 构造 / 响应解析 / 归一问
 * 实现一变必红"的契约。
 */

export type ImageRequestMode =
  | 'openai' | 'openai-json' | 'openai-video-proxy' | 'openai-responses';

/** 生图形态白名单（与前端 ProviderForm REQUEST_MODES / SUPPORTED 保持一致）。 */
export const SUPPORTED_IMAGE_REQUEST_MODES: ImageRequestMode[] = [
  'openai', 'openai-json', 'openai-video-proxy', 'openai-responses',
];

/** 聊天形态：chat/completions（默认）vs responses。 */
export type ChatRequestMode = 'chat' | 'responses';

/**
 * 生图形态 → 端点 path（相对 provider base，供 buildTargetUrl / 转发拼装）：
 *   openai/openai-json         → images/generations
 *   openai-video-proxy         → videos
 *   openai-responses           → responses
 * 未知/空 → 默认 openai（M2-5 保守，不误判）。
 */
export function imageModePath(mode?: string | null): string {
  switch (mode) {
    case 'openai-responses': return 'responses';
    case 'openai-video-proxy': return 'videos';
    case 'openai-json':
    case 'openai':
    default: return 'images/generations';
  }
}

/** 是否 responses 形态（聊天/生图共用判断，单一真相不做域名嗅探）。 */
export function isResponsesMode(mode?: string | null): boolean {
  return mode === 'openai-responses' || mode === 'responses';
}

/**
 * responses 形态的 input 数组：文本用 input_text，参考图用 input_image（只收 image，契约 E7）。
 * @param prompt 文本提示
 * @param images 参考图 url 数组（不含则只发文本）
 */
export function buildResponsesInput(prompt: string, images: string[] = []): Array<Record<string, unknown>> {
  const input: Array<Record<string, unknown>> = [{ type: 'input_text', text: prompt }];
  for (const img of images) {
    if (typeof img === 'string' && img.trim()) input.push({ type: 'input_image', image_url: img.trim() });
  }
  return input;
}

/**
 * responses 生图请求体（M2-1 表格 openai-responses 行）。
 * 注意：responses 的 size 在 tool 内部（image_generation 工具），不在顶层。
 */
export function buildResponsesImageBody(opts: {
  model: string;
  prompt: string;
  images?: string[];
  size?: string;
  quality?: string;
}): Record<string, unknown> {
  const tool: Record<string, unknown> = { type: 'image_generation' };
  if (opts.size) tool.size = opts.size;
  return {
    model: opts.model,
    input: buildResponsesInput(opts.prompt, opts.images),
    tools: [tool],
    tool_choice: 'auto',
  };
}

/**
 * 从 responses 响应 output[] 提取生图 URL：
 * 遍历 output，取 type==='image_generation_call' 且 status==='completed' 的 result（字符串 URL）。
 */
export function parseResponsesImage(data: unknown): string | undefined {
  const output = Array.isArray((data as any)?.output) ? (data as any).output : [];
  for (const item of output) {
    if (item?.type === 'image_generation_call' && item?.status === 'completed'
      && typeof item?.result === 'string' && item.result.trim()) {
      return item.result.trim();
    }
  }
  return undefined;
}

/** 从文本提取首张图片 URL：优先 markdown ![alt](url)，兜底裸 http(s) URL（契约 H2）。 */
export function extractMarkdownImage(text: string): string | undefined {
  if (!text) return undefined;
  const md = text.match(/!\[[^\]]*\]\(([^)]+)\)/);
  if (md) return md[1].trim();
  const bare = text.match(/(https?:\/\/[^\s"'<>)]+)/);
  return bare ? bare[1].replace(/[.,;]$/, '') : undefined;
}

/**
 * responses 生图响应解析（H2 兜底链）：
 * 1) 优先 image_generation_call 的 result；
 * 2) 无则从 output_text / message.content[].output_text 里找 markdown 图片链接或裸 URL。
 */
export function parseResponsesJson(data: unknown): string | undefined {
  const direct = parseResponsesImage(data);
  if (direct) return direct;
  const output = Array.isArray((data as any)?.output) ? (data as any).output : [];
  const texts: string[] = [];
  for (const item of output) {
    if (item?.type === 'output_text' && typeof item?.text === 'string') texts.push(item.text);
    if (item?.type === 'message' && Array.isArray(item?.content)) {
      for (const c of item.content) {
        if (c?.type === 'output_text' && typeof c?.text === 'string') texts.push(c.text);
      }
    }
  }
  return extractMarkdownImage(texts.join('\n'));
}

/**
 * 工具调用归一（M2-4）：把两种格式归一成统一 tool_calls。
 *   chat/completions: message.tool_calls = [{ id, type:'function', function:{ name, arguments } }]
 *   responses:        output[] = [{ type:'function_call', name, arguments, call_id }]
 * 统一输出：{ id, type:'function', function:{ name, arguments } }, 供现有 agent 工具循环消费。
 */
export function normalizeToolCalls(source: unknown): Array<{ id?: string; type: string; function: { name: string; arguments?: string } }> {
  if (Array.isArray(source)) {
    // chat/completions 分片（SSE delta.tool_calls 也可能是一段片段，这里假定完整结构）
    const out: Array<{ id?: string; type: string; function: { name: string; arguments?: string } }> = [];
    for (const tc of source) {
      if (tc?.function && typeof tc.function.name === 'string') {
        out.push({ id: tc.id, type: 'function', function: { name: tc.function.name, arguments: tc.function.arguments } });
      } else if (tc?.type === 'function_call' && typeof tc?.name === 'string') {
        out.push({ id: tc.call_id, type: 'function', function: { name: tc.name, arguments: tc.arguments } });
      }
    }
    return out;
  }
  const output = Array.isArray((source as any)?.output) ? (source as any).output : [];
  const out: Array<{ id?: string; type: string; function: { name: string; arguments?: string } }> = [];
  for (const item of output) {
    if (item?.type === 'function_call' && typeof item?.name === 'string') {
      out.push({ id: item.call_id, type: 'function', function: { name: item.name, arguments: item.arguments } });
    }
  }
  return out;
}

/**
 * 聊天形态归一（M2-2）：chat_request_mode → 'responses' | 'chat'。默认 chat（保守，M2-5）。
 */
export function resolveChatMode(mode?: string | null): 'chat' | 'responses' {
  return isResponsesMode(mode) ? 'responses' : 'chat';
}

/**
 * responses 聊天请求体（M2-2）：input 数组 + tools 顶层 name（实测 APM 报
 * `Missing required parameter: 'tools[0].name'`，不能 function 嵌套）。
 *  - system/user/assistant 文本 → { role, content:[input_text] }；image_url → input_image；
 *  - assistant 历史 tool_calls → function_call 项；
 *  - role='tool'（工具结果）→ function_call_output（call_id + output）。
 */
export function buildResponsesChatBody(opts: {
  model: string;
  messages?: Array<Record<string, unknown>>;
  toolSchemas?: Array<Record<string, unknown>>;
  temperature?: number;
  stream?: boolean;
  responseFormat?: string;
}): Record<string, unknown> {
  const messages = opts.messages || [];
  const input: Array<Record<string, unknown>> = [];
  for (const m of messages) {
    if ((m as any)?.role === 'tool') {
      input.push({
        type: 'function_call_output',
        call_id: (m as any)?.tool_call_id || '',
        output: typeof (m as any)?.content === 'string' ? (m as any).content : JSON.stringify((m as any)?.content ?? ''),
      });
      continue;
    }
    const items = Array.isArray((m as any)?.content)
      ? (m as any).content
      : [{ type: 'input_text', text: typeof (m as any)?.content === 'string' ? (m as any).content : String((m as any)?.content ?? '') }];
    const mapped = (items || []).map((c: any) => {
      if (c?.type === 'image_url') {
        const raw = c?.image_url?.url || c?.image_url;
        return { type: 'input_image', image_url: raw, detail: c?.image_url?.detail };
      }
      if (c?.type === 'text') return { type: 'input_text', text: c.text };
      return c;
    });
    input.push({ role: (m as any)?.role, content: mapped });
    if (Array.isArray((m as any)?.tool_calls)) {
      for (const tc of (m as any).tool_calls) {
        input.push({
          type: 'function_call',
          call_id: tc?.id || '',
          name: tc?.function?.name || '',
          arguments: tc?.function?.arguments || '{}',
        });
      }
    }
  }
  const body: Record<string, unknown> = { model: opts.model, input };
  if (typeof opts.temperature === 'number') body.temperature = opts.temperature;
  if (typeof opts.stream === 'boolean') body.stream = opts.stream;
  if (opts.responseFormat) body.text = { format: { type: opts.responseFormat } };
  const toolSchemas = opts.toolSchemas || [];
  if (toolSchemas.length) {
    body.tools = toolSchemas.map((t: any) => ({
      type: 'function',
      name: t?.function?.name || t?.name || '',
      description: t?.function?.description || '',
      parameters: t?.function?.parameters || {},
    }));
    body.tool_choice = 'auto';
  }
  return body;
}

/**
 * responses 聊天响应解析（非流式，M2-2/M2-4）：
 *   output[] 的 message → content[].text 拼 content；function_call → 归一 tool_calls。
 */
export function parseResponsesChatJson(json: unknown): { content: string; toolCalls: Array<{ id?: string; type: string; function: { name: string; arguments?: string } }> } {
  const content: string[] = [];
  const toolCalls: Array<{ id?: string; type: string; function: { name: string; arguments?: string } }> = [];
  const output = Array.isArray((json as any)?.output) ? (json as any).output : [];
  for (const item of output) {
    if (item?.type === 'message' && Array.isArray(item?.content)) {
      for (const c of item.content) {
        if (c?.type === 'output_text' && typeof c?.text === 'string') content.push(c.text);
      }
    } else if (item?.type === 'function_call' && typeof item?.name === 'string') {
      toolCalls.push({ id: item.call_id || '', type: 'function', function: { name: item.name, arguments: item.arguments || '' } });
    }
  }
  return { content: content.join(''), toolCalls };
}

/**
 * responses 聊天 SSE 增量解析（M2-3，流式）：response.output_text.delta 拼文本；
 * response.reasoning_summary_text.delta 拼推理；response.function_call_arguments.delta（含 .done）
 * 拼工具名与参数。acc 与 parseSSEChunk 同构（{content, reasoning, toolCalls}）。
 */
export function parseResponsesSSEChunk(
  line: string,
  acc: { content: string; reasoning: string; toolCalls: Array<{ id?: string; type: string; function: { name: string; arguments: string } }> },
): void {
  if (!line.startsWith('data:')) return;
  const payload = line.slice(5).trim();
  if (!payload || payload === '[DONE]') return;
  try {
    const evt = JSON.parse(payload);
    const type = evt?.type;
    if (type === 'response.output_text.delta' && typeof evt?.delta === 'string') acc.content += evt.delta;
    else if (type === 'response.reasoning_summary_text.delta' && typeof evt?.delta === 'string') acc.reasoning += evt.delta;
    else if (type === 'response.response.delta' && Array.isArray(evt?.delta?.output_text)) {
      for (const o of evt.delta.output_text) if (typeof o?.text === 'string') acc.content += o.text;
    } else if (type === 'response.function_call_arguments.delta' && typeof evt?.delta === 'string') {
      acc.toolCalls[0] ||= { id: '', type: 'function', function: { name: '', arguments: '' } };
      if (typeof evt?.name === 'string') acc.toolCalls[0].function.name += evt.name;
      if (typeof evt?.call_id === 'string' && !acc.toolCalls[0].id) acc.toolCalls[0].id = evt.call_id;
      acc.toolCalls[0].function.arguments += evt.delta;
    } else if (type === 'response.function_call_arguments.done') {
      acc.toolCalls[0] ||= { id: '', type: 'function', function: { name: evt?.name || '', arguments: evt?.arguments || '' } };
      if (typeof evt?.call_id === 'string') acc.toolCalls[0].id = evt.call_id;
      if (typeof evt?.name === 'string' && !acc.toolCalls[0].function.name) acc.toolCalls[0].function.name = evt.name;
      if (typeof evt?.arguments === 'string') acc.toolCalls[0].function.arguments = evt.arguments;
    }
  } catch { /* 忽略单条解析失败 */ }
}

/**
 * 友好错误降级提示（契约 G1）：把上游原始错误翻译成中文可操作提示；未命中返回空串（调用方原样透传）。
 */
export function friendlyRequestError(text: unknown, model = '', provider: unknown = {}): string {
  const s = String(text || '').toLowerCase();
  if (/reasoning_effort/.test(s)) return '该模型不支持在 chat/completions 用工具，建议改用 responses 端点或换模型';
  if (/(?:401)|(?:unauthorized)|(?:invalid.{0,10}(?:api.?key|key))|(?:api.?key.{0,10}invalid)/.test(s)) return 'API Key 无效或已过期';
  if (/(?:429)|(?:rate\s*limit)|(?:too many requests)/.test(s)) return '请求过于频繁，稍后再试';
  if (/(?:not found)|(?:invalid endpoint)|(?:failed to find model)|(?:model.*select)/.test(s)) return '模型不存在或需改用 ep- 接入点';
  return '';
}