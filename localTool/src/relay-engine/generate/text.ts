/**
 * generate/text — 文本生成入口。
 *
 * 入参（prompt / systemPrompt / imageUrls）→ OpenAI 兼容 messages → 调用上游原版逻辑
 * （upstream/openaiCompatibleText，抽取自原项目 generateText.ts）。
 * 返回 { text }。
 */
import { generateOpenAIText, type OpenAIChatMessage } from '../upstream/openaiCompatibleText';
import type { GenerateTextInput, GenerateTextResult } from '../contract';

/** 组装 OpenAI Chat Completions 的 messages。 */
export function buildChatMessages(input: {
  prompt: string;
  systemPrompt?: string;
  imageUrls?: string[];
}): OpenAIChatMessage[] {
  const messages: OpenAIChatMessage[] = [];
  if (input.systemPrompt?.trim()) {
    messages.push({ role: 'system', content: input.systemPrompt });
  }
  const images = input.imageUrls?.filter((url) => url.trim()) ?? [];
  if (images.length > 0) {
    messages.push({
      role: 'user',
      content: [
        { type: 'text', text: input.prompt },
        ...images.map((url) => ({ type: 'image_url', image_url: { url } })),
      ],
    });
  } else {
    messages.push({ role: 'user', content: input.prompt });
  }
  return messages;
}

export async function generateText(input: GenerateTextInput): Promise<GenerateTextResult> {
  const modelName = typeof input.model === 'string' ? input.model : input.model.model;
  const messages = buildChatMessages(input);
  const text = await generateOpenAIText({
    baseUrl: input.connection.baseUrl,
    apiKey: input.connection.apiKey,
    model: modelName,
    messages,
    imageUrls: input.imageUrls,
    signal: input.signal,
  });
  return { text };
}
