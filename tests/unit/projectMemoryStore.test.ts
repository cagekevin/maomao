// @vitest-environment node
/**
 * projectMemoryStore（「记」项目级长期记忆）单测。
 * 映射阶段3·定数据流的存储契约：按 agentKey 全局共用（不分项目），60 条上限淘汰最旧，
 * 写入前统一脱敏，CRUD 走 Content 层（contentGetAsync/contentSetAsync/contentDeleteAsync）。
 * 覆盖：脱敏（T1）/ 保存与读取（T2）/ upsert（T3）/ 60 条上限淘汰（T4）/ 删除（T5）/ 不分项目隔离（T6）。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

// 用 vi.hoisted 提供内存态，隔离真实 Content 层 IO，且可任意模块态引用。
const h = vi.hoisted(() => ({ store: new Map() }))

vi.mock('../../src/components/base/contentStore.ts', () => ({
  // 提供 async 三件套即可；其余默认 undefined 不影响本模块导入
  contentGetAsync: vi.fn(async (key) => h.store.get(key)),
  contentSetAsync: vi.fn(async (key, val) => { h.store.set(key, val) }),
  contentDeleteAsync: vi.fn(async (key) => { h.store.delete(key) }),
}))

const mod = await import('../../src/components/agent/runtime/projectMemoryStore.ts')
const { sanitizeMemoryContent, saveProjectMemory, loadProjectMemories, removeProjectMemory, getCachedProjectMemories, PROJECT_MEMORY_LIMIT } = mod

beforeEach(async () => {
  h.store.clear()
  vi.clearAllMocks()
  mod.__resetProjectMemoryCacheForTest()
})

describe('sanitizeMemoryContent —— 脱敏（T1）', () => {
  it('脱敏密钥、凭据、本地路径，压缩空白并截断到上限', () => {
    const dirty = ' 密钥 sk-abcdef1234567890 且 token=SECRET12345 ，本地 /Users/kevin/data/a.png ，多    空格 '
    const clean = sanitizeMemoryContent(dirty)
    expect(clean).toContain('[已脱敏密钥]')
    expect(clean).toContain('[已脱敏凭据]')
    expect(clean).toContain('[本地路径]')
    expect(clean).not.toMatch(/sk-abcdef/)
    expect(clean).not.toMatch(/token=SECRET/)
    expect(clean).not.toMatch(/\/Users\//)
    expect(clean).not.toMatch(/\s{2,}/)
  })

  it('超长内容截断到 PROJECT_MEMORY_CONTENT_LIMIT', () => {
    const clean = sanitizeMemoryContent('a'.repeat(900))
    expect(clean.length).toBeLessThanOrEqual(500)
  })

  it('空/非字符串安全返回空串', () => {
    expect(sanitizeMemoryContent('')).toBe('')
    expect(sanitizeMemoryContent(null)).toBe('')
  })
})

describe('saveProjectMemory / loadProjectMemories —— 保存与读取（T2）', () => {
  it('保存后可从缓存同步读到，字段齐全且排序更新时间降序', async () => {
    await saveProjectMemory('gw', { id: 'm1', kind: 'decision', content: '采用方案一', updatedAt: 200 })
    const list = getCachedProjectMemories('gw')
    expect(list).toHaveLength(1)
    expect(list[0]).toMatchObject({ id: 'm1', kind: 'decision', content: '采用方案一', enabled: true })
    expect(typeof list[0].createdAt).toBe('number')
    // 落盘到 Content 层
    expect(h.store.has('agent_project_memory_v1_gw')).toBe(true)
  })

  it('kind 非法时回退 fact，content 超长截断', async () => {
    const saved = await saveProjectMemory('gw', { kind: 'badKind' as any, content: 'c'.repeat(600) })
    expect(saved.kind).toBe('fact')
    expect(saved.content.length).toBeLessThanOrEqual(500)
  })

  it('未显式传 id 时自动生成', async () => {
    const saved = await saveProjectMemory('gw', { kind: 'fact', content: '自动id' })
    expect(typeof saved.id).toBe('string')
    expect(saved.id).not.toBe('')
  })
})

describe('saveProjectMemory —— upsert（T3）', () => {
  it('同 id 再次保存就地更新，不新增条数', async () => {
    await saveProjectMemory('gw', { id: 'm1', kind: 'fact', content: 'v1', updatedAt: 100 })
    await saveProjectMemory('gw', { id: 'm1', kind: 'decision', content: 'v2', updatedAt: 200 })
    const list = getCachedProjectMemories('gw')
    expect(list).toHaveLength(1)
    expect(list[0]).toMatchObject({ id: 'm1', kind: 'decision', content: 'v2' })
  })
})

describe('saveProjectMemory —— 60 条上限淘汰最旧（T4）', () => {
  it(`超过 ${PROJECT_MEMORY_LIMIT} 条时挤出 updatedAt 最早的一条`, async () => {
    const total = PROJECT_MEMORY_LIMIT + 1
    for (let i = 1; i <= total; i += 1) {
      await saveProjectMemory('gw', { id: `m${i}`, kind: 'fact', content: `记忆 ${i}`, updatedAt: i })
    }
    const list = await loadProjectMemories('gw')
    expect(list).toHaveLength(PROJECT_MEMORY_LIMIT)
    // id=m1 的 updatedAt=1 最小，最先被淘汰
    expect(list.some((m) => m.id === 'm1')).toBe(false)
    expect(list[0].id).toBe(`m${total}`) // 最新在最前
  })
})

describe('removeProjectMemory —— 删除（T5）', () => {
  it('删除后缓存与持久态同步移除；不存在幂等', async () => {
    await saveProjectMemory('gw', { id: 'm1', kind: 'fact', content: 'a' })
    await saveProjectMemory('gw', { id: 'm2', kind: 'fact', content: 'b' })
    await removeProjectMemory('gw', '', 'm1')
    expect(getCachedProjectMemories('gw').map((m) => m.id)).toEqual(['m2'])
    // 幂等删除不报错
    await expect(removeProjectMemory('gw', '', 'm1')).resolves.toBeUndefined()
  })
})

describe('不分项目（按 agentKey 全局隔离）（T6）', () => {
  it('不同 agentKey 的记忆互不串扰，projectId 被忽略', async () => {
    await saveProjectMemory('agentA', { id: 'a1', kind: 'fact', content: 'A 记忆' })
    await saveProjectMemory('agentB', { id: 'b1', kind: 'fact', content: 'B 记忆' })
    // 传任意 projectId 都应读到同一份全局记忆
    expect(getCachedProjectMemories('agentA', 'projX').some((m) => m.id === 'a1')).toBe(true)
    expect(getCachedProjectMemories('agentB', 'projY').some((m) => m.id === 'b1')).toBe(true)
    expect(getCachedProjectMemories('agentA').some((m) => m.id === 'b1')).toBe(false)
  })
})