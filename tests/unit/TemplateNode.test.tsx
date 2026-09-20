/**
 * TemplateNode 单测（阶段五）。
 * 复用共享 mock kit（tests/unit/_nodeMocks.mjs）。
 * 覆盖：渲染不崩、label 透传、点击「生成」触发生成链路（generateImage 被调用）。
 */
import 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { mocks } from './_nodeMocks.mjs';

// 覆盖 @xyflow/react：setNodes 真正执行 updater 维护 nodes state，供断言 patchData 写回 node.data
const h = vi.hoisted(() => {
  const state = { nodes: [] as Array<{ id: string; data?: Record<string, unknown> }> };
  const setNodes = vi.fn((updater) => {
    state.nodes = typeof updater === 'function' ? updater(state.nodes) : updater;
  });
  return { state, setNodes };
});
vi.mock('@xyflow/react', () => ({
  useReactFlow: () => ({
    setNodes: (...a: unknown[]) => (h.setNodes as unknown as (...x: unknown[]) => void)(...a),
    setEdges: (...a: any[]) => a[0],
    getNodes: () => h.state.nodes,
    getEdges: () => [],
  }),
  Handle: () => null,
  Position: { Left: 'left', Right: 'right', Top: 'top', Bottom: 'bottom' },
  useStore: () => () => ({}),
}));
// 【TD-04-53】捕获 `ModelSelect` 收到的 props（原桩 `mocks.ModelSelect` 是 NullComp，同样渲染 null
// ⇒ 行为等价，只多记一份 props 供下方「引用稳定性」断言）。
// 用 `vi.hoisted` 是因为 `vi.mock` 工厂会被提升到文件顶部，不能引用普通顶层变量。
const cap = vi.hoisted(() => ({ modelSelect: null as null | Record<string, unknown> }));
vi.mock('../../src/components/canvas/parts/NodeShell.tsx', () => ({ default: mocks.NodeShell }));
vi.mock('../../src/components/canvas/shell/HoverToolbar.tsx', () => ({
  default: mocks.HoverToolbar,
}));
vi.mock('../../src/components/canvas/parts/ExpandablePanel.tsx', () => ({
  default: mocks.ExpandablePanel,
}));
vi.mock('../../src/components/canvas/parts/GenerateButton.tsx', () => ({
  default: mocks.GenerateButton,
}));
vi.mock('../../src/components/base/ui/form/ModelSelect.tsx', () => ({
  default: (props: Record<string, unknown>) => {
    cap.modelSelect = props;
    return null;
  },
}));
vi.mock('../../src/components/canvas/shell/PromptInput.tsx', () => ({
  default: mocks.PromptInput,
}));
vi.mock('../../src/components/canvas/shell/ResourceStrip.tsx', () => ({
  default: mocks.ResourceStrip,
}));
vi.mock('../../src/components/canvas/parts/ResizeFullscreenHandle.tsx', () => ({
  default: mocks.ResizeFullscreenHandle,
}));
vi.mock('../../src/components/base/panels/FullscreenModal.tsx', () => ({
  default: mocks.FullscreenModal,
}));
vi.mock('../../src/components/canvas/parts/GeneratingOverlay.tsx', () => ({
  default: mocks.GeneratingOverlay,
}));
vi.mock('../../src/components/base/core/interaction/uiHooks.ts', () => ({
  useNodeResize: mocks.useNodeResize,
  useOutsideClick: mocks.useOutsideClick,
}));
vi.mock('../../src/hooks/useConnectedInputs.ts', async (importOriginal) => ({
  ...((await importOriginal()) as Record<string, unknown>),
  useConnectedInputs: mocks.useConnectedInputs,
}));
vi.mock('../../src/hooks/useAssetDegrade.ts', () => ({ useAssetDegrade: mocks.useAssetDegrade }));
// useNodeGeneration：记录 config，复刻真实 hook 的声明式写回（唯一写回路径 resultKey）以对齐 P0-2-c / TD-01-21。
// 桩经 h.setNodes 写入 node.data，供断言「成功/广播回填」后 data 自动更新（不再依赖节点手写 patchData）。
let genConfig: any = null;
const getGenConfig = () => genConfig;
vi.mock('../../src/hooks/useNodeGeneration.ts', async (importOriginal) => ({
  ...((await importOriginal()) as Record<string, unknown>),
  useNodeGeneration: (config: any) => {
    genConfig = config;
    // 复刻真实的广播 handler：声明 resultKey 且广播带 resultUrl 时先自动写回，再透传原 onRecover
    const originalOnRecover = config.onRecover;
    genConfig.onRecover = (d: any) => {
      if (config.resultKey && d?.resultUrl) {
        h.setNodes((ns: any) =>
          ns.map((n: any) =>
            n.id === config.nodeId
              ? { ...n, data: { ...n.data, [config.resultKey]: d.resultUrl } }
              : n,
          ),
        );
      }
      originalOnRecover?.(d);
    };
    return {
      loading: false,
      error: null,
      stop: () => {},
      start: async () => {
        const r = await config?.run?.({ progress: () => {}, signal: { aborted: false } });
        if (config.resultKey && (r?.url || r?.doneUrl)) {
          const url = r.url || r.doneUrl;
          h.setNodes((ns: any) =>
            ns.map((n: any) =>
              n.id === config.nodeId ? { ...n, data: { ...n.data, [config.resultKey]: url } } : n,
            ),
          );
        }
        config?.onSuccess?.(r);
        return r;
      },
    };
  },
}));
// TD-04-23：节点侧改引 `PREFS_DEFAULTS`（单一真源）→ 本 mock 用 importOriginal **部分 mock**：
// 只覆盖 useNodePrefs，其余导出保持真实（不在测试里再抄一份默认值）。
vi.mock('../../src/components/canvas/contract/nodePrefs.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../src/components/canvas/contract/nodePrefs.ts')>()),
  useNodePrefs: mocks.useNodePrefs,
}));
vi.mock('../../src/hooks/useSyncNodeData.ts', async (importOriginal) => ({
  ...((await importOriginal()) as Record<string, unknown>),
  useSyncNodeData: mocks.useSyncNodeData,
}));
vi.mock('../../src/components/base/core/event/toastStore.ts', async (importOriginal) => ({
  ...((await importOriginal()) as Record<string, unknown>),
  showToast: mocks.showToast,
  toastWarning: mocks.toastWarning,
  toastError: mocks.toastError,
}));
vi.mock('../../src/components/generate/lib/generate.ts', async (importOriginal) => ({
  ...((await importOriginal()) as Record<string, unknown>),
  generateImage: mocks.generateImage,
}));
vi.mock('../../src/components/base/api/filesApi.ts', async (importOriginal) => ({
  ...((await importOriginal()) as Record<string, unknown>),
  toAbsoluteFileUrl: mocks.toAbsoluteFileUrl,
  saveResultToTasks: mocks.saveResultToTasks,
}));
// 展开真模块再覆盖（TD-17-15：模块**新增导出**时桩不再脱钩 —— 判据见 tests/unit/mockPartialSpread.test.ts）
vi.mock('../../src/components/settings/providerStore.ts', async (importOriginal) => ({
  ...((await importOriginal()) as Record<string, unknown>),
  useProviders: mocks.useProviders,
  load: mocks.loadProviders,
}));
vi.mock('../../src/components/base/utils/providerModels.ts', () => ({
  buildAllModels: mocks.buildAllModels,
  resolveProviderModel: mocks.resolveProviderModel,
}));

import TemplateNode from '../../src/components/canvas/nodes/_template/TemplateNode.tsx';

beforeEach(() => {
  mocks.resetNodeMockState();
  h.state.nodes = [];
  h.setNodes.mockClear();
});

function setup(props: { id?: string; data?: Record<string, unknown> } = {}) {
  const id = props.id || 't1';
  const data = props.data || {};
  h.state.nodes = [{ id, data: { ...data } }];
  return render(<TemplateNode id={id} data={{ ...data }} selected={false} />);
}
function nodeData(id = 't1') {
  return h.state.nodes.find((n) => n.id === id)?.data;
}

describe('TemplateNode', () => {
  it('标题显示模板节点默认标签', () => {
    setup({ data: { name: '分镜模板' } });
    expect(screen.getByTestId('shell').getAttribute('data-label')).toBe('模板节点');
  });

  it('点击「生成」触发生成链路（generateImage 被调用）', async () => {
    setup({ data: { prompt: '一只猫', name: '测试' } });
    fireEvent.click(screen.getByText('生成'));
    await waitFor(() => expect(mocks.generateImageCalls.n).toBeGreaterThan(0));
    expect(mocks.generateImageCalls.last).toBeTruthy();
  });

  it('onRecover（任务中心完成广播回填）→ 把持久 resultUrl 写回 data.assetUrl（刷新不丢）', () => {
    setup();
    // 触发 useNodeGeneration 的 onRecover 回调（模拟 agent:task-completed 广播精准回填）
    const cfg = getGenConfig();
    expect(cfg).toBeTruthy();
    act(() => cfg.onRecover({ resultUrl: 'http://127.0.0.1:18080/files/tasks/x.png' }));
    expect(nodeData()!.assetUrl).toBe('http://127.0.0.1:18080/files/tasks/x.png');
  });
});

/**
 * 【TD-04-53】喂给 `memo(ModelSelect)` 的 prop 必须**引用稳定**。
 *
 * 为什么单列一组：`ModelSelect` 是 `React.memo` 组件，其 prop 里 `onChange` / `models` / `costMap` / `icon`
 * 四个是引用型 —— **任一不稳定**，浅比较必失败、memo 恒失效（"只修一个 prop = 白做"）。
 * 本组只测**本节点能控制的那一个**：`onChange`（`models` 由 `useGenerateNode` 在源头 useMemo，另有断言；
 * `costMap` 本节点不传；`icon` 只有 AgentPanel 传）。
 *
 * 反证（探针）：把 `TemplateNode` 的 `onChange={handleModelChange}` 换回内联箭头 ⇒ 本断言变红。
 */
describe('TemplateNode · ModelSelect prop 引用稳定性（TD-04-53）', () => {
  // 刻意用**同一个 data 对象**（而不是 `data={{}}` 字面量）：本组测的是「父组件重渲**而无关入参未变**时
  // prop 引用是否稳定」。传新字面量会让 `data` 本身变化，那就不再是"无关重渲"，测不到目标。
  const STABLE_DATA: Record<string, unknown> = { name: '分镜模板' };

  it('父组件重渲而无关 state 未变时，onChange 仍是同一引用（memo 可命中）', () => {
    const { rerender } = setup({ data: STABLE_DATA });
    const first = cap.modelSelect?.onChange;
    expect(typeof first, 'ModelSelect 必须收到 onChange').toBe('function');

    rerender(<TemplateNode id="t1" data={STABLE_DATA} selected={false} />);
    expect(cap.modelSelect?.onChange, '第 2 次渲染后 onChange 引用变了 ⇒ memo 恒失效').toBe(first);

    rerender(<TemplateNode id="t1" data={STABLE_DATA} selected={false} />);
    expect(cap.modelSelect?.onChange, '第 3 次渲染后 onChange 引用变了 ⇒ memo 恒失效').toBe(first);
  });

  it('models 来自 useGenerateNode 的稳定产出（同一引用跨渲染）', () => {
    const { rerender } = setup({ data: STABLE_DATA });
    const firstModels = cap.modelSelect?.models;
    expect(Array.isArray(firstModels), 'ModelSelect 必须收到 models 数组').toBe(true);

    rerender(<TemplateNode id="t1" data={STABLE_DATA} selected={false} />);
    expect(
      cap.modelSelect?.models,
      'models 引用变了 ⇒ memo(ModelSelect) 恒失效（根在 useGenerateNode）',
    ).toBe(firstModels);
  });
});
