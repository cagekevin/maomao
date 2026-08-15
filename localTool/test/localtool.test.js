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
    writeHead(code, h) { r.status = code; if (h) r.headers = { ...r.headers, ...h }; return r; },
    end(data) {
      r.writableEnded = true;
      if (data !== undefined) { const s = Buffer.isBuffer(data) ? data.toString('utf-8') : String(data); r.body = (r.body || '') + s; }
      return r;
    },
  };
  return r;
}

function makeJsonReq(body, contentType = 'application/json') {
  const data = body === undefined ? Buffer.alloc(0) : Buffer.from(JSON.stringify(body));
  const req = { headers: { 'content-type': contentType }, body: data };
  req.on = (ev, cb) => {
    if (ev === 'data' && data.length) { cb(data); }
    if (ev === 'end') { cb(); }
    return req;
  };
  return req;
}

function makeGetReq(query = '') {
  return makeJsonReq(undefined);
}

function parseResBody(res) {
  return res.body ? JSON.parse(res.body) : null;
}

function fileUrl(url) {
  // 转成 127.0.0.1:18080 形式（内部一致）
  return url;
}

// 构造一个小 PNG（1x1 红点）base64
const RED_PNG_B64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const RED_PNG_DATA_URI = `data:image/png;base64,${RED_PNG_B64}`;
const RED_PNG_BUFFER = Buffer.from(RED_PNG_B64, 'base64');

// 构造画布 JSON（含内嵌 base64 原图 + 无 base64 字段）
function makeCanvasState(projectId, extraNodes = []) {
  return {
    nodes: [
      { id: 'node-1', type: 'image', data: { imageUrl: RED_PNG_DATA_URI, name: '原图' } },
      { id: 'node-2', type: 'text', data: { text: 'hello', imageUrl: 'http://example.com/normal.png' } },
      ...extraNodes,
    ],
    edges: [],
    version: '1.0',
  };
}

// 动态 import dist 模块（用最新构建产物）
const dist = path.join(__dirname, '..', 'dist');
function toFileUrl(p) {
  return 'file:///' + p.split(path.sep).join('/');
}
const kvMod = await import(toFileUrl(path.join(dist, 'routes', 'kv.js')));
const tasksMod = await import(toFileUrl(path.join(dist, 'routes', 'tasks.js')));
const resourcesMod = await import(toFileUrl(path.join(dist, 'routes', 'resources.js')));
const adminMod = await import(toFileUrl(path.join(dist, 'routes', 'admin.js')));
const filesMod = await import(toFileUrl(path.join(dist, 'routes', 'files.js')));
const dbMod = await import(toFileUrl(path.join(dist, 'db', 'database.js')));
const helpersMod = await import(toFileUrl(path.join(dist, 'utils', 'helpers.js')));
const b64Mod = await import(toFileUrl(path.join(dist, 'utils', 'base64Externalize.js')));
const gcMod = await import(toFileUrl(path.join(dist, 'utils', 'orphanGc.js')));
const platformMod = await import(toFileUrl(path.join(dist, 'routes', 'platform.js')));
const systemMod = await import(toFileUrl(path.join(dist, 'routes', 'system.js')));

// ── 每个测试独立数据目录 ──
beforeEach(() => {
  makeDataDir();
  if (dbMod.closeDb) dbMod.closeDb();
});

afterEach(() => {
  try { dbMod.closeDb(); } catch {}
  try { fs.rmSync(TEST_DIR, { recursive: true, force: true }); } catch {}
});

// ══════════════════════════════════════════════════════════════
// 方案②：base64 外置核心
// ══════════════════════════════════════════════════════════════

test('方案②·KV set 含 base64 的 JSON 画布对象 → value 变为 /files/ URL，原图落盘', async () => {
  const res = makeRes();
  const state = makeCanvasState('proj-test');
  await kvMod.handleKvSet(makeJsonReq({ key: 'canvas-state-v1-proj-test', value: JSON.stringify(state) }), res);
  assert.equal(res.status, 200, 'set 应 200');
  assert.deepEqual(parseResBody(res), { ok: true });

  // 读回：value 里的 base64 应被替换为 /files/ URL
  const getRes = makeRes();
  await kvMod.handleKvGet(makeGetReq(), getRes, new URL('http://x/api/kv/get?key=canvas-state-v1-proj-test'));
  const saved = parseResBody(getRes);
  assert.ok(saved.nodes[0].data.imageUrl.startsWith('/files/canvas/'), `imageUrl 应外置为 /files 路径, got=${saved.nodes[0].data.imageUrl}`);
  // 无 base64 的字段保持原样
  assert.equal(saved.nodes[1].data.imageUrl, 'http://example.com/normal.png');
  // 文本节点不受影响
  assert.equal(saved.nodes[1].data.text, 'hello');

  // 磁盘应存在该文件，且内容与原图一致
  const diskPath = path.join(TEST_DIR, 'uploads', saved.nodes[0].data.imageUrl.replace('/files/', ''));
  assert.ok(fs.existsSync(diskPath), '磁盘应存在外置文件');
  assert.ok(RED_PNG_BUFFER.equals(fs.readFileSync(diskPath)), '落盘内容应与原图一致');
});

test('方案②·外置幂等：相同 base64 写两次 → 磁盘只一个文件', async () => {
  // 第一次
  let res = makeRes();
  await kvMod.handleKvSet(makeJsonReq({ key: 'canvas-state-v1-a', value: JSON.stringify(makeCanvasState('a')) }), res);
  const getRes1 = makeRes();
  await kvMod.handleKvGet(makeGetReq(), getRes1, new URL('http://x/api/kv/get?key=canvas-state-v1-a'));
  const url1 = parseResBody(getRes1).nodes[0].data.imageUrl;

  // 第二次（相同 base64 不同项目）
  res = makeRes();
  await kvMod.handleKvSet(makeJsonReq({ key: 'canvas-state-v1-b', value: JSON.stringify(makeCanvasState('b')) }), res);
  const getRes2 = makeRes();
  await kvMod.handleKvGet(makeGetReq(), getRes2, new URL('http://x/api/kv/get?key=canvas-state-v1-b'));
  const url2 = parseResBody(getRes2).nodes[0].data.imageUrl;

  assert.equal(url1, url2, '相同 base64 应映射同一 URL');
  const diskPath = path.join(TEST_DIR, 'uploads', url1.replace('/files/', ''));
  assert.ok(fs.existsSync(diskPath));
  // 目录下只有 1 个 canvas 文件（幂等不重复落盘）
  const canvasDir = path.join(TEST_DIR, 'uploads', 'canvas');
  const files = fs.readdirSync(canvasDir).filter((f) => !f.startsWith('.'));
  assert.equal(files.length, 1, '相同 base64 只落一个文件');
});

test('方案②·裸 base64 形态（img_orig_*）：整串外置为 URL', async () => {
  const res = makeRes();
  await kvMod.handleKvSet(makeJsonReq({ key: 'img_orig_node1_1', value: RED_PNG_DATA_URI }), res);
  assert.deepEqual(parseResBody(res), { ok: true });

  const getRes = makeRes();
  await kvMod.handleKvGet(makeGetReq(), getRes, new URL('http://x/api/kv/get?key=img_orig_node1_1'));
  // 裸 base64 读回的是 URL 字符串
  const saved = parseResBody(getRes);
  assert.ok(typeof saved === 'string' && saved.startsWith('/files/canvas/'), `img_orig_* 应外置为 URL, got=${saved}`);
  const diskPath = path.join(TEST_DIR, 'uploads', saved.replace('/files/', ''));
  assert.ok(fs.existsSync(diskPath));
  assert.ok(RED_PNG_BUFFER.equals(fs.readFileSync(diskPath)));
});

test('方案②·失败回退：非法 data URI 保留原值，不破坏 {ok:true}', async () => {
  const res = makeRes();
  const badObj = { nodes: [{ data: { imageUrl: 'data:image/png;base64,@@@invalid@@@' } }] };
  await kvMod.handleKvSet(makeJsonReq({ key: 'k1', value: JSON.stringify(badObj) }), res);
  assert.deepEqual(parseResBody(res), { ok: true }, 'set 仍应 {ok:true}');

  const getRes = makeRes();
  await kvMod.handleKvGet(makeGetReq(), getRes, new URL('http://x/api/kv/get?key=k1'));
  const saved = parseResBody(getRes);
  assert.equal(saved.nodes[0].data.imageUrl, 'data:image/png;base64,@@@invalid@@@', '非法 base64 应保留原值');
});

test('方案②·孤儿 GC：cleanup 删除未被引用文件，保留被 KV 引用文件', async () => {
  // 先写入一个含 base64 的 KV → 外置出一个磁盘文件
  const res = makeRes();
  await kvMod.handleKvSet(makeJsonReq({ key: 'canvas-state-v1-gc', value: JSON.stringify(makeCanvasState('gc')) }), res);

  // 制造一个孤儿文件（磁盘有、无任何 KV/tasks/resources 引用）
  const orphanDir = path.join(TEST_DIR, 'uploads', 'canvas');
  fs.writeFileSync(path.join(orphanDir, 'orphan.png'), RED_PNG_BUFFER);
  // 再放一个被 resources 引用的文件（应保留）
  const keptDir = path.join(TEST_DIR, 'uploads', 'tasks');
  fs.mkdirSync(keptDir, { recursive: true });
  const keptPath = path.join(keptDir, 'kept.png');
  fs.writeFileSync(keptPath, RED_PNG_BUFFER);
  const keptUrl = `http://127.0.0.1:18080/files/tasks/kept.png`;
  await resourcesMod.handleResourcesSave(makeJsonReq({ id: 'res-kept', url: keptUrl, type: 'image', name: 'kept' }), makeRes());

  // 执行 cleanup
  const cleanRes = makeRes();
  await adminMod.handleAdminCleanup(makeJsonReq(), cleanRes);
  const result = parseResBody(cleanRes);
  assert.ok(result.deleted >= 1, `应删除至少 1 个孤儿文件, deleted=${result.deleted}`);

  // 孤儿被删
  assert.ok(!fs.existsSync(path.join(orphanDir, 'orphan.png')), '孤儿文件应被删除');
  // 被 KV 引用的 canvas 文件保留
  const canvasFiles = fs.readdirSync(orphanDir).filter((f) => !f.startsWith('.') && f !== 'orphan.png');
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
  await kvMod.handleKvSet(makeJsonReq({ key: 'obj', value: JSON.stringify({ a: 1, b: [2, 3] }) }), res);
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

test('KV·delete 删除后 get 为 null', async () => {
  await kvMod.handleKvSet(makeJsonReq({ key: 'd1', value: 'v' }), makeRes());
  const delRes = makeRes();
  await kvMod.handleKvDelete(makeJsonReq(), delRes, new URL('http://x/api/kv/delete?key=d1'));
  assert.deepEqual(parseResBody(delRes), { ok: true });
  const getRes = makeRes();
  await kvMod.handleKvGet(makeGetReq(), getRes, new URL('http://x/api/kv/get?key=d1'));
  assert.equal(parseResBody(getRes), null);
});

// ══════════════════════════════════════════════════════════════
// Tasks 路由
// ══════════════════════════════════════════════════════════════

test('Tasks·save + get（camel/snake 映射、id 回填、JSON 字段）', async () => {
  // save 用 camelCase（前端形态），含 JSON 字段和 UI 字段（应被过滤）
  const res = makeRes();
  await tasksMod.handleTasksSave(makeJsonReq({
    taskId: 't1', nodeId: 'n1', prompt: '测试', progress: 50,
    channelName: 'default', modelName: 'gpt',
    requestData: { url: 'http://x', headers: {} },
    mediaMeta: { w: 100 },
    loading: true, // UI 字段应被过滤
  }), res);
  assert.deepEqual(parseResBody(res), { ok: true });

  const getRes = makeRes();
  await tasksMod.handleTasksGet(makeGetReq(), getRes, new URL('http://x/api/tasks'));
  const page = parseResBody(getRes);
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
  await tasksMod.handleTasksSave(makeJsonReq({ task_id: 't2', node_id: 'n2', prompt: 'snake', created_at: 123 }), res);
  assert.equal(res.status, 400, '缺少 taskId/id 应 400');
  // 确认没写入
  const getRes = makeRes();
  await tasksMod.handleTasksGet(makeGetReq(), getRes, new URL('http://x/api/tasks'));
  assert.equal(parseResBody(getRes).total, 0);
});

test('Tasks·save 缺少 id → 400', async () => {
  const res = makeRes();
  await tasksMod.handleTasksSave(makeJsonReq({ prompt: 'x' }), res);
  assert.equal(res.status, 400);
});

test('Tasks·搜索过滤', async () => {
  await tasksMod.handleTasksSave(makeJsonReq({ taskId: 'a', prompt: '苹果', channelName: 'ch1' }), makeRes());
  await tasksMod.handleTasksSave(makeJsonReq({ taskId: 'b', prompt: '香蕉', channelName: 'ch2' }), makeRes());

  const getRes = makeRes();
  await tasksMod.handleTasksGet(makeGetReq(), getRes, new URL('http://x/api/tasks?search=苹果'));
  const page = parseResBody(getRes);
  assert.equal(page.total, 1);
  assert.equal(page.items[0].taskId, 'a');
});

test('Tasks·数组过滤 (channelName IN)', async () => {
  await tasksMod.handleTasksSave(makeJsonReq({ taskId: 'a', channelName: 'ch1' }), makeRes());
  await tasksMod.handleTasksSave(makeJsonReq({ taskId: 'b', channelName: 'ch2' }), makeRes());
  await tasksMod.handleTasksSave(makeJsonReq({ taskId: 'c', channelName: 'ch3' }), makeRes());

  const getRes = makeRes();
  await tasksMod.handleTasksGet(makeGetReq(), getRes, new URL('http://x/api/tasks?filters=' + encodeURIComponent(JSON.stringify({ channelName: ['ch1', 'ch3'] }))));
  const page = parseResBody(getRes);
  assert.equal(page.total, 2);
});

test('Tasks·batch-save 多任务 + 删除 + 批量删除 + clear', async () => {
  await tasksMod.handleTasksBatchSave(makeJsonReq([
    { taskId: 't1', prompt: 'p1' },
    { taskId: 't2', prompt: 'p2' },
  ]), makeRes());

  let getRes = makeRes();
  await tasksMod.handleTasksGet(makeGetReq(), getRes, new URL('http://x/api/tasks'));
  assert.equal(parseResBody(getRes).total, 2);

  // 删除单条
  const delRes = makeRes();
  await tasksMod.handleTasksDelete(makeJsonReq(), delRes, new URL('http://x/api/tasks/delete?id=t1'));
  assert.deepEqual(parseResBody(delRes), { ok: true });
  getRes = makeRes();
  await tasksMod.handleTasksGet(makeGetReq(), getRes, new URL('http://x/api/tasks'));
  assert.equal(parseResBody(getRes).total, 1);

  // 批量删除
  const del2Res = makeRes();
  await tasksMod.handleTasksBatchDelete(makeJsonReq({ ids: ['t2'] }), del2Res);
  assert.equal(parseResBody(del2Res).deleted, 1);
  getRes = makeRes();
  await tasksMod.handleTasksGet(makeGetReq(), getRes, new URL('http://x/api/tasks'));
  assert.equal(parseResBody(getRes).total, 0);

  // clear
  await tasksMod.handleTasksSave(makeJsonReq({ taskId: 'x', prompt: 'x' }), makeRes());
  const clearRes = makeRes();
  await tasksMod.handleTasksClear(makeJsonReq(), clearRes);
  assert.equal(parseResBody(clearRes).deleted, 1);
  getRes = makeRes();
  await tasksMod.handleTasksGet(makeGetReq(), getRes, new URL('http://x/api/tasks'));
  assert.equal(parseResBody(getRes).total, 0);
});

test('Tasks·batch-save 非数组 → 400', async () => {
  const res = makeRes();
  await tasksMod.handleTasksBatchSave(makeJsonReq({ taskId: 'x' }), res);
  assert.equal(res.status, 400);
});

// ══════════════════════════════════════════════════════════════
// Resources 路由
// ══════════════════════════════════════════════════════════════

test('Resources·save + get + 分页', async () => {
  for (let i = 1; i <= 25; i++) {
    await resourcesMod.handleResourcesSave(makeJsonReq({ id: `r${i}`, url: `http://example.com/${i}.png`, type: 'image', name: `img${i}` }), makeRes());
  }
  const getRes = makeRes();
  await resourcesMod.handleResourcesGet(makeGetReq(), getRes, new URL('http://x/api/resources?page=1&pageSize=20'));
  const page = parseResBody(getRes);
  assert.equal(page.total, 25);
  assert.equal(page.items.length, 20);
  assert.equal(page.page, 1);
  assert.equal(page.pageSize, 20);
  assert.equal(page.totalPages, 2);
});

test('Resources·save 缺少 id → 400', async () => {
  const res = makeRes();
  await resourcesMod.handleResourcesSave(makeJsonReq({ url: 'x' }), res);
  assert.equal(res.status, 400);
});

test('Resources·save dataURL → 自动落盘为文件', async () => {
  const res = makeRes();
  await resourcesMod.handleResourcesSave(makeJsonReq({ id: 'clip-1', url: RED_PNG_DATA_URI, type: 'image' }), res);
  assert.deepEqual(parseResBody(res), { ok: true });

  const getRes = makeRes();
  await resourcesMod.handleResourcesGet(makeGetReq(), getRes, new URL('http://x/api/resources'));
  const item = parseResBody(getRes).items[0];
  assert.ok(item.url.startsWith('http://127.0.0.1:18080/files/'), `dataURL 落盘后应转绝对文件 URL, got=${item.url}`);
  assert.match(item.id, /^local-/, 'id 应对齐 rescan 命名');
});

test('Resources·delete 删除记录', async () => {
  await resourcesMod.handleResourcesSave(makeJsonReq({ id: 'r1', url: 'http://example.com/1.png', type: 'image' }), makeRes());
  const delRes = makeRes();
  await resourcesMod.handleResourcesDelete(makeJsonReq(), delRes, new URL('http://x/api/resources/delete?id=r1'));
  assert.deepEqual(parseResBody(delRes), { ok: true });
  const getRes = makeRes();
  await resourcesMod.handleResourcesGet(makeGetReq(), getRes, new URL('http://x/api/resources'));
  assert.equal(parseResBody(getRes).total, 0);
});

test('Resources·clear 全部 + 按 folder 清', async () => {
  await resourcesMod.handleResourcesSave(makeJsonReq({ id: 'a', url: 'u1', type: 'image', folder: 'f1' }), makeRes());
  await resourcesMod.handleResourcesSave(makeJsonReq({ id: 'b', url: 'u2', type: 'image', folder: 'f2' }), makeRes());

  // 按 folder 清
  let clearRes = makeRes();
  await resourcesMod.handleResourcesClear(makeJsonReq({ folder: 'f1' }), clearRes);
  assert.equal(parseResBody(clearRes).deleted, 1);
  let getRes = makeRes();
  await resourcesMod.handleResourcesGet(makeGetReq(), getRes, new URL('http://x/api/resources'));
  assert.equal(parseResBody(getRes).total, 1);

  // 清空全部
  clearRes = makeRes();
  await resourcesMod.handleResourcesClear(makeJsonReq(), clearRes);
  assert.equal(parseResBody(clearRes).deleted, 1);
  getRes = makeRes();
  await resourcesMod.handleResourcesGet(makeGetReq(), getRes, new URL('http://x/api/resources'));
  assert.equal(parseResBody(getRes).total, 0);
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
  const result = parseResBody(res);
  assert.equal(result.added, 2, '应录入 pic.png 与 vid.mp4');
  assert.equal(result.count, 2);

  const getRes = makeRes();
  await resourcesMod.handleResourcesGet(makeGetReq(), getRes, new URL('http://x/api/resources?pageSize=50'));
  const page = parseResBody(getRes);
  assert.equal(page.total, 2);
  assert.ok(page.items.some((r) => r.name === 'pic.png' && r.type === 'image'));
  assert.ok(page.items.some((r) => r.name === 'vid.mp4' && r.type === 'video'));
});

// ══════════════════════════════════════════════════════════════
// Admin 路由
// ══════════════════════════════════════════════════════════════

test('Admin·stats 返回统计', async () => {
  await kvMod.handleKvSet(makeJsonReq({ key: 'k1', value: 'v' }), makeRes());
  await tasksMod.handleTasksSave(makeJsonReq({ taskId: 't1', prompt: 'p' }), makeRes());
  const res = makeRes();
  await adminMod.handleAdminStats(makeGetReq(), res);
  const stats = parseResBody(res);
  assert.ok(stats.kv.count >= 1);
  assert.ok(stats.tasks.total >= 1);
  assert.ok('disk' in stats && 'uploadDirBytes' in stats.disk);
});

test('Admin·kv-list 列出所有键', async () => {
  await kvMod.handleKvSet(makeJsonReq({ key: 'a', value: '1' }), makeRes());
  await kvMod.handleKvSet(makeJsonReq({ key: 'b', value: '2' }), makeRes());
  const res = makeRes();
  await adminMod.handleAdminKvList(makeGetReq(), res);
  const keys = parseResBody(res).keys;
  assert.ok(keys.some((k) => k.key === 'a'));
  assert.ok(keys.some((k) => k.key === 'b'));
});

test('Admin·export/import 往返', async () => {
  await kvMod.handleKvSet(makeJsonReq({ key: 'exp1', value: 'val1' }), makeRes());
  await tasksMod.handleTasksSave(makeJsonReq({ taskId: 'exp-task', prompt: 'p' }), makeRes());

  const expRes = makeRes();
  await adminMod.handleAdminExport(makeGetReq(), expRes);
  const exported = parseResBody(expRes);
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
  await adminMod.handleAdminImport(makeJsonReq({ data: { kv: [], tasks: [], resources: [] } }), res);
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
  const list = parseResBody(res);
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
    write(c, _enc, cb) { chunks.push(Buffer.from(c)); cb(); },
    writev(items, cb) { for (const i of items) chunks.push(Buffer.from(i.chunk)); cb(); },
  });
  const origWriteHead = res.writeHead;
  res.writeHead = (code, h) => { headers = h; return res; };
  const done = new Promise((resolve, reject) => {
    res.on('finish', resolve);
    res.on('error', reject);
  });
  await filesMod.handleRead(makeGetReq(), res, new URL(`http://x/api/files/read?path=${encodeURIComponent(absPath)}`));
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

  const p2 = helpersMod.parsePagination(new URL('http://x/api?page=0&pageSize=999&sortDir=ASC'), { sortBy: 'a', sortDir: 'DESC' });
  assert.equal(p2.page, 1, 'page 最小钳制为 1');
  assert.equal(p2.pageSize, 100, 'pageSize 最大钳制为 100');
  assert.equal(p2.sortDir, 'ASC');

  const p3 = helpersMod.parsePagination(new URL('http://x/api?filters=' + encodeURIComponent(JSON.stringify({ isFavorite: true }))), { sortBy: 'a', sortDir: 'DESC' });
  assert.deepEqual(p3.filters, { isFavorite: true });
});

test('helpers·buildPaginatedQuery 搜索/过滤/SQL 安全', () => {
  // 搜索
  const q = helpersMod.buildPaginatedQuery('tasks', { page: 1, pageSize: 20, sortBy: 'created_at', sortDir: 'DESC', search: 'abc' }, ['prompt', 'task_id']);
  assert.match(q.sql, /prompt LIKE \? OR task_id LIKE \?/);
  assert.match(q.sql, /LIMIT \? OFFSET \?/);
  assert.equal(q.values.length, 2 + 2, '2 search + LIMIT/OFFSET');

  // 数组过滤
  const q2 = helpersMod.buildPaginatedQuery('tasks', { page: 1, pageSize: 20, sortBy: 'created_at', sortDir: 'DESC', filters: { channelName: ['a', 'b'] } }, ['created_at']);
  assert.match(q2.sql, /channel_name IN \(\?, \?\)/);

  // eqOrPrefix
  const q3 = helpersMod.buildPaginatedQuery('resources', { page: 1, pageSize: 20, sortBy: 'timestamp', sortDir: 'DESC', filters: { folder: { eqOrPrefix: '人物' } } }, ['timestamp']);
  assert.match(q3.sql, /folder = \? OR folder LIKE \?/);

  // sortBy 不在白名单 → 回退 rowid（防注入）
  const q4 = helpersMod.buildPaginatedQuery('tasks', { page: 1, pageSize: 20, sortBy: 'prompt; DROP TABLE tasks', sortDir: 'DESC' }, ['created_at']);
  assert.match(q4.sql, /ORDER BY rowid DESC/);
});

test('helpers·paginatedResult 结构', () => {
  const r = helpersMod.paginatedResult([1, 2], 25, 1, 10);
  assert.deepEqual(r, { items: [1, 2], total: 25, page: 1, pageSize: 10, totalPages: 3 });
});

// ══════════════════════════════════════════════════════════════
// 方案②工具函数直接单测
// ══════════════════════════════════════════════════════════════

test('工具·saveBase64ToFile 返回 URL 且幂等', () => {
  const url1 = b64Mod.saveBase64ToFile(RED_PNG_DATA_URI);
  const url2 = b64Mod.saveBase64ToFile(RED_PNG_DATA_URI);
  assert.ok(url1 && url1.startsWith('/files/canvas/'));
  assert.equal(url1, url2, '相同内容幂等');
  const diskPath = path.join(TEST_DIR, 'uploads', url1.replace('/files/', ''));
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

  const res = gcMod.runOrphanGc(['/files/canvas/keep.png'], path.join(TEST_DIR, 'uploads'), new Set(), true);
  assert.equal(res.deleted, 1, 'dryRun 统计可删除 1 个');
  assert.ok(fs.existsSync(path.join(dir, 'orphan.png')), 'dryRun 不真正删除');

  // 真删
  const res2 = gcMod.runOrphanGc(['/files/canvas/keep.png'], path.join(TEST_DIR, 'uploads'), new Set(), false);
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
  assert.deepEqual(parseResBody(res), { version: '1.4.2', hasUpdate: false });
});

test('Platform·workflow-apps by-project 返回 stub null', async () => {
  const res = makeRes();
  await platformMod.handleWorkflowAppsByProject(makeGetReq(), res, new URL('http://x/api/workflow-apps/by-project/123'));
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
  assert.equal(body.version, '1.4.2');
  assert.equal(typeof body.port, 'number');
});

test('System·jianying/send 单文件形态', async () => {
  const res = makeRes();
  await systemMod.handleJianyingSend(makeJsonReq({ fileUrl: 'http://x/1.mp4', localPath: '/tmp/1.mp4', fileName: '1.mp4' }), res);
  const body = parseResBody(res);
  assert.equal(body.status, 'ok');
});

test('System·jianying/send 批量形态', async () => {
  const res = makeRes();
  await systemMod.handleJianyingSend(makeJsonReq({ items: [{ fileUrl: 'a' }, { localPath: 'b' }] }), res);
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
// Database 本地函数（backupDb / exportDataJson / deleteLocalFile）
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
  await tasksMod.handleTasksSave(makeJsonReq({ taskId: 'e1', prompt: 'p', channelName: 'c' }), makeRes());
  await dbMod.saveDb();
  const filePath = dbMod.exportDataJson(true);
  assert.ok(filePath, '应生成导出文件');
  const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  assert.ok(data.counts.tasks >= 1);
  assert.ok(data.tasks.some((t) => t.task_id === 'e1'));
});

test('Database·deleteLocalFile 删除本地文件且引用计数', async () => {
  // 造一个本地文件 + resources 引用
  const tasksDir = path.join(TEST_DIR, 'uploads', 'tasks');
  fs.mkdirSync(tasksDir, { recursive: true });
  const fpath = path.join(tasksDir, 'del.png');
  fs.writeFileSync(fpath, RED_PNG_BUFFER);
  const url = `http://127.0.0.1:18080/files/tasks/del.png`;

  const db = await dbMod.getDb();

  // 无引用 → 删除
  let ok = dbMod.deleteLocalFile(db, url);
  assert.equal(ok, true, '无引用应删除');
  assert.ok(!fs.existsSync(fpath), '文件应被删除');

  // 再造一个文件 + 引用 → 不删
  fs.writeFileSync(fpath, RED_PNG_BUFFER);
  await resourcesMod.handleResourcesSave(makeJsonReq({ id: 'ref1', url, type: 'image' }), makeRes());
  ok = dbMod.deleteLocalFile(db, url);
  assert.equal(ok, false, '有引用应跳过');
  assert.ok(fs.existsSync(fpath), '文件应保留');
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
    `Content-Type: ${contentType}\r\n\r\n`
  );
  const head = Buffer.from(parts.join(''));
  const tail = Buffer.from(`\r\n--${boundary}--\r\n`);
  const data = Buffer.concat([head, fileContent, tail]);
  const req = { headers: { 'content-type': `multipart/form-data; boundary=${boundary}` }, body: data };
  req.on = (ev, cb) => {
    if (ev === 'data' && data.length) cb(data);
    if (ev === 'end') cb();
    return req;
  };
  return req;
}

test('Files·upload multipart 落盘并返回 URL + 缩略图', async () => {
  const res = makeRes();
  await filesMod.handleUpload(makeMultipartReq({ filename: 'up.png', fileContent: RED_PNG_BUFFER, contentType: 'image/png', fields: { subfolder: 'canvas' } }), res);
  const body = parseResBody(res);
  assert.ok(body.url, '应返回 url');
  assert.match(body.url, /^http:\/\/127\.0\.0\.1:18080\/files\/canvas\//);
  assert.ok(body.thumbnailUrl, 'png 应生成缩略图');
  // 落盘文件存在且内容一致
  const relPath = body.url.replace(/^http:\/\/127\.0\.0\.1:18080\/files\//, '');
  const diskPath = path.join(TEST_DIR, 'uploads', relPath);
  assert.ok(fs.existsSync(diskPath));
  assert.ok(RED_PNG_BUFFER.equals(fs.readFileSync(diskPath)));
});

test('Files·upload multipart 缺少文件 → 400', async () => {
  const boundary = '----testboundary123';
  const data = Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="subfolder"\r\n\r\ncanvas\r\n--${boundary}--\r\n`);
  const req = { headers: { 'content-type': `multipart/form-data; boundary=${boundary}` }, body: data };
  req.on = (ev, cb) => { if (ev === 'data' && data.length) cb(data); if (ev === 'end') cb(); return req; };
  const res = makeRes();
  await filesMod.handleUpload(req, res);
  assert.equal(res.status, 400);
});

test('Files·thumbnail 为文件生成缩略图', async () => {
  // 先造一个磁盘文件
  const canvasDir = path.join(TEST_DIR, 'uploads', 'canvas');
  fs.mkdirSync(canvasDir, { recursive: true });
  fs.writeFileSync(path.join(canvasDir, 'thumb.png'), RED_PNG_BUFFER);
  const res = makeRes();
  await filesMod.handleThumbnail(makeGetReq(), res, new URL('http://x/api/files/thumbnail?url=' + encodeURIComponent('/files/canvas/thumb.png') + '&maxDim=100'));
  const body = parseResBody(res);
  assert.ok(body.thumbnailUrl, '应返回 thumbnailUrl');
});

test('Files·move 移动文件', async () => {
  const canvasDir = path.join(TEST_DIR, 'uploads', 'canvas');
  const destDir = path.join(TEST_DIR, 'uploads', 'migrated');
  fs.mkdirSync(canvasDir, { recursive: true });
  const src = path.join(canvasDir, 'mv.png');
  const dst = path.join(destDir, 'mv.png');
  fs.writeFileSync(src, RED_PNG_BUFFER);
  const res = makeRes();
  await filesMod.handleMove(makeJsonReq({ src, dst }), res);
  assert.deepEqual(parseResBody(res), { ok: true });
  assert.ok(!fs.existsSync(src));
  assert.ok(fs.existsSync(dst));
});

test('Files·mkdir 创建目录', async () => {
  const target = path.join(TEST_DIR, 'uploads', 'newdir', 'sub');
  const res = makeRes();
  await filesMod.handleMkdir(makeJsonReq({ folder: 'newdir/sub' }), res);
  assert.deepEqual(parseResBody(res), { ok: true });
  assert.ok(fs.existsSync(target));
});
