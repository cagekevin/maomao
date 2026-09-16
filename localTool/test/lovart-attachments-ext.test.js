/**
 * lovart_attachments — MIME→ext 真值源单测（TD-08-22 收口 · 2026-09-16）
 * ------------------------------------------------------------
 * 运行：cd localTool && npm test
 *
 * 【为什么存在】原 `extFromDataHeader` / `extFromContentType` 自持 `includes()` 子串链，
 * 绕过 `utils/mime.ts`（后端 MIME↔ext 唯一真源），实测错判：
 *   · `audio/aac`·`ogg`·`flac`·`wma`·`opus` → 全因 `includes('audio')` 错归 `.mp3`；
 *   · `video/mpeg` → 因 `includes('mpeg')` 错归 `.mp3`（视频错成音频）；
 *   · `image/avif`·`svg+xml` 等未列举型 → 静默兜底 `.png`。
 * 本测试钉死「扩展名来自真值源」这一契约：断言上传 CDN 的文件名后缀正确。
 *
 * 观测口径：fake transport 捕获 `file/upload` 请求体里的文件名（`data.url` 前的 name 字段），
 * 直接看扩展名 —— 不经真上游。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const src = path.join(__dirname, '..', 'src');
const toUrl = (p) => 'file:///' + p.split(path.sep).join('/');

const { generateImageLovart } = await import(
  toUrl(path.join(src, 'ai-relay/providers/lovart/index.ts'))
);

const PROFILE = {
  baseUrl: 'https://fake',
  auth: { type: 'hmac', accessKey: 'ak', secretKey: 'sk' },
  pollIntervalMs: 0,
  doneRecheckMs: 0,
  timeoutMs: 5000,
  projectCacheFile: path.join(
    os.tmpdir(),
    `lovart_att_ext_${Date.now()}_${Math.random().toString(16).slice(2)}.json`,
  ),
};

function json(obj) {
  return { response: new Response(JSON.stringify(obj), { status: 200 }), resolvedBaseUrl: 'x' };
}

/** 捕获 file/upload 的文件名（扩展名观测点）+ chat 请求体。 */
function makeTransport() {
  const sendBodies = [];
  const uploadNames = [];
  const transport = async (opts) => {
    if (opts.path === '/v1/openapi/project/save')
      return json({ code: 0, data: { project_id: 'proj-x' } });
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
    if (opts.path === '/v1/openapi/file/upload') {
      // body 是 multipart/Uint8Array 原字节：从中抽取 `filename="…"` 观测扩展名
      const raw = Buffer.isBuffer(opts.body)
        ? opts.body.toString('latin1')
        : new TextDecoder('latin1').decode(opts.body || new Uint8Array());
      const m = /filename="([^"]+)"/.exec(raw);
      if (m) uploadNames.push(m[1]);
      return json({ code: 0, data: { url: 'http://cdn/up.png' } });
    }
    return json({ code: 0, data: {} });
  };
  return { transport, sendBodies, uploadNames };
}

/** 构造一个 1x1 的任意字节 data URL（扩展名由 header 决定，与字节真伪无关）。 */
const B64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

test('TD-08-22：非 mp3 音频 mime 不再错归 .mp3（audio/aac → .aac）', async () => {
  const t = makeTransport();
  await generateImageLovart(
    { ...PROFILE, transport: t.transport },
    { model: 'gpt-image-2-low', prompt: 'x', imageUrls: [`data:audio/aac;base64,${B64}`] },
  );
  assert.ok(t.uploadNames.length >= 1, '应上传了 1 个附件');
  assert.match(t.uploadNames[0], /\.aac$/, `期望 .aac，实际 ${t.uploadNames[0]}`);
});

test('TD-08-22：video/mpeg 不再错归 .mp3（应为 .mpeg/.mp4 类而非 .mp3）', async () => {
  const t = makeTransport();
  await generateImageLovart(
    { ...PROFILE, transport: t.transport },
    { model: 'gpt-image-2-low', prompt: 'x', imageUrls: [`data:video/mpeg;base64,${B64}`] },
  );
  assert.ok(t.uploadNames.length >= 1);
  assert.ok(
    !t.uploadNames[0].endsWith('.mp3'),
    `视频 mime 不得归音频扩展名，实际 ${t.uploadNames[0]}`,
  );
});

test('TD-08-22：未列举的图片 mime 不再静默兜底 .png（image/avif → .avif）', async () => {
  const t = makeTransport();
  await generateImageLovart(
    { ...PROFILE, transport: t.transport },
    { model: 'gpt-image-2-low', prompt: 'x', imageUrls: [`data:image/avif;base64,${B64}`] },
  );
  assert.ok(t.uploadNames.length >= 1);
  assert.match(t.uploadNames[0], /\.avif$/, `期望 .avif，实际 ${t.uploadNames[0]}`);
});

test('TD-08-22：常规 mime 仍正确（回归护栏 image/png → .png、image/jpeg → .jpg）', async () => {
  const t1 = makeTransport();
  await generateImageLovart(
    { ...PROFILE, transport: t1.transport },
    { model: 'gpt-image-2-low', prompt: 'x', imageUrls: [`data:image/png;base64,${B64}`] },
  );
  assert.match(t1.uploadNames[0], /\.png$/);

  const t2 = makeTransport();
  await generateImageLovart(
    { ...PROFILE, transport: t2.transport },
    { model: 'gpt-image-2-low', prompt: 'x', imageUrls: [`data:image/jpeg;base64,${B64}`] },
  );
  assert.match(t2.uploadNames[0], /\.jpe?g$/);
});
