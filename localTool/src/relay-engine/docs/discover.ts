/**
 * docs/discover — 一站式中转站探测。
 *
 * 解决的是「我连对方 API 长什么样都不知道，怎么接」这个问题：
 * 给一个站点地址，自动按顺序做四件事——
 *
 *   1. 安全校验（HTTPS / 公网 / 无凭据）
 *   2. 探 new-api 公开接口 `/api/pricing` + `/api/status`（这类站文档页通常要登录，这是唯一能匿名拿到的结构化数据）
 *   3. 读文档正文（静态 HTML → SPA 动态渲染 → new-api 公开清单，三级回落）
 *   4. 从正文里的请求/响应示例推导调用协议，并诊断还缺什么
 *
 * 一行调用，背后跨了 SSRF 防护、HTML 提取、SPA 渲染、new-api 解析、curl 示例识别、
 * 协议校验与变量映射。它不写任何配置，只产出「接入方案草稿」。
 */
import type { GeneralModelCategory } from '../types/connection';
import { normalizeDocUrl } from './safety';
import {
  readProviderDocsPage,
  probeNewApiPricing,
  probeNewApiStatus,
  type ProviderDocsPage,
  type ProviderDocLink,
} from './reader';
import { buildGroupedModelChoiceList, inferRelayModelCategory, type NewApiPricingItem } from '../stations/new-api';
import { analyzeModelProtocolDocument, type ModelProtocolImportResult } from '../protocol/import';
import { validateModelExecutionProtocol } from '../protocol/schema';

export interface DiscoveredModel {
  id: string;
  name: string;
  category: GeneralModelCategory;
  /** 这个模型是从哪条途径发现的。 */
  source: 'pricing' | 'document';
  /** 端点类型（new-api 的 supported_endpoint_types）。 */
  endpointTypes?: string[];
  price?: number;
  description?: string;
}

export interface ProviderDiscovery {
  /** 规范化后的入口地址。 */
  url: string;
  origin: string;
  /** 站点标题（优先用 /api/status 的 system_name）。 */
  title?: string;
  /** 各条探测途径是否命中。 */
  signals: {
    /** 命中 /api/pricing —— 基本可以确定是 new-api（One API）系中转站。 */
    pricing: boolean;
    /** 命中 /api/status。 */
    status: boolean;
    /** 文档正文可用。 */
    docsText: boolean;
    /** 从正文里推导出了可执行的调用协议。 */
    protocol: boolean;
  };
  /** new-api 站的公开清单；非该类站点为 undefined。 */
  station?: {
    systemName?: string;
    announcements: string[];
    pricing: NewApiPricingItem[];
    /** 按 文本/图片/视频/音频 分好组、可直接转述的清单文本。 */
    groupedCatalog: string;
  };
  /** 汇总出的模型列表。 */
  models: DiscoveredModel[];
  /** 从文档正文推导出的协议草稿；推导不出时为 undefined。 */
  protocolDraft?: ModelProtocolImportResult;
  /** 推导出的协议是否通过校验。 */
  protocolValid: boolean;
  /** 文档正文与链接，供调用方继续深挖下一层页面。 */
  page?: ProviderDocsPage;
  /** 建议继续读取的页面（已按「像不像 API 文档」排序）。 */
  nextLinks: ProviderDocLink[];
  /** 过程中的降级与提示。 */
  warnings: string[];
  /** 还缺什么才能完成接入 —— 这是给调用方/用户的待办清单。 */
  missing: string[];
}

export interface DiscoverOptions {
  /** 单页正文上限，默认 10000。 */
  maxTextChars?: number;
  /** 期望的模型类别，用于辅助协议推导。 */
  category?: GeneralModelCategory;
  signal?: AbortSignal;
}

const CATEGORY_MAP: Record<string, GeneralModelCategory> = {
  文本: 'text',
  图片: 'image',
  视频: 'video',
  音频: 'audio',
};

/**
 * 探测一个中转站 / API 站点。
 *
 * 只做只读探测，不产生任何付费生成，也不会写入任何配置。
 */
export async function discoverProvider(
  rawUrl: string,
  options: DiscoverOptions = {},
): Promise<ProviderDiscovery> {
  const url = normalizeDocUrl(rawUrl);
  if (!url) {
    throw new Error('文档 URL 无效：只允许无凭据的标准 HTTPS（443）公网地址');
  }
  const origin = new URL(url).origin;
  const warnings: string[] = [];
  const missing: string[] = [];

  // ── 1. 读文档（内部已完成：静态 → SPA 渲染 → new-api 公开清单 三级回落） ──
  const page = await readProviderDocsPage(url, {
    maxTextChars: options.maxTextChars ?? 10_000,
    signal: options.signal,
  });

  // ── 2. new-api 公开清单 ──
  const station = await probeStation(origin);
  const pricing = station?.pricing ?? [];
  const models: DiscoveredModel[] = pricing.map((item) => {
    const id = String(item.model_name ?? '').trim();
    const name = typeof item.display_name === 'string' && item.display_name.trim()
      ? item.display_name.trim()
      : id;
    const endpointTypes = Array.isArray(item.supported_endpoint_types)
      ? item.supported_endpoint_types.filter((value): value is string => typeof value === 'string')
      : undefined;
    const description = typeof item.description === 'string' && item.description.trim()
      ? item.description.trim().replace(/\s+/g, ' ')
      : undefined;
    return {
      id,
      name,
      category: CATEGORY_MAP[inferRelayModelCategory(item)] ?? 'text',
      source: 'pricing' as const,
      ...(endpointTypes?.length ? { endpointTypes } : {}),
      ...(typeof item.model_price === 'number' ? { price: item.model_price } : {}),
      ...(description ? { description } : {}),
    };
  }).filter((model) => model.id);

  const signals = {
    pricing: pricing.length > 0,
    status: Boolean(station?.announcements.length || station?.systemName),
    docsText: page.text.trim().length > 0,
    protocol: false,
  };

  // ── 3. 从正文推导协议 ──
  let protocolDraft: ModelProtocolImportResult | undefined;
  let protocolValid = false;
  if (page.text.trim()) {
    try {
      protocolDraft = analyzeModelProtocolDocument(page.text, {
        ...(options.category ? { category: options.category } : {}),
      });
      protocolValid = protocolDraft.protocol
        ? validateModelExecutionProtocol(protocolDraft.protocol).length === 0
        : false;
      signals.protocol = protocolValid;
      warnings.push(...protocolDraft.warnings);
      if (protocolDraft.protocol && !protocolValid) {
        warnings.push(
          `推导出的协议未通过校验：${validateModelExecutionProtocol(protocolDraft.protocol)[0] ?? '未知原因'}`,
        );
      }
    } catch (error) {
      warnings.push(error instanceof Error ? error.message : String(error));
    }
  }

  // ── 4. 诊断还缺什么 ──
  if (models.length === 0 && !protocolDraft?.modelId) {
    missing.push('未拿到模型 ID：请提供公开模型清单、/models 响应，或直接给出要接入的模型名');
  }
  if (!protocolValid) {
    missing.push('未拿到可用的调用协议：请提供该模型的「请求示例」（curl / fetch / Python 均可）');
  }
  if (protocolValid && !protocolDraft?.baseUrl) {
    missing.push('未识别到 Base URL：请提供实际的 API 网关地址（注意不是文档站域名）');
  }
  if (!page.text.trim() && models.length === 0) {
    missing.push('文档页需要登录且无公开接口，无法匿名读取：请直接提供模型清单与请求示例');
  }

  const title = station?.systemName || page.title || new URL(url).hostname;
  const nextLinks = page.links.slice(0, 12);

  return {
    url,
    origin,
    title,
    signals,
    ...(station ? { station: { ...station, groupedCatalog: buildGroupedModelChoiceList(pricing) } } : {}),
    models,
    ...(protocolDraft ? { protocolDraft } : {}),
    protocolValid,
    page,
    nextLinks,
    warnings: [...new Set(warnings)],
    missing,
  };
}

/**
 * 直接探 new-api 的两个公开接口。
 * 只读，且两个接口都不需要鉴权——这是这类中转站唯一能匿名拿到的结构化数据。
 */
export async function probeStation(
  origin: string,
): Promise<ProviderDiscovery['station']> {
  const [pricing, status] = await Promise.all([
    probeNewApiPricing(origin),
    probeNewApiStatus(origin),
  ]);
  if (!pricing?.length && !status) return undefined;
  return {
    ...(status?.systemName ? { systemName: status.systemName } : {}),
    announcements: status?.announcements ?? [],
    pricing: pricing ?? [],
    groupedCatalog: '',
  };
}
