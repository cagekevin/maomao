/**
 * docs/spa-detect — 判断文档首屏是不是需要动态渲染的空壳 SPA。
 *
 * 原样取自 AI-Canvas-tauri 的 `src/services/webPageService.ts`。
 * Fumadocs / Docusaurus 这类文档站首屏只有一个挂载根节点，静态 HTML 里没有正文；
 * 这种情况要交给宿主渲染一次才能拿到真实字段名。
 */

const MIN_STATIC_PAGE_TEXT = 800;
const SPA_ROOT_PATTERN = /<(?:div|main|section)\b[^>]*(?:\bid=["'](?:root|app|__next|__nuxt|svelte)["']|\bdata-reactroot\b)[^>]*>/i;
// SPA 入口通常由构建工具产出带 hash 的 JS 文件（例如 /static/js/index.55998905b6.js），
// 这些脚本不一定是 type="module"，src 也可能不是 .mjs/_next/_nuxt，但同样依赖客户端渲染。
const SPA_BOOTSTRAP_PATTERN = /<script\b[^>]*\bsrc=["'][^"']+\.js(?:\?[^"']*)?["'][^>]*>/i;

export function shouldRenderDynamicHtml(
  body: string,
  contentType: string,
  extractedText: string,
): boolean {
  if (!contentType.includes('html')) return false;
  if (extractedText.trim().length >= MIN_STATIC_PAGE_TEXT) return false;
  return SPA_ROOT_PATTERN.test(body) && SPA_BOOTSTRAP_PATTERN.test(body);
}
