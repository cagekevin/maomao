/**
 * lovart_project — project 单例缓存 + 失效自愈（B3）
 * ------------------------------------------------------------
 * 不真打上游：注入 fake transport。
 * 覆盖：同 accessKey 连续调用只 create 一次（单例）；project 失效（validate 返回 valid:false）
 *       后清缓存重建（自愈）。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const src = path.join(__dirname, '..', 'src');
const toUrl = (p) => 'file:///' + p.split(path.sep).join('/');

const mod = await import(toUrl(path.join(src, 'ai-relay/providers/lovart/lovart_project.ts')));

const depsOf = (ak) => ({ auth: { type: 'hmac', accessKey: ak, secretKey: 'sk' }, baseUrl: 'https://fake' });

function makeStateTransport() {
  let projectValid = true;
  let createCount = 0;
  const transport = async (opts) => {
    if (opts.path === '/v1/openapi/project/save') {
      createCount += 1;
      return { response: new Response(JSON.stringify({ code: 0, data: { project_id: 'proj-1' } }), { status: 200 }), resolvedBaseUrl: 'x' };
    }
    if (opts.path === '/v1/openapi/project/validate') {
      return { response: new Response(JSON.stringify({ code: 0, data: { valid: projectValid } }), { status: 200 }), resolvedBaseUrl: 'x' };
    }
    return { response: new Response(JSON.stringify({ code: 0, data: {} }), { status: 200 }), resolvedBaseUrl: 'x' };
  };
  return { transport, getCreateCount: () => createCount, setProjectValid: (v) => { projectValid = v; } };
}

test('B3 单例：同 accessKey 连续两次 ensureProject 只 create 一次', async () => {
  const s = makeStateTransport();
  const deps = { ...depsOf('ak-single-a'), transport: s.transport };
  const first = await mod.ensureLovartProject(deps);
  const second = await mod.ensureLovartProject(deps);
  assert.equal(first, 'proj-1');
  assert.equal(second, 'proj-1');
  assert.equal(s.getCreateCount(), 1, '同 accessKey 只建 1 次');
});

test('B3 失效自愈：project 失效后下次 ensure 重建', async () => {
  const s = makeStateTransport();
  const deps = { ...depsOf('ak-heal-b'), transport: s.transport }; // 独立 AK，避免缓存跨测试共享
  await mod.ensureLovartProject(deps);
  assert.equal(s.getCreateCount(), 1);
  s.setProjectValid(false);
  const again = await mod.ensureLovartProject(deps);
  assert.equal(again, 'proj-1');
  assert.equal(s.getCreateCount(), 2, '失效后应重建一次');
});
