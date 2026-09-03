import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * 三种模式 × 高消耗积分开关（creditSwitch）的端到端契约测试。
 *
 * 契约来源：docs/59-AI助手模式收敛-PRD-三按钮与积分确认（§4.3 / §8）、docs/60 施工执行计划（D1-D9）。
 *
 * 核心判定（收敛到 execute_plan 唯一入口，useCanvasAgentTools.ts executePlanTool）：
 *   creditHit = getCreditSwitch()   // 2026-08-27 简化：全局总闸，与 runMode/模式正交
 *   · 命中（开关开）→ 强制 autoRun=false（只建节点、不烧积分），置 per-conv creditGate，返回 awaited:'credit'
 *   · 未命中（开关关）→ 按原 autoRun 放行（真烧积分）
 *
 * 三种模式 = inputMode/runMode 维度，但对积分闸判定无区别（credit=creditSwitch，与模式正交）：
 *   直接生图  → inputMode='image'（sendImageMode 直连）→ 开关开即拦
 *   分步确认  → inputMode='agent' + runMode='step-confirm'   → 开关开即拦（一视同仁，2026-08-27 删 D2 不叠分支）
 *   完全自主  → inputMode='agent' + runMode='auto'   → 开关开即拦
 *
 * 本文件只测 execute_plan 这一收敛入口对三种模式 × 开关两态的放行/拦截行为，
 * 通过控制 creditSwitch 与 runMode 断言 autoRun 传参、creditGate 置位、返回语义，并固化「残留 step-confirm 短路」回归防线。
 */
// 可控 creditSwitch：getX 读 __credit，setX 写 __credit（contentStore 的 contentGet/contentSet 也被 mock 到同一状态）
let __creditState
let __genParamsState
vi.mock('../../src/components/base/core/contentStore.ts', async (importOriginal) => {
  // importOriginal 在 vitest 类型里返回 unknown（类型限制），断言回具体模块命名空间以保留 .contentGet 等调用
  const actual = (await importOriginal()) as unknown as typeof import('../../src/components/base/core/contentStore.ts')
  return {
    ...actual,
    contentGet: vi.fn((k) => (k === 'agent_credit_switch' ? __creditState : actual.contentGet(k))),
    contentSet: vi.fn((k, v) => { if (k === 'agent_credit_switch') __creditState = !!v; else return actual.contentSet(k, v) }),
  }
})
vi.mock('../../src/components/agent/conversation/conversationStore.ts', () => ({
  pushActiveAiUndo: vi.fn(),
  popActiveAiUndo: vi.fn(() => null),
  getActiveAiUndoStack: vi.fn(() => []),
  setActivePendingGenerations: vi.fn(),
  getActivePendingGenerations: vi.fn(() => null),
  // 勿加 setPendingGenerations/getPendingGenerations/clearPendingGenerations：
  // 它们是 useCanvasAgentTools.ts:106-113 的本地兼容壳，非本模块导出。
  // 加进来会变成"多余 key 不报错"的死通道诱饵（本文件此前 3 个 key 从未被注入过实现）。
  setAwaitingConfirm: vi.fn(),
  getAwaitingConfirm: vi.fn(),
  setCreditGate: vi.fn(),
  getCreditGate: vi.fn(),
  clearCreditGate: vi.fn(),
  getCurrentMemory: vi.fn(() => ({ summary: '', facts: [], lastPlan: null, lastSharedStyle: '', notes: [] })),
  setCurrentMemory: vi.fn(),
  patchCurrentWorkflow: vi.fn(() => ({})),
  getCurrentGlobalContract: vi.fn(() => null),
  setCurrentGlobalContract: vi.fn(),
  getCurrentArtifacts: vi.fn(() => null),
  setCurrentArtifacts: vi.fn(),
  getCurrentRefImages: vi.fn(() => []),
  setCurrentRefImages: vi.fn(),
  getLastUserReferenceImages: vi.fn(() => []),
  getCurrentImageMap: vi.fn(() => []),
  getCurrentRunMode: vi.fn(() => 'auto'),
  setCurrentRunMode: vi.fn(),
  getWorkMode: vi.fn(() => 'auto'),
  getCurrentSnapshot: vi.fn(() => ({ skills: [] })),
}))
vi.mock('../../src/components/base/store/taskStore.ts', () => ({
  runNodeGeneration: vi.fn(async () => ({ ok: true, resultUrl: 'http://r/x.png' })),
  isNodeRegistered: vi.fn(() => true),
}))
vi.mock('../../src/components/agent/canvas/canvasPlanExecutor.ts', async (importOriginal) => {
  const actual = (await importOriginal()) as unknown as typeof import('../../src/components/agent/canvas/canvasPlanExecutor.ts')
  return {
    ...actual,
    executePlan: vi.fn(async (args) => ({
      workflow: { status: args?.autoRun ? 'completed' : 'ready' },
      entries: [{ status: args?.autoRun ? 'completed' : 'ready', nodeId: 'n1', stepId: 'g1', resultUrl: args?.autoRun ? 'http://r/x.png' : '' }],
    })),
  }
})

import { buildCanvasAgentTools } from '../../src/components/agent/canvas/useCanvasAgentTools.ts'
import * as convStore from '../../src/components/agent/conversation/conversationStore.ts'
import { executePlan } from '../../src/components/agent/canvas/canvasPlanExecutor.ts'
import type { CreditGate } from '../../src/components/agent/conversation/conversationSkillState.ts'
import type { RunMode } from '../../src/components/agent/conversation/conversationAiState.ts'

// vi.mock 工厂已把 executePlan 替换为 vi.fn，vi.mocked() 可恢复其 mock 类型（含 .mock.calls），零 any
const mockExecutePlan = vi.mocked(executePlan)
// 对「模块命名空间 convStore」直接写 convMock.__state 会触发 vitest/TS 推断 bug，
// 连坐同一作用域 vi/expect 变不可调用（canvasAgentTools.test.ts 探针实测）。
// 合并本地 __state 字段类型（替代原 any 别名），保留规避意图且零 any。
type ConvMock = typeof convStore & { __state: { awaiting: boolean; creditGate: CreditGate | null; runMode: RunMode } }
const convMock = convStore as unknown as ConvMock

function makeCtx() {
  let nodes = []
  return {
    getNodes: () => nodes,
    setNodes: vi.fn((fn) => { nodes = typeof fn === 'function' ? fn(nodes) : fn }),
    getEdges: () => [],
    setEdges: vi.fn(),
    addNodes: (ns) => { nodes = [...nodes, ...ns] },
    screenToFlowPosition: (p) => p || { x: 0, y: 0 },
    fitView: vi.fn(), zoomIn: vi.fn(), zoomOut: vi.fn(), setCenter: vi.fn(),
    snapshot: () => ({ nodes, edges: [] }),
  }
}

const GENS = [{ id: 'g1', prompt: '一只猫' }]

beforeEach(() => {
  vi.clearAllMocks()
  __creditState = true // 默认开（安全）
  // 配对状态
  convMock.__state = { awaiting: false, creditGate: null, runMode: 'auto' }
  vi.mocked(convStore.getAwaitingConfirm).mockImplementation(() => convMock.__state.awaiting)
  vi.mocked(convStore.setAwaitingConfirm).mockImplementation((v) => { convMock.__state.awaiting = !!v })
  // __state.creditGate 本地存 Partial 形状，mock 出口处断言回 CreditGate（运行时 g 已是兼容结构）
  vi.mocked(convStore.getCreditGate).mockImplementation(() => convMock.__state.creditGate as CreditGate | null)
  vi.mocked(convStore.setCreditGate).mockImplementation((g) => { convMock.__state.creditGate = (g || null) as CreditGate | null })
  vi.mocked(convStore.clearCreditGate).mockImplementation(() => { convMock.__state.creditGate = null })
  vi.mocked(convStore.getCurrentRunMode).mockImplementation(() => convMock.__state.runMode)
  vi.mocked(convStore.setCurrentRunMode).mockImplementation((m) => { convMock.__state.runMode = m as RunMode })
})

function buildTool() {
  return buildCanvasAgentTools(makeCtx())
}

describe('三种模式 × 积分开关 × execute_plan 唯一入口', () => {
  describe('完全自主（runMode=auto）', () => {
    it('开关开【拦截】→ 强制 autoRun=false、建节点、置 creditGate、返回 awaited:credit，不烧积分', async () => {
      convMock.__state.runMode = 'auto'
      __creditState = true
      const t = buildTool()
      const r = await t.execute_plan({ generations: GENS, auto_run: true })
      expect(r.ok).toBe(true)
      expect(r.data.awaited).toBe('credit')
      // D4：即使 LLM 传 auto_run:true，命中积分闸也必须强制关闭
      expect(mockExecutePlan).toHaveBeenCalledTimes(1)
      expect(mockExecutePlan.mock.calls[0][0].autoRun).toBe(false)
      // creditGate 置位并持久化
      expect(convMock.__state.creditGate?.pending).toBe(true)
      expect(convMock.__state.creditGate?.map).toBeTruthy()
      // 分步确认态未置位（两条门禁独立）
      expect(convMock.__state.awaiting).toBe(false)
    })

    it('开关关【放行】→ 按 auto_run 直接烧积分、不置 creditGate', async () => {
      convMock.__state.runMode = 'auto'
      __creditState = false
      const t = buildTool()
      const r = await t.execute_plan({ generations: GENS, auto_run: true })
      expect(r.ok).toBe(true)
      expect(r.data.awaited).toBeUndefined()
      expect(mockExecutePlan).toHaveBeenCalledTimes(1)
      expect(mockExecutePlan.mock.calls[0][0].autoRun).toBe(true)
      expect(convMock.__state.creditGate).toBeNull()
    })
  })

  describe('直接生图（inputMode=image，runMode 沿用默认 auto）', () => {
    it('开关开【拦截】→ 不再 auto_run 直出，建节点等确认（PRD §8.4 / 边界 §4）', async () => {
      convMock.__state.runMode = 'auto' // 直接生图不改 runMode，默认 auto
      __creditState = true
      const t = buildTool()
      // 直接生图真实路径：sendImageMode → callTool('execute_plan', {generations, auto_run:true})
      const r = await t.execute_plan({ generations: GENS, auto_run: true })
      expect(r.ok).toBe(true)
      expect(r.data.awaited).toBe('credit')
      expect(mockExecutePlan).toHaveBeenCalledTimes(1)
      expect(mockExecutePlan.mock.calls[0][0].autoRun).toBe(false) // 不直出
      expect(convMock.__state.creditGate?.pending).toBe(true)
    })

    it('开关关【放行】→ 直接 auto_run 出图，不弹确认（PRD §8.4）', async () => {
      convMock.__state.runMode = 'auto'
      __creditState = false
      const t = buildTool()
      const r = await t.execute_plan({ generations: GENS, auto_run: true })
      expect(r.ok).toBe(true)
      expect(r.data.awaited).toBeUndefined()
      expect(mockExecutePlan).toHaveBeenCalledTimes(1)
      expect(mockExecutePlan.mock.calls[0][0].autoRun).toBe(true) // 直出
      expect(convMock.__state.creditGate).toBeNull()
    })

    it('【回归·BUG】直接生图若残留 runMode=step-confirm（先前切过分步确认），开关开必须仍拦截（PRD：直接生图受通用积分闸，与残留 runMode 无关）', async () => {
      // 用户先切「分步确认」(runMode='step-confirm')，再切「直接生图」——runMode 残留 step-confirm。
      // 直接生图语义下积分闸应只看 creditSwitch，绝不能因残留 step-confirm 被跳过。
      convMock.__state.runMode = 'step-confirm'
      __creditState = true
      const t = buildTool()
      const r = await t.execute_plan({ generations: GENS, auto_run: true })
      expect(r.ok).toBe(true)
      expect(r.data.awaited).toBe('credit')
      expect(mockExecutePlan.mock.calls[0][0].autoRun).toBe(false)
      expect(convMock.__state.creditGate?.pending).toBe(true)
    })
  })

  describe('分步确认（runMode=step-confirm）', () => {
    it('开关开【通用闸一视同仁】→ 分步确认同样拦截，建节点置 creditGate、返回 awaited:credit（2026-08-27 简化：删 D2 不叠分支）', async () => {
      convMock.__state.runMode = 'step-confirm'
      __creditState = true
      const t = buildTool()
      const r = await t.execute_plan({ generations: GENS, auto_run: true })
      expect(r.ok).toBe(true)
      expect(r.data.awaited).toBe('credit') // 通用总闸一视同仁，无论模式开关开都拦
      expect(convMock.__state.creditGate?.pending).toBe(true)
      expect(mockExecutePlan).toHaveBeenCalledTimes(1)
      expect(mockExecutePlan.mock.calls[0][0].autoRun).toBe(false)
    })

    it('开关关【放行】→ 不置 creditGate，按 auto_run 执行', async () => {
      convMock.__state.runMode = 'step-confirm'
      __creditState = false
      const t = buildTool()
      const r = await t.execute_plan({ generations: GENS, auto_run: true })
      expect(r.ok).toBe(true)
      expect(r.data.awaited).toBeUndefined()
      expect(convMock.__state.creditGate).toBeNull()
      expect(mockExecutePlan).toHaveBeenCalledTimes(1)
      expect(mockExecutePlan.mock.calls[0][0].autoRun).toBe(true)
    })
  })
})