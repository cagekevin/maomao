/**
 * 本地基址唯一真相 localToolBaseUrl.ts 单测（node --test / ESM）
 * ------------------------------------------------------------
 * 运行：cd localTool && npm test
 * 覆盖（锁 localtool-baseurl-seam 收口的语义红线）：
 *   - 默认无 PORT → http://127.0.0.1:18080（与字符串契约一致）
 *   - 自定义 PORT → 用自定义端口（此前 resources.ts 硬编码 18080 的问题根除点）
 * 纯函数，无 I/O。
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(__dirname, '..', 'src');
const { localToolBaseUrl } = await import(
  pathToFileURL(path.join(SRC, 'utils', 'localToolBaseUrl.ts')).href
);

function withPort(port, fn) {
  const prev = process.env.PORT;
  delete process.env.PORT;
  if (port !== undefined) process.env.PORT = String(port);
  try {
    return fn();
  } finally {
    if (prev === undefined) delete process.env.PORT;
    else process.env.PORT = prev;
  }
}

test('localToolBaseUrl：无 PORT → 默认 18080', () => {
  withPort(undefined, () => {
    assert.equal(localToolBaseUrl(), 'http://127.0.0.1:18080');
  });
});

test('localToolBaseUrl：自定义 PORT 生效（根除 resources 硬编码）', () => {
  withPort(19090, () => {
    assert.equal(localToolBaseUrl(), 'http://127.0.0.1:19090');
  });
});