/**
 * stream — SSE / 流式响应解析器。
 *
 * 将 fetch Response.body 管道化为逐 token 事件回调，并拼接完整文本。
 * 支持标准 SSE、OpenAI 兼容的 chunk 事件、工具调用增量、UTF-8 多字节跨 chunk 拼接。
 * 对应 AI-Canvas-tauri 的 streamParsers.ts（事件形状保持一致）。
 *
 * AssistantStreamEvent 事件类型（均为普通对象）：
 *   { type: 'start', requestId, modelId }
 *   { type: 'text.delta', delta }
 *   { type: 'tool.call.delta', callId, delta }
 *   { type: 'tool.call.final', call: { callId, toolId, input } }
 *   { type: 'usage', inputTokens, outputTokens }
 *   { type: 'error', code, message, retryable }
 *   { type: 'done', finishReason }
 */

import type { AssistantStreamEvent, ParseStreamOptions } from './types.js';

interface ToolCallBufferEntry {
  callId: string;
  toolId: string;
  argumentsJson: string;
}
interface JsonChunkDelta {
  role?: string;
  content?: string;
  finish_reason?: string;
  tool_calls?: Array<{ index?: number; id?: string; function?: { name?: string; arguments?: string } }>;
}
interface JsonChunk {
  object?: string;
  choices?: Array<{ delta?: JsonChunkDelta; finish_reason?: string }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}
interface JsonMessageChoice {
  message?: {
    content?: string;
    tool_calls?: Array<{ id?: string; function?: { name?: string; arguments?: string } }>;
  };
}
interface JsonMessage {
  choices?: JsonMessageChoice[];
  usage?: { prompt_tokens?: number; completion_tokens?: number };
  error?: { message?: string };
}

function decodeUtf8Lines(bytes: Uint8Array, prevRemainder: string, decoder: TextDecoder): { lines: string[]; remainder: string } {
  const text = prevRemainder + decoder.decode(bytes, { stream: true });
  const raw = text.split('\n');
  if (text.endsWith('\n')) {
    raw.pop();
    return { lines: raw, remainder: '' };
  }
  const remainder = raw.pop() ?? '';
  return { lines: raw, remainder };
}

function parseSseEvent(lines: string[]): { event: string | undefined; data: string } | null {
  let eventName: string | undefined;
  const dataLines = [];
  for (const line of lines) {
    if (line.startsWith('event: ')) {
      eventName = line.slice(7).trim();
    } else if (line.startsWith('data: ')) {
      dataLines.push(line.slice(6));
    } else if (line === 'data:[DONE]' || line === 'data: [DONE]') {
      return { event: 'done', data: '[DONE]' };
    }
  }
  if (dataLines.length === 0) return null;
  return { event: eventName, data: dataLines.join('\n') };
}

function mapFinishReason(reason: string): string {
  if (reason === 'stop') return 'stop';
  if (reason === 'length') return 'length';
  return 'stop';
}

function parseOpenAiChunk(json: JsonChunk, requestId: string, modelId: string): AssistantStreamEvent[] {
  const events: AssistantStreamEvent[] = [];
  if (json.object === 'chat.completion.chunk' && json.choices?.[0]?.delta?.role) {
    events.push({ type: 'start', requestId, modelId });
  }
  const content = json.choices?.[0]?.delta?.content;
  if (content) {
    events.push({ type: 'text.delta', delta: content });
  }
  const finishReason = json.choices?.[0]?.finish_reason;
  if (finishReason) {
    events.push({ type: 'done', finishReason: mapFinishReason(finishReason) });
  }
  if (json.usage) {
    events.push({
      type: 'usage',
      inputTokens: json.usage.prompt_tokens ?? 0,
      outputTokens: json.usage.completion_tokens ?? 0,
    });
  }
  return events;
}

export async function parseStream(response: Response, options: ParseStreamOptions): Promise<string> {
  const { onEvent, signal } = options;
  const requestId = options.requestId || '';
  const modelId = options.modelId || '';

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '');
    let errorMsg = `请求失败 (${response.status})`;
    try {
      const err = JSON.parse(errorBody) as JsonMessage;
      errorMsg = err.error?.message || errorMsg;
    } catch { /* ignore */ }
    onEvent({ type: 'error', code: 'HTTP_ERROR', message: errorMsg, retryable: response.status >= 500 });
    onEvent({ type: 'done', finishReason: 'error' });
    throw new Error(errorMsg);
  }

  const reader = response.body?.getReader();
  if (!reader) {
    onEvent({ type: 'error', code: 'NO_BODY', message: '响应体为空', retryable: false });
    onEvent({ type: 'done', finishReason: 'error' });
    throw new Error('响应体为空');
  }

  let fullContent = '';
  let doneSent = false;
  let toolCallsFinalized = false;
  const toolCallBuffer = new Map<number, ToolCallBufferEntry>();
  let sseLines = [];
  let remainder = '';
  const decoder = new TextDecoder('utf-8', { fatal: false });

  const consumeToolCallDeltas = (json: JsonChunk): void => {
    for (const delta of json.choices?.[0]?.delta?.tool_calls ?? []) {
      const index = delta.index ?? 0;
      const current = toolCallBuffer.get(index) ?? {
        callId: delta.id || `tool-${requestId}-${index}`,
        toolId: delta.function?.name || '',
        argumentsJson: '',
      };
      if (delta.id) current.callId = delta.id;
      if (delta.function?.name) current.toolId = delta.function.name;
      if (delta.function?.arguments) {
        current.argumentsJson += delta.function.arguments;
        onEvent({ type: 'tool.call.delta', callId: current.callId, delta: delta.function.arguments });
      }
      toolCallBuffer.set(index, current);
    }
  };

  const finalizeToolCalls = () => {
    if (toolCallsFinalized) return;
    toolCallsFinalized = true;
    for (const call of toolCallBuffer.values()) {
      if (!call.toolId || !call.argumentsJson) continue;
      try {
        const input = JSON.parse(call.argumentsJson);
        onEvent({ type: 'tool.call.final', call: { callId: call.callId, toolId: call.toolId, input } });
      } catch {
        // 不完整或非法 JSON 不进入工具执行层
      }
    }
  };

  const sendDoneIfNeeded = () => {
    if (!doneSent) {
      finalizeToolCalls();
      doneSent = true;
      onEvent({ type: 'done', finishReason: 'stop' });
    }
  };

  try {
    while (true) {
      if (signal?.aborted) {
        onEvent({ type: 'done', finishReason: 'canceled' });
        doneSent = true;
        break;
      }
      const { done, value } = await reader.read();
      if (done) {
        sendDoneIfNeeded();
        break;
      }
      if (!value) continue;

      const { lines, remainder: newRemainder } = decodeUtf8Lines(value, remainder, decoder);
      remainder = newRemainder;

      for (const line of lines) {
        const trimmed = line.trimEnd();
        if (trimmed === '') {
          if (sseLines.length > 0) {
            const event = parseSseEvent(sseLines);
            sseLines = [];
            if (event) {
              if (event.data === '[DONE]') {
                sendDoneIfNeeded();
                break;
              }
              try {
                const json = JSON.parse(event.data) as JsonChunk;
                consumeToolCallDeltas(json);
                const events = parseOpenAiChunk(json, requestId, modelId);
                for (const ev of events) {
                  if (ev.type === 'done') {
                    finalizeToolCalls();
                    doneSent = true;
                  }
                  if (ev.type === 'text.delta') {
                    fullContent += ev.delta;
                  }
                  onEvent(ev);
                }
              } catch {
                // 非 JSON 的 SSE 行跳过
              }
            }
          }
          continue;
        }
        sseLines.push(trimmed);
      }
    }
  } finally {
    reader.releaseLock();
  }

  return fullContent;
}

export async function parseNonStream(response: Response, options: ParseStreamOptions): Promise<string> {
  const { onEvent } = options;

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '');
    let errorMsg = `请求失败 (${response.status})`;
    try {
      const err = JSON.parse(errorBody) as JsonMessage;
      errorMsg = err.error?.message || errorMsg;
    } catch { /* ignore */ }
    onEvent({ type: 'error', code: 'HTTP_ERROR', message: errorMsg, retryable: response.status >= 500 });
    onEvent({ type: 'done', finishReason: 'error' });
    throw new Error(errorMsg);
  }

  const json = await response.json() as JsonMessage;
  const choices = json.choices;
  const content = choices?.[0]?.message?.content || '';

  for (const [index, call] of (choices?.[0]?.message?.tool_calls ?? []).entries()) {
    const toolId = call.function?.name;
    const argumentsJson = call.function?.arguments;
    if (!toolId || !argumentsJson) continue;
    try {
      onEvent({
        type: 'tool.call.final',
        call: {
          callId: call.id || `tool-non-stream-${index}`,
          toolId,
          input: JSON.parse(argumentsJson),
        },
      });
    } catch {
      // 非法参数不触发工具
    }
  }

  const usage = json.usage;
  if (usage) {
    onEvent({ type: 'usage', inputTokens: usage.prompt_tokens ?? 0, outputTokens: usage.completion_tokens ?? 0 });
  }

  onEvent({ type: 'done', finishReason: 'stop' });
  return typeof content === 'string' ? content : '';
}
