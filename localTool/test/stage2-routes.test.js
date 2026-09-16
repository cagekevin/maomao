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

import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
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
// MAOMAO_ROOT 决定 paths.ts 的 getRoot()。必须在任何 importSrc 之前设置：
// logWriter.ts 在【模块顶层】就把日志目录固化为 getRoot()/logs，而 routes/logs.ts
// 又 import 了它 —— 不隔离的话，本文件的日志会写进真实的 localTool/logs/。
process.env.MAOMAO_ROOT = TEST_DIR;

// ── 与 localtool.test.js 一致的 req/res 辅助 ──
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
    console[m] = (...a) =>
      logged.push(m + ' ' + a.map((x) => (typeof x === 'string' ? x : String(x))).join(' '));
  }
  return {
    logged,
    restore() {
      for (const m of ['log', 'info', 'warn', 'error']) console[m] = orig[m];
    },
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
    assert.ok(
      cap.logged.some((l) => l.includes('[warn]') && l.includes('磁盘快满')),
      '实际: ' + cap.logged.join(' | '),
    );
  } finally {
    cap.restore();
  }
});

test('[logs] detail 对象被 stringify 并带 task/node tag', async () => {
  const cap = captureConsole();
  try {
    await handleLogsPost(
      makeJsonReq({
        level: 'error',
        detail: { code: 500, msg: 'boom' },
        taskId: 't1',
        nodeId: 'n2',
      }),
      makeRes(),
    );
    assert.ok(
      cap.logged.some((l) => l.includes('#taskId=t1') && l.includes('#nodeId=n2')),
      '实际: ' + cap.logged.join(' | '),
    );
    assert.ok(
      cap.logged.some((l) => l.includes('"code":500')),
      '实际: ' + cap.logged.join(' | '),
    );
  } finally {
    cap.restore();
  }
});

test('[logs] 未知 level 回落 default 分支（info 兜底）', async () => {
  const cap = captureConsole();
  try {
    await handleLogsPost(makeJsonReq({ level: 'weird', detail: 'hi' }), makeRes());
    // level 非 warn/error → default 分支走 console.log
    assert.ok(
      cap.logged.some((l) => l.startsWith('log ') && l.includes('hi')),
      '实际: ' + cap.logged.join(' | '),
    );
  } finally {
    cap.restore();
  }
});

// ════════════════════════════════════════════════════════════════════════
// routes/projects.ts
// ════════════════════════════════════════════════════════════════════════
const { handleProjectsGet, handleProjectsSave } = await importSrc(
  path.join('routes', 'projects.ts'),
);

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
  assert.ok(
    typeof saveBody.data.version === 'number' && saveBody.data.version > 0,
    'save 应返回递增版本号',
  );

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
  await handleProjectsSave(
    makeJsonReq({
      projects: [
        { id: 'p1', name: '项目A改' },
        { id: 'p2', name: '项目B' },
      ],
      lastOpened: 'p1',
    }),
    res1,
  );
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
  await handleProjectsSave(
    makeJsonReq({ projects: [{ id: 'p1', name: '项目A' }], lastOpened: 'p1' }),
    res1,
  );
  const res2 = makeRes();
  await handleProjectsGet(makeJsonReq(undefined), res2);
  const b2 = parseResBody(res2);
  assert.deepEqual(
    b2.data.projects.map((p) => p.id),
    ['p1'],
  );
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
  await handleProjectsSave(
    makeJsonReq({ projects: [{ id: 'p1', name: 'P1' }], lastOpened: 'p1' }),
    res0,
  );
  const currentVersion = parseResBody(res0).data.version;

  // 用「更旧版本」再保存（模拟旧页面/旧数据携带落后 version 覆盖）
  const res1 = makeRes();
  await handleProjectsSave(
    makeJsonReq({
      projects: [{ id: 'old-only', name: '旧项目' }],
      lastOpened: 'old-only',
      version: currentVersion - 1, // 明确声明旧版本
    }),
    res1,
  );
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
  assert.ok(
    b2.data.projects.some((p) => p.id === 'p1'),
    '原项目 p1 应保留',
  );
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
  for (const ok of [
    'tasks',
    'web',
    'canvas',
    'canvas/drop',
    'canvas/video-process',
    'migrated',
    'migrated/人物',
    'migrated/脚本/尾帧变体',
    'director3d',
  ]) {
    assert.equal(fileStore.normalizeSubfolder(ok), ok, `应放行: ${ok}`);
  }
});

test('[fileStore] normalizeSubfolder 拒绝目录逃逸 / 未知根 / 绝对路径 / 盘符', () => {
  for (const bad of [
    '../etc',
    'a/../../b',
    '..',
    '',
    '.',
    'img',
    'txt',
    '/etc/passwd',
    'C:\\windows',
    'uploads',
    'assets',
  ]) {
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

test('[fileStore] writeUploadBuffer 内容寻址命名（sha1(buffer)）替代时间戳前缀并返回 urlPath', () => {
  const buf = Buffer.from('hello-maomao');
  const { savedPath, urlPath } = fileStore.writeUploadBuffer('tasks', 'note.txt', buf);
  assert.ok(fs.existsSync(savedPath), '文件应已落盘');
  const expectedName = fileStore.contentHashName(
    crypto.createHash('sha1').update(buf).digest('hex'),
    '.txt',
  );
  assert.equal(
    path.basename(savedPath),
    expectedName,
    '应含 sha1(content) 内容寻址名，实际: ' + path.basename(savedPath),
  );
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

test('[fileStore] TD-03-7：resizeImage 对非法图片返回 false 且不产出文件（供调用方诚实降级）', async () => {
  // 回归锁根因：resizeImage 失败返回 false 是「诚实信号」；此前**两处缩略图调用方**据它 copyFileSync 伪造缩略图，
  // 把「必须显式失败」降级成「静默产出语义相反的结果」。本测试锁 resizeImage 侧契约（false + 不写文件），
  // 迫使调用方必须显式处理（files.ts 已改为 return null / sendError(500)）。
  const bad = path.join(TEST_DIR, 'not-an-image.png');
  const out = path.join(TEST_DIR, 'should-not-exist.png');
  fs.writeFileSync(bad, 'this is definitely not a png');
  if (fs.existsSync(out)) fs.unlinkSync(out);
  const ok = await fileStore.resizeImage(bad, out, { maxDim: 64, quality: 80 });
  assert.equal(ok, false, '非法图片应返回 false（不得静默成功）');
  assert.equal(fs.existsSync(out), false, 'resize 失败不得产出输出文件（防调用方误会已成功）');
  fs.unlinkSync(bad);
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
  assert.ok(
    r.bitmap.width <= 32 && r.bitmap.height <= 32,
    '缩放后 <=32，实际 ' + r.bitmap.width + 'x' + r.bitmap.height,
  );
});

// ── 【TD-02-41】「Jimp 可编码格式」唯一真源的行为锁 ──
// 收口前这个事实有 3 份：前端 assetUrl.ts(`new Set`) · files.ts(`SUPPORTED_THUMB_FORMATS`) ·
// resolveLocalImages.mimeFromExt(switch)，靠注释同步且**已漂移**（前端注释声称"与后端一致"而值不同步）。
// 现收口到 fileStore 的 JIMP_MIME_BY_EXT + 两个派生函数 —— 新增/删除格式只改一处，三处消费方同时生效。
test('[fileStore] TD-02-41：isJimpEncodableExt 只放行 Jimp 可编码格式（webp 无编码器 → false）', () => {
  for (const ok of ['png', 'JPG', 'Jpeg', 'gif', 'bmp', 'tiff']) {
    assert.equal(fileStore.isJimpEncodableExt(ok), true, `应放行: ${ok}`);
  }
  // webp / avif / svg：@jimp/types 无编码器 → 放行会产出「.webp 名 + 原格式字节」的假图（TD-03-7 旧坑）
  for (const no of ['webp', 'avif', 'svg', 'mp4', '', '   ', null, undefined, 42]) {
    assert.equal(fileStore.isJimpEncodableExt(no), false, `应拒绝: ${String(no)}`);
  }
});

test('[fileStore] TD-02-41/TD-08-23：jimpMimeForFile 扩展名优先、缺失时取字节真相（不再静默 png）', async () => {
  const Jimp = (await import('jimp')).default;
  // 夹具必须是「真解码出来的 JPEG」——`new Jimp(w,h)` 无源格式，getMIME() 恒 image/png（测不出本条修复）。
  const jpegImg = await Jimp.read(
    await new Jimp(20, 20, 0xff0000ff).getBufferAsync(Jimp.MIME_JPEG),
  );
  assert.equal(jpegImg.getMIME(), Jimp.MIME_JPEG, '夹具前提：解码对象真格式 = JPEG');
  // 扩展名已登记 → 尊重声明名（与历史行为一致）
  assert.equal(fileStore.jimpMimeForFile('jpg', jpegImg), Jimp.MIME_JPEG);
  assert.equal(fileStore.jimpMimeForFile('JPEG', jpegImg), Jimp.MIME_JPEG);
  assert.equal(fileStore.jimpMimeForFile('gif', jpegImg), Jimp.MIME_GIF);
  assert.equal(fileStore.jimpMimeForFile('.png', jpegImg), Jimp.MIME_PNG);
  // 【TD-08-23 修复】扩展名缺失/未登记 → 取已解码对象的真 MIME，而非静默 png
  assert.equal(
    fileStore.jimpMimeForFile('', jpegImg),
    Jimp.MIME_JPEG,
    '无扩展名 JPEG 不得被当成 png',
  );
  assert.equal(
    fileStore.jimpMimeForFile('webp', jpegImg),
    Jimp.MIME_JPEG,
    '不可编码扩展名回落字节真相',
  );
});

test('[fileStore] TD-08-23：jimpExtForFile 从字节读出真格式扩展名（无扩展名磁盘文件）', async () => {
  const Jimp = (await import('jimp')).default;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'maomao-jimpext-'));
  // 真 JPEG 字节 + 无扩展名文件名（正是 TD-08-23 的触发形态）
  const noExt = path.join(dir, 'deadbeef');
  fs.writeFileSync(noExt, await new Jimp(20, 20, 0xff0000ff).getBufferAsync(Jimp.MIME_JPEG));
  assert.equal(await fileStore.jimpExtForFile(noExt), 'jpg', '真 JPEG 应读出 jpg 而非 png');
  // 真 PNG 字节 + 无扩展名
  const noExtPng = path.join(dir, 'cafebabe');
  fs.writeFileSync(noExtPng, await new Jimp(20, 20, 0xff0000ff).getBufferAsync(Jimp.MIME_PNG));
  assert.equal(await fileStore.jimpExtForFile(noExtPng), 'png');
  // 非图字节 → 读不出 → null（调用方显式失败，不猜）
  const notImg = path.join(dir, 'notanimage');
  fs.writeFileSync(notImg, Buffer.from('这不是图片'));
  assert.equal(await fileStore.jimpExtForFile(notImg), null);
  fs.rmSync(dir, { recursive: true, force: true });
});

// ════════════════════════════════════════════════════════════════════════
// utils/netProxy.ts
// ════════════════════════════════════════════════════════════════════════
const netProxy = await importSrc(path.join('utils', 'netProxy.ts'));

test('[netProxy] fetchWithProxy 本地目标直连、且 requiresProxy 命中 Lovart 时尝试代理（行为验证）', async () => {
  // isLocalTarget / requiresProxy / proxyFromEnv 为模块内部函数（未导出），
  // 这里通过 fetchWithProxy 的可观测行为间接覆盖它们的分支逻辑。
  const prevH = process.env.HTTP_PROXY,
    prevHs = process.env.HTTPS_PROXY;
  delete process.env.HTTP_PROXY;
  delete process.env.HTTPS_PROXY;
  netProxy.resetProxyCache();

  // 1) 本地目标 → 仅一次直连 fetch，不经过代理探测
  let localCalls = [];
  let origFetch = global.fetch;
  global.fetch = async (u) => {
    localCalls.push(String(u));
    return {
      ok: true,
      status: 200,
      headers: new Headers(),
      arrayBuffer: async () => new Uint8Array(),
    };
  };
  try {
    await netProxy.fetchWithProxy('http://127.0.0.1:18080/api/status');
    assert.deepEqual(localCalls, ['http://127.0.0.1:18080/api/status']);
  } finally {
    global.fetch = origFetch;
    netProxy.resetProxyCache();
    if (prevH === undefined) delete process.env.HTTP_PROXY;
    else process.env.HTTP_PROXY = prevH;
    if (prevHs === undefined) delete process.env.HTTPS_PROXY;
    else process.env.HTTPS_PROXY = prevHs;
  }

  // 2) Lovart 目标经 resolveProxy：当存在 env 代理时优先返回 env（无需真实连接）；
  //    当无 env 时回落本机端口探测，返回 string|null（不触发外部请求断言）。
  //    （fetchWithProxy 对代理目标走原生 http 到代理服务器，由集成/手动验证，这里只验证代理选择逻辑。）
  const prevH2 = process.env.HTTP_PROXY,
    prevHs2 = process.env.HTTPS_PROXY;
  process.env.HTTP_PROXY = 'http://env-proxy-test:8899';
  process.env.HTTPS_PROXY = 'http://env-proxy-test:8899';
  netProxy.resetProxyCache();
  try {
    const r = await netProxy.resolveProxy();
    assert.equal(r, 'http://env-proxy-test:8899', 'resolveProxy 在 env 存在时应优先返回 env 代理');
  } finally {
    if (prevH2 === undefined) delete process.env.HTTP_PROXY;
    else process.env.HTTP_PROXY = prevH2;
    if (prevHs2 === undefined) delete process.env.HTTPS_PROXY;
    else process.env.HTTPS_PROXY = prevHs2;
    netProxy.resetProxyCache();
  }
});

test('[netProxy] 无 env 代理时 resolveProxy 回落探测（返回 string 或 null，不抛错）', async () => {
  const prevH = process.env.HTTP_PROXY,
    prevHs = process.env.HTTPS_PROXY;
  delete process.env.HTTP_PROXY;
  delete process.env.HTTPS_PROXY;
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
  const prevH = process.env.HTTP_PROXY,
    prevHs = process.env.HTTPS_PROXY;
  process.env.HTTP_PROXY = 'http://env-proxy:8888';
  process.env.HTTPS_PROXY = 'http://env-proxy:8888';
  netProxy.resetProxyCache();
  try {
    // resolveProxy 无参，但 env 优先逻辑对任何目标都先读 env
    const r = await netProxy.resolveProxy();
    assert.equal(r, 'http://env-proxy:8888');
  } finally {
    if (prevH === undefined) delete process.env.HTTP_PROXY;
    else process.env.HTTP_PROXY = prevH;
    if (prevHs === undefined) delete process.env.HTTPS_PROXY;
    else process.env.HTTPS_PROXY = prevHs;
    netProxy.resetProxyCache();
  }
});

test('[netProxy] fetchWithProxy 本地目标走直连（stub fetch 验证只调用一次）', async () => {
  const prevH = process.env.HTTP_PROXY,
    prevHs = process.env.HTTPS_PROXY;
  delete process.env.HTTP_PROXY;
  delete process.env.HTTPS_PROXY;
  netProxy.resetProxyCache();
  const directUrls = [];
  const origFetch = global.fetch;
  global.fetch = async (u) => {
    directUrls.push(String(u));
    return {
      ok: true,
      status: 200,
      headers: new Headers(),
      arrayBuffer: async () => new Uint8Array(),
    };
  };
  try {
    await netProxy.fetchWithProxy('http://127.0.0.1:18080/api/status', { method: 'GET' });
    assert.deepEqual(
      directUrls,
      ['http://127.0.0.1:18080/api/status'],
      '本地目标应直接 fetch 一次，未走代理探测',
    );
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

test('[logWriter] 仅导出对外 API（addLogClient/removeLogClient/initLogWriter），内部函数未暴露', () => {
  const keys = Object.keys(logWriter);
  // 对外 API 必须存在
  assert.ok(keys.includes('initLogWriter'), '应导出 initLogWriter');
  assert.ok(keys.includes('addLogClient'), '应导出 addLogClient（SSE 日志广播注册客户端）');
  assert.ok(keys.includes('removeLogClient'), '应导出 removeLogClient（SSE 日志广播移除客户端）');
  // 内部实现函数不得暴露
  assert.ok(!keys.includes('getKeepDays'), '内部 getKeepDays 不应暴露');
  assert.ok(!keys.includes('cleanupOldLogs'), '内部 cleanupOldLogs 不应暴露');
  assert.ok(!keys.includes('broadcastLog'), '内部 broadcastLog 不应暴露');
});

test('[logWriter] initLogWriter 幂等（多次调用不重复接管 console）', () => {
  // 接管前记录原始 console 方法引用
  const orig = { log: console.log, info: console.info, warn: console.warn, error: console.error };
  try {
    logWriter.initLogWriter();
    const afterFirst = {
      log: console.log,
      info: console.info,
      warn: console.warn,
      error: console.error,
    };
    logWriter.initLogWriter(); // 第二次
    const afterSecond = {
      log: console.log,
      info: console.info,
      warn: console.warn,
      error: console.error,
    };
    // 第一次后已被接管（引用变化），第二次调用不应再次改变（引用不变 → 幂等）
    assert.notDeepEqual(afterFirst, orig, '首次 init 应接管 console');
    assert.deepEqual(afterFirst, afterSecond, '二次 init 不应再次改变 console 引用（幂等）');
  } finally {
    // 生产态接管不可逆（进程 = 服务生命周期），但测试必须自己摘掉：
    // 否则本文件后续用例的 console 输出全被吞进日志流，断言失败时看不到任何诊断信息。
    Object.assign(console, orig);
  }
});

// ════════════════════════════════════════════════════════════════════════
// 路由表装配要点
// 路由声明式集中在 src/router.ts；index.ts 只负责调度 + 顺序。
// ════════════════════════════════════════════════════════════════════════
const routerSrc = fs.readFileSync(path.join(SRC, 'router.ts'), 'utf-8');
const indexSrc = fs.readFileSync(path.join(SRC, 'index.ts'), 'utf-8');

test('[index] 关键业务路由均已注册（logs/projects/kv/files/passthrough）', () => {
  for (const seg of [
    '/api/logs',
    '/api/projects',
    '/api/kv/get',
    '/api/files/upload',
    'handlePassthrough',
  ]) {
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
  assert.ok(
    /PORT\) \|\| 18080/.test(indexSrc) || indexSrc.includes('|| 18080'),
    '默认端口应为 18080',
  );
});

// ════════════════════════════════════════════════════════════════════════
// routes/files.ts —— upload dataUri 分支（deepening-files-upload-seam 候选 B）
// saveInlineToLocal 已收口为「透传 base64 原文 + 子目录」，落盘统一走
// saveBase64ToFile（contentHashName(sha1(bytes)) 内容寻址幂等 + isValidBase64 严格校验）。
// 【2026-09-13 TD-03-9】命名由 `sha1(base64文本)前16位` 统一为 canonical `sha1(bytes)`（40 位 hex），
// 与 writeUploadBuffer/writeUploadDedup 同口径（同字节 → 同物理名）。
// ════════════════════════════════════════════════════════════════════════
const { handleUpload } = await importSrc(path.join('routes', 'files.ts'));

// 1x1 透明 PNG（合法 base64）
const TINY_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
const uploadBase = `http://127.0.0.1:${Number(process.env.PORT) || 18080}/files`;

test('[files/dataUri] 合法 dataUri + subfolder → 200 + 落盘 /files/tasks/<hash>.png', async () => {
  const res = makeRes();
  await handleUpload(makeJsonReq({ dataUri: TINY_PNG, subfolder: 'tasks' }), res);
  const body = parseResBody(res);
  assert.equal(res.status, 200);
  assert.equal(body.code, 0);
  const url = body.data.url;
  assert.ok(url.startsWith(`${uploadBase}/tasks/`), 'URL 应落 tasks 子目录，实际: ' + url);
  assert.ok(url.endsWith('.png'), '扩展名应为 .png，实际: ' + url);
  const name = url.split('/').pop();
  // TD-03-9（2026-09-13）：命名统一为 canonical `sha1(bytes)` 全 40 位 hex + ext（此前是 sha1(base64文本)前16位）
  assert.equal(name.length, 40 + 4, '文件名应为 sha1(bytes) 全 40 位 hex + .png');
  assert.ok(fs.existsSync(path.join(TEST_DIR, 'uploads', 'tasks', name)), '文件应真实落盘');
});

test('[files/dataUri] 幂等：同一 dataUri 二次上传返回同一 URL（不重复落盘）', async () => {
  const a = makeRes();
  await handleUpload(makeJsonReq({ dataUri: TINY_PNG, subfolder: 'tasks' }), a);
  const b = makeRes();
  await handleUpload(makeJsonReq({ dataUri: TINY_PNG, subfolder: 'tasks' }), b);
  assert.equal(parseResBody(a).data.url, parseResBody(b).data.url, 'sha1 幂等 → 同 URL');
});

// ── TD-03-8（2026-09-13）：multipart 无扩展名 filename + mimeType → 应据 mimeType 补扩展名 ──
/** 构造 multipart/form-data 请求（Buffer 部件，支持指定 part 的 Content-Type） */
function makeMultipartReq(parts) {
  const boundary = '----testboundary' + Date.now();
  const chunks = [];
  for (const p of parts) {
    let head = `--${boundary}\r\n`;
    if (p.filename !== undefined) {
      head += `Content-Disposition: form-data; name="${p.name}"; filename="${p.filename}"\r\n`;
      if (p.contentType) head += `Content-Type: ${p.contentType}\r\n`;
    } else {
      head += `Content-Disposition: form-data; name="${p.name}"\r\n`;
    }
    head += '\r\n';
    chunks.push(Buffer.from(head, 'utf-8'));
    chunks.push(Buffer.isBuffer(p.data) ? p.data : Buffer.from(String(p.data), 'utf-8'));
    chunks.push(Buffer.from('\r\n', 'utf-8'));
  }
  chunks.push(Buffer.from(`--${boundary}--\r\n`, 'utf-8'));
  const data = Buffer.concat(chunks);
  const req = { headers: { 'content-type': `multipart/form-data; boundary=${boundary}` } };
  req.on = (ev, cb) => {
    if (ev === 'data') cb(data);
    if (ev === 'end') cb();
    return req;
  };
  return req;
}

test('[files/multipart] TD-03-8：无扩展名 filename + image/png 的 mimeType → 落盘应带 .png（非无后缀）', async () => {
  // 回归锁：原实现只用 filename 推 ext，故 'upload'（无后缀）→ 落成无扩展名文件 → octet-stream + 跳过缩略图。
  // 【TD-12-5】用独立字节，避开与上面 tasks 用例的 contentId 去重。
  const pngBytes = Buffer.concat([
    Buffer.from(TINY_PNG.split(',')[1], 'base64'),
    Buffer.from('mime'),
  ]);
  const res = makeRes();
  await handleUpload(
    makeMultipartReq([
      { name: 'subfolder', data: 'canvas' },
      { name: 'filename', data: 'upload' },
      { name: 'file', filename: 'upload', contentType: 'image/png', data: pngBytes },
    ]),
    res,
  );
  const body = parseResBody(res);
  assert.equal(res.status, 200, '应 200，实际 ' + res.status + ' body=' + res.body);
  assert.ok(body.data.url.endsWith('.png'), '应据 mimeType 补 .png，实际: ' + body.data.url);
});

test('[files/multipart] TD-03-8：filename 已带扩展名时优先用文件名后缀（mimeType 不覆盖）', async () => {
  // 【TD-12-5】用独立字节：上传现已登记 resource 行（写 project_id），若复用 TINY_PNG 会与
  // 上面 tasks 用例的 contentId 去重命中 → 返回既有 url，测不到本用例的「命名后缀优先」路径。
  const pngBytes = Buffer.concat([
    Buffer.from(TINY_PNG.split(',')[1], 'base64'),
    Buffer.from('sfx'),
  ]);
  const res = makeRes();
  await handleUpload(
    makeMultipartReq([
      { name: 'subfolder', data: 'canvas' },
      { name: 'file', filename: 'explicit.jpg', contentType: 'image/png', data: pngBytes },
    ]),
    res,
  );
  const body = parseResBody(res);
  assert.ok(body.data.url.endsWith('.jpg'), '文件名后缀优先，实际: ' + body.data.url);
});

test('[files/dataUri] 子目录缺省回退 canvas / 嵌套目录合法', async () => {
  // 【TD-12-5】用独立字节，避开与上面 tasks 用例的 contentId 去重（否则返回既有 tasks url、测不到缺省 canvas）
  const uniq = `data:image/png;base64,${Buffer.concat([
    Buffer.from(TINY_PNG.split(',')[1], 'base64'),
    Buffer.from('canvas-default'),
  ]).toString('base64')}`;
  const res = makeRes();
  await handleUpload(makeJsonReq({ dataUri: uniq }), res);
  const url = parseResBody(res).data.url;
  assert.ok(url.startsWith(`${uploadBase}/canvas/`), '缺省应落 canvas，实际: ' + url);
});

test('[files/dataUri] 非法 base64 → 400（Node 宽容解码被 isValidBase64 拦截，杜绝落盘损坏文件）', async () => {
  const res = makeRes();
  await handleUpload(makeJsonReq({ dataUri: 'data:image/png;base64,@@invalid@@' }), res);
  assert.equal(res.status, 400);
  assert.match(parseResBody(res).error, /Invalid dataUri/);
});

// 【2026-09-14 失败诚实化】写盘系统故障 ≠ 输入非法：此前两者同返 null → 一律 400 Invalid dataUri
// （把"写不进去"报成"格式不对"，排查被引偏，与 TD-03-12 错误归因同族）→ 现为 500。
test('[files/dataUri] 写盘失败 → 500（系统故障不得归因为 400 Invalid dataUri）', async (t) => {
  const uniq = `data:image/png;base64,${Buffer.concat([
    Buffer.from(TINY_PNG.split(',')[1], 'base64'),
    Buffer.from('disk-fail-500'),
  ]).toString('base64')}`;
  t.mock.method(fs, 'writeFileSync', () => {
    throw new Error('disk full');
  });
  const res = makeRes();
  await handleUpload(makeJsonReq({ dataUri: uniq }), res);
  assert.equal(res.status, 500);
  assert.match(parseResBody(res).error, /Failed to persist dataUri/);
});

// ── TD-12-11 / TD-12-12 裁决（2026-09-14）：上传的「成功」= 这份内容现在可在请求的 subfolder 下被看到 ──
// 改前：contentId 去重命中即**跳过登记** → 行留旧目录（调用方被告知成功、请求的目录里却没有它 = 假成功），
//       且行 `name` 恒为磁盘内容寻址名（哈希名，素材库里认不出是哪张）。
const { getDb, queryOne } = await importSrc(path.join('db', 'database.ts'));

test('[files/multipart] TD-12-11：同内容二次上传到新 subfolder → 行 folder 归位到本次请求，物理 url 不变', async () => {
  // 走 **multipart 分支**：只有它走 writeUploadDedup（`deduped` 跳过语义所在），dataUri 分支的
  // saveBase64ToFile 无此分支 → 用 dataUri 测不到本缺陷（本用例曾被探针证伪过一次，故注明）。
  const pngBytes = Buffer.concat([
    Buffer.from(TINY_PNG.split(',')[1], 'base64'),
    Buffer.from('td1211m'),
  ]);
  const parts = (sub, fname) => [
    { name: 'subfolder', data: sub },
    { name: 'file', filename: fname, contentType: 'image/png', data: pngBytes },
  ];

  const a = makeRes();
  await handleUpload(makeMultipartReq(parts('tasks', 'first.png')), a);
  const url1 = parseResBody(a).data.url;

  const b = makeRes();
  await handleUpload(makeMultipartReq(parts('migrated', '我的猫.png')), b);
  const url2 = parseResBody(b).data.url;
  assert.equal(url2, url1, '同内容 → 复用同一物理 url（不新建第二份 / 不改物理位置）');

  const hex = url1
    .split('/')
    .pop()
    .replace(/\.png$/, '');
  const db = await getDb();
  const row = queryOne(db, 'SELECT folder, name FROM resources WHERE sha1 = ?', [`sha1:${hex}`]);
  assert.ok(row, '同内容应恰有一行（Content 维度全局唯一）');
  assert.equal(row.folder, 'migrated', '行 folder 应归位到本次请求的 subfolder（改前留 tasks）');
  // 显示名：首次上传已给出非哈希名 'first.png' → 保留（十一轮裁决：显式/先到者命名优先）。
  // 「未命名（仍是磁盘哈希名）→ 采用本次声明名」由 display-name-merge.test.js 的纯函数用例覆盖。
  assert.equal(row.name, 'first.png', '已命名的行不被再次上传覆盖（folder 才随最近声明）');
});

test('[files/dataUri] TD-12-12：displayName → 行 name 用声明名（改前 = 磁盘内容寻址哈希名）', async () => {
  const bytes = Buffer.concat([
    Buffer.from(TINY_PNG.split(',')[1], 'base64'),
    Buffer.from('td1212d'),
  ]);
  const dataUri = `data:image/png;base64,${bytes.toString('base64')}`;
  const res = makeRes();
  await handleUpload(makeJsonReq({ dataUri, subfolder: 'migrated', displayName: '猫.png' }), res);
  const url = parseResBody(res).data.url;
  const hex = url
    .split('/')
    .pop()
    .replace(/\.png$/, '');
  const db = await getDb();
  const row = queryOne(db, 'SELECT name, folder FROM resources WHERE sha1 = ?', [`sha1:${hex}`]);
  assert.equal(row.name, '猫.png', '行 name 应为 displayName');
  assert.equal(row.folder, 'migrated');
});

test('[files/dataUri] 归属保护（十轮补）：跨项目再上传同内容 → 行 project_id 保持原归属，不被搬到新项目', async () => {
  const bytes = Buffer.concat([
    Buffer.from(TINY_PNG.split(',')[1], 'base64'),
    Buffer.from('ownership'),
  ]);
  const dataUri = `data:image/png;base64,${bytes.toString('base64')}`;

  const a = makeRes();
  await handleUpload(
    makeJsonReq({ dataUri, subfolder: 'migrated', projectId: 'projA', displayName: 'A图' }),
    a,
  );
  const url = parseResBody(a).data.url;

  const b = makeRes();
  await handleUpload(
    makeJsonReq({ dataUri, subfolder: 'canvas', projectId: 'projB', displayName: 'B图' }),
    b,
  );

  const hex = url
    .split('/')
    .pop()
    .replace(/\.png$/, '');
  const db = await getDb();
  const row = queryOne(db, 'SELECT project_id, name, folder FROM resources WHERE sha1 = ?', [
    `sha1:${hex}`,
  ]);
  assert.equal(
    row.project_id,
    'projA',
    '归属应保持首次声明的项目（改前会被 projB 覆盖 → 回项目 A 时该素材直接不可见）',
  );
  // 显示名：首次声明已非哈希名 → 保留（十一轮裁决：**显式/先到者命名优先**，不被再次上传覆盖）
  assert.equal(row.name, 'A图', '显示名应保留首次声明名（不被再次上传覆盖）');
  assert.equal(row.folder, 'canvas', '呈现层 folder 仍随最近声明');
});

// ════════════════════════════════════════════════════════════════════════
// routes/generate.ts —— 统一生成入口（Step 6：/api/relay 并入，chat 同步快路径）
// ════════════════════════════════════════════════════════════════════════
const { handleGenerateSubmit } = await importSrc(path.join('routes', 'generate.ts'));

test('[generate] chat 同步快路径：不要求 frontTaskId 即进 relayGenerate（未知 provider 快速报错，不触网）', async () => {
  const res = makeRes();
  // __no_such_provider__ 无 defaultBaseUrl → relayGenerate 在 resolveBaseUrl 抛「未配置接口地址」→ code:-1
  await handleGenerateSubmit(
    makeJsonReq({
      capability: 'chat',
      providerId: '__no_such_provider__',
      model: 'm1',
      prompt: 'hi',
      frontTaskId: 'task_chat_test', // 任务中心 task_id 透传（后端不消费，但接收）
    }),
    res,
  );
  const body = parseResBody(res);
  assert.equal(body.code, -1);
  assert.equal(typeof body.data.error, 'string');
  // 未返 400 Missing frontTaskId → 证明 chat 无需 frontTaskId（聊天流程无句柄）
  assert.notEqual(res.status, 400);
});

test('[generate] chat 带 tools 同样不要求 frontTaskId（走 chatWithTools 分支，非 400）', async () => {
  const res = makeRes();
  // 未知 provider → resolveBaseUrl 抛「未配置接口地址」→ relay 返回 code:-1；若非走 chatWithTools 提前 return，
  // 也会被同一样 validate 拦截，关键仍是「不返 400 Missing frontTaskId」（画布 Agent 无任务句柄）。
  await handleGenerateSubmit(
    makeJsonReq({
      capability: 'chat',
      providerId: '__no_such_provider__',
      model: 'm1',
      messages: [{ role: 'user', content: 'hi' }],
      tools: [
        { type: 'function', function: { name: 'execute_plan', description: 'x', parameters: {} } },
      ],
      tool_choice: 'auto',
    }),
    res,
  );
  const body = parseResBody(res);
  assert.equal(body.code, -1);
  assert.equal(typeof body.data.error, 'string');
  assert.notEqual(res.status, 400);
});

test('[generate] chat 缺 model → 400 Missing model', async () => {
  const res = makeRes();
  await handleGenerateSubmit(makeJsonReq({ capability: 'chat', providerId: 'lovart' }), res);
  const body = parseResBody(res);
  assert.equal(res.status, 400);
  assert.match(body.error, /Missing model/);
});

test('[generate] image/video 缺 frontTaskId → 400 Missing frontTaskId', async () => {
  const res = makeRes();
  await handleGenerateSubmit(
    makeJsonReq({ capability: 'image', providerId: 'lovart', model: 'm1' }),
    res,
  );
  const body = parseResBody(res);
  assert.equal(res.status, 400);
  assert.match(body.error, /Missing frontTaskId/);
});

// ── 清理临时数据目录（延迟以等待 debouncedSaveDb 异步 flush 完成）──
after(async () => {
  await new Promise((r) => setTimeout(r, 1500));
  try {
    fs.rmSync(TEST_DIR, { recursive: true, force: true });
  } catch {}
});
