/**
 * 可插拔协议适配器 —— 统一「前端 rawUrl → 真实转发目标」的分派。
 * ------------------------------------------------------------
 * 目标：加一个新平台（如即梦/豆包/ComfyUI/RunningHub）时，
 * 只需在此文件新增一个适配器并注册，不改动 resolveProviderTarget 主体。
 *
 * 每个适配器实现：
 *  - protocol: 协议名（前端协议下拉值）
 *  - resolve({ rawUrl, providerId, baseUrl, providerKey, provider }): ResolvedTarget
 *      把前端传来的 rawUrl（openai://<path> 或完整 url）翻译成真实目标 url + 鉴权头。
 *
 * 扩展点：新增协议 → 实现 adapter 接口 → 加入 adapters 注册表。
 * 对应前端也要有同名 protocol 的下拉选项 + 一个 buildTargetUrl 分支（见 providerProtocols.js）。
 */
import type { ApiProvider } from './providers.js';

/**
 * 协议类型 —— 单一真相（仅在 protocolAdapters.ts 定义并导出，providers.ts 从此 import 复用）。
 * HTTP 远程：openai/apimart/gemini/volcengine/runninghub（走 /api/proxy 转发）
 * CLI 本地：jimeng/codex/gemini-cli（不走 /api/proxy，用本机登录态，见 isProxyProtocol）
 */
export type ProviderProtocol =
  | 'openai' | 'apimart'
  | 'gemini' | 'volcengine' | 'runninghub'
  | 'jimeng' | 'codex' | 'gemini-cli';

/** 协议白名单（唯一事实源）：normalizeProvider 校验 / M1-5 前后端一致比对共用。 */
export const PROVIDER_PROTOCOLS: ProviderProtocol[] = [
  'openai', 'apimart', 'gemini', 'volcengine', 'runninghub', 'jimeng', 'codex', 'gemini-cli',
];

/** CLI 本地类协议集合：不拼 URL、不注入 key、不经过 /api/proxy。 */
export const CLI_PROTOCOLS: ProviderProtocol[] = ['jimeng', 'codex', 'gemini-cli'];

/** 是否走 /api/proxy 转发：CLI 类返回 false（调用方识别后走 CLI 专用通道）。 */
export function isProxyProtocol(protocol: ProviderProtocol): boolean {
  return !CLI_PROTOCOLS.includes(protocol);
}

export interface ResolvedTarget {
  url: string;
  authHeader?: string;   // 注入的 Authorization（Bearer key），openai 协议下注入
  protocol: ProviderProtocol;
  providerId?: string;
}

interface ResolveCtx {
  rawUrl: string;
  providerId: string;
  baseUrl: string;
  providerKey?: string;
  provider: ApiProvider;
}

interface ProviderAdapter {
  protocol: string;
  /** 是否命中该协议：默认 provider.protocol === protocol，可覆盖做嗅探 */
  matches?: (provider: ApiProvider) => boolean;
  resolve: (ctx: ResolveCtx) => ResolvedTarget;
}

/** 前缀吸收：base 已含 /v1|/v2|/v1beta|/api/v3 且 path 同前缀开头 → 去掉 path 前缀，避免 /v1/v1/ */
function joinWithPrefixAbsorb(base: string, path: string): string {
  const b = (base || '').replace(/\/$/, '');
  let p = path.startsWith('/') ? path : '/' + path;
  const prefixMatch = b.match(/((\/v1|\/v2|\/v1beta|\/api\/v3))$/);
  if (prefixMatch) {
    const pre = prefixMatch[2];
    if (p.startsWith(pre + '/') || p === pre) p = p.slice(pre.length) || '/';
  }
  return b + p;
}

// ── 适配器实现 ─────────────────────────────────────────────

/**
 * openai 兼容协议：前端 url 用伪协议 `openai://<path>`（如 openai://images/generations），
 * 此处拼成 `${base_url}/v1/<path>`（前缀吸收），并注入 Bearer key。
 * 若前端传的是完整 http(s) url，则原样透传 + 注入 key。
 */
const openaiAdapter: ProviderAdapter = {
  protocol: 'openai',
  resolve({ rawUrl, providerId, baseUrl, providerKey }) {
    const key = providerKey;
    const m = rawUrl.match(/^openai:\/\/(.+)$/);
    if (!m) {
      // 已是完整 url，直接透传并注入 key
      return { url: rawUrl, authHeader: key ? `Bearer ${key}` : undefined, protocol: 'openai', providerId };
    }
    const sub = m[1].replace(/^\/+/, '');
    const full = joinWithPrefixAbsorb(baseUrl, '/v1/' + sub);
    return { url: full, authHeader: key ? `Bearer ${key}` : undefined, protocol: 'openai', providerId };
  },
};

/**
 * apimart 协议（Lovart 网关 / 异步任务形态）：按 provider.base_url 重拼 + 前缀吸收，
 * 不注入本地 key（apimart 用自身 Bearer key，由前端/网关带）。
 * 前端传来的 rawUrl 形如 {base}/v1/<path>，用 provider.base_url 权威重拼避免 /v1 重复。
 */
const apimartAdapter: ProviderAdapter = {
  protocol: 'apimart',
  resolve({ rawUrl, providerId, baseUrl }) {
    const m = rawUrl.match(/^https?:\/\/[^/]+(.*)$/);
    const subPath = m ? m[1] : rawUrl;
    const full = joinWithPrefixAbsorb(baseUrl, subPath);
    return { url: full, protocol: 'apimart', providerId };
  },
};

/**
 * HTTP 直连类适配器工厂：gemini/volcengine/runninghub。
 * 前端 providerProtocols.js 已把协议前缀（/v1beta /api/v3 /openapi/v2）拼进真实 URL，
 * 此处直接透传 rawUrl + 注入 Bearer key（鉴权头与 openai 同基线；平台细粒度鉴权属平台配置层）。
 */
function httpPassThroughAdapter(protocol: ProviderProtocol): ProviderAdapter {
  return {
    protocol,
    resolve({ rawUrl, providerKey, providerId }) {
      return { url: rawUrl, authHeader: providerKey ? `Bearer ${providerKey}` : undefined, protocol, providerId };
    },
  };
}

/**
 * CLI 类适配器：jimeng/codex/gemini-cli。
 * CLI 平台无 base_url、不走 /api/proxy（调用方用 isProxyProtocol 识别后走 CLI 专用通道）。
 * **不抛错**：返回原始 URL + 协议标记、不注入 key，避免代理链路崩溃。
 */
function cliAdapter(protocol: ProviderProtocol): ProviderAdapter {
  return {
    protocol,
    resolve({ rawUrl, providerId }) {
      return { url: rawUrl, protocol, providerId };
    },
  };
}

// ── 注册表 ─────────────────────────────────────────────────

/** 协议适配器注册表：加新平台 = 新增一个 adapter 并 push 到这里。 */
const adapters: ProviderAdapter[] = [
  openaiAdapter,
  apimartAdapter,
  httpPassThroughAdapter('gemini'),
  httpPassThroughAdapter('volcengine'),
  httpPassThroughAdapter('runninghub'),
  cliAdapter('jimeng'),
  cliAdapter('codex'),
  cliAdapter('gemini-cli'),
];

/** 按 provider 解析出目标。providerId 为空 → 原样透传（兼容无 provider 的调用）。
 *  protocolHint（M3-2）：由调用方按有效协议（effectiveProtocol，含单模型 model_protocols 覆盖）给出时，
 *  优先用它选适配器；未给 → 退化按 provider.protocol 匹配（向后兼容，改前端前 C1 零改动）。
 */
export function resolveProviderTarget(
  rawUrl: string,
  providerId: string | null | undefined,
  getProvider: (id: string) => ApiProvider | undefined,
  readKey: (id: string) => string | undefined,
  protocolHint?: ProviderProtocol,
): ResolvedTarget {
  if (!providerId) {
    return { url: rawUrl, protocol: protocolHint || 'apimart' };
  }
  const p = getProvider(providerId);
  if (!p) {
    return { url: rawUrl, protocol: protocolHint || 'apimart' };
  }
  const key = readKey(p.id);
  // 模型协议覆盖优先；未给 hint → 按 provider.protocol 匹配（保持原有行为）
  const prefer = protocolHint || p.protocol;
  const adapter = adapters.find((a) => (a.matches ? a.matches({ ...p, protocol: prefer }) : prefer === a.protocol));
  if (!adapter) {
    // 未知协议：原样透传，不注入本地 key
    return { url: rawUrl, protocol: prefer, providerId: p.id };
  }
  return adapter.resolve({ rawUrl, providerId: p.id, baseUrl: p.base_url, providerKey: key, provider: p });
}
