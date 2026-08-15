/**
 * providers（多供应商）单元测试
 * ------------------------------------------------------------
 * 运行：node --test test/*.test.js        （在 localTool/ 下）
 * 注意：必须先构建（npm test 会先跑 tsc）使 dist 反映最新 src。
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
  isPrimary: true,
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
    seedProvider({ id: 'a', isPrimary: true }),
    seedProvider({ id: 'b', isPrimary: false }),
    seedProvider({ id: 'c', isPrimary: true }),
  ] });
  const putRes = makeRes();
  await providersMod.handleProvidersPut(putReq, putRes);
  const data = JSON.parse(putRes.body);
  const primaries = data.providers.filter((p) => p.isPrimary);
  assert.equal(primaries.length, 1);
  assert.equal(primaries[0].id, 'c');
});

test('协议校验：apimart/openai 保留，非法回退 openai', async () => {
  ensureTmp();
  const putReq = makeReq({ providers: [
    seedProvider({ id: 'ap', protocol: 'apimart' }),
    seedProvider({ id: 'op', protocol: 'openai' }),
    seedProvider({ id: 'bad', protocol: 'volcengine' }),
  ] });
  const putRes = makeRes();
  await providersMod.handleProvidersPut(putReq, putRes);
  const data = JSON.parse(putRes.body);
  assert.equal(data.providers.find((p) => p.id === 'ap').protocol, 'apimart');
  assert.equal(data.providers.find((p) => p.id === 'op').protocol, 'openai');
  assert.equal(data.providers.find((p) => p.id === 'bad').protocol, 'openai'); // 非法回退
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

  // apimart：无 providerId / 有 providerId 都原样
  const noId = providersMod.resolveProviderTarget('http://x/v1/images', null);
  assert.equal(noId.url, 'http://x/v1/images');
  assert.equal(noId.authHeader, undefined);
  const ap = providersMod.resolveProviderTarget('http://x/v1/gateway/generate', 'ap');
  assert.equal(ap.url, 'http://x/v1/gateway/generate');
  assert.equal(ap.authHeader, undefined);

  // openai：openai:// 前缀拼 base/v1/，注入 Bearer
  const op = providersMod.resolveProviderTarget('openai://images/generations', 'op');
  assert.equal(op.url, 'https://api.example.com/v1/images/generations');
  assert.equal(op.authHeader, 'Bearer sk-abc');
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
    seedProvider({ id: 'a', isPrimary: false }),
    seedProvider({ id: 'b', isPrimary: true }),
  ] });
  const putRes = makeRes();
  await providersMod.handleProvidersPut(putReq, putRes);

  // getProvider 无参 → 回退 primary(b)
  assert.equal(providersMod.getProvider().id, 'b');
  assert.equal(providersMod.getProvider('a').id, 'a');
});
