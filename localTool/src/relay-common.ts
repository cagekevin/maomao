/**
 * relay-common —— 接入 kit 门面所需的「本地 glue」（kit 不认识我们的 provider/参考图/落盘）。
 *
 * 【职责边界】只放 kit 门面**不提供、但接 kit 前必须本地做**的三件小事：
 *   1. provider 解析：把 body 的 providerId → 我们 providers.json 里的 { baseUrl, apiKey, 9004协议 }
 *      （kit 不认识我们的 provider 配置）。
 *   2. 参考图归一：把本机 /files/ 参考图内联成 base64（走后端唯一出站口 resolveLocalImages）。
 *   3. kit 门面单例 + 结果落盘 /files/（persistResultUrl，M4 铁律：落盘不依赖 kit）。
 *   不含任何协议拼装/请求/轮询——那些全部交给 kit 门面 relay.generate.* / lowLevel。
 *   不含 body→variables 再拆回的中转（那是多余壳，已删：直接给门面要的 prompt/size/imageUrls）。
 */
import { readProviderKey, getProvider } from './routes/providers.js';
import { resolveLocalImages } from './utils/resolveLocalImages.js';
import { saveRemoteUrl } from './routes/files.js';
import { createRelay } from './relay-engine/relay.js';
import { fetchWithProxy } from './utils/netProxy.js';
import type { Relay } from './relay-engine/relay.js';
import type { NormalizedModelExecutionProtocol } from './relay-engine/4-types/protocol.js';
import { LOVART_IMAGE, LOVART_VIDEO } from './relay-presets.js';

/** 已解析好的「一条生成请求」给 kit 门面/协议需要的全部上下文（无 variables 中转）。 */
export interface RelayContext {
  providerId: string;
  capability: string;
  model: string;
  baseUrl: string;
  apiKey: string;
  /** 该能力对应的 9004 协议（kit 不认识的本地网关协议） */
  protocol: NormalizedModelExecutionProtocol;
  /** 已归一参考图后的 prompt */
  prompt: string;
  /** 像素 size（如 '1024x1024'），无则缺省 */
  size?: string;
  /** 参考图（已归一 base64，9004 协议经 imageUrls 发出） */
  imageUrls?: string[];
}

/** 解析失败 */
export interface RelayContextError {
  error: string;
  providerId: string;
  capability: string;
}

/** 按 providerId + capability 拿 9004 协议数据（纯数据，kit 不内置 9004） */
function protocolFor(capability: string): NormalizedModelExecutionProtocol | undefined {
  if (capability === 'image') return LOVART_IMAGE;
  if (capability === 'video') return LOVART_VIDEO;
  return undefined;
}

/**
 * 由前端意图 body 直接解析成 kit 门面要的上下文。
 * - 参考图：resolveLocalImages 把本机 /files/ 内联成 base64（唯一出站口，禁止另写）。
 * - 只读 body 的 providerId/capability/model/prompt/size/images，不维护任何 variables 映射表。
 */
export async function resolveRelayContext(
  body: Record<string, unknown> | null,
): Promise<RelayContext | RelayContextError> {
  const providerId = typeof body?.providerId === 'string' ? body.providerId : '';
  const capability = typeof body?.capability === 'string' ? body.capability : '';
  const model = typeof body?.model === 'string' ? body.model : '';
  const fail = (error: string): RelayContextError => ({ error, providerId, capability });

  const provider = getProvider(providerId);
  if (!provider) return fail(`Provider not found: ${providerId}`);
  const protocol = protocolFor(capability);
  if (!protocol) return fail(`No protocol for capability=${capability}`);

  const resolved = (await resolveLocalImages(body)) as Record<string, unknown> | null ?? {};
  const imageUrls = Array.isArray(resolved.images)
    ? (resolved.images as unknown[]).filter((v): v is string => typeof v === 'string')
    : undefined;

  return {
    providerId, capability, model,
    baseUrl: provider.base_url,
    apiKey: readProviderKey(providerId),
    protocol,
    prompt: typeof body?.prompt === 'string' ? body.prompt : '',
    ...(typeof resolved.size === 'string' && resolved.size ? { size: resolved.size } : {}),
    ...(imageUrls && imageUrls.length ? { imageUrls } : {}),
  };
}

/** kit 门面单例（含 fetchWithProxy 传输层）。替代被删的 relay-facade。 */
let _relay: Relay | null = null;
export function getRelay(): Relay {
  if (!_relay) _relay = createRelay({ transport: { fetch: (u, i) => fetchWithProxy(u, i) } });
  return _relay;
}

/** 文件名时间戳(对齐前端 formatTime mode:file → YYYYMMDD_HHMMSS)，用于生成结果命名 */
function fileStamp(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

/**
 * 把上游返回的结果 url 落盘成 /files/ 持久地址（对齐既有生成结果规范）。已是 /files/ 则原样返回；
 * 落盘失败回退原 url(宁显示外链不丢)。落盘不依赖 kit（M4 铁律）。
 */
export async function persistResultUrl(rawUrl: string | undefined): Promise<string | undefined> {
  if (typeof rawUrl !== 'string' || !rawUrl || rawUrl.includes('/files/')) return rawUrl;
  try {
    const persisted = await saveRemoteUrl('tasks', rawUrl, `generated_${fileStamp()}`);
    if (persisted?.url) return persisted.url;
  } catch (e) {
    console.error(`[relay] ${new Date().toISOString().replace('T', ' ').slice(0, 19)} | 落盘失败回退: ${(e as Error)?.message}`);
  }
  return rawUrl;
}
