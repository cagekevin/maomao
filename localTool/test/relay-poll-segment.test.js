/**
 * relay-poll · 时间责任分段（2026-09-21）
 * ------------------------------------------------------------
 * 运行：cd localTool && node --test --import tsx test/relay-poll-segment.test.js
 * 隔离：MAOMAO_DATA_DIR 指向临时目录，绝不触碰真实 ~/.maomao-localtool。
 *
 * 【为什么需要这组测试】原先**一个**总超时（`runOnce` 里 `now - handle.startedAt > timeoutMs`）
 * 同时装了两段性质完全不同的时间：
 *   段① 我们段：提交 + 素材出站（adapter 下载回环 → 传 CDN → 建 project；实测 3s↔69s）
 *   段② 上游段：出图（实测 34s↔349s）
 * ⇒ 段① 的耗时被记进段② 的账，超时还统一报成「生成超时」：上游最终成功落盘的任务被判死
 *   （2026-09-21 实证：前端 302s 判死、后端 349s 成功 → 同一任务两个结论）。
 *
 * 【测什么口径】以 `initRelayPoller`（恢复扫描）为唯一驱动入口，断言 **DB 终态 + 文案归属** ——
 * 行为断言（给定快照 → 得到哪个终态），不断实现细节。
 *
 * 【143 · S2′-b · 2026-09-22】预算注入键由 `timeoutMs` 改名 `overrideMs`（默认值已移入真源
 * `src/budget.ts`，本入口只收 **override**）。⚠️ 同时把注入值与 fixture 耗时**拉开**：
 * 注入 `1 * MIN`，fixture 耗时取 **2min** —— **必须卡在「注入值」与「capability 默认值（image 5min）」
 * 之间**，否则"override 有没有生效"两种情形都会超时，探针形同虚设（首版用 6min + 5min 注入，
 * 实测**改坏注入键测试照样全绿** ⇒ 已修）。
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
const TEST_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'maomao-relay-segment-'));
process.env.MAOMAO_DATA_DIR = TEST_DIR;

const poll = await import(pathToFileURL(path.join(src, 'relay-poll.ts')));
const { getDb, queryAll } = await import(pathToFileURL(path.join(src, 'db', 'database.ts')));
const { upsertTask } = await import(pathToFileURL(path.join(src, 'routes', 'tasks.ts')));

const MIN = 60_000;
/** 出站地址故意指向不可达本机端口：万一走漏到出站，立刻失败、不触网、不挂住测试。 */
const DEAD_BASE_URL = 'http://127.0.0.1:1';

/** 造一行 relay 快照（模拟「提交即返回」时落库的形态）。 */
function snapshot({ startedAt, taskId = '', pendingSubmit }) {
  return JSON.stringify({
    _relayPoll: {
      taskId,
      poll: null,
      providerId: 'lovart',
      capability: 'image',
      model: 'test-model',
      type: 'image',
      baseUrl: DEAD_BASE_URL,
      direct: true,
      ...(pendingSubmit ? { pendingSubmit } : {}),
      startedAt,
    },
  });
}

const readRow = async (id) =>
  queryAll(await getDb(), 'SELECT status, error_msg FROM tasks WHERE task_id = ?', [id])[0];

/** 等首轮 runOnce（registerHandle 内 `void runOnce()`，异步）落库。 */
const tick = () => new Promise((r) => setTimeout(r, 80));

test('段② 从「交出上游」起算：我们段耗时不再吃掉上游预算（不得被判超时）', async () => {
  const id = 'task_seg_upstream_anchor';
  await upsertTask(await getDb(), {
    task_id: id,
    status: 'running',
    progress: 0,
    // 我们段跑了 10 分钟（素材出站慢），刚刚才交出上游
    request_data: snapshot({ startedAt: Date.now() - 10 * MIN, taskId: 'thread-x' }),
    submit_ack_at: Date.now(),
  });

  await poll.initRelayPoller({ overrideMs: 1 * MIN });
  await tick();

  assert.equal(
    (await readRow(id)).status,
    'running',
    '上游段 elapsed≈0 < 1min ⇒ 不得判超时（旧实现按 handles.startedAt 算 10min>预算 → 立刻判死）',
  );
  await poll.cancelGenerateTask(id); // 收尾：停句柄，防定时器常驻测试进程
});

test('段② 真超时 → 文案归属上游段（不再笼统「生成超时」）', async () => {
  const id = 'task_seg_upstream_timeout';
  await upsertTask(await getDb(), {
    task_id: id,
    status: 'running',
    progress: 0,
    // ⚠️ 耗时必须**卡在「注入值」与「capability 默认值」之间**（2min > 注入 1min，但 < image 默认 5min）
    //    —— 否则 override 有没有生效都判不出来（本文件首版用 6min，两种情形都超时 ⇒ 探针形同虚设）。
    request_data: snapshot({ startedAt: Date.now() - 20 * MIN, taskId: 'thread-y' }),
    submit_ack_at: Date.now() - 2 * MIN, // 交出后已过 2min > 1min 预算
  });

  await poll.initRelayPoller({ overrideMs: 1 * MIN });
  await tick();

  const r = await readRow(id);
  assert.equal(r.status, 'failed');
  assert.match(r.error_msg, /上游生成超时/, `文案必须归属上游段，实际：${r.error_msg}`);
});

test('段① 卡住 → 归「提交阶段」且判 unknown（可能已部分出站，禁判 failed）', async () => {
  const id = 'task_seg_prepare_timeout';
  await upsertTask(await getDb(), {
    task_id: id,
    status: 'running',
    progress: 0,
    // 尚未交出（pendingSubmit 在册）且我们段已跑 2min > 1min 预算（同样卡在注入值与默认值之间）
    request_data: snapshot({
      startedAt: Date.now() - 2 * MIN,
      pendingSubmit: { model: 'm', prompt: 'p', capability: 'IMAGE' },
    }),
  });

  await poll.initRelayPoller({ overrideMs: 1 * MIN });
  await tick();

  const r = await readRow(id);
  assert.equal(
    r.status,
    'unknown',
    '提交阶段卡住 = 可能已出站（adapter 内部 mode/附件上传/ensureProject）⇒ TD-08-24 铁律：宁 unknown 不 failed',
  );
  assert.match(r.error_msg, /提交阶段超时/, `文案必须归属我们段，实际：${r.error_msg}`);
});
