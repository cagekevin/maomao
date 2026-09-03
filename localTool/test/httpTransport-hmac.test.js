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

const { buildHmacAuthHeaders } = await import(toUrl(path.join(src, 'ai-relay/httpTransport.ts')));

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
  assert.equal(headers['X-Signature'], expected, '签名 = hmac_sha256(secret, "METHOD\\npath\\nts")');
});

test('B2 签名是 64 位 sha256 hex（排除随机 salt / 非算法混淆）', () => {
  const h1 = buildHmacAuthHeaders({ type: 'hmac', accessKey: AK, secretKey: SK }, 'GET', '/v1/openapi/project/validate');
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
