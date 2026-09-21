/**
 * 孤儿 GC · contentId（内容身份）的解析**不得依赖一张会被删的登记行**
 *
 * ── 缺陷（2026-09-21 取证）──
 * 删素材/任务入口的顺序是「**先删行 → 再 runReferenceGc**」（`routes/resources.ts` / `routes/tasks.ts`），
 * 而 `contentId → 物理文件` 原先只有一条路：`SELECT url FROM resources WHERE sha1 IN (...)`。
 * 那行**正是**这条反查的唯一来源 ⇒ 同一次调用里判据自己失明。后果与"节点字段形态"挂钩：
 *   · 画布节点持 `assetUrl + contentId`（多数）→ `/files/` 文本引用保住文件 ✅
 *   · 画布节点**只持 contentId**（存量形态，真实数据里有）→ 反查落空 → 文件被当孤儿**真删** ❌（不可逆）
 * 同一个用户动作、同一个语义（"这文件还有人引用"），结果取决于形态 ⇒ 判据形态依赖 = 缺陷。
 *
 * ── 与 TD-02-31 的边界 ──
 * TD-02-31 裁定的是「引用藏在**不可见**载体（浏览器 IndexedDB）⇒ 不该要求上报/副本/禁删约束」。
 * 本用例的引用**明确可见**（就在 localTool 的 KV 里），只是解析绕了一张会消失的行 —— 修复不新增
 * 任何防御、不约束任何调用方。
 *
 * ── 判据（删掉实现里对应那一步，本文件必须变红）──
 *  ① 行已删 + 磁盘文件名携带该 sha1（内容寻址命名）→ 文件必须保留；
 *  ② 文件名含 40 位十六进制但**不在**被引用身份集里 → 必须照旧回收（防"看着像就保住"的假判据）。
 *
 * 运行：cd localTool && npm test（= tsc --noEmit && node --test --import tsx test/*.test.js）
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(__dirname, '..', 'src');
const importSrc = (rel) => import(pathToFileURL(path.join(SRC, rel)).href);

// ── 隔离数据目录（必须在 import 业务模块前设置，避免污染 ~/.maomao-localtool）──
const TEST_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'maomao-gc-cid-'));
process.env.MAOMAO_DATA_DIR = TEST_DIR;

const gcMod = await importSrc(path.join('utils', 'orphanGc.ts'));
const kvMod = await importSrc(path.join('routes', 'kv.ts'));
const resourcesMod = await importSrc(path.join('routes', 'resources.ts'));
const dbMod = await importSrc(path.join('db', 'database.ts'));
const adminMod = await importSrc(path.join('routes', 'admin.ts'));

const UPLOAD_DIR = path.join(TEST_DIR, 'uploads');

function makeRes() {
  const r = {
    status: 0,
    headers: {},
    body: null,
    on() {
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

/** 插入一行素材登记（列集与 routes/resources.ts 的写入一致）。 */
async function insertResourceRow({ id, url, folder, name, sha1 }) {
  const db = await dbMod.getDb();
  dbMod.run(
    db,
    'INSERT INTO resources (id, url, type, source, folder, name, sha1, is_favorite, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [id, url, 'image', 'local-tool', folder, name, sha1, 0, Date.now()],
  );
  return id;
}

test('GC·行删后仍按内容身份保住文件：画布只持 contentId → 删素材不得连带真删磁盘文件', async () => {
  const hex = 'b'.repeat(40);
  const rel = `migrated/${hex}.png`; // 内容寻址命名（落盘真形态：文件名即内容身份）
  const abs = path.join(UPLOAD_DIR, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, Buffer.from('CONTENT-ADDRESSED'));

  const cid = `sha1:${hex}`;
  await insertResourceRow({
    id: `local-migrated-${hex}.png`,
    url: `http://127.0.0.1:18080/files/${rel}`,
    folder: 'migrated',
    name: `${hex}.png`,
    sha1: cid,
  });
  // 画布节点**只持 contentId**（存量形态；无 assetUrl/url 文本可救）
  await kvMod.handleKvSet(
    makeJsonReq({
      key: 'canvas-state-v1-cid',
      value: JSON.stringify({ nodes: [{ id: 'n1', data: { label: '素材', contentId: cid } }] }),
    }),
    makeRes(),
  );

  // 用户在素材库删除该素材：先删行 → 尾部 runReferenceGc（旧实现此刻已失明）
  await resourcesMod.handleResourcesDelete(
    makeJsonReq(),
    makeRes(),
    new URL(`http://x/api/resources/delete?id=local-migrated-${hex}.png`),
  );

  assert.ok(
    fs.existsSync(abs),
    '画布仍以 contentId 引用该内容 → 文件必须保留（内容身份不依赖任何登记行）',
  );
});

test('GC·不放过真孤儿：文件名含 40 位十六进制 ≠ 被引用（身份必须完整命中）', async () => {
  const hex = 'c'.repeat(40); // 该 sha1 不出现在任何 KV / 登记行里
  const rel = `migrated/1786000000000-${hex}.png`; // 真实存在的命名形态：<时间戳>-<sha1>.<ext>
  const abs = path.join(UPLOAD_DIR, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, Buffer.from('ORPHAN'));

  await gcMod.runReferenceGc(false);

  assert.ok(
    !fs.existsSync(abs),
    '名字里带 40 位十六进制不构成引用：无人引用必须照旧回收（防假判据）',
  );
});

test('同缺陷的另两个消费点：存储健康报表不把它列孤儿、单文件删除守卫拒绝删它', async () => {
  const hex = 'd'.repeat(40);
  const rel = `migrated/${hex}.png`; // 内容寻址命名，且**无** resources 行（行早已不存在）
  const abs = path.join(UPLOAD_DIR, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, Buffer.from('CONTENT-ADDRESSED-2'));
  const cid = `sha1:${hex}`;
  await kvMod.handleKvSet(
    makeJsonReq({
      key: 'canvas-state-v1-cid2',
      value: JSON.stringify({ nodes: [{ id: 'n2', data: { label: '素材', contentId: cid } }] }),
    }),
    makeRes(),
  );

  // ① 报表：不能被列为「可清理孤儿」（否则 UI 引导用户去删一个还在用的文件）
  const healthRes = makeRes();
  await adminMod.handleAdminStorageHealth({}, healthRes);
  const orphans = (JSON.parse(healthRes.body).data.orphans || []).map((o) => o.path);
  assert.ok(!orphans.includes(rel), '被内容身份引用的文件不得列进孤儿清单');

  // ② 删除守卫：同一条判据，必须拒删
  const delRes = makeRes();
  await adminMod.handleAdminDeleteFile(makeJsonReq({ path: rel }), delRes);
  assert.deepEqual(JSON.parse(delRes.body).data, { ok: false, skipped: 'referenced' });
  assert.ok(fs.existsSync(abs), '守卫拒绝后文件必须还在');
});
