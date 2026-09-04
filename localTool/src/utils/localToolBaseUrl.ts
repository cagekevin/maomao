/**
 * 本地工具服务可访问基址（唯一真相）。
 *
 * 2026-09-04 收口 localtool-baseurl-seam（见 Temp/deepening-localtool-baseurl-seam-20260904.md）：
 * 原先 routes/{files,localPatch,resources}.ts 用 3 种写法表达同一 `http://127.0.0.1:18080`，
 * 其中 resources.ts 硬编码 18080、**忽略 PORT 环境变量** —— 非 18080 端口启动时前端资源 URL
 * 端口错配 → 404 破图。收口后统一读 `process.env.PORT`，本函数是唯一来源。
 *
 * 纯函数，无 I/O；默认仍 18080（与既有字符串契约 `127.0.0.1:18080` 一致，见 CLAUDE.md §五.7）。
 */
export function localToolBaseUrl(): string {
  const port = Number(process.env.PORT) || 18080;
  return `http://127.0.0.1:${port}`;
}