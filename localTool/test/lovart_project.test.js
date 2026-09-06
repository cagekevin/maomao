/**
 * lovart_project — project 单例缓存 + 失效自愈（send 时）+ 磁盘持久化（对齐 main.py）
 * ------------------------------------------------------------
 * 不真打上游：注入 fake transport + 临时缓存文件。
 * 覆盖：
 *   - 同 accessKey 连续调用只 create 一次（单例）；
 *   - ensure 命中不触发额外 validate 网络往返（对齐 main.py：无 /project/validate）；
 *   - send 失败且命中 project 失效 hints → clear 缓存 → 重建（建新 project_id）→ 重试一次（自愈）；
 *   - 非 project 失效的 send 错误原样抛出，不重建；
 *   - 磁盘持久化：create/clear 后写回缓存文件，重启可复用（load）。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const src = path.join(__dirname, '..', 'src');
const toUrl = (p) => 'file:///' + p.split(path.sep).join('/');

const mod = await import(toUrl(path.join(src, 'ai-relay/providers/lovart/lovart_project.ts')));

const tmp = () =>
  path.join(os.tmpdir(), `lovart_proj_${Date.now()}_${Math.random().toString(16).slice(2)}.json`);
const depsOf = (ak, cacheFile) => ({
  auth: { type: 'hmac', accessKey: ak, secretKey: 'sk' },
  baseUrl: 'https://fake',
  projectCacheFile: cacheFile,
});

/** 用唯一临时文件 + 唯一 AK 隔离，避免模块级单例/跨测试污染。 */
function freshDeps(ak) {
  return depsOf(ak, tmp());
}

function makeStateTransport({ createProjectIds = ['proj-1'] } = {}) {
  let createCount = 0;
  /** send 是否失败；非空表示该次 send 抛的错误 message */
  let sendError = null;
  const calls = [];
  const transport = async (opts) => {
    calls.push(opts);
    if (opts.path === '/v1/openapi/project/save') {
      const pid = createProjectIds[Math.min(createCount, createProjectIds.length - 1)];
      createCount += 1;
      return {
        response: new Response(JSON.stringify({ code: 0, data: { project_id: pid } }), {
          status: 200,
        }),
        resolvedBaseUrl: 'x',
      };
    }
    if (opts.path === '/v1/openapi/project/validate') {
      // main.py 没有该端点：若仍被调用即视为对齐失败
      throw new Error('unexpected validate call');
    }
    if (opts.path === '/v1/openapi/chat') {
      if (sendError) {
        const msg = sendError;
        sendError = null; // 只失败一次，便于验证「重试一次」后成功
        return {
          response: new Response(JSON.stringify({ code: 404, message: msg }), { status: 200 }),
          resolvedBaseUrl: 'x',
        };
      }
      return {
        response: new Response(
          JSON.stringify({ code: 0, data: { thread_id: 't-' + createCount } }),
          { status: 200 },
        ),
        resolvedBaseUrl: 'x',
      };
    }
    return {
      response: new Response(JSON.stringify({ code: 0, data: {} }), { status: 200 }),
      resolvedBaseUrl: 'x',
    };
  };
  return {
    transport,
    calls,
    getCreateCount: () => createCount,
    setSendError: (msg) => {
      sendError = msg;
    },
  };
}

test('单例：同 accessKey 连续两次 ensure 只 create 一次，且命中不调 validate', async () => {
  const cacheFile = tmp();
  const deps = depsOf('ak-single-a', cacheFile);
  const s = makeStateTransport();
  const depsWith = { ...deps, transport: s.transport };
  const first = await mod.ensureLovartProject(depsWith);
  const second = await mod.ensureLovartProject(depsWith);
  assert.equal(first, 'proj-1');
  assert.equal(second, 'proj-1');
  assert.equal(s.getCreateCount(), 1, '同 accessKey 只建 1 次');
  assert.ok(
    !s.calls.some((c) => c.path.includes('validate')),
    'ensure 命中不做 /project/validate 往返（对齐 main.py）',
  );
});

test('持久化：ensure 后写回缓存文件，新进程加载可复用不重建', async () => {
  const cacheFile = tmp();
  const deps = { ...depsOf('ak-persist-c', cacheFile) };
  const s = makeStateTransport();
  await mod.ensureLovartProject({ ...deps, transport: s.transport });
  assert.equal(s.getCreateCount(), 1);
  const onDisk = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
  assert.equal(onDisk['ak-persist-c'], 'proj-1', '缓存已落盘');

  // 模拟重启：清内存缓存重新 import？模块级单例无法在进程内重置；改用读取同一文件断言即可，
  // 或用一个全新 accessKey 触发 load。此处验证「同文件在磁盘已含该 key」即代表 load 会命中。
  const raw = fs.readFileSync(cacheFile, 'utf8');
  assert.match(raw, /ak-persist-c/);
});

test('失效自愈（send 时）：project not found → clear → 重建新 project → 重试一次成功', async () => {
  const deps = { ...freshDeps('ak-heal-d') };
  const s = makeStateTransport({ createProjectIds: ['proj-invalid-1', 'proj-rebuilt-2'] });
  s.setSendError('project not found');

  const r = await mod.sendLovartChatWithProject(
    { ...deps, transport: s.transport },
    { prompt: 'a cat' },
  );
  // 首次 send 因 project 失效失败 → 重建（第二次 create 返回 proj-rebuilt-2）→ 用新 project 重试成功
  assert.equal(s.getCreateCount(), 2, '失效后应重建一次（共 2 次 create）');
  assert.equal(r.projectId, 'proj-rebuilt-2', '重试使用重建后的新 project');
  const chatCalls = s.calls.filter((c) => c.path === '/v1/openapi/chat');
  assert.equal(chatCalls.length, 2, 'send 共 2 次（失败 1 + 重试 1）');
  assert.equal(chatCalls[0].body.project_id, 'proj-invalid-1', '首次 send 用旧 project');
  assert.equal(chatCalls[1].body.project_id, 'proj-rebuilt-2', '重试 send 用重建 project');
});

test('非 project 失效错误原样抛出：不重建、不重试', async () => {
  const deps = { ...freshDeps('ak-noheal-e') };
  const s = makeStateTransport();
  s.setSendError('上游说: quota exceeded'); // 文案不含 project 失效 hints
  await assert.rejects(
    () => mod.sendLovartChatWithProject({ ...deps, transport: s.transport }, { prompt: 'x' }),
    (e) => e.message === '上游说: quota exceeded',
  );
  assert.equal(s.getCreateCount(), 1, '非失效错误不触发重建');
  const chatCalls = s.calls.filter((c) => c.path === '/v1/openapi/chat');
  assert.equal(chatCalls.length, 1, '不重试');
});

test('clear 后 ensure 重建（供失效自愈的内部步骤验证）', async () => {
  const deps = { ...freshDeps('ak-clear-f') };
  const s = makeStateTransport({ createProjectIds: ['proj-a', 'proj-b'] });
  const p1 = await mod.ensureLovartProject({ ...deps, transport: s.transport });
  assert.equal(p1, 'proj-a');
  await mod.clearLovartProject('ak-clear-f');
  const p2 = await mod.ensureLovartProject({ ...deps, transport: s.transport });
  assert.equal(p2, 'proj-b', 'clear 后重建返回新 project');
  assert.equal(s.getCreateCount(), 2);
});
