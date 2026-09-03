/**
 * lovart_stream — 把 Lovart 对话结果文本合成为 OpenAI chat.completion.chunk SSE。
 *
 * Lovart chat 是异步（thread→poll→result.text），这里在拿到文本后合成 SSE 流，
 * 交回 ai-relay/index.ts 的 parseStream 复用既有解析器（§6.4）。
 * chunk 形状：首块 delta.role=assistant，中间块 delta.content，末块 finish_reason=stop（B12）。
 */

const encoder = new TextEncoder();

function sseChunk(obj: unknown): string {
  return `data: ${JSON.stringify(obj)}\n\n`;
}

/** 生成合法 OpenAI chunk SSE 的 ReadableStream，封装为 Response（供 parseStream 消费）。 */
export function synthesizeLovartChatStream(text: string, signal?: AbortSignal): Response {
  // 文本按词切分，逐块 delta.content（保留空白）
  const segments: string[] = text.match(/\S+\s*|\s+/g) ?? [text];

  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (signal?.aborted) {
        controller.close();
        return;
      }
      controller.enqueue(encoder.encode(sseChunk({
        object: 'chat.completion.chunk',
        choices: [{ delta: { role: 'assistant' } }],
      })));
      for (const seg of segments) {
        if (!seg) continue;
        controller.enqueue(encoder.encode(sseChunk({
          object: 'chat.completion.chunk',
          choices: [{ delta: { content: seg } }],
        })));
      }
      controller.enqueue(encoder.encode(sseChunk({
        object: 'chat.completion.chunk',
        choices: [{ delta: {}, finish_reason: 'stop' }],
      })));
      controller.enqueue(encoder.encode('data: [DONE]\n\n'));
      controller.close();
    },
  });

  return new Response(stream, {
    headers: { 'Content-Type': 'text/event-stream; charset=utf-8' },
  });
}
