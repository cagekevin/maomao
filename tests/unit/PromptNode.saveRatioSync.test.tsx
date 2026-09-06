// @vitest-environment jsdom
/**
 * PromptNode 裁剪/扩图保存「节点框跟随实际图片比例」端到端契约测试。
 *
 * 用户反馈根因：保存出口已把 dims（裁剪/扩图后画布真实尺寸）传给 onImageReplaced，
 * 但 PromptNode 此前忽略 dims → 节点框比例不跟随（ImageNode 正常、PromptNode 异常）。
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
  data: { imageUrl: 'http://x/result.png', aspectRatio: '1:1' },
};
const mockSetNodes = vi.fn();
const mockGetNodes = vi.fn(() => [node]);
const mockUpdateInternals = vi.fn();
let lastEditorSave = null;

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
vi.mock('../../src/components/base/panels/HoverToolbar.tsx', () => ({
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
vi.mock('../../src/components/base/ui/ExpandablePanel.tsx', () => ({
  default: ({ children }: any) => children,
}));
vi.mock('../../src/components/base/panels/MaterialStrip.tsx', () => ({ default: () => null }));
vi.mock('../../src/components/base/prompt/PromptInput.tsx', () => ({ default: () => null }));
vi.mock('../../src/components/base/ui/GenerateButton.tsx', () => ({ default: () => null }));
vi.mock('../../src/components/base/ui/ModelSelect.tsx', () => ({ default: () => null }));
vi.mock('../../src/components/base/ui/ResizeFullscreenHandle.tsx', () => ({ default: () => null }));
vi.mock('../../src/components/base/panels/FullscreenEditor.tsx', () => ({ default: () => null }));
vi.mock('../../src/components/base/ui/GeneratingOverlay.tsx', () => ({ default: () => null }));
vi.mock('../../src/components/base/prompt/PromptLibraryButton.tsx', () => ({
  default: () => null,
}));
vi.mock('../../src/components/base/ui/JianyingIcon.tsx', () => ({ default: () => null }));
vi.mock('../../src/components/base/editors/ImageZoomDialog.tsx', () => ({ default: () => null }));
vi.mock('../../src/components/edges/CustomHandle.tsx', () => ({ default: () => null }));
vi.mock('../../src/components/base/ui/NodeTitle.tsx', () => ({ default: () => null }));
vi.mock('../../src/components/base/ui/ErrorBoundary.tsx', () => ({
  default: ({ children }: any) => children,
}));
vi.mock('../../src/components/base/core/toastStore.ts', () => ({
  showToast: vi.fn(),
  toastError: vi.fn(),
}));
vi.mock('../../src/components/base/store/assetStore.ts', () => ({ sendToAssetLibrary: vi.fn() }));
vi.mock('../../src/components/base/store/taskStore.ts', () => ({ openAssetLibrary: vi.fn() }));
vi.mock('../../src/components/base/utils/clipboard.ts', () => ({
  downloadUrl: vi.fn(),
  resolveDownloadFilename: vi.fn(),
}));
vi.mock('../../src/components/base/canvas/nodePrefs.ts', () => ({
  useNodePrefs: () => ({ prefs: {}, set: vi.fn() }),
}));
vi.mock('../../src/hooks/useConnectedInputs.ts', () => ({ useConnectedInputs: () => ({}) }));
vi.mock('../../src/hooks/useMediaDegrade.ts', () => ({
  useMediaDegrade: () => ({ isHidden: () => false }),
}));
vi.mock('../../src/components/base/utils/imageUrl.ts', () => ({
  useRenderImageResolver: () => (x: string) => x,
}));
vi.mock('../../src/components/base/api/index.ts', () => ({
  toAbsoluteFileUrl: (x: string) => x,
  saveResultToTasks: vi.fn(async () => undefined),
  fetchTasks: vi.fn(async () => ({ items: [] })),
  generateImage: vi.fn(async () => ({ url: 'http://gen.local/img.png' })),
}));
vi.mock('../../src/components/base/utils/providerModels.ts', () => ({
  buildAllModels: vi.fn(() => []),
  resolveProviderModel: vi.fn(() => ({ provider: {}, modelId: 'm' })),
}));
vi.mock('../../src/components/base/store/providerStore.ts', () => ({
  useProviders: () => ({ providers: [] }),
  load: vi.fn(() => Promise.resolve()),
}));

// ImageEditor：记录 onSave（模拟裁剪/扩图保存回传 dims）
vi.mock('../../src/components/base/editors/ImageEditor.tsx', () => ({
  default: ({ imageUrl, onSave, onClose: _onClose }: any) => {
    lastEditorSave = onSave;
    return <div data-testid="image-editor" data-url={imageUrl} />;
  },
}));
vi.mock('../../src/components/base/editors/InlineImageCropper.tsx', () => ({
  default: () => null,
}));

import PromptNode from '../../src/components/nodes/PromptNode.tsx';

beforeEach(() => {
  node = {
    id: 'pn1',
    width: 380,
    height: 380,
    style: { width: 380, height: 380 },
    data: { imageUrl: 'http://x/result.png', aspectRatio: '1:1' },
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

describe('PromptNode 保存后节点框跟随图片比例（aspectRatio 回 Auto 不污染生图）', () => {
  it('裁剪保存（dims 4:3）→ fitByRatio 让节点框为 4:3，aspectRatio 回 Auto', async () => {
    render(
      <PromptNode
        id="pn1"
        data={{ imageUrl: 'http://x/result.png', aspectRatio: '1:1', label: '生图' }}
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

  it('扩图保存（dims 16:9）→ fitByRatio 让节点框为 16:9，aspectRatio 回 Auto', async () => {
    render(
      <PromptNode
        id="pn1"
        data={{ imageUrl: 'http://x/result.png', aspectRatio: '1:1', label: '生图' }}
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
