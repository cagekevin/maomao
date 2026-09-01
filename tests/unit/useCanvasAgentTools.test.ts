// @vitest-environment jsdom
/**
 * useCanvasAgentTools 单测（批 3）。
 * 覆盖对外暴露的纯函数（脱离 React 可测）：
 *   - getNodeImageUrl：data.imageUrl / data.url / data.images[] / data.imageUrls[] 各种形态取主图，无图→''
 *   - buildCanvasAgentToolSchemas()：OpenAI function-calling 格式 schema
 *   - CANVAS_AGENT_TOOL_NAMES：工具名数组（snake_case，如 create_node/delete_node/generate_node）
 *   - buildCanvasAgentTools(ctx)：返回工具 Map；写工具异常被包成 {ok:false,error} 不冒泡；
 *     读工具（read_canvas/list_nodes）透传 ctx；create_node 调用 ctx.addNodes 并返回新 id
 */
import { describe, it, expect, vi } from 'vitest'

const mod = await import('../../src/components/agent/canvas/useCanvasAgentTools.ts')
const { getNodeImageUrl, buildCanvasAgentTools, buildCanvasAgentToolSchemas, CANVAS_AGENT_TOOL_NAMES } = mod

describe('getNodeImageUrl', () => {
  it('data.imageUrl 优先', () => {
    expect(getNodeImageUrl({ data: { imageUrl: 'A' } })).toBe('A')
  })
  it('data.url 兜底字符串', () => {
    expect(getNodeImageUrl({ data: { url: 'B' } })).toBe('B')
  })
  it('images 数组（字符串元素 / {url} / {imageUrl}）', () => {
    expect(getNodeImageUrl({ data: { images: ['http://a'] } })).toBe('http://a')
    expect(getNodeImageUrl({ data: { images: [{ url: 'http://b' }] } })).toBe('http://b')
    expect(getNodeImageUrl({ data: { images: [{ imageUrl: 'http://c' }] } })).toBe('http://c')
  })
  it('imageUrls 数组', () => {
    expect(getNodeImageUrl({ data: { imageUrls: ['http://d'] } })).toBe('http://d')
  })
  it('无图 → 空串', () => {
    expect(getNodeImageUrl({ data: {} })).toBe('')
    expect(getNodeImageUrl({})).toBe('')
  })
})

describe('tool schemas / names', () => {
  it('CANVAS_AGENT_TOOL_NAMES 是字符串数组且含核心工具', () => {
    expect(Array.isArray(CANVAS_AGENT_TOOL_NAMES)).toBe(true)
    expect(CANVAS_AGENT_TOOL_NAMES).toContain('create_node')
    expect(CANVAS_AGENT_TOOL_NAMES).toContain('delete_node')
    expect(CANVAS_AGENT_TOOL_NAMES).toContain('generate_node')
    expect(CANVAS_AGENT_TOOL_NAMES).toContain('read_canvas')
  })

  it('buildCanvasAgentToolSchemas 返回 function calling 格式', () => {
    const schemas = buildCanvasAgentToolSchemas()
    expect(Array.isArray(schemas)).toBe(true)
    expect(schemas[0]).toMatchObject({ type: 'function', function: { name: expect.any(String) } })
  })
})

describe('buildCanvasAgentTools', () => {
  function makeCtx(overrides = {}) {
    return {
      getNodes: vi.fn(() => []),
      getEdges: vi.fn(() => []),
      setNodes: vi.fn(),
      setEdges: vi.fn(),
      addNodes: vi.fn(),
      screenToFlowPosition: vi.fn(() => ({ x: 0, y: 0 })),
      fitView: vi.fn(),
      ...overrides,
    }
  }

  it('返回工具 Map，含 create_node/delete_node/read_canvas/list_nodes/generate_node', () => {
    const tools = buildCanvasAgentTools(makeCtx())
    expect(typeof tools.create_node).toBe('function')
    expect(typeof tools.delete_node).toBe('function')
    expect(typeof tools.read_canvas).toBe('function')
    expect(typeof tools.list_nodes).toBe('function')
    expect(typeof tools.generate_node).toBe('function')
  })

  it('read_canvas / list_nodes 透传 ctx', () => {
    const ctx = makeCtx({ getNodes: vi.fn(() => [{ id: 'z' }]) })
    const tools = buildCanvasAgentTools(ctx)
    const r = tools.read_canvas({})
    expect(r.ok).toBe(true)
    expect(ctx.getNodes).toHaveBeenCalled()
  })

  it('读工具内部异常被包成 {ok:false,error}（不冒泡）', () => {
    const ctx = makeCtx({ getNodes: vi.fn(() => { throw new Error('boom') }) })
    const tools = buildCanvasAgentTools(ctx)
    const res = tools.read_canvas({})
    expect(res.ok).toBe(false)
    expect(res.error).toContain('read_canvas')
  })

  it('create_node 用合法 type → setNodes 追加节点并返回新 id', () => {
    const ctx = makeCtx()
    const tools = buildCanvasAgentTools(ctx)
    const res = tools.create_node({ type: 'textNode', prompt: '你好', position: { x: 1, y: 2 } })
    expect(res.ok).toBe(true)
    expect(res.data.id).toMatch(/^textNode_/)
    expect(ctx.setNodes).toHaveBeenCalled()
    // 断言「写」的行为而非 setNodes 的实现形式（host 走函数式更新）：传入当前节点数组，
    // 应追加正确 data 的新节点、且不影响既有节点。
    const applyFn = ctx.setNodes.mock.calls[0][0] as (nodes: Record<string, unknown>[]) => Record<string, unknown>[]
    expect(typeof applyFn).toBe('function')
    const result = applyFn([{ id: 'existing', data: {} }])
    expect(result.some((n) => n.id === res.data.id && (n.data as Record<string, unknown>).prompt === '你好')).toBe(true)
    expect(result.some((n) => n.id === 'existing')).toBe(true)
  })

  it('create_node 对 textNode 传 text → 内容落生成区 data.text（而非抽屉 data.prompt）', () => {
    const ctx = makeCtx()
    const tools = buildCanvasAgentTools(ctx)
    const res = tools.create_node({ type: 'textNode', text: 'AI 回复内容', position: { x: 1, y: 2 } })
    expect(res.ok).toBe(true)
    const applyFn = ctx.setNodes.mock.calls[0][0] as (nodes: Record<string, unknown>[]) => Record<string, unknown>[]
    const result = applyFn([{ id: 'existing', data: {} }])
    const created = result.find((n) => n.id === res.data.id)
    expect((created.data as Record<string, unknown>).text).toBe('AI 回复内容')
    expect((created.data as Record<string, unknown>).prompt).toBeUndefined()
  })

  it('create_node 对 textNode 仅传 prompt → 内容落抽屉区 data.prompt（AI 既有行为不变）', () => {
    const ctx = makeCtx()
    const tools = buildCanvasAgentTools(ctx)
    const res = tools.create_node({ type: 'textNode', prompt: '抽屉提示词', position: { x: 1, y: 2 } })
    const applyFn = ctx.setNodes.mock.calls[0][0] as (nodes: Record<string, unknown>[]) => Record<string, unknown>[]
    const result = applyFn([{ id: 'existing', data: {} }])
    const created = result.find((n) => n.id === res.data.id)
    expect((created.data as Record<string, unknown>).prompt).toBe('抽屉提示词')
  })

  it('create_node 用非法 type → ok:false 且给出可选类型', () => {
    const ctx = makeCtx()
    const tools = buildCanvasAgentTools(ctx)
    const res = tools.create_node({ type: 'notExist' })
    expect(res.ok).toBe(false)
    expect(res.error).toContain('未知节点类型')
  })
})
