/**
 * ImageBoxNode 深度测试。
 *
 * ImageBoxNode 是图片链路共同上游（近 60 次提交改动 5 次），交互面广：
 * 加图/删图/展开/全选/单选/导航/从连线导入，且全部通过 setNodes(updater) 写回 data。
 * 此前测试只有「挂载不崩」冒烟（1 用例），任何 data 逻辑回归都测不出。
 *
 * 本文件改为断言真实行为：捕获并执行 setNodes 传入的 updater，断言交互后
 * 节点 data 的精确变化（activeIndex / selectedIds / images / expanded）。
 * 这些断言任一被破坏，说明节点数据契约回归，测试必红。
 */
import 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { mocks } from './_nodeMocks.mjs';

// 捕获 setNodes 传入的 updater 并执行，得到更新后的 nodes 数组（供断言 data 变更）
type MockNode = { id: string; data: Record<string, unknown> };
const h = vi.hoisted(() => {
  const state: { nodes: MockNode[] } = { nodes: [] };
  const setNodesMock = vi.fn((updater) => {
    state.nodes = typeof updater === 'function' ? updater(state.nodes) : updater;
  });
  return { state, setNodesMock, clipboardMock: { downloadUrl: vi.fn() } };
});

vi.mock('@xyflow/react', () => ({
  useReactFlow: () => ({
    setNodes: (...a: unknown[]) => (h.setNodesMock as unknown as (...x: unknown[]) => void)(...a),
    getNodes: () => h.state.nodes,
    getEdges: () => [],
    addNodes: () => {},
    addEdges: () => {},
  }),
  Handle: () => null,
  Position: { Left: 'left', Right: 'right', Top: 'top', Bottom: 'bottom' },
  NodeResizer: () => null,
  useStore: () => () => ({}),
  ReactFlowProvider: ({ children }: any) => children,
}));
vi.mock('../../src/components/base/ui/NodeShell.tsx', () => ({ default: mocks.NodeShell }));
vi.mock('../../src/components/base/ui/CustomHandle.tsx', () => ({ default: mocks.CustomHandle }));
vi.mock('../../src/hooks/useConnectedInputs.ts', async (importOriginal) => ({
  ...((await importOriginal()) as Record<string, unknown>),
  useConnectedInputs: mocks.useConnectedInputs,
}));
vi.mock('../../src/hooks/useAssetDegrade.ts', () => ({ useAssetDegrade: mocks.useAssetDegrade }));
vi.mock('../../src/components/base/ui/LazyImage.tsx', () => ({ default: mocks.LazyImage }));
vi.mock('../../src/components/base/core/toastStore.ts', async (importOriginal) => ({
  ...((await importOriginal()) as Record<string, unknown>),
  showToast: mocks.showToast,
  toastError: mocks.toastError,
  toastWarning: mocks.toastWarning,
}));
vi.mock('../../src/components/base/api/filesApi.ts', async (importOriginal) => ({
  ...((await importOriginal()) as Record<string, unknown>),
  toAbsoluteFileUrl: mocks.toAbsoluteFileUrl,
  // §5.4.9 落盘唯一实现：返回持久 /files/ URL（不内联 dataURL）；仅作测试替身
  // 【2026-09-17】契约改判别联合（成功＝`ok:true` + url）。
  resolveNodeAssetUrl: (file: File) =>
    Promise.resolve({
      ok: true as const,
      url: `http://127.0.0.1:18080/files/canvasDrop/${file?.name ?? 'x'}`,
    }),
  // 【2026-09-18 TD-02-62】`node.data.images[].url` 的唯一写入点 `addImages` 现内部统一落盘
  // （六条加图路径共用）。替身按真实契约：已是本机 /files/ → `already-local` 短路；
  // data:/blob: → 视为落盘成功换持久 URL；http(s) 原样透传（等价真实分支）。
  persistUrlToUploads: (url: string) => {
    if (url.startsWith('/files/') || url.startsWith('http://127.0.0.1:18080/files/')) {
      return Promise.resolve({ ok: true as const, url, source: 'already-local' as const });
    }
    if (url.startsWith('data:') || url.startsWith('blob:')) {
      return Promise.resolve({
        ok: true as const,
        url: 'http://127.0.0.1:18080/files/canvas/persisted.png',
        source: 'inline' as const,
      });
    }
    return Promise.resolve({ ok: true as const, url, source: 'uploaded' as const });
  },
}));
// 【2026-09-18 · 测试基建修正】此前本文件**未替换** `loadImageWithTimeout`，缩略图加载走的是
// 源码里的真实现：`new Image()` + `setTimeout(IMAGE_LOAD_TIMEOUT=10000)`。jsdom 下 stub 的
// `Image` 永不触发 onload/onerror，于是 promise 只能等**真实的 10 秒**超时，或等用例里手写的
// `fakeImg.onerror?.()`。
//
// 这在 `addImages` 尚为**同步**时没暴露 —— 组件先 `updateData` 再启 `makeThumb`，
// 断言在缩略图 promise 未决时就已满足。TD-02-62 把落盘+缩略图整体**移到写回之前**
// （`await Promise.all(...)`）后，这条 10 秒/手写触发的时序就成了唯一决定项：
// 用例里 `fakeImg.onerror?.()` 在 `fireEvent.click` 之后**同步**执行，而此刻
// `makeThumb` 的 `loadImageWithTimeout` **尚未执行到** `img.src = url`（它前面还有
// 一层 `await persistUrlToUploads`）⇒ onerror 打在**上一个** Image 实例上（或根本还没挂
// 回调）⇒ promise 挂到真超时 ⇒ waitFor 先到期 ⇒ 断言 `[]`。
//
// 判据：**替身要替的是边界（加载/超时），不是断言的手动触发**。这里把边界整体替换为
// 「立即 reject」，与生产语义一致（加载失败 → `makeThumb` 返回 undefined，不挂起），
// 且**与耗时无关**。手写的 `fakeImg.onerror?.()` 保留即可（它现在是无害的 no-op）。
vi.mock('../../src/components/base/utils/asyncGuard.ts', () => ({
  loadImageWithTimeout: () => Promise.reject(new Error('测试替身：缩略图加载立即失败')),
  attemptQuietly: async (f: () => unknown) => {
    try {
      return await f();
    } catch {
      return undefined;
    }
  },
}));
vi.mock('../../src/components/base/utils/clipboard.ts', () => h.clipboardMock);
vi.mock('../../src/components/base/ui/ImageZoomDialog.tsx', () => ({ default: () => null }));

import ImageBoxNode from '../../src/components/image/nodes/ImageBoxNode.tsx';

const nodeId = 'ib1';
function setup(
  data = {},
  connected: {
    images: Array<{ id: string; url: string; label: string }>;
    texts: Array<{ id: string; text: string; sourceNodeId: string }>;
  } = { images: [], texts: [] },
) {
  h.state.nodes = [{ id: nodeId, data: { ...data } }];
  h.setNodesMock.mockClear();
  h.clipboardMock.downloadUrl.mockClear();
  mocks.resetNodeMockState();
  mocks.setConnectedInputs(connected);
  return render(<ImageBoxNode id={nodeId} data={{ ...data }} selected={false} />);
}
function lastData(): any {
  return h.state.nodes.find((n) => n.id === nodeId)?.data;
}
const twoImgs = [
  { id: 'a', url: 'http://x/a.png', label: 'A' },
  { id: 'b', url: 'http://x/b.png', label: 'B' },
];

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('ImageBoxNode — 空态与文件选择', () => {
  it('空态渲染引导文案', () => {
    setup();
    expect(screen.getByText('拖拽 / 粘贴 / 点击添加图片')).toBeTruthy();
  });

  it('点击空态 → 触发隐藏文件选择 input', () => {
    const { container } = setup();
    const input = container.querySelector('input[type="file"]');
    const clickSpy = vi.spyOn(input as unknown as HTMLInputElement, 'click');
    fireEvent.click(screen.getByText('拖拽 / 粘贴 / 点击添加图片'));
    expect(clickSpy).toHaveBeenCalled();
  });
});

describe('ImageBoxNode — 展开/折叠与选择', () => {
  it('展开 → data.expanded=true；折叠 → data.expanded=false', () => {
    setup({ images: twoImgs, activeIndex: 0 });
    fireEvent.click(screen.getByTitle('展开为缩略图网格'));
    expect(lastData().expanded).toBe(true);

    // 模拟 React Flow 把新 data 回传给节点后，再折叠
    const utils = render(
      <ImageBoxNode
        id={nodeId}
        data={{ images: twoImgs, activeIndex: 0, expanded: true }}
        selected={false}
      />,
    );
    fireEvent.click(screen.getByTitle('折叠为单图'));
    expect(lastData().expanded).toBe(false);
    utils.unmount();
  });

  it('未选中时点「全选」→ selectedIds 为全部图 id', () => {
    setup({ images: twoImgs, activeIndex: 0, expanded: true });
    fireEvent.click(screen.getByTitle('全选'));
    expect(lastData().selectedIds).toEqual(['a', 'b']);
  });

  it('已全选时点「取消全选」→ selectedIds 清空', () => {
    setup({ images: twoImgs, activeIndex: 0, expanded: true, selectedIds: ['a', 'b'] });
    fireEvent.click(screen.getByTitle('取消全选'));
    expect(lastData().selectedIds).toEqual([]);
  });

  it('网格模式点击缩略图 → 切换选中', () => {
    setup({ images: twoImgs, activeIndex: 0, expanded: true });
    fireEvent.click(screen.getByTitle('A'));
    expect(lastData().selectedIds).toEqual(['a']);
  });

  it('网格模式再点已选缩略图 → 取消选中', () => {
    setup({ images: twoImgs, activeIndex: 0, expanded: true, selectedIds: ['a'] });
    fireEvent.click(screen.getByTitle('A'));
    expect(lastData().selectedIds).toEqual([]);
  });

  it('删除已选 → 移除选中图、清空 selectedIds、activeIndex 收敛', () => {
    const imgs = [
      { id: 'a', url: 'u1', label: 'A' },
      { id: 'b', url: 'u2', label: 'B' },
      { id: 'c', url: 'u3', label: 'C' },
    ];
    setup({ images: imgs, activeIndex: 2, expanded: true, selectedIds: ['a', 'c'] });
    fireEvent.click(screen.getByTitle('删除已选'));
    expect(lastData().images.map((i: any) => i.id)).toEqual(['b']);
    expect(lastData().selectedIds).toEqual([]);
    expect(lastData().activeIndex).toBe(0);
  });
});

describe('ImageBoxNode — 单图导航', () => {
  it('点下一张 activeIndex 前进并循环', () => {
    const utils = setup({ images: twoImgs, activeIndex: 0 });
    fireEvent.click(screen.getByTitle('下一张'));
    expect(lastData().activeIndex).toBe(1);
    // 模拟 React Flow 回传新 data
    utils.rerender(
      <ImageBoxNode id={nodeId} data={{ images: twoImgs, activeIndex: 1 }} selected={false} />,
    );
    fireEvent.click(screen.getByTitle('下一张'));
    expect(lastData().activeIndex).toBe(0);
    utils.unmount();
  });

  it('点上一张 activeIndex 回退并循环', () => {
    const utils = setup({ images: twoImgs, activeIndex: 0 });
    fireEvent.click(screen.getByTitle('上一张'));
    expect(lastData().activeIndex).toBe(1);
    utils.unmount();
  });

  it('单图模式点下载 → 调用 clipboard.downloadUrl', () => {
    setup({ images: twoImgs, activeIndex: 0 });
    fireEvent.click(screen.getByTitle('下载当前图片'));
    expect(h.clipboardMock.downloadUrl).toHaveBeenCalled();
  });
});

describe('ImageBoxNode — 从上游连线导入', () => {
  it('导入上游图片 → 追加 images（source=connect）并 activeIndex 指向最后', async () => {
    // makeThumb 内部 new Image()，jsdom 不触发 onload；用 stub 手动触发 onerror 使缩略图生成为 undefined
    const fakeImg = {
      crossOrigin: '',
      onload: null as (() => void) | null,
      onerror: null as ((e?: Error) => void) | null,
      src: '',
    };
    vi.stubGlobal(
      'Image',
      vi.fn(() => fakeImg),
    );
    setup(
      { images: [], activeIndex: 0 },
      { images: [{ id: 'u1', url: 'http://x/up.png', label: '' }], texts: [] },
    );

    fireEvent.click(screen.getByTitle('从连线图一键导入'));
    fakeImg.onerror?.();
    await waitFor(() => {
      expect(lastData().images).toHaveLength(1);
      expect(lastData().images[0].url).toBe('http://x/up.png');
      expect(lastData().images[0].source).toBe('connect');
      expect(lastData().activeIndex).toBe(0);
    });
  });

  it('无上游连线时导入 → 提示 warning', () => {
    setup({ images: [], activeIndex: 0 });
    fireEvent.click(screen.getByTitle('从连线图一键导入'));
    expect(mocks.toastCalls.warn).toBeGreaterThan(0);
  });

  it('【TD-02-62】上游连线源携 data: 图 → addImages 内部统一落盘，images[].url 不内联 dataURL', async () => {
    // 回归点：此前 `importFromConnection` → `addImages` 直接裸写上游 url，而上游 `isAssetUrl`
    // 明确放行 `data:`（assetType.ts:119）⇒ 整图 base64 可进 node.data.images → 画布快照膨胀。
    const fakeImg = {
      crossOrigin: '',
      onload: null as (() => void) | null,
      onerror: null as ((e?: Error) => void) | null,
      src: '',
    };
    vi.stubGlobal(
      'Image',
      vi.fn(() => fakeImg),
    );
    const inline = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==';
    setup(
      { images: [], activeIndex: 0 },
      { images: [{ id: 'u1', url: inline, label: '' }], texts: [] },
    );

    fireEvent.click(screen.getByTitle('从连线图一键导入'));
    fakeImg.onerror?.();
    await waitFor(() => {
      expect(lastData().images).toHaveLength(1);
      const url = lastData().images[0].url as string;
      expect(url.startsWith('data:')).toBe(false); // 关键：禁止内联 dataURL 落进快照
      expect(url).toBe('http://127.0.0.1:18080/files/canvas/persisted.png');
    });
  });
});

describe('ImageBoxNode — 上传/拖入文件落盘(TD-10)', () => {
  it('选择本地图片文件 → 经 filesApi.resolveNodeAssetUrl 落盘，data.images[].url 存持久 URL 而非内联 dataURL', async () => {
    // makeThumb 内部 new Image()；jsdom 不触发 onload，手动触发 onerror 让缩略图快速失败（不影响 url 落盘）
    const fakeImg = {
      crossOrigin: '',
      onload: null as (() => void) | null,
      onerror: null as ((e?: Error) => void) | null,
      src: '',
    };
    vi.stubGlobal(
      'Image',
      vi.fn(() => fakeImg),
    );
    const { container } = setup({ images: [], activeIndex: 0 });
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File([new Uint8Array([1, 2, 3])], 'pic.png', { type: 'image/png' });
    // jsdom 下 FileList 只读，需 defineProperty 注入后再触发 change
    Object.defineProperty(input, 'files', { value: [file], configurable: true });
    fireEvent.change(input);
    await waitFor(() => {
      fakeImg.onerror?.(); // 让 makeThumb 的 loadImageWithTimeout 立即 reject（setNodes 在 addImages 之后）
      expect(lastData().images).toHaveLength(1);
      const url = lastData().images[0].url as string;
      expect(url.startsWith('data:')).toBe(false); // 关键：禁止整图 dataURL 内联进快照
      expect(url).toBe('http://127.0.0.1:18080/files/canvasDrop/pic.png');
      expect(lastData().images[0].source).toBe('upload');
    });
  });
});
