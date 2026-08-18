import { describe, it, expect, vi, beforeEach } from 'vitest'

// 内存 KV / 项目后端 mock
const mem = new Map()
vi.mock('../../src/components/base/kvStore.js', () => ({
  storageGet: vi.fn(async (k) => (mem.has(k) ? mem.get(k) : null)),
  storageSet: vi.fn(async (k, v) => { mem.set(k, v) }),
  storageDelete: vi.fn(async (k) => { mem.delete(k) }),
  kvGet: vi.fn(async (k) => (mem.has(k) ? mem.get(k) : null)),
  kvSet: vi.fn(async (k, v) => { mem.set(k, v) }),
  CANVAS_STATE_PREFIX: 'canvas-state-v1-',
}))
vi.mock('../../src/components/base/localToolApi.js', () => ({
  fetchProjects: vi.fn(async () => ({ projects: [], lastOpened: '' })),
  saveProjects: vi.fn(async () => ({ ok: true })),
}))

// projectStore 是模块级单例，每次测试前 resetModules 后用动态 import 重新加载（干净状态）
let projectStore
beforeEach(async () => {
  mem.clear()
  localStorage.clear()
  vi.resetModules()
  projectStore = await import('../../src/components/base/projectStore.js')
})

describe('项目系统 §2.8', () => {
  it('默认项目存在', () => {
    expect(projectStore.getCurrentProject().id).toBe('default')
  })

  it('createProject 新建并切换当前', () => {
    const p = projectStore.createProject('项目A')
    expect(p.id).toBeTruthy()
    expect(p.name).toBe('项目A')
    expect(projectStore.getCurrentProject().id).toBe(p.id)
  })

  it('switchProject 切到目标', () => {
    const a = projectStore.createProject('A')
    const b = projectStore.createProject('B')
    expect(projectStore.getCurrentProject().id).toBe(b.id)
    projectStore.switchProject(a.id)
    expect(projectStore.getCurrentProject().id).toBe(a.id)
  })

  it('deleteProject 至少保留 1 个', () => {
    expect(projectStore.deleteProject('default')).toBe(false) // 只有 default，删不掉
    const a = projectStore.createProject('A')
    expect(projectStore.deleteProject(a.id)).toBe(true)
  })

  it('renameProject 改名', () => {
    const a = projectStore.createProject('A')
    projectStore.renameProject(a.id, 'A改名')
    expect(projectStore.getCurrentProject().name).toBe('A改名')
  })

  it('saveCanvasState 空画布跳过保存（防误清空）', async () => {
    const r = await projectStore.saveCanvasState('default', [], [])
    expect(r.skipped).toBe(true)
    const loaded = await projectStore.loadCanvasState('default')
    expect(loaded).toBeNull()
  })

  it('saveCanvasState 落盘后 loadCanvasState 可恢复', async () => {
    const nodes = [{ id: 'n1', type: 'textNode', data: { text: 'hi' }, position: { x: 1, y: 2 }, selected: true, measured: { w: 100 } }]
    const edges = [{ id: 'e1', source: 'n1', target: 'n2', selected: false }]
    const r = await projectStore.saveCanvasState('default', nodes, edges)
    expect(r.success).toBe(true)
    const loaded = await projectStore.loadCanvasState('default')
    expect(loaded.nodes).toHaveLength(1)
    // 白名单清理：selected/measured 被去除，id/type/position/data 保留
    expect(loaded.nodes[0].selected).toBeUndefined()
    expect(loaded.nodes[0].measured).toBeUndefined()
    expect(loaded.nodes[0].id).toBe('n1')
    expect(loaded.nodes[0].data.text).toBe('hi')
    expect(loaded.edges[0].source).toBe('n1')
    expect(loaded.edges[0].selected).toBeUndefined()
  })

  it('saveCanvasState 版本冲突：远程版本更高拒绝覆盖', async () => {
    await projectStore.saveCanvasState('default', [{ id: 'n1', type: 'textNode', data: {}, position: {} }], [])
    // 模拟远程已有更高版本
    mem.set('canvas-state-v1-default_version', String(Date.now() + 100000))
    const r = await projectStore.saveCanvasState('default', [{ id: 'n2', type: 'imageNode', data: {}, position: {} }], [])
    expect(r.success).toBe(false)
    expect(r.conflictVersion).toBeTruthy()
  })

  it('saveCanvasState 版本号单调递增（TASK-053②）', async () => {
    const n = [{ id: 'n1', type: 'textNode', data: {}, position: {} }]
    await projectStore.saveCanvasState('default', n, [])
    const v1 = Number(mem.get('canvas-state-v1-default_version'))
    await projectStore.saveCanvasState('default', n, [])
    const v2 = Number(mem.get('canvas-state-v1-default_version'))
    await projectStore.saveCanvasState('default', n, [])
    const v3 = Number(mem.get('canvas-state-v1-default_version'))
    // 同一会话内连续保存版本号必须严格递增（同毫秒也自增，避免新旧倒挂）
    expect(v1).toBeGreaterThan(0)
    expect(v2).toBeGreaterThan(v1)
    expect(v3).toBeGreaterThan(v2)
  })

  it('saveCanvasState 与远程同版本号时自增不误判冲突', async () => {
    const n = [{ id: 'n1', type: 'textNode', data: {}, position: {} }]
    await projectStore.saveCanvasState('default', n, [])
    const v1 = Number(mem.get('canvas-state-v1-default_version'))
    // 远程版本与本地相同（同毫秒碰撞场景）：应自增写入，而非误判冲突
    mem.set('canvas-state-v1-default_version', String(v1))
    const r = await projectStore.saveCanvasState('default', n, [])
    expect(r.success).toBe(true)
    expect(Number(mem.get('canvas-state-v1-default_version'))).toBeGreaterThan(v1)
  })
})
