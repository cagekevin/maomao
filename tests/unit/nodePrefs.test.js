import { describe, it, expect, beforeEach } from 'vitest'
import { getNodePrefs, injectNodePrefs } from '../../src/components/base/nodePrefs.ts'
import { contentSet, contentClearCache } from '../../src/components/base/contentStore.js'

// 记忆写入必须走业务唯一入口 contentSet（带 yimao: 前缀 + STORAGE_KEYS 登记），
// 禁止裸写 localStorage（会绕开前缀导致读不到，正是记忆功能失效的坑）。
beforeEach(() => {
  localStorage.clear()
  contentClearCache()
})

describe('getNodePrefs', () => {
  it('无记忆时返回默认值', () => {
    expect(getNodePrefs('promptNode', { model: '', aspectRatio: 'Auto', imageSize: '1K' })).toEqual({
      model: '',
      aspectRatio: 'Auto',
      imageSize: '1K',
    })
  })

  it('有记忆时合并覆盖', () => {
    contentSet('yimao_node_prefs', { promptNode: { aspectRatio: '16:9', imageSize: '2K' } })
    expect(getNodePrefs('promptNode', { model: '', aspectRatio: 'Auto', imageSize: '1K' })).toEqual({
      model: '',
      aspectRatio: '16:9',
      imageSize: '2K',
    })
  })
})

describe('injectNodePrefs（新建注入，不污染存量）', () => {
  it('新建节点：data 缺字段时注入记忆值', () => {
    contentSet('yimao_node_prefs', { promptNode: { model: 'm1', aspectRatio: '16:9', imageSize: '2K' } })
    const data = injectNodePrefs('promptNode', {})
    // 新建节点沿用上次参数
    expect(data.selectedModel).toBe('m1')
    expect(data.aspectRatio).toBe('16:9')
    expect(data.imageSize).toBe('2K')
  })

  it('传入优先于记忆：已显式传的字段不被记忆覆盖', () => {
    contentSet('yimao_node_prefs', { promptNode: { aspectRatio: '16:9', imageSize: '2K' } })
    const data = injectNodePrefs('promptNode', { aspectRatio: '1:1' })
    // 显式传入的 1:1 保留；未传的 imageSize 用记忆
    expect(data.aspectRatio).toBe('1:1')
    expect(data.imageSize).toBe('2K')
  })

  it('未知类型不注入（快照还原/未登记节点安全）', () => {
    contentSet('yimao_node_prefs', { scriptBoxNode: { foo: 'bar' } })
    const data = injectNodePrefs('scriptBoxNode', {})
    expect(data).toEqual({})
  })

  it('记忆为空时回退纯常量默认', () => {
    const data = injectNodePrefs('promptNode', {})
    expect(data.aspectRatio).toBe('Auto')
    expect(data.imageSize).toBe('1K')
    expect(data.selectedModel).toBe('')
  })
})
