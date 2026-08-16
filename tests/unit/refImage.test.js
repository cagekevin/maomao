import { describe, it, expect } from 'vitest'
import { resolveRefImages, toImageContentBlocks } from '../../src/components/base/refImage.js'

describe('refImage §2.4', () => {
  it('toImageContentBlocks 转网关 chat 内容块', () => {
    const blocks = toImageContentBlocks(['http://x/a.png', 'http://x/b.png'])
    expect(blocks).toEqual([
      { type: 'image_url', image_url: { url: 'http://x/a.png' } },
      { type: 'image_url', image_url: { url: 'http://x/b.png' } },
    ])
  })

  it('toImageContentBlocks 空/undefined 返回空数组', () => {
    expect(toImageContentBlocks()).toEqual([])
    expect(toImageContentBlocks(null)).toEqual([])
  })

  it('resolveRefImages 把 /files/ 相对补成绝对（走网关）', async () => {
    const out = await resolveRefImages(['/files/a.png', 'http://x/b.png', 'data:image/png;base64,xxx'])
    expect(out[0]).toBe('http://127.0.0.1:18080/files/a.png')
    expect(out[1]).toBe('http://x/b.png')
    expect(out[2]).toBe('data:image/png;base64,xxx')
  })

  it('resolveRefImages 过滤空值', async () => {
    const out = await resolveRefImages(['/files/a.png', '', null])
    expect(out).toEqual(['http://127.0.0.1:18080/files/a.png'])
  })
})
