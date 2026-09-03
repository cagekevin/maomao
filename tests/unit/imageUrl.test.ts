import { describe, it, expect, vi, beforeEach } from 'vitest'
import { toAbsoluteFileUrl, toRelativeFileUrl, buildThumbnailUrl, resolveImageUrl, normalizeImageUrl, normalizeImageUrlForSend, normalizeImageUrlsForSend, toImageContentBlocks, fileToDataUrl, classifyImageType, summarizeImages } from '../../src/components/base/utils/imageUrl.ts'

// blobToDataUrl / urlToDataUrl 依赖 httpClient 与 FileReader（node 无原生实现），在此 mock。
vi.mock('../../src/components/base/api/httpClient.ts', () => ({
  httpRequest: vi.fn(),
}))
// mock logger，避免转换失败时告警刷屏污染测试输出
vi.mock('../../src/components/base/core/logger.ts', () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}))
// 发送出口会调 compressImage（本地图压缩→base64）。本测试关注「发送归一」的 URL/分支处理，
// 压缩本身由 imageCompress.test.js 覆盖，这里 mock 掉避免依赖 canvas 浏览器 API。
vi.mock('../../src/components/base/utils/imageCompress.ts', () => ({
  compressImage: vi.fn(async (url, opts) => ({ dataUrl: `data:image/png;base64,compressed:${url}` })),
}))

import { httpRequest } from '@/components/base/api/httpClient.ts'
import { logger } from '../../src/components/base/core/logger.ts'
import { compressImage } from '../../src/components/base/utils/imageCompress.ts'

// node 环境无 FileReader：stub 一个，readAsDataURL 直接产出预设 dataURL（配合 httpRequest mock 返回 {_dataUrl}）。
// 显式声明 result/onload 字段（否则 this.xxx 报 TS2339）；stub 缺 EMPTY/LOADING/DONE 等
// 静态成员，赋值时统一 as unknown as 收尾（踩坑记录 #11）。
function stubFileReader() {
  class StubFileReader {
    result: string | ArrayBuffer | null = null
    onload: (() => void) | null = null
    readAsDataURL(blob?: Blob) {
      this.result = (blob && (blob as unknown as { _dataUrl?: string })._dataUrl) || 'data:image/png;base64,stubdata'
      this.onload?.()
    }
  }
  globalThis.FileReader = StubFileReader as unknown as typeof FileReader
}

// API_BASE 在 config.ts 硬编码为 http://127.0.0.1:18080
describe('imageUrl §2.17', () => {
  it('toAbsoluteFileUrl 把 /files/ 相对路径补全为绝对 URL', () => {
    expect(toAbsoluteFileUrl('/files/a.png')).toBe('http://127.0.0.1:18080/files/a.png')
  })

  it('toAbsoluteFileUrl 非 /files/ 原样返回', () => {
    expect(toAbsoluteFileUrl('http://x/y.png')).toBe('http://x/y.png')
    expect(toAbsoluteFileUrl('data:image/png;base64,xxx')).toBe('data:image/png;base64,xxx')
    expect(toAbsoluteFileUrl('blob:http://x/abc')).toBe('blob:http://x/abc')
  })

  it('normalizeImageUrl 等价于 toAbsoluteFileUrl', () => {
    expect(normalizeImageUrl('/files/b.png')).toBe('http://127.0.0.1:18080/files/b.png')
    expect(normalizeImageUrl('http://y/z.jpg')).toBe('http://y/z.jpg')
  })
})

// ── normalizeImageUrlForSend：发送端 URL 归一化（发图给 AI / 网关的关键转换）──
// 契约（2026-08-29 · E 方案 docs/72）：/files/ 本地图 → URL 模式保持相对路径（交 localTool 出站回读）；
//                blob/data → 压缩 ≤1920 保持原格式 → base64；公网图（http/https）→ 原样透传（不压缩）。
// 覆盖分支：非字符串 / /files/ 保持相对 / blob/data 压缩转base64 / 公网图原样 / 压缩失败回退 / preferBase64 / 数组过滤空值。
describe('imageUrl · normalizeImageUrlForSend（发送端归一化）', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    stubFileReader()
  })

  it('/files/ 本地图 → 保持相对路径（E 方案：不压缩不转码，交 localTool 出站回读）', async () => {
    const out = await normalizeImageUrlForSend('/files/a.png')
    expect(out).toBe('/files/a.png')
    // 不再触发前端压缩（压缩下移到 localTool 出站 resolveLocalImages）
    expect(compressImage).not.toHaveBeenCalled()
    expect(httpRequest).not.toHaveBeenCalled()
  })

  it('data: 本地 base64 → 压缩后 base64（同样不 fetch）', async () => {
    const out = await normalizeImageUrlForSend('data:image/png;base64,xxx')
    expect(out).toBe('data:image/png;base64,compressed:data:image/png;base64,xxx')
    expect(httpRequest).not.toHaveBeenCalled()
  })

  it('blob: 本地图 → 压缩后 base64（走 compressImage，不 fetch 转 blob）', async () => {
    const out = await normalizeImageUrlForSend('blob:http://x/abc')
    expect(out).toBe('data:image/png;base64,compressed:blob:http://x/abc')
    expect(httpRequest).not.toHaveBeenCalled()
  })

  it('公网 http(s) 图 → 原样透传，不压缩、不 fetch', async () => {
    await expect(normalizeImageUrlForSend('http://x/a.png')).resolves.toBe('http://x/a.png')
    await expect(normalizeImageUrlForSend('https://cdn/y.jpg')).resolves.toBe('https://cdn/y.jpg')
    expect(compressImage).not.toHaveBeenCalled()
    expect(httpRequest).not.toHaveBeenCalled()
  })

  it('裸 base64（无 data: 前缀）→ 原样透传（网关可解析）', async () => {
    await expect(normalizeImageUrlForSend('iVBORw0KGgo=')).resolves.toBe('iVBORw0KGgo=')
  })

  it('blob: 本地图压缩失败 → 回退 blob 转 data base64（失败可见，不阻断发送）', async () => {
    // vi.mock'd 模块导入的函数：直接用 mock 方法会 TS2339，须包 vi.mocked（踩坑记录 #10）
    vi.mocked(compressImage).mockRejectedValueOnce(new Error('canvas tainted'))
    vi.mocked(httpRequest).mockResolvedValueOnce({ blob: async () => ({ _dataUrl: 'data:image/png;base64,stubdata' }) })
    const out = await normalizeImageUrlForSend('blob:http://x/abc')
    expect(out).toBe('data:image/png;base64,stubdata')
  })

  it('preferBase64=true：本地图同样压缩转 base64（压缩结果即 base64）', async () => {
    const out = await normalizeImageUrlForSend('/files/c.png', { preferBase64: true })
    expect(out).toBe('data:image/png;base64,compressed:http://127.0.0.1:18080/files/c.png')
    expect(compressImage).toHaveBeenCalledWith('http://127.0.0.1:18080/files/c.png', { maxSize: 1920, keepOriginalFormat: true })
    expect(httpRequest).not.toHaveBeenCalled()
  })

  it('preferBase64=true：公网图保持原尺寸转 base64（不压缩）', async () => {
    vi.mocked(httpRequest).mockResolvedValueOnce({ blob: async () => ({ _dataUrl: 'data:image/jpeg;base64,publicdata' }) })
    const out = await normalizeImageUrlForSend('http://x/a.png', { preferBase64: true })
    expect(out).toBe('data:image/jpeg;base64,publicdata')
    expect(compressImage).not.toHaveBeenCalled()
    expect(httpRequest).toHaveBeenCalledWith('http://x/a.png', expect.anything())
  })

  it('normalizeImageUrlsForSend：数组并行归一 + 过滤空值（本地图压缩、公网原样）', async () => {
    const out = await normalizeImageUrlsForSend(['http://x/a.png', 'blob:http://x/b', '', null, undefined])
    expect(out).toEqual(['http://x/a.png', 'data:image/png;base64,compressed:blob:http://x/b'])
  })

  // ── 发送侧防线：缩略图端点 URL 绝不允许发出去（系统性根因治理，见 imageUrl.js thumbnailToOriginal）──
  it('发送缩略图端点 URL → 自动还原为原图相对 /files/（E 方案：不把 render 小图发给网关，也不压缩）', async () => {
    const thumb = buildThumbnailUrl('/files/tasks/x.png', { maxDim: 320 })
    // 断言输入确实是缩略图端点（构造正确）
    expect(thumb).toMatch(/\/api\/files\/thumbnail\?/)
    const out = await normalizeImageUrlForSend(thumb)
    // 缩略图端点 → thumbnailToOriginal 还原为本地原图 → 保持相对 /files/（交 localTool 出站回读）
    expect(out).toBe('/files/tasks/x.png')
    expect(compressImage).not.toHaveBeenCalled()
  })

  it('发送缩略图端点（绝对本地形态）→ 还原为原图相对 /files/', async () => {
    const thumb = buildThumbnailUrl('http://127.0.0.1:18080/files/tasks/x.png', { maxDim: 320 })
    const out = await normalizeImageUrlForSend(thumb)
    expect(out).toBe('/files/tasks/x.png')
  })

  it('preferBase64=true 的缩略图端点 → 还原原图后压缩转 base64（同样不发缩略图）', async () => {
    const thumb = buildThumbnailUrl('/files/tasks/x.png', { maxDim: 320 })
    const out = await normalizeImageUrlForSend(thumb, { preferBase64: true })
    expect(out).toBe('data:image/png;base64,compressed:http://127.0.0.1:18080/files/tasks/x.png')
  })

  it('普通原图 URL（绝对本地 http 但非缩略图）→ 判定本地 → 保持相对 /files/（不是公网原样，也不压缩）', async () => {
    // 绝对 http 指向 127.0.0.1/files/ = 本地文件，归一为相对 /files/（E 方案：交 localTool 出站回读）
    const out = await normalizeImageUrlForSend('http://127.0.0.1:18080/files/tasks/x.png')
    expect(out).toBe('/files/tasks/x.png')
    expect(compressImage).not.toHaveBeenCalled()
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
    expect(toImageContentBlocks(undefined)).toEqual([])
    expect(toImageContentBlocks(null)).toEqual([])
  })
})

// ── fileToDataUrl：本地 File/Blob → data base64（发送附件统一收口，见 M4）──
describe('imageUrl · fileToDataUrl（本地文件→dataURL 收口）', () => {
  beforeEach(() => stubFileReader())

  it('File → data: base64（FileReader 收口，供发送附件，result 透传）', async () => {
    // 参数是 Blob；测试用带 _dataUrl 的替身（stub FileReader 读它），故 as unknown as 收尾
    await expect(fileToDataUrl({ _dataUrl: 'data:image/png;base64,fileimg' } as unknown as Blob)).resolves.toBe('data:image/png;base64,fileimg')
  })

  it('无自定义 result → 使用 FileReader 默认读取结果', async () => {
    await expect(fileToDataUrl({} as unknown as Blob)).resolves.toBe('data:image/png;base64,stubdata')
  })
})

// ── classifyImageType / summarizeImages：带图可观测（发送图片形态分类）──
describe('imageUrl · classifyImageType / summarizeImages（发送图片可观测）', () => {
  it('classifyImageType：data: → base64，其余 → url', () => {
    expect(classifyImageType('data:image/png;base64,xxx')).toBe('base64')
    expect(classifyImageType('http://x/a.png')).toBe('url')
    expect(classifyImageType('/files/a.png')).toBe('url')
    expect(classifyImageType('blob:http://x/abc')).toBe('url')
    expect(classifyImageType('iVBORw0KGgo=')).toBe('url') // 裸 base64 无 data: 前缀按 url 处理
    expect(classifyImageType('')).toBe('url')
    expect(classifyImageType(null)).toBe('url')
  })

  it('summarizeImages：混合 URL/base64 → 正确统计且不携带图片内容', () => {
    const s = summarizeImages(['http://a.png', 'data:image/png;base64,xxx', '/files/b.png', '', null])
    expect(s).toEqual({ count: 3, urls: 2, base64s: 1 })
  })

  it('summarizeImages：空/无 → count=0', () => {
    expect(summarizeImages([])).toEqual({ count: 0, urls: 0, base64s: 0 })
    expect(summarizeImages(null)).toEqual({ count: 0, urls: 0, base64s: 0 })
  })

  it('normalizeImageUrlsForSend 带图发送 → 记一条图片形态 info 日志（可观测）', async () => {
    vi.mocked(logger.info).mockClear()
    await normalizeImageUrlsForSend(['http://a.png', 'data:image/png;base64,xxx'])
    expect(logger.info).toHaveBeenCalledWith('imageUrl', '发送图片', { count: 2, urls: 1, base64s: 1, total: 2 })
  })

  it('normalizeImageUrlsForSend 无图 → 不记发送日志', async () => {
    vi.mocked(logger.info).mockClear()
    await normalizeImageUrlsForSend([], { preferBase64: true })
    expect(logger.info).not.toHaveBeenCalled()
  })
})
