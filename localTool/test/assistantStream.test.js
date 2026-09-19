/**
 * assistantStream — HTTP 失败响应文案（TD-18-28）
 * ------------------------------------------------------------
 * 失败响应体**不是 JSON** 时（网关 / 代理常直接回 HTML），原文片段**必须**进文案 ——
 * 旧写法用一个空 catch 把上游给的唯一线索整个丢掉，与前端 `httpClient` 的标准不一致
 * （非 JSON 错误体原文进 message，见 TD-18-22）。
 *
 * 走**公开路径** `parseNonStream` 断言（不导出内部 helper）。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseNonStream } from '../src/ai-relay/assistantStream.ts';

const HTML_502 = '<html><head><title>502 Bad Gateway</title></head><body>nginx</body></html>';

test('失败响应体非 JSON ⇒ 文案带上原文片段（不丢上游线索）', async () => {
  const events = [];
  const res = {
    ok: false,
    status: 502,
    text: async () => HTML_502,
    json: async () => {
      throw new Error('失败路径不该读 json()');
    },
  };

  await assert.rejects(() => parseNonStream(res, { onEvent: (e) => events.push(e) }));

  const errEvt = events.find((e) => e.type === 'error');
  assert.ok(errEvt, '应发出 error 事件');
  assert.ok(errEvt.message.includes('502'), `文案应含状态码，实际：${errEvt.message}`);
  assert.ok(errEvt.message.includes('Bad Gateway'), `文案应含原文片段，实际：${errEvt.message}`);
  // 截取有上限：整页 HTML 不应被灌进 UI
  assert.ok(errEvt.message.length <= 200, `文案应有长度上限，实际 ${errEvt.message.length} 字`);
});

test('retryable 口径跟随唯一真源 RETRYABLE_HTTP_STATUSES（408/429/5xx）', async () => {
  const retryableOf = async (status) => {
    const events = [];
    const res = { ok: false, status, text: async () => 'oops' };
    await assert.rejects(() => parseNonStream(res, { onEvent: (e) => events.push(e) }));
    return events.find((e) => e.type === 'error').retryable;
  };

  // 429 / 408 是这条断言的**判别点**：旧口径 `status >= 500` 会把它们漏成"不可重试"
  assert.equal(await retryableOf(429), true, '429（限流）应可重试');
  assert.equal(await retryableOf(408), true, '408（请求超时）应可重试');
  assert.equal(await retryableOf(500), true);
  assert.equal(await retryableOf(403), false, '403 是确定性失败，不可重试');
  assert.equal(await retryableOf(400), false);
});

test('失败响应体是 JSON ⇒ 取上游 error.message（不拼原文）', async () => {
  const events = [];
  const res = {
    ok: false,
    status: 400,
    text: async () => JSON.stringify({ error: { message: '模型不存在' } }),
  };

  await assert.rejects(() => parseNonStream(res, { onEvent: (e) => events.push(e) }));

  const errEvt = events.find((e) => e.type === 'error');
  assert.equal(errEvt.message, '模型不存在');
});
