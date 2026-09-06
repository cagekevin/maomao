/**
 * lovart_task — 轮询状态机 / AUTO_CONFIRM / task_view 整形（B10 / B11 / B9）
 * ------------------------------------------------------------
 * 不真打上游：注入 fake transport（按序列逐次返回 status）+ 注入小延迟提速。
 * 覆盖：pending_confirmation → 自动 confirm 后取 result（B10）、done 取产物（B11）、
 *       无产物抛 no_artifact、abort 抛、result 含 pending_confirmation 时 auto-confirm。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const src = path.join(__dirname, '..', 'src');
const toUrl = (p) => 'file:///' + p.split(path.sep).join('/');

const { pollLovartThread, extractLovartArtifacts, extractLovartText } = await import(
  toUrl(path.join(src, 'ai-relay/providers/lovart/lovart_task.ts'))
);

/** 快速 deps：轮询/复核延迟压到 0，避免真 sleep 拖慢。 */
const FAST = {
  pollIntervalMs: 0,
  doneRecheckMs: 0,
  timeoutMs: 5000,
  auth: { type: 'hmac', accessKey: 'ak', secretKey: 'sk' },
  baseUrl: 'https://fake',
};

function jsonResponse(obj) {
  return { response: new Response(JSON.stringify(obj), { status: 200 }), resolvedBaseUrl: 'x' };
}

test('B10 AUTO_CONFIRM：status 先 pending_confirmation → confirm → done → 取 result', async () => {
  const sequence = [
    { status: 'pending_confirmation' },
    { status: 'done' }, // confirm 后第一次轮询到 done
    { status: 'done' }, // done 复核（doneRecheckMs=0）
  ];
  const confirmed = [];
  const transport = async (opts) => {
    if (opts.path === '/v1/openapi/chat/confirm') {
      confirmed.push(opts.body.thread_id);
      return jsonResponse({ code: 0, data: {} });
    }
    if (opts.path === '/v1/openapi/chat/status') {
      return jsonResponse({ code: 0, data: sequence.shift() ?? { status: 'done' } });
    }
    if (opts.path === '/v1/openapi/chat/result') {
      return jsonResponse({
        code: 0,
        data: { items: [{ type: 'video', artifacts: [{ content: 'http://cdn/v.mp4' }] }] },
      });
    }
    return jsonResponse({ code: 0, data: {} });
  };
  const result = await pollLovartThread({ ...FAST, transport }, 't1');
  assert.equal(confirmed.length, 1, 'pending_confirmation 应触发一次 confirm');
  assert.deepEqual(extractLovartArtifacts(result), ['http://cdn/v.mp4']);
});

test('B11 done：多产物归一返回 url 列表', async () => {
  const transport = async (opts) => {
    if (opts.path === '/v1/openapi/chat/status')
      return jsonResponse({ code: 0, data: { status: 'done' } });
    if (opts.path === '/v1/openapi/chat/result') {
      return jsonResponse({
        code: 0,
        data: {
          items: [
            { type: 'image', artifacts: [{ content: 'http://cdn/a.png' }] },
            { type: 'text', text: '说明文字' },
            {
              type: 'image',
              artifacts: [{ content: 'http://cdn/a.png' }, { content: 'http://cdn/b.png' }],
            },
          ],
        },
      });
    }
    return jsonResponse({ code: 0, data: {} });
  };
  const result = await pollLovartThread({ ...FAST, transport }, 't1');
  const urls = extractLovartArtifacts(result);
  assert.deepEqual(urls, ['http://cdn/a.png', 'http://cdn/b.png'], '多产物去重归一');
});

test('B11 done 但无产物：extractLovartArtifacts 抛 no_artifact', async () => {
  const transport = async (opts) => {
    if (opts.path === '/v1/openapi/chat/status')
      return jsonResponse({ code: 0, data: { status: 'done' } });
    if (opts.path === '/v1/openapi/chat/result')
      return jsonResponse({ code: 0, data: { items: [{ type: 'text', text: 'sorry, refused' }] } });
    return jsonResponse({ code: 0, data: {} });
  };
  const result = await pollLovartThread({ ...FAST, transport }, 't1');
  assert.throws(
    () => extractLovartArtifacts(result),
    (e) => e.type === 'no_artifact',
  );
});

test('B11 abort：抛 abort', async () => {
  const transport = async (opts) => {
    if (opts.path === '/v1/openapi/chat/status')
      return jsonResponse({ code: 0, data: { status: 'abort' } });
    return jsonResponse({ code: 0, data: {} });
  };
  await assert.rejects(
    () => pollLovartThread({ ...FAST, transport }, 't1'),
    (e) => e.type === 'abort',
  );
});

test('B11 result 含 pending_confirmation：auto-confirm 后继续', async () => {
  let confirmRan = false;
  const transport = async (opts) => {
    if (opts.path === '/v1/openapi/chat/confirm') {
      confirmRan = true;
      return jsonResponse({ code: 0, data: {} });
    }
    if (opts.path === '/v1/openapi/chat/status') {
      // 先 done，复核再 done → 拿 result（含 pending_confirmation）→ 触发 confirm → 继续轮询 → done 结束
      return jsonResponse({ code: 0, data: { status: 'done' } });
    }
    if (opts.path === '/v1/openapi/chat/result') {
      if (!confirmRan)
        return jsonResponse({
          code: 0,
          data: { pending_confirmation: { tool: 'video' }, items: [] },
        });
      return jsonResponse({
        code: 0,
        data: { items: [{ artifacts: [{ content: 'http://cdn/x.mp4' }] }] },
      });
    }
    return jsonResponse({ code: 0, data: {} });
  };
  const result = await pollLovartThread({ ...FAST, transport }, 't1');
  assert.equal(confirmRan, true, 'result 含 pending_confirmation 应 auto-confirm');
  assert.deepEqual(extractLovartArtifacts(result), ['http://cdn/x.mp4']);
});

test('extractLovartText：拼接文本回复', () => {
  const result = {
    items: [
      { type: 'text', text: 'Hello ' },
      { type: 'text', text: 'world' },
    ],
  };
  assert.equal(extractLovartText(result), 'Hello world');
});
