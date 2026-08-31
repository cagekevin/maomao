// @vitest-environment jsdom
/**
 * useAssetDragToCanvas 单测（批 3）。
 * 覆盖：
 *   - makeAssetDragProps(asset, opts)：asset={url,name,type}
 *       · 有 url → draggable=true，onDragStart 写 application/x-yimao-asset 与 effectAllowed=copy
 *       · 文字素材(type==='text') 走异步 fetchText 补全 text（测试中 mock fetch）
 *       · opts.disable=true 或 无 url → draggable=false，onDragStart 不写数据
 *   - useAssetDragToCanvas()：返回 { assetDragProps }，等价于 makeAssetDragProps
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'

const { makeAssetDragProps, useAssetDragToCanvas, fetchText, textCache } = await import('../../src/hooks/useAssetDragToCanvas.ts')

const fetchMock = globalThis.fetch

function fakeDataTransfer() {
  const store = {}
  return {
    setData: (k, v) => { store[k] = v },
    getData: (k) => store[k],
    setDragImage: vi.fn(),
    effectAllowed: '',
    _store: store,
  }
}

describe('makeAssetDragProps', () => {
  beforeEach(() => {
    textCache.clear()
    fetchMock.mockClear()
  })

  it('有 url → draggable=true，拖动写入 x-yimao-asset 信封 + copy 语义', () => {
    const props = makeAssetDragProps({ url: 'http://x/y.png', name: '图', type: 'image' })
    // 源码 dragEnabled = asset && asset.url → draggable 为「真值 URL 字符串」
    expect(props.draggable).toBeTruthy()
    const dt = fakeDataTransfer()
    props.onDragStart({ dataTransfer: dt })
    const parsed = JSON.parse(dt.getData('application/x-yimao-asset'))
    expect(parsed).toMatchObject({ url: 'http://x/y.png', name: '图', type: 'image' })
    expect(dt.effectAllowed).toBe('copy')
  })

  it('无 url → draggable 假值，且 onDragStart 不写数据', () => {
    const props = makeAssetDragProps({ name: '无图' })
    expect(props.draggable).toBeFalsy()
    const dt = fakeDataTransfer()
    props.onDragStart({ dataTransfer: dt })
    expect(dt.getData('application/x-yimao-asset')).toBeFalsy()
  })

  it('opts.disable=true → 禁用拖拽', () => {
    const props = makeAssetDragProps({ url: 'http://x/y.png' }, { disable: true })
    expect(props.draggable).toBeFalsy()
  })

  it('文字素材 → 异步 fetchText 补全 text 字段', async () => {
    fetchMock.mockImplementation(() => Promise.resolve({ ok: true, text: async () => '正文内容' }))
    const props = makeAssetDragProps({ url: 'http://x/t.txt', name: '文', type: 'text' })
    const dt = fakeDataTransfer()
    props.onDragStart({ dataTransfer: dt })
    // 初次仅有 url/name/type
    const first = JSON.parse(dt.getData('application/x-yimao-asset'))
    expect(first.text).toBeUndefined()
    await new Promise((r) => setTimeout(r, 10))
    const updated = JSON.parse(dt.getData('application/x-yimao-asset'))
    expect(updated.text).toBe('正文内容')
    expect(textCache.get('http://x/t.txt')).toBe('正文内容')
  })
})

describe('useAssetDragToCanvas', () => {
  it('返回 { assetDragProps } 等价于 makeAssetDragProps', () => {
    const { result } = renderHook(() => useAssetDragToCanvas())
    expect(typeof result.current.assetDragProps).toBe('function')
    const props = result.current.assetDragProps({ url: 'http://x/y.png', name: '图', type: 'image' })
    expect(props.draggable).toBeTruthy()
    const dt = fakeDataTransfer()
    props.onDragStart({ dataTransfer: dt })
    expect(JSON.parse(dt.getData('application/x-yimao-asset')).url).toBe('http://x/y.png')
  })
})
