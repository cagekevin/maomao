/**
 * 转发层共享头助手 relayHeaders.ts 单测（node --test / ESM）
 * ------------------------------------------------------------
 * 运行：cd localTool && npm test（tsc && node --test test/*.test.js）
 * 覆盖（锁 relay-header-helpers-seam 收口 + official 漏剥修复）：
 *   - maskToken：Bearer 脱敏前 4 位 / 空值 / 短 token / 非 Bearer
 *   - logTs：格式 'YYYY-MM-DD HH:mm:ss'
 *   - stripHopByHop：hop-by-hop 全集（含 proxy 认证、te、trailer、upgrade）被剥；
 *     dir='back' 额外剥 content-encoding；dir='forward' 保留 content-encoding。
 * 纯函数，无 I/O，无需数据目录隔离。
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(__dirname, '..', 'src');
const { maskToken, logTs, stripHopByHop } = await import(
  pathToFileURL(path.join(SRC, 'utils', 'relayHeaders.ts')).href
);

const headers = (entries) => new Headers(entries);

test('maskToken：Bearer 脱敏前 4 位', () => {
  assert.equal(maskToken('Bearer abcdef123456'), 'abcd');
  assert.equal(maskToken(undefined), 'none');
  assert.equal(maskToken(''), 'none');
  assert.equal(maskToken('abc'), 'abc'); // 不足 4 位原样
  assert.equal(maskToken('Token XYZWq'), 'Toke'); // 非 Bearer 前缀剥不到，仍取前 4 位
});

test('logTs：格式 YYYY-MM-DD HH:mm:ss', () => {
  const s = logTs();
  assert.match(s, /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
});

test('stripHopByHop(back)：hop-by-hop 全集被剥（含 proxy-*/te/trailer/upgrade，锁 official 漏剥修复）', () => {
  const h = headers([
    ['content-type', 'application/json'],
    ['transfer-encoding', 'chunked'],
    ['connection', 'keep-alive'],
    ['keep-alive', 'timeout=5'],
    ['proxy-authenticate', 'Basic'],
    ['proxy-authorization', 'secret'],
    ['te', 'trailers'],
    ['trailer', 'x-ts'],
    ['upgrade', 'websocket'],
    ['content-length', '123'],
    ['host', 'upstream.example'],
    ['content-encoding', 'gzip'], // back 方向额外剥
  ]);
  const out = stripHopByHop(h, 'back');
  assert.deepEqual(Object.keys(out), ['content-type']);
  assert.equal(out['content-type'], 'application/json');
});

test('stripHopByHop(forward)：保留 content-encoding，仅剥 hop-by-hop', () => {
  const h = headers([
    ['content-type', 'application/json'],
    ['authorization', 'Bearer abc'],
    ['content-encoding', 'gzip'],
    ['connection', 'keep-alive'],
    ['proxy-authorization', 'secret'],
    ['upgrade', 'websocket'],
  ]);
  const out = stripHopByHop(h, 'forward');
  assert.deepEqual(Object.keys(out).sort(), ['authorization', 'content-encoding', 'content-type']);
});
