/**
 * KV 服务端原子 CAS 单测（docs/118 §三 S1 / §6.1 B）
 *
 * 覆盖：
 *   1. 无 ifVersion → 无条件写入 + 版本自增（旧行为回归，兼容期/回滚地基）
 *   2. ifVersion 匹配 → 写入成功，返回 data.version > 旧版本
 *   3. ifVersion 不匹配 → HTTP 409，且 GET /api/kv/get 读回【仍是旧值】、版本未自增（一个字节都不写）
 *   4. handleKvVersion 对不存在的 key 返回 0
 *   5. 冲突分支在 externalizeBase64InValue 之前 return —— 不得落盘任何新文件
 *
 * 风格对齐 test/stage2-routes.test.js：DB 隔离三件套（MAOMAO_DATA_DIR / MAOMAO_ROOT 必须在
 * import 业务模块【之前】设置）+ importSrc + makeRes / makeJsonReq 桩。
 *
 * 运行：cd localTool && npm test
 */
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(__dirname, '..', 'src');
const importSrc = (rel) => import(pathToFileURL(path.join(SRC, rel)).href);

// ── 隔离数据目录（必须在 import 业务模块前设置）──
const TEST_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'maomao-kv-cas-'));
process.env.MAOMAO_DATA_DIR = TEST_DIR;
process.env.MAOMAO_ROOT = TEST_DIR;

function makeRes() {
  const r = {
    status: 0,
    headers: {},
    body: null,
    writableEnded: false,
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
const versionUrl = (key) => new URL(`http://x/api/kv/version?key=${encodeURIComponent(key)}`);
const getUrl = (key) => new URL(`http://x/api/kv/get?key=${encodeURIComponent(key)}`);

const { handleKvGet, handleKvSet, handleKvVersion } = await importSrc(path.join('routes', 'kv.ts'));

// ════════════════════════════════════════════════════════════════════════
// 1) 兼容期地基：无 ifVersion = 旧行为（无条件写 + 版本自增）
// ════════════════════════════════════════════════════════════════════════
test('[kv-cas] 无 ifVersion → 无条件写入 + 版本自增（旧行为回归）', async () => {
  const key = 'cas-no-ifversion';
  const res1 = makeRes();
  await handleKvSet(makeJsonReq({ key, value: { nodes: [1] } }), res1);
  const b1 = parseResBody(res1);
  assert.equal(res1.status, 200);
  assert.equal(b1.code, 0);
  assert.equal(b1.data.ok, true);
  const v1 = b1.data.version;
  assert.ok(Number.isFinite(v1) && v1 > 0, '应返回写入后的版本号，实际: ' + v1);

  const res2 = makeRes();
  await handleKvSet(makeJsonReq({ key, value: { nodes: [2] } }), res2);
  const v2 = parseResBody(res2).data.version;
  assert.ok(v2 > v1, `版本应单调递增：${v1} → ${v2}`);
});

// ════════════════════════════════════════════════════════════════════════
// 2) ifVersion 匹配 → 写入成功且版本前进
// ════════════════════════════════════════════════════════════════════════
test('[kv-cas] ifVersion 匹配 → 写入成功，返回 data.version > 旧版本', async () => {
  const key = 'cas-match';

  const seed = makeRes();
  await handleKvSet(makeJsonReq({ key, value: { nodes: ['seed'] } }), seed);
  const cur = parseResBody(seed).data.version;

  const res = makeRes();
  await handleKvSet(makeJsonReq({ key, value: { nodes: ['cas-ok'] }, ifVersion: cur }), res);
  const body = parseResBody(res);
  assert.equal(res.status, 200);
  assert.equal(body.code, 0);
  assert.equal(body.data.ok, true);
  assert.ok(body.data.version > cur, `新版本应 > ifVersion：${body.data.version} <= ${cur}`);

  const getRes = makeRes();
  await handleKvGet(makeJsonReq(undefined), getRes, getUrl(key));
  assert.deepEqual(parseResBody(getRes), { nodes: ['cas-ok'] });
});

// ════════════════════════════════════════════════════════════════════════
// 3) ifVersion 不匹配 → 409 且一个字节都不写
// ════════════════════════════════════════════════════════════════════════
test('[kv-cas] ifVersion 不匹配 → 409，value 与 version 都不动（一个字节都不写）', async () => {
  const key = 'cas-conflict';
  const marker = { nodes: ['before-conflict'] };

  const seed = makeRes();
  await handleKvSet(makeJsonReq({ key, value: marker }), seed);
  const cur = parseResBody(seed).data.version;

  // 用一个明确过期的 ifVersion 尝试覆盖
  const conflict = makeRes();
  await handleKvSet(
    makeJsonReq({ key, value: { nodes: ['must-not-land'] }, ifVersion: cur - 1 }),
    conflict,
  );
  const cb = parseResBody(conflict);
  assert.equal(conflict.status, 409, '版本不符必须 409');
  assert.equal(cb.error.code, 'conflict');
  assert.equal(cb.current, cur, '409 须带 current 供前端更新基线');

  const getRes = makeRes();
  await handleKvGet(makeJsonReq(undefined), getRes, getUrl(key));
  assert.deepEqual(parseResBody(getRes), marker, '冲突时 value 必须保持旧值');

  const verRes = makeRes();
  await handleKvVersion(makeJsonReq(undefined), verRes, versionUrl(key));
  assert.equal(parseResBody(verRes).data.version, cur, '冲突时版本不得自增');
});

// ════════════════════════════════════════════════════════════════════════
// 4) handleKvVersion：不存在的 key → 0
// ════════════════════════════════════════════════════════════════════════
test('[kv-cas] handleKvVersion 对不存在的 key 返回 0', async () => {
  const res = makeRes();
  await handleKvVersion(makeJsonReq(undefined), res, versionUrl('cas-no-such-key'));
  assert.equal(res.status, 200);
  assert.equal(parseResBody(res).code, 0);
  assert.equal(parseResBody(res).data.version, 0);
});

// ════════════════════════════════════════════════════════════════════════
// 5) 冲突分支必须先于外置 return（否则会在磁盘上留下无人引用的文件）
// ════════════════════════════════════════════════════════════════════════
test('[kv-cas] 冲突时不触发 base64 外置 → 不落盘任何新文件', async () => {
  const key = 'cas-ext-order';
  const uploadCanvasDir = path.join(TEST_DIR, 'uploads', 'canvas');
  const countFiles = () =>
    fs.existsSync(uploadCanvasDir) ? fs.readdirSync(uploadCanvasDir).length : 0;

  const seed = makeRes();
  await handleKvSet(makeJsonReq({ key, value: { nodes: [] } }), seed);
  const cur = parseResBody(seed).data.version;

  const before = countFiles();
  // 合法 1x1 PNG（若走 externalize 会被落盘为 uploads/canvas/<sha1_16>.png）
  const TINY_PNG =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
  const conflict = makeRes();
  await handleKvSet(
    makeJsonReq({ key, value: { assetUrl: TINY_PNG }, ifVersion: cur - 1 }),
    conflict,
  );
  assert.equal(conflict.status, 409);
  assert.equal(
    countFiles(),
    before,
    '冲突分支必须在 externalizeBase64InValue 之前 return，不得落盘新文件',
  );
});

// ── 清理临时数据目录（延迟以等待 debouncedSaveDb 异步 flush 完成）──
after(async () => {
  await new Promise((r) => setTimeout(r, 1500));
  try {
    fs.rmSync(TEST_DIR, { recursive: true, force: true });
  } catch {}
});
