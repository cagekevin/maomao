import 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { mocks } from './_nodeMocks.mjs';

vi.mock('@xyflow/react', () => mocks.xyflow);
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
  default: mocks.ModelSelect,
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
vi.mock('../../src/components/creative/CreativeLibraryButton.tsx', () => ({
  default: mocks.PromptLibraryButton,
}));
vi.mock('../../src/components/base/core/interaction/uiHooks.ts', () => ({
  useNodeResize: mocks.useNodeResize,
  useOutsideClick: mocks.useOutsideClick,
}));
vi.mock('../../src/hooks/useConnectedInputs.ts', async (importOriginal) => ({
  ...((await importOriginal()) as Record<string, unknown>),
  useConnectedInputs: mocks.useConnectedInputs,
}));
vi.mock('../../src/hooks/useNodeGeneration.ts', async (importOriginal) => ({
  ...((await importOriginal()) as Record<string, unknown>),
  useNodeGeneration: mocks.useNodeGeneration,
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
vi.mock('../../src/components/base/api/filesApi.ts', async (importOriginal) => ({
  ...((await importOriginal()) as Record<string, unknown>),
  toAbsoluteFileUrl: mocks.toAbsoluteFileUrl,
  saveResultToTasks: mocks.saveResultToTasks,
  // 注：_nodeMocks 的 saveResultToTasks 已返回 SaveTasksOutcome（TD-01-17）
  saveTextToTasks: mocks.saveTextToTasks,
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
vi.mock('../../src/components/generate/lib/generate.ts', async (importOriginal) => ({
  ...((await importOriginal()) as Record<string, unknown>),
  chatCompletions: mocks.chatCompletions,
}));

import TextGenerate from '../../src/components/text/TextGenerate.tsx';
beforeEach(() => {
  mocks.resetNodeMockState();
});
const setup = (props = {}) =>
  render(<TextGenerate id="txt1" data={{}} selected={false} {...props} />);

describe('TextGenerate', () => {
  it('点击「生成」调用 chatCompletions', async () => {
    setup({ data: { prompt: '写一句诗', name: '文案' } });
    fireEvent.click(screen.getByText('生成'));
    await waitFor(() => expect(mocks.chatCompletionsCalls.n).toBeGreaterThan(0));
  });
});
