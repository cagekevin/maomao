/**
 * localTool 网络/转发层测试（依赖 mock global fetch）
 * ------------------------------------------------------------
 * 覆盖依赖出站 fetch 的模块，用替换 globalThis.fetch 的方式模拟外部响应：
 *   - official：readOfficialBase / 权益转发缓存 / stale 降级 / invalidate
 *   - passthrough：本地路径不转发 / 转发头构建 / 响应回传
 *   - system：handleGatewayTask code 转换 / 400→404 归一
 *   - files：saveRemoteUrl（fileUrl 下载落盘）
 *
 * 运行：node --test test/*.test.js
 */
import test, { beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
let TEST_DIR = '';
const src = path.join(__dirname, '..', 'src');
function toFileUrl(p) { return 'file:///' + p.split(path.sep).join('/'); }

// 模块在顶层 import（network 模块内 fetch 为运行时全局查找，替换 globalThis.fetch 有效）
const officialMod = await import(toFileUrl(path.join(src, 'routes', 'official.ts')));
const passthroughMod = await import(toFileUrl(path.join(src, 'routes', 'passthrough.ts')));
const systemMod = await import(toFileUrl(path.join(src, 'routes', 'system.ts')));
const filesMod = await import(toFileUrl(path.join(src, 'routes', 'files.ts')));
const dbMod = await import(toFileUrl(path.join(src, 'db', 'database.ts')));
const kvMod = await import(toFileUrl(path.join(src, 'routes', 'kv.ts')));
const { resetProxyCache } = await import(toFileUrl(path.join(src, 'utils', 'netProxy.ts')));

function makeRes() {
  const r = {
    status: 0, headers: {}, body: null, headersSent: false, writableEnded: false,
    writeHead(code, h) { r.status = code; if (h) r.headers = { ...r.headers, ...h }; r.headersSent = true; return r; },
    end(data) { r.writableEnded = true; if (data !== undefined) { const s = Buffer.isBuffer(data) ? data.toString('utf-8') : String(data); r.body = (r.body || '') + s; } return r; },
    write(data) { const s = Buffer.isBuffer(data) ? data.toString('utf-8') : String(data); r.body = (r.body || '') + s; return true; },
    destroy() { r.writableEnded = true; return r; },
  };
  return r;
}
function parseResBody(res) { return res.body ? JSON.parse(res.body) : null; }

function makeJsonReq(body) {
  const raw = body === undefined ? '' : JSON.stringify(body);
  const d = Buffer.from(raw);
  const req = { headers: { 'content-type': 'application/json' }, body: d };
  req.on = (ev, cb) => { if (ev === 'data' && d.length) cb(d); if (ev === 'end') cb(); return req; };
  return req;
}

const RED_PNG_B64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const RED_PNG_BUFFER = Buffer.from(RED_PNG_B64, 'base64');

// ── mock fetch 工具 ──
let realFetch = null;
const fetchLog = [];
function mockFetchOnce(handler) {
  // handler(url, init) => Response | Response 数组（顺序）
  realFetch = realFetch || globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    fetchLog.push({ url: String(url), init });
    const h = handler;
    const ret = await h(String(url), init);
    return ret;
  };
}
function restoreFetch() {
  if (realFetch) { globalThis.fetch = realFetch; realFetch = null; }
  fetchLog.length = 0;
}
function jsonResponse(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json', ...headers } });
}

beforeEach(() => {
  TEST_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'maomao-net-'));
  process.env.MAOMAO_DATA_DIR = TEST_DIR;
  if (dbMod.closeDb) dbMod.closeDb();
  resetProxyCache();
});
afterEach(() => {
  restoreFetch();
  // AI_CANVAS_SYSTEM_PROMPT_FILE 变量须逐用例清理，防止泄漏到其它用例
  delete process.env.AI_CANVAS_SYSTEM_PROMPT_FILE;
  try { dbMod.closeDb(); } catch {}
  try { fs.rmSync(TEST_DIR, { recursive: true, force: true }); } catch {}
});

// ══════════════════════════════════════════════════════════════
// official：readOfficialBase
// ══════════════════════════════════════════════════════════════

test('official·readOfficialBase 默认官方地址', async () => {
  const base = await officialMod.readOfficialBase(makeJsonReq());
  assert.equal(base, 'https://www.1mao.cc');
});

test('official·readOfficialBase x-official-base 头优先', async () => {
  const req = makeJsonReq();
  req.headers['x-official-base'] = 'https://backup.example.com';
  const base = await officialMod.readOfficialBase(req);
  assert.equal(base, 'https://backup.example.com');
});

test('official·readOfficialBase KV active_api_endpoint（非自指）', async () => {
  await kvMod.handleKvSet(makeJsonReq({ key: 'active_api_endpoint', value: 'https://alt.example.com/' }), makeRes());
  const base = await officialMod.readOfficialBase(makeJsonReq());
  assert.equal(base, 'https://alt.example.com');
});

test('official·readOfficialBase 过滤自指 KV（127.0.0.1:18080）→ 回退默认', async () => {
  await kvMod.handleKvSet(makeJsonReq({ key: 'active_api_endpoint', value: 'http://127.0.0.1:18080' }), makeRes());
  const base = await officialMod.readOfficialBase(makeJsonReq());
  assert.equal(base, 'https://www.1mao.cc', '自指值应被过滤');
});

// ══════════════════════════════════════════════════════════════
// official：权益转发（mock fetch）+ 内存缓存
// ══════════════════════════════════════════════════════════════

test('official·handleOfficialUser 转发并缓存（二次不触发 fetch）', async () => {
  await officialMod.handleOfficialInvalidate(makeJsonReq(), makeRes());
  let fetchCount = 0;
  mockFetchOnce((url) => {
    fetchCount++;
    assert.match(url, /\/api\/user\/info/, '应带 /api 前缀');
    return jsonResponse({ id: 'u1', vip: true }, 200);
  });
  const req = makeJsonReq();
  req.headers['authorization'] = 'Bearer tok-cache-111';
  req.url = '/api/user/info';
  req.headers['x-official-base'] = 'https://backup.example.com'; // 避免真实外连

  const res1 = makeRes();
  await officialMod.handleOfficialUser(req, res1);
  assert.equal(res1.status, 200);
  assert.equal(parseResBody(res1).vip, true);

  const res2 = makeRes();
  await officialMod.handleOfficialUser(req, res2);
  assert.equal(res2.status, 200);
  assert.equal(fetchCount, 1, '命中缓存，不应再次 fetch');
  assert.match(res2.headers['x-cache'] || '', /hit/);
});

test('official·handleOfficialUser 无缓存时官方 500 → 透传 500（不伪造权限）', async () => {
  // 清空模块级内存缓存，避免前序测试泄漏
  await officialMod.handleOfficialInvalidate(makeJsonReq(), makeRes());
  mockFetchOnce((url) => jsonResponse({ error: 'boom' }, 500));
  const req = makeJsonReq();
  req.headers['authorization'] = 'Bearer tok-stale-999';
  req.url = '/api/user/info';
  req.headers['x-official-base'] = 'https://backup.example.com';

  const res = makeRes();
  await officialMod.handleOfficialUser(req, res);
  // 无缓存可降级 → 透传官方 500，绝不伪造 allowed
  assert.equal(res.status, 500);
  assert.equal(parseResBody(res).error, 'boom');
});

// stale 降级要「缓存条目已过 TTL」才走得到：TTL 固定 60s，自然等待不可行。
// 用 node:test 的 mock.timers 推进 Date.now()，把 60s 压成瞬时。
// 判据（对应 official.ts forwardGet）：fresh 分支要求 hit.exp > Date.now() 才命中，
// 而 5xx 分支的 stale 只查 memCache.get(key)、不看 exp —— 故过期≠失效，正是降级要验证的点。
test('official·官方 5xx + 已过期缓存 → 降级返回旧数据并标记 hit-stale（不伪造权限）', async () => {
  await officialMod.handleOfficialInvalidate(makeJsonReq(), makeRes());
  const BASE = 1_700_000_000_000;
  // 只 mock Date（不动 setTimeout，避免影响数据库 debounce 落盘等真实计时器）
  mock.timers.enable({ apis: ['Date'] });
  mock.timers.setTime(BASE);
  try {
    const req = makeJsonReq();
    req.headers['authorization'] = 'Bearer tok-stale-777';
    req.url = '/api/user/info';
    req.headers['x-official-base'] = 'https://backup.example.com';

    // 第一次：200 → 写入缓存（exp = BASE + 60s）
    mockFetchOnce(() => jsonResponse({ id: 'u1', vip: true }, 200));
    const res1 = makeRes();
    await officialMod.handleOfficialUser(req, res1);
    assert.equal(res1.status, 200);
    assert.deepEqual(parseResBody(res1), { id: 'u1', vip: true });

    // 推进 61s > TTL 60s → fresh 分支失效（exp 过期），但条目仍在 memCache 里
    mock.timers.setTime(BASE + 61_000);

    // 第二次：上游 500 → 命中 stale 降级
    mockFetchOnce(() => jsonResponse({ error: 'boom' }, 500));
    const res2 = makeRes();
    await officialMod.handleOfficialUser(req, res2);

    assert.equal(res2.status, 200, 'stale 降级应沿用旧条目的 200，不得透传 500');
    assert.match(res2.headers['x-cache'] || '', /hit-stale/, '应标记命中 stale 缓存');
    assert.deepEqual(parseResBody(res2), { id: 'u1', vip: true }, '应返回降级前的旧数据');
  } finally {
    mock.timers.reset();
    restoreFetch();
  }
});

test('official·handleOfficialInvalidate 清缓存', async () => {
  await officialMod.handleOfficialInvalidate(makeJsonReq(), makeRes());
  let fetchCount = 0;
  mockFetchOnce((url) => { fetchCount++; return jsonResponse({ id: 'u1' }, 200); });
  const req = makeJsonReq();
  req.headers['authorization'] = 'Bearer tok-inv-222';
  req.url = '/api/user/info';
  req.headers['x-official-base'] = 'https://backup.example.com';
  await officialMod.handleOfficialUser(req, makeRes());

  const inv = makeRes();
  await officialMod.handleOfficialInvalidate(makeJsonReq(), inv);
  assert.ok(parseResBody(inv).data.removed >= 1);

  const res2 = makeRes();
  await officialMod.handleOfficialUser(req, res2);
  assert.equal(fetchCount, 2, '失效后应重新 fetch');
});

// ══ B0·official vip 本地兜底冻结（缺口⑭⑤）══
// handleOfficialVipCheck 对 canvas-assistant 且 AI_CANVAS_LOCAL !== '0' 时本地放行，
// 返 {allowed:true,reason}，绝不外发官方。冻结此形态防 B3 信封收敛误包/误改造。
test('official·vip-check 本地兜底返 {allowed:true,reason}（canvas-assistant）', async () => {
  const prev = process.env.AI_CANVAS_LOCAL;
  delete process.env.AI_CANVAS_LOCAL; // 默认开启本地放行
  let fetchCount = 0;
  mockFetchOnce((url) => { fetchCount++; return jsonResponse({ allowed: true }, 200); });
  try {
    const req = makeJsonReq();
    req.headers['authorization'] = 'Bearer tok-vip-local';
    req.url = '/api/agent/canvas-assistant/vip-check';
    const res = makeRes();
    await officialMod.handleOfficialVipCheck(req, res, new URL('http://x/api/agent/canvas-assistant/vip-check'));
    assert.equal(res.status, 200);
    assert.deepEqual(parseResBody(res), { allowed: true, reason: 'local canvas assistant' });
    assert.equal(fetchCount, 0, '本地兜底不该外发官方');
  } finally {
    if (prev === undefined) delete process.env.AI_CANVAS_LOCAL; else process.env.AI_CANVAS_LOCAL = prev;
    restoreFetch();
  }
});

// ══════════════════════════════════════════════════════════════
// passthrough
// ══════════════════════════════════════════════════════════════

test('passthrough·isLocalOnlyPath 识别本地路径', () => {
  assert.equal(passthroughMod.isLocalOnlyPath('/files/a.png'), true);
  assert.equal(passthroughMod.isLocalOnlyPath('/plugin/manifest.json'), true);
  assert.equal(passthroughMod.isLocalOnlyPath('/api/user/info'), false);
});

test('passthrough·本地路径不转发，返回 false', async () => {
  const res = makeRes();
  const handled = await passthroughMod.handlePassthrough(makeJsonReq(), res, new URL('http://x/files/img.png'));
  assert.equal(handled, false);
  assert.equal(res.body, null, '不应写响应');
});

test('passthrough·转发 GET 并流式回传（mock fetch）', async () => {
  const body = JSON.stringify({ ok: true, msg: '透传' });
  mockFetchOnce((url) => {
    assert.match(url, /^https:\/\/backup\.example\.com\/api\/hello/);
    return new Response(body, { status: 200, headers: { 'content-type': 'application/json', 'x-custom': '1' } });
  });
  const req = makeJsonReq();
  req.method = 'GET';
  req.headers['x-official-base'] = 'https://backup.example.com';
  const { Writable } = await import('node:stream');
  const chunks = [];
  const res = new Writable({ write(c, e, cb) { chunks.push(Buffer.from(c)); cb(); }, writev(items, cb) { items.forEach((i) => chunks.push(Buffer.from(i.chunk))); cb(); } });
  res.headers = {}; res.status = 0; res.headersSent = false;
  res.writeHead = (code, h) => { res.status = code; res.headers = { ...res.headers, ...h }; res.headersSent = true; return res; };

  const handled = await passthroughMod.handlePassthrough(req, res, new URL('http://x/api/hello'));
  assert.equal(handled, true);
  assert.equal(res.status, 200);
  assert.equal(Buffer.concat(chunks).toString('utf-8'), body);
});

// ══════════════════════════════════════════════════════════════
// system：handleGatewayTask
// ══════════════════════════════════════════════════════════════

test('system·handleGatewayTask 转 code 200→1 且 400→404', async () => {
  let call = 0;
  mockFetchOnce((url) => {
    call++;
    if (call === 1) return jsonResponse({ code: 200, data: { id: 't1', status: 'running' } }, 200);
    return jsonResponse({ error: 'not found' }, 400);
  });
  // 第一次：code 200 → 1
  const res1 = makeRes();
  await systemMod.handleGatewayTask(makeJsonReq(), res1, new URL('http://x/api/v1/gateway/task/t1'));
  const b1 = parseResBody(res1);
  assert.equal(b1.code, 1, 'code 200 应转为 1');
  assert.equal(res1.status, 200);
  // 第二次：上游 400 → 响应 404
  const res2 = makeRes();
  await systemMod.handleGatewayTask(makeJsonReq(), res2, new URL('http://x/api/v1/gateway/task/t2'));
  assert.equal(res2.status, 404, '上游 400 应归一为 404');
});

test('system·handleGatewayTask 缺 taskId → 400', async () => {
  const res = makeRes();
  await systemMod.handleGatewayTask(makeJsonReq(), res, new URL('http://x/api/v1/gateway/task/'));
  assert.equal(res.status, 400);
});

// ══════════════════════════════════════════════════════════════
// files：saveRemoteUrl（fileUrl 下载落盘）
// ══════════════════════════════════════════════════════════════

test('files·upload JSON fileUrl 下载落盘（幂等）', async () => {
  mockFetchOnce(async (url) => {
    assert.match(url, /https:\/\/cdn\.example\.com\/img\.png/);
    return new Response(new Uint8Array(RED_PNG_BUFFER), { status: 200, headers: { 'content-type': 'image/png' } });
  });
  const res = makeRes();
  await filesMod.handleUpload(makeJsonReq({ fileUrl: 'https://cdn.example.com/img.png', subfolder: 'canvas' }), res);
  const body = parseResBody(res);
  assert.ok(body.data.url, '应返回 url');
  assert.match(body.data.url, /^http:\/\/127\.0\.0\.1:18080\/files\/canvas\//);
  const rel = body.data.url.replace(/^http:\/\/127\.0\.0\.1:18080\/files\//, '');
  const diskPath = path.join(TEST_DIR, 'uploads', rel);
  assert.ok(fs.existsSync(diskPath), '下载文件应落盘');
  assert.ok(RED_PNG_BUFFER.equals(fs.readFileSync(diskPath)));
});

test('files·upload JSON fileUrl（URL 无后缀）→ 按响应 Content-Type 补扩展名落盘', async () => {
  mockFetchOnce(async (url) => {
    assert.match(url, /\/download$/); // 无后缀的 CDN 端点
    return new Response(new Uint8Array(RED_PNG_BUFFER), { status: 200, headers: { 'content-type': 'image/jpeg' } });
  });
  const res = makeRes();
  await filesMod.handleUpload(makeJsonReq({ fileUrl: 'https://cdn.example.com/download', subfolder: 'web' }), res);
  const body = parseResBody(res);
  assert.ok(body.data.url, '应返回 url');
  // 无后缀 URL + Content-Type image/jpeg → 落盘文件名应带 .jpg 后缀
  assert.match(body.data.url, /\/files\/web\/[0-9a-f]{16}_download\.jpg$/);
  const rel = body.data.url.replace(/^http:\/\/127\.0\.0\.1:18080\/files\//, '');
  const diskPath = path.join(TEST_DIR, 'uploads', rel);
  assert.ok(fs.existsSync(diskPath), '下载文件应落盘');
  assert.ok(RED_PNG_BUFFER.equals(fs.readFileSync(diskPath)));
});

test('files·upload JSON fileUrl（无后缀 + Content-Type 不可识别）→ 保持无后缀落盘', async () => {
  mockFetchOnce(async () => new Response(new Uint8Array(RED_PNG_BUFFER), { status: 200, headers: { 'content-type': 'application/octet-stream' } }));
  const res = makeRes();
  await filesMod.handleUpload(makeJsonReq({ fileUrl: 'https://cdn.example.com/download', subfolder: 'web' }), res);
  const body = parseResBody(res);
  // 不可识别 MIME → 不补后缀（同旧行为）
  assert.match(body.data.url, /\/files\/web\/[0-9a-f]{16}_download$/);
});

test('files·upload JSON fileUrl（无后缀）重复下载 → 幂等，带后缀最终名只落一份', async () => {
  let calls = 0;
  mockFetchOnce(async () => { calls++; return new Response(new Uint8Array(RED_PNG_BUFFER), { status: 200, headers: { 'content-type': 'image/png' } }); });
  const res1 = makeRes();
  await filesMod.handleUpload(makeJsonReq({ fileUrl: 'https://cdn.example.com/ep5579504', subfolder: 'web' }), res1);
  const res2 = makeRes();
  await filesMod.handleUpload(makeJsonReq({ fileUrl: 'https://cdn.example.com/ep5579504', subfolder: 'web' }), res2);
  const b1 = parseResBody(res1);
  const b2 = parseResBody(res2);
  // 已知取舍：无后缀 URL 每次都要下载拿 Content-Type 定最终名，但只落一份（幂等）
  assert.equal(calls, 2, '无后缀 URL 需两次下载拿 Content-Type（幂等快路径不适用）');
  assert.equal(b1.data.url, b2.data.url, '同一 URL 两次下载应返回同一最终 URL');
  assert.match(b1.data.url, /\.png$/);
  const rel = b1.data.url.replace(/^http:\/\/127\.0\.0\.1:18080\/files\//, '');
  assert.ok(fs.existsSync(path.join(TEST_DIR, 'uploads', rel)), '最终文件应落盘');
});

// ── S1 并发去重（in-flight 锁）──
// 延迟工具：让 mock fetch 在响应前挂起一小段，制造"两个并发请求重叠窗口"。
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

test('files·saveRemoteUrl 并发两请求同 URL → 底层 fetch 只调 1 次、磁盘一份', async () => {
  let calls = 0;
  mockFetchOnce(async (url) => {
    calls++;
    // 下载在途(挂起)，确保第二个并发请求到达时第一个还没释放锁 → 命中 in-flight
    await sleep(30);
    assert.match(url, /\/img\.png$/);
    return new Response(new Uint8Array(RED_PNG_BUFFER), { status: 200, headers: { 'content-type': 'image/png' } });
  });
  const opts = { fileUrl: 'https://cdn.example.com/img.png', subfolder: 'canvas' };
  // 并发发出：不 await 第一个就发第二个（结果写入各自 res）
  const res1 = makeRes();
  const res2 = makeRes();
  await Promise.all([
    filesMod.handleUpload(makeJsonReq(opts), res1),
    filesMod.handleUpload(makeJsonReq(opts), res2),
  ]);
  const b1 = parseResBody(res1);
  const b2 = parseResBody(res2);
  assert.equal(calls, 1, '并发同 URL 应只触发一次底层下载(fetch)，第二个复用 in-flight');
  assert.equal(b1.code, 0);
  assert.equal(b2.code, 0);
  assert.ok(b1.data.url && b1.data.url.startsWith('http://127.0.0.1:18080/files/canvas/'), '应返回落盘 URL');
  assert.equal(b1.data.url, b2.data.url, '两并发请求应返回同一最终 URL');
  const rel = b1.data.url.replace(/^http:\/\/127\.0\.0\.1:18080\/files\//, '');
  const diskPath = path.join(TEST_DIR, 'uploads', rel);
  assert.ok(fs.existsSync(diskPath), '下载文件应落盘');
  // 目录下只应有 1 个原图(锁防住了并发双写)
  const canvasDir = path.join(TEST_DIR, 'uploads', 'canvas');
  const files = fs.readdirSync(canvasDir).filter((f) => !f.startsWith('.'));
  assert.equal(files.length, 1, '并发同 URL 磁盘应只落 1 个文件');
});

test('files·saveRemoteUrl 顺序两请求(无后缀 URL) → 锁不缓存，仍下两次 calls=2（回归既有行为）', async () => {
  let calls = 0;
  mockFetchOnce(async () => { calls++; await sleep(5); return new Response(new Uint8Array(RED_PNG_BUFFER), { status: 200, headers: { 'content-type': 'image/png' } }); });
  const opts = { fileUrl: 'https://cdn.example.com/ep5579504', subfolder: 'web' };
  const r1 = makeRes();
  await filesMod.handleUpload(makeJsonReq(opts), r1);
  const r2 = makeRes();
  await filesMod.handleUpload(makeJsonReq(opts), r2);
  const b1 = parseResBody(r1);
  const b2 = parseResBody(r2);
  // 顺序(非并发)时锁已释放(settle 即删)，无后缀 URL 需重新下载拿 Content-Type → 与现状一致仍 2 次
  assert.equal(calls, 2, '顺序两请求(锁不重叠)应仍各下一次——证明锁不缓存结果、不改变顺序行为');
  assert.equal(b1.data.url, b2.data.url, '同一 URL 顺序两次应返回同一最终 URL');
});

test('files·saveRemoteUrl 并发同 URL 且首次下载失败 → 两请求都失败，不静默误报成功', async () => {
  let calls = 0;
  mockFetchOnce(async () => {
    calls++;
    await sleep(20);
    return new Response('boom', { status: 500, headers: { 'content-type': 'text/plain' } });
  });
  const opts = { fileUrl: 'https://cdn.example.com/fail.png', subfolder: 'canvas' };
  const res1 = makeRes();
  const res2 = makeRes();
  await Promise.all([
    filesMod.handleUpload(makeJsonReq(opts), res1),
    filesMod.handleUpload(makeJsonReq(opts), res2),
  ]);
  // 两请求共享同一 in-flight Promise → 都失败(HTTP 400)，第二个不得因等锁误报成功
  assert.equal(calls, 1, '并发失败也只在首次触发一次下载');
  assert.equal(res1.status, 400, '第一个请求应失败');
  assert.equal(res2.status, 400, '第二个请求应拿到同一失败，不得误报成功');
  const e1 = parseResBody(res1);
  const e2 = parseResBody(res2);
  assert.ok(e1?.error, '第一个请求应有失败原因');
  assert.ok(e2?.error, '第二个请求应有失败原因');
  assert.match(String(e1?.error), /Failed to download|HTTP|boom/i, '应返回真实失败原因，非泛化成功');
});

