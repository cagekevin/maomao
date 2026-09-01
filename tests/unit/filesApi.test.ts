// @vitest-environment node
/**
 * filesApi 单测（批 2，API 封装层）。
 * 覆盖：saveInlineToLocal / saveResultToTasks / saveTextToTasks / uploadFileToLocal
 * 的成功路径与各类边界（非 data:/blob:/空/fetch 失败 → null，不抛）。
 * 策略：node + mock fetch（/api/files/upload）。依赖全局 Blob/FormData/atob/
 * crypto.subtle（node 18+ 自带；缺失时 stub）。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// 保证 webcrypto 可用（sha1Hex 用 crypto.subtle.digest）
if (!globalThis.crypto?.subtle) {
  // 仅测 sha1Hex 的 digest 路径，cast 为 Crypto 以对齐类型（其余 SubtleCrypto 方法不会被测到）
  globalThis.crypto = {
    subtle: {
      digest: async () => new Uint8Array(20).fill(0xab).buffer,
    },
  } as unknown as Crypto
}

// setup.mjs 已把 globalThis.fetch 定义为共享 vi.fn；此处做类型对齐以启用 .mock* / mock.calls。
const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>

const api = await import('@/components/base/api/filesApi.ts')

function uploadResp(url) {
  return { ok: true, status: 200, json: async () => ({ code: 0, data: { url } }) }
}
function failResp() {
  return { ok: false, status: 500, json: async () => ({}) }
}

beforeEach(() => fetchMock.mockReset())
afterEach(() => vi.unstubAllGlobals())

const DATA_PNG = 'data:image/png;base64,iVBORw0KGgo='

describe('filesApi — saveInlineToLocal', () => {
  it('合法 data: URL → 落盘返回 18080 绝对地址', async () => {
    fetchMock.mockResolvedValue(uploadResp('http://127.0.0.1:18080/files/canvas/abc.png'))
    const url = await api.saveInlineToLocal(DATA_PNG)
    expect(url).toBe('http://127.0.0.1:18080/files/canvas/abc.png')
  })
  it('data: URL → 幂等去重文件名（sha1 40 位十六进制）+ subfolder 透传', async () => {
    fetchMock.mockResolvedValue(uploadResp('http://127.0.0.1:18080/files/canvas/abc.png'))
    await api.saveInlineToLocal(DATA_PNG, 'canvas')
    const [, opts] = fetchMock.mock.calls[0]
    for (const [k, v] of opts.body.entries()) {
      if (k === 'file') expect(v.name).toMatch(/^[a-f0-9]{40}\.png$/)
      if (k === 'subfolder') expect(v).toBe('canvas')
    }
  })
  it('非 data: URL → 返回 null（不抛）', async () => {
    expect(await api.saveInlineToLocal('http://x/y.png')).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })
  it('上传失败 → 返回 null', async () => {
    fetchMock.mockResolvedValue(failResp())
    expect(await api.saveInlineToLocal(DATA_PNG)).toBeNull()
  })
})

describe('filesApi — saveResultToTasks', () => {
  it('data: 结果 → 落盘 tasks 目录返回 url', async () => {
    fetchMock.mockResolvedValue(uploadResp('http://127.0.0.1:18080/files/tasks/gen.png'))
    expect(await api.saveResultToTasks(DATA_PNG, 'image')).toBe('http://127.0.0.1:18080/files/tasks/gen.png')
  })
  it('blob: 临时地址 → 直接返回 null（上传无意义）', async () => {
    expect(await api.saveResultToTasks('blob:http://x/y', 'image')).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })
  it('http 上游 url → fileUrl 幂等下载落盘', async () => {
    fetchMock.mockResolvedValue(uploadResp('http://127.0.0.1:18080/files/tasks/up.png'))
    expect(await api.saveResultToTasks('http://cdn/x.png', 'image')).toBe('http://127.0.0.1:18080/files/tasks/up.png')
  })
  it('空 url → null', async () => {
    expect(await api.saveResultToTasks('', 'image')).toBeNull()
  })
})

describe('filesApi — saveResultToTasks 类型→扩展名映射', () => {
  const DATA_PNG = 'data:image/png;base64,iVBORw0KGgo='
  /** 从上传请求的 FormData 里取 file 的原始文件名 */
  function fdFilename(opts) {
    const fd = opts.body
    for (const [k, v] of fd.entries()) {
      if (k === 'file') return v.name
    }
    return ''
  }
  it('type=image → .png', async () => {
    fetchMock.mockResolvedValue(uploadResp('http://x/a.png'))
    await api.saveResultToTasks(DATA_PNG, 'image')
    expect(fdFilename(fetchMock.mock.calls[0][1])).toMatch(/\.png$/)
  })
  it('type=text → .txt', async () => {
    fetchMock.mockResolvedValue(uploadResp('http://x/a.txt'))
    await api.saveResultToTasks(DATA_PNG, 'text')
    expect(fdFilename(fetchMock.mock.calls[0][1])).toMatch(/\.txt$/)
  })
  it('type=video → .mp4', async () => {
    fetchMock.mockResolvedValue(uploadResp('http://x/a.mp4'))
    await api.saveResultToTasks(DATA_PNG, 'video')
    expect(fdFilename(fetchMock.mock.calls[0][1])).toMatch(/\.mp4$/)
  })
  it('type=audio → .m4a', async () => {
    fetchMock.mockResolvedValue(uploadResp('http://x/a.m4a'))
    await api.saveResultToTasks(DATA_PNG, 'audio')
    expect(fdFilename(fetchMock.mock.calls[0][1])).toMatch(/\.m4a$/)
  })
  it('未知 type → 兜底 .bin', async () => {
    fetchMock.mockResolvedValue(uploadResp('http://x/a.bin'))
    await api.saveResultToTasks(DATA_PNG, 'weird')
    expect(fdFilename(fetchMock.mock.calls[0][1])).toMatch(/\.bin$/)
  })
})

describe('filesApi — saveTextToTasks', () => {
  it('合法文本 → 落盘 txt 返回 url', async () => {
    fetchMock.mockResolvedValue(uploadResp('http://127.0.0.1:18080/files/tasks/gen.txt'))
    expect(await api.saveTextToTasks('hello world')).toBe('http://127.0.0.1:18080/files/tasks/gen.txt')
  })
  it('空/非字符串 → null', async () => {
    expect(await api.saveTextToTasks('   ')).toBeNull()
    expect(await api.saveTextToTasks(123 as unknown as string)).toBeNull()
  })
  it('自定义 name 前缀清洗非法字符/空格', async () => {
    fetchMock.mockResolvedValue(uploadResp('http://x/t.txt'))
    await api.saveTextToTasks('内容', 'a/b:c*d?e')
    const [, opts] = fetchMock.mock.calls[0]
    for (const [k, v] of opts.body.entries()) {
      if (k === 'file') expect(v.name).toMatch(/^a_b_c_d_e_\d{8}_\d{6}\.txt$/)
    }
  })
  it('上传失败（!res.ok）→ null 不抛', async () => {
    fetchMock.mockResolvedValue(failResp())
    expect(await api.saveTextToTasks('hi')).toBeNull()
  })
  it('fetch reject → null 不抛', async () => {
    // 首次（落盘上传）抛错；后续（logger 上报 /api/logs）正常，避免未捕获拒绝
    fetchMock
      .mockImplementationOnce(async () => { throw new Error('net') })
      .mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })
    expect(await api.saveTextToTasks('hi')).toBeNull()
  })
})

describe('filesApi — uploadFileToLocal', () => {
  it('原始 File/Blob → 落盘返回 url', async () => {
    fetchMock.mockResolvedValue(uploadResp('http://127.0.0.1:18080/files/canvas/drop/a.png'))
    const file = new Blob(['x'], { type: 'image/png' })
    expect(await api.uploadFileToLocal(file)).toBe('http://127.0.0.1:18080/files/canvas/drop/a.png')
  })
  it('自定义 subfolder 与 filename 生效', async () => {
    fetchMock.mockResolvedValue(uploadResp('http://x/u.png'))
    const file = new File(['x'], 'drop.png', { type: 'image/png' })
    await api.uploadFileToLocal(file, 'gen', 'custom.png')
    const [, opts] = fetchMock.mock.calls[0]
    const fd = opts.body
    for (const [k, v] of fd.entries()) {
      if (k === 'subfolder') expect(v).toBe('gen')
      if (k === 'file') expect(v.name).toBe('custom.png')
    }
  })
  it('无 file → null', async () => {
    expect(await api.uploadFileToLocal(null)).toBeNull()
  })
  it('上传失败（!res.ok）→ null 不抛', async () => {
    fetchMock.mockResolvedValue(failResp())
    expect(await api.uploadFileToLocal(new Blob(['x']))).toBeNull()
  })
  it('fetch reject → null 不抛', async () => {
    // 首次（上传）抛错；后续（logger 上报）正常
    fetchMock
      .mockImplementationOnce(async () => { throw new Error('net') })
      .mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })
    expect(await api.uploadFileToLocal(new Blob(['x']))).toBeNull()
  })
})

describe('filesApi — downloadRemoteToLocal（网页拖图后台本地化）', () => {
  it('http(s) URL → fileUrl 落盘到指定 subfolder 返回 url', async () => {
    fetchMock.mockResolvedValue(uploadResp('http://127.0.0.1:18080/files/web/abc.png'))
    const url = await api.downloadRemoteToLocal('https://x/cat.png', { folder: 'web' })
    expect(url).toBe('http://127.0.0.1:18080/files/web/abc.png')
    const [reqUrl, opts] = fetchMock.mock.calls[0]
    expect(reqUrl).toContain('/api/files/upload')
    const body = JSON.parse(opts.body)
    expect(body.fileUrl).toBe('https://x/cat.png')
    expect(body.subfolder).toBe('web')
  })
  it('默认 folder=canvas（未传 folder 时）', async () => {
    fetchMock.mockResolvedValue(uploadResp('http://x/a.png'))
    await api.downloadRemoteToLocal('http://x/a.png')
    const [, opts] = fetchMock.mock.calls[0]
    expect(JSON.parse(opts.body).subfolder).toBe('canvas')
  })
  it('非 http(s)（data:/blob:/空）→ null 且不发请求', async () => {
    expect(await api.downloadRemoteToLocal('data:image/png;base64,xx')).toBeNull()
    expect(await api.downloadRemoteToLocal('blob:http://x/y')).toBeNull()
    expect(await api.downloadRemoteToLocal('')).toBeNull()
    expect(await api.downloadRemoteToLocal(undefined)).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })
  it('上传失败（!res.ok / fetch reject）→ null 不抛', async () => {
    fetchMock.mockResolvedValue(failResp())
    expect(await api.downloadRemoteToLocal('http://x/a.png')).toBeNull()
    fetchMock
      .mockImplementationOnce(async () => { throw new Error('net') })
      .mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })
    expect(await api.downloadRemoteToLocal('http://x/b.png')).toBeNull()
  })

  // ── 回归护栏（2026-08-28「素材拖到画布 → uploads/web 出现重复文件」）──
  // 素材从素材库拖到画布时，若画布没认出它是素材（缺 application/x-yimao-asset），
  // 会退化成「网页拖图本地化」，把本机的 /files/migrated/... 再下载一份落进 uploads/web。
  // 这里从落盘入口兜底：URL 已指向本机 uploads 时一律不再下载，调用方保持原 URL。
  it('本机 /files/ URL（绝对 + 相对）→ 直接 null 且不发请求（防重复落 web）', async () => {
    expect(await api.downloadRemoteToLocal('http://127.0.0.1:18080/files/migrated/道具/a.png', { folder: 'web' })).toBeNull()
    expect(await api.downloadRemoteToLocal('/files/migrated/a.png', { folder: 'web' })).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })
  it('外网主机上的 /files/ 路径不算本地 → 照常下载（不误伤真实网页图）', async () => {
    fetchMock.mockResolvedValue(uploadResp('http://127.0.0.1:18080/files/web/x.png'))
    expect(await api.downloadRemoteToLocal('https://cdn.example.com/files/a.png', { folder: 'web' }))
      .toBe('http://127.0.0.1:18080/files/web/x.png')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
