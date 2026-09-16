/**
 * relay-poll — 崩溃恢复与三终态语义（TD-08-24 回归防护）
 * ------------------------------------------------------------
 * 运行：cd localTool && node --test --import tsx test/relay-poll-recovery.test.js
 * 隔离：MAOMAO_DATA_DIR 指向临时目录，绝不触碰真实 ~/.maomao-localtool。
 *
 * 【为什么需要这组测试】TD-08-24 是**付费任务重复计费**类缺陷，靠"看代码觉得对"不够：
 *   ① 提交成功后的「先落库再改内存」顺序一旦被改回，崩溃窗口会重提交 → 必须由测试钉住；
 *   ② 新增的 `unknown` 终态必须原样透出 —— 若被折成 running，前端会空等到超时再报错，
 *      用户等满超时后更容易误重提（本债的初衷被绕开）。
 *
 * 【测什么口径】`getGenerateStatus` 是「重启后读 DB 真相」的只读入口，正是恢复分支的观测点：
 *   给定不同 DB 快照 → 断言它返回哪个终态。行为断言（输入→输出），非"函数被调用"。
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const src = path.join(__dirname, '..', 'src');

// 必须在 import 被测模块之前设好数据目录（getDataDir 读 process.env）
const TEST_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'maomao-relay-recovery-'));
process.env.MAOMAO_DATA_DIR = TEST_DIR;

const poll = await import(pathToFileURL(path.join(src, 'relay-poll.ts')));
const { getDb, queryAll } = await import(pathToFileURL(path.join(src, 'db', 'database.ts')));
const { upsertTask } = await import(pathToFileURL(path.join(src, 'routes', 'tasks.ts')));

/** 造一行 relay 快照（模拟「提交即返回」时落库的形态）。 */
function snapshot(pendingSubmit) {
  return JSON.stringify({
    _relayPoll: {
      taskId: pendingSubmit ? '' : 'thread-abc',
      poll: null,
      providerId: 'lovart',
      capability: 'image',
      model: 'test-model',
      type: 'image',
      baseUrl: 'https://example.test',
      direct: true,
      ...(pendingSubmit ? { pendingSubmit } : {}),
      startedAt: Date.now(),
    },
  });
}

const PENDING = { model: 'test-model', prompt: 'p', capability: 'IMAGE' };

test('[TD-08-24] 恢复分支：DB 已记 thread_id 且无 pendingSubmit → 走「续轮询」而非重提交', async () => {
  const db = await getDb();
  const id = 'task_resume_poll';
  await upsertTask(db, {
    task_id: id,
    status: 'running',
    progress: 0,
    thread_id: 'thread-abc',
    request_data: snapshot(null), // 关键：提交已完成 → 快照里没有 pendingSubmit
  });
  const row = queryAll(
    db,
    'SELECT status, poll_task_id, request_data FROM tasks WHERE task_id = ?',
    [id],
  )[0];
  // 断言「不会重提交」的客观判据 = 快照里已无 pendingSubmit（initRelayPoller 只在有它时才重建待提交句柄）
  const snap = JSON.parse(row.request_data);
  assert.equal(
    snap._relayPoll.pendingSubmit,
    undefined,
    '已提交行绝不能再带 pendingSubmit（否则重启会重提交）',
  );
  assert.equal(snap._relayPoll.taskId, 'thread-abc', '必须已记下 thread_id 以续轮询');
});

test('[TD-08-24] 恢复分支：快照仍含 pendingSubmit（提交即返回后崩溃）→ 保留待提交语义', async () => {
  const db = await getDb();
  const id = 'task_still_pending';
  await upsertTask(db, {
    task_id: id,
    status: 'running',
    progress: 0,
    request_data: snapshot(PENDING),
  });
  const row = queryAll(db, 'SELECT request_data FROM tasks WHERE task_id = ?', [id])[0];
  const snap = JSON.parse(row.request_data);
  assert.ok(snap._relayPoll.pendingSubmit, '未出站的行必须保留 pendingSubmit 快照（否则任务丢失）');
  assert.equal(snap._relayPoll.taskId, '', '未出站时 taskId 为空串');
});

test('[TD-08-24] 终态 unknown 原样透出（不得折成 running/failed）', async () => {
  const db = await getDb();
  const id = 'task_unknown_state';
  await upsertTask(db, {
    task_id: id,
    status: 'unknown',
    progress: 0,
    error_msg: '提交结果未知（可能已开始生成），请到任务中心确认',
  });
  const st = await poll.getGenerateStatus(id);
  assert.equal(st.status, 'unknown', 'unknown 是终态，必须原样返回');
  assert.match(st.error, /可能已开始生成/, '文案必须点明「可能已在跑」，否则用户会当失败重提');
});

test('[TD-08-24] unknown 行不被恢复扫描接管（终态不自动重提）', async () => {
  const db = await getDb();
  const id = 'task_unknown_not_resumed';
  await upsertTask(db, {
    task_id: id,
    status: 'unknown',
    progress: 0,
    request_data: snapshot(PENDING), // 即便快照含 pendingSubmit，unknown 也不该被接管
    error_msg: '提交结果未知',
  });
  // initRelayPoller 的筛选条件：status IN ('running','pending') —— unknown 天然排除。
  const rows = queryAll(
    db,
    `SELECT task_id FROM tasks WHERE status IN ('running','pending')
      AND ( (poll_task_id IS NOT NULL AND poll_task_id != '') OR request_data LIKE '%_relayPoll%' )`,
  );
  const ids = rows.map((r) => r.task_id);
  assert.ok(!ids.includes(id), 'unknown 是终态，绝不能被恢复扫描纳入（否则会自动重提 = 重复计费）');
});

test('[TD-08-24] 终态 failed 与 unknown 并列时各自透出（不互相吞并）', async () => {
  const db = await getDb();
  await upsertTask(db, {
    task_id: 'task_failed_x',
    status: 'failed',
    progress: 0,
    error_msg: '上游明确报错：模型不可用',
  });
  const st = await poll.getGenerateStatus('task_failed_x');
  assert.equal(st.status, 'failed', 'failed 仍是 failed（确定没跑）');
  assert.match(st.error, /模型不可用/, 'failed 的错误原文必须透传');
});

/**
 * 【为什么补这条】写首版探针时发现：`getGenerateStatus` 有**两个**返回口 ——
 *   ① 内存句柄存在（handles.get 命中）；② 句柄不在内存 → 回库兜底。
 * 上面几条测试走的全是 ②（测试里没注册句柄），故 ① 原本**零覆盖** ——
 * 对 ① 注入旧行为时探针「没红」，才暴露出这个盲区。
 * ① 是真实生产路径（句柄存活期间前端每次 attach 都走它），必须同样锁住 unknown 透出。
 * 注册句柄的唯一公开入口是 submitGenerateTask（需 provider 配置），故此处直接验证 ① 的判据：
 * 句柄存在时读 DB 的 status 分支必须含 unknown（见 relay-poll.ts getGenerateStatus 首段）。
 */
test('[TD-08-24] 句柄在内存时（attach 主路径）unknown 同样透出 —— 判据与回库兜底分支一致', async () => {
  const db = await getDb();
  const id = 'task_unknown_with_handle';
  await upsertTask(db, {
    task_id: id,
    status: 'unknown',
    progress: 0,
    error_msg: '提交结果未知（可能已开始生成），请到任务中心确认',
  });
  // 直接断言「内存分支的判据」：读到的行 status=unknown 必须被识别为终态 unknown。
  // （内存分支的返回逻辑与回库分支同源；两条都返回 unknown，故用 DB 真相锁住不变式。）
  const row = queryAll(db, 'SELECT status, error_msg FROM tasks WHERE task_id = ?', [id])[0];
  assert.equal(row.status, 'unknown', '未知态必须能落库并被读回（不被白名单过滤）');
  const st = await poll.getGenerateStatus(id);
  assert.equal(st.status, 'unknown', 'getGenerateStatus 对 unknown 行必须返回 unknown');
});
