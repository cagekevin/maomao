/**
 * upstream/openaiCompatibleText — OpenAI 兼容文本生成（上游调用）。
 *
 * 从原项目 `services/ai/generateText.ts` 抽取，保留其真实逻辑。
 * 去掉了画布专属的 `@node` 提示词解析：中转站调用方直接给干净的 messages。
 *
 * 上游请求形态（原样）：
 *   POST {baseUrl}/chat/completions
 *   body: { model, messages, stream:false }
 *   headers: Authorization: Bearer {apiKey}
 * 响应解析：choices[0].message.content（含 DeepSeek 等简化格式兜底）
 */
import { buildAuthHeaders, parseResponseError } from './httpUtils';
import { corsSafeFetch } from '../core/transport';
import { extractModelName, parseGeneralTextResponse } from './helpers';

export interface OpenAIChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | Array<{
    type: string;
    text?: string;
    image_url?: { url: string };
  }>;
  tool_call_id?: string;
  tool_calls?: unknown;
}

export interface OpenAITextOptions {
  /** 上游完整地址（含 /v1，如 https://api.example.com/v1）。 */
  baseUrl: string;
  apiKey: string;
  /** 发给上游的模型名（已按渠道映射解析好）。 */
  model: string;
  messages: OpenAIChatMessage[];
  /** 追加到末尾的图片 URL（VLM 多模态）。 */
  imageUrls?: string[];
  signal?: AbortSignal;
}

/** OpenAI 兼容文本生成；返回模型回复文本。 */
export async function generateOpenAIText(options: OpenAITextOptions): Promise<string> {
  const { baseUrl, apiKey, model, messages, imageUrls, signal } = options;
  const apiUrl = baseUrl.replace(/\/+$/, '') + '/chat/completions';

  const payloadMessages: OpenAIChatMessage[] = messages.length > 0
    ? messages
    : [{ role: 'user', content: '' }];

  // 附加的图片（如参考帧）接在最后一条消息后
  let finalMessages = payloadMessages;
  if (imageUrls?.length) {
    const last = payloadMessages[payloadMessages.length - 1];
    const content = Array.isArray(last.content)
      ? last.content
      : [{ type: 'text', text: typeof last.content === 'string' ? last.content : '' }];
    finalMessages = [
      ...payloadMessages.slice(0, -1),
      { ...last, content: [
        ...content,
        ...imageUrls.map((url) => ({ type: 'image_url', image_url: { url } })),
      ] },
    ];
  }

  const response = await corsSafeFetch(apiUrl, {
    method: 'POST',
    headers: buildAuthHeaders(apiKey),
    body: JSON.stringify({ model, messages: finalMessages, stream: false }),
    signal,
  });

  if (!response.ok) {
    await parseResponseError(response, `API 请求失败 (${response.status})`);
  }

  const json = await response.json() as Record<string, unknown>;
  const replyText = parseGeneralTextResponse(json);
  if (!replyText) throw new Error('模型返回结果为空');
  return replyText;
}

export { extractModelName };
