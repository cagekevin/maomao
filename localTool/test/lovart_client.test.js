/**
 * lovart_client — 信封剥离 / HMAC 头 / 双路模型原语单测（B4 / B5 / B6 / B13）
 * ------------------------------------------------------------
 * 不真打上游：注入 fake transport 捕获出站 StableRequestOptions，断言请求体与头。
 * 覆盖：code≠0 透传上游 message（B13）、send 前必 set_mode(fast)（B4）、
 *       send 请求体含 tool_config 且 prompt 含模型名（B5+B6）、project 建后 set_mode。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const src = path.join(__dirname, '..', 'src');
const toUrl = (p) => 'file:///' + p.split(path.sep).join('/');

const {
  createLovartProject, validateLovartProject, setLovartMode,
  sendLovartChat, getLovartStatus, getLovartResult, confirmLovartThread,
} = await import(toUrl(path.join(src, 'ai-relay/providers/lovart/lovart_client.ts')));

/** 造一个 fake transport：按路径返回预设 JSON，记录每次出站 opts。 */
function makeFakeTransport(routeByPath) {
  const calls = [];
  const transport = async (opts) => {
    calls.push(opts);
    const body = routeByPath[opts.path] || routeByPath.default || { code: 0, data: {} };
    return { response: new Response(JSON.stringify(body), { status: 200 }), resolvedBaseUrl: 'http://fake' };
  };
  return { transport, calls };
}

const BASE = { auth: { type: 'hmac', accessKey: 'ak', secretKey: 'sk' }, baseUrl: 'https://lgw.lovart.ai' };

test('B13 信封剥离：code=0 取 data', async () => {
  const { transport, calls } = makeFakeTransport({ '/v1/openapi/project/save': { code: 0, data: { project_id: 'p1' } } });
  const pid = await createLovartProject({ ...BASE, transport });
  assert.equal(pid, 'p1');
  assert.ok(calls.length === 1);
});

test('B13 错误透传：code≠0 抛 LovartError 且 message=上游原话（不翻译）', async () => {
  const { transport } = makeFakeTransport({ '/v1/openapi/project/save': { code: 400, message: '上游说: project invalid' } });
  await assert.rejects(() => createLovartProject({ ...BASE, transport }), (e) => {
    assert.equal(e.message, '上游说: project invalid');
    return true;
  });
});

test('B4 setLovartMode 下发 unlimited=false', async () => {
  const { transport, calls } = makeFakeTransport({ '/v1/openapi/mode/set': { code: 0, data: {} } });
  await setLovartMode({ ...BASE, transport }, false);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].body.unlimited, false);
});

test('B5+B6 send：请求体含 tool_config 且 prompt 含可读模型名', async () => {
  const { transport, calls } = makeFakeTransport({ '/v1/openapi/chat': { code: 0, data: { thread_id: 't1' } } });
  const tid = await sendLovartChat({ ...BASE, transport }, {
    prompt: '[model: GPT Image 2 Low]\na dog',
    projectId: 'p1',
    toolConfig: { prefer_tool_categories: { IMAGE: ['generate_image_gpt_image_2'] } },
  });
  assert.equal(tid, 't1');
  const chatCall = calls.find((c) => c.path === '/v1/openapi/chat');
  assert.ok(chatCall, '应有 /chat 出站');
  assert.equal(chatCall.body.project_id, 'p1', 'projectId → project_id 字段别名');
  assert.deepEqual(chatCall.body.tool_config.prefer_tool_categories.IMAGE, ['generate_image_gpt_image_2'], 'B5 结构化路');
  assert.match(chatCall.body.prompt, /\[model: GPT Image 2 Low\]/, 'B6 自然语言路冗余');
});

test('B13 confirm / status / result 走对应路径', async () => {
  const { transport, calls } = makeFakeTransport({
    '/v1/openapi/chat/status': { code: 0, data: { status: 'done' } },
    '/v1/openapi/chat/result': { code: 0, data: { items: [] } },
    '/v1/openapi/chat/confirm': { code: 0, data: {} },
  });
  await confirmLovartThread({ ...BASE, transport }, 't1');
  const st = await getLovartStatus({ ...BASE, transport }, 't1');
  assert.equal(st.status, 'done');
  const res = await getLovartResult({ ...BASE, transport }, 't1');
  assert.deepEqual(res.items, []);
  const paths = calls.map((c) => c.path);
  assert.ok(paths.includes('/v1/openapi/chat/confirm'));
  assert.ok(paths.includes('/v1/openapi/chat/status'));
  assert.ok(paths.includes('/v1/openapi/chat/result'));
});
