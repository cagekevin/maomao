/**
 * base64 落盘的失败语义单测（node --test / ESM）
 * ------------------------------------------------------------
 * 运行：cd localTool && npm test
 * 覆盖（2026-09-14 失败诚实化）：`saveBase64ToFile` 的两类失败**必须分开**：
 *   · 非法输入（非 data URI / base64 不合法）→ 返回 `null`（内容不可用，调用方保留原 base64）
 *   · 写盘系统故障（磁盘满 / 权限 / IO）→ **抛出**（不得与"非法输入"共用 null，
 *     否则 handler 会把它报成 400 Invalid dataUri = 错误归因）
 * DB 隔离：MAOMAO_DATA_DIR 指向 os.tmpdir 下独立目录。
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(__dirname, '..', 'src');

process.env.MAOMAO_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'maomao-b64-'));
const { saveBase64ToFile } = await import(
  pathToFileURL(path.join(SRC, 'utils', 'base64Externalize.ts')).href
);

/** 1x1 透明 PNG（合法 base64） */
const TINY_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

test('非 data URI → null（输入非法，调用方保留原值）', () => {
  assert.equal(saveBase64ToFile('http://x/a.png'), null);
});

test('base64 不合法（含非法字符）→ null（输入非法）', () => {
  assert.equal(saveBase64ToFile('data:image/png;base64,@@invalid@@'), null);
});

test('写盘失败 → 抛出（系统故障不得被压成与非法输入同一个 null）', (t) => {
  // 唯一字节，确保走"真落盘"分支（未被 fs.existsSync 幂等短路）
  const uniq = `data:image/png;base64,${Buffer.concat([
    Buffer.from(TINY_PNG.split(',')[1], 'base64'),
    Buffer.from('write-fail'),
  ]).toString('base64')}`;
  t.mock.method(fs, 'writeFileSync', () => {
    throw new Error('disk full');
  });
  assert.throws(() => saveBase64ToFile(uniq, 'canvas', null), /disk full/);
});

test('正常落盘 → 返回 /files/ URL（绝对）', () => {
  const uniq = `data:image/png;base64,${Buffer.concat([
    Buffer.from(TINY_PNG.split(',')[1], 'base64'),
    Buffer.from('ok-path'),
  ]).toString('base64')}`;
  const url = saveBase64ToFile(uniq, 'canvas', null);
  assert.ok(url && url.includes('/files/canvas/'), `应返回 /files/canvas/ URL，实际: ${url}`);
});
