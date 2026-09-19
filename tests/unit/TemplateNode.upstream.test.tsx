/**
 * TemplateNode 上游合并测试（本次修复核心逻辑）。
 * 覆盖：上游文本/图片节点连线后文字与图片合并进生图请求；
 * 多上游节点合并；上游有文本但本地 prompt 为空时校验通过。
 */
import 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';

interface GenConfigLike {
  run?: (opts: {
    progress: () => void;
    signal: { aborted: boolean };
  }) => Promise<{ url?: string; doneUrl?: string } | undefined> | undefined;
  onSuccess?: (r: unknown) => void;
  resultKey?: string;
  nodeId?: string;
  validate: () => string;
}

const mockSetNodes = vi.fn();
const mockGetNodes = vi.fn(() => []);
const mockAddNodes = vi.fn();
let genConfig: GenConfigLike | null = null;

vi.mock('@xyflow/react', () => ({
  useReactFlow: () => ({
    setNodes: mockSetNodes,
    setEdges: vi.fn(),
    getEdges: vi.fn(() => []),
    getNodes: mockGetNodes,
    addNodes: mockAddNodes,
  }),
  useStore: vi.fn(() => () => {}),
}));

vi.mock('../../src/hooks/useNodeGeneration.ts', async (importOriginal) => ({
  ...((await importOriginal()) as Record<string, unknown>),
  useNodeGeneration: (config: GenConfigLike) => {
    genConfig = config;
    return {
      loading: false,
      error: null,
      stop: vi.fn(),
      start: vi.fn(async () => {
        const r = await config.run?.({ progress: () => {}, signal: { aborted: false } });
        config.onSuccess?.(r);
        return r;
      }),
    };
  },
}));

vi.mock('../../src/components/base/ui/ModelSelect.tsx', () => ({
  default: ({ value, onChange }: { value?: string; onChange: (v: string) => void }) => (
    <button type="button" data-testid="model-select" onClick={() => onChange('model-x')}>
      {value || '选择模型'}
    </button>
  ),
}));
vi.mock('../../src/components/base/ui/GenerateButton.tsx', () => ({
  default: ({ onGenerate }: { onGenerate?: () => void }) => (
    <button type="button" onClick={onGenerate}>
      生成
    </button>
  ),
}));
vi.mock('../../src/components/base/ui/NodeShell.tsx', () => ({
  default: ({ children }: { children?: ReactNode }) => children,
}));
vi.mock('../../src/components/base/ui/ExpandablePanel.tsx', () => ({
  default: ({ children }: { children?: ReactNode }) => children,
}));
vi.mock('../../src/components/base/panels/ResourceStrip.tsx', () => ({
  default: ({ children }: { children?: ReactNode }) => children,
}));
vi.mock('../../src/components/canvas/HoverToolbar.tsx', () => ({ default: () => null }));
vi.mock('../../src/components/canvas/PromptInput.tsx', () => ({ default: () => null }));
vi.mock('../../src/components/base/ui/ResizeFullscreenHandle.tsx', () => ({ default: () => null }));
vi.mock('../../src/components/base/panels/FullscreenModal.tsx', () => ({ default: () => null }));
vi.mock('../../src/components/base/ui/GeneratingOverlay.tsx', () => ({ default: () => null }));
vi.mock('../../src/components/creative/CreativeLibraryButton.tsx', () => ({
  default: () => null,
}));
vi.mock('../../src/components/base/core/uiHooks.ts', async (importOriginal) => ({
  ...(await importOriginal()),
  useNodeResize: () => ({ onInputResize: vi.fn() }),
  useOutsideClick: () => {},
}));

let connectedInputs: {
  images: Array<{ id: string; url: string; sourceNodeId: string }>;
  texts: Array<{ id: string; text: string; sourceNodeId: string }>;
} = { images: [], texts: [] };
vi.mock('../../src/hooks/useConnectedInputs.ts', async (importOriginal) => ({
  ...((await importOriginal()) as Record<string, unknown>),
  useConnectedInputs: () => connectedInputs,
}));

vi.mock('../../src/hooks/useAssetDegrade.ts', () => ({
  useAssetDegrade: () => ({ isHidden: () => false }),
}));
// TD-04-23：节点侧改引 `PREFS_DEFAULTS`（单一真源）→ 本 mock 用 importOriginal **部分 mock**：
// 只覆盖 useNodePrefs，其余导出保持真实（不在测试里再抄一份默认值）。
vi.mock('../../src/components/canvas/nodePrefs.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../src/components/canvas/nodePrefs.ts')>()),
  useNodePrefs: () => ({ prefs: {}, set: vi.fn() }),
}));
vi.mock('../../src/hooks/useSyncNodeData.ts', async (importOriginal) => ({
  ...((await importOriginal()) as Record<string, unknown>),
  useSyncNodeData: () => {},
}));
vi.mock('../../src/components/base/api/filesApi.ts', async (importOriginal) => ({
  ...((await importOriginal()) as Record<string, unknown>),
  toAbsoluteFileUrl: (x: string) => x,
  saveResultToTasks: vi.fn(async (url) => ({ ok: true, url, skipped: true })),
}));
// 展开真模块再覆盖（TD-17-15：模块**新增导出**时桩不再脱钩 —— 判据见 tests/unit/mockPartialSpread.test.ts）
vi.mock('../../src/components/base/store/providerStore.ts', async (importOriginal) => ({
  ...((await importOriginal()) as Record<string, unknown>),
  useProviders: () => ({ providers: [] }),
  load: vi.fn(() => Promise.resolve()),
}));
vi.mock('../../src/components/base/api/localToolApi.ts', async (importOriginal) => ({
  ...((await importOriginal()) as Record<string, unknown>),
  fetchTasks: vi.fn(async () => ({ items: [] })),
}));
// 显式声明参数元组：vi.fn(async () => …) 会把参数推断成空元组 []，
// 导致后续 mock.calls[0][0] 报 TS2493、mockGenerateImage(...a) 报 TS2556。
const mockGenerateImage = vi.fn(async (..._args: unknown[]) => ({
  url: 'http://gen.local/img.png',
}));
vi.mock('../../src/components/base/api/generate.ts', async (importOriginal) => ({
  ...((await importOriginal()) as Record<string, unknown>),
  generateImage: (...a: unknown[]) => mockGenerateImage(...a),
}));
vi.mock('../../src/components/base/utils/providerModels.ts', () => ({
  buildAllModels: vi.fn(() => []),
  resolveProviderModel: vi.fn(() => ({ provider: {}, modelId: 'm' })),
}));

beforeEach(() => {
  mockSetNodes.mockClear();
  mockGetNodes.mockReset();
  mockGetNodes.mockReturnValue([]);
  mockAddNodes.mockClear();
  mockGenerateImage.mockReset();
  mockGenerateImage.mockResolvedValue({ url: 'http://gen.local/img.png' });
  genConfig = null;
  connectedInputs = { images: [], texts: [] };
});

import TemplateNode from '../../src/components/canvas/nodes/_template/TemplateNode.tsx';

function setup(data = {}) {
  return render(<TemplateNode id="n1" data={data} selected={false} />);
}

describe('TemplateNode 上游文本/图片合并（修复点）', () => {
  it('上游文本节点连入时，文字合并进生图 prompt', async () => {
    connectedInputs = {
      images: [],
      texts: [{ id: 't1', text: '国潮风格模板', sourceNodeId: 's1' }],
    };
    setup({ prompt: '海报' });
    fireEvent.click(screen.getByText('生成'));

    await waitFor(() => expect(mockGenerateImage).toHaveBeenCalled());
    const call = mockGenerateImage.mock.calls[0][0] as unknown as {
      prompt: string;
      images?: unknown;
    };
    expect(call.prompt).toContain('海报');
    expect(call.prompt).toContain('国潮风格模板');
  });

  it('上游有文本但本地 prompt 为空时，校验通过', async () => {
    connectedInputs = { images: [], texts: [{ id: 't1', text: '电商主图', sourceNodeId: 's1' }] };
    setup({ prompt: '' });
    expect(genConfig!.validate()).toBe('');
    fireEvent.click(screen.getByText('生成'));
    await waitFor(() => expect(mockGenerateImage).toHaveBeenCalled());
    expect((mockGenerateImage.mock.calls[0][0] as unknown as { prompt: string }).prompt).toContain(
      '电商主图',
    );
  });

  it('多个上游文本节点合并', async () => {
    connectedInputs = {
      images: [],
      texts: [
        { id: 't1', text: '标题文案', sourceNodeId: 's1' },
        { id: 't2', text: '副标题', sourceNodeId: 's2' },
      ],
    };
    setup({ prompt: '模板' });
    fireEvent.click(screen.getByText('生成'));
    await waitFor(() => expect(mockGenerateImage).toHaveBeenCalled());
    const p = (
      mockGenerateImage.mock.calls[0][0] as unknown as { prompt: string; images?: unknown }
    ).prompt;
    expect(p).toContain('模板');
    expect(p).toContain('标题文案');
    expect(p).toContain('副标题');
  });

  it('多个上游图片节点合并进 images（generateImage 契约：images 为 URL 数组）', async () => {
    connectedInputs = {
      images: [
        { id: 'i1', url: 'http://up/a.png', sourceNodeId: 's1' },
        { id: 'i2', url: 'http://up/b.png', sourceNodeId: 's2' },
      ],
      texts: [{ id: 't1', text: '融合两张图', sourceNodeId: 's3' }],
    };
    setup({ prompt: '合成' });
    fireEvent.click(screen.getByText('生成'));
    await waitFor(() => expect(mockGenerateImage).toHaveBeenCalled());
    const call = mockGenerateImage.mock.calls[0][0] as unknown as {
      prompt: string;
      images?: unknown;
    };
    expect(call.prompt).toContain('融合两张图');
    expect(call.images).toHaveLength(2);
    expect(call.images).toEqual(['http://up/a.png', 'http://up/b.png']);
  });

  it('本地与上游皆为空时，提示请输入提示词', () => {
    connectedInputs = { images: [], texts: [] };
    setup({ prompt: '' });
    expect(genConfig!.validate()).toBe('请输入提示词');
  });
});
