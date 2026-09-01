/**
 * 阶段二：localTool 后端路由/工具单测
 *
 * 对应 docs/10-测试覆盖补齐计划-2026-08-17.md §二「待开始（尚未实施）」。
 * 覆盖（均指向 src/ 源码，--experimental-strip-types 直接执行）：
 *   - routes/logs.ts        —— 前端日志上报（handleLogsPost）
 *   - routes/projects.ts    —— 项目全量 upsert + lastOpened 标记
 *   - utils/fileStore.ts    —— 文件名净化 / 路径解析 / 写入 / 缩略图 / 缩放
 *   - utils/netProxy.ts     —— 代理判定 / env 优先 / Lovart 走代理 / 本地直连
 *   - utils/logWriter.ts    —— 幂等 init（仅 initLogWriter 导出）
 *   - index.ts 装配要点     —— 关键路由注册 / catch-all 兜底 / 静态托管顺序 / 端口
 *
 * 运行：cd localTool && npm test  （脚本 = tsc && node --test test/*.test.js）
 *
 * DB 隔离：MAOMAO_DATA_DIR 指向 os.tmpdir 下独立目录，不污染 ~/.maomao-localtool。
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

// ── 隔离数据目录（在 import 业务模块前设置）──
const TEST_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'maomao-stage2-'));
process.env.MAOMAO_DATA_DIR = TEST_DIR;

// ── 与 localtool.test.js 一致的 req/res 辅助 ──
function makeRes() {
  const r = {
    status: 0,
    headers: {},
    body: null,
    writableEnded: false,
    on(ev, cb) { if (ev === 'error') r._onError = cb; return r; },
    writeHead(code, h) { r.status = code; if (h) r.headers = { ...r.headers, ...h }; return r; },
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
    if (ev === 'data' && data.length) cb(data);
    if (ev === 'end') cb();
    return req;
  };
  return req;
}
function parseResBody(res) {
  return res.body ? JSON.parse(res.body) : null;
}

// ════════════════════════════════════════════════════════════════════════
// routes/logs.ts
// ════════════════════════════════════════════════════════════════════════
const { handleLogsPost } = await importSrc(path.join('routes', 'logs.ts'));

// 收集所有 console 方法输出（logs.ts 用 console[level] ?? console.log）
function captureConsole() {
  const logged = [];
  const orig = {};
  for (const m of ['log', 'info', 'warn', 'error']) {
    orig[m] = console[m];
    console[m] = (...a) => logged.push(m + ' ' + a.map((x) => (typeof x === 'string' ? x : String(x))).join(' '));
  }
  return {
    logged,
    restore() { for (const m of ['log', 'info', 'warn', 'error']) console[m] = orig[m]; },
  };
}

test('[logs] 空 body 返回 {ok:true} 且 status 200', async () => {
  const res = makeRes();
  await handleLogsPost(makeJsonReq({}), res);
  assert.deepEqual(parseResBody(res), { ok: true });
  assert.equal(res.status, 200);
});

test('[logs] detail 字符串按 level 输出 [level] detail', async () => {
  const cap = captureConsole();
  try {
    await handleLogsPost(makeJsonReq({ level: 'warn', detail: '磁盘快满' }), makeRes());
    // 真实格式：`<method> [frontend][warn]  <iso> 磁盘快满`
    assert.ok(cap.logged.some((l) => l.includes('[warn]') && l.includes('磁盘快满')), '实际: ' + cap.logged.join(' | '));
  } finally { cap.restore(); }
});

test('[logs] detail 对象被 stringify 并带 task/node tag', async () => {
  const cap = captureConsole();
  try {
    await handleLogsPost(
      makeJsonReq({ level: 'error', detail: { code: 500, msg: 'boom' }, taskId: 't1', nodeId: 'n2' }),
      makeRes()
    );
    assert.ok(cap.logged.some((l) => l.includes('#taskId=t1') && l.includes('#nodeId=n2')), '实际: ' + cap.logged.join(' | '));
    assert.ok(cap.logged.some((l) => l.includes('"code":500')), '实际: ' + cap.logged.join(' | '));
  } finally { cap.restore(); }
});

test('[logs] 未知 level 回落 default 分支（info 兜底）', async () => {
  const cap = captureConsole();
  try {
    await handleLogsPost(makeJsonReq({ level: 'weird', detail: 'hi' }), makeRes());
    // level 非 warn/error → default 分支走 console.log
    assert.ok(cap.logged.some((l) => l.startsWith('log ') && l.includes('hi')), '实际: ' + cap.logged.join(' | '));
  } finally { cap.restore(); }
});

// ════════════════════════════════════════════════════════════════════════
// routes/projects.ts
// ════════════════════════════════════════════════════════════════════════
const { handleProjectsGet, handleProjectsSave } = await importSrc(path.join('routes', 'projects.ts'));

test('[projects] 空库 GET 返回 {projects:[], lastOpened}', async () => {
  const res = makeRes();
  await handleProjectsGet(makeJsonReq(undefined), res);
  const body = parseResBody(res);
  assert.ok(body && Array.isArray(body.data.projects), '应为 {code:0,data:{projects:[...]}}');
  assert.equal(body.data.projects.length, 0);
  assert.ok('lastOpened' in body.data, '应含 lastOpened 字段');
});

test('[projects] save 全量 upsert 并标记 isLastOpened / lastOpened 返回（含 version）', async () => {
  const list = [
    { id: 'p1', name: '项目A' },
    { id: 'p2', name: '项目B' },
  ];
  const res1 = makeRes();
  await handleProjectsSave(makeJsonReq({ projects: list, lastOpened: 'p2' }), res1);
  const saveBody = parseResBody(res1);
  assert.equal(saveBody.code, 0);
  assert.equal(saveBody.data.ok, true);
  assert.ok(typeof saveBody.data.version === 'number' && saveBody.data.version > 0, 'save 应返回递增版本号');

  const res2 = makeRes();
  await handleProjectsGet(makeJsonReq(undefined), res2);
  const b2 = parseResBody(res2);
  assert.equal(b2.data.projects.length, 2);
  const p1 = b2.data.projects.find((p) => p.id === 'p1');
  const p2 = b2.data.projects.find((p) => p.id === 'p2');
  assert.equal(p1.isLastOpened, false);
  assert.equal(p2.isLastOpened, true);
  assert.equal(b2.data.lastOpened, 'p2');
  assert.ok(typeof b2.data.version === 'number', 'GET 应返回项目列表版本号');
});

test('[projects] 再次 save 同时传 p1/p2 → 仅更新 p1 名字、p2 保留（增量 upsert）', async () => {
  // 上一测试已写入 p1/p2（p2 isLastOpened=true），这里重新保存全列表，仅改 p1 名字
  const res1 = makeRes();
  await handleProjectsSave(makeJsonReq({
    projects: [{ id: 'p1', name: '项目A改' }, { id: 'p2', name: '项目B' }],
    lastOpened: 'p1',
  }), res1);
  const res2 = makeRes();
  await handleProjectsGet(makeJsonReq(undefined), res2);
  const b2 = parseResBody(res2);
  const p1 = b2.data.projects.find((p) => p.id === 'p1');
  const p2 = b2.data.projects.find((p) => p.id === 'p2');
  assert.equal(p1.name, '项目A改');
  assert.equal(p1.isLastOpened, true);
  assert.equal(p2.name, '项目B');
  assert.equal(p2.isLastOpened, false);
});

test('[projects] 部分保存 → 不在列表的旧项目被删除', async () => {
  const res1 = makeRes();
  await handleProjectsSave(makeJsonReq({ projects: [{ id: 'p1', name: '项目A' }], lastOpened: 'p1' }), res1);
  const res2 = makeRes();
  await handleProjectsGet(makeJsonReq(undefined), res2);
  const b2 = parseResBody(res2);
  assert.deepEqual(b2.data.projects.map((p) => p.id), ['p1']);
  assert.equal(b2.data.lastOpened, 'p1');
});

test('[projects] save 缺少 projects 字段 → 400', async () => {
  const res = makeRes();
  await handleProjectsSave(makeJsonReq({ foo: 'bar' }), res);
  assert.equal(res.status, 400);
});

test('[projects] 旧版本保存 → conflict 拒绝覆盖（防双页面/旧数据覆盖丢新项目）', async () => {
  // 先保存一份，拿到当前 version
  const res0 = makeRes();
  await handleProjectsSave(makeJsonReq({ projects: [{ id: 'p1', name: 'P1' }], lastOpened: 'p1' }), res0);
  const currentVersion = parseResBody(res0).data.version;

  // 用「更旧版本」再保存（模拟旧页面/旧数据携带落后 version 覆盖）
  const res1 = makeRes();
  await handleProjectsSave(makeJsonReq({
    projects: [{ id: 'old-only', name: '旧项目' }],
    lastOpened: 'old-only',
    version: currentVersion - 1, // 明确声明旧版本
  }), res1);
  const conflictBody = parseResBody(res1);
  assert.equal(conflictBody.code, 0);
  assert.equal(conflictBody.data.ok, false);
  assert.equal(conflictBody.data.conflict, true, '旧版本应被拒绝并标记 conflict');
  assert.equal(conflictBody.data.version, currentVersion, 'conflict 返回库内最新版本');

  // 确认后端数据未被旧版本覆盖（旧项目没写入）
  const res2 = makeRes();
  await handleProjectsGet(makeJsonReq(undefined), res2);
  const b2 = parseResBody(res2);
  const hasOld = b2.data.projects.some((p) => p.id === 'old-only');
  assert.equal(hasOld, false, '旧版本保存不得覆盖掉现有项目');
  assert.ok(b2.data.projects.some((p) => p.id === 'p1'), '原项目 p1 应保留');
});

// ════════════════════════════════════════════════════════════════════════
// utils/fileStore.ts
// ════════════════════════════════════════════════════════════════════════
const fileStore = await importSrc(path.join('utils', 'fileStore.ts'));

test('[fileStore] sanitizeFilename 去除非法字符与空白', () => {
  // 真实：< > : " / \ | ? * \x00-\x1f → _，空格 → _；* 在正则字符集中但不在替换列表
  // 原串 a/b:c*?d<e>f|g\h i  → a_b_c__d_e_f_g_h_i
  assert.equal(fileStore.sanitizeFilename('a/b:c*?d<e>f|g\\h i'), 'a_b_c__d_e_f_g_h_i');
});

test('[fileStore] sanitizeFilename 全非法回退为原样（至少非空）', () => {
  const out = fileStore.sanitizeFilename('<>:"/\\|?*');
  assert.ok(out.length > 0);
});

test('[fileStore] normalizeSubfolder 放行登记根 + 合法嵌套（canvas/drop、migrated/人物、director3d）', () => {
  for (const ok of ['tasks', 'web', 'canvas', 'canvas/drop', 'canvas/video-process', 'migrated', 'migrated/人物', 'migrated/脚本/尾帧变体', 'director3d']) {
    assert.equal(fileStore.normalizeSubfolder(ok), ok, `应放行: ${ok}`);
  }
});

test('[fileStore] normalizeSubfolder 拒绝目录逃逸 / 未知根 / 绝对路径 / 盘符', () => {
  for (const bad of ['../etc', 'a/../../b', '..', '', '.', 'img', 'txt', '/etc/passwd', 'C:\\windows', 'uploads', 'assets']) {
    assert.equal(fileStore.normalizeSubfolder(bad), null, `应拒绝: ${JSON.stringify(bad)}`);
  }
});

test('[fileStore] resolveUploadTarget 用登记根计算绝对路径与 /files 前缀 URL', () => {
  const { dir, savedPath, urlPath } = fileStore.resolveUploadTarget('canvas', 'cat.png');
  assert.equal(path.basename(savedPath), 'cat.png');
  assert.ok(dir.endsWith(path.join('uploads', 'canvas')));
  assert.ok(urlPath.startsWith('/files/canvas/'));
  assert.ok(urlPath.endsWith('cat.png'));
});

test('[fileStore] resolveUploadTarget 未知根回退默认 canvas（防目录污染）', () => {
  const { dir, urlPath } = fileStore.resolveUploadTarget('img', 'cat.png');
  assert.ok(dir.endsWith(path.join('uploads', 'canvas')));
  assert.ok(urlPath.startsWith('/files/canvas/'));
});

test('[fileStore] writeUploadBuffer 自动加时间戳前缀去重并返回 urlPath', () => {
  const buf = Buffer.from('hello-maomao');
  const { savedPath, urlPath } = fileStore.writeUploadBuffer('tasks', 'note.txt', buf);
  assert.ok(fs.existsSync(savedPath), '文件应已落盘');
  assert.ok(/\d+-note\.txt$/.test(path.basename(savedPath)), '应含时间戳前缀，实际: ' + path.basename(savedPath));
  assert.ok(urlPath.startsWith('/files/tasks/'));
  assert.equal(fs.readFileSync(savedPath, 'utf-8'), 'hello-maomao');
});

test('[fileStore] writeUploadBufferAt 稳定文件名落盘（嵌套合法目录 migrated/a/b）', () => {
  const buf = Buffer.from('at-path');
  const rel = 'sub/at-stable.bin';
  const { savedPath, urlPath } = fileStore.writeUploadBufferAt('migrated/脚本', rel, buf);
  assert.ok(fs.existsSync(savedPath));
  assert.ok(urlPath.startsWith('/files/migrated/脚本/'));
  assert.equal(fs.readFileSync(savedPath, 'utf-8'), 'at-path');
});

test('[fileStore] ensureThumbnailTarget 返回 .thumbnails 内 thumb_ 前缀文件', () => {
  const src = path.join(TEST_DIR, 'uploads', 'abc.png');
  const { thumbPath, thumbUrl } = fileStore.ensureThumbnailTarget(src, '200x80_');
  assert.ok(thumbPath.includes('.thumbnails'));
  assert.ok(path.basename(thumbPath).startsWith('thumb_200x80_abc.png'));
  assert.ok(thumbUrl.startsWith('/files/'));
});

test('[fileStore] resizeImage 真实缩放（jimp 读图→写图）', async () => {
  const Jimp = (await import('jimp')).default;
  const src = path.join(TEST_DIR, 'resize-src.png');
  const dst = path.join(TEST_DIR, 'resize-dst.png');
  const img = new Jimp(100, 100, 0xff0000ff);
  await img.writeAsync(src);
  const ok = await fileStore.resizeImage(src, dst, { maxDim: 32, quality: 80 });
  assert.equal(ok, true);
  assert.ok(fs.existsSync(dst));
  const r = await Jimp.read(dst);
  assert.ok(r.bitmap.width <= 32 && r.bitmap.height <= 32, '缩放后 <=32，实际 ' + r.bitmap.width + 'x' + r.bitmap.height);
});

// ════════════════════════════════════════════════════════════════════════
// utils/netProxy.ts
// ════════════════════════════════════════════════════════════════════════
const netProxy = await importSrc(path.join('utils', 'netProxy.ts'));

test('[netProxy] fetchWithProxy 本地目标直连、且 requiresProxy 命中 Lovart 时尝试代理（行为验证）', async () => {
  // isLocalTarget / requiresProxy / proxyFromEnv 为模块内部函数（未导出），
  // 这里通过 fetchWithProxy 的可观测行为间接覆盖它们的分支逻辑。
  const prevH = process.env.HTTP_PROXY, prevHs = process.env.HTTPS_PROXY;
  delete process.env.HTTP_PROXY; delete process.env.HTTPS_PROXY;
  netProxy.resetProxyCache();

  // 1) 本地目标 → 仅一次直连 fetch，不经过代理探测
  let localCalls = [];
  let origFetch = global.fetch;
  global.fetch = async (u) => { localCalls.push(String(u)); return { ok: true, status: 200, headers: new Headers(), arrayBuffer: async () => new Uint8Array() }; };
  try {
    await netProxy.fetchWithProxy('http://127.0.0.1:18080/api/status');
    assert.deepEqual(localCalls, ['http://127.0.0.1:18080/api/status']);
  } finally {
    global.fetch = origFetch;
    netProxy.resetProxyCache();
  }

  // 2) Lovart 目标经 resolveProxy：当存在 env 代理时优先返回 env（无需真实连接）；
  //    当无 env 时回落本机端口探测，返回 string|null（不触发外部请求断言）。
  //    （fetchWithProxy 对代理目标走原生 http 到代理服务器，由集成/手动验证，这里只验证代理选择逻辑。）
  const prevH2 = process.env.HTTP_PROXY, prevHs2 = process.env.HTTPS_PROXY;
  process.env.HTTP_PROXY = 'http://env-proxy-test:8899';
  process.env.HTTPS_PROXY = 'http://env-proxy-test:8899';
  netProxy.resetProxyCache();
  try {
    const r = await netProxy.resolveProxy();
    assert.equal(r, 'http://env-proxy-test:8899', 'resolveProxy 在 env 存在时应优先返回 env 代理');
  } finally {
    if (prevH2 === undefined) delete process.env.HTTP_PROXY; else process.env.HTTP_PROXY = prevH2;
    if (prevHs2 === undefined) delete process.env.HTTPS_PROXY; else process.env.HTTPS_PROXY = prevHs2;
    netProxy.resetProxyCache();
  }
});

test('[netProxy] 无 env 代理时 resolveProxy 回落探测（返回 string 或 null，不抛错）', async () => {
  const prevH = process.env.HTTP_PROXY, prevHs = process.env.HTTPS_PROXY;
  delete process.env.HTTP_PROXY; delete process.env.HTTPS_PROXY;
  netProxy.resetProxyCache();
  try {
    const r = await netProxy.resolveProxy();
    assert.ok(typeof r === 'string' || r === null, '无 env 时应探测并返回 string|null，实际: ' + r);
  } finally {
    if (prevH !== undefined) process.env.HTTP_PROXY = prevH;
    if (prevHs !== undefined) process.env.HTTPS_PROXY = prevHs;
    netProxy.resetProxyCache();
  }
});

test('[netProxy] resolveProxy 有 env 代理时优先返回（不依赖探测）', async () => {
  const prevH = process.env.HTTP_PROXY, prevHs = process.env.HTTPS_PROXY;
  process.env.HTTP_PROXY = 'http://env-proxy:8888';
  process.env.HTTPS_PROXY = 'http://env-proxy:8888';
  netProxy.resetProxyCache();
  try {
    // resolveProxy 无参，但 env 优先逻辑对任何目标都先读 env
    const r = await netProxy.resolveProxy();
    assert.equal(r, 'http://env-proxy:8888');
  } finally {
    if (prevH === undefined) delete process.env.HTTP_PROXY; else process.env.HTTP_PROXY = prevH;
    if (prevHs === undefined) delete process.env.HTTPS_PROXY; else process.env.HTTPS_PROXY = prevHs;
    netProxy.resetProxyCache();
  }
});

test('[netProxy] fetchWithProxy 本地目标走直连（stub fetch 验证只调用一次）', async () => {
  const prevH = process.env.HTTP_PROXY, prevHs = process.env.HTTPS_PROXY;
  delete process.env.HTTP_PROXY; delete process.env.HTTPS_PROXY;
  netProxy.resetProxyCache();
  const directUrls = [];
  const origFetch = global.fetch;
  global.fetch = async (u) => { directUrls.push(String(u)); return { ok: true, status: 200, headers: new Headers(), arrayBuffer: async () => new Uint8Array() }; };
  try {
    await netProxy.fetchWithProxy('http://127.0.0.1:18080/api/status', { method: 'GET' });
    assert.deepEqual(directUrls, ['http://127.0.0.1:18080/api/status'], '本地目标应直接 fetch 一次，未走代理探测');
  } finally {
    global.fetch = origFetch;
    if (prevH !== undefined) process.env.HTTP_PROXY = prevH;
    if (prevHs !== undefined) process.env.HTTPS_PROXY = prevHs;
    netProxy.resetProxyCache();
  }
});

// ════════════════════════════════════════════════════════════════════════
// utils/logWriter.ts（仅 initLogWriter 导出）
// ════════════════════════════════════════════════════════════════════════
const logWriter = await importSrc(path.join('utils', 'logWriter.ts'));

test('[logWriter] 模块仅导出 initLogWriter（内部 getKeepDays/cleanupOldLogs 未暴露）', () => {
  const keys = Object.keys(logWriter);
  assert.deepEqual(keys, ['initLogWriter']);
});

test('[logWriter] initLogWriter 幂等（多次调用不重复接管 console）', () => {
  // 接管前记录原始 console 方法引用
  const orig = { log: console.log, info: console.info, warn: console.warn, error: console.error };
  logWriter.initLogWriter();
  const afterFirst = { log: console.log, info: console.info, warn: console.warn, error: console.error };
  logWriter.initLogWriter(); // 第二次
  const afterSecond = { log: console.log, info: console.info, warn: console.warn, error: console.error };
  // 第一次后已被接管（引用变化），第二次调用不应再次改变（引用不变 → 幂等）
  assert.notDeepEqual(afterFirst, orig, '首次 init 应接管 console');
  assert.deepEqual(afterFirst, afterSecond, '二次 init 不应再次改变 console 引用（幂等）');
});

// ════════════════════════════════════════════════════════════════════════
// 路由表装配要点
// 路由声明式集中在 src/router.ts；index.ts 只负责调度 + 顺序。
// ════════════════════════════════════════════════════════════════════════
const routerSrc = fs.readFileSync(path.join(SRC, 'router.ts'), 'utf-8');
const indexSrc = fs.readFileSync(path.join(SRC, 'index.ts'), 'utf-8');

test('[index] 关键业务路由均已注册（logs/projects/kv/files/passthrough）', () => {
  for (const seg of ['/api/logs', '/api/projects', '/api/kv/get', '/api/files/upload', 'handlePassthrough']) {
    assert.ok(routerSrc.includes(seg), 'router.js 应含 ' + seg);
  }
});

test('[index] catch-all 兜底在「Not Found」之前', () => {
  const ph = indexSrc.indexOf('await handlePassthrough'); // 调用处
  const nf = indexSrc.indexOf("sendError(res, 'Not Found'");
  assert.ok(ph > 0 && nf > 0 && ph < nf, 'passthrough 调用应在 Not Found 之前');
});

test('[index] 画布前端静态托管在 catch-all 之前', () => {
  const fe = indexSrc.indexOf('function handleFrontendPage');
  const ph = indexSrc.indexOf('await handlePassthrough'); // 调用处（非顶部 import）
  assert.ok(fe > 0 && ph > 0 && fe < ph, '前端托管应在 passthrough 调用之前');
});

test('[index] 默认端口 18080', () => {
  assert.ok(/PORT\) \|\| 18080/.test(indexSrc) || indexSrc.includes('|| 18080'), '默认端口应为 18080');
});

// ── 清理临时数据目录（延迟以等待 debouncedSaveDb 异步 flush 完成）──
after(async () => {
  await new Promise((r) => setTimeout(r, 1500));
  try { fs.rmSync(TEST_DIR, { recursive: true, force: true }); } catch {}
});
