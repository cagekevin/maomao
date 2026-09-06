/**
 * 多 provider 模型选择公共工具。
 *
 * 背景（用户需求）：现在有多个 API（如 Lovart、魔搭），希望「节点式」——
 * 每个节点（生图/文本/视频）的模型下拉能显示【所有 provider】的模型，
 * 这样两个节点可以分别选不同 provider 的不同模型，而不是只能选主供应商的模型。
 *
 * 实现：
 * - 模型 value 用 `{providerId}::{modelId}`（双冒号，兼容 modelId 含 `/`，如 Qwen/Qwen3-14B）。
 * - 生成时用 resolveProviderModel 解析回 { provider, modelId }，再经统一生成入口 /api/generate 转发到该 provider（旧 /api/proxy 出站已退役）。
 */

/** 模型域：对应 provider 的 image_models / chat_models / video_models */
export type ModelDomain = 'image' | 'chat' | 'video';

/** 后端返回的模型条目（id 或 label 至少有一个） */
export interface RawModel {
  id?: string;
  label?: string;
  [key: string]: unknown;
}

/** 带模型数组的 provider 形态（buildAllModels / resolveProviderModel 消费的字段子集） */
export interface ProviderWithModels {
  id?: string;
  name?: string;
  enabled?: boolean;
  image_models?: RawModel[];
  chat_models?: RawModel[];
  video_models?: RawModel[];
  [key: string]: unknown;
}

/** 模型下拉项：id 为 `providerId::modelId` */
export interface ModelOption {
  id: string;
  label: string;
  badge: string;
  providerId: string | undefined;
  modelId: string;
}

/** 模型 value 拼接：providerId::modelId */
export function modelKey(providerId: string | undefined, modelId: string): string {
  return `${providerId}::${modelId}`;
}

/**
 * 聚合所有 provider 的某类型模型，生成模型下拉项。
 * @param providers 全部供应商
 * @param type 模型类型（对应 image_models/chat_models/video_models）
 */
export function buildAllModels(
  providers: ProviderWithModels[] | null | undefined,
  type: ModelDomain | string,
): ModelOption[] {
  const key = type === 'image' ? 'image_models' : type === 'chat' ? 'chat_models' : 'video_models';
  const out: ModelOption[] = [];
  for (const p of providers || []) {
    if (p.enabled === false) continue; // 【全局生效】隐藏未启用的厂商（用户配置层，enabled 缺省视为可用）
    for (const m of p[key] || []) {
      const modelId = m.id || m.label;
      if (!modelId) continue;
      out.push({
        id: modelKey(p.id, modelId),
        label: m.label || modelId,
        badge: p.name || p.id || '内置',
        providerId: p.id,
        modelId,
      });
    }
  }
  return out;
}

/**
 * 把「providerId::modelId」解析回 { provider, modelId }。
 * 兼容旧值：如果 selectedValue 不含 `::`，则视为主供应商的模型。
 * @param providers 全部供应商
 * @param selectedValue 模型 value（providerId::modelId）
 * @param primary 主供应商（找不到时回退）
 */
export function resolveProviderModel(
  providers: ProviderWithModels[] | null | undefined,
  selectedValue: string | undefined,
  primary?: ProviderWithModels | null,
): { provider: ProviderWithModels | null; modelId: string } {
  if (!selectedValue) return { provider: primary || null, modelId: '' };
  const sep = selectedValue.indexOf('::');
  if (sep > 0) {
    const providerId = selectedValue.slice(0, sep);
    const modelId = selectedValue.slice(sep + 2);
    const provider = providers?.find((p) => p.id === providerId) || primary || null;
    return { provider, modelId };
  }
  // 旧值（无前缀）：直接用主供应商 + 该 id
  return { provider: primary || null, modelId: selectedValue };
}
