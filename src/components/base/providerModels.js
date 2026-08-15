/**
 * 多 provider 模型选择公共工具。
 *
 * 背景（用户需求）：现在有多个 API（如 Lovart、魔搭），希望「节点式」——
 * 每个节点（生图/文本/视频）的模型下拉能显示【所有 provider】的模型，
 * 这样两个节点可以分别选不同 provider 的不同模型，而不是只能选主供应商的模型。
 *
 * 实现：
 * - 模型 value 用 `{providerId}::{modelId}`（双冒号，兼容 modelId 含 `/`，如 Qwen/Qwen3-14B）。
 * - 生成时用 resolveProviderModel 解析回 { provider, modelId }，再经 /api/proxy 转发到该 provider。
 */

/** 模型 value 拼接：providerId::modelId */
export function modelKey(providerId, modelId) {
  return `${providerId}::${modelId}`
}

/**
 * 聚合所有 provider 的某类型模型，生成模型下拉项。
 * @param {Array} providers 全部供应商
 * @param {'image'|'chat'|'video'} type 模型类型（对应 image_models/chat_models/video_models）
 * @returns {Array<{id:string, label:string, badge:string, providerId:string, modelId:string}>}
 */
export function buildAllModels(providers, type) {
  const key = type === 'image' ? 'image_models' : type === 'chat' ? 'chat_models' : 'video_models'
  const out = []
  for (const p of providers || []) {
    for (const m of p[key] || []) {
      const modelId = m.id || m.label
      if (!modelId) continue
      out.push({
        id: modelKey(p.id, modelId),
        label: m.label || modelId,
        badge: p.name || p.id || '内置',
        providerId: p.id,
        modelId,
      })
    }
  }
  return out
}

/**
 * 把「providerId::modelId」解析回 { provider, modelId }。
 * 兼容旧值：如果 selectedValue 不含 `::`，则视为主供应商的模型。
 * @param {Array} providers 全部供应商
 * @param {string} selectedValue 模型 value（providerId::modelId）
 * @param {object} primary 主供应商（找不到时回退）
 * @returns {{ provider: object|null, modelId: string }}
 */
export function resolveProviderModel(providers, selectedValue, primary) {
  if (!selectedValue) return { provider: primary || null, modelId: '' }
  const sep = selectedValue.indexOf('::')
  if (sep > 0) {
    const providerId = selectedValue.slice(0, sep)
    const modelId = selectedValue.slice(sep + 2)
    const provider = providers?.find((p) => p.id === providerId) || primary || null
    return { provider, modelId }
  }
  // 旧值（无前缀）：直接用主供应商 + 该 id
  return { provider: primary || null, modelId: selectedValue }
}
