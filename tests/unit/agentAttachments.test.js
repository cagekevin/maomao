// @vitest-environment node
/**
 * agentAttachments 单测（M3 下沉 1：附件归一化 / 参考图目录）。
 * 覆盖：
 *   - normalizeAttachmentsForSend：每条 { ...a, url } 经 normalizeImageUrlForSend（含 preferBase64 透传）；返回 Promise。
 *   - buildRefCatalog：只对图片附件编号、>0 时生成目录文本、无图片 → 空串、nodeId 记录、label/name 兜底。
 * 策略：mock normalizeImageUrlForSend 验证透传与 Promise 形态（纯函数，不 import store）。
 */
import { describe, it, expect, vi } from 'vitest'

vi.mock('../../src/components/base/imageUrl.js', () => ({
  normalizeImageUrlForSend: vi.fn(async (url, opts) => `norm:${url}${opts?.preferBase64 ? ':b64' : ''}`),
}))

const { normalizeAttachmentsForSend, buildRefCatalog } = await import('../../src/components/agent/runtime/agentAttachments.js')
const { normalizeImageUrlForSend } = await import('../../src/components/base/imageUrl.js')

describe('normalizeAttachmentsForSend — 附件统一归一出口', () => {
  it('每条附件经 normalizeImageUrlForSend，保留其它字段', async () => {
    const out = await normalizeAttachmentsForSend([{ type: 'image', url: 'http://a', label: 'L' }])
    expect(out).toEqual([{ type: 'image', url: 'norm:http://a', label: 'L' }])
  })

  it('preferBase64 透传给归一函数', async () => {
    await normalizeAttachmentsForSend([{ url: 'http://a' }], { preferBase64: true })
    expect(normalizeImageUrlForSend).toHaveBeenCalledWith('http://a', { preferBase64: true })
  })

  it('缺省 preferBase64=false', async () => {
    await normalizeAttachmentsForSend([{ url: 'http://a' }])
    expect(normalizeImageUrlForSend).toHaveBeenCalledWith('http://a', { preferBase64: false })
  })
})

describe('buildRefCatalog — 参考图编号目录', () => {
  it('图片附件生成编号目录（参考图1 起，0-based 说明附在末尾）', () => {
    const txt = buildRefCatalog([{ label: '猫', url: 'u1' }, { name: '狗', url: 'u2' }])
    expect(txt).toContain('参考图1：猫')
    expect(txt).toContain('参考图2：狗')
    expect(txt).toContain('attachment_indices')
    expect(txt).toContain('参考图1→0')
  })

  it('label/name 都缺 → 用 Image{i+1} 兜底', () => {
    const txt = buildRefCatalog([{ url: 'u1' }])
    expect(txt).toContain('参考图1：Image1')
  })

  it('nodeId 来源被记录', () => {
    const txt = buildRefCatalog([{ label: '画布图', url: 'u1', nodeId: 'n99' }])
    expect(txt).toContain('（画布节点 n99）')
  })

  it('无图片附件 → 返回空串', () => {
    expect(buildRefCatalog([])).toBe('')
    expect(buildRefCatalog(null)).toBe('')
    expect(buildRefCatalog(undefined)).toBe('')
  })
})