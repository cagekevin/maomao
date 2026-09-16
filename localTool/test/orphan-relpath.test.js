/**
 * orphanGc.toUploadRelPath — URL→相对路径 口径单测（TD-08-16 收口 · 2026-09-16）
 * ------------------------------------------------------------
 * 运行：cd localTool && npm test
 *
 * 【为什么存在】原实现用正则 `/\/files\/(.+)$/` **不剥 `?`/`#`** —— `…/a.png?token=1`
 * 会被当成磁盘相对路径 `a.png?token=1` → `existsSync` 恒 false → 该引用不计入 referenced
 * → **仍被使用的文件可能被孤儿 GC 误删**。本测试钉死「剥 `?#`」这一安全契约。
 * 纯函数，无 I/O。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(__dirname, '..', 'src');
const { toUploadRelPath } = await import(
  pathToFileURL(path.join(SRC, 'utils', 'orphanGc.ts')).href
);

test('toUploadRelPath：绝对自指 /files/ URL → 相对路径（基准不变）', () => {
  assert.equal(toUploadRelPath('http://127.0.0.1:18080/files/canvas/a.png'), 'canvas/a.png');
  assert.equal(toUploadRelPath('/files/canvas/a.png'), 'canvas/a.png');
});

test('toUploadRelPath：剥查询串/锚点（TD-08-16 核心：否则 existsSync 恒 false → 误删）', () => {
  assert.equal(
    toUploadRelPath('http://127.0.0.1:18080/files/canvas/a.png?token=1'),
    'canvas/a.png',
  );
  assert.equal(toUploadRelPath('http://127.0.0.1:18080/files/canvas/a.png#frag'), 'canvas/a.png');
  assert.equal(
    toUploadRelPath('http://127.0.0.1:18080/files/canvas/a.png?token=1#frag'),
    'canvas/a.png',
  );
});

test('toUploadRelPath：decode 编码文件名（中文/空格）', () => {
  assert.equal(toUploadRelPath('/files/my%20clip.png'), 'my clip.png');
  assert.equal(toUploadRelPath('/files/%E5%A6%B9.png'), '妹.png');
});

test('toUploadRelPath：非 /files/ 形态 → null（远程/data/blob 不参与孤儿判定）', () => {
  assert.equal(toUploadRelPath('https://cdn.example.com/a.png'), null);
  assert.equal(toUploadRelPath('data:image/png;base64,AAAA'), null);
  assert.equal(toUploadRelPath('blob:http://x/y'), null);
  assert.equal(toUploadRelPath(''), null);
  assert.equal(toUploadRelPath(null), null);
  assert.equal(toUploadRelPath(123), null);
});

test('toUploadRelPath：非法转义序列 → 原样返回（保留旧容错：宁可少删盘）', () => {
  // `%E4%B8` 是不完整转义 → decodeURIComponent 抛错。安全方向是「仍计入引用」。
  const out = toUploadRelPath('/files/canvas/%E4%B8.png');
  assert.ok(out !== null, '不得因 decode 失败而丢弃该引用（否则偏向误删）');
  assert.equal(out, 'canvas/%E4%B8.png');
});
