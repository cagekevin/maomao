/**
 * lovart index — 顶层入口全链路（C1 返回形状 + B5 端到端模型必显式）
 * ------------------------------------------------------------
 * 注入 fake transport + fake fetch（参考图走 base64 不经下载）+ 小延迟，不打真上游。
 * 覆盖：generateImageLovart 返回 string[]、video 返回 {url}；整条链上 send 请求体
 *       含 tool_config.prefer_tool_categories（B5），prompt 含可读模型名（B6）。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const src = path.join(__dirname, '..', 'src');
const toUrl = (p) => 'file:///' + p.split(path.sep).join('/');

const {
  generateImageLovart,
  generateVideoLovart,
  submitLovartTask,
  pollLovartTaskOnce,
  chatLovartText,
} = await import(toUrl(path.join(src, 'ai-relay/providers/lovart/index.ts')));
const { LovartError } = await import(
  toUrl(path.join(src, 'ai-relay/providers/lovart/lovart_errors.ts'))
);

// projectCacheFile 指向临时文件，避免把 .lovart_project.json 写进仓库 cwd。
const PROFILE = {
  baseUrl: 'https://fake',
  auth: { type: 'hmac', accessKey: 'ak', secretKey: 'sk' },
  pollIntervalMs: 0,
  doneRecheckMs: 0,
  timeoutMs: 5000,
  projectCacheFile: path.join(
    os.tmpdir(),
    `lovart_index_proj_${Date.now()}_${Math.random().toString(16).slice(2)}.json`,
  ),
};

function makeTransport(projectId = 'proj-x') {
  const sendBodies = [];
  let createCount = 0;
  const transport = async (opts) => {
    if (opts.path === '/v1/openapi/project/save') {
      createCount += 1;
      return json({ code: 0, data: { project_id: projectId } });
    }
    if (opts.path === '/v1/openapi/project/validate')
      return json({ code: 0, data: { valid: true } });
    if (opts.path === '/v1/openapi/mode/set') return json({ code: 0, data: {} });
    if (opts.path === '/v1/openapi/chat') {
      sendBodies.push(opts.body);
      return json({ code: 0, data: { thread_id: 't-1' } });
    }
    if (opts.path === '/v1/openapi/chat/status') return json({ code: 0, data: { status: 'done' } });
    if (opts.path === '/v1/openapi/chat/result')
      return json({
        code: 0,
        data: { items: [{ type: 'image', artifacts: [{ content: 'http://cdn/r.png' }] }] },
      });
    if (opts.path === '/v1/openapi/file/upload')
      return json({ code: 0, data: { url: 'http://cdn/up.png' } });
    return json({ code: 0, data: {} });
  };
  return { transport, sendBodies, getCreateCount: () => createCount };
}
function json(obj) {
  return { response: new Response(JSON.stringify(obj), { status: 200 }), resolvedBaseUrl: 'x' };
}

test('C1+B5+B6 generateImageLovart 返回 string[]，send 请求体含 tool_config 且 prompt 含模型名', async () => {
  const t = makeTransport();
  const out = await generateImageLovart(
    { ...PROFILE, transport: t.transport },
    {
      model: 'gpt-image-2-low',
      prompt: 'a red dog',
      size: '1024x1024',
    },
  );
  assert.ok(Array.isArray(out));
  assert.deepEqual(out, ['http://cdn/r.png']);
  assert.equal(t.getCreateCount(), 1, 'project 建 1 次');
  assert.equal(t.sendBodies.length, 1);
  const sendBody = t.sendBodies[0];
  assert.equal(sendBody.project_id, 'proj-x');
  // 对齐 Lovart：质量不烤进工具名，tool_hint=基础工具名（无 _low 后缀）
  assert.deepEqual(
    sendBody.tool_config.prefer_tool_categories.IMAGE,
    ['generate_image_gpt_image_2'],
    'B5 端到端结构化路（tool_hint=基础工具名）',
  );
  // 双保险 prompt 硬约束：质量模型去后缀 + 中文质量子句（对齐 Lovart 解析格式）
  assert.match(
    sendBody.prompt,
    /用 GPT Image 2，质量 low。 Generate exactly ONE image using the GPT Image 2 model, quality low\./,
    'B6 自然语言路句子内嵌硬约束（模型去后缀 + 质量独立）',
  );
  // 尺寸走 target_size（对齐 main，非 [size:] 标签）
  assert.match(sendBody.prompt, /target_size: 1024x1024/, 'C3 尺寸 target_size');
});

test('C1 generateVideoLovart 返回 { url }', async () => {
  const t = makeTransport();
  const out = await generateVideoLovart(
    { ...PROFILE, transport: t.transport },
    {
      model: 'seedance-2',
      variables: { prompt: 'a wave' },
      protocol: undefined, // adapter 不走声明式引擎，不需要 protocol
    },
  );
  assert.deepEqual(out, { url: 'http://cdn/r.png' });
  assert.equal(t.sendBodies[0].project_id, 'proj-x');
});

test('B8 对齐 main：公网 http 参考图直接透传（不下载不上传 CDN），不阻断', async () => {
  const t = makeTransport();
  // 公网 URL 直接作为 attachment 透传，fetch 不被调用
  let fetchCalled = 0;
  const fetchImpl = async () => {
    fetchCalled += 1;
    return new Response('x', { status: 200 });
  };
  const out = await generateImageLovart(
    { ...PROFILE, transport: t.transport, fetchImpl },
    { model: 'gpt-image-2-low', prompt: 'x', imageUrls: ['http://ref.example/a.png'] },
  );
  assert.deepEqual(out, ['http://cdn/r.png']);
  assert.equal(fetchCalled, 0, '公网 URL 不下载');
  assert.deepEqual(
    t.sendBodies[0].attachments,
    ['http://ref.example/a.png'],
    '公网 URL 原样透传进 attachments',
  );
});

test('B8 对齐 main：本机回环 http 下载失败 → 阻断，未进入 send（不部分成功）', async () => {
  const t = makeTransport();
  // 本机回环（Lovart 访问不到用户本机端口）需网关自下载后上传 CDN；下载失败须阻断
  const fetchImpl = async () => new Response('not found', { status: 404 });
  await assert.rejects(
    () =>
      generateImageLovart(
        { ...PROFILE, transport: t.transport, fetchImpl },
        {
          model: 'gpt-image-2-low',
          prompt: 'x',
          imageUrls: ['http://127.0.0.1:18080/files/a.png'],
        },
      ),
    (e) => e instanceof LovartError && e.type === 'upload_failed',
  );
  assert.equal(t.sendBodies.length, 0, '下载失败不得进入 send');
});

test('B8 回环 URL 下载成功 → 上传 CDN 进 attachments（lovart cdn 态：喂回环 URL 而非预 base64）', async () => {
  const t = makeTransport();
  // 回环 URL fetch 成功返回一张 1x1 红点 PNG 字节
  const pngB64 =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
  const fetchImpl = async () =>
    new Response(Buffer.from(pngB64, 'base64'), {
      status: 200,
      headers: { 'content-type': 'image/png' },
    });
  const out = await generateImageLovart(
    { ...PROFILE, transport: t.transport, fetchImpl },
    { model: 'gpt-image-2-low', prompt: 'x', imageUrls: ['http://127.0.0.1:18080/files/a.png'] },
  );
  assert.deepEqual(out, ['http://cdn/r.png']);
  assert.equal(t.sendBodies.length, 1);
  assert.deepEqual(
    t.sendBodies[0].attachments,
    ['http://cdn/up.png'],
    '回环 URL 下载后上传 CDN 进 attachments',
  );
});

test('B8 参考图 base64 经上传成功：send 请求体 attachments 含 CDN URL', async () => {
  const t = makeTransport();
  // 1x1 红点 PNG 的 base64，fetchImpl 不经下载（data: 直接解析字节）
  const pngB64 =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
  const dataUrl = `data:image/png;base64,${pngB64}`;
  const out = await generateImageLovart(
    { ...PROFILE, transport: t.transport },
    { model: 'gpt-image-2-low', prompt: 'x', imageUrls: [dataUrl] },
  );
  assert.deepEqual(out, ['http://cdn/r.png']);
  assert.equal(t.sendBodies.length, 1);
  assert.deepEqual(
    t.sendBodies[0].attachments,
    ['http://cdn/up.png'],
    'C2 附件 URL 进 send.attachments',
  );
  assert.match(
    t.sendBodies[0].prompt,
    /Reference image attached\./,
    '参考图被正确声明（对齐 main）',
  );
  assert.match(
    t.sendBodies[0].prompt,
    /用 GPT Image 2，质量 low。 Generate exactly ONE image using the GPT Image 2 model, quality low\./,
    '生成份数+模型硬约束声明（模型去后缀 + 质量独立）',
  );
});

test('对齐 main：无前缀裸 base64（魔数识别）→ 解码上传 CDN 进 attachments', async () => {
  const t = makeTransport();
  // 1x1 红点 PNG 的裸 base64（无 data: 前缀），magic 前缀 iVBOR 触发魔数识别
  const pngB64 =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
  const out = await generateImageLovart(
    { ...PROFILE, transport: t.transport },
    { model: 'gpt-image-2-low', prompt: 'x', imageUrls: [pngB64] },
  );
  assert.deepEqual(out, ['http://cdn/r.png']);
  assert.deepEqual(
    t.sendBodies[0].attachments,
    ['http://cdn/up.png'],
    '裸 base64 上传 CDN 进 attachments',
  );
});

test('[TD-08-40] blob:/本机路径/未知形态 → 显式失败并留痕（禁止静默退化成文生图）', async () => {
  const t = makeTransport();
  // 【契约变更】原用例锁的是"drop 且不阻断"：三张参考图全被静默丢掉后请求照发、prompt 无参考图声明
  // ⇒ 「图生图」静默变「文生图」而零报错（docs/72 D-1 明令禁止的形态）。现锁新契约：显式失败 + 留痕。
  const warns = [];
  const origWarn = console.warn;
  console.warn = (...args) => warns.push(args);
  let err = null;
  try {
    await generateImageLovart(
      { ...PROFILE, transport: t.transport },
      {
        model: 'gpt-image-2-low',
        prompt: 'x',
        imageUrls: ['blob:file:///xyz-123', '/Users/me/pic.png', 'not-a-url'],
      },
    );
  } catch (e) {
    err = e;
  } finally {
    console.warn = origWarn;
  }
  assert.ok(err, '无法转换成 CDN 的参考素材必须让请求显式失败');
  assert.match(err.message, /3 个参考素材无法用于本次生成/, '文案如实给出数量与两类原因');
  assert.equal(t.sendBodies.length, 0, '不发"看似无参考图"的请求（静默降级就是撒谎）');
  const reasons = warns.map((a) => JSON.stringify(a[1] ?? '')).join('|');
  assert.match(reasons, /blob:/, 'blob: 形态留痕');
  assert.match(reasons, /本机文件路径/, '本机路径形态留痕（可指向"上游未转回环 URL"）');
  assert.match(reasons, /未知素材形态/, '未知形态留痕');
});

test('[TD-08-40] 真空素材（空串/空白）不算失败：静默返回无 attachments（与"读失败/形态违约"分开）', async () => {
  const t = makeTransport();
  // 三形态红线（CLAUDE.md §5.1）：① 真空 → 静默；②③ 形状违约/失败 → 留痕/失败。
  // 空串是"没有素材"，不是"有素材却丢了" —— 不该把用户请求拦下来。
  const out = await generateImageLovart(
    { ...PROFILE, transport: t.transport },
    { model: 'gpt-image-2-low', prompt: 'x', imageUrls: ['', '   '] },
  );
  assert.deepEqual(out, ['http://cdn/r.png']);
  assert.ok(!('attachments' in t.sendBodies[0]), '真空不挂 attachments');
});

// ── 统一异步原语（ADAPTER_SPEC §2）：submitTask → pollTaskOnce ──

/** 支持状态序列的 transport：status 按队列依次弹；result 恒定多产物。 */
function makeAsyncTransport() {
  const statusQueue = [];
  const confirms = [];
  const transport = async (opts) => {
    if (opts.path === '/v1/openapi/project/save')
      return json({ code: 0, data: { project_id: 'proj-x' } });
    if (opts.path === '/v1/openapi/project/validate')
      return json({ code: 0, data: { valid: true } });
    if (opts.path === '/v1/openapi/mode/set') return json({ code: 0, data: {} });
    if (opts.path === '/v1/openapi/chat') return json({ code: 0, data: { thread_id: 't-async' } });
    if (opts.path === '/v1/openapi/chat/confirm') {
      confirms.push(opts.body.thread_id);
      return json({ code: 0, data: {} });
    }
    if (opts.path === '/v1/openapi/chat/status')
      return json({
        code: 0,
        data: { status: statusQueue.length ? statusQueue.shift() : 'running' },
      });
    if (opts.path === '/v1/openapi/chat/result')
      return json({
        code: 0,
        data: { items: [{ type: 'image', artifacts: [{ content: 'http://cdn/async.png' }] }] },
      });
    return json({ code: 0, data: {} });
  };
  return { transport, statusQueue, confirms };
}

test('异步原语：submitTask 返回可序列化句柄（含 thread_id），不等终态', async () => {
  const t = makeAsyncTransport();
  const handle = await submitLovartTask(
    { ...PROFILE, transport: t.transport },
    { model: 'gpt-image-2-low', prompt: 'a cat', capability: 'IMAGE' },
  );
  assert.ok(handle.threadId, '句柄含 thread_id');
  assert.equal(handle.threadId, 't-async');
  // 句柄可 JSON 序列化（DB 落库/重启恢复）
  const round = JSON.parse(JSON.stringify(handle));
  assert.equal(round.threadId, 't-async');
});

test('异步原语：pollTaskOnce 按状态序列 running→completed 归一', async () => {
  const t = makeAsyncTransport();
  t.statusQueue.push('running', 'done', 'done'); // running → 复核 done → completed
  const r1 = await pollLovartTaskOnce(
    { ...PROFILE, transport: t.transport },
    { handle: { threadId: 't-async', projectId: 'proj-x' } },
  );
  assert.equal(r1.status, 'running');
  const r2 = await pollLovartTaskOnce(
    { ...PROFILE, transport: t.transport },
    { handle: { threadId: 't-async', projectId: 'proj-x' } },
  );
  assert.equal(r2.status, 'completed');
  assert.deepEqual(r2.urls, ['http://cdn/async.png']);
});

test('异步原语：pollTaskOnce abort → failed', async () => {
  const t = makeAsyncTransport();
  t.statusQueue.push('abort');
  const r = await pollLovartTaskOnce(
    { ...PROFILE, transport: t.transport },
    { handle: { threadId: 't-async', projectId: 'proj-x' } },
  );
  assert.equal(r.status, 'failed');
});

test('异步原语：pollTaskOnce pending_confirmation → auto-confirm → running', async () => {
  const t = makeAsyncTransport();
  t.statusQueue.push('pending_confirmation');
  const r = await pollLovartTaskOnce(
    { ...PROFILE, transport: t.transport },
    { handle: { threadId: 't-async', projectId: 'proj-x' } },
  );
  assert.equal(r.status, 'running', 'confirm 后应判 running，下一轮续查');
  assert.equal(t.confirms.length, 1, '触发一次 confirm');
});

test('chatLovartText 非流式：send→poll→抽 text，返回整段文本（对齐 Lovart chat 同步语义）', async () => {
  // result 返回 text 型 items
  const transport = async (opts) => {
    if (opts.path === '/v1/openapi/project/save')
      return json({ code: 0, data: { project_id: 'proj-x' } });
    if (opts.path === '/v1/openapi/project/validate')
      return json({ code: 0, data: { valid: true } });
    if (opts.path === '/v1/openapi/mode/set') return json({ code: 0, data: {} });
    if (opts.path === '/v1/openapi/chat') return json({ code: 0, data: { thread_id: 't-chat' } });
    if (opts.path === '/v1/openapi/chat/status') return json({ code: 0, data: { status: 'done' } });
    if (opts.path === '/v1/openapi/chat/result')
      return json({ code: 0, data: { items: [{ type: 'text', text: '你好，我是助手。' }] } });
    return json({ code: 0, data: {} });
  };
  const text = await chatLovartText(
    { ...PROFILE, transport },
    { model: 'lovart-chat', messages: [{ role: 'user', content: '你好' }] },
  );
  assert.equal(text, '你好，我是助手。');
});

test('chatLovartText：上游 done 但无文本 → 抛错并带出上游 result 原文（禁止静默变空串）', async () => {
  // 复现线上形态：status done + items 里没有任何 text（只有素材）⇒ 旧行为 return ''，
  // 前端只能转发兜底句「上游未返回文本内容」，上游真身丢失。
  const transport = async (opts) => {
    if (opts.path === '/v1/openapi/project/save')
      return json({ code: 0, data: { project_id: 'proj-x' } });
    if (opts.path === '/v1/openapi/project/validate')
      return json({ code: 0, data: { valid: true } });
    if (opts.path === '/v1/openapi/mode/set') return json({ code: 0, data: {} });
    if (opts.path === '/v1/openapi/chat') return json({ code: 0, data: { thread_id: 't-empty' } });
    if (opts.path === '/v1/openapi/chat/status') return json({ code: 0, data: { status: 'done' } });
    if (opts.path === '/v1/openapi/chat/result')
      return json({
        code: 0,
        data: { items: [{ type: 'image', artifacts: [{ content: 'http://cdn/r.png' }] }] },
      });
    return json({ code: 0, data: {} });
  };
  // 原文要由**后端**发出来（生产者留痕），文案只给人话 —— 故这里同时钉两件事：
  //   ① console.error 里带上游 result 原文（直出字符串，不经前端 logger 的 JSON 二次转义）；
  //   ② 错误 message 不含原文（否则会随 `data.error` 被前端 `JSON.stringify(detail)` 转义成 `\"`）。
  const logged = [];
  const origError = console.error;
  console.error = (...args) => logged.push(args.join(' '));
  try {
    await assert.rejects(
      () =>
        chatLovartText(
          { ...PROFILE, transport },
          { model: 'lovart-chat', messages: [{ role: 'user', content: '写剧本' }] },
        ),
      (e) => {
        assert.ok(e instanceof LovartError, '应抛 LovartError');
        assert.match(e.message, /上游 result 为空/, '文案给人话 + 指针');
        assert.ok(!e.message.includes('cdn/r.png'), '原文不进文案（避免前端日志二次转义）');
        return true;
      },
    );
  } finally {
    console.error = origError;
  }
  assert.ok(
    logged.some((s) => s.includes('上游 result 原文') && s.includes('http://cdn/r.png')),
    '上游 result 原文必须由后端留痕发出（唯一能看到真身的一方）',
  );
});

test('chatLovartText：上游给了 failures 原因 → 错误文案用**上游原话**（不再自编"未返回文本内容"）', async () => {
  const reason =
    'API Error (provider:API_CONTENT_POLICY): Content policy violation: the prompt was rejected';
  const transport = async (opts) => {
    if (opts.path === '/v1/openapi/project/save')
      return json({ code: 0, data: { project_id: 'proj-x' } });
    if (opts.path === '/v1/openapi/project/validate')
      return json({ code: 0, data: { valid: true } });
    if (opts.path === '/v1/openapi/mode/set') return json({ code: 0, data: {} });
    if (opts.path === '/v1/openapi/chat') return json({ code: 0, data: { thread_id: 't-fail' } });
    if (opts.path === '/v1/openapi/chat/status') return json({ code: 0, data: { status: 'done' } });
    if (opts.path === '/v1/openapi/chat/result')
      return json({
        code: 0,
        data: {
          thread_id: 't-fail',
          status: 'done',
          items: [],
          failures: [{ tool: 'generate_media', code: 'TOOL_FAILED', message: reason }],
        },
      });
    return json({ code: 0, data: {} });
  };
  const origError = console.error;
  console.error = () => {};
  try {
    await assert.rejects(
      () =>
        chatLovartText(
          { ...PROFILE, transport },
          { model: 'lovart-chat', messages: [{ role: 'user', content: '写剧本' }] },
        ),
      (e) => {
        assert.equal(e.message, reason, '必须原样透传上游 failures 的原话');
        return true;
      },
    );
  } finally {
    console.error = origError;
  }
});
