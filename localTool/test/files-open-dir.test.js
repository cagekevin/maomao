/**
 * `/api/files/open-dir` 的**越根守卫**单测（TD-11-43）。
 *
 * 【为什么单独一个文件】`getUploadDir()` 在模块内缓存，必须在 import 业务模块**之前**把
 * `MAOMAO_DATA_DIR` 指向临时目录（与 `skills.test.js` 同一手法）。
 *
 * 【本端点此前的问题（TD-11-43）】它直接 `path.join(uploadDir, filepath)`：`filepath=/files/../../..`
 * 会把**任意目录**交给 `open`（`path.join` 会乖乖上跳），且紧随的 `existsSync` 让本端点顺带成了
 * **存在性探针** —— 任意路径存不存在，一个 200/404 就答了。现在统一过 `resolveUploadFile`（与
 * `handleList` 同一原语）：越根/非法段 ⇒ 400。
 *
 * 【只测守卫路径】成功路径会真的拉起访达 / 资源管理器（与 `skills.test.js` 的 open-dir 同约定）——
 * 所以这里只断 400 / 404，绝不走到 `execFileSync`。
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

// 隔离数据目录（必须在 import 业务模块前设置，避免污染 ~/.maomao-localtool）
const TEST_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'maomao-open-dir-'));
process.env.MAOMAO_DATA_DIR = TEST_DIR;

const { handleOpenDir } = await importSrc(path.join('routes', 'files.ts'));
const { getUploadDir } = await importSrc(path.join('db', 'database.ts'));

const uploadDir = getUploadDir();

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
      if (data !== undefined) r.body = (r.body || '') + String(data);
      return r;
    },
  };
  return r;
}

/** 调 handler 并返回 `{ status, json }`（`filepath` 原样拼进 query，由 `URL` 解码） */
async function openDir(filepath) {
  const res = makeRes();
  await handleOpenDir(
    { on() {} },
    res,
    new URL(`/api/files/open-dir?filepath=${filepath}`, 'http://127.0.0.1:18080'),
  );
  return { status: res.status, json: res.body ? JSON.parse(res.body) : null };
}

after(() => {
  fs.rmSync(TEST_DIR, { recursive: true, force: true });
});

test('[files] open-dir 越根 → 400（在拉起访达之前就拒）', async () => {
  const cases = [
    '/files/../../etc', // 上跳两层：此前 `path.join` 会真的跳出 uploads
    '/files/..%2F..%2Fetc', // URL 编码形态（解码后同上）
    '..%2Fetc', // 不带 /files/ 前缀的同一攻击
    'canvas/%2E%2E/%2E%2E/x', // 中间的 `..` 段
    '.', // `.` 段
  ];
  for (const c of cases) {
    const r = await openDir(c);
    assert.equal(r.status, 400, `${c} 应被拒（越根/非法段）`);
  }
});

test('[files] 规范化（不是放行）：重复斜杠 / 前导斜杠都归到 uploads 内，越不过去', async () => {
  // `resolveUploadFile` 先把 `//` 压成 `/`、去掉首尾 `/`，**再**判越根 ⇒
  // `/etc/passwd` 被当作**相对** `etc/passwd` 落在 uploads 里（fail-safe：越不出去），
  // 不是"绝对路径被放行"。两条都因此走到 404（合法但不存在），不是 400。
  // （若哪天要改成"一律拒"，那是**改口径**：得先在原语处改，不许本端点自己加第二份判据。）
  assert.equal((await openDir('canvas//x')).status, 404);
  assert.equal((await openDir('/etc/passwd')).status, 404);
  assert.ok(!fs.existsSync(path.join(uploadDir, '..', 'etc', 'passwd')), '不得在 uploads 之外解析');
});

test('[files] open-dir 不泄露"uploads 之外某路径存不存在"（存在与不存在都 400）', async () => {
  // uploads 的上一级（TEST_DIR）**确实存在**，uploads 下同名的不存在的路径也不该被区分对待
  const existsOutside = await openDir('/files/..');
  const missingOutside = await openDir('/files/../不存在的目录-x');

  assert.equal(existsOutside.status, 400);
  assert.equal(missingOutside.status, 400); // 若这里能拿到 404/200 之别 ⇒ 就是存在性探针
});

test('[files] open-dir 合法但不存在的路径仍是 404（守卫只拦越根，不把一切拒掉）', async () => {
  fs.mkdirSync(uploadDir, { recursive: true });
  const r = await openDir('canvas/不存在的目录-x');

  assert.equal(r.status, 404);
  assert.ok(r.json.error.includes('not found')); // `sendError` 的形状：`{ error: <message> }`
});
