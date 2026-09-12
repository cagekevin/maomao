/**
 * fileStore.ts 内容寻址命名与跨目录去重纯函数单测（node --test / ESM）
 * ------------------------------------------------------------
 * 运行：cd localTool && npm test
 * 覆盖（锁 docs/122 文件管理收口 #1/#6 · A′ 语义）：
 *   - contentHashName：sha1(content).ext 单一物理命名的规范（ext 去点/小写/无后缀回退）
 *   - findDedupUrl：按 resources.sha1 列去重判定（与 folder 无关，改名仍存活，命中复用 / 未命中 null）
 *   - writeUploadDedup：按 sha1 列查重 → 命中复用 url（不写盘）；未命中以 sha1 命名落盘并回传 sha1
 * 纯函数，无 I/O（仅动态 import fileStore.ts，其顶层无 DB 副作用）。
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(__dirname, '..', 'src');
const { contentHashName, contentIdOf, findDedupUrl, writeUploadDedup } = await import(
  pathToFileURL(path.join(SRC, 'utils', 'fileStore.ts')).href
);

// ── T-A1 · contentHashName：物理命名单一规范 ──
test('contentHashName：带扩展名 → sha1.png（ext 去点）', () => {
  assert.equal(contentHashName('a1b2c3', 'png'), 'a1b2c3.png');
  assert.equal(contentHashName('a1b2c3', '.png'), 'a1b2c3.png');
});

test('contentHashName：大写扩展名归一为小写（保持单一规范）', () => {
  assert.equal(contentHashName('abc', 'PNG'), 'abc.png');
});

test('contentHashName：无扩展名 → 只返回哈希（无后缀语义）', () => {
  assert.equal(contentHashName('a1b2'), 'a1b2');
  assert.equal(contentHashName('a1b2', ''), 'a1b2');
});

// ── contentIdOf：<alg>:<hex> 组成 Content 维度身份 ──
test('contentIdOf：带算法前缀（sha1:<hex>，可演进）', () => {
  assert.equal(
    contentIdOf('aaf4c61ddcc5e8a2dabede0f3b482cd9aea9434d'),
    'sha1:aaf4c61ddcc5e8a2dabede0f3b482cd9aea9434d',
  );
});

// ── T-A2 · findDedupUrl：按 contentId 去重判定（docs/122 Content 维度，folder 无关） ──
test('findDedupUrl：contentId 命中（folder=web 已有该 contentId，当前 canvas/drop）→ 复用既有 url', () => {
  const files = [{ url: 'http://127.0.0.1:18080/files/web/a1b2.png', sha1: 'sha1:a1b2' }];
  const hit = findDedupUrl(files, 'sha1:a1b2');
  assert.deepEqual(hit, { url: 'http://127.0.0.1:18080/files/web/a1b2.png' });
});

test('findDedupUrl：任意目录都无该 contentId → null（需新建）', () => {
  assert.equal(findDedupUrl([], 'sha1:a1b2'), null);
  const files = [{ url: '/files/web/other.png', sha1: 'sha1:other' }];
  assert.equal(findDedupUrl(files, 'sha1:a1b2'), null);
});

test('findDedupUrl：命中只看 contentId（folder 无关、改名仍存活），无论目录如何都复用', () => {
  // 同一 Content 已被多个目录/项目引用，都指向同一 contentId → 不因 folder/name 分歧而重复
  const files = [
    { url: '/files/migrated/9f9f.png', sha1: 'sha1:9f9f' },
    { url: '/files/tasks/9f9f.png', sha1: 'sha1:9f9f' },
  ];
  assert.deepEqual(findDedupUrl(files, 'sha1:9f9f'), { url: '/files/migrated/9f9f.png' });
});

test('findDedupUrl：缺 contentId（null/空）不参与匹配', () => {
  const files = [{ url: '/files/web/x.png', sha1: undefined }];
  assert.equal(findDedupUrl(files, 'sha1:a1b2'), null);
});

test('findDedupUrl：空列表 / 未传数组 → null（防崩）', () => {
  assert.equal(findDedupUrl(undefined, 'sha1:a1b2'), null);
  assert.equal(findDedupUrl(null, 'sha1:a1b2'), null);
});

// ── writeUploadDedup：按 contentId 查重 → 命中复用 url（不写盘），并回传 contentId ──
test('writeUploadDedup：contentId 命中 → 复用既有 url，deduped:true、不写盘', async () => {
  const data = Buffer.from('hello');
  const sha1Hello = 'aaf4c61ddcc5e8a2dabede0f3b482cd9aea9434d';
  const contentIdHello = contentIdOf(sha1Hello);
  const r = await writeUploadDedup({
    subfolder: 'canvas/drop',
    ext: 'png',
    data,
    existingUrlByContentId: (cid) => (cid === contentIdHello ? '/files/migrated/x.png' : null),
  });
  assert.equal(r.deduped, true);
  assert.equal(r.savedPath, null);
  assert.equal(r.urlPath, '/files/migrated/x.png');
  // 回传的 contentId = `<alg>:<hex>` 去重身份
  assert.equal(r.contentId, contentIdHello);
});
