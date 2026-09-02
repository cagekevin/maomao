/**
 * types/stream — 流式响应的事件类型。
 *
 * 取自 AI-Canvas-tauri 的 `src/types/chat.ts`，只保留流式通道需要的部分，
 * 去掉画布命令、对话消息等业务类型，让传输层可以独立使用。
 */

export type StreamPhase = 'connecting' | 'responding' | 'planning';

export type FinishReason = 'stop' | 'length' | 'canceled' | 'error';

/** 一次工具调用的完整参数（流式 delta 拼完后产出）。 */
export interface ProposedToolCall {
  callId: string;
  toolId: string;
  input: unknown;
}

export type AssistantStreamEvent =
  | { type: 'start'; requestId: string; modelId: string }
  | { type: 'text.delta'; delta: string }
  | { type: 'status'; phase: StreamPhase; message?: string }
  | { type: 'conversation.title'; title: string }
  | { type: 'tool.call.delta'; callId: string; delta: string }
  | { type: 'tool.call.final'; call: ProposedToolCall }
  | { type: 'tool.result'; result: { callId: string; ok: boolean; summary: string } }
  | { type: 'usage'; inputTokens?: number; outputTokens?: number }
  | { type: 'error'; code: string; message: string; retryable: boolean }
  | { type: 'done'; finishReason: FinishReason };
