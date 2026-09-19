// @vitest-environment jsdom
/**
 * ImageGenerate 裁剪/扩图保存「节点框跟随实际图片比例」端到端契约测试。
 *
 * 用户反馈根因：保存出口已把 dims（裁剪/扩图后画布真实尺寸）传给 onImageReplaced，
 * 但 ImageGenerate 此前忽略 dims → 节点框比例不跟随（AssetNode 正常、ImageGenerate 异常）。
 * 契约：onImageReplaced(dataUrl, dims) 后，aspectRatio 写回 'W:H'，真实 NodeShell.useSizeSync
 *       把节点框重算为 dims 比例。
 */
import 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// 可变节点状态：真实 NodeShell.useSizeSync 经 setNodes 更新它
let node = {
  id: 'pn1',
  width: 380,
  height: 380,
  style: { width: 380, height: 380 },
  data: { assetUrl: 'http://x/result.png', aspectRatio: '1:1' },
};
const mockSetNodes = vi.fn();
const mockGetNodes = vi.fn(() => [node]);
const mockUpdateInternals = vi.fn();
let lastEditorSave: any = null;

// 真实 React Flow：getNode 返回当前 node；setNodes 执行 updater 真正更新 node
vi.mock('@xyflow/react', () => ({
  useReactFlow: () => ({
    getNode: (_id: string) => node,
    setNodes: (updater: any) => {
      mockSetNodes(updater);
      const next = updater([node]);
      node = next.find((n: any) => n.id === 'pn1') ?? node;
    },
    setEdges: vi.fn(),
    getNodes: mockGetNodes,
  }),
  useStore: (sel: any) => sel({ nodeLookup: new Map([['pn1', node]]) }),
  useUpdateNodeInternals: () => mockUpdateInternals,
  NodeResizer: () => null,
  Handle: () => null,
  Position: { Left: 'left', Right: 'right' },
}));

vi.mock('../../src/hooks/useGenerateNode.ts', () => ({
  useGenerateNode: () => ({
    loading: false,
    error: null,
    stop: vi.fn(),
    start: vi.fn(),
    generate: vi.fn(),
  }),
}));
vi.mock('../../src/components/canvas/shell/HoverToolbar.tsx', () => ({
  default: ({ buttons = [] }: any) => (
    <>
      {buttons
        .filter((b: any) => b.show !== false)
        .map((b: any) => (
          <button key={b.key} title={b.title} onClick={b.onClick}>
            {b.title}
          </button>
        ))}
    </>
  ),
}));
vi.mock('../../src/components/canvas/parts/ExpandablePanel.tsx', () => ({
  default: ({ children }: any) => children,
}));
vi.mock('../../src/components/canvas/shell/ResourceStrip.tsx', () => ({ default: () => null }));
vi.mock('../../src/components/canvas/shell/PromptInput.tsx', () => ({ default: () => null }));
vi.mock('../../src/components/canvas/parts/GenerateButton.tsx', () => ({ default: () => null }));
vi.mock('../../src/components/base/ui/form/ModelSelect.tsx', () => ({ default: () => null }));
vi.mock('../../src/components/canvas/parts/ResizeFullscreenHandle.tsx', () => ({
  default: () => null,
}));
vi.mock('../../src/components/canvas/shell/FullscreenEditor.tsx', () => ({ default: () => null }));
vi.mock('../../src/components/canvas/parts/GeneratingOverlay.tsx', () => ({ default: () => null }));
vi.mock('../../src/components/creative/CreativeLibraryButton.tsx', () => ({
  default: () => null,
}));
vi.mock('../../src/components/base/ui/JianyingIcon.tsx', () => ({ default: () => null }));
vi.mock('../../src/components/base/ui/display/ImageZoomDialog.tsx', () => ({
  default: () => null,
}));
vi.mock('../../src/components/canvas/parts/CustomHandle.tsx', () => ({ default: () => null }));
vi.mock('../../src/components/canvas/parts/NodeTitle.tsx', () => ({ default: () => null }));
vi.mock('../../src/components/base/ui/feedback/ErrorBoundary.tsx', () => ({
  default: ({ children }: any) => children,
}));
vi.mock('../../src/components/base/core/event/toastStore.ts', async (importOriginal) => ({
  ...((await importOriginal()) as Record<string, unknown>),
  showToast: vi.fn(),
  toastError: vi.fn(),
}));
vi.mock('../../src/components/resource/resourceStore.ts', async (importOriginal) => ({
  ...((await importOriginal()) as Record<string, unknown>),
  sendToResourceLibrary: vi.fn(),
}));
vi.mock('../../src/components/base/store/taskStore.ts', async (importOriginal) => ({
  ...((await importOriginal()) as Record<string, unknown>),
  openResourceLibrary: vi.fn(),
}));
vi.mock('../../src/components/base/utils/net/clipboard.ts', () => ({
  downloadUrl: vi.fn(),
  resolveDownloadFilename: vi.fn(),
}));
// TD-04-23：节点侧改引 `PREFS_DEFAULTS`（单一真源）→ 本 mock 用 importOriginal **部分 mock**：
// 只覆盖 useNodePrefs，其余导出保持真实（不在测试里再抄一份默认值）。
vi.mock('../../src/components/canvas/contract/nodePrefs.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../src/components/canvas/contract/nodePrefs.ts')>()),
  useNodePrefs: () => ({ prefs: {}, set: vi.fn() }),
}));
vi.mock('../../src/hooks/useConnectedInputs.ts', async (importOriginal) => ({
  ...((await importOriginal()) as Record<string, unknown>),
  useConnectedInputs: () => ({}),
}));
vi.mock('../../src/hooks/useAssetDegrade.ts', () => ({
  useAssetDegrade: () => ({ isHidden: () => false }),
}));
// 从真模块派生：本套件只覆盖 hook，但 filesApi 等真实链路要读 assetUrl 的其它导出
// （如 `toAbsoluteFileUrl`）。手写白名单式桩缺它们 ⇒ 展开真模块后整套件崩（TD-17-15 形态）。
vi.mock('../../src/components/base/utils/media/assetUrl.ts', async (importOriginal) => ({
  ...((await importOriginal()) as Record<string, unknown>),
  useRenderAssetResolver: () => (x: string) => x,
}));
vi.mock('../../src/components/base/api/index.ts', () => ({
  toAbsoluteFileUrl: (x: string) => x,
  saveResultToTasks: vi.fn(async (url) => ({ ok: true, url, skipped: true })),
  fetchTasks: vi.fn(async () => ({ items: [] })),
  generateImage: vi.fn(async () => ({ url: 'http://gen.local/img.png' })),
}));
vi.mock('../../src/components/base/utils/providerModels.ts', () => ({
  buildAllModels: vi.fn(() => []),
  resolveProviderModel: vi.fn(() => ({ provider: {}, modelId: 'm' })),
}));
// 展开真模块再覆盖（TD-17-15：模块**新增导出**时桩不再脱钩 —— 判据见 tests/unit/mockPartialSpread.test.ts）
vi.mock('../../src/components/settings/providerStore.ts', async (importOriginal) => ({
  ...((await importOriginal()) as Record<string, unknown>),
  useProviders: () => ({ providers: [] }),
  load: vi.fn(() => Promise.resolve()),
}));

// ImageEditor：记录 onSave（模拟裁剪/扩图保存回传 dims）
vi.mock('../../src/components/image/editors/ImageEditor.tsx', () => ({
  default: ({ assetUrl, onSave, onClose: _onClose }: any) => {
    lastEditorSave = onSave;
    return <div data-testid="image-editor" data-url={assetUrl} />;
  },
}));
vi.mock('../../src/components/image/editors/InlineImageCropper.tsx', () => ({
  default: () => null,
}));
// docs/118 §五 C5：编辑器/裁剪保存出口改为「先落盘再写回」（useImageHoverActions 内调
// filesApi.showThenPersistInline）。本用例只验证「保存后节点框跟随比例」，桩掉落盘避免真实网络请求。
vi.mock('../../src/components/base/api/filesApi.ts', async (importOriginal) => ({
  ...((await importOriginal()) as Record<string, unknown>),
  // saveInlineToLocal 回 null → 仅 show(dataUrl) 触发一次 onImageReplaced（先落盘前的即时写回），节点框即跟随比例
  showThenPersistInline: vi.fn(async (dataUrl, show) => {
    show(dataUrl);
  }),
}));

import ImageGenerate from '../../src/components/image/nodes/ImageGenerate.tsx';

beforeEach(() => {
  node = {
    id: 'pn1',
    width: 380,
    height: 380,
    style: { width: 380, height: 380 },
    data: { assetUrl: 'http://x/result.png', aspectRatio: '1:1' },
  };
  lastEditorSave = null;
  mockSetNodes.mockClear();
  mockGetNodes.mockReset();
  mockGetNodes.mockReturnValue([node]);
  mockUpdateInternals.mockClear();
  if (!globalThis.IntersectionObserver) {
    globalThis.IntersectionObserver = class implements IntersectionObserver {
      readonly root: Element | Document | null = null;
      readonly rootMargin = '';
      readonly thresholds: ReadonlyArray<number> = [];
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
      takeRecords(): IntersectionObserverEntry[] {
        return [];
      }
    };
  }
});

describe('ImageGenerate 保存后节点框跟随图片比例（aspectRatio 回 Auto 不污染生图）', () => {
  it('裁剪保存（dims 4:3）→ fitByRatio 让节点框为 4:3，aspectRatio 回 Auto', async () => {
    render(
      <ImageGenerate
        id="pn1"
        data={{ assetUrl: 'http://x/result.png', aspectRatio: '1:1', label: '生图' }}
        selected={false}
      />,
    );
    expect(node.width / node.height).toBeCloseTo(1, 2);
    fireEvent.click(screen.getByTitle('标记'));
    await waitFor(() => expect(lastEditorSave).toBeTruthy());
    // 裁剪成 4:3 → 保存回传 dims（canvas 实际尺寸 800×600）
    lastEditorSave({ dataUrl: 'data:image/jpeg;base64,xxx', width: 800, height: 600 });
    // 节点框跟随图片真实比例（fitByRatio 保持当前宽、高=宽÷(800/600)）
    await waitFor(() => expect(node.width / node.height).toBeCloseTo(4 / 3, 2));
    // aspectRatio 回 Auto：不把自定义 'W:H' 写进生图比例，后续生图不受污染
    await waitFor(() => expect(node.data.aspectRatio).toBe('Auto'));
  });

  it('比例本就是 Auto 时：编辑保存（dims 16:9）→ 节点框仍跟随 dims，aspectRatio 保持 Auto（docs/117 §8 的置位分支）', async () => {
    render(
      <ImageGenerate
        id="pn1"
        data={{ assetUrl: 'http://x/result.png', aspectRatio: 'Auto', label: '生图' }}
        selected={false}
      />,
    );
    fireEvent.click(screen.getByTitle('标记'));
    await waitFor(() => expect(lastEditorSave).toBeTruthy());
    // aspectRatio 本就是 Auto：setAspectRatio('Auto') 不会产生状态变更 → 尺寸只能靠 dims 的 fitByRatio
    lastEditorSave({ dataUrl: 'data:image/jpeg;base64,xxx', width: 1600, height: 900 });
    await waitFor(() => expect(node.width / node.height).toBeCloseTo(16 / 9, 2));
    await waitFor(() => expect(node.data.aspectRatio).toBe('Auto'));
  });

  it('扩图保存（dims 16:9）→ fitByRatio 让节点框为 16:9，aspectRatio 回 Auto', async () => {
    render(
      <ImageGenerate
        id="pn1"
        data={{ assetUrl: 'http://x/result.png', aspectRatio: '1:1', label: '生图' }}
        selected={false}
      />,
    );
    fireEvent.click(screen.getByTitle('标记'));
    await waitFor(() => expect(lastEditorSave).toBeTruthy());
    lastEditorSave({ dataUrl: 'data:image/jpeg;base64,xxx', width: 1600, height: 900 });
    await waitFor(() => expect(node.width / node.height).toBeCloseTo(16 / 9, 2));
    await waitFor(() => expect(node.data.aspectRatio).toBe('Auto'));
  });
});
