// @vitest-environment node
/**
 * agentAttachments 单测（M3 下沉 1：附件归一化 / 参考图目录）。
 * 覆盖：
 *   - normalizeAttachmentsForSend：每条 { ...a, url } 经 normalizeImageUrlForSend（含 preferBase64 透传）；返回 Promise。
 *   - buildRefCatalog：只对图片附件编号、>0 时生成目录文本、无图片 → 空串、nodeId 记录、label/name 兜底。
 * 策略：mock normalizeImageUrlForSend 验证透传与 Promise 形态（纯函数，不 import store）。
 */
import { describe, it, expect, vi } from 'vitest'

vi.mock('../../src/components/base/imageUrl.ts', () => ({
  normalizeImageUrlForSend: vi.fn(async (url, opts) => `norm:${url}${opts?.preferBase64 ? ':b64' : ''}`),
  summarizeImages: vi.fn((urls) => {
    const list = (urls || []).filter((u) => typeof u === 'string' && u)
    let base64s = 0
    for (const u of list) if (u.startsWith('data:')) base64s++
    return { count: list.length, urls: list.length - base64s, base64s }
  }),
}))
vi.mock('../../src/components/base/logger.ts', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

const { normalizeAttachmentsForSend, buildRefCatalog } = await import('../../src/components/agent/runtime/agentAttachments.ts')
const { normalizeImageUrlForSend, summarizeImages } = await import('../../src/components/base/imageUrl.ts')
const { logger } = await import('../../src/components/base/logger.ts')

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

  it('带图发送 → 记一条图片形态 info 日志（不携带图片内容）', async () => {
    await normalizeAttachmentsForSend([{ url: 'http://a.png' }, { url: 'data:image/png;base64,xxx' }])
    expect(logger.info).toHaveBeenCalledWith('agentAttachments', '发送图片', { count: 2, urls: 1, base64s: 1, total: 2 })
  })

  it('无图附件 → 不记发送日志', async () => {
    logger.info.mockClear()
    await normalizeAttachmentsForSend([{ type: 'node', id: 'n1' }])
    expect(logger.info).not.toHaveBeenCalled()
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