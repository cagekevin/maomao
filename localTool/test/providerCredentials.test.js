/**
 * providerCredentials — 凭证解析与鉴权构造（回归防护）
 * ------------------------------------------------------------
 * 运行：node --test test/providerCredentials.test.js   （直接 import src/，无需编译）
 *
 * 背景（本次修复的根因）：
 *  1. 读 key 靠拼 `API_PROVIDER_{ID}_KEY`，而 lovart 的凭证实际叫
 *     LOVART_ACCESS_KEY / LOVART_SECRET_KEY → 永远读空 → 测试连接恒报「缺少 API Key」。
 *  2. 出站一律用 Bearer，而 lovart 走 HMAC → 即使读到 key 也会被上游拒绝。
 * 两条叠加 = 「测试连接显示失败，但实际能用」。
 *
 * 本测试锚定修复后的契约：凭证名与鉴权方式都从厂商目录声明读取，不猜。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const src = path.join(__dirname, '..', 'src');
const cred = await import(pathToFileURL(path.join(src, 'ai-relay', 'providerCredentials.ts')));
const { getProviderDefinition, BUILT_IN_PROVIDER_DEFINITIONS } = await import(
  pathToFileURL(path.join(src, 'ai-relay', 'providerCatalog.ts'))
);

const LOVART = 'lovart';
const LOVART_DEF = getProviderDefinition(LOVART);

/** 临时设置/还原一组环境变量（避免用例间污染）。 */
function withEnv(vars, fn) {
  const saved = {};
  for (const [k, v] of Object.entries(vars)) {
    saved[k] = process.env[k];
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  try {
    return fn();
  } finally {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}

test('defaultEnvKey：统一命名回落为 API_PROVIDER_{ID}_KEY', () => {
  assert.equal(cred.defaultEnvKey('modelscope'), 'API_PROVIDER_MODELSCOPE_KEY');
});

test('envKeysFor：未声明 envKeys 的厂商回落统一命名（不改变既有行为）', () => {
  // xai 内置定义未声明 envKeys
  const xai = getProviderDefinition('xai');
  assert.equal(xai?.envKeys, undefined);
  assert.deepEqual(cred.envKeysFor('xai', xai), ['API_PROVIDER_XAI_KEY']);
});

test('envKeysFor：lovart 按目录声明读取 LOVART_ACCESS_KEY / LOVART_SECRET_KEY（修复点 1）', () => {
  assert.deepEqual(cred.envKeysFor(LOVART, LOVART_DEF), ['LOVART_ACCESS_KEY', 'LOVART_SECRET_KEY']);
  // 关键回归：不再回落成 API_PROVIDER_LOVART_KEY（那正是恒读空的根因）
  assert.ok(!cred.envKeysFor(LOVART, LOVART_DEF).includes('API_PROVIDER_LOVART_KEY'));
});

test('resolveAuth：lovart 产出 HMAC 鉴权（修复点 2 —— 不再被当 Bearer 发出）', () => {
  withEnv({ LOVART_ACCESS_KEY: 'ak-123', LOVART_SECRET_KEY: 'sk-456' }, () => {
    const r = cred.resolveAuth(LOVART, LOVART_DEF);
    assert.equal(r.auth?.type, 'hmac');
    assert.equal(r.auth?.accessKey, 'ak-123');
    assert.equal(r.auth?.secretKey, 'sk-456');
    assert.equal(r.missing, false, '双凭证齐全时不应判缺失（原实现据此误报失败）');
  });
});

test('resolveAuth：lovart 仅配 Access Key 时判定 missing（确实缺凭证才报失败）', () => {
  withEnv({ LOVART_ACCESS_KEY: 'ak-only', LOVART_SECRET_KEY: undefined }, () => {
    const r = cred.resolveAuth(LOVART, LOVART_DEF);
    assert.equal(r.missing, true);
  });
});

test('resolveAuth：普通 api-key 厂商维持 Bearer 语义（无显式 auth 声明）', () => {
  const xai = getProviderDefinition('xai');
  withEnv({ API_PROVIDER_XAI_KEY: 'xai-key' }, () => {
    const r = cred.resolveAuth('xai', xai);
    assert.equal(r.auth, undefined, '未声明 auth → 交给 buildAuthHeaders 走默认 Bearer');
    assert.equal(r.apiKey, 'xai-key');
    assert.equal(r.missing, false);
  });
});

test('resolveAuth：oauth 厂商产出 oauth 鉴权', () => {
  const dreamina = getProviderDefinition('dreamina');
  assert.equal(dreamina?.authType, 'oauth');
  const r = cred.resolveAuth('dreamina', dreamina);
  assert.equal(r.auth?.type, 'oauth');
});

test('readEnvValues：按声明顺序返回（首项=主凭证，次项=secretKey）', () => {
  withEnv({ LOVART_ACCESS_KEY: 'A', LOVART_SECRET_KEY: 'S' }, () => {
    assert.deepEqual(cred.readEnvValues(LOVART, LOVART_DEF), ['A', 'S']);
  });
});

test('目录卫生：所有厂商的 envKeys 非空且不含空白项', () => {
  for (const def of BUILT_IN_PROVIDER_DEFINITIONS) {
    const keys = cred.envKeysFor(def.id, def);
    assert.ok(keys.length > 0, `${def.id} 应至少有一个凭证变量名`);
    for (const k of keys) assert.ok(k.trim() === k && k.length > 0, `${def.id} 的 envKey 不合法`);
  }
});

test('目录卫生：HMAC 厂商必须声明 envKeys（否则凭证读不到 → 恒失败）', () => {
  for (const def of BUILT_IN_PROVIDER_DEFINITIONS) {
    if (def.auth?.type === 'hmac') {
      assert.ok(
        Array.isArray(def.envKeys) && def.envKeys.length >= 2,
        `${def.id} 走 HMAC 必须声明 envKeys（accessKey + secretKey）`,
      );
    }
  }
});

test('isHmacProvider：仅 HMAC 厂商为 true', () => {
  assert.equal(cred.isHmacProvider(LOVART_DEF), true);
  assert.equal(cred.isHmacProvider(getProviderDefinition('xai')), false);
  assert.equal(cred.isHmacProvider(undefined), false);
});
