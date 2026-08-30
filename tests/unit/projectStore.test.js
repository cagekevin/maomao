import { describe, it, expect, vi, beforeEach } from 'vitest'
import { flushAsync } from './_testUtils.mjs'

// 内存 KV / 项目后端 mock
const mem = new Map()
// fetchProjects 返回可变 payload（供 initProjects 回退链测试注入后端响应）
const projectsPayload = { projects: [], lastOpened: '' }
vi.mock('../../src/components/base/kvStore.ts', () => ({
  storageGet: vi.fn(async (k) => (mem.has(k) ? mem.get(k) : null)),
  storageSet: vi.fn(async (k, v) => { mem.set(k, v) }),
  storageDelete: vi.fn(async (k) => { mem.delete(k) }),
  kvGet: vi.fn(async (k) => (mem.has(k) ? mem.get(k) : null)),
  kvSet: vi.fn(async (k, v) => { mem.set(k, v) }),
  CANVAS_STATE_PREFIX: 'canvas-state-v1-',
}))
vi.mock('../../src/components/base/localToolApi.ts', () => ({
  fetchProjects: vi.fn(async () => ({ data: { ...projectsPayload } })),
  saveProjects: vi.fn(async () => ({ ok: true })),
}))

// projectStore 是模块级单例，每次测试前 resetModules 后用动态 import 重新加载（干净状态）
let projectStore
beforeEach(async () => {
  mem.clear()
  localStorage.clear()
  projectsPayload.projects = []
  projectsPayload.lastOpened = ''
  vi.resetModules()
  projectStore = await import('../../src/components/base/projectStore.ts')
})

describe('项目系统 §2.8', () => {
  it('initProjects lastOpened 命中时切到该项目（B0·缺口⑪）', async () => {
    projectsPayload.projects = [{ id: 'p1', name: 'P1' }, { id: 'p2', name: 'P2' }]
    projectsPayload.lastOpened = 'p2'
    projectStore.initProjects()
    // initProjects 是同步触发 fetch，微任务后生效
    await flushAsync()
    expect(projectStore.getCurrentProject().id).toBe('p2')
  })

  it('initProjects lastOpened 不存在时回退到 list[0]（B0·缺口⑪）', async () => {
    projectsPayload.projects = [{ id: 'p1', name: 'P1' }, { id: 'p2', name: 'P2' }]
    projectsPayload.lastOpened = 'ghost-not-exist'
    projectStore.initProjects()
    await flushAsync()
    expect(projectStore.getCurrentProject().id).toBe('p1')
  })

  it('initProjects 空列表时不做替换（保持 default 兜底）（B0·缺口⑪）', async () => {
    projectsPayload.projects = []
    projectStore.initProjects()
    await flushAsync()
    expect(projectStore.getCurrentProject().id).toBe('default')
  })

  it('initProjects 后端缺本地独有项目 → 合并保留本地（防刷新丢项目）', async () => {
    // 模拟「上一会话新建了项目X」：先 createProject 让内存 projects 含 X（含 persist 到 localStorage 兜底）
    const x = projectStore.createProject('新建项目X')
    // 后端因 saveProjects 失败/双页面覆盖缺失 X（只返回 default）
    projectsPayload.projects = [{ id: 'default', name: '默认项目' }]
    projectStore.initProjects()
    await flushAsync()
    // X 不能被后端缺项冲掉
    expect(projectStore.switchProject(x.id).name).toBe('新建项目X')
  })

  it('initProjects 后端有新项目（本地旧列表）→ 合并保留后端独有', async () => {
    localStorage.setItem('projects', JSON.stringify([{ id: 'default', name: '默认项目' }]))
    projectsPayload.projects = [
      { id: 'default', name: '默认项目' },
      { id: 'proj-Y', name: '后端项目Y' },
    ]
    projectStore.initProjects()
    await flushAsync()
    expect(projectStore.switchProject('proj-Y').name).toBe('后端项目Y')
  })

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

  it('saveCanvasState 传入 viewport 后 loadCanvasState 可恢复视窗（P20）', async () => {
    const nodes = [{ id: 'n1', type: 'textNode', data: {}, position: { x: 0, y: 0 } }]
    const r = await projectStore.saveCanvasState('default', nodes, [], { x: 120, y: -50, zoom: 1.5 })
    expect(r.success).toBe(true)
    const loaded = await projectStore.loadCanvasState('default')
    expect(loaded.viewport).toEqual({ x: 120, y: -50, zoom: 1.5 })
  })

  it('saveCanvasState 不传 viewport → 快照无 viewport 字段，loadCanvasState 返回 null（P20 兼容旧快照）', async () => {
    const nodes = [{ id: 'n1', type: 'textNode', data: {}, position: { x: 0, y: 0 } }]
    await projectStore.saveCanvasState('default', nodes, [])
    const loaded = await projectStore.loadCanvasState('default')
    expect(loaded.viewport).toBeNull()
  })

  it('落盘白名单保留编组所需字段（parentId/extent/style/width/height）→ 刷新后尺寸与父关系不丢', async () => {
    // 模拟编组后的节点：group 带 width/height/style/initialWidth，子节点带 parentId + 相对坐标
    const group = { id: 'g1', type: 'group', position: { x: 160, y: 160 }, width: 780, height: 530, style: { width: 780, height: 530 }, initialWidth: 780, initialHeight: 530, data: { name: '编组' } }
    const child = { id: 'a', type: 'imageNode', position: { x: 40, y: 40 }, parentId: 'g1', style: { width: 300, height: 200 }, data: {} }
    const r = await projectStore.saveCanvasState('default', [group, child], [])
    expect(r.success).toBe(true)
    const loaded = await projectStore.loadCanvasState('default')
    expect(loaded.nodes).toHaveLength(2)
    const g = loaded.nodes.find((n) => n.type === 'group')
    const c = loaded.nodes.find((n) => n.id === 'a')
    // 尺寸保真：width/height/style/initialWidth 必须保留（否则刷新后 group 大小塌成 0）
    expect(g.width).toBe(780)
    expect(g.height).toBe(530)
    expect(g.style.width).toBe(780)
    expect(g.style.height).toBe(530)
    expect(g.initialWidth).toBe(780)
    // 父关系保真：子节点 parentId 必须保留（否则相对坐标被当绝对坐标 → 位置乱）
    expect(c.parentId).toBe('g1')
    // 运行时态仍被清理
    expect(g.measured).toBeUndefined()
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
