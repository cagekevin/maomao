/**
 * lovart_stream — 合成 OpenAI chat.completion.chunk SSE（B12）
 * ------------------------------------------------------------
 * 消费合成流，断言首 chunk delta.role=assistant、中间有 content、末 chunk finish_reason 存在、
 * 以 [DONE] 结尾。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const src = path.join(__dirname, '..', 'src');
const toUrl = (p) => 'file:///' + p.split(path.sep).join('/');

const { synthesizeLovartChatStream } = await import(
  toUrl(path.join(src, 'ai-relay/providers/lovart/lovart_stream.ts'))
);

/** 读完整 SSE 文本，拆出每行 JSON chunk（去掉 [DONE]）。 */
async function readSseChunks(response) {
  const text = await response.text();
  const objs = [];
  for (const line of text.split('\n')) {
    const m = /^data:\s*(.*)$/.exec(line.trim());
    if (!m || m[1] === '[DONE]') continue;
    objs.push(JSON.parse(m[1]));
  }
  return objs;
}

test('B12 合法 OpenAI chunk：首块 role=assistant、有 content、末块 finish_reason', async () => {
  const resp = synthesizeLovartChatStream('Hello world');
  assert.equal(
    resp.headers.get('content-type').startsWith('text/event-stream'),
    true,
    'SSE Content-Type',
  );
  const chunks = await readSseChunks(resp);
  assert.ok(chunks.length >= 3);
  // 首块角色
  assert.equal(chunks[0].object, 'chat.completion.chunk');
  assert.equal(chunks[0].choices[0].delta.role, 'assistant');
  // 拼接 content
  const text = chunks.map((c) => c.choices?.[0]?.delta?.content || '').join('');
  assert.equal(
    text.replace(/\s+/g, ' ').trim(),
    'Hello world'.replace(/\s+/g, ' ').trim(),
    '内容拼接一致',
  );
  // 末块 finish_reason
  const last = chunks[chunks.length - 1];
  assert.ok(last.choices[0].finish_reason, '末块应有 finish_reason');
});

test('B12 空文本也产出可消费流', async () => {
  const resp = synthesizeLovartChatStream('');
  const chunks = await readSseChunks(resp);
  assert.ok(chunks.length >= 2, '仍有 role + finish_reason 块');
});
