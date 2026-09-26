/**
 * httpTransport HMAC — 中央鉴权头签名向量（B2）
 * ------------------------------------------------------------
 * 验证 buildHmacAuthHeaders 与 .codebuddy/skills/lovart/agent_skill.py 的 _sign 一致：
 * X-Signature = hmac_sha256(secretKey, "{METHOD}\n{path}\n{X-Timestamp}").hexdigest()，
 * 且 X-Access-Key / X-Signed-Method / X-Signed-Path 齐全。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const src = path.join(__dirname, '..', 'src');
const toUrl = (p) => 'file:///' + p.split(path.sep).join('/');

const { buildHmacAuthHeaders, RETRYABLE_HTTP_STATUSES, stableRequest } = await import(
  toUrl(path.join(src, 'ai-relay/httpTransport.ts'))
);

const AK = 'my-access-key';
const SK = 'my-secret-key';
const METHOD = 'POST';
const P = '/v1/openapi/chat';

test('B2 签名向量：X-Signature = hmac_sha256(SK, "METHOD\\npath\\nts") 且各头齐全', () => {
  const headers = buildHmacAuthHeaders({ type: 'hmac', accessKey: AK, secretKey: SK }, METHOD, P);
  assert.equal(headers['X-Access-Key'], AK);
  assert.equal(headers['X-Signed-Method'], METHOD);
  assert.equal(headers['X-Signed-Path'], P);
  assert.ok(headers['X-Timestamp']);
  const raw = `${METHOD}\n${P}\n${headers['X-Timestamp']}`;
  const expected = createHmac('sha256', SK).update(raw).digest('hex');
  assert.equal(
    headers['X-Signature'],
    expected,
    '签名 = hmac_sha256(secret, "METHOD\\npath\\nts")',
  );
});

test('B2 签名是 64 位 sha256 hex（排除随机 salt / 非算法混淆）', () => {
  const h1 = buildHmacAuthHeaders(
    { type: 'hmac', accessKey: AK, secretKey: SK },
    'GET',
    '/v1/openapi/project/validate',
  );
  assert.match(h1['X-Signature'], /^[0-9a-f]{64}$/, 'X-Signature 应为 sha256 hexdigest (64 位)');
  assert.equal(h1['X-Signed-Path'], '/v1/openapi/project/validate');
});

test('B2 method / path 进入签名头（X-Signed-Method / X-Signed-Path 区分）', () => {
  const get = buildHmacAuthHeaders({ type: 'hmac', accessKey: AK, secretKey: SK }, 'GET', P);
  const post = buildHmacAuthHeaders({ type: 'hmac', accessKey: AK, secretKey: SK }, 'POST', P);
  assert.equal(get['X-Signed-Method'], 'GET');
  assert.equal(post['X-Signed-Method'], 'POST');
  assert.equal(post['X-Signed-Path'], P);
});

/* ------------------------------------------------------------------ */
/* TD-08-25 · 下载重试：403 在显式传入 retryStatuses 时才重试          */
/* ------------------------------------------------------------------ */

/** 造一个按序返回响应的假 fetch，记录调用次数。 */ function makeSeqFetch(statuses) {
  let i = 0;
  const calls = { n: 0 };
  const impl = async () => {
    calls.n++;
    const status = statuses[Math.min(i, statuses.length - 1)];
    i++;
    return new Response(status === 200 ? 'ok' : 'nope', { status });
  };
  return { impl, calls };
}

test('TD-08-25 下载重试：403 首次失败 + 显式 retryStatuses 含 403 → 第 2 次 200 成功', async () => {
  const { impl, calls } = makeSeqFetch([403, 200]);
  const { response } = await stableRequest({
    method: 'GET',
    candidates: ['https://cdn.example.com/a.png'],
    retryStatuses: [403, ...RETRYABLE_HTTP_STATUSES],
    maxRetries: 3,
    retryDelayMs: 1, // 提速：退避是**真 sleep**，用例不该为此白等 800ms 级
    fetchImpl: impl,
  });
  assert.equal(response.status, 200, '403 后被重试并拿到 200');
  assert.equal(calls.n, 2, '应恰好重试一次（首次 403 + 第二次 200）');
});

test('TD-08-25 下载重试：未传 retryStatuses 时 403 不重试（中央默认集不含 403）', async () => {
  const { impl, calls } = makeSeqFetch([403, 200]);
  await assert.rejects(
    () =>
      stableRequest({
        method: 'GET',
        candidates: ['https://cdn.example.com/a.png'],
        maxRetries: 3,
        fetchImpl: impl,
      }),
    (e) => {
      assert.equal(e.status, 403, '默认集不含 403 ⇒ 确定性硬失败直接抛');
      return true;
    },
  );
  assert.equal(calls.n, 1, '未传 retryStatuses 时 403 只发一次，不重试');
});

test('TD-08-41：缺省不按状态码重试 —— 5xx 只发一次（业务/服务端错误不得无条件重试）', async () => {
  // 【契约变更】原用例锁「5xx 走中央默认集仍重试」——那正是本债要收的口子：缺省重试状态码会让
  // **非幂等 POST**（Lovart save/chat/upload 均经裸包装进本原语）在 429/5xx 时被静默重发。
  // 现契约：状态码重试必须由调用方显式声明 retryStatuses；没声明 = 确定性失败直接抛。
  const { impl, calls } = makeSeqFetch([503, 200]);
  await assert.rejects(
    () =>
      stableRequest({
        method: 'POST',
        candidates: ['https://api.example.com/submit'],
        maxRetries: 3,
        fetchImpl: impl,
      }),
    (e) => {
      assert.equal(e.status, 503, '未声明可重试 ⇒ 503 原样抛出');
      return true;
    },
  );
  assert.equal(calls.n, 1, '缺省不按状态码重试：只发一次');
});

test('TD-08-41：显式声明 retryStatuses 时按该集重试（5xx 可被显式开启）', async () => {
  const { impl, calls } = makeSeqFetch([503, 200]);
  const { response } = await stableRequest({
    method: 'GET',
    candidates: ['https://cdn.example.com/a.png'],
    retryStatuses: [...RETRYABLE_HTTP_STATUSES],
    maxRetries: 3,
    retryDelayMs: 1, // 提速（同上）：断言的是"重试了几次"，与退避时长无关
    fetchImpl: impl,
  });
  assert.equal(response.status, 200, '显式声明后可重试 → 第二次 200');
  assert.equal(calls.n, 2, '应恰好重试一次');
});

test('只有网络错误才重试：fetch 抛网络错误 → 缺省仍重试（红线保留的那一半）', async () => {
  let n = 0;
  const impl = async () => {
    n++;
    throw new TypeError('fetch failed');
  };
  await assert.rejects(
    () =>
      stableRequest({
        method: 'POST', // 非幂等也照重：红线允许的是**网络错误**这一类别，与 method 无关
        candidates: ['https://api.example.com/submit'],
        maxRetries: 2,
        retryDelayMs: 1, // 提速（同上）：锁的是"仍重试"，不是退避时长
        fetchImpl: impl,
      }),
    (e) => {
      assert.equal(e.name, 'TypeError', '网络错误原样上抛（不重分类）');
      return true;
    },
  );
  assert.equal(n, 3, '首轮 + 重试 2 次');
});
