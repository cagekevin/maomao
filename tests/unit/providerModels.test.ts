import { describe, it, expect } from 'vitest'
import { modelKey, buildAllModels, resolveProviderModel } from '../../src/components/base/providerModels.ts'

const providers = [
  { id: 'lovart', name: 'Lovart', image_models: [{ id: 'model-a', label: '模型A' }], chat_models: [{ id: 'chat-1', label: '对话1' }], video_models: [] },
  { id: 'modelscope', name: '魔搭', image_models: [{ id: 'Qwen/Qwen3-14B', label: '通义' }], chat_models: [], video_models: [{ id: 'v1', label: '视频1' }] },
]
const primary = providers[0]

describe('providerModels §2.17/2.20', () => {
  it('modelKey 双冒号拼接', () => {
    expect(modelKey('lovart', 'model-a')).toBe('lovart::model-a')
    expect(modelKey('modelscope', 'Qwen/Qwen3-14B')).toBe('modelscope::Qwen/Qwen3-14B')
  })

  it('buildAllModels 聚合多 provider 指定类型', () => {
    const imgs = buildAllModels(providers, 'image')
    expect(imgs).toHaveLength(2)
    expect(imgs[0]).toMatchObject({ id: 'lovart::model-a', providerId: 'lovart', modelId: 'model-a', badge: 'Lovart' })
    // modelId 含 / 也能正确解析
    const m2 = imgs[1]
    expect(m2.id).toBe('modelscope::Qwen/Qwen3-14B')
    expect(m2.modelId).toBe('Qwen/Qwen3-14B')

    const vids = buildAllModels(providers, 'video')
    expect(vids).toHaveLength(1)
    expect(vids[0].modelId).toBe('v1')

    const chats = buildAllModels(providers, 'chat')
    expect(chats).toHaveLength(1)
    expect(chats[0].modelId).toBe('chat-1')
  })

  it('buildAllModels 空 providers 返回空', () => {
    expect(buildAllModels(null, 'image')).toEqual([])
  })

  it('resolveProviderModel 解析 providerId::modelId', () => {
    const r = resolveProviderModel(providers, 'modelscope::Qwen/Qwen3-14B', primary)
    expect(r.provider.id).toBe('modelscope')
    expect(r.modelId).toBe('Qwen/Qwen3-14B')
  })

  it('resolveProviderModel 找不到 provider 回退 primary', () => {
    const r = resolveProviderModel(providers, 'unknown::m', primary)
    expect(r.provider.id).toBe('lovart')
    expect(r.modelId).toBe('m')
  })

  it('resolveProviderModel 旧值（无 ::）直接用 primary', () => {
    const r = resolveProviderModel(providers, 'legacy-model', primary)
    expect(r.provider.id).toBe('lovart')
    expect(r.modelId).toBe('legacy-model')
  })

  it('resolveProviderModel 空值回退 primary', () => {
    const r = resolveProviderModel(providers, '', primary)
    expect(r.provider.id).toBe('lovart')
    expect(r.modelId).toBe('')
  })
})
