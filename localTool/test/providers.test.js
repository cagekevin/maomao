/**
 * providers（多供应商）单元测试
 * ------------------------------------------------------------
 * 运行：node --test test/*.test.js        （在 localTool/ 下）
 * 注意：必须先构建使 dist 反映最新 src（npm test 会先跑 tsc 编译）。
 * ⚠️ 本测试 import 的是编译产物 dist/routes/*.js。改 src 后若只跑 `tsc --noEmit`
 *    （不产出 dist）就测，会测到旧逻辑导致误判失败/通过。请一律 `npm test`（自带 tsc）。
 *
 * 隔离策略：
 *   - MAOMAO_DATA_DIR 指向临时目录 → providers.json 落在临时目录
 *   - MAOMAO_ENV_FILE  指向临时目录下的 .env → key 写入临时 env，不污染真实 localTool/.env
 *
 * 覆盖：
 *   - GET 脱敏：has_key/key_preview/key_env，不回明文
 *   - PUT 保存：primary 唯一化、key 写 env、模型三字段
 *   - key 隔离：key 只进 env，providers.json 不含明文
 *   - 协议：apimart / openai，非法回退 openai
 *   - resolveProviderTarget：apimart 原样透传、openai 拼 base + 注入 Bearer
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// 必须在动态 import 前设置 env（providers.js 模块顶层读取 MAOMAO_DATA_DIR / MAOMAO_ENV_FILE）
const TEST_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'maomao-provider-test-'));
process.env.MAOMAO_DATA_DIR = TEST_DIR;
process.env.MAOMAO_ENV_FILE = path.join(TEST_DIR, '.env');
const ENV_FILE = process.env.MAOMAO_ENV_FILE;

const dist = path.join(__dirname, '..', 'dist');
const providersMod = await import(pathToFileURL(path.join(dist, 'routes', 'providers.js')));
const protocolsMod = await import(pathToFileURL(path.join(dist, 'routes', 'protocolAdapters.js')));

// 每个 test 复用同一临时目录；每次 PUT 都是全量覆盖，天然隔离。
// test 之间不删目录，避免 ensureFile 写 providers.json 时目录不存在（ENOENT）。
function ensureTmp() {
  fs.mkdirSync(TEST_DIR, { recursive: true });
}

// ── mock req / res ──
function makeReq(body) {
  const data = Buffer.from(body === undefined ? '' : JSON.stringify(body), 'utf-8');
  const req = { headers: { 'content-type': 'application/json' }, body: data };
  req.on = (ev, cb) => {
    if (ev === 'data' && data.length) cb(data);
    if (ev === 'end') cb();
    return req;
  };
  return req;
}
function makeRes() {
  const r = { status: 0, headers: {}, body: null, writableEnded: false };
  r.writeHead = (code, h) => { r.status = code; if (h) r.headers = { ...r.headers, ...h }; return r; };
  r.end = (data) => {
    r.writableEnded = true;
    if (data !== undefined) r.body = (r.body || '') + String(data);
    return r;
  };
  return r;
}

const seedProvider = (over = {}) => ({
  id: 'test-site',
  name: '测试站',
  base_url: 'https://api.example.com/v1',
  protocol: 'openai',
  image_request_mode: 'openai',
  enabled: true,
  primary: true,
  image_models: [{ id: 'img-a', label: 'Image A' }],
  chat_models: [{ id: 'chat-a', label: 'Chat A' }],
  video_models: [],
  model_names: {},
  ...over,
});

test('GET /api/providers 返回脱敏列表，不回明文 key', async () => {
  ensureTmp();
  // 先 PUT 写入一个带 key 的 provider
  const putReq = makeReq({ providers: [seedProvider({ api_key: 'sk-secret-1234567890' })] });
  const putRes = makeRes();
  await providersMod.handleProvidersPut(putReq, putRes);
  assert.equal(putRes.status, 200);

  const getReq = makeReq();
  const getRes = makeRes();
  await providersMod.handleProvidersGet(getReq, getRes);
  const data = JSON.parse(getRes.body);
  const p = data.providers.find((x) => x.id === 'test-site');
  assert.ok(p);
  // 不回明文
  assert.equal(p.key, undefined);
  assert.equal(p.api_key, undefined);
  assert.ok(!JSON.stringify(data).includes('sk-secret-1234567890'));
  // 脱敏视图字段
  assert.equal(p.has_key, true);
  assert.equal(p.key_env, 'API_PROVIDER_TEST_SITE_KEY');
  assert.ok(p.key_preview && p.key_preview.includes('••'));
  // 模型三字段存在
  assert.ok(Array.isArray(p.image_models));
  assert.ok(Array.isArray(p.chat_models));
  assert.ok(Array.isArray(p.video_models));
});

test('key 只进 env，providers.json 不含明文', async () => {
  ensureTmp();
  const putReq = makeReq({ providers: [seedProvider({ api_key: 'sk-secret-1234567890' })] });
  const putRes = makeRes();
  await providersMod.handleProvidersPut(putReq, putRes);

  // providers.json 无明文 key
  const fileRaw = fs.readFileSync(path.join(TEST_DIR, 'providers.json'), 'utf-8');
  assert.ok(!fileRaw.includes('sk-secret-1234567890'));

  // env 文件有 key
  const envRaw = fs.readFileSync(ENV_FILE, 'utf-8');
  assert.ok(envRaw.includes('API_PROVIDER_TEST_SITE_KEY=sk-secret-1234567890'));

  // readProviderKey 能读回
  assert.equal(providersMod.readProviderKey('test-site'), 'sk-secret-1234567890');
});

test('PUT primary 唯一化：最后标记的胜出', async () => {
  ensureTmp();
  const putReq = makeReq({ providers: [
    seedProvider({ id: 'a', primary: false }),
    seedProvider({ id: 'b', primary: false }),
    seedProvider({ id: 'c', primary: true }),
  ] });
  const putRes = makeRes();
  await providersMod.handleProvidersPut(putReq, putRes);
  const data = JSON.parse(putRes.body);
  const primaries = data.providers.filter((p) => p.primary);
  assert.equal(primaries.length, 1);
  assert.equal(primaries[0].id, 'c');
});

test('协议校验：8 协议保留，真正非法回退 openai；id 锁协议', async () => {
  ensureTmp();
  const putReq = makeReq({ providers: [
    seedProvider({ id: 'ap', protocol: 'apimart' }),
    seedProvider({ id: 'op', protocol: 'openai' }),
    seedProvider({ id: 'gm', protocol: 'gemini' }),
    seedProvider({ id: 'vc', protocol: 'volcengine' }),
    seedProvider({ id: 'rh', protocol: 'runninghub' }),
    seedProvider({ id: 'jm', protocol: 'jimeng' }),
    seedProvider({ id: 'cd', protocol: 'codex' }),
    seedProvider({ id: 'gcl', protocol: 'gemini-cli' }),
    seedProvider({ id: 'bad', protocol: 'foo' }),         // 真正非法 → 回退 openai
    seedProvider({ id: 'volcengine', protocol: 'openai' }), // id 锁协议 → 强制 volcengine
  ] });
  const putRes = makeRes();
  await providersMod.handleProvidersPut(putReq, putRes);
  const data = JSON.parse(putRes.body);
  const find = (id) => data.providers.find((p) => p.id === id).protocol;
  assert.equal(find('ap'), 'apimart');
  assert.equal(find('op'), 'openai');
  assert.equal(find('gm'), 'gemini');
  assert.equal(find('vc'), 'volcengine');
  assert.equal(find('rh'), 'runninghub');
  assert.equal(find('jm'), 'jimeng');
  assert.equal(find('cd'), 'codex');
  assert.equal(find('gcl'), 'gemini-cli');
  assert.equal(find('bad'), 'openai');          // 非法回退
  assert.equal(find('volcengine'), 'volcengine'); // id 锁协议
});

test('resolveProviderTarget：apimart 原样透传、openai 拼 base + 注入 Bearer', async () => {
  ensureTmp();
  // 先写入 provider
  const putReq = makeReq({ providers: [
    seedProvider({ id: 'ap', protocol: 'apimart', base_url: 'http://127.0.0.1:9004' }),
    seedProvider({ id: 'op', protocol: 'openai', base_url: 'https://api.example.com', api_key: 'sk-abc' }),
  ] });
  const putRes = makeRes();
  await providersMod.handleProvidersPut(putReq, putRes);

  // apimart：无 providerId 原样；有 providerId 按 base 重拼 + 前缀吸收（契约 03 §8 / 04 §H）
  const noId = providersMod.resolveProviderTarget('http://x/v1/images', null);
  assert.equal(noId.url, 'http://x/v1/images');
  assert.equal(noId.authHeader, undefined);
  // base=http://127.0.0.1:9004（无 /v1），rawUrl 含 /v1 → 重拼保留 /v1，吸收只在 base 已含 /v1 时
  const ap = providersMod.resolveProviderTarget('http://x/v1/gateway/generate', 'ap');
  assert.equal(ap.url, 'http://127.0.0.1:9004/v1/gateway/generate');
  assert.equal(ap.authHeader, undefined);

  // openai：openai:// 前缀拼 base/v1/，注入 Bearer
  const op = providersMod.resolveProviderTarget('openai://images/generations', 'op');
  assert.equal(op.url, 'https://api.example.com/v1/images/generations');
  assert.equal(op.authHeader, 'Bearer sk-abc');
});

test('resolveProviderTarget：gemini/volcengine/runninghub 透传+注入 Bearer；CLI 透传不注入不抛错', async () => {
  ensureTmp();
  const putReq = makeReq({ providers: [
    seedProvider({ id: 'gm', protocol: 'gemini', base_url: 'https://g.example', api_key: 'sk-g' }),
    seedProvider({ id: 'vc', protocol: 'volcengine', base_url: 'https://v.example', api_key: 'sk-v' }),
    seedProvider({ id: 'rh', protocol: 'runninghub', base_url: 'https://rh.example', api_key: 'sk-r' }),
    seedProvider({ id: 'jm', protocol: 'jimeng' }),
  ] });
  const putRes = makeRes();
  await providersMod.handleProvidersPut(putReq, putRes);

  // gemini：前端已拼 /v1beta，此处透传 + 注入 Bearer（M1-3 HTTP 类）
  const gm = providersMod.resolveProviderTarget('https://g.example/v1beta/models', 'gm');
  assert.equal(gm.protocol, 'gemini');
  assert.equal(gm.url, 'https://g.example/v1beta/models');
  assert.equal(gm.authHeader, 'Bearer sk-g');

  // volcengine / runninghub 同基线
  const vc = providersMod.resolveProviderTarget('https://v.example/api/v3/models', 'vc');
  assert.equal(vc.url, 'https://v.example/api/v3/models');
  assert.equal(vc.authHeader, 'Bearer sk-v');
  const rh = providersMod.resolveProviderTarget('https://rh.example/openapi/v2/models', 'rh');
  assert.equal(rh.url, 'https://rh.example/openapi/v2/models');
  assert.equal(rh.authHeader, 'Bearer sk-r');

  // CLI：原样透传 + 协议标记，不注入 key、不抛错（审计修正 #2）
  const cli = providersMod.resolveProviderTarget('cli://jimeng/images/generations', 'jm');
  assert.equal(cli.protocol, 'jimeng');
  assert.equal(cli.url, 'cli://jimeng/images/generations');
  assert.equal(cli.authHeader, undefined);
});

test('isProxyProtocol / PROVIDER_PROTOCOLS：CLI 不算 proxy，白名单齐全', () => {
  // M1-2/M1-3：CLI 类 false，HTTP 类 true
  assert.equal(protocolsMod.isProxyProtocol('openai'), true);
  assert.equal(protocolsMod.isProxyProtocol('gemini'), true);
  assert.equal(protocolsMod.isProxyProtocol('jimeng'), false);
  assert.equal(protocolsMod.isProxyProtocol('codex'), false);
  assert.equal(protocolsMod.isProxyProtocol('gemini-cli'), false);
  // M1-5/M1-2：8 协议白名单齐全，各含一个适配器（加协议只改数组 → adapters 长度）
  assert.deepEqual(
    [...protocolsMod.PROVIDER_PROTOCOLS].sort(),
    ['openai', 'apimart', 'gemini', 'volcengine', 'runninghub', 'jimeng', 'codex', 'gemini-cli'].sort(),
  );
});

test('resolveProviderTarget：base_url 含 apimart.ai 但协议为 openai，按 openai 处理', async () => {
  ensureTmp();
  const putReq = makeReq({ providers: [
    seedProvider({ id: 'apm', protocol: 'openai', base_url: 'https://api.apimart.ai/v1', api_key: 'sk-apm' }),
  ] });
  const putRes = makeRes();
  await providersMod.handleProvidersPut(putReq, putRes);

  // 之前会被 isApimartProvider 的域名嗅探误判成 apimart，把 openai:// 错拼成 /v1/openai://...
  // 现在按 protocol 字段判定 → openai 分支拼 base/v1/ + 注入 Bearer
  const r = providersMod.resolveProviderTarget('openai://chat/completions', 'apm');
  assert.equal(r.protocol, 'openai');
  assert.equal(r.url, 'https://api.apimart.ai/v1/chat/completions');
  assert.equal(r.authHeader, 'Bearer sk-apm');
  assert.ok(!r.url.includes('openai://'), '不应把 openai:// 伪协议拼进真实 URL');
});

test('image_mode 同步/异步持久化与回退', async () => {
  ensureTmp();
  const putReq = makeReq({ providers: [
    seedProvider({ id: 'syn', image_mode: 'sync' }),
    seedProvider({ id: 'asy', image_mode: 'async' }),
    seedProvider({ id: 'def' }), // 不传 → 默认 sync
  ] });
  const putRes = makeRes();
  await providersMod.handleProvidersPut(putReq, putRes);
  const data = JSON.parse(putRes.body);
  assert.equal(data.providers.find((p) => p.id === 'syn').image_mode, 'sync');
  assert.equal(data.providers.find((p) => p.id === 'asy').image_mode, 'async');
  assert.equal(data.providers.find((p) => p.id === 'def').image_mode, 'sync'); // 回退 sync
});

test('apimart 拉取模型：/v1/models 按 category 归类', async () => {
  ensureTmp();
  // 写入 apimart provider（走网关自身鉴权，不注入本地 key）
  const putReq = makeReq({ providers: [seedProvider({ id: 'lv', protocol: 'apimart', base_url: 'http://127.0.0.1:9004' })] });
  const putRes = makeRes();
  await providersMod.handleProvidersPut(putReq, putRes);

  // mock fetch 返回 OpenAI 风格 + category 的模型列表
  const origFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: true,
    status: 200,
    json: async () => ({
      object: 'list',
      data: [
        { id: 'lovart-chat', category: 'chat' },
        { id: 'gpt-image-2', category: 'image' },
        { id: 'seedance-2', category: 'video' },
      ],
    }),
  });
  try {
    const req = makeReq();
    const res = makeRes();
    await providersMod.handleProviderFetchModels(req, res, 'lv');
    const data = JSON.parse(res.body);
    assert.deepEqual(data.image_models.map((m) => m.id), ['gpt-image-2']);
    // apimart 按 category 正常收录 chat（文本节点下拉需要）
    assert.deepEqual(data.chat_models.map((m) => m.id), ['lovart-chat']);
    assert.deepEqual(data.video_models.map((m) => m.id), ['seedance-2']);
    assert.equal(data.modelCount, 3);
  } finally {
    globalThis.fetch = origFetch;
  }
});

test('PUT 后 GET 与 primary 回退一致', async () => {
  ensureTmp();
  const putReq = makeReq({ providers: [
    seedProvider({ id: 'a', primary: false }),
    seedProvider({ id: 'b', primary: true }),
  ] });
  const putRes = makeRes();
  await providersMod.handleProvidersPut(putReq, putRes);

  // getProvider 无参 → 回退 primary(b)
  assert.equal(providersMod.getProvider().id, 'b');
  assert.equal(providersMod.getProvider('a').id, 'a');
});
