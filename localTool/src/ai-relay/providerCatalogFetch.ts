/**
 * 模型目录拉取 —— 「稳定连接」第三道防线。
 * 从 AI-Canvas-tauri providerCatalogService.ts 的 fetchProviderModelCatalog 搬出。
 *
 * 逻辑：
 *  - local-manifest 供应商：直接回内置清单（远程挂了也能用）；
 *  - openai-compatible 供应商：依次探测 baseUrl 候选，拉 /models（带 requestQuery），
 *    解析后与本地的 fallback 清单合并；远程失败则回退 local-fallback。
 */
import { baseUrlCandidates } from './providerBaseUrl.js';
import { getProviderDefinition, isProviderModelVisible } from './providerCatalog.js';
import { stableRequest, readCapped } from './httpTransport.js';
import type {
  CatalogFetchOptions,
  CatalogFetchResult,
  CatalogModel,
  ModelCategory,
  ProviderDefinition,
} from './types.js';

type CatalogConfig = CatalogFetchOptions['config'];

function inferModelCategory(modelId: string): ModelCategory {
  const id = modelId.toLowerCase();
  if (/tts|speech|audio|music|voice|whisper|transcri/.test(id)) return 'audio';
  if (/video|seedance|sora|veo|kling|hailuo|wan\d|skyreels|vidu|minimax[-\s_.]?h3/.test(id)) return 'video';
  if (/image|seedream|imagen|flux|banana|midjourney|recraft|dall-e/.test(id)) return 'image';
  return 'text';
}

function readCatalogItems(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== 'object') return [];
  const record = payload as Record<string, unknown>;
  if (Array.isArray(record.data)) return record.data;
  if (Array.isArray(record.models)) return record.models;
  return [];
}

function parseCatalogItem(item: unknown, providerId: string): CatalogModel | null {
  if (typeof item === 'string') {
    const id = item.trim();
    return id ? { id, name: id, category: inferModelCategory(id), provider: providerId } : null;
  }
  if (!item || typeof item !== 'object') return null;
  const record = item as Record<string, unknown>;
  const rawId = record.id ?? record.model ?? record.model_id;
  if (typeof rawId !== 'string' || !rawId.trim()) return null;
  const id = rawId.trim();
  const rawName = record.name ?? record.display_name ?? record.displayName;
  const name = typeof rawName === 'string' && rawName.trim() ? rawName.trim() : id;
  const supportsImageInput = record.supports_image === true || record.supportsImage === true;
  return {
    id,
    name,
    category: inferModelCategory(id),
    provider: providerId,
    inputModalities: supportsImageInput ? ['text', 'image'] : undefined,
  };
}

function normalizeModels(models: CatalogModel[], providerId: string): CatalogModel[] {
  const unique = new Map<string, CatalogModel>();
  for (const model of models) {
    const id = model.id.trim();
    if (!id || unique.has(id)) continue;
    unique.set(id, { ...model, id, name: model.name?.trim() || id, provider: providerId });
  }
  return [...unique.values()].sort((a, b) => a.name.localeCompare(b.name, 'zh-CN', { sensitivity: 'base' }));
}

function safeCatalogError(error: unknown): string {
  if (error instanceof Error && error.name === 'AbortError') return '模型列表拉取已取消';
  return '无法连接模型目录，请检查接口地址、网络和 API Key';
}

async function fetchAt(baseUrl: string, definition: ProviderDefinition, providerId: string, config: CatalogConfig, signal?: AbortSignal): Promise<CatalogModel[]> {
  const { response } = await stableRequest({
    method: 'GET',
    path: definition.modelsPath || '/models',
    baseUrl,
    candidates: [baseUrl],
    apiKey: config.apiKey,
    signal,
    requestQuery: definition.requestQuery,
  });
  if (!response.ok) throw new Error(`模型列表拉取失败 (HTTP ${response.status})`);
  const text = await readCapped(response);
  let payload: unknown;
  try { payload = text ? JSON.parse(text) : null; } catch { payload = null; }
  const models = readCatalogItems(payload)
    .map((item) => parseCatalogItem(item, providerId))
    .filter((item): item is CatalogModel => item !== null && isProviderModelVisible(definition.id, item.id));
  if (models.length === 0) throw new Error('模型列表拉取失败 (HTTP 200)');
  return normalizeModels(models, providerId);
}

async function fetchOpenAiCompatible(definition: ProviderDefinition, providerId: string, config: CatalogConfig, signal?: AbortSignal): Promise<{ models: CatalogModel[]; baseUrl: string }> {
  const candidates = baseUrlCandidates(config.baseUrl || definition.defaultBaseUrl || '');
  if (candidates.length === 0) throw new Error('请填写接口地址');
  let lastError: unknown;
  for (const baseUrl of candidates) {
    try {
      return { models: await fetchAt(baseUrl, definition, providerId, config, signal), baseUrl };
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') throw error;
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error('模型列表拉取失败');
}

export async function fetchProviderModelCatalog(options: CatalogFetchOptions): Promise<CatalogFetchResult> {
  const { providerId, config, fallbackModels = [], signal } = options;
  if (signal?.aborted) throw new Error('模型列表拉取已取消');
  const definition = getProviderDefinition(providerId, config);
  // 纯配置文件厂商（无内置目录定义，如魔搭 modelscope / 自定义 apimart）：
  // 有 base_url 时按通用 OpenAI 兼容拉起 /models，不再笼统报「未知厂商目录」（2026-09-04）。
  if (!definition) {
    if (!config.baseUrl) throw new Error('未知厂商目录（未配置接口地址）');
    const candidates = baseUrlCandidates(config.baseUrl);
    if (candidates.length === 0) throw new Error('请填写接口地址');
    const normalizedFallback = normalizeModels(fallbackModels, providerId);
    let lastError: unknown;
    for (const baseUrl of candidates) {
      try {
        const models = await fetchAt(baseUrl, { id: providerId, modelsPath: '/models' } as ProviderDefinition, providerId, config, signal);
        return { models, source: 'remote', resolvedBaseUrl: baseUrl };
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') throw error;
        lastError = error;
      }
    }
    const warning = safeCatalogError(lastError);
    if (normalizedFallback.length > 0) {
      return { models: normalizedFallback, source: 'local-fallback', warning };
    }
    throw new Error(warning, { cause: lastError });
  }

  const normalizedFallback = normalizeModels(fallbackModels, providerId)
    .filter((model) => isProviderModelVisible(definition.id, model.id));

  if (definition.catalogAdapter === 'local-manifest') {
    return { models: normalizedFallback, source: 'local-manifest' };
  }

  try {
    const { models, baseUrl } = await fetchOpenAiCompatible(definition, providerId, config, signal);
    return { models, source: 'remote', resolvedBaseUrl: baseUrl };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') throw error;
    const warning = safeCatalogError(error);
    if (normalizedFallback.length > 0) {
      return { models: normalizedFallback, source: 'local-fallback', warning };
    }
    throw new Error(warning, { cause: error });
  }
}
