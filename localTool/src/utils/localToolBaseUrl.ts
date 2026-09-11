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

/**
 * 相对 /files/ 路径 → 完整可访问 URL（唯一实现，2026-09-11 收口自 resources.ts /
 * base64Externalize.ts 两份：前者用 localToolBaseUrl() 动态端口、后者硬编码 LOCAL_FILE_BASE
 * 18080 —— 两份语义应一致，统一走本函数读 PORT）。
 * 非 http(s) 开头的相对路径补全；已是完整 URL 则原样返回。
 */
export function toAbsoluteFileUrl(relativePath: string): string {
  if (!relativePath) return relativePath;
  if (/^https?:\/\//i.test(relativePath)) return relativePath;
  return `${localToolBaseUrl()}${relativePath.startsWith('/') ? '' : '/'}${relativePath}`;
}
