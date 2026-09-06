/**
 * 带超时 fetch 薄封装 fetchTimeout.ts 单测（node --test / ESM）
 * ------------------------------------------------------------
 * 运行：cd localTool && npm test
 * 覆盖（锁 fetch-timeout-seam 收口的语义红线）：
 *   - 正常请求：不触发超时，返回响应；
 *   - 超时：**抛真实 AbortError**（err.name === 'AbortError'），
 *     保证调用方既有 `err.name==='AbortError' -> 504` 分类逐字不变（不静默改错 502）。
 * 纯函数 + 全局 fetch 替换，无 I/O、无真实网络；用 pending fetch 逼真实 timeout，无残留计时器。
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(__dirname, '..', 'src');
const { fetchWithTimeout } = await import(
  pathToFileURL(path.join(SRC, 'utils', 'fetchTimeout.ts')).href
);

/** 正常 fetch：响应 init.signal 触发 abort → 抛真实 AbortError；未 abort 按 resolveMs 后 resolve。 */
function controllableFetch(resolveMs) {
  return (url, init) =>
    new Promise((resolve, reject) => {
      const onAbort = () => reject(new DOMException('The operation was aborted', 'AbortError'));
      if (init?.signal) {
        if (init.signal.aborted) onAbort();
        else init.signal.addEventListener('abort', onAbort, { once: true });
      }
      if (resolveMs >= 0) setTimeout(() => resolve(new Response('ok')), resolveMs);
    });
}

test('fetchWithTimeout：正常返回时触发超时', async () => {
  const orig = globalThis.fetch;
  globalThis.fetch = controllableFetch(5);
  try {
    const r = await fetchWithTimeout('http://x.test', {}, 200);
    assert.equal(await r.text(), 'ok');
  } finally {
    globalThis.fetch = orig;
  }
});

test('fetchWithTimeout：超时抛真实 AbortError（保 504 分类）', async () => {
  const orig = globalThis.fetch;
  globalThis.fetch = controllableFetch(-1); // pending，逼内部超时 abort
  try {
    await assert.rejects(
      fetchWithTimeout('http://x.test', {}, 20),
      (err) => err.name === 'AbortError',
      '超时应抛 AbortError 而非 RelayHttpError，保证 504 分类不变',
    );
  } finally {
    globalThis.fetch = orig;
  }
});
