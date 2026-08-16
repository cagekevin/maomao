import { describe, it, expect } from 'vitest'
import { toAbsoluteFileUrl, normalizeImageUrl } from '../../src/components/base/imageUrl.js'

// API_BASE 在 apiBase.js 硬编码为 http://127.0.0.1:18080
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
