/**
 * 声音库端点（`GET /api/sounds/library`）单测 —— 剪辑器「音效 / 音乐」的**自建**数据源。
 *
 * 覆盖（指向 src/routes/sounds.ts）：
 *   · 空目录 → 空清单 + `dir`（**空库是合法状态，不是错误**；前端凭 `dir` 给"放哪儿"的引导）；
 *   · 放入音频 → 出现在清单，`url` 指向 /files/、`name` 去扩展名、`kind` 由目录决定；
 *   · 非音频（png/txt）被过滤、子目录被忽略（只收文件）；
 *   · 两个分类互不串（effects 不返回 music 的文件）；
 *   · id 稳定（同一文件两次请求同 id —— 收藏存档要用它做键）。
 *
 * 运行：cd localTool && npm test（= tsc && node --test test/*.test.js）
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

// 隔离数据目录（必须在 import 业务模块前设置，避免污染 ~/.maomao-localtool）
const TEST_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'maomao-sounds-'));
process.env.MAOMAO_DATA_DIR = TEST_DIR;

const { handleSoundsLibrary } = await importSrc(path.join('routes', 'sounds.ts'));
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

async function callLibrary(kind) {
  const res = makeRes();
  await handleSoundsLibrary({}, res, new URL(`http://127.0.0.1/api/sounds/library?kind=${kind}`));
  return JSON.parse(res.body);
}

function writeSound(rel, content = 'binary-ish') {
  const full = path.join(uploadDir, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content);
}

beforeEach(() => {
  fs.rmSync(path.join(uploadDir, 'sounds'), { recursive: true, force: true });
});

after(() => {
  fs.rmSync(TEST_DIR, { recursive: true, force: true });
});

test('[sounds] 空目录 → 空清单 + dir（空库是合法状态，不是错误）', async () => {
  const body = await callLibrary('effect');

  assert.equal(body.code, 0);
  assert.equal(body.data.kind, 'effect');
  // dir 是后端给的真源：前端据此告诉用户"把文件放哪儿"，不自己拼路径。
  assert.equal(body.data.dir, 'sounds/effects');
  assert.deepEqual(body.data.items, []);
});

test('[sounds] 放入音频 → 出现在清单；url 指向 /files/；name 去扩展名', async () => {
  writeSound('sounds/effects/whoosh.mp3');
  writeSound('sounds/effects/叮.wav');

  const body = await callLibrary('effect');

  assert.equal(body.data.items.length, 2);
  const item = body.data.items.find((i) => i.name === '叮');
  assert.ok(item, '中文名文件应出现（name 为去扩展名的文件名）');
  assert.equal(item.kind, 'effect');
  assert.equal(item.ext, 'wav');
  assert.ok(
    item.url.startsWith('/files/sounds/effects/'),
    'url 必须指向 /files/ 供 <audio> 直接播放',
  );
  assert.ok(Number.isInteger(item.id), 'id 必须是整数（前端 SoundEffect.id 是 number）');
});

test('[sounds] 非音频被过滤、子目录被忽略（只收文件）', async () => {
  writeSound('sounds/effects/cover.png');
  writeSound('sounds/effects/readme.txt');
  fs.mkdirSync(path.join(uploadDir, 'sounds/effects/nested'), { recursive: true });

  const body = await callLibrary('effect');

  assert.deepEqual(body.data.items, []);
});

test('[sounds] 两个分类互不串（effects / music 各自目录）', async () => {
  writeSound('sounds/effects/a.wav');
  writeSound('sounds/music/b.mp3');

  const effects = await callLibrary('effect');
  const music = await callLibrary('music');

  assert.deepEqual(
    effects.data.items.map((i) => i.name),
    ['a'],
  );
  assert.deepEqual(
    music.data.items.map((i) => i.name),
    ['b'],
  );
  assert.equal(music.data.dir, 'sounds/music');
});

test('[sounds] id 稳定：同一文件两次请求同 id（收藏存档靠它做键）', async () => {
  writeSound('sounds/effects/stable.wav');

  const first = await callLibrary('effect');
  const second = await callLibrary('effect');

  assert.equal(first.data.items[0].id, second.data.items[0].id);
});
