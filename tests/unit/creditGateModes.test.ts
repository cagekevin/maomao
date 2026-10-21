import { describe, it, expect, vi, beforeEach } from 'vitest';
import { toolOf } from '../helpers/agentTools';
import { at } from '../helpers/at';

/**
 * 高消耗积分开关（creditSwitch）× execute_plan 唯一入口的契约测试。
 *
 * 契约来源：docs/59-AI助手模式收敛-PRD-三按钮与积分确认（§4.3 / §8）、docs/60 施工执行计划（D1-D9）。
 * 【2026-09-05 精简】执行模型收敛恒 auto（direct/step-confirm 已删），故删掉「直接生图/分步确认」两组死路径用例，
 *   仅保留「完全自主 auto」× 开关两态：creditHit = getCreditSwitch()（与执行模型正交，只拦真生成那下）。
 *
 * 核心判定（收敛到 execute_plan 唯一入口，useCanvasAgentTools.ts executePlanTool）：
 *   creditHit = getCreditSwitch()   // 2026-08-27 简化：全局总闸，与执行模型正交
 *   · 命中（开关开）→ 强制 autoRun=false（只建节点、不烧积分），置 per-conv creditGate，返回 awaited:'credit'
 *   · 未命中（开关关）→ 按原 autoRun 放行（真烧积分）
 *
 * 通过控制 creditSwitch 断言 autoRun 传参、creditGate 置位、返回语义。
 */
// 可控 creditSwitch：getX 读 __credit，setX 写 __credit（contentStore 的 contentGet/contentSet 也被 mock 到同一状态）
let __creditState: any;
vi.mock('../../src/components/base/core/contentStore.ts', async () => {
  // `vi.importActual<T>` 泛型给出真模块类型 ⇒ 无需断言即可调用 .contentGet / .contentSet
  const actual = await vi.importActual<
    typeof import('../../src/components/base/core/contentStore.ts')
  >('../../src/components/base/core/contentStore.ts');
  return {
    ...actual,
    contentGet: vi.fn((k) => (k === 'agent_credit_switch' ? __creditState : actual.contentGet(k))),
    contentSet: vi.fn((k, v) => {
      if (k === 'agent_credit_switch') {
        __creditState = !!v;
        // 桩必须返回落盘结果（PersistWriteOutcome）：消费方 confirmPersist 读 `.ok`。
        // 原分支不 return（既有 TS7030「Not all code paths return a value」即此）。
        return { ok: true, landed: 'local' } as const;
      }
      return actual.contentSet(k, v);
    }),
  };
});
vi.mock('../../src/components/agent/conversation/conversationStore.ts', async (importOriginal) => ({
  ...((await importOriginal()) as Record<string, unknown>),
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
  getCurrentMemory: vi.fn(() => ({
    summary: '',
    facts: [],
    lastPlan: null,
    lastSharedStyle: '',
    notes: [],
  })),
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
  getCurrentSnapshot: vi.fn(() => ({ skills: [] })),
}));
vi.mock('../../src/components/base/store/taskStore.ts', async (importOriginal) => ({
  ...((await importOriginal()) as Record<string, unknown>),
  runNodeGeneration: vi.fn(async () => ({ ok: true, resultUrl: 'http://r/x.png' })),
  isNodeRegistered: vi.fn(() => true),
}));
vi.mock('../../src/components/agent/canvas/canvasPlanExecutor.ts', async () => {
  const actual = await vi.importActual<
    typeof import('../../src/components/agent/canvas/canvasPlanExecutor.ts')
  >('../../src/components/agent/canvas/canvasPlanExecutor.ts');
  return {
    ...actual,
    executePlan: vi.fn(async (args) => ({
      workflow: { status: args?.autoRun ? 'completed' : 'ready' },
      entries: [
        {
          status: args?.autoRun ? 'completed' : 'ready',
          nodeId: 'n1',
          stepId: 'g1',
          resultUrl: args?.autoRun ? 'http://r/x.png' : '',
        },
      ],
    })),
  };
});

import { buildCanvasAgentTools } from '../../src/components/agent/canvas/useCanvasAgentTools.ts';
import * as convStore from '../../src/components/agent/conversation/conversationStore.ts';
import { executePlan } from '../../src/components/agent/canvas/canvasPlanExecutor.ts';
import type { CreditGate } from '../../src/components/agent/conversation/conversationSkillState.ts';

// vi.mock 工厂已把 executePlan 替换为 vi.fn，vi.mocked() 可恢复其 mock 类型（含 .mock.calls），零 any
const mockExecutePlan = vi.mocked(executePlan);
// mock 出口读的本地真相（awaiting / creditGate）。
// 【为什么不再往「模块命名空间」上挂 __state】那让模块类型不成立（只能整对象双重断言），
// 且实测会触发 vitest/TS 推断 bug，连坐同作用域 vi/expect 不可调用（canvasAgentTools.test.ts 探针）。
// 直接持有本地对象即可：类型真、零断言。
const convState: {
  awaiting: boolean;
  /** `setCreditGate` 收 Partial（见其签名），出口按 CreditGate 还原需单次断言（用例给的是完整形状） */
  creditGate: (Partial<CreditGate> & Record<string, unknown>) | null;
} = { awaiting: false, creditGate: null };

function makeCtx() {
  let nodes: any = [];
  return {
    getNodes: () => nodes,
    setNodes: vi.fn((fn) => {
      nodes = typeof fn === 'function' ? fn(nodes) : fn;
    }),
    getEdges: () => [],
    setEdges: vi.fn(),
    addNodes: (ns: any) => {
      nodes = [...nodes, ...ns];
    },
    screenToFlowPosition: (p: any) => p || { x: 0, y: 0 },
    fitView: vi.fn(),
    zoomIn: vi.fn(),
    zoomOut: vi.fn(),
    setCenter: vi.fn(),
    snapshot: () => ({ nodes, edges: [] }),
  };
}

const GENS = [{ id: 'g1', prompt: '一只猫' }];

beforeEach(() => {
  vi.clearAllMocks();
  __creditState = true; // 默认开（安全）
  // 配对状态
  convState.awaiting = false;
  convState.creditGate = null;
  vi.mocked(convStore.getAwaitingConfirm).mockImplementation(() => convState.awaiting);
  vi.mocked(convStore.setAwaitingConfirm).mockImplementation((v) => {
    convState.awaiting = !!v;
  });
  // convState.creditGate 本地存 Partial 形状，mock 出口处断言回 CreditGate（运行时 g 已是兼容结构）
  vi.mocked(convStore.getCreditGate).mockImplementation(
    () => convState.creditGate as CreditGate | null,
  );
  vi.mocked(convStore.setCreditGate).mockImplementation((g) => {
    convState.creditGate = g ?? null;
  });
  vi.mocked(convStore.clearCreditGate).mockImplementation(() => {
    convState.creditGate = null;
  });
});

function buildTool() {
  return buildCanvasAgentTools(makeCtx());
}

describe('完全自主 × 积分开关 × execute_plan 唯一入口', () => {
  describe('完全自主', () => {
    it('开关开【拦截】→ 强制 autoRun=false、建节点、置 creditGate、返回 awaited:credit，不烧积分', async () => {
      __creditState = true;
      const t = buildTool();
      const r = await toolOf(t, 'execute_plan')({ generations: GENS, auto_run: true });
      expect(r.ok).toBe(true);
      expect(r.data.awaited).toBe('credit');
      // D4：即使 LLM 传 auto_run:true，命中积分闸也必须强制关闭
      expect(mockExecutePlan).toHaveBeenCalledTimes(1);
      expect(at(mockExecutePlan.mock.calls, 0)[0].autoRun).toBe(false);
      // creditGate 置位并持久化
      expect(convState.creditGate?.pending).toBe(true);
      expect(convState.creditGate?.map).toBeTruthy();
      // 未置 awaiting 态（credit 闸与 awaiting 确认闸两条门禁互相独立）
      expect(convState.awaiting).toBe(false);
    });

    it('开关关【放行】→ 按 auto_run 直接烧积分、不置 creditGate', async () => {
      __creditState = false;
      const t = buildTool();
      const r = await toolOf(t, 'execute_plan')({ generations: GENS, auto_run: true });
      expect(r.ok).toBe(true);
      expect(r.data.awaited).toBeUndefined();
      expect(mockExecutePlan).toHaveBeenCalledTimes(1);
      expect(at(mockExecutePlan.mock.calls, 0)[0].autoRun).toBe(true);
      expect(convState.creditGate).toBeNull();
    });
  });
});
