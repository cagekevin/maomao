/**
 * 通过原生受限读取接口获取 Provider 文档，并提取标题、正文与同源候选链接。
 */
import { normalizeDocUrl } from './safety';
import { shouldRenderDynamicHtml } from './spa-detect';
import {
  buildGroupedModelChoiceList,
  buildRelayCatalogContent,
  parseNewApiPricingPayload,
  parseNewApiStatusPayload,
  type NewApiPricingItem,
  type NewApiStatusInfo,
} from '../stations/new-api';
import {
  readDocWithBridge,
  renderDocWithBridge,
  isDocBridgeReady,
  type NativeDocResponse,
} from './bridge';

export interface ProviderDocLink {
  label: string;
  url: string;
}

export interface ProviderDocsPage {
  title: string;
  url: string;
  text: string;
  links: ProviderDocLink[];
  fetchedAt: number;
  truncated: boolean;
  /** 本页正文总长度（未截断前），用于告诉助手还剩多少没读。 */
  totalTextChars: number;
  /** 续读时应传的下一个 offset；已读完为 undefined。 */
  nextOffset?: number;
  /** 站点公开模型清单按分类分好组的可直接转述文本；非中转站为 undefined。 */
  modelCatalog?: string;
}

/**
 * 按 offset 取一段正文。
 *
 * 单页上限 10k 字，长文档页（参数表 + 多个请求示例）经常超过——以前直接 slice(0, limit)
 * 丢掉后半段，助手既看不到剩下的字段，也没有任何办法把它读回来，只能凭印象编请求体。
 */
export function sliceDocText(text: string, offset: number, limit: number): {
  text: string;
  truncated: boolean;
  totalTextChars: number;
  nextOffset?: number;
} {
  const start = Math.min(Math.max(0, Math.floor(offset)), text.length);
  const slice = text.slice(start, start + limit);
  const end = start + slice.length;
  return {
    text: slice,
    truncated: end < text.length,
    totalTextChars: text.length,
    ...(end < text.length ? { nextOffset: end } : {}),
  };
}

const BLOCK_TAGS = new Set([
  'ADDRESS', 'ARTICLE', 'ASIDE', 'BLOCKQUOTE', 'DD', 'DIV', 'DL', 'DT',
  'FIELDSET', 'FIGCAPTION', 'FIGURE', 'FOOTER', 'FORM', 'H1', 'H2', 'H3',
  'H4', 'H5', 'H6', 'HEADER', 'HR', 'LI', 'MAIN', 'NAV', 'OL', 'P', 'PRE',
  'SECTION', 'TABLE', 'TBODY', 'TD', 'TFOOT', 'TH', 'THEAD', 'TR', 'UL',
]);
const IGNORED_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'SVG', 'CANVAS', 'IFRAME', 'FORM']);
const LINK_HINT_RE = /api|model|endpoint|reference|image|video|audio|chat|模型|接口|图片|视频|音频|对话/i;

function structuredText(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? '';
  if (!(node instanceof Element) || IGNORED_TAGS.has(node.tagName)) return '';
  if (node.tagName === 'BR') return '\n';
  if (node.tagName === 'PRE') return `\n\`\`\`\n${node.textContent ?? ''}\n\`\`\`\n`;
  const content = [...node.childNodes].map(structuredText).join('');
  return BLOCK_TAGS.has(node.tagName) ? `\n${content}\n` : content;
}

function normalizeText(value: string): string {
  return value
    .replace(/\r/g, '')
    .replace(/[\t ]+\n/g, '\n')
    .replace(/\n[\t ]+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Node 环境没有 DOMParser（本模块的 HTML 提取原本只在浏览器 / Tauri 里跑）。
 * 这里做一个降级：拿不到 DOM 时用正则剥离标签，链接也用正则抽。
 * 正文质量不如 DOM 版（拿不到「主内容区」），但保证 JSON 类响应与
 * 简单页面在 Node 下也能走通，方便测试和脚本化使用。
 */
const hasDomParser = (): boolean => typeof DOMParser !== 'undefined';

function extractHtmlPageFallback(body: string, finalUrl: string): {
  title: string;
  text: string;
  links: ProviderDocLink[];
} {
  const title = normalizeText(/<title[^>]*>([\s\S]*?)<\/title>/i.exec(body)?.[1] ?? '')
    || new URL(finalUrl).hostname;
  const text = normalizeText(
    body
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<(pre|code)[^>]*>([\s\S]*?)<\/\1>/gi, '\n```\n$2\n```\n')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|li|tr|h[1-6])>/gi, '\n')
      .replace(/<[^>]+>/g, ''),
  );
  const linksByUrl = new Map<string, ProviderDocLink>();
  for (const match of body.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    let resolved: string;
    try {
      resolved = new URL(match[1], finalUrl).toString();
    } catch {
      continue;
    }
    const normalized = normalizeDocUrl(resolved);
    if (!normalized || normalized.length > 512) continue;
    const label = normalizeText(match[2].replace(/<[^>]+>/g, '')).slice(0, 100)
      || new URL(normalized).pathname;
    if (!linksByUrl.has(normalized)) linksByUrl.set(normalized, { label, url: normalized });
  }
  return {
    title,
    text,
    links: [...linksByUrl.values()]
      .sort((left, right) => Number(LINK_HINT_RE.test(right.label + right.url))
        - Number(LINK_HINT_RE.test(left.label + left.url))),
  };
}

function extractHtmlPage(body: string, finalUrl: string): {
  title: string;
  text: string;
  links: ProviderDocLink[];
} {
  if (!hasDomParser()) return extractHtmlPageFallback(body, finalUrl);
  const parser = new DOMParser();
  const document = parser.parseFromString(body, 'text/html');
  const title = normalizeText(document.querySelector('title')?.textContent ?? '')
    || new URL(finalUrl).hostname;
  const linksByUrl = new Map<string, ProviderDocLink>();
  for (const anchor of document.querySelectorAll<HTMLAnchorElement>('a[href]')) {
    let resolved: string;
    try {
      resolved = new URL(anchor.getAttribute('href') || '', finalUrl).toString();
    } catch {
      continue;
    }
    const normalized = normalizeDocUrl(resolved);
    if (!normalized || normalized.length > 512) continue;
    const label = normalizeText(anchor.textContent ?? '').slice(0, 100) || new URL(normalized).pathname;
    if (!linksByUrl.has(normalized)) linksByUrl.set(normalized, { label, url: normalized });
  }
  const root = document.querySelector('article, main') ?? document.body;
  const text = root ? normalizeText(structuredText(root)) : '';
  const links = [...linksByUrl.values()]
    .sort((left, right) => Number(LINK_HINT_RE.test(right.label + right.url))
      - Number(LINK_HINT_RE.test(left.label + left.url)));
  return { title, text, links };
}

// ---- new-api（New API）中转站识别 ----

/** 探 new-api 的 /api/pricing；不是该类站点返回 null。 */
export async function probeNewApiPricing(
  origin: string,
  signal?: AbortSignal,
): Promise<NewApiPricingItem[] | null> {
  if (signal?.aborted) return null;
  try {
    const response = await readDocWithBridge(`${origin}/api/pricing`);
    if (!response.contentType.startsWith('application/json')) return null;
    return parseNewApiPricingPayload(response.body);
  } catch {
    return null;
  }
}

/** 探 new-api 的 /api/status；不是该类站点返回 null。 */
export async function probeNewApiStatus(
  origin: string,
  signal?: AbortSignal,
): Promise<NewApiStatusInfo | null> {
  if (signal?.aborted) return null;
  try {
    const response = await readDocWithBridge(`${origin}/api/status`);
    if (!response.contentType.startsWith('application/json')) return null;
    return parseNewApiStatusPayload(response.body);
  } catch {
    return null;
  }
}

/** 文档站首页（模型总列表所在页）才值得额外探一次公开清单。 */
function isDocsIndexUrl(rawUrl: string): boolean {
  const path = new URL(rawUrl).pathname.replace(/\/+$/, '');
  return path === '' || path === '/docs' || path === '/api-docs' || path === '/doc';
}
async function readNewApiRelayCatalog(
  rawUrl: string,
  signal?: AbortSignal,
): Promise<ProviderDocsPage | null> {
  const origin = new URL(rawUrl).origin;
  const pricing = await probeNewApiPricing(origin, signal);
  if (!pricing) return null;
  const status = await probeNewApiStatus(origin, signal);
  const content = buildRelayCatalogContent(rawUrl, pricing, status);
  return {
    title: content.title,
    url: rawUrl,
    text: content.text,
    links: [],
    fetchedAt: Date.now(),
    truncated: false,
    totalTextChars: content.text.length,
  };
}

export async function readProviderDocsPage(
  rawUrl: string,
  options: { signal?: AbortSignal; maxTextChars?: number; offset?: number } = {},
): Promise<ProviderDocsPage> {
  const normalized = normalizeDocUrl(rawUrl);
  if (!normalized) throw new Error('厂商文档 URL 未通过本地安全校验');
  if (!isDocBridgeReady()) {
    throw new Error('厂商文档读取需要宿主配置原生桥接（见 createTauriDocBridge）');
  }
  if (options.signal?.aborted) throw new DOMException('请求已取消', 'AbortError');
  let response = await readDocWithBridge(normalized);
  if (options.signal?.aborted) throw new DOMException('请求已取消', 'AbortError');
  let finalUrl = normalizeDocUrl(response.url);
  if (!finalUrl || new URL(finalUrl).origin !== new URL(normalized).origin) {
    throw new Error('厂商文档最终地址未通过同站安全校验');
  }

  let extracted = response.contentType.startsWith('application/json')
    ? { title: new URL(finalUrl).hostname, text: normalizeText(response.body), links: [] }
    : extractHtmlPage(response.body, finalUrl);

  // SPA 文档站先走受控渲染，拿到真实正文与同站链接。
  //
  // 顺序很重要：/api/pricing 兜底是按 origin 探测的，一旦排在渲染之前，同一站点下
  // 任何读不到正文的页面（包括 /docs/videos/{模型ID} 这种单模型文档页）都会被换成
  // 那份只有模型 ID 的清单，助手永远看不到真实字段名，只能自己编请求体。
  if (!extracted.text && shouldRenderDynamicHtml(response.body, response.contentType, extracted.text)) {
    // 渲染是尽力而为：SPA 首屏偶尔会超时，此时应退到下面的公开清单兜底，
    // 而不是让整次文档读取失败（渲染排到兜底之前后，抛错会直接吞掉兜底路径）。
    let rendered: NativeDocResponse | undefined;
    try {
      rendered = await renderDocWithBridge(finalUrl);
    } catch (error) {
      console.warn('[providerDocs] 动态渲染失败，退回公开清单兜底', finalUrl, error);
      rendered = undefined;
    }
    if (options.signal?.aborted) throw new DOMException('请求已取消', 'AbortError');
    const renderedUrl = rendered ? normalizeDocUrl(rendered.url) : null;
    if (rendered && (!renderedUrl || new URL(renderedUrl).origin !== new URL(normalized).origin)) {
      throw new Error('厂商文档渲染后的最终地址未通过同站安全校验');
    }
    if (rendered && renderedUrl) {
      response = rendered;
      finalUrl = renderedUrl;
      extracted = response.contentType.startsWith('application/json')
        ? { title: new URL(finalUrl).hostname, text: normalizeText(response.body), links: [] }
        : extractHtmlPage(response.body, finalUrl);
    }
  }

  // 渲染后仍读不到正文（如需要登录的后台 SPA），最后才退回公开模型清单与公告。
  if (!extracted.text) {
    const relay = await readNewApiRelayCatalog(finalUrl, options.signal);
    if (relay) {
      const limit = Math.max(1, Math.min(options.maxTextChars ?? 10_000, 10_000));
      return { ...relay, ...sliceDocText(relay.text, options.offset ?? 0, limit) };
    }
    throw new Error(
      '厂商文档页面没有可读取的正文；该页面可能是需要登录的后台 SPA，无法匿名读取。'
      + '请改用公开的模型清单/状态接口，或请用户直接提供模型列表与请求示例，不要重复读取同一地址。',
    );
  }
  // 文档首页额外附一份分好类的模型清单：让助手转述现成结构，而不是从长正文里自己归纳
  const pricing = isDocsIndexUrl(finalUrl)
    ? await probeNewApiPricing(new URL(finalUrl).origin, options.signal)
    : null;
  const modelCatalog = pricing ? buildGroupedModelChoiceList(pricing) : '';

  const limit = Math.max(1, Math.min(options.maxTextChars ?? 10_000, 10_000));
  return {
    title: extracted.title,
    url: finalUrl,
    links: extracted.links.slice(0, 24),
    fetchedAt: response.fetchedAt,
    ...sliceDocText(extracted.text, options.offset ?? 0, limit),
    ...(modelCatalog ? { modelCatalog } : {}),
  };
}

