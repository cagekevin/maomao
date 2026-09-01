import { describe, it, expect } from 'vitest'
import { encodeRefToken, parseRefTokensFromText } from '../../src/components/base/refToken.ts'

describe('refToken · 参考图 token 编解码（对齐大雄 agentEncodeRefToken/agentParseRefTokensFromText）', () => {
  it('encodeRefToken：url 为空返回空串', () => {
    expect(encodeRefToken({})).toBe('')
    expect(encodeRefToken({ url: '' })).toBe('')
  })

  it('encodeRefToken：编码成自包含 token（含 url/name/node/坐标/编号）', () => {
    const t = encodeRefToken({ url: 'http://x/a.png', name: '黑猫', nodeId: 'n1', x: 100, y: 200, refIndex: 1 })
    expect(t).toContain('[参考图1:黑猫]') // 人类可读前缀
    expect(t).toContain('{{agent-ref url="')
    expect(t).toContain('node="n1"')
    expect(t).toContain('x="100"')
    expect(t).toContain('y="200"')
    // url/name 等被 URL 编码（对齐大雄 encodeURIComponent），解码后可还原
    const img = parseRefTokensFromText(t).find((n) => n.type === 'image')
    expect(img.url).toBe('http://x/a.png')
    expect(img.name).toBe('黑猫')
    expect(img.nodeId).toBe('n1')
    expect(img.refIndex).toBe(1)
  })

  it('encodeRefToken：特殊字符（URL 带 query）URL 编码后仍可解码还原', () => {
    const t = encodeRefToken({ url: 'http://x/a.png?v=1&w=2', name: '图', refIndex: 2 })
    const nodes = parseRefTokensFromText(t)
    expect(nodes.some((n) => n.type === 'image')).toBe(true)
    const img = nodes.find((n) => n.type === 'image')
    expect(img.url).toBe('http://x/a.png?v=1&w=2')
    expect(img.refIndex).toBe(2)
  })

  it('parseRefTokensFromText：解析 token 文本还原图 + 保留前后文字', () => {
    const token = encodeRefToken({ url: 'http://x/a.png', name: 'A', refIndex: 1 })
    const nodes = parseRefTokensFromText(`开头 ${token} 结尾`)
    expect(nodes[0]).toEqual({ type: 'text', text: '开头 ' })
    expect(nodes[1]).toMatchObject({ type: 'image', url: 'http://x/a.png', name: 'A', refIndex: 1 })
    expect(nodes[2]).toEqual({ type: 'text', text: ' 结尾' })
  })

  it('parseRefTokensFromText：无 token 的纯文本返回空数组', () => {
    expect(parseRefTokensFromText('普通文字')).toEqual([])
  })

  it('parseRefTokensFromText：旧格式 [参考图N:name] 结合 knownImages 反查 url', () => {
    const known = [{ type: 'image' as const, url: 'http://x/a.png', name: '黑猫', refIndex: 1 }]
    const nodes = parseRefTokensFromText('[参考图1:黑猫] 把它改白', known)
    const img = nodes.find((n) => n.type === 'image')
    expect(img).toMatchObject({ type: 'image', url: 'http://x/a.png', refIndex: 1 })
  })

  it('parseRefTokensFromText：旧格式但 knownImages 无匹配 → 保留原文本（不静默丢信息）', () => {
    const nodes = parseRefTokensFromText('[参考图1:不存在的图] 文字', [])
    expect(nodes.some((n) => n.type === 'image')).toBe(false)
  })
})
