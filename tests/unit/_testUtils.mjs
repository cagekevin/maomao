/**
 * 测试公共工具（纯 helper，不依赖 vitest / 被测源码）。
 *
 * 收敛分散在各测试文件里重复手写的 ①JSON 假响应 ②SSE 假响应 ③KV 内存桩，
 * 消除「每文件各自造轮子 → 漏定义 → 误入降级路径」的坑。
 *
 * 用法：
 *   import { jsonResp, sseResp, createKvMem } from './_testUtils.mjs'
 *   fetchMock.mockResolvedValueOnce(jsonResp({ ok: true }))            // 供 res.json()
 *   fetchMock.mockResolvedValueOnce(sseResp(['data: {...}']))          // 供 res.body.getReader() SSE 流
 *   const kv = createKvMem(); // kv.memKV 可 inspect/reset；kv.kvGet/kvSet/kvDelete 塞进 localToolApi 的 vi.mock 工厂
 */

/** JSON 假响应：同时暴露 ok/status、json() 与 text()，避免意外触达真实网络路径。
 *  部分调用方走 res.json()（imageApi/chatApi），部分走 res.text()+JSON.parse（cloudSync callGateway），
 *  两者语义等价（text 即 json 的序列化），故一个工厂通用。 */
export function jsonResp(obj, ok = true, status = 200) {
  return { ok, status, json: async () => obj, text: async () => JSON.stringify(obj) }
}

/**
 * SSE 假响应：把一个 data 行数组编码成可顺序读取的流
 * （fetch mock 需返回带 body.getReader().read() 的响应）。
 */
export function sseResp(lines) {
  let i = 0
  const chunks = lines.map((l) => new TextEncoder().encode(l + '\n'))
  return {
    ok: true,
    body: {
      getReader() {
        return {
          async read() {
            if (i < chunks.length) return { done: false, value: chunks[i++] }
            return { done: true, value: undefined }
          },
          releaseLock() {},
        }
      },
    },
  }
}

/**
 * KV 内存桩：返回供 localToolApi vi.mock 工厂使用的 kvGet/kvSet/kvDelete，
 * 以及共享的 memKV（Map 实例引用，测试可 .clear() / 断言内容）。
 * 让 contentSetAsync→kvSet 先落内存，再被 contentGetAsync→kvGet 读回，
 * 走真实 KV 读写路径，避免「缺 kvGet→写读都降级到本地副本」的误导链。
 */
export function createKvMem() {
  const memKV = new Map()
  return {
    memKV,
    kvGet: async (key) => (memKV.has(key) ? memKV.get(key) : null),
    kvSet: async (key, value) => { memKV.set(key, value); return { ok: true } },
    kvDelete: async (key) => { memKV.delete(key); return { ok: true } },
  }
}