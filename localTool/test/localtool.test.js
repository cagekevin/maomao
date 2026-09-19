/**
 * localTool 全功能集成测试（node:test / ESM）
 * ------------------------------------------------------------
 * 运行：node --test test/*.test.js        （在 localTool/ 下）
 * 注意：必须构建（npm run build）使 dist 反映最新 src。
 *
 * 隔离策略：
 *   - 用临时 MAOMAO_DATA_DIR 指向系统临时目录，绝不触碰真实
 *     ~/.maomao-localtool/ 数据。
 *   - database.js 的 getDataDir() 运行时读取 env；测试间通过
 *     改 env + closeDb() 切换/重置数据库实例。
 *   - sql.js 为纯 WASM，无需网络；jimp 只在缩略图生成时用到。
 *
 * 覆盖面：
 *   方案②：base64 外置（JSON 对象 / 裸 base64 / 幂等 / 失败回退）、孤儿 GC
 *   KV：get / set / delete
 *   Tasks：save / batch-save / get(分页·搜索·过滤) / delete / batch-delete / clear
 *   Resources：save / batch-save / get / rescan / delete / clear
 *   Admin：stats / kv-list / cleanup / export / import
 *   Files：list / read / thumbnail
 *   helpers：parsePagination / buildPaginatedQuery / paginatedResult
 */
import test, { beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── 隔离数据目录 ──
let TEST_DIR = '';
function makeDataDir() {
  TEST_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'maomao-localtool-test-'));
  process.env.MAOMAO_DATA_DIR = TEST_DIR;
  return TEST_DIR;
}

// ── mock req / res ──
function makeRes() {
  const r = {
    status: 0,
    headers: {},
    body: null,
    writableEnded: false,
    on(ev, cb) {
      // 兼容 handleRead 的 createReadStream().pipe(res)：pipe 会监听 res 的 'error'
      if (ev === 'error') r._onError = cb;
      return r;
    },
    writeHead(code, h) {
      r.status = code;
      if (h) r.headers = { ...r.headers, ...h };
      return r;
    },
    end(data) {
      r.writableEnded = true;
      if (data !== undefined) {
        const s = Buffer.isBuffer(data) ? data.toString('utf-8') : String(data);
        r.body = (r.body || '') + s;
      }
      return r;
    },
  };
  return r;
}

function makeJsonReq(body, contentType = 'application/json') {
  const data = body === undefined ? Buffer.alloc(0) : Buffer.from(JSON.stringify(body));
  const req = { headers: { 'content-type': contentType }, body: data };
  req.on = (ev, cb) => {
    if (ev === 'data' && data.length) {
      cb(data);
    }
    if (ev === 'end') {
      cb();
    }
    return req;
  };
  return req;
}

function makeGetReq() {
  return makeJsonReq(undefined);
}

function parseResBody(res) {
  return res.body ? JSON.parse(res.body) : null;
}

// B3：成功信封收敛为 {code:0,data}。data() 解包出 data 段，供既有字段断言沿用。
function data(res) {
  const body = parseResBody(res);
  return body && body.code === 0 ? body.data : body;
}

// 构造一个小 PNG（1x1 红点）base64
const RED_PNG_B64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const RED_PNG_DATA_URI = `data:image/png;base64,${RED_PNG_B64}`;
const RED_PNG_BUFFER = Buffer.from(RED_PNG_B64, 'base64');

// 构造画布 JSON（含内嵌 base64 原图 + 无 base64 字段）
function makeCanvasState(projectId, extraNodes = []) {
  return {
    nodes: [
      { id: 'node-1', type: 'image', data: { assetUrl: RED_PNG_DATA_URI, name: '原图' } },
      {
        id: 'node-2',
        type: 'text',
        data: { text: 'hello', assetUrl: 'http://example.com/normal.png' },
      },
      ...extraNodes,
    ],
    edges: [],
    version: '1.0',
  };
}

// 动态 import src 模块（--experimental-strip-types 直接执行 .ts）
const src = path.join(__dirname, '..', 'src');
function toFileUrl(p) {
  return 'file:///' + p.split(path.sep).join('/');
}
const kvMod = await import(toFileUrl(path.join(src, 'routes', 'kv.ts')));
const tasksMod = await import(toFileUrl(path.join(src, 'routes', 'tasks.ts')));
const resourcesMod = await import(toFileUrl(path.join(src, 'routes', 'resources.ts')));
const adminMod = await import(toFileUrl(path.join(src, 'routes', 'admin.ts')));
const filesMod = await import(toFileUrl(path.join(src, 'routes', 'files.ts')));
const dbMod = await import(toFileUrl(path.join(src, 'db', 'database.ts')));
const helpersMod = await import(toFileUrl(path.join(src, 'utils', 'helpers.ts')));
const b64Mod = await import(toFileUrl(path.join(src, 'utils', 'base64Externalize.ts')));
const gcMod = await import(toFileUrl(path.join(src, 'utils', 'orphanGc.ts')));
const platformMod = await import(toFileUrl(path.join(src, 'routes', 'platform.ts')));
const systemMod = await import(toFileUrl(path.join(src, 'routes', 'system.ts')));
// 版本号单源（version.ts），断言随实现走，改版本号时测试永不脱节
const { VERSION } = await import(toFileUrl(path.join(src, 'version.ts')));

// ── 每个测试独立数据目录 ──
beforeEach(() => {
  makeDataDir();
  if (dbMod.closeDb) dbMod.closeDb();
});

afterEach(() => {
  try {
    dbMod.closeDb();
  } catch {}
  try {
    fs.rmSync(TEST_DIR, { recursive: true, force: true });
  } catch {}
});

// ══════════════════════════════════════════════════════════════
// 方案②：base64 外置核心
// ══════════════════════════════════════════════════════════════

test('方案②·KV set 含 base64 的 JSON 画布对象 → value 变为 /files/ URL，原图落盘', async () => {
  const res = makeRes();
  const state = makeCanvasState('proj-test');
  await kvMod.handleKvSet(
    makeJsonReq({ key: 'canvas-state-v1-proj-test', value: JSON.stringify(state) }),
    res,
  );
  assert.equal(res.status, 200, 'set 应 200');
  // docs/118 CAS：set 响应在 { ok:true } 基础上新增 data.version（写入后的快照版本号）
  const setBody = parseResBody(res);
  assert.equal(setBody.code, 0);
  assert.equal(setBody.data.ok, true);
  assert.ok(typeof setBody.data.version === 'number', 'set 应返回写入后的版本号');

  // 读回：value 里的 base64 应被替换为 /files/ URL
  const getRes = makeRes();
  await kvMod.handleKvGet(
    makeGetReq(),
    getRes,
    new URL('http://x/api/kv/get?key=canvas-state-v1-proj-test'),
  );
  const saved = parseResBody(getRes);
  assert.ok(
    saved.nodes[0].data.assetUrl.startsWith('http://127.0.0.1:18080/files/canvas/'),
    `assetUrl 应外置为绝对 /files URL, got=${saved.nodes[0].data.assetUrl}`,
  );
  // 无 base64 的字段保持原样
  assert.equal(saved.nodes[1].data.assetUrl, 'http://example.com/normal.png');
  // 文本节点不受影响
  assert.equal(saved.nodes[1].data.text, 'hello');

  // 磁盘应存在该文件，且内容与原图一致
  const diskPath = path.join(
    TEST_DIR,
    'uploads',
    saved.nodes[0].data.assetUrl.replace(/^http:\/\/127\.0\.0\.1:18080\/files\//, ''),
  );
  assert.ok(fs.existsSync(diskPath), '磁盘应存在外置文件');
  assert.ok(RED_PNG_BUFFER.equals(fs.readFileSync(diskPath)), '落盘内容应与原图一致');
});

test('方案②·外置幂等：相同 base64 写两次 → 磁盘只一个文件', async () => {
  // 第一次
  let res = makeRes();
  await kvMod.handleKvSet(
    makeJsonReq({ key: 'canvas-state-v1-a', value: JSON.stringify(makeCanvasState('a')) }),
    res,
  );
  const getRes1 = makeRes();
  await kvMod.handleKvGet(
    makeGetReq(),
    getRes1,
    new URL('http://x/api/kv/get?key=canvas-state-v1-a'),
  );
  const url1 = parseResBody(getRes1).nodes[0].data.assetUrl;

  // 第二次（相同 base64 不同项目）
  res = makeRes();
  await kvMod.handleKvSet(
    makeJsonReq({ key: 'canvas-state-v1-b', value: JSON.stringify(makeCanvasState('b')) }),
    res,
  );
  const getRes2 = makeRes();
  await kvMod.handleKvGet(
    makeGetReq(),
    getRes2,
    new URL('http://x/api/kv/get?key=canvas-state-v1-b'),
  );
  const url2 = parseResBody(getRes2).nodes[0].data.assetUrl;

  assert.equal(url1, url2, '相同 base64 应映射同一 URL');
  const diskPath = path.join(
    TEST_DIR,
    'uploads',
    url1.replace(/^http:\/\/127\.0\.0\.1:18080\/files\//, ''),
  );
  assert.ok(fs.existsSync(diskPath));
  // 目录下只有 1 个 canvas 文件（幂等不重复落盘）
  const canvasDir = path.join(TEST_DIR, 'uploads', 'canvas');
  const files = fs.readdirSync(canvasDir).filter((f) => !f.startsWith('.'));
  assert.equal(files.length, 1, '相同 base64 只落一个文件');
});

test('方案②·裸 base64 形态（img_orig_*）：整串外置为 URL', async () => {
  const res = makeRes();
  await kvMod.handleKvSet(makeJsonReq({ key: 'img_orig_node1_1', value: RED_PNG_DATA_URI }), res);
  const bareBody = parseResBody(res);
  assert.equal(bareBody.code, 0);
  assert.equal(bareBody.data.ok, true);

  const getRes = makeRes();
  await kvMod.handleKvGet(
    makeGetReq(),
    getRes,
    new URL('http://x/api/kv/get?key=img_orig_node1_1'),
  );
  // 裸 base64 读回的是 URL 字符串
  const saved = parseResBody(getRes);
  assert.ok(
    typeof saved === 'string' && saved.startsWith('http://127.0.0.1:18080/files/canvas/'),
    `img_orig_* 应外置为绝对 URL, got=${saved}`,
  );
  const diskPath = path.join(
    TEST_DIR,
    'uploads',
    saved.replace(/^http:\/\/127\.0\.0\.1:18080\/files\//, ''),
  );
  assert.ok(fs.existsSync(diskPath));
  assert.ok(RED_PNG_BUFFER.equals(fs.readFileSync(diskPath)));
});

test('方案②·失败回退：非法 data URI 保留原值，不破坏 {ok:true}', async () => {
  const res = makeRes();
  const badObj = { nodes: [{ data: { assetUrl: 'data:image/png;base64,@@@invalid@@@' } }] };
  await kvMod.handleKvSet(makeJsonReq({ key: 'k1', value: JSON.stringify(badObj) }), res);
  const badBody = parseResBody(res);
  assert.equal(badBody.code, 0);
  assert.equal(badBody.data.ok, true, 'set 仍应 {code:0,data:{ok:true,version}}');

  const getRes = makeRes();
  await kvMod.handleKvGet(makeGetReq(), getRes, new URL('http://x/api/kv/get?key=k1'));
  const saved = parseResBody(getRes);
  assert.equal(
    saved.nodes[0].data.assetUrl,
    'data:image/png;base64,@@@invalid@@@',
    '非法 base64 应保留原值',
  );
});

test('方案②·孤儿 GC：cleanup 删除未被引用文件，保留被 KV 引用文件', async () => {
  // 先写入一个含 base64 的 KV → 外置出一个磁盘文件
  const res = makeRes();
  await kvMod.handleKvSet(
    makeJsonReq({ key: 'canvas-state-v1-gc', value: JSON.stringify(makeCanvasState('gc')) }),
    res,
  );

  // 制造一个孤儿文件（磁盘有、无任何 KV/tasks/resources 引用）
  const orphanDir = path.join(TEST_DIR, 'uploads', 'canvas');
  fs.writeFileSync(path.join(orphanDir, 'orphan.png'), RED_PNG_BUFFER);
  // 再放一个被 resources 引用的文件（应保留）
  const keptDir = path.join(TEST_DIR, 'uploads', 'tasks');
  fs.mkdirSync(keptDir, { recursive: true });
  const keptPath = path.join(keptDir, 'kept.png');
  fs.writeFileSync(keptPath, RED_PNG_BUFFER);
  const keptUrl = `http://127.0.0.1:18080/files/tasks/kept.png`;
  await insertResourceRow({ id: 'res-kept', url: keptUrl, name: 'kept' });

  // 执行 cleanup
  const cleanRes = makeRes();
  await adminMod.handleAdminCleanup(makeJsonReq(), cleanRes);
  const result = data(cleanRes);
  assert.ok(result.deleted >= 1, `应删除至少 1 个孤儿文件, deleted=${result.deleted}`);

  // 孤儿被删
  assert.ok(!fs.existsSync(path.join(orphanDir, 'orphan.png')), '孤儿文件应被删除');
  // 被 KV 引用的 canvas 文件保留
  const canvasFiles = fs
    .readdirSync(orphanDir)
    .filter((f) => !f.startsWith('.') && f !== 'orphan.png');
  assert.ok(canvasFiles.length >= 1, '被 KV 引用的 canvas 文件应保留');
  // 被 resources 引用的文件保留
  assert.ok(fs.existsSync(keptPath), '被 resources 引用的文件应保留');
});

// ══════════════════════════════════════════════════════════════
// KV 路由
// ══════════════════════════════════════════════════════════════

test('KV·set/get 非 JSON 字符串值', async () => {
  const res = makeRes();
  await kvMod.handleKvSet(makeJsonReq({ key: 'plain', value: 'just-a-string' }), res);
  const getRes = makeRes();
  await kvMod.handleKvGet(makeGetReq(), getRes, new URL('http://x/api/kv/get?key=plain'));
  assert.equal(parseResBody(getRes), 'just-a-string');
});

test('KV·set/get JSON 对象值', async () => {
  const res = makeRes();
  await kvMod.handleKvSet(
    makeJsonReq({ key: 'obj', value: JSON.stringify({ a: 1, b: [2, 3] }) }),
    res,
  );
  const getRes = makeRes();
  await kvMod.handleKvGet(makeGetReq(), getRes, new URL('http://x/api/kv/get?key=obj'));
  assert.deepEqual(parseResBody(getRes), { a: 1, b: [2, 3] });
});

test('KV·set 缺少 key → 400', async () => {
  const res = makeRes();
  await kvMod.handleKvSet(makeJsonReq({ value: 'x' }), res);
  assert.equal(res.status, 400);
});

test('KV·get 不存在 key → null', async () => {
  const getRes = makeRes();
  await kvMod.handleKvGet(makeGetReq(), getRes, new URL('http://x/api/kv/get?key=nope'));
  assert.equal(parseResBody(getRes), null);
});

test('KV·get 缺少 key → 400', async () => {
  const getRes = makeRes();
  await kvMod.handleKvGet(makeGetReq(), getRes, new URL('http://x/api/kv/get'));
  assert.equal(getRes.status, 400);
});

test('KV·delete 删除后 get 为 null，且版本行一并删除（TD-02-10）', async () => {
  await kvMod.handleKvSet(makeJsonReq({ key: 'd1', value: 'v' }), makeRes());
  // 写入后版本 > 0（CAS 基线存在）
  const verRes1 = makeRes();
  await kvMod.handleKvVersion(makeGetReq(), verRes1, new URL('http://x/api/kv/version?key=d1'));
  assert.ok(parseResBody(verRes1).data.version > 0, '写入后应有版本号');
  const delRes = makeRes();
  await kvMod.handleKvDelete(makeJsonReq(), delRes, new URL('http://x/api/kv/delete?key=d1'));
  assert.deepEqual(parseResBody(delRes), { code: 0, data: { ok: true } });
  const getRes = makeRes();
  await kvMod.handleKvGet(makeGetReq(), getRes, new URL('http://x/api/kv/get?key=d1'));
  assert.equal(parseResBody(getRes), null);
  // 版本行随键删除：删除后重建不带旧 CAS 基线（否则「删除后重建」会拿到旧版本号）
  const verRes2 = makeRes();
  await kvMod.handleKvVersion(makeGetReq(), verRes2, new URL('http://x/api/kv/version?key=d1'));
  assert.equal(parseResBody(verRes2).data.version, 0, '删除后版本应归零（版本行随键删）');
});

// ══════════════════════════════════════════════════════════════
// Tasks 路由
// ══════════════════════════════════════════════════════════════

test('Tasks·save + get（camel/snake 映射、id 回填、JSON 字段）', async () => {
  // save 用 camelCase（前端形态），含 JSON 字段和 UI 字段（应被过滤）
  const res = makeRes();
  await tasksMod.handleTasksSave(
    makeJsonReq({
      taskId: 't1',
      nodeId: 'n1',
      prompt: '测试',
      progress: 50,
      channelName: 'default',
      modelName: 'gpt',
      requestData: { url: 'http://x', headers: {} },
      mediaMeta: { w: 100 },
      loading: true, // UI 字段应被过滤
    }),
    res,
  );
  assert.deepEqual(parseResBody(res), { code: 0, data: { ok: true } });

  const getRes = makeRes();
  await tasksMod.handleTasksGet(makeGetReq(), getRes, new URL('http://x/api/tasks'));
  const page = data(getRes);
  assert.equal(page.total, 1);
  const task = page.items[0];
  assert.equal(task.taskId, 't1');
  assert.equal(task.id, 't1', 'id 应回填为 taskId（前端去重键）');
  assert.equal(task.prompt, '测试');
  assert.equal(task.progress, 50);
  assert.deepEqual(task.requestData, { url: 'http://x', headers: {} }, 'JSON 字段应反序列化');
  assert.deepEqual(task.mediaMeta, { w: 100 });
  assert.equal(task.loading, undefined, 'UI 字段应被过滤');
});

test('Tasks·save 用 snake_case 的 task_id（无 taskId/id）→ 400 拒绝', async () => {
  // 真实 API 只接受 camelCase 的 taskId 或 id；仅 snake_case 的 task_id 会被判缺 id 而 400
  const res = makeRes();
  await tasksMod.handleTasksSave(
    makeJsonReq({ task_id: 't2', node_id: 'n2', prompt: 'snake', created_at: 123 }),
    res,
  );
  assert.equal(res.status, 400, '缺少 taskId/id 应 400');
  // 确认没写入
  const getRes = makeRes();
  await tasksMod.handleTasksGet(makeGetReq(), getRes, new URL('http://x/api/tasks'));
  assert.equal(data(getRes).total, 0);
});

test('Tasks·save 缺少 id → 400', async () => {
  const res = makeRes();
  await tasksMod.handleTasksSave(makeJsonReq({ prompt: 'x' }), res);
  assert.equal(res.status, 400);
});

test('Tasks·搜索过滤', async () => {
  await tasksMod.handleTasksSave(
    makeJsonReq({ taskId: 'a', prompt: '苹果', channelName: 'ch1' }),
    makeRes(),
  );
  await tasksMod.handleTasksSave(
    makeJsonReq({ taskId: 'b', prompt: '香蕉', channelName: 'ch2' }),
    makeRes(),
  );

  const getRes = makeRes();
  await tasksMod.handleTasksGet(makeGetReq(), getRes, new URL('http://x/api/tasks?search=苹果'));
  const page = data(getRes);
  assert.equal(page.total, 1);
  assert.equal(page.items[0].taskId, 'a');
});

test('Tasks·数组过滤 (channelName IN)', async () => {
  await tasksMod.handleTasksSave(makeJsonReq({ taskId: 'a', channelName: 'ch1' }), makeRes());
  await tasksMod.handleTasksSave(makeJsonReq({ taskId: 'b', channelName: 'ch2' }), makeRes());
  await tasksMod.handleTasksSave(makeJsonReq({ taskId: 'c', channelName: 'ch3' }), makeRes());

  const getRes = makeRes();
  await tasksMod.handleTasksGet(
    makeGetReq(),
    getRes,
    new URL(
      'http://x/api/tasks?filters=' +
        encodeURIComponent(JSON.stringify({ channelName: ['ch1', 'ch3'] })),
    ),
  );
  const page = data(getRes);
  assert.equal(page.total, 2);
});

test('Tasks·batch-save 多任务 + 删除 + 批量删除 + clear', async () => {
  await tasksMod.handleTasksBatchSave(
    makeJsonReq([
      { taskId: 't1', prompt: 'p1' },
      { taskId: 't2', prompt: 'p2' },
    ]),
    makeRes(),
  );

  let getRes = makeRes();
  await tasksMod.handleTasksGet(makeGetReq(), getRes, new URL('http://x/api/tasks'));
  assert.equal(data(getRes).total, 2);

  // 删除单条
  const delRes = makeRes();
  await tasksMod.handleTasksDelete(
    makeJsonReq(),
    delRes,
    new URL('http://x/api/tasks/delete?id=t1'),
  );
  // 【断言同步到新契约 · 2026-09-17 TD-16-27】`ok` 不再是恒真字面量，而是 `changes > 0`；
  // 并新增**结果事实** `deleted`（真实删除行数）。断言比旧契约**更强**：不只锁"报成功"，
  // 还锁"确实删了 1 行"——旧实现传不存在的 id 也会报成功（此处会红）。
  assert.deepEqual(parseResBody(delRes), { code: 0, data: { ok: true, deleted: 1 } });
  getRes = makeRes();
  await tasksMod.handleTasksGet(makeGetReq(), getRes, new URL('http://x/api/tasks'));
  assert.equal(data(getRes).total, 1);

  // 批量删除
  const del2Res = makeRes();
  await tasksMod.handleTasksBatchDelete(makeJsonReq({ ids: ['t2'] }), del2Res);
  assert.equal(data(del2Res).deleted, 1);
  getRes = makeRes();
  await tasksMod.handleTasksGet(makeGetReq(), getRes, new URL('http://x/api/tasks'));
  assert.equal(data(getRes).total, 0);

  // clear
  await tasksMod.handleTasksSave(makeJsonReq({ taskId: 'x', prompt: 'x' }), makeRes());
  const clearRes = makeRes();
  await tasksMod.handleTasksClear(makeJsonReq(), clearRes);
  assert.equal(data(clearRes).deleted, 1);
  getRes = makeRes();
  await tasksMod.handleTasksGet(makeGetReq(), getRes, new URL('http://x/api/tasks'));
  assert.equal(data(getRes).total, 0);
});

test('【TD-08-39】关键写即时落盘：防抖窗口内磁盘不含新值，flushSaveDb 后立刻含', async () => {
  const db = await dbMod.getDb();
  const dbPath = path.join(TEST_DIR, 'localtool.db');

  // 基线：先落一次盘（后续才能比对"磁盘是不是旧内容"）
  tasksMod.upsertTask(db, { task_id: 'fd0', prompt: 'BASELINE_MARK' });
  dbMod.flushSaveDb();
  assert.ok(fs.existsSync(dbPath), 'flush 后磁盘文件已存在');
  assert.ok(
    fs.readFileSync(dbPath).includes(Buffer.from('BASELINE_MARK')),
    'flush 的内容确实到了磁盘',
  );

  // ① 防抖写：内存 DB 已改，磁盘仍是旧文件 —— 这就是"崩溃即丢"的窗口（本债的机制）
  tasksMod.upsertTask(db, { task_id: 'fd1', prompt: 'DEBOUNCED_MARK' });
  dbMod.debouncedSaveDb();
  assert.ok(
    !fs.readFileSync(dbPath).includes(Buffer.from('DEBOUNCED_MARK')),
    '防抖窗口内磁盘不含新写（500ms 内崩机即丢——重启只信磁盘）',
  );

  // ② 关键写走 flushSaveDb：返回时磁盘已含新写（提交确认/终态用这条）
  dbMod.flushSaveDb();
  assert.ok(
    fs.readFileSync(dbPath).includes(Buffer.from('DEBOUNCED_MARK')),
    'flushSaveDb 后磁盘立刻含新写',
  );

  // ③ 原子写不留残渣：再来一个窗口后仍无 .tmp（tmp+rename 语义未被破坏）
  await new Promise((r) => setTimeout(r, 650));
  assert.ok(!fs.existsSync(`${dbPath}.tmp`), '无 .tmp 残留');
});

test('【TD-08-38】写方分层：后端终态不被前端晚到的 running 快照覆盖', async () => {
  const db = await dbMod.getDb();
  // ① 后端 relay-poll 来路（执行态真相源）：写终态 + 执行句柄事实（判据：该行有 _relayPoll）
  tasksMod.upsertTask(db, {
    task_id: 'wf1',
    node_id: 'n1',
    type: 'IMAGE',
    model_name: 'm',
    status: 'completed',
    progress: 100,
    result_url: '/files/a.png',
    created_at: 1,
    completed_at: 2,
    request_data: JSON.stringify({ _relayPoll: { taskId: 'th1' } }),
  });
  // ② 前端来路：晚到的 running 快照（前端 Task 的 resultUrl 初值就是空串 → 原实现会抹空 result_url）
  await tasksMod.handleTasksSave(
    makeJsonReq({ taskId: 'wf1', nodeId: 'n1', status: 'running', progress: 30, resultUrl: '' }),
    makeRes(),
  );
  const res = makeRes();
  await tasksMod.handleTasksGet(makeGetReq(), res, new URL('http://x/api/tasks'));
  const t = data(res).items.find((x) => x.taskId === 'wf1');
  assert.equal(t.status, 'completed', '终态不得被前端 running 快照回退');
  assert.equal(t.resultUrl, '/files/a.png', 'result_url 不得被前端空串抹掉');
  assert.equal(t.progress, 100, 'progress 归后端（前端传的 30 不生效）');

  // ③ 前端**拥有的**归属/展示列照常可写（分层不是"一刀切禁写"）
  await tasksMod.handleTasksSave(
    makeJsonReq({ taskId: 'wf1', nodeId: 'n1b', modelName: 'm2', prompt: 'p2' }),
    makeRes(),
  );
  const res2 = makeRes();
  await tasksMod.handleTasksGet(makeGetReq(), res2, new URL('http://x/api/tasks'));
  const t2 = data(res2).items.find((x) => x.taskId === 'wf1');
  assert.equal(t2.nodeId, 'n1b', '前端拥有的列照常可写');
  assert.equal(t2.prompt, 'p2');
  assert.equal(t2.status, 'completed', '写归属列时执行态仍不受影响');
});

test('【TD-08-38】分层不误伤：无后端句柄的行（文本/chat 链路）前端仍是执行方，可写终态', async () => {
  // 文本/chat 链路后端无句柄、不建任务行（routes/generate.ts chat 分支）⇒ 终态只有前端知道。
  // 若按"前端一律不许写执行态"一刀切，这类任务会永远停在 running —— 本用例守这条边界。
  await tasksMod.handleTasksSave(
    makeJsonReq({ taskId: 'txt1', nodeId: 'n9', type: 'text', status: 'running', progress: 0 }),
    makeRes(),
  );
  await tasksMod.handleTasksSave(
    makeJsonReq({ taskId: 'txt1', status: 'completed', progress: 100, resultUrl: 'hello' }),
    makeRes(),
  );
  const res = makeRes();
  await tasksMod.handleTasksGet(makeGetReq(), res, new URL('http://x/api/tasks'));
  const t = data(res).items.find((x) => x.taskId === 'txt1');
  assert.equal(t.status, 'completed', '无句柄行：前端作为执行方可写终态');
  assert.equal(t.resultUrl, 'hello');
});

test('【TD-08-38】前端首次建行：仍可为在途任务带 status 初值（不会因分层建不出行）', async () => {
  await tasksMod.handleTasksSave(
    makeJsonReq({ taskId: 'wf2', nodeId: 'n2', status: 'running', progress: 0, resultUrl: '' }),
    makeRes(),
  );
  const res = makeRes();
  await tasksMod.handleTasksGet(makeGetReq(), res, new URL('http://x/api/tasks'));
  const t = data(res).items.find((x) => x.taskId === 'wf2');
  assert.equal(t.status, 'running', '首次插入允许前端给初值');
  assert.equal(t.nodeId, 'n2');
});

test('Tasks·batch-save 非数组 → 400', async () => {
  const res = makeRes();
  await tasksMod.handleTasksBatchSave(makeJsonReq({ taskId: 'x' }), res);
  assert.equal(res.status, 400);
});

// ══════════════════════════════════════════════════════════════
// Resources 路由
// ══════════════════════════════════════════════════════════════

test('Resources·get 分页', async () => {
  for (let i = 1; i <= 25; i++) {
    await insertResourceRow({
      id: `r${i}`,
      url: `http://example.com/${i}.png`,
      name: `img${i}`,
    });
  }
  const getRes = makeRes();
  await resourcesMod.handleResourcesGet(
    makeGetReq(),
    getRes,
    new URL('http://x/api/resources?page=1&pageSize=20'),
  );
  const page = data(getRes);
  assert.equal(page.total, 25);
  assert.equal(page.items.length, 20);
  assert.equal(page.page, 1);
  assert.equal(page.pageSize, 20);
  assert.equal(page.totalPages, 2);
});

test('Resources·delete 删除记录', async () => {
  await insertResourceRow({ id: 'r1', url: 'http://example.com/1.png' });
  const delRes = makeRes();
  await resourcesMod.handleResourcesDelete(
    makeJsonReq(),
    delRes,
    new URL('http://x/api/resources/delete?id=r1'),
  );
  // 【断言同步到新契约 · 2026-09-17 TD-16-27】同上：`ok` 取 `changes > 0`，新增结果事实 `deleted`。
  assert.deepEqual(parseResBody(delRes), { code: 0, data: { ok: true, deleted: 1 } });
  const getRes = makeRes();
  await resourcesMod.handleResourcesGet(makeGetReq(), getRes, new URL('http://x/api/resources'));
  assert.equal(data(getRes).total, 0);
});

test('Resources·clear 全部 + 按 folder 清', async () => {
  await insertResourceRow({ id: 'a', url: 'u1', folder: 'f1' });
  await insertResourceRow({ id: 'b', url: 'u2', folder: 'f2' });

  // 按 folder 清
  let clearRes = makeRes();
  await resourcesMod.handleResourcesClear(makeJsonReq({ folder: 'f1' }), clearRes);
  assert.equal(data(clearRes).deleted, 1);
  let getRes = makeRes();
  await resourcesMod.handleResourcesGet(makeGetReq(), getRes, new URL('http://x/api/resources'));
  assert.equal(data(getRes).total, 1);

  // 清空全部
  clearRes = makeRes();
  await resourcesMod.handleResourcesClear(makeJsonReq(), clearRes);
  assert.equal(data(clearRes).deleted, 1);
  getRes = makeRes();
  await resourcesMod.handleResourcesGet(makeGetReq(), getRes, new URL('http://x/api/resources'));
  assert.equal(data(getRes).total, 0);
});

test('Resources·rescan 扫描 upload 目录', async () => {
  // 造两个磁盘文件
  const imgDir = path.join(TEST_DIR, 'uploads', 'canvas');
  fs.mkdirSync(imgDir, { recursive: true });
  fs.writeFileSync(path.join(imgDir, 'pic.png'), RED_PNG_BUFFER);
  fs.writeFileSync(path.join(imgDir, 'vid.mp4'), Buffer.from([0, 0, 0, 24])); // 假 mp4
  fs.writeFileSync(path.join(imgDir, 'ignore.xyz'), Buffer.from([1])); // 未知类型，不录

  const res = makeRes();
  await resourcesMod.handleResourcesRescan(makeJsonReq(), res);
  const result = data(res);
  assert.equal(result.added, 2, '应录入 pic.png 与 vid.mp4');
  assert.equal(result.count, 2);

  const getRes = makeRes();
  await resourcesMod.handleResourcesGet(
    makeGetReq(),
    getRes,
    new URL('http://x/api/resources?pageSize=50'),
  );
  const page = data(getRes);
  assert.equal(page.total, 2);
  assert.ok(page.items.some((r) => r.name === 'pic.png' && r.type === 'image'));
  assert.ok(page.items.some((r) => r.name === 'vid.mp4' && r.type === 'video'));
});

// 【2026-09-14 失败诚实化】此前读不到 uploads 目录时返回 `{ok:true, count:0}` = **假成功**
// （面板显示成"空库"，把权限/磁盘故障掩盖成正常态）→ 现明确失败。
test('Resources·rescan 读不到 uploads 目录 → 明确失败（不假报 ok:0 条）', async (t) => {
  // 直接让 readdir 失败（跨平台可靠；移走目录在 Windows 上会被 getUploadDir() 重建 + rename EPERM）
  t.mock.method(fs, 'readdirSync', () => {
    throw new Error('EACCES: permission denied');
  });
  const res = makeRes();
  await resourcesMod.handleResourcesRescan(makeJsonReq(), res);
  assert.equal(res.status, 500);
  assert.match(parseResBody(res).error, /无法读取上传目录/);
});

// ══════════════════════════════════════════════════════════════
// Admin 路由
// ══════════════════════════════════════════════════════════════

test('Admin·stats 返回统计', async () => {
  await kvMod.handleKvSet(makeJsonReq({ key: 'k1', value: 'v' }), makeRes());
  await tasksMod.handleTasksSave(makeJsonReq({ taskId: 't1', prompt: 'p' }), makeRes());
  const res = makeRes();
  await adminMod.handleAdminStats(makeGetReq(), res);
  const stats = data(res);
  assert.ok(stats.kv.count >= 1);
  assert.ok(stats.tasks.total >= 1);
  assert.ok('disk' in stats && 'uploadDirBytes' in stats.disk);
});

// 【2026-09-16 端点归位 + 判据分口径】原 `Admin·kv-list` → `/api/kv/keys`（TD-02-30）：
// KV 键枚举属 kv 域，且用户备份（backupStore.exportAll）已成为第二个消费方。
// 判据：默认口径 = 用户数据键（排除 CAS 内部元数据 `<key>_version`）；includeInternal=1 = 运维全表。
test('KV·keys 枚举键（默认排除 _version 内部元数据；includeInternal=1 取全表）', async () => {
  await kvMod.handleKvSet(makeJsonReq({ key: 'a', value: '1' }), makeRes());
  await kvMod.handleKvSet(makeJsonReq({ key: 'b', value: '2' }), makeRes());

  const res = makeRes();
  await kvMod.handleKvKeys(makeGetReq(), res, new URL('http://x/api/kv/keys'));
  const keys = data(res).keys;
  assert.ok(keys.includes('a'));
  assert.ok(keys.includes('b'));
  assert.ok(
    !keys.some((k) => k.endsWith('_version')),
    '默认口径不得把 `<key>_version` 当用户数据（否则备份会带出 CAS 元数据）',
  );

  const resAll = makeRes();
  await kvMod.handleKvKeys(makeGetReq(), resAll, new URL('http://x/api/kv/keys?includeInternal=1'));
  const allKeys = data(resAll).keys;
  assert.ok(allKeys.includes('a_version'), 'includeInternal=1 应取到内部版本键（运维/缓存清理用）');
});

test('Admin·export/import 往返', async () => {
  await kvMod.handleKvSet(makeJsonReq({ key: 'exp1', value: 'val1' }), makeRes());
  await tasksMod.handleTasksSave(makeJsonReq({ taskId: 'exp-task', prompt: 'p' }), makeRes());

  const expRes = makeRes();
  await adminMod.handleAdminExport(makeGetReq(), expRes);
  const exported = data(expRes);
  assert.ok(exported.kv.some((r) => r.key === 'exp1'));
  assert.ok(exported.tasks.some((r) => r.task_id === 'exp-task'));

  // 清空后 import 回
  await adminMod.handleAdminImport(makeJsonReq({ confirm: true, data: exported }), makeRes());
  const getRes = makeRes();
  await kvMod.handleKvGet(makeGetReq(), getRes, new URL('http://x/api/kv/get?key=exp1'));
  assert.equal(parseResBody(getRes), 'val1');
});

test('Admin·import 缺少 confirm → 400', async () => {
  const res = makeRes();
  await adminMod.handleAdminImport(
    makeJsonReq({ data: { kv: [], tasks: [], resources: [] } }),
    res,
  );
  assert.equal(res.status, 400);
});

// ══════════════════════════════════════════════════════════════
// Files 路由（list / read / thumbnail）
// ══════════════════════════════════════════════════════════════

test('Files·list 列出子目录与文件', async () => {
  const imgDir = path.join(TEST_DIR, 'uploads', 'canvas');
  fs.mkdirSync(imgDir, { recursive: true });
  fs.writeFileSync(path.join(imgDir, 'pic.png'), RED_PNG_BUFFER);
  const res = makeRes();
  await filesMod.handleList(makeGetReq(), res, new URL('http://x/api/files/list?subfolder=canvas'));
  const list = data(res);
  assert.ok(list.files.includes('pic.png'), `应列出 pic.png, got=${list.files.join(',')}`);
});

test('Files·read 读取文件内容与 MIME', async () => {
  const imgDir = path.join(TEST_DIR, 'uploads', 'canvas');
  fs.mkdirSync(imgDir, { recursive: true });
  fs.writeFileSync(path.join(imgDir, 'pic.png'), RED_PNG_BUFFER);
  const absPath = path.join(imgDir, 'pic.png');
  // handleRead 用 createReadStream().pipe(res)，res 必须是真正的 Writable 流。
  // 用真实的 Writable 收集数据，同时拦截 writeHead 记录状态/头。
  const { Writable } = await import('node:stream');
  const chunks = [];
  let headers = null;
  const res = new Writable({
    write(c, _enc, cb) {
      chunks.push(Buffer.from(c));
      cb();
    },
    writev(items, cb) {
      for (const i of items) chunks.push(Buffer.from(i.chunk));
      cb();
    },
  });
  res.writeHead = (code, h) => {
    headers = h;
    return res;
  };
  const done = new Promise((resolve, reject) => {
    res.on('finish', resolve);
    res.on('error', reject);
  });
  await filesMod.handleRead(
    makeGetReq(),
    res,
    new URL(`http://x/api/files/read?path=${encodeURIComponent(absPath)}`),
  );
  await done; // 等待 pipe 完成
  // pipe 完成后数据应等于原文件
  assert.match(headers['Content-Type'] || '', /image\/png/);
  assert.equal(headers['Content-Length'], RED_PNG_BUFFER.length);
  const body = Buffer.concat(chunks);
  assert.ok(RED_PNG_BUFFER.equals(body), '读回内容应与原文件一致');
});

// ══════════════════════════════════════════════════════════════
// helpers 纯函数
// ══════════════════════════════════════════════════════════════

test('helpers·parsePagination 默认值与钳制', () => {
  const p1 = helpersMod.parsePagination(new URL('http://x/api'), { sortBy: 'a', sortDir: 'DESC' });
  assert.equal(p1.page, 1);
  assert.equal(p1.pageSize, 20);
  assert.equal(p1.sortBy, 'a');

  const p2 = helpersMod.parsePagination(new URL('http://x/api?page=0&pageSize=999&sortDir=ASC'), {
    sortBy: 'a',
    sortDir: 'DESC',
  });
  assert.equal(p2.page, 1, 'page 最小钳制为 1');
  assert.equal(p2.pageSize, 100, 'pageSize 最大钳制为 100');
  assert.equal(p2.sortDir, 'ASC');

  const p3 = helpersMod.parsePagination(
    new URL('http://x/api?filters=' + encodeURIComponent(JSON.stringify({ isFavorite: true }))),
    { sortBy: 'a', sortDir: 'DESC' },
  );
  assert.deepEqual(p3.filters, { isFavorite: true });
});

test('helpers·buildPaginatedQuery 搜索/过滤/SQL 安全', () => {
  // 搜索
  const q = helpersMod.buildPaginatedQuery(
    'tasks',
    { page: 1, pageSize: 20, sortBy: 'created_at', sortDir: 'DESC', search: 'abc' },
    ['prompt', 'task_id'],
  );
  assert.match(q.sql, /prompt LIKE \? OR task_id LIKE \?/);
  assert.match(q.sql, /LIMIT \? OFFSET \?/);
  assert.equal(q.values.length, 2 + 2, '2 search + LIMIT/OFFSET');

  // 数组过滤
  const q2 = helpersMod.buildPaginatedQuery(
    'tasks',
    {
      page: 1,
      pageSize: 20,
      sortBy: 'created_at',
      sortDir: 'DESC',
      filters: { channelName: ['a', 'b'] },
    },
    ['created_at'],
  );
  assert.match(q2.sql, /channel_name IN \(\?, \?\)/);

  // eqOrPrefix
  const q3 = helpersMod.buildPaginatedQuery(
    'resources',
    {
      page: 1,
      pageSize: 20,
      sortBy: 'timestamp',
      sortDir: 'DESC',
      filters: { folder: { eqOrPrefix: '人物' } },
    },
    ['timestamp'],
  );
  assert.match(q3.sql, /folder = \? OR folder LIKE \?/);

  // sortBy 不在白名单 → 回退 rowid（防注入）
  const q4 = helpersMod.buildPaginatedQuery(
    'tasks',
    { page: 1, pageSize: 20, sortBy: 'prompt; DROP TABLE tasks', sortDir: 'DESC' },
    ['created_at'],
  );
  assert.match(q4.sql, /ORDER BY rowid DESC/);
});

test('helpers·paginatedResult 结构', () => {
  const r = helpersMod.paginatedResult([1, 2], 25, 1, 10);
  assert.deepEqual(r, { items: [1, 2], total: 25, page: 1, pageSize: 10, totalPages: 3 });
});

// ══ B0·错误信封形态冻结（B2 sendError 硬切的安全网）══
// 现后端 sendError 只返 `{error: message}` 字符串形态（helpers.ts:16-18），无 code。
// B2 升级为 `{error:{code,message}}` 前，此测试锁死当前字符串形态；一旦 B2 改动偏离，
// 本测试立即变红以暴露「后端已改、前端未对齐」的窗口期。不传 code 时维持 `{error:message}`。
test('helpers·sendError 冻结：当前返 {error:message} 字符串形态', async () => {
  const res = makeRes();
  helpersMod.sendError(res, '测试错误', 400);
  assert.equal(res.status, 400);
  assert.deepEqual(parseResBody(res), { error: '测试错误' });
});

// B2 新增：sendError 带 code（复用 GEN_ERRORS 字符串 key）→ `{error:{code,message}}`，message 保留供前端兜底。
test('helpers·sendError·B2：传 code 返 {error:{code,message}}，不传仍 {error:message}', async () => {
  const res = makeRes();
  helpersMod.sendError(res, '磁盘已满', 500, 'business');
  assert.equal(res.status, 500);
  assert.deepEqual(parseResBody(res), { error: { code: 'business', message: '磁盘已满' } });

  const resOld = makeRes();
  helpersMod.sendError(resOld, '无 code 兼容', 400);
  assert.deepEqual(parseResBody(resOld), { error: '无 code 兼容' });
});

// ══════════════════════════════════════════════════════════════
// 方案②工具函数直接单测
// ══════════════════════════════════════════════════════════════

test('工具·saveBase64ToFile 返回绝对 URL 且幂等，并**回传 contentId**（2026-09-17 补生产者）', () => {
  const r1 = b64Mod.saveBase64ToFile(RED_PNG_DATA_URI);
  const r2 = b64Mod.saveBase64ToFile(RED_PNG_DATA_URI);
  const url1 = r1?.url;
  assert.ok(
    url1 && url1.startsWith('http://127.0.0.1:18080/files/canvas/'),
    `应返回绝对 URL, got=${url1}`,
  );
  assert.equal(url1, r2?.url, '相同内容幂等');
  // contentId 与 multipart/fileUrl 分支**同一身份**：`sha1:<40hex>`，且与内容寻址文件名里的哈希一致
  // （本函数一直在算它、此前算完即扔 ⇒ 上层只能回 {url}，消费者要么拿不到、要么自己再算一遍）。
  const hex = url1
    .split('/')
    .pop()
    .replace(/\.png$/, '');
  assert.equal(r1.contentId, `sha1:${hex}`, 'contentId 必须 = 文件名里的 sha1(解码后字节)');
  assert.equal(r1.contentId, r2.contentId, 'contentId 幂等');
  const diskPath = path.join(
    TEST_DIR,
    'uploads',
    url1.replace(/^http:\/\/127\.0\.0\.1:18080\/files\//, ''),
  );
  assert.ok(fs.existsSync(diskPath));
  assert.ok(RED_PNG_BUFFER.equals(fs.readFileSync(diskPath)));
});

test('工具·extractFilesUrls 提取 /files/ 引用', () => {
  const value = JSON.stringify({
    a: 'http://127.0.0.1:18080/files/canvas/x.png',
    b: '/files/tasks/y.jpg',
    c: 'no file',
  });
  const urls = b64Mod.extractFilesUrls(value);
  assert.ok(urls.includes('canvas/x.png'));
  assert.ok(urls.includes('tasks/y.jpg'));
  assert.equal(urls.length, 2);
});

test('工具·runOrphanGc dryRun 不删除', () => {
  const dir = path.join(TEST_DIR, 'uploads', 'canvas');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'keep.png'), RED_PNG_BUFFER);
  fs.writeFileSync(path.join(dir, 'orphan.png'), RED_PNG_BUFFER);

  const res = gcMod.runOrphanGc(
    ['/files/canvas/keep.png'],
    path.join(TEST_DIR, 'uploads'),
    new Set(),
    true,
  );
  assert.equal(res.deleted, 1, 'dryRun 统计可删除 1 个');
  assert.ok(fs.existsSync(path.join(dir, 'orphan.png')), 'dryRun 不真正删除');

  // 真删
  const res2 = gcMod.runOrphanGc(
    ['/files/canvas/keep.png'],
    path.join(TEST_DIR, 'uploads'),
    new Set(),
    false,
  );
  assert.equal(res2.deleted, 1);
  assert.ok(!fs.existsSync(path.join(dir, 'orphan.png')));
  assert.ok(fs.existsSync(path.join(dir, 'keep.png')));
});

// ══════════════════════════════════════════════════════════════
// Platform 路由（纯本地静态数据）
// ══════════════════════════════════════════════════════════════

test('Platform·plugin manifest 返回版本且无更新', async () => {
  const res = makeRes();
  await platformMod.handlePluginManifest(makeGetReq(), res);
  assert.deepEqual(parseResBody(res), { code: 0, data: { version: VERSION, hasUpdate: false } });
});

test('Platform·workflow-apps by-project 返回 stub null', async () => {
  const res = makeRes();
  await platformMod.handleWorkflowAppsByProject(
    makeGetReq(),
    res,
    new URL('http://x/api/workflow-apps/by-project/123'),
  );
  const body = parseResBody(res);
  assert.equal(body.success, true);
  assert.equal(body.data, null);
});

test('Platform·builtin models 返回分类清单', async () => {
  const res = makeRes();
  await platformMod.handleBuiltin(makeGetReq(), res);
  const body = parseResBody(res);
  assert.equal(body.success, true);
  assert.ok(Array.isArray(body.data.image) && body.data.image.length > 0);
  assert.ok(Array.isArray(body.data.video) && body.data.video.length > 0);
});

test('Platform·models 返回模型系列映射', async () => {
  const res = makeRes();
  await platformMod.handleModels(makeGetReq(), res);
  const body = parseResBody(res);
  assert.equal(body.success, true);
  assert.ok(Array.isArray(body.data) && body.data.length > 0);
  assert.ok(body.data.some((m) => m.name && m.seriesKey && m.seriesLabel));
});

// ══════════════════════════════════════════════════════════════
// System 路由（纯本地部分）
// ══════════════════════════════════════════════════════════════

test('System·status 返回版本与端口', async () => {
  const res = makeRes();
  await systemMod.handleStatus(makeGetReq(), res);
  const body = parseResBody(res);
  assert.equal(body.status, 'ok');
  assert.equal(body.version, VERSION);
  assert.equal(typeof body.port, 'number');
});

test('System·jianying/send 单文件形态', async () => {
  const res = makeRes();
  await systemMod.handleJianyingSend(
    makeJsonReq({ fileUrl: 'http://x/1.mp4', localPath: '/tmp/1.mp4', fileName: '1.mp4' }),
    res,
  );
  const body = parseResBody(res);
  assert.equal(body.status, 'ok');
});

test('System·jianying/send 批量形态', async () => {
  const res = makeRes();
  await systemMod.handleJianyingSend(
    makeJsonReq({ items: [{ fileUrl: 'a' }, { localPath: 'b' }] }),
    res,
  );
  const body = parseResBody(res);
  assert.equal(body.status, 'ok');
  assert.equal(body.count, 2);
});

test('System·jianying/send 缺 fileUrl/localPath → 400', async () => {
  const res = makeRes();
  await systemMod.handleJianyingSend(makeJsonReq({ foo: 'bar' }), res);
  assert.equal(res.status, 400);
});

test('System·jianying/send 空 body → 400', async () => {
  const res = makeRes();
  await systemMod.handleJianyingSend(makeJsonReq(null), res);
  assert.equal(res.status, 400);
});

// ══════════════════════════════════════════════════════════════
// Database 本地函数（backupDb / exportDataJson）
// ══════════════════════════════════════════════════════════════

test('Database·backupDb 生成整库备份文件', async () => {
  await kvMod.handleKvSet(makeJsonReq({ key: 'b1', value: 'v' }), makeRes());
  await dbMod.saveDb(); // 强制落盘，保证主库文件存在
  const bakPath = dbMod.backupDb(true); // force 绕过日期去重
  assert.ok(bakPath, '应生成备份路径');
  assert.ok(fs.existsSync(bakPath), '备份文件应存在');
  const backupDir = path.join(TEST_DIR, 'backups');
  assert.ok(fs.existsSync(backupDir));
});

test('Database·exportDataJson 导出轻量 JSON', async () => {
  await tasksMod.handleTasksSave(
    makeJsonReq({ taskId: 'e1', prompt: 'p', channelName: 'c' }),
    makeRes(),
  );
  await dbMod.saveDb();
  const filePath = dbMod.exportDataJson(true);
  assert.ok(filePath, '应生成导出文件');
  const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  assert.ok(data.counts.tasks >= 1);
  assert.ok(data.tasks.some((t) => t.task_id === 'e1'));
});

// ══════════════════════════════════════════════════════════════
// Files 路由（upload multipart / thumbnail / move / mkdir）
// ══════════════════════════════════════════════════════════════

/** 构造 multipart/form-data 请求（单文件 + 可选字段） */
function makeMultipartReq({ filename, fileContent, contentType, fields = {} }) {
  const boundary = '----testboundary123';
  const parts = [];
  for (const [k, v] of Object.entries(fields)) {
    parts.push(`--${boundary}\r\nContent-Disposition: form-data; name="${k}"\r\n\r\n${v}\r\n`);
  }
  parts.push(
    `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="file"; filename="${filename}"\r\n` +
      `Content-Type: ${contentType}\r\n\r\n`,
  );
  const head = Buffer.from(parts.join(''));
  const tail = Buffer.from(`\r\n--${boundary}--\r\n`);
  const data = Buffer.concat([head, fileContent, tail]);
  const req = {
    headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
    body: data,
  };
  req.on = (ev, cb) => {
    if (ev === 'data' && data.length) cb(data);
    if (ev === 'end') cb();
    return req;
  };
  return req;
}

test('Files·upload multipart 落盘并返回 URL + 缩略图', async () => {
  const res = makeRes();
  await filesMod.handleUpload(
    makeMultipartReq({
      filename: 'up.png',
      fileContent: RED_PNG_BUFFER,
      contentType: 'image/png',
      fields: { subfolder: 'canvas' },
    }),
    res,
  );
  const body = data(res);
  assert.ok(body.url, '应返回 url');
  assert.match(body.url, /^http:\/\/127\.0\.0\.1:18080\/files\/canvas\//);
  assert.ok(body.thumbnailUrl, 'png 应生成缩略图');
  // 落盘文件存在且内容一致
  const relPath = body.url.replace(/^http:\/\/127\.0\.0\.1:18080\/files\//, '');
  const diskPath = path.join(TEST_DIR, 'uploads', relPath);
  assert.ok(fs.existsSync(diskPath));
  assert.ok(RED_PNG_BUFFER.equals(fs.readFileSync(diskPath)));
});

test('TD-12-5·multipart 上传携 projectId → resource 行写入 project_id（不再恒 NULL）', async () => {
  const res = makeRes();
  // 用独立字节，避开其它用例 fixture 的 contentId 去重（去重命中则复用既有行、不新建）
  const uniq = Buffer.concat([RED_PNG_BUFFER, Buffer.from('pid-A')]);
  await filesMod.handleUpload(
    makeMultipartReq({
      filename: 'pid.png',
      fileContent: uniq,
      contentType: 'image/png',
      fields: { subfolder: 'migrated', projectId: 'proj-A' },
    }),
    res,
  );
  assert.equal(res.status, 200);
  const url = parseResBody(res).data.url;
  const rel = url.replace(/^https?:\/\/[^/]+/, '').replace(/^\/files\//, '');
  const db = await dbMod.getDb();
  const row = dbMod.queryOne(db, 'SELECT * FROM resources WHERE id = ?', [
    `local-${rel.replace(/\//g, '-')}`,
  ]);
  assert.ok(row, '上传后应已登记 resource 行（不经 rescan）');
  assert.equal(row.project_id, 'proj-A', 'project_id 必须写入（隔离写入链闭环）');
});

test('TD-12-5·multipart 上传不携 projectId → 行 project_id 为 NULL（legacy，全项目可见）', async () => {
  const res = makeRes();
  const uniq = Buffer.concat([RED_PNG_BUFFER, Buffer.from('nopid')]);
  await filesMod.handleUpload(
    makeMultipartReq({
      filename: 'nopid.png',
      fileContent: uniq,
      contentType: 'image/png',
      fields: { subfolder: 'migrated' },
    }),
    res,
  );
  assert.equal(res.status, 200);
  const url = parseResBody(res).data.url;
  const rel = url.replace(/^https?:\/\/[^/]+/, '').replace(/^\/files\//, '');
  const db = await dbMod.getDb();
  const row = dbMod.queryOne(db, 'SELECT * FROM resources WHERE id = ?', [
    `local-${rel.replace(/\//g, '-')}`,
  ]);
  assert.ok(row, '上传后应已登记 resource 行');
  assert.ok(row.project_id == null, '未提供 projectId → 保持 legacy（NULL）');
});

test('【TD-08-31】非法 subfolder → 400 且不落盘不建行（禁止静默回退 canvas）', async () => {
  const res = makeRes();
  await filesMod.handleUpload(
    makeMultipartReq({
      filename: 'evil.png',
      fileContent: RED_PNG_BUFFER,
      contentType: 'image/png',
      fields: { subfolder: '../etc' },
    }),
    res,
  );
  assert.equal(res.status, 400, '非法目录必须拒绝（原为静默回退 canvas ⇒ 盘与声明目录脱钩）');
  const db = await dbMod.getDb();
  const rows = dbMod.queryAll(db, 'SELECT id FROM resources');
  assert.equal(rows.length, 0, '被拒请求不得留下 resource 行');
});

test('【TD-08-45】空/缺省 subfolder → 400 且不落盘（禁止静默回退 canvas）', async () => {
  // 与 TD-08-31 同族：显式非法已 400，但**空值**此前被 `?? 'canvas'` 静默吞成默认目录。
  // 空值 = 调用方契约违约（忘传），属"默认值兜底"（Step 4 形态④），须与显式非法同等对待。
  const emptyRes = makeRes();
  await filesMod.handleUpload(
    makeMultipartReq({
      filename: 'nosub.png',
      fileContent: Buffer.concat([RED_PNG_BUFFER, Buffer.from('nosub')]),
      contentType: 'image/png',
      fields: { subfolder: '' },
    }),
    emptyRes,
  );
  assert.equal(
    emptyRes.status,
    400,
    '空 subfolder 必须拒绝（原静默回退 canvas）；got ' + emptyRes.status,
  );

  // 缺省字段同样拒绝（undefined 分支）
  const missingRes = makeRes();
  await filesMod.handleUpload(
    makeMultipartReq({
      filename: 'miss.png',
      fileContent: Buffer.concat([RED_PNG_BUFFER, Buffer.from('miss')]),
      contentType: 'image/png',
      fields: {},
    }),
    missingRes,
  );
  assert.equal(missingRes.status, 400, '缺省 subfolder 必须拒绝；got ' + missingRes.status);

  // 被拒请求不得留下 resource 行（盘行一致：不落盘就不建行）
  const db = await dbMod.getDb();
  const rows = dbMod.queryAll(
    db,
    "SELECT id FROM resources WHERE id LIKE 'local-%nosub%' OR id LIKE 'local-%miss%'",
  );
  assert.equal(rows.length, 0, '被拒请求不得留下 resource 行');
});

// 【2026-09-19 · TD-08-44】本用例靠 `chmod 0o000` 造「不可读目录」，但**两种环境造不出来**：
//   ① Windows —— POSIX 权限位不生效，目录照样能读 ⇒ `errors` 恒 0 ⇒ 断言必红（不是被测代码坏了）；
//   ② 以 root 运行 —— root 绕过权限位，同样读得到。
// 这两种情况下**判据本身不成立**，应**跳过并写明理由**，而不是让它在别人的机器上恒红
// （跳过 ≠ 通过：skip reason 会打在 TAP 输出里，不会被误读成"这条被验证过了"）。
const canMakeDirUnreadable = process.platform !== 'win32' && process.getuid?.() !== 0;
test(
  '【TD-08-31】rescan：目录不可读 → errors 如实回传（不再静默漏扫）',
  {
    skip: canMakeDirUnreadable
      ? false
      : '平台限制：Windows / root 下 chmod 0o000 造不出不可读目录（权限位不生效），本用例判据不成立',
  },
  async () => {
    const bad = path.join(dbMod.getUploadDir(), 'migrated', 'noread');
    fs.mkdirSync(bad, { recursive: true });
    fs.writeFileSync(path.join(bad, 'a.png'), RED_PNG_BUFFER);
    fs.chmodSync(bad, 0o000); // 造"读不到"：原实现静默 return，调用方仍收到"扫描成功"
    try {
      const res = makeRes();
      await resourcesMod.handleResourcesRescan(makeJsonReq(), res);
      const body = parseResBody(res);
      assert.equal(body.code, 0, '其余部分能扫成 → 不整体报错');
      assert.ok(body.data.errors >= 1, `必须如实回报漏扫处数，实际 errors=${body.data.errors}`);
    } finally {
      fs.chmodSync(bad, 0o700);
    }
  },
);

test('TD-12-5·JSON dataUri 上传携 projectId → 行写入 project_id', async () => {
  const res = makeRes();
  const dataUri = `data:image/png;base64,${RED_PNG_BUFFER.toString('base64')}`;
  await filesMod.handleUpload(
    makeJsonReq({ dataUri, subfolder: 'migrated', projectId: 'proj-B' }),
    res,
  );
  assert.equal(res.status, 200);
  const db = await dbMod.getDb();
  const row = dbMod.queryOne(db, 'SELECT * FROM resources WHERE project_id = ?', ['proj-B']);
  assert.ok(row, 'dataUri 上传应登记行并写 project_id');
});

test('Files·upload multipart 缺少文件 → 400', async () => {
  const boundary = '----testboundary123';
  const data = Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="subfolder"\r\n\r\ncanvas\r\n--${boundary}--\r\n`,
  );
  const req = {
    headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
    body: data,
  };
  req.on = (ev, cb) => {
    if (ev === 'data' && data.length) cb(data);
    if (ev === 'end') cb();
    return req;
  };
  const res = makeRes();
  await filesMod.handleUpload(req, res);
  assert.equal(res.status, 400);
});

// handleThumbnail 与 handleRead 一样走 createReadStream().pipe(res) 直返二进制流（<img src> 直链），
// 必须用真正的 Writable 收集流数据（makeRes 无 write/once，无法接流）。断言头部 MIME 与字节内容。
async function streamThumb(urlStr) {
  const { Writable } = await import('node:stream');
  const chunks = [];
  let headers = null;
  let status = 0;
  const res = new Writable({
    write(c, _enc, cb) {
      chunks.push(Buffer.from(c));
      cb();
    },
    writev(items, cb) {
      for (const i of items) chunks.push(Buffer.from(i.chunk));
      cb();
    },
  });
  res.writeHead = (code, h) => {
    status = code;
    headers = h;
    return res;
  };
  const done = new Promise((resolve, reject) => {
    res.on('finish', resolve);
    res.on('error', reject);
  });
  await filesMod.handleThumbnail(makeGetReq(), res, new URL(urlStr));
  await done;
  return { status, headers, body: Buffer.concat(chunks) };
}

test('Files·thumbnail 为文件生成缩略图（直返二进制流）', async () => {
  // 先造一个磁盘文件
  const canvasDir = path.join(TEST_DIR, 'uploads', 'canvas');
  fs.mkdirSync(canvasDir, { recursive: true });
  fs.writeFileSync(path.join(canvasDir, 'thumb.png'), RED_PNG_BUFFER);
  const { status, headers, body } = await streamThumb(
    'http://x/api/files/thumbnail?url=' +
      encodeURIComponent('/files/canvas/thumb.png') +
      '&maxDim=100',
  );
  assert.equal(status, 200);
  assert.match(
    headers['Content-Type'] || '',
    /image\/png/,
    '应返回 PNG 二进制流（非 {thumbnailUrl} JSON）',
  );
  assert.equal(headers['Content-Length'], RED_PNG_BUFFER.length);
  assert.ok(body.length > 0, '应返回缩略图二进制内容');
});

test('Files·thumbnail format 校验：webp 被拒回落源扩展名，白名单 jpeg 生效', async () => {
  const canvasDir = path.join(TEST_DIR, 'uploads', 'canvas');
  fs.mkdirSync(canvasDir, { recursive: true });
  fs.writeFileSync(path.join(canvasDir, 'fmt.png'), RED_PNG_BUFFER);
  const abs = encodeURIComponent('/files/canvas/fmt.png');

  // webp：Jimp 0.22 无编码器 → 必须回落源扩展名 .png，绝不产出假 .webp
  const w = await streamThumb(`http://x/api/files/thumbnail?url=${abs}&maxDim=64&format=webp`);
  assert.match(
    w.headers['Content-Type'] || '',
    /image\/png/,
    'webp 应回落源扩展名 png（Content-Type 为 image/png）',
  );
  assert.ok(!/webp/.test(w.headers['Content-Type'] || ''), '不得产出 .webp 假文件');

  // jpeg：白名单内 → 缩略图 Content-Type 为 image/jpeg
  const j = await streamThumb(`http://x/api/files/thumbnail?url=${abs}&maxDim=64&format=jpeg`);
  assert.match(j.headers['Content-Type'] || '', /image\/jpeg/, 'jpeg 白名单应产出 image/jpeg');
});

// 【2026-09-17 语义修正】「源格式不可缩」= 预期内的**本优化不适用**，不是端点出错 →
// 302 回原图（浏览器能直接渲染 webp/avif 等），让所有消费方一次拿到可显示地址；
// 原先返回 415，逼每个前端组件各自处理错误再各自回退 = 同一能力 N 份实现的复发土壤。
test('Files·thumbnail 源为 webp（Jimp 能读不能写）→ 302 回原图，不是 415', async () => {
  const webpDir = path.join(TEST_DIR, 'uploads', 'web');
  fs.mkdirSync(webpDir, { recursive: true });
  // 最小 1x1 webp 真字节（Jimp 可解码 → 只有「无编码器」这一条路，测的正是该判据）
  fs.writeFileSync(
    path.join(webpDir, 'src.webp'),
    Buffer.from('UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==', 'base64'),
  );
  const r = await streamThumb(
    'http://x/api/files/thumbnail?url=' + encodeURIComponent('/files/web/src.webp') + '&maxDim=64',
  );
  assert.equal(r.status, 302, '不可缩源应 302 回原图（不是 415 错误）');
  assert.equal(r.headers.Location, '/files/web/src.webp', 'Location 必须指向原图');
  // 必须可缓存：「该源不可缩」是文件的不变属性；no-store 会让每次渲染都重走一遍 302（重复请求 + 刷日志）
  assert.match(r.headers['Cache-Control'] || '', /max-age/, '302 必须可缓存');
});

// 【2026-09-17 第二处语义修正】存量「名实不符」文件：`.jpg` 名装 webp 字节（旧命名 `sha1(url)_basename.jpg` 遗留）。
// 上方 `isJimpEncodableExt('jpg')` 为真 → 短路信扩展名 → 先按 jpg 解码 → resize 失败 → 旧实现报 500
// （把「本优化不适用」报成「端点故障」）。修正：resize 失败后再判字节真相，不可编码 → 302 回原图。
test('Files·thumbnail 名实不符（.jpg 名 / webp 字节）→ 302 回原图，不是 500', async () => {
  const dir = path.join(TEST_DIR, 'uploads', 'web');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, 'legacy.jpg'),
    Buffer.from('UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==', 'base64'),
  );
  const r = await streamThumb(
    'http://x/api/files/thumbnail?url=' +
      encodeURIComponent('/files/web/legacy.jpg') +
      '&maxDim=64',
  );
  assert.equal(r.status, 302, '名实不符的不可缩源应 302 回原图（不是 500）');
  assert.equal(r.headers.Location, '/files/web/legacy.jpg', 'Location 必须指向原图');
  assert.match(r.headers['Cache-Control'] || '', /max-age/, '302 必须可缓存（防每次渲染重复请求）');
});

test('Files·thumbnail 中文/空格文件名（含双重编码）能命中磁盘（对齐静态服务 decode）', async () => {
  const dir = path.join(TEST_DIR, 'uploads', 'migrated', '人物');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, '妹妹骷髅 .png'), RED_PNG_BUFFER);
  // 前端对「已编码相对路径」再交给 query → url=%2F…%25E4…（双态）；searchParams.get 解一层后仍是编码态，
  // handleThumbnail 需再 decodeURIComponent 才能真正命中中文目录 + 空格文件名。
  const rel = encodeURI('/files/migrated/人物/妹妹骷髅 .png'); // 一层编码：%E4%BA…%20
  const queryUrl = encodeURIComponent(rel); // 再编码：%25E4%BA…
  const r = await streamThumb(`http://x/api/files/thumbnail?maxDim=64&url=${queryUrl}`);
  assert.equal(r.status, 200, '双重编码路径应命中并出图');
  assert.match(r.headers['Content-Type'] || '', /image\/png/, '应返回 PNG');
});

test('Files·move 移动文件（相对路径，后端拼 uploadDir）', async () => {
  const canvasDir = path.join(TEST_DIR, 'uploads', 'canvas');
  fs.mkdirSync(canvasDir, { recursive: true });
  const srcFile = path.join(canvasDir, 'mv.png');
  fs.writeFileSync(srcFile, RED_PNG_BUFFER);
  await seedResource('canvas/mv.png');
  // handleMove 为 context-only 移动归类：磁盘 / url / contentId 不变，仅 folder(UI) 变更
  const res = makeRes();
  await filesMod.handleMove(makeJsonReq({ src: 'canvas/mv.png', dst: 'migrated/mv.png' }), res);
  const d = parseResBody(res).data;
  assert.equal(d.ok, true, '移动成功');
  assert.equal(d.id, 'local-canvas-mv.png', 'id 不变（不因归类而变身份）');
  assert.equal(d.url, 'http://127.0.0.1:18080/files/canvas/mv.png', 'url 不变（物理路径不动）');
  const db = await dbMod.getDb();
  const row = dbMod.queryOne(db, 'SELECT folder, url FROM resources WHERE id = ?', [
    'local-canvas-mv.png',
  ]);
  assert.equal(row.folder, 'migrated', 'folder(UI 分类) 更新为目标目录');
  assert.equal(row.url, 'http://127.0.0.1:18080/files/canvas/mv.png', 'url 不变');
  assert.ok(fs.existsSync(srcFile), '磁盘源文件保持原位置（不移动）');
  assert.ok(
    !fs.existsSync(path.join(TEST_DIR, 'uploads', 'migrated', 'mv.png')),
    '目标目录无新物理文件',
  );
});

test('docs122·context-only rename 不改 url → 画布 KV / 任务引用保持不变（contentId/url 稳定，永不破图）', async () => {
  fs.mkdirSync(path.join(TEST_DIR, 'uploads', 'web'), { recursive: true });
  fs.writeFileSync(path.join(TEST_DIR, 'uploads', 'web', '角色.png'), RED_PNG_BUFFER);
  const db = await dbMod.getDb();
  const oldRelRaw = 'web/角色.png';
  const oldAbsRaw = `http://127.0.0.1:18080/files/${oldRelRaw}`; // 原样绝对
  const oldAbsEnc = `http://127.0.0.1:18080/files/${encodeURI(oldRelRaw)}`; // 编码绝对（中文必变 %E8…）
  // 建一个本地文件资源
  await insertResourceRow({
    id: 'local-web-角色.png',
    url: oldAbsRaw,
    folder: 'web',
    name: '角色.png',
  });
  // 画布 KV：节点A 存原样绝对、节点B 存编码绝对；任务存编码相对
  dbMod.run(db, `INSERT INTO kv (key, value) VALUES (?, ?)`, [
    'canvas-state-v1-p1',
    JSON.stringify({ nodes: [{ data: { url: oldAbsRaw } }, { data: { assetUrl: oldAbsEnc } }] }),
  ]);
  dbMod.run(db, `INSERT INTO tasks (task_id, prompt) VALUES (?, ?)`, [
    't1',
    `ref /files/${encodeURI(oldRelRaw)}`,
  ]);
  // 改名 角色.png → 新名.png（context-only：只改显示名）
  const res = makeRes();
  await resourcesMod.handleResourcesRename(
    makeJsonReq(),
    res,
    new URL(
      `http://x/api/resources/rename?id=local-web-角色.png&name=${encodeURIComponent('新名')}`,
    ),
  );
  assert.ok(parseResBody(res).data?.ok, 'rename 成功');
  const row = dbMod.queryOne(db, `SELECT url, name FROM resources WHERE id='local-web-角色.png'`);
  assert.equal(row.url, oldAbsRaw, 'url 不变（physBucket+contentId 不可变）→ asset 永不破图');
  assert.equal(row.name, '新名.png', '显示名已更新');
  // url 不变 → 无需改写任何引用：KV / tasks 保持原 url（contentId/url 稳定收益）
  const kvt = dbMod.queryOne(db, `SELECT value FROM kv WHERE key='canvas-state-v1-p1'`).value;
  assert.ok(
    kvt.includes(oldAbsRaw) && kvt.includes(oldAbsEnc),
    'KV 引用不变（url 未变，无需改写）',
  );
  const t = dbMod.queryOne(db, `SELECT prompt FROM tasks WHERE task_id='t1'`);
  assert.ok(t.prompt.includes(encodeURI(oldRelRaw)), '任务引用不变（url 未变，无需改写）');
  // 磁盘文件保持原名（改名只动 context，不物理移动）
  assert.ok(fs.existsSync(path.join(TEST_DIR, 'uploads', 'web', '角色.png')), '磁盘文件保持原样');
});

test('Files·mkdir 创建目录', async () => {
  const target = path.join(TEST_DIR, 'uploads', 'newdir', 'sub');
  const res = makeRes();
  await filesMod.handleMkdir(makeJsonReq({ folder: 'newdir/sub' }), res);
  assert.deepEqual(parseResBody(res), { code: 0, data: { ok: true } });
  assert.ok(fs.existsSync(target));
});

// 【2026-09-14 越根守卫】此前 handleMkdir 直接 path.join(uploadDir, folder)，不拒 `..`
// → `{"folder":"../../x"}` 能把目录建到 uploads 之外（唯一缺守卫的目录写入口）。
test('Files·mkdir 拒绝越根路径（不得把目录建到 uploads 之外）', async () => {
  const escaped = path.join(TEST_DIR, 'escaped-by-mkdir');
  const res = makeRes();
  await filesMod.handleMkdir(makeJsonReq({ folder: '../escaped-by-mkdir' }), res);
  assert.equal(res.status, 400);
  assert.match(parseResBody(res).error, /Invalid folder path/);
  assert.ok(!fs.existsSync(escaped), '不得在 uploads 之外创建目录');
});

// ══════════════════════════════════════════════════════════════
// docs/13 文件生命周期：删除入口只删记录、删盘统一由引用感知 GC 裁决
// ══════════════════════════════════════════════════════════════
test('docs13·删除 task 不删盘：磁盘文件仍在（GC 裁决，不因任务删除误删画布引用）', async () => {
  const uploadDir = path.join(TEST_DIR, 'uploads');
  const tasksDir = path.join(uploadDir, 'tasks');
  fs.mkdirSync(tasksDir, { recursive: true });

  // 在画布 KV 中引用一个 tasks 文件（模拟"清空任务但画布仍用"的场景）
  const fileRel = 'tasks/aaa.png';
  const absPath = path.join(uploadDir, fileRel);
  fs.writeFileSync(absPath, RED_PNG_BUFFER);
  const url = `http://127.0.0.1:18080/files/${fileRel}`;

  // 把该文件登记进 tasks 表
  await tasksMod.handleTasksSave(
    makeJsonReq({ taskId: 't1', resultUrl: url, prompt: 'p' }),
    makeRes(),
  );
  // 画布 KV 引用同一文件
  await kvMod.handleKvSet(
    makeJsonReq({
      key: 'canvas-state-v1-p',
      value: JSON.stringify({ nodes: [{ id: 'n1', data: { assetUrl: url } }] }),
    }),
    makeRes(),
  );

  // 删除任务 → 只删记录，不删盘（旧实现会 deleteLocalFile 误删）
  await tasksMod.handleTasksDelete(
    makeJsonReq(),
    makeRes(),
    new URL('http://x/api/tasks/delete?id=t1'),
  );
  // 尾部 GC 因画布 KV 仍引用 → 不删文件
  assert.ok(fs.existsSync(absPath), '删除任务后画布引用的文件应保留');

  // 再清空画布引用（删除 KV），触发 GC 回收
  await kvMod.handleKvDelete(
    makeJsonReq(),
    makeRes(),
    new URL('http://x/api/kv/delete?key=canvas-state-v1-p'),
  );
  await gcMod.runReferenceGc(false);
  assert.ok(!fs.existsSync(absPath), '全库无引用后 GC 应回收孤儿文件');
});

test('docs13·删除 resource 不删盘 + GC 回收真正的孤儿', async () => {
  const uploadDir = path.join(TEST_DIR, 'uploads');
  const migratedDir = path.join(uploadDir, 'migrated');
  fs.mkdirSync(migratedDir, { recursive: true });

  // 一个被 resources 表引用的文件（素材库）
  const keptRel = 'migrated/keep.png';
  const keptAbs = path.join(uploadDir, keptRel);
  fs.writeFileSync(keptAbs, RED_PNG_BUFFER);
  const keptUrl = `http://127.0.0.1:18080/files/${keptRel}`;
  await insertResourceRow('migrated/keep.png');

  // 一个磁盘有、但全库无引用的孤儿（如 AI 资产落盘后未入库且画布删除）
  const orphanRel = 'migrated/orphan.png';
  const orphanAbs = path.join(uploadDir, orphanRel);
  fs.writeFileSync(orphanAbs, RED_PNG_BUFFER);

  // 删除被引用的 resource → 不删盘
  await resourcesMod.handleResourcesDelete(
    makeJsonReq(),
    makeRes(),
    new URL('http://x/api/resources/delete?id=local-migrated-keep.png'),
  );
  // 删除后尾部 GC：keep.png 已无 resources/tasks/KV 引用 → 成为孤儿被回收
  assert.ok(!fs.existsSync(keptAbs), '删除 resource 后该文件成为孤儿，GC 应回收');
  // orphan.png 本无引用 → 也被回收
  assert.ok(!fs.existsSync(orphanAbs), '无引用孤儿文件应被 GC 回收');
});

test('docs13·resources clear 只删记录不 rmSync 整目录', async () => {
  const uploadDir = path.join(TEST_DIR, 'uploads');
  const migratedDir = path.join(uploadDir, 'migrated');
  fs.mkdirSync(migratedDir, { recursive: true });

  // 造一个被 resources 引用 + 画布 KV 也引用的文件
  const fileRel = 'migrated/shared.png';
  const absPath = path.join(uploadDir, fileRel);
  fs.writeFileSync(absPath, RED_PNG_BUFFER);
  const url = `http://127.0.0.1:18080/files/${fileRel}`;
  await insertResourceRow('migrated/shared.png');
  await kvMod.handleKvSet(
    makeJsonReq({
      key: 'canvas-state-v1-p',
      value: JSON.stringify({ nodes: [{ id: 'n1', data: { assetUrl: url } }] }),
    }),
    makeRes(),
  );

  // clear（deleteFiles=true 旧行为会 rmSync 整目录，画布引用的文件会被连带删除）
  await resourcesMod.handleResourcesClear(makeJsonReq({ deleteFiles: true }), makeRes());
  // 画布 KV 仍引用 → GC 保留
  assert.ok(fs.existsSync(absPath), 'clear 后画布引用的文件应保留（不再 rmSync 一刀切）');
});

test('docs122·GC 认 contentId 反向引用（画布 asset 存 sha1:<hex>）：contentId 引用的文件不删，无引用的孤儿删', async () => {
  const uploadDir = path.join(TEST_DIR, 'uploads');
  const keptDir = path.join(uploadDir, 'web');
  fs.mkdirSync(keptDir, { recursive: true });

  // kept：磁盘 + resource 行（带 sha1=contentId）+ 画布 KV 只存 contentId（不存 url）
  const keptAbs = path.join(keptDir, 'kept.png');
  fs.writeFileSync(keptAbs, Buffer.from('KEPT'));
  const keptUrl = `http://127.0.0.1:18080/files/web/kept.png`;
  const keptCid = 'sha1:' + 'a'.repeat(40); // 固定 contentId（须被 regex sha1:[0-9a-f]{40} 命中且与行内 sha1 一致）
  await insertResourceRow({
    id: 'local-web-kept.png',
    url: keptUrl,
    folder: 'web',
    name: 'kept.png',
    sha1: keptCid,
  });
  await kvMod.handleKvSet(
    makeJsonReq({
      key: 'canvas-state-v1-p',
      value: JSON.stringify({ nodes: [{ id: 'n1', data: { contentId: keptCid } }] }),
    }),
    makeRes(),
  );
  // orphan：磁盘有文件但无任何引用（url / contentId 都无）
  const orphanAbs = path.join(keptDir, 'orphan.png');
  fs.writeFileSync(orphanAbs, Buffer.from('ORPHAN'));

  await gcMod.runReferenceGc(false);
  assert.ok(fs.existsSync(keptAbs), 'contentId 反向引用的文件 GC 不得删除');
  assert.ok(!fs.existsSync(orphanAbs), '无任何引用的孤儿文件应被 GC 回收');
});

// ══════════════════════════════════════════════════════════════
// 资源身份变更统一入口（改名 / 移动）—— 回归护栏
// 对应 spec/文件改名与移动-全量变更面-权威清单.md §8：#2 表同步 / #9 写入安全 /
// #10 落盘 / #11 输入校验。判定标准：删掉实现里对应的一步，下列断言必须变红。
// ══════════════════════════════════════════════════════════════

async function moveReq(src, dst) {
  const res = makeRes();
  await filesMod.handleMove(makeJsonReq({ src, dst }), res);
  return { status: res.status, body: parseResBody(res) };
}

async function renameReq(id, name) {
  const res = makeRes();
  await resourcesMod.handleResourcesRename(
    makeJsonReq(),
    res,
    new URL(
      `http://x/api/resources/rename?id=${encodeURIComponent(id)}&name=${encodeURIComponent(name)}`,
    ),
  );
  return { status: res.status, body: parseResBody(res) };
}

/**
 * 等 debouncedSaveDb（500ms）真正落盘：轮询 db 文件，命中 text 返回原文，超时返回 null。
 * 【为什么不用 closeDb 再重开验证】closeDb 内部会 saveDb()，会把内存态一并落盘，
 * 从而掩盖「handler 忘了调 debouncedSaveDb」的缺陷（断言假绿）。故此处绕开内存实例，
 * 直接读磁盘文件。
 */
async function waitDbFile(text, timeoutMs = 4000) {
  const dbPath = path.join(TEST_DIR, 'localtool.db');
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (fs.existsSync(dbPath)) {
      const raw = fs.readFileSync(dbPath).toString('utf8');
      if (!text || raw.includes(text)) return raw;
    }
    await new Promise((r) => setTimeout(r, 50));
  }
  return null;
}

/**
 * 让落盘状态归零：等遗留的 debouncedSaveDb 计时器（500ms）触发后删除 db 文件，
 * 使后续断言只反映「本次操作是否落盘」。**落盘类断言前必须先调它。**
 *
 * 【为什么必须】debouncedSaveDb 用的是 database.js 的模块级单例计时器，会跨测试泄漏：
 * 上一个测试留下的 pending 计时器，会在**下一个测试的 TEST_DIR** 里触发 saveDb
 * （getDataDir() 运行时读 env，而 env 已被 beforeEach 切到新目录）。于是即使被测
 * handler 完全没调落盘，db 文件也会凭空出现且内容正确 → 断言假绿。
 * 这是变异测试实测踩到的（去掉 debouncedSaveDb 后 T4/T8 仍全绿），勿删本函数。
 */
async function settleDb() {
  await new Promise((r) => setTimeout(r, 700)); // > debouncedSaveDb 的 500ms
  const dbPath = path.join(TEST_DIR, 'localtool.db');
  if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
}

/** 造一条本地文件型资源行（id 用 rescan 规则）。现为 `insertResourceRow` 的薄封装，不再经 HTTP handler。 */
async function seedResource(rel, opts = {}) {
  return insertResourceRow(rel, opts);
}

/**
 * 直接 SQL 插入资源行（**不经任何 handler**）。
 *
 * 【为什么不再走 handler】原 `seedResource` 走 `POST /api/resources/save`（TD-12-7 已退役该端点），
 * 其内部 `debouncedSaveDb` 会留下一个 500ms 计时器；该计时器在 move/rename **之后**才触发 saveDb，
 * 把「已含改写的内存态」落盘 —— 于是即使 handler 忘了调 debouncedSaveDb，断言依然通过（假绿）。
 * 这是变异测试实测出来的坑：去掉落盘调用后 T4/T8 竟然仍是绿的。
 *
 * 用法：
 *  - `insertResourceRow('migrated/a.png')` → 文件型：id/url 按 rescan 规则生成
 *  - `insertResourceRow({ id, url, folder, name, sha1 })` → 自定义行（非文件 URL / 指定 sha1 的用例）
 */
async function insertResourceRow(relOrRow, opts = {}) {
  const db = await dbMod.getDb();
  let id;
  let url;
  let folder;
  let name;
  let sha1 = null;
  let isFavorite = opts.isFavorite ?? 0;
  if (typeof relOrRow === 'string') {
    const rel = relOrRow;
    name = path.basename(rel);
    const dir = path.dirname(rel);
    folder = dir === '.' ? '' : dir;
    id = `local-${folder ? folder + '-' : ''}${name}`;
    url = `http://127.0.0.1:18080/files/${rel}`;
  } else {
    ({ id, url, folder = '', name = '', sha1 = null, isFavorite = 0 } = relOrRow);
  }
  dbMod.run(
    db,
    'INSERT INTO resources (id, url, type, source, folder, name, sha1, is_favorite, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [id, url, 'image', 'local-tool', folder, name, sha1, isFavorite, Date.now()],
  );
  return id;
}

test('docs122·context-only move 不改 url/磁盘 → 无目标冲突、folder(UI) 更新', async () => {
  const root = path.join(TEST_DIR, 'uploads', 'migrated');
  fs.mkdirSync(path.join(root, '人物'), { recursive: true });
  const srcFile = path.join(root, 'a.png');
  const dstFile = path.join(root, '人物', 'a.png');
  fs.writeFileSync(srcFile, RED_PNG_BUFFER);
  fs.writeFileSync(dstFile, Buffer.from('TARGET-ORIGINAL')); // 内容不同，可字节级区分
  await seedResource('migrated/a.png');

  const r = await moveReq('migrated/a.png', 'migrated/人物/a.png');
  assert.equal(r.status, 200, 'context-only 归类成功（不动物理文件，故无目标文件冲突）');
  assert.equal(r.body.data.url, 'http://127.0.0.1:18080/files/migrated/a.png', 'url 不变');
  assert.ok(fs.existsSync(srcFile), '源物理文件仍在原地（不移动）');
  assert.equal(fs.readFileSync(dstFile).toString(), 'TARGET-ORIGINAL', '目标目录既有文件不被改动');
});

test('docs122·context-only move 只改 folder(UI)，id/url/contentId/收藏不变', async () => {
  fs.mkdirSync(path.join(TEST_DIR, 'uploads', 'migrated', '人物'), { recursive: true });
  fs.writeFileSync(path.join(TEST_DIR, 'uploads', 'migrated', 'a.png'), RED_PNG_BUFFER);
  await seedResource('migrated/a.png', { isFavorite: 1 });

  const r = await moveReq('migrated/a.png', 'migrated/人物/a.png');
  assert.equal(r.status, 200, '移动应成功');

  const db = await dbMod.getDb();
  const row = dbMod.queryOne(db, 'SELECT * FROM resources WHERE id = ?', ['local-migrated-a.png']);
  assert.ok(row, '行 id 不变（归类不改变身份）');
  assert.equal(row.folder, 'migrated/人物', 'folder(UI 分类) 更新');
  assert.equal(row.url, 'http://127.0.0.1:18080/files/migrated/a.png', 'url 不变（物理路径不动）');
  assert.equal(Number(row.is_favorite), 1, '收藏不得因移动丢失');
});

test('docs122·context-only move 不改 url → 画布 KV / 任务引用保持不变', async () => {
  fs.mkdirSync(path.join(TEST_DIR, 'uploads', 'migrated', '人物'), { recursive: true });
  fs.writeFileSync(path.join(TEST_DIR, 'uploads', 'migrated', '角色.png'), RED_PNG_BUFFER);
  await seedResource('migrated/角色.png');

  const db = await dbMod.getDb();
  const oldRel = 'migrated/角色.png';
  const oldAbsRaw = `http://127.0.0.1:18080/files/${oldRel}`;
  const oldAbsEnc = `http://127.0.0.1:18080/files/${encodeURI(oldRel)}`;
  dbMod.run(db, `INSERT INTO kv (key, value) VALUES (?, ?)`, [
    'canvas-state-v1-p1',
    JSON.stringify({ nodes: [{ data: { url: oldAbsRaw } }, { data: { assetUrl: oldAbsEnc } }] }),
  ]);

  const r = await moveReq(oldRel, 'migrated/人物/角色.png');
  assert.equal(r.status, 200);
  // url 不变 → 无需改写 KV/tasks 引用（asset 永不破图）
  const kvt = dbMod.queryOne(db, `SELECT value FROM kv WHERE key='canvas-state-v1-p1'`).value;
  assert.ok(kvt.includes(oldAbsRaw) && kvt.includes(oldAbsEnc), 'KV 引用不变（url 未变）');
});

test('docs122·context-only move 后 url 保持原值（db 不含新物理 url）', async () => {
  fs.mkdirSync(path.join(TEST_DIR, 'uploads', 'migrated', '人物'), { recursive: true });
  fs.writeFileSync(path.join(TEST_DIR, 'uploads', 'migrated', 'a.png'), RED_PNG_BUFFER);
  await settleDb();
  const db = await dbMod.getDb();
  await insertResourceRow('migrated/a.png');
  await moveReq('migrated/a.png', 'migrated/人物/a.png');
  const row = dbMod.queryOne(
    db,
    `SELECT url, folder FROM resources WHERE id='local-migrated-a.png'`,
  );
  assert.equal(row.url, 'http://127.0.0.1:18080/files/migrated/a.png', 'url 不变');
  assert.equal(row.folder, 'migrated/人物', 'folder(UI) 更新');
});

test('docs122·context-only move 拒绝越出 uploads 的路径（../ 逃逸）', async () => {
  fs.mkdirSync(path.join(TEST_DIR, 'uploads', 'migrated'), { recursive: true });
  const srcFile = path.join(TEST_DIR, 'uploads', 'migrated', 'a.png');
  fs.writeFileSync(srcFile, RED_PNG_BUFFER);

  const r = await moveReq('migrated/a.png', '../escaped.png');
  assert.equal(r.status, 400, '越出 uploads 的目标必须被拒');
  assert.ok(!fs.existsSync(path.join(TEST_DIR, 'escaped.png')), 'uploads 外不得被写入');
  assert.ok(fs.existsSync(srcFile), '源文件保持原样');
});

test('docs122·context-only move 支持文件名含空格（不改 basename、不移动磁盘）', async () => {
  fs.mkdirSync(path.join(TEST_DIR, 'uploads', 'migrated', '人物'), { recursive: true });
  fs.writeFileSync(path.join(TEST_DIR, 'uploads', 'migrated', 'my pic.png'), RED_PNG_BUFFER);
  await seedResource('migrated/my pic.png');

  const r = await moveReq('migrated/my pic.png', 'migrated/人物/my pic.png');
  assert.equal(r.status, 200, '含空格的既有文件必须能正常归类');
  // 磁盘不移动：源仍在 migrated/
  assert.ok(fs.existsSync(path.join(TEST_DIR, 'uploads', 'migrated', 'my pic.png')));
  const row = await (async () => {
    const db = await dbMod.getDb();
    return dbMod.queryOne(db, `SELECT folder FROM resources WHERE id='local-migrated-my pic.png'`);
  })();
  assert.equal(row.folder, 'migrated/人物', 'folder(UI) 更新');
});

test('TD-12-8·context-only move 表内无行时**明确失败**（不再假成功「已移动」），物理文件仍在', async () => {
  fs.mkdirSync(path.join(TEST_DIR, 'uploads', 'migrated', '人物'), { recursive: true });
  fs.writeFileSync(path.join(TEST_DIR, 'uploads', 'migrated', 'a.png'), RED_PNG_BUFFER);
  // 刻意不 seedResource：模拟「磁盘有文件、表内无行」

  const r = await moveReq('migrated/a.png', 'migrated/人物/a.png');
  // 旧行为回 200 → 前端提示「已移动」= 假成功；TD-12-8 修正为明确失败（用户裁定）
  assert.equal(r.status, 404, '行不存在必须返回失败（不得假成功）');
  assert.ok(
    String(r.body?.error?.message || r.body?.error || '').includes('资源未同步'),
    '失败文案应提示资源未同步',
  );
  // context-only 不补建行、不动物理，磁盘仍在原处（失败不改盘）
  assert.ok(fs.existsSync(path.join(TEST_DIR, 'uploads', 'migrated', 'a.png')), '物理文件仍在原处');
  // rescan 应把该磁盘文件录入为一条（不因 move 已「移动」过而重复）：守「同文件不重复录入」
  const db = await dbMod.getDb();
  const count = () =>
    dbMod.queryOne(db, `SELECT COUNT(*) AS c FROM resources WHERE type != 'folder'`).c;
  const before = count();
  await resourcesMod.handleResourcesRescan(makeJsonReq(), makeRes());
  const after = count();
  assert.ok(after >= before, 'rescan 至少录入物理文件（不重复）');
});

test('TD-12-8·move 后 rescan：行仍在且 folder/name/收藏保留（归类不回弹）', async () => {
  fs.mkdirSync(path.join(TEST_DIR, 'uploads', 'migrated', '人物'), { recursive: true });
  const srcFile = path.join(TEST_DIR, 'uploads', 'migrated', 'keep.png');
  fs.writeFileSync(srcFile, RED_PNG_BUFFER);
  await seedResource('migrated/keep.png', { isFavorite: 1 });

  // 归类到 migrated/人物（context-only：磁盘仍在 migrated/keep.png）
  const r = await moveReq('migrated/keep.png', 'migrated/人物/keep.png');
  assert.equal(r.status, 200, '有位应归类成功');

  // 触发 rescan（ResourceLibrary.reset(true) 每次都 rescan）→ 旧实现在此按 folder 拼路径删行 → 回弹
  await resourcesMod.handleResourcesRescan(makeJsonReq(), makeRes());

  const db = await dbMod.getDb();
  const row = dbMod.queryOne(db, 'SELECT * FROM resources WHERE id = ?', [
    'local-migrated-keep.png',
  ]);
  assert.ok(row, 'rescan 后行必须仍在（不得因 folder 与磁盘脱钩被误删）');
  assert.equal(row.folder, 'migrated/人物', '归类的 folder(UI) 保留，不回弹');
  assert.equal(Number(row.is_favorite), 1, '收藏不得归零');
  assert.ok(fs.existsSync(srcFile), '磁盘文件未被移动/删除');
});

test('TD-12-8·二次 move 仍生效（用磁盘真源定位行，不受上一次归类影响）', async () => {
  fs.mkdirSync(path.join(TEST_DIR, 'uploads', 'migrated', 'B'), { recursive: true });
  fs.mkdirSync(path.join(TEST_DIR, 'uploads', 'migrated', 'C'), { recursive: true });
  fs.writeFileSync(path.join(TEST_DIR, 'uploads', 'migrated', 'twice.png'), RED_PNG_BUFFER);
  await seedResource('migrated/twice.png');

  // 第一次 → 归到 A（磁盘仍在 migrated/twice.png）
  const r1 = await moveReq('migrated/twice.png', 'migrated/B/twice.png');
  assert.equal(r1.status, 200, '第一次移动成功');

  // 第二次：src 仍必须是**磁盘真源** migrated/twice.png（旧实现用 UI folder 拼成 migrated/B/twice.png → 定位不到行 → 假成功）
  const r2 = await moveReq('migrated/twice.png', 'migrated/C/twice.png');
  assert.equal(r2.status, 200, '第二次移动必须生效（定位到同一行）');

  const db = await dbMod.getDb();
  const row = dbMod.queryOne(db, 'SELECT folder FROM resources WHERE id = ?', [
    'local-migrated-twice.png',
  ]);
  assert.equal(row.folder, 'migrated/C', 'folder 更新为第二次的目标（未假成功）');
});

test('TD-12-8·rename 后 rescan：显示名与收藏保留（不回弹）', async () => {
  fs.mkdirSync(path.join(TEST_DIR, 'uploads', 'migrated'), { recursive: true });
  fs.writeFileSync(path.join(TEST_DIR, 'uploads', 'migrated', 'rn.png'), RED_PNG_BUFFER);
  await seedResource('migrated/rn.png', { isFavorite: 1 });

  const rr = await renameReq('local-migrated-rn.png', '改后名');
  assert.equal(rr.status, 200, '改名成功');

  await resourcesMod.handleResourcesRescan(makeJsonReq(), makeRes());

  const db = await dbMod.getDb();
  const row = dbMod.queryOne(db, 'SELECT * FROM resources WHERE id = ?', ['local-migrated-rn.png']);
  assert.ok(row, 'rescan 后行必须仍在');
  assert.equal(row.name, '改后名.png', '显示名保留，不回弹为磁盘名');
  assert.equal(Number(row.is_favorite), 1, '收藏不得归零');
});

test('TD-12-8·orphan 判定用 url 真源：磁盘文件真被删时行仍应被清理', async () => {
  fs.mkdirSync(path.join(TEST_DIR, 'uploads', 'migrated'), { recursive: true });
  const goneFile = path.join(TEST_DIR, 'uploads', 'migrated', 'gone.png');
  fs.writeFileSync(goneFile, RED_PNG_BUFFER);
  await seedResource('migrated/gone.png');

  // 真删磁盘文件 → 下一次 rescan 应把该行判为孤儿删除（url 派生的磁盘路径确实不存在）
  fs.unlinkSync(goneFile);
  await resourcesMod.handleResourcesRescan(makeJsonReq(), makeRes());

  const db = await dbMod.getDb();
  const row = dbMod.queryOne(db, 'SELECT id FROM resources WHERE id = ?', [
    'local-migrated-gone.png',
  ]);
  assert.ok(!row, '磁盘文件真被删 → 行应被孤儿清理');
});

test('docs122·context-only rename 不改 url / 磁盘 → 无目标冲突、显示名更新（不再真的写新物理文件）', async () => {
  const dir = path.join(TEST_DIR, 'uploads', 'migrated');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'a.png'), RED_PNG_BUFFER);
  fs.writeFileSync(path.join(dir, 'b.png'), Buffer.from('B-ORIGINAL'));
  await seedResource('migrated/a.png');

  // 目标「b」已存在也无妨：context-only 不写物理文件，只改显示名 b.png（不再有 409 文件冲突）
  const r = await renameReq('local-migrated-a.png', 'b');
  assert.equal(r.status, 200, 'context-only 改名成功（不动物理文件，故无目标冲突）');
  assert.equal(r.body.data.name, 'b.png', '显示名更新为 b.png');
  assert.equal(
    r.body.data.url,
    `http://127.0.0.1:18080/files/migrated/a.png`,
    'url 不变（物理路径不变）',
  );
  assert.equal(
    fs.readFileSync(path.join(dir, 'b.png')).toString(),
    'B-ORIGINAL',
    '既有 b.png 内容不被改动',
  );
  assert.ok(fs.existsSync(path.join(dir, 'a.png')), '源物理文件仍为 a.png（不移动）');
});

test('docs122·context-only rename 后 url 保持原值（db 不再含新物理 url；显示名已更新）', async () => {
  fs.mkdirSync(path.join(TEST_DIR, 'uploads', 'web'), { recursive: true });
  fs.writeFileSync(path.join(TEST_DIR, 'uploads', 'web', 'a.png'), RED_PNG_BUFFER);
  await settleDb(); // 归零落盘状态，用 kv 承载验证字符串
  const db = await dbMod.getDb();
  await insertResourceRow('web/a.png');

  await renameReq('local-web-a.png', '新名');
  const row = dbMod.queryOne(db, `SELECT url, name FROM resources WHERE id='local-web-a.png'`);
  assert.equal(row.url, 'http://127.0.0.1:18080/files/web/a.png', 'url 不变（未被改写）');
  assert.equal(row.name, '新名.png', '显示名已更新');
});

test('docs122·context-only rename 不误吃文件名里的点（「图1.2」完整保留；磁盘不改名）', async () => {
  fs.mkdirSync(path.join(TEST_DIR, 'uploads', 'migrated'), { recursive: true });
  fs.writeFileSync(path.join(TEST_DIR, 'uploads', 'migrated', 'a.png'), RED_PNG_BUFFER);
  await seedResource('migrated/a.png');

  const r = await renameReq('local-migrated-a.png', '图1.2');
  assert.equal(r.status, 200);
  assert.equal(r.body.data.name, '图1.2.png', '含点的名字应完整保留，只补原扩展名');
  // 磁盘不改名（context-only）：物理文件仍是 a.png
  assert.ok(fs.existsSync(path.join(TEST_DIR, 'uploads', 'migrated', 'a.png')));
  assert.ok(!fs.existsSync(path.join(TEST_DIR, 'uploads', 'migrated', '图1.2.png')));
});

test('身份变更·rename 用户带后缀输入时仍剥离（统一保留原扩展名）', async () => {
  fs.mkdirSync(path.join(TEST_DIR, 'uploads', 'migrated'), { recursive: true });
  fs.writeFileSync(path.join(TEST_DIR, 'uploads', 'migrated', 'a.png'), RED_PNG_BUFFER);
  await seedResource('migrated/a.png');

  const r = await renameReq('local-migrated-a.png', 'b.jpg');
  assert.equal(r.status, 200);
  assert.equal(r.body.data.name, 'b.png', '用户输入 .jpg 也应剥离，统一用原扩展名 .png');
});
