import { describe, it, expect, beforeEach, vi } from 'vitest'

// 隔离 contentStore（避免真实写 localStorage / 触发未登记 warning）
const cache = {}
vi.mock('../../src/components/base/contentStore.js', () => ({
  contentGet: (key) => cache[key],
  contentSet: (key, val) => { cache[key] = val },
}))

describe('提示词社区库 §2.19 数据源', () => {
  it('getPromptHubSources 含 6 个源，且 id/name/url/homepage 齐全且非空', async () => {
    const { getPromptHubSources } = await import('../../src/components/base/promptHubStore.ts')
    const sources = getPromptHubSources()
    expect(sources).toHaveLength(6)
    sources.forEach((s) => {
      expect(s.id && s.name && s.url && s.homepage).toBeTruthy()
      expect(s.url.startsWith('https://')).toBe(true)
    })
  })
})

describe('提示词社区库 §2.19 数据层', () => {
  let fetchImpl
  beforeEach(() => {
    Object.keys(cache).forEach((k) => delete cache[k])
    fetchImpl = null
    vi.stubGlobal('fetch', (url) => (fetchImpl ? fetchImpl(url) : Promise.reject(new Error('no fetch mock'))))
  })

  it('normalizeItems 兜底：缺 title/prompt 的条目被过滤，自动补 id', async () => {
    const { getPromptHubSources } = await import('../../src/components/base/promptHubStore.ts')
    const src = getPromptHubSources()[0]
    const raw = [
      { title: 'A', prompt: 'p1', id: 'a' },
      { title: '', prompt: 'p2' }, // 无 title → 过滤
      { prompt: 'p3' }, // 无 title → 过滤
      { title: 'D', prompt: 'p4' },
      { title: 'D', prompt: 'p4' }, // 缺 id → 两条都自动补，保留
    ]
    // 仅该源 url 返回数据，其余源 reject → 解析为空数组，不污染
    fetchImpl = (url) => (url === src.url ? Promise.resolve({ ok: true, json: () => Promise.resolve(raw) }) : Promise.reject(new Error('skip')))
    const { loadPromptHub } = await import('../../src/components/base/promptHubStore.ts')
    const { items } = await loadPromptHub()
    expect(items.length).toBe(3) // a / 自动补 id 的 D / 第二个 D
    items.forEach((it) => {
      expect(it.id).toBeTruthy()
      expect(it.coverUrl !== undefined).toBe(true)
      expect(Array.isArray(it.tags)).toBe(true)
      expect(it.sourceId).toBe(src.id)
    })
  })

  it('相对 URL 转绝对：coverUrl/referenceImageUrls 按源 url 补全', async () => {
    const { getPromptHubSources } = await import('../../src/components/base/promptHubStore.ts')
    const src = getPromptHubSources()[0]
    const raw = [{ title: 'A', prompt: 'p', coverUrl: './cover.png', referenceImageUrls: ['ref1.png', 'https://x.com/r2.jpg'] }]
    fetchImpl = (url) => (url === src.url ? Promise.resolve({ ok: true, json: () => Promise.resolve(raw) }) : Promise.reject(new Error('skip')))
    const { loadPromptHub } = await import('../../src/components/base/promptHubStore.ts')
    const { items } = await loadPromptHub()
    expect(items[0].coverUrl).toBe(`${src.url.replace(/[^/]+$/, '')}cover.png`)
    expect(items[0].referenceImageUrls[0]).toContain(src.url.replace(/[^/]+$/, ''))
    expect(items[0].referenceImageUrls[1]).toBe('https://x.com/r2.jpg')
  })

  it('源拉取失败不崩：返回空数组并记 lastError，UI 可显示错误', async () => {
    fetchImpl = () => Promise.resolve({ ok: false, status: 500, json: () => Promise.resolve({}) })
    const { loadPromptHub, getPromptHubErrors } = await import('../../src/components/base/promptHubStore.ts')
    const { items } = await loadPromptHub()
    expect(items).toEqual([])
    expect(getPromptHubErrors().length).toBeGreaterThan(0)
  })

  it('缓存生效：TTL 内同源第二次拉取不重复 fetch', async () => {
    const { getPromptHubSources } = await import('../../src/components/base/promptHubStore.ts')
    const src = getPromptHubSources()[0]
    const raw = [{ title: 'A', prompt: 'p' }]
    let calls = 0
    const okJson = (url) => (url === src.url ? (calls += 1, Promise.resolve({ ok: true, json: () => Promise.resolve(raw) })) : Promise.reject(new Error('skip')))
    fetchImpl = okJson
    const { loadPromptHub } = await import('../../src/components/base/promptHubStore.ts')
    await loadPromptHub()
    // 第二次：缓存命中，该源不再 fetch（其余源仍 reject，不算 calls）
    fetchImpl = (url) => (url === src.url ? (calls += 1, Promise.resolve({ ok: true, json: () => Promise.resolve(raw) })) : Promise.reject(new Error('skip')))
    await loadPromptHub()
    expect(calls).toBe(1)
  })

  it('getCachedPromptHub 同步秒显：未过期缓存直接返回数据，且不触发网络/订阅循环', async () => {
    const { getPromptHubSources } = await import('../../src/components/base/promptHubStore.ts')
    const src = getPromptHubSources()[0]
    const raw = [{ title: 'A', prompt: 'p' }]
    fetchImpl = (url) => (url === src.url ? Promise.resolve({ ok: true, json: () => Promise.resolve(raw) }) : Promise.reject(new Error('skip')))
    const { loadPromptHub, getCachedPromptHub } = await import('../../src/components/base/promptHubStore.ts')
    await loadPromptHub() // 先落缓存
    const snap = getCachedPromptHub()
    expect(snap.hasCache).toBe(true)
    expect(snap.items.length).toBe(1)
    expect(snap.items[0].title).toBe('A')
  })
})
