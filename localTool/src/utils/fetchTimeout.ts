/**
 * 带超时的 fetch 薄封装（唯一真相）。
 *
 * 2026-09-04 收口 fetch-timeout-seam（见 Temp/deepening-fetch-timeout-seam-20260904-2205.md）：
 * 原先 official / passthrough / system 三路由各自 hand-roll
 * `AbortController + setTimeout(abort) + clearTimeout + catch 分类` 样板（三份逐字同构），
 * 且依赖 `err.name === 'AbortError'` 判定 504。此处封住这套样板，作为单一真相源。
 *
 * ⚠️ 关键约束（行为等价保证）：abort 用无 reason 的 `controller.abort()`，**抛真实 AbortError**，
 * 令调用方既有的 `err.name === 'AbortError' -> 504` 分类逐字不变。
 * 绝不在此改用 RelayHttpError（ai-relay 的 withTimeout/corsSafeFetch 抛 RelayHttpError，
 * 若复用会把 504 误判成 502——本文件特意独立实现，避免这场回归）。
 *
 * ⚠️ 职责边界：本封装**只管超时**，**不含**代理回退（代理归 utils/netProxy.fetchWithProxy）。
 * 两者 additive：需要代理时以 fetchWithProxy 作 fetchImpl 注入，或调方自行决定。
 *
 * 行为等价于：
 *   const c = new AbortController(); const t = setTimeout(() => c.abort(), ms);
 *   try { return await fetch(url, { ...init, signal: c.signal }); } finally { clearTimeout(t); }
 */
export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  // ⚠️ 必须 await 才能让 finally 推迟到 fetch 结束后再 clearTimeout：
  // 本函数若非 async（不 await），非 async 函数的 finally 会同步立即执行，
  // 直接把超时定时器清掉 → 超时永不触发（2026-09-04 实测踩中）。
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}