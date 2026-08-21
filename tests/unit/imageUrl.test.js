import { describe, it, expect, vi, beforeEach } from 'vitest'
import { toAbsoluteFileUrl, toRelativeFileUrl, buildThumbnailUrl, resolveImageUrl, normalizeImageUrl, normalizeImageUrlForSend, normalizeImageUrlsForSend, toImageContentBlocks } from '../../src/components/base/imageUrl.js'

// blobToDataUrl / urlToDataUrl 依赖 httpClient 与 FileReader（node 无原生实现），在此 mock。
vi.mock('../../src/components/base/httpClient.js', () => ({
  httpRequest: vi.fn(),
}))
// mock logger，避免转换失败时告警刷屏污染测试输出
vi.mock('../../src/components/base/logger.js', () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}))

import { httpRequest } from '../../src/components/base/httpClient.js'

// node 环境无 FileReader：stub 一个，readAsDataURL 直接产出预设 dataURL（配合 httpRequest mock 返回 {_dataUrl}）。
function stubFileReader() {
  globalThis.FileReader = class {
    readAsDataURL(blob) {
      this.result = (blob && blob._dataUrl) || 'data:image/png;base64,stubdata'
      this.onload?.()
    }
  }
}

// API_BASE 在 config.js 硬编码为 http://127.0.0.1:18080
describe('imageUrl §2.17', () => {
  it('toAbsoluteFileUrl 把 /files/ 相对路径补全为绝对 URL', () => {
    expect(toAbsoluteFileUrl('/files/a.png')).toBe('http://127.0.0.1:18080/files/a.png')
  })

  it('toAbsoluteFileUrl 非 /files/ 原样返回', () => {
    expect(toAbsoluteFileUrl('http://x/y.png')).toBe('http://x/y.png')
    expect(toAbsoluteFileUrl('data:image/png;base64,xxx')).toBe('data:image/png;base64,xxx')
    expect(toAbsoluteFileUrl('blob:http://x/abc')).toBe('blob:http://x/abc')
  })

  it('toAbsoluteFileUrl 空/非字符串原样返回', () => {
    expect(toAbsoluteFileUrl('')).toBe('')
    expect(toAbsoluteFileUrl(null)).toBe(null)
    expect(toAbsoluteFileUrl(undefined)).toBe(undefined)
  })

  it('normalizeImageUrl 等价于 toAbsoluteFileUrl', () => {
    expect(normalizeImageUrl('/files/b.png')).toBe('http://127.0.0.1:18080/files/b.png')
    expect(normalizeImageUrl('http://y/z.jpg')).toBe('http://y/z.jpg')
  })
})

// ── normalizeImageUrlForSend：发送端 URL 归一化（发图给 AI / 网关的关键转换）──
// 覆盖分支：非字符串 / /files/ 补全 / http·data·裸base64 原样 / blob→data /
// preferBase64 时 data 原样 + http·files·blob 全转 base64 / 数组过滤空值 / 转换失败降级空串。
describe('imageUrl · normalizeImageUrlForSend（发送端归一化）', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    stubFileReader()
  })

  it('非字符串 → 空串（丢弃）', async () => {
    await expect(normalizeImageUrlForSend(null)).resolves.toBe('')
    await expect(normalizeImageUrlForSend(undefined)).resolves.toBe('')
    await expect(normalizeImageUrlForSend(123)).resolves.toBe('')
  })

  it('/files/ 相对 → 补全为绝对 http（网关可访问）', async () => {
    await expect(normalizeImageUrlForSend('/files/a.png')).resolves.toBe('http://127.0.0.1:18080/files/a.png')
  })

  it('http / data / 裸 base64 → 原样（网关 resolve_attachments 可处理，不 fetch）', async () => {
    await expect(normalizeImageUrlForSend('http://x/a.png')).resolves.toBe('http://x/a.png')
    await expect(normalizeImageUrlForSend('data:image/png;base64,xxx')).resolves.toBe('data:image/png;base64,xxx')
    await expect(normalizeImageUrlForSend('iVBORw0KGgo=')).resolves.toBe('iVBORw0KGgo=')
    // 这些分支不应触发网络请求
    expect(httpRequest).not.toHaveBeenCalled()
  })

  it('blob: → 拉取并转 data: base64', async () => {
    httpRequest.mockResolvedValueOnce({ blob: async () => ({ _dataUrl: 'data:image/png;base64,blobdata' }) })
    const out = await normalizeImageUrlForSend('blob:http://127.0.0.1:5180/uuid')
    expect(out).toBe('data:image/png;base64,blobdata')
    expect(httpRequest).toHaveBeenCalledTimes(1)
  })

  it('blob 转换失败 → 降级空串（调用方丢弃该图，不阻断）', async () => {
    httpRequest.mockRejectedValueOnce(new Error('fetch fail'))
    await expect(normalizeImageUrlForSend('blob:http://x/abc')).resolves.toBe('')
  })

  it('preferBase64=true：data: 已是 base64 → 原样返回，不 fetch', async () => {
    const out = await normalizeImageUrlForSend('data:image/png;base64,xxx', { preferBase64: true })
    expect(out).toBe('data:image/png;base64,xxx')
    expect(httpRequest).not.toHaveBeenCalled()
  })

  it('preferBase64=true：/files/ 相对 → 补全后转 base64', async () => {
    httpRequest.mockResolvedValueOnce({ blob: async () => ({ _dataUrl: 'data:image/jpeg;base64,filesdata' }) })
    const out = await normalizeImageUrlForSend('/files/c.png', { preferBase64: true })
    expect(out).toBe('data:image/jpeg;base64,filesdata')
    // 应先用补全后的绝对地址请求
    expect(httpRequest).toHaveBeenCalledWith('http://127.0.0.1:18080/files/c.png', expect.anything())
  })

  it('normalizeImageUrlsForSend：数组逐个归一 + 过滤空值', async () => {
    httpRequest.mockResolvedValueOnce({ blob: async () => ({ _dataUrl: 'data:image/png;base64,b1' }) })
    const out = await normalizeImageUrlsForSend(['http://x/a.png', 'blob:http://x/b', '', null, undefined])
    expect(out).toEqual(['http://x/a.png', 'data:image/png;base64,b1'])
  })

  // ── 发送侧防线：缩略图端点 URL 绝不允许发出去（系统性根因治理，见 imageUrl.js thumbnailToOriginal）──
  it('发送缩略图端点 URL → 自动还原为原图绝对地址（不把 render 小图发给网关）', async () => {
    const thumb = buildThumbnailUrl('/files/tasks/x.png', { maxDim: 320 })
    // 断言输入确实是缩略图端点（构造正确）
    expect(thumb).toMatch(/\/api\/files\/thumbnail\?/)
    const out = await normalizeImageUrlForSend(thumb)
    expect(out).toBe('http://127.0.0.1:18080/files/tasks/x.png')
    // 发送原生 /files/ 不应触发网络(还原后直接补绝对，不 fetch)
    expect(httpRequest).not.toHaveBeenCalled()
  })

  it('发送缩略图端点（绝对本地形态）→ 还原为原图绝对地址', async () => {
    const thumb = buildThumbnailUrl('http://127.0.0.1:18080/files/tasks/x.png', { maxDim: 320 })
    const out = await normalizeImageUrlForSend(thumb)
    expect(out).toBe('http://127.0.0.1:18080/files/tasks/x.png')
  })

  it('preferBase64=true 的缩略图端点 → 还原原图后转 base64（同样不发缩略图）', async () => {
    httpRequest.mockResolvedValueOnce({ blob: async () => ({ _dataUrl: 'data:image/jpeg;base64,origdata' }) })
    const thumb = buildThumbnailUrl('/files/tasks/x.png', { maxDim: 320 })
    const out = await normalizeImageUrlForSend(thumb, { preferBase64: true })
    expect(out).toBe('data:image/jpeg;base64,origdata')
    // 应已还原为绝对原图地址再请求，而非请求缩略图端点
    expect(httpRequest).toHaveBeenCalledWith('http://127.0.0.1:18080/files/tasks/x.png', expect.anything())
  })

  it('普通原图 URL（虽是绝对 http 但非缩略图）→ 原样透传，不受防线影响', async () => {
    const out = await normalizeImageUrlForSend('http://127.0.0.1:18080/files/tasks/x.png')
    expect(out).toBe('http://127.0.0.1:18080/files/tasks/x.png')
  })
})

// ── resolveImageUrl：前端图片唯一出口（display=render 走按需小图 / send 走原图）──
describe('imageUrl · resolveImageUrl（统一出口，render 按需小图 / send 原图）', () => {
  it('toRelativeFileUrl：/files/ 相对原样 / 绝对本地还原相对 / 非本地 null', () => {
    expect(toRelativeFileUrl('/files/a.png')).toBe('/files/a.png')
    expect(toRelativeFileUrl('http://127.0.0.1:18080/files/tasks/x.png')).toBe('/files/tasks/x.png')
    expect(toRelativeFileUrl('http://other/files/y.png')).toBe('/files/y.png') // 任意 http 前缀 files 路径
    expect(toRelativeFileUrl('data:image/png;base64,xxx')).toBeNull()
    expect(toRelativeFileUrl('http://x/bare.png')).toBeNull()
    expect(toRelativeFileUrl('')).toBeNull()
  })

  const thumb = (u) => new URL(resolveImageUrl(u, { scope: 'render' }))

  it('render：本地 /files/ 相对 → 按需出图端点（url+maxDim 缺省 640）', () => {
    const url = thumb('/files/a.png')
    expect(url.origin + url.pathname).toBe('http://127.0.0.1:18080/api/files/thumbnail')
    expect(url.searchParams.get('url')).toBe('/files/a.png')
    expect(url.searchParams.get('maxDim')).toBe('640')
    expect(url.searchParams.get('format')).toBeNull()
  })

  it('render：绝对本地 URL（DB 存储形态）→ 还原相对再走按需出图', () => {
    const url = thumb('http://127.0.0.1:18080/files/tasks/x.png')
    expect(url.origin + url.pathname).toBe('http://127.0.0.1:18080/api/files/thumbnail')
    expect(url.searchParams.get('url')).toBe('/files/tasks/x.png')
  })

  it('render：maxDim / 白名单 format 透传；webp 被钳制不产出', () => {
    const u = new URL(resolveImageUrl('/files/a.png', { scope: 'render', maxDim: 320, format: 'jpeg' }))
    expect(u.searchParams.get('maxDim')).toBe('320')
    expect(u.searchParams.get('format')).toBe('jpeg')
    // webp 非白名单（后端 Jimp 0.22 无法编码）→ 不得产出 format，避免假 webp
    const w = new URL(resolveImageUrl('/files/a.png', { scope: 'render', maxDim: 320, format: 'webp' }))
    expect(w.searchParams.get('format')).toBeNull()
  })

  it('render：非本地（外部 http / data: / blob:）回退原图绝对地址，绝不请求出图端点', () => {
    expect(resolveImageUrl('http://cdn/x.jpg', { scope: 'render' })).toBe('http://cdn/x.jpg')
    expect(resolveImageUrl('data:image/png;base64,xxx', { scope: 'render' })).toBe('data:image/png;base64,xxx')
    expect(resolveImageUrl('blob:http://x/abc', { scope: 'render' })).toBe('blob:http://x/abc')
  })

  it('send：一律原图绝对地址，不缩图（/files/ 补全绝对；绝对原样）', () => {
    expect(resolveImageUrl('/files/a.png', { scope: 'send' })).toBe('http://127.0.0.1:18080/files/a.png')
    expect(resolveImageUrl('http://127.0.0.1:18080/files/a.png', { scope: 'send' })).toBe('http://127.0.0.1:18080/files/a.png')
    expect(resolveImageUrl('http://cdn/x.jpg', { scope: 'send' })).toBe('http://cdn/x.jpg')
  })

  it('空 / 非字符串 → 原样返回', () => {
    expect(resolveImageUrl('')).toBe('')
    expect(resolveImageUrl(null)).toBeNull()
    expect(resolveImageUrl(undefined)).toBeUndefined()
  })

  it('buildThumbnailUrl 非本地 → 回退原图绝对地址', () => {
    expect(buildThumbnailUrl('http://cdn/x.jpg')).toBe('http://cdn/x.jpg')
  })
})

// ── toImageContentBlocks：网关 chat 消息内容块 ──
describe('imageUrl · toImageContentBlocks', () => {
  it('URL 数组 → image_url 内容块', () => {
    const blocks = toImageContentBlocks(['http://x/a.png', 'http://x/b.png'])
    expect(blocks).toEqual([
      { type: 'image_url', image_url: { url: 'http://x/a.png' } },
      { type: 'image_url', image_url: { url: 'http://x/b.png' } },
    ])
  })

  it('空/undefined → 空数组', () => {
    expect(toImageContentBlocks()).toEqual([])
    expect(toImageContentBlocks(null)).toEqual([])
  })
})
