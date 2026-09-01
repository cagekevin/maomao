// @vitest-environment jsdom
/**
 * useScriptBoxEngine 单测（批 3）。
 * 覆盖引擎回调注入 hook：
 *   - 挂载后把引擎回调写回 node.data.onXxx（经 setNodes 注入）
 *   - getData 实时从 getNodes 读最新 data
 *   - updateData 经 setNodes 不可变合并
 *   - getProviderState 读 providersRef（避免闭包过期）
 *   - addNodes 经 screenToFlowPosition 偏移落点
 * 通过 vi.mock 隔离 @xyflow/react / scriptBoxEngine / settings/providerStore。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

const setNodes = vi.fn()
const getNodes = vi.fn(() => [{ id: 'sb1', data: { shots: [] } }])
const getNode = vi.fn((nid) => getNodes().find((n) => n.id === nid))
const setEdges = vi.fn()
const addNodes = vi.fn()
const screenToFlowPosition = vi.fn(() => ({ x: 5, y: 7 }))

vi.mock('@xyflow/react', () => ({
  useReactFlow: () => ({ getNodes, getNode, setNodes, setEdges, addNodes, screenToFlowPosition }),
}))

const engineCallbacks = {
  onGenerate: vi.fn(),
  onAddNodes: vi.fn(),
  onUpdate: vi.fn(),
}
const createScriptBoxEngine = vi.fn((cfg) => ({ ...engineCallbacks, __cfg: cfg }))
vi.mock('../../src/components/scriptbox/scriptBoxEngine.ts', () => ({ createScriptBoxEngine: (...a: any[]) => (createScriptBoxEngine as any)(...a) }))

// 节点参数记忆（yimao_node_prefs）落点：nodePrefs 经 contentStore 读写，这里用内存态替代，
// 只让 key 命中 'yimao_node_prefs' 时返回，避免牵动 contentStore 的真实注册/后端逻辑。
let prefsStore = {}
vi.mock('../../src/components/base/contentStore.ts', () => ({
  contentGet: (k) => (k === 'yimao_node_prefs' ? prefsStore : null),
  contentSet: (k, v) => { if (k === 'yimao_node_prefs') prefsStore = v },
}))

const loadProviders = vi.fn(() => Promise.resolve())
const useProvidersList = vi.fn(() => [{ id: 'p1', isPrimary: true }])
vi.mock('../../src/components/base/settings/providerStore.ts', () => ({ useProvidersList: (...a: any[]) => (useProvidersList as any)(...a), load: (...a: any[]) => (loadProviders as any)(...a) }))

const { useScriptBoxEngine } = await import('../../src/hooks/useScriptBoxEngine.ts')

beforeEach(() => {
  setNodes.mockClear()
  getNodes.mockClear()
  getNode.mockClear()
  addNodes.mockClear()
  createScriptBoxEngine.mockClear()
  loadProviders.mockClear()
  useProvidersList.mockReturnValue([{ id: 'p1', isPrimary: true }])
  prefsStore = {}
})

function injectCall() {
  // 找到注入 node.data.onXxx 的 setNodes 调用（带 map）
  const call = setNodes.mock.calls.find((c) => typeof c[0] === 'function')
  if (!call) throw new Error('setNodes 注入未触发')
  return call[0]([{ id: 'sb1', data: {} }])[0]
}

describe('useScriptBoxEngine', () => {
  it('挂载后把引擎回调注入 node.data.onXxx', () => {
    renderHook(() => useScriptBoxEngine('sb1', { shots: [] }))
    const node = injectCall()
    expect(node.data.onGenerate).toBeTypeOf('function')
    expect(node.data.onAddNodes).toBeTypeOf('function')
    expect(node.data.onUpdate).toBeTypeOf('function')
  })

  it('createScriptBoxEngine 用最新 data（getData 读 getNodes）', () => {
    renderHook(() => useScriptBoxEngine('sb1', { shots: [] }))
    const cfg = createScriptBoxEngine.mock.calls[0][0]
    expect(cfg.getData()).toMatchObject({ shots: [] })
    expect(cfg.getProviderState()).toEqual({ providers: [{ id: 'p1', isPrimary: true }], primary: { id: 'p1', isPrimary: true } })
  })

  it('updateData 经 setNodes 不可变合并（对象 patch）', () => {
    renderHook(() => useScriptBoxEngine('sb1', { shots: [] }))
    const cfg = createScriptBoxEngine.mock.calls[0][0]
    // updateData 内部直接调 setNodes(updater)；这里验证其注入的 updater 正确合并
    // 注入回调的 useEffect 先触发，updateData 后触发，故取最后一个 function 调用
    cfg.updateData({ title: '新剧本' })
    const calls = setNodes.mock.calls.filter((c) => typeof c[0] === 'function')
    expect(calls.length).toBeGreaterThan(0)
    const call = calls[calls.length - 1]
    const out = call[0]([{ id: 'sb1', data: { shots: [], a: 1 } }])[0]
    expect(out.data).toEqual({ shots: [], a: 1, title: '新剧本' })
  })

  it('updateData 支持函数式 patch（并发安全，基于 latest 合并）', () => {
    renderHook(() => useScriptBoxEngine('sb1', { shots: [] }))
    const cfg = createScriptBoxEngine.mock.calls[0][0]
    cfg.updateData((latest) => ({ title: `${latest.title}＋更新` }))
    const calls = setNodes.mock.calls.filter((c) => typeof c[0] === 'function')
    const call = calls[calls.length - 1]
    const out = call[0]([{ id: 'sb1', data: { title: '旧', a: 1 } }])[0]
    expect(out.data).toEqual({ title: '旧＋更新', a: 1 })
  })

  it('hook 返回 { updateData } 且稳定（跨 render 引用一致，供 ScriptBoxNode 复用）', () => {
    const { result, rerender } = renderHook(() => useScriptBoxEngine('sb1', { shots: [] }))
    expect(result.current.updateData).toBeTypeOf('function')
    const first = result.current.updateData
    rerender({ shots: [1] })
    expect(result.current.updateData).toBe(first)
  })

  it('addNodes 经 screenToFlowPosition 偏移落点', () => {
    renderHook(() => useScriptBoxEngine('sb1', { shots: [] }))
    const cfg = createScriptBoxEngine.mock.calls[0][0]
    // base = screenToFlowPosition({x:0,y:0}) = {x:5,y:7}；偏移 x + base.x + 100, y + base.y
    cfg.addNodes([{ id: 'x', position: { x: 10, y: 20 } }])
    expect(addNodes).toHaveBeenCalledWith([{ id: 'x', data: {}, position: { x: 115, y: 27 } }])
  })

  it('addNodes 注入节点模型记忆（复用 App.addNode 的新建口径）', () => {
    prefsStore = { promptNode: { model: 'p1::gpt-image-1' } }
    renderHook(() => useScriptBoxEngine('sb1', { shots: [] }))
    const cfg = createScriptBoxEngine.mock.calls[0][0]
    // 剧本盒已预填 aspectRatio → 不被记忆覆盖；selectedModel 缺失 → 由记忆补上
    cfg.addNodes([{ id: 'x', type: 'promptNode', position: { x: 10, y: 20 }, data: { prompt: 'p', aspectRatio: '16:9' } }])
    const out = addNodes.mock.calls[0][0][0]
    expect(out.data.selectedModel).toBe('p1::gpt-image-1')
    expect(out.data.aspectRatio).toBe('16:9')
    expect(out.data.prompt).toBe('p')
  })

  it('addNodes 无记忆时不写空模型（留给节点兜底自动选第一个）', () => {
    renderHook(() => useScriptBoxEngine('sb1', { shots: [] }))
    const cfg = createScriptBoxEngine.mock.calls[0][0]
    cfg.addNodes([{ id: 'x', type: 'discountVideoNode', position: { x: 0, y: 0 }, data: { prompt: 'v' } }])
    const out = addNodes.mock.calls[0][0][0]
    // 记忆为空 → 注入默认 ''，与系统新建一致；节点侧 useGenerateNode 的兜底仍会生效
    expect(out.data.selectedModel).toBe('')
    expect(out.data.prompt).toBe('v')
  })
})
