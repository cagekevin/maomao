/**
 * logDebug 开关测试 —— 后端 debug 通道（与前端 `logger.debug` 同构）。
 *
 * 【为什么要这个测试】这条通道的**全部价值**就是"默认安静、需要时开"：
 *   ① 默认必须零输出（否则就是往日志文件里塞噪音）；
 *   ② 开了必须真能落盘通道输出（走 console.log 而非 console.debug —— 后者在 localTool 是黑洞，
 *      logWriter 不接管：实测 patch 掉 console.log 后 console.debug 仍走原生实现）；
 *   ③ 登记表必须是闸（未登记模块位不得生效 = 禁止散开关）；
 *   ④ 实时读 env（加缓存的话"关掉开关"会失效，本条会红）。
 */
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const { logDebug, isLogDebugOn, LOG_DEBUG_MODULES } = await import(
  pathToFileURL(path.join(__dirname, '..', 'src', 'utils', 'logDebug.ts')).href
);

/** 捕获一次调用期间的 console.log 输出（logDebug 经它落盘） */
function capture(fn) {
  const out = [];
  const orig = console.log;
  console.log = (...a) => out.push(a.map((x) => String(x)).join(' '));
  try {
    fn();
  } finally {
    console.log = orig;
  }
  return out;
}

/** 清掉本模块的所有开关 env（防用例间互相污染；测试进程独立，不影响其它测试文件） */
function clearEnv() {
  for (const k of Object.keys(process.env)) {
    if (k.startsWith('LOG_DEBUG_')) delete process.env[k];
  }
}
afterEach(clearEnv);

test('默认全关：零输出（连字符串都不拼）', () => {
  clearEnv();
  assert.equal(isLogDebugOn('task'), false, '默认必须安静');
  assert.deepEqual(
    capture(() => logDebug('task', 'x', { a: 1 })),
    [],
    '关闭时不得有任何输出',
  );
  assert.ok(LOG_DEBUG_MODULES.includes('task'), 'task 模块位须已登记');
});

test('单模块开关：LOG_DEBUG_TASK=1 → 输出，行格式与前端 [debug] 对齐', () => {
  process.env['LOG_DEBUG_TASK'] = '1';
  assert.equal(isLogDebugOn('task'), true);
  const lines = capture(() =>
    logDebug('task', 'upsertTask:client-redundant', { task_id: 't1', cols: ['status'] }),
  );
  assert.equal(lines.length, 1);
  assert.match(lines[0], /^\[debug\] \d{2}:\d{2}:\d{2} \| task \| upsertTask:client-redundant \| /);
  assert.match(lines[0], /"task_id":"t1"/, 'detail 须带上（便于按 task 一键 grep）');
});

test('总开关 LOG_DEBUG_ALL=1 → 全开（含未登记模块，判定顺序与前端一致）', () => {
  clearEnv();
  process.env['LOG_DEBUG_ALL'] = '1';
  assert.equal(isLogDebugOn('task'), true);
  assert.equal(isLogDebugOn('any-unregistered'), true);
});

test('未登记模块位被拒（登记表就是闸，防散开关）', () => {
  clearEnv();
  process.env['LOG_DEBUG_NOPE'] = '1';
  assert.equal(isLogDebugOn('nope'), false, '未登记模块不得生效');
  assert.deepEqual(
    capture(() => logDebug('nope', 'x')),
    [],
    '未登记模块不得输出',
  );
});

test('实时读 env：开→关立刻生效（加顶层缓存则本条红）', () => {
  clearEnv();
  assert.equal(isLogDebugOn('task'), false);
  process.env['LOG_DEBUG_TASK'] = '1';
  assert.equal(isLogDebugOn('task'), true, '开了立刻生效');
  delete process.env['LOG_DEBUG_TASK'];
  assert.equal(isLogDebugOn('task'), false, '关了立刻失效');
});

test('detail 不可序列化（循环引用）不得抛断主链路', () => {
  process.env['LOG_DEBUG_TASK'] = '1';
  const cyc = { name: 'x' };
  cyc.self = cyc;
  const lines = capture(() => logDebug('task', 'cyc', cyc));
  assert.equal(lines.length, 1, '仍照常输出（日志不得炸主链路）');
});
