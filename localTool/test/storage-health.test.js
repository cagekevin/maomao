/**
 * 存储健康 — 后端报表 + 安全删除单测。
 *
 * 覆盖（均指向 src/routes/admin.ts + src/utils/orphanGc.ts）：
 *   - handleAdminStorageHealth：按类别/项目/孤儿/重复聚合；空 uploads 返回空报表。
 *   - 无引用文件 → 列为孤儿；delete-file 成功删。
 *   - 被引用文件（KV/tasks/resources 里有 /files/ URL）→ 不列孤儿，delete-file 返回 skipped:'referenced' 不删。
 *   - 重复文件组：同 size+name 归组；仅未引用副本可删 / 计入可释放。
 *   - 安全红线：路径穿越 / 隐藏文件 / .thumbnails → skipped:'protected'，绝不删 uploads 外文件。
 *
 * dryRun 语义：报表只读不删；delete-file 仅删 uploads 内且无引用文件。
 * 运行：cd localTool && npm test（脚本 = tsc && node --test test/*.test.js）
 */
import { test, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(__dirname, '..', 'src');
const importSrc = (rel) => import(pathToFileURL(path.join(SRC, rel)).href);

// ── 隔离数据目录（必须在 import 业务模块前设置，避免污染 ~/.maomao-localtool）──
const TEST_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'maomao-sh-'));
process.env.MAOMAO_DATA_DIR = TEST_DIR;

const { handleAdminStorageHealth, handleAdminDeleteFile } = await importSrc(
  path.join('routes', 'admin.ts'),
);

function makeRes() {
  const r = {
    status: 0,
    headers: {},
    body: null,
    on(ev, cb) {
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
function makeJsonReq(body) {
  const data = body === undefined ? Buffer.alloc(0) : Buffer.from(JSON.stringify(body));
  const req = { headers: { 'content-type': 'application/json' }, body: data };
  req.on = (ev, cb) => {
    if (ev === 'data' && data.length) cb(data);
    if (ev === 'end') cb();
    return req;
  };
  return req;
}
function parseResBody(res) {
  return res.body ? JSON.parse(res.body) : null;
}

const uploadDir = path.join(TEST_DIR, 'uploads');
function writeUpload(rel, content) {
  const abs = path.join(uploadDir, rel.split('/').join(path.sep));
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
  return abs;
}

let db; // 惰性实例（getDb 同模块单例）

async function seedKv(key, value) {
  if (!db) db = await (await importSrc(path.join('db', 'database.ts'))).getDb();
  db.run('DELETE FROM kv WHERE key = ?', [key]);
  db.run('INSERT INTO kv (key, value) VALUES (?, ?)', [key, value]);
}

async function seedProject(id, name) {
  if (!db) db = await (await importSrc(path.join('db', 'database.ts'))).getDb();
  db.run('DELETE FROM projects WHERE id = ?', [id]);
  db.run('INSERT INTO projects (id, name, is_last_opened, created_at) VALUES (?, ?, 0, ?)', [
    id,
    name,
    Math.floor(Date.now() / 1000),
  ]);
}

beforeEach(() => {
  if (fs.existsSync(uploadDir)) fs.rmSync(uploadDir, { recursive: true, force: true });
  fs.mkdirSync(uploadDir, { recursive: true });
});

after(() => {
  fs.rmSync(TEST_DIR, { recursive: true, force: true });
});

test('[storage-health] 空 uploads 返回空报表（totalBytes=0、无孤儿/重复）', async () => {
  const res = makeRes();
  await handleAdminStorageHealth(makeJsonReq(undefined), res);
  const { code, data } = parseResBody(res);
  assert.equal(code, 0);
  assert.equal(data.totalBytes, 0);
  assert.equal(data.fileCount, 0);
  assert.deepEqual(data.orphans, []);
  assert.deepEqual(data.duplicates, []);
  assert.equal(data.reclaimableBytes, 0);
});

test('[storage-health] 无引用文件列为孤儿，delete-file 可删', async () => {
  writeUpload('canvas/orphan.png', 'hello-orphan');
  const reportRes = makeRes();
  await handleAdminStorageHealth(makeJsonReq(undefined), reportRes);
  const report = parseResBody(reportRes).data;
  assert.equal(report.orphans.length, 1);
  assert.equal(report.orphans[0].path, 'canvas/orphan.png');
  assert.equal(report.orphans[0].category, '图片');
  assert.equal(report.reclaimableBytes, 'hello-orphan'.length);

  // 删除成功
  const delRes = makeRes();
  await handleAdminDeleteFile(makeJsonReq({ path: 'canvas/orphan.png' }), delRes);
  const del = parseResBody(delRes).data;
  assert.equal(del.ok, true);
  assert.ok(!fs.existsSync(path.join(uploadDir, 'canvas', 'orphan.png')));
});

test('[storage-health] 被引用文件不列孤儿，delete-file 返回 skipped:referenced 不删', async () => {
  writeUpload('canvas/task1.png', 'referenced-png');
  // KV 画布快照引用该文件（等同节点引用 /files/ URL）
  await seedProject('proj-1', '项目A');
  await seedKv('canvas-state-v1-proj-1', '{"url":"http://127.0.0.1:18080/files/canvas/task1.png"}');

  const reportRes = makeRes();
  await handleAdminStorageHealth(makeJsonReq(undefined), reportRes);
  const report = parseResBody(reportRes).data;
  // 有引用 → 不列孤儿
  assert.equal(report.orphans.length, 0);
  // 该文件计入项目占用
  const proj = report.projects.find((p) => p.projectId === 'proj-1');
  assert.equal(proj.fileBytes, 'referenced-png'.length);

  const delRes = makeRes();
  await handleAdminDeleteFile(makeJsonReq({ path: 'canvas/task1.png' }), delRes);
  const del = parseResBody(delRes).data;
  assert.equal(del.ok, false);
  assert.equal(del.skipped, 'referenced');
  assert.ok(fs.existsSync(path.join(uploadDir, 'canvas', 'task1.png')));
});

test('[storage-health] 同 size+name 归重复组；仅未引用副本可删/计入可释放', async () => {
  writeUpload('a/dup.png', 'dup-content');
  writeUpload('b/dup.png', 'dup-content'); // 未引用副本
  await seedKv('canvas-state-v1-proj-1', '{"url":"http://127.0.0.1:18080/files/a/dup.png"}'); // 引用 a 副本

  const reportRes = makeRes();
  await handleAdminStorageHealth(makeJsonReq(undefined), reportRes);
  const report = parseResBody(reportRes).data;
  assert.equal(report.duplicates.length, 1);
  const group = report.duplicates[0];
  assert.equal(group.count, 2);
  assert.equal(group.files.filter((f) => f.referenced).length, 1); // 只有 a 被引用
  // 可释放量 = 未引用副本大小
  assert.equal(group.reclaimable, 'dup-content'.length);

  // 删未引用副本（b）成功
  const delB = makeRes();
  await handleAdminDeleteFile(makeJsonReq({ path: 'b/dup.png' }), delB);
  assert.equal(parseResBody(delB).data.ok, true);
  // 删被引用副本（a）被拒
  const delA = makeRes();
  await handleAdminDeleteFile(makeJsonReq({ path: 'a/dup.png' }), delA);
  assert.equal(parseResBody(delA).data.skipped, 'referenced');
  assert.ok(fs.existsSync(path.join(uploadDir, 'a', 'dup.png')));
});

test('[storage-health] 安全红线：路径穿越/隐藏文件/.thumbnails 一律 skipped:protected', async () => {
  // 穿越越界
  const res1 = makeRes();
  await handleAdminDeleteFile(makeJsonReq({ path: '../secret.png' }), res1);
  assert.equal(parseResBody(res1).data.skipped, 'protected');
  // 隐藏文件
  writeUpload('canvas/.hidden.png', 'x');
  const res2 = makeRes();
  await handleAdminDeleteFile(makeJsonReq({ path: 'canvas/.hidden.png' }), res2);
  assert.equal(parseResBody(res2).data.skipped, 'protected');
  // .thumbnails 内
  writeUpload('canvas/.thumbnails/t.png', 'x');
  const res3 = makeRes();
  await handleAdminDeleteFile(makeJsonReq({ path: 'canvas/.thumbnails/t.png' }), res3);
  assert.equal(parseResBody(res3).data.skipped, 'protected');
  // 绝对路径
  const res4 = makeRes();
  await handleAdminDeleteFile(makeJsonReq({ path: '/etc/passwd' }), res4);
  assert.equal(parseResBody(res4).data.skipped, 'protected');
});
