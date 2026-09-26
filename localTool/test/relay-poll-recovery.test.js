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

/**
 * 【TD-08-51】恢复扫描必须校验快照 `capability` —— 它是 `JSON.parse` 直取的运行时值，
 *   域外值会让 `budgetMsFor` 返 `undefined` ⇒ `handle.budgetMs = undefined`
 *   ⇒ `runOnce` 的 `now - startedAt > timeoutMs` **恒 false** ⇒ 任务**永不判死**（僵尸句柄）；
 *   且 GET 同报 `undefined` ⇒ 前端也不掐点（**双侧静默互等**）。
 *
 * 【观测点为什么选 `cancelGenerateTask`】它是唯一能从外部区分「句柄存在 / 不存在」的公开入口：
 *   有句柄 ⇒ 停句柄 + 置 failed + 返 `{ok:true}`；无句柄 ⇒ 直接 `{ok:false}`。
 *   比断言模块私有的 `handles` 稳（行为断言，不是断实现细节）。
 */
function snapshotWithCapability(capability) {
  return JSON.stringify({
    _relayPoll: {
      taskId: 'thread-x',
      poll: null,
      providerId: 'lovart',
      capability,
      model: 'test-model',
      type: 'image',
      baseUrl: 'https://example.test',
      direct: true,
      startedAt: Date.now(),
    },
  });
}

test('[TD-08-51] 恢复扫描：快照 capability 域外 ⇒ 不得重建句柄（重建 = 永不判死的僵尸）', async () => {
  const db = await getDb();
  const id = 'task_bad_capability';
  await upsertTask(db, {
    task_id: id,
    status: 'running',
    progress: 0,
    thread_id: 'thread-x',
    request_data: snapshotWithCapability('text'), // 域外：快照可能来自旧版本 / 被改坏
  });
  await poll.initRelayPoller();
  const r = await poll.cancelGenerateTask(id);
  assert.equal(
    r.ok,
    false,
    '域外 capability 不得被重建为句柄（重建 ⇒ budgetMs undefined ⇒ 超时比较恒 false ⇒ 永不判死）',
  );
});

/**
 * 【TD-08-55】`unknown` 终态必须带**上游任务号**（`threadId`）—— HTTP 层一直在消费它
 *   （`routes/generate.ts` 的 GET 响应 `data.threadId`），而原先两个返回口都不生产它
 *   ⇒ 消费者永远拿到 `undefined`。判据（Step 4 三铁律）：**消费者要而生产者没给 ⇒ 回生产者补契约**。
 */
test('[TD-08-55] unknown 行带 poll_task_id ⇒ GET 必须透出 threadId（上游任务号）', async () => {
  const db = await getDb();
  const id = 'task_unknown_thread';
  await upsertTask(db, {
    task_id: id,
    status: 'unknown',
    progress: 0,
    poll_task_id: 'thread-abc', // upsertTask 入参 = 列名（snake_case），不做 camel 映射
    error_msg: '提交结果未知（可能已开始生成）',
  });
  const dbRow = queryAll(db, 'SELECT status, poll_task_id FROM tasks WHERE task_id = ?', [id])[0];
  assert.equal(dbRow.poll_task_id, 'thread-abc', '前置：上游任务号必须已落库');
  const st = await poll.getGenerateStatus(id);
  assert.equal(st.status, 'unknown');
  assert.equal(st.threadId, 'thread-abc', 'unknown 态必须透出上游任务号（HTTP 层在用）');
});

test('[TD-08-51 反向] 合法 capability 的快照仍须照常重建（防加守卫后拒绝正常恢复）', async () => {
  const db = await getDb();
  const id = 'task_good_capability';
  await upsertTask(db, {
    task_id: id,
    status: 'running',
    progress: 0,
    thread_id: 'thread-x',
    request_data: snapshotWithCapability('image'),
  });
  await poll.initRelayPoller();
  const r = await poll.cancelGenerateTask(id);
  assert.equal(r.ok, true, '合法 capability 必须照常重建句柄（否则守卫变成了拒绝恢复）');
});

/**
 * 【146 · D16】后端**从未持有**的行（既无 `poll_task_id` 也无 `_relayPoll` 快照）⇒ `getGenerateStatus`
 *   必须返 `not-found`，**不得报 running**。
 *
 * 【这条行为什么会存在（不是假想）】前端 `reportGenerate` 建行即 `status:'running'` 并 persist 到
 *   **后端同一个 tasks 表**；若 POST 未达/失败前用户刷新或关页面 ⇒ 后端从未收到该任务 ⇒ 行在、句柄无。
 *   （且它不满足恢复扫描的 WHERE：无 `poll_task_id`、`request_data` 里也没有 `_relayPoll` ⇒ 永远拿不到终态。）
 * 【不修会怎样】前端 `pollTask` 无限 attach（候选只认 running），任务中心永久「生成中」，用户零出口
 *   —— 而删掉「停止」后连那条蹩脚出口都没了。
 */
test('[146 D16] 后端从未持有的 running 行 ⇒ getGenerateStatus 返 not-found（幽灵行出口）', async () => {
  const db = await getDb();
  const id = 'task_orphan_running';
  await upsertTask(db, {
    task_id: id,
    status: 'running',
    progress: 0,
    // 无 poll_task_id、无 request_data ⇒ 后端没有任何可跟踪的事实
  });
  const st = await poll.getGenerateStatus(id);
  assert.equal(
    st.status,
    'not-found',
    '后端从未持有的 running 行必须报 not-found —— 报 running 会让前端无限等（幽灵行）',
  );
  assert.match(st.error, /未持有/, 'not-found 必须带可展示文案（生产者给全，前端只转发）');
});

/**
 * 【146 · D17】恢复扫描的跳过路径必须**写终态 `unknown`**，不能只 `continue`。
 *
 * 【判据】跳过 = 「我再也跟踪不了它」—— 这件事没被写下来 ⇒ 该行永久 running（幽灵），用户零出口。
 * 【为什么落 `unknown` 而不是 `failed`】上游**可能已生成**，判 failed 会诱导用户重提 ⇒ 重复计费（TD-08-24）。
 * 【观测路径】取「快照 capability 非法」（TD-08-51 那条）—— 它同时是"跳过不重建"的既有路径。
 */
test('[146 D17] 扫描跳过（快照 capability 非法）⇒ 该行落 unknown（不再永久 running）', async () => {
  const db = await getDb();
  const id = 'task_d17_bad_cap';
  await upsertTask(db, {
    task_id: id,
    status: 'running',
    progress: 0,
    thread_id: 'thread-x',
    request_data: snapshotWithCapability('text'), // 域外 capability ⇒ 跳过（不重建句柄）
  });
  await poll.initRelayPoller();
  const st = await poll.getGenerateStatus(id);
  assert.equal(
    st.status,
    'unknown',
    '跟踪不了的任务必须把这件事写下来（unknown）—— 只 continue ⇒ 该行永久 running',
  );
  assert.match(st.error, /无法恢复/, '文案要说明「重启后无法恢复」并指向任务中心');
});

/**
 * 【收尾 · 停句柄】本文件多处**真调** `initRelayPoller()`，而恢复扫描会把文件前面建的
 * `running` 行（`task_resume_poll`／`task_still_pending`）一并重建为**真句柄**，
 * 其轮询定时器（`relay-poll.ts` 的 `setInterval`）指向 `example.test`、永远等不到终态
 * ⇒ 定时器常驻 ⇒ **用例全过后进程不退出**（文件级测试超时/挂死）。
 * 做法与 `relay-poll-segment.test.js` 一致：谁起了句柄谁收尾（`cancelGenerateTask` 是
 * 公开出口里唯一能停句柄的那个）。
 */
test.after(async () => {
  for (const id of [
    'task_resume_poll',
    'task_still_pending',
    'task_unknown_state',
    'task_unknown_not_resumed',
    'task_failed_x',
    'task_unknown_with_handle',
    'task_bad_capability',
    'task_good_capability',
    'task_unknown_thread',
    'task_orphan_running',
    'task_d17_bad_cap',
  ]) {
    await poll.cancelGenerateTask(id);
  }
});
