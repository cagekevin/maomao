// @vitest-environment jsdom
// 回归测试：useMediaDegrade.js、nodePrefs.js、imageCompress.js
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// ───────────────────────────────────────────────────────────
// 1. useMediaDegrade.js
// 依赖 useLod()（LodContext）。mock useLod 返回不同 lodLevel。
// ───────────────────────────────────────────────────────────
vi.mock('../../src/components/base/canvas/lod.tsx', () => ({
  useLod: vi.fn(() => ({
    lodLevel: 0,
    viewportMoving: false,
    nodeCount: 0,
    handleFollowLimit: 60,
    edgeFxLimit: 50,
    useThumbnail: false,
  })),
}));
import { useLod } from '../../src/components/base/canvas/lod.tsx';
import { useMediaDegrade } from '../../src/hooks/useMediaDegrade.ts';
import { contentClearCache } from '../../src/components/base/core/contentStore.ts';

// useLod 实际返回完整 LOD 对象（lodLevel/viewportMoving/...6 字段），并非仅 {lodLevel}
type LodValue = ReturnType<typeof useLod>;

describe('useMediaDegrade —— lodLevel→hideMedia 映射', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lodLevel>=3 → hideMedia="image video audio"', () => {
    vi.mocked(useLod).mockReturnValue({
      lodLevel: 3,
      viewportMoving: false,
      nodeCount: 0,
      handleFollowLimit: 60,
      edgeFxLimit: 50,
      useThumbnail: false,
    });
    const { result } = renderHook(() => useMediaDegrade());
    expect(result.current.hideMedia).toBe('image video audio');
    expect(result.current.isHidden('image')).toBe(true);
    expect(result.current.isHidden('video')).toBe(true);
    expect(result.current.isHidden('audio')).toBe(true);
  });

  it('lodLevel=2 → hideMedia="image"', () => {
    vi.mocked(useLod).mockReturnValue({
      lodLevel: 2,
      viewportMoving: false,
      nodeCount: 0,
      handleFollowLimit: 60,
      edgeFxLimit: 50,
      useThumbnail: false,
    });
    const { result } = renderHook(() => useMediaDegrade());
    expect(result.current.hideMedia).toBe('image');
    expect(result.current.isHidden('image')).toBe(true);
    expect(result.current.isHidden('video')).toBe(false);
    expect(result.current.isHidden('audio')).toBe(false);
  });

  it('lodLevel<2（=1）→ hideMedia=""', () => {
    vi.mocked(useLod).mockReturnValue({
      lodLevel: 1,
      viewportMoving: false,
      nodeCount: 0,
      handleFollowLimit: 60,
      edgeFxLimit: 50,
      useThumbnail: false,
    });
    const { result } = renderHook(() => useMediaDegrade());
    expect(result.current.hideMedia).toBe('');
    expect(result.current.isHidden('image')).toBe(false);
    expect(result.current.isHidden('video')).toBe(false);
  });

  it('lodLevel=0（默认）→ hideMedia=""', () => {
    vi.mocked(useLod).mockReturnValue({
      lodLevel: 0,
      viewportMoving: false,
      nodeCount: 0,
      handleFollowLimit: 60,
      edgeFxLimit: 50,
      useThumbnail: false,
    });
    const { result } = renderHook(() => useMediaDegrade());
    expect(result.current.hideMedia).toBe('');
    expect(result.current.isHidden('image')).toBe(false);
  });

  it('lodLevel 未定义（兜底 0）→ hideMedia=""', () => {
    // 故意喂缺 lodLevel 的 shape：验证 hook 对「未初始化 context」的兜底（用 unknown as 标注此处为故意）
    vi.mocked(useLod).mockReturnValue({} as unknown as ReturnType<typeof useLod>);
    const { result } = renderHook(() => useMediaDegrade());
    expect(result.current.hideMedia).toBe('');
  });

  it('isHidden(type) = hideMedia.includes(type)', () => {
    vi.mocked(useLod).mockReturnValue({
      lodLevel: 3,
      viewportMoving: false,
      nodeCount: 0,
      handleFollowLimit: 60,
      edgeFxLimit: 50,
      useThumbnail: false,
    });
    const { result } = renderHook(() => useMediaDegrade());
    // includes 语义正确性：任意未列出的类型都隐藏为 false
    expect(result.current.isHidden('text')).toBe(false);
    expect(result.current.isHidden('')).toBe(true); // '' 总被 includes
  });
});

// ───────────────────────────────────────────────────────────
// 2. nodePrefs.js
// 依赖 storageAdapter.sGet/sSet。用内存实现 mock。
// ───────────────────────────────────────────────────────────
const prefsMem = new Map();
vi.mock('../../src/components/base/storage/storageAdapter.ts', () => ({
  sGet: vi.fn((k) => (prefsMem.has(k) ? prefsMem.get(k) : null)),
  sSet: vi.fn((k, v) => {
    prefsMem.set(k, v);
  }),
  sRemove: vi.fn((k) => {
    prefsMem.delete(k);
  }),
}));
import { useNodePrefs } from '../../src/components/base/canvas/nodePrefs.ts';

describe('nodePrefs —— 节点上次参数记忆', () => {
  beforeEach(() => {
    prefsMem.clear();
    localStorage.clear();
    contentClearCache(); // 清 contentStore 内存缓存，防跨测试污染
    vi.clearAllMocks();
  });

  it('初始化 = {...defaults, ...(上次存的该 type 参数)}（无存储时仅 defaults）', () => {
    const { result } = renderHook(() => useNodePrefs('textNode', { model: 'a', size: '1K' }));
    expect(result.current.prefs).toEqual({ model: 'a', size: '1K' });
  });

  it('初始化合并上次存储的参数（存储覆盖默认值）', () => {
    prefsMem.set(
      'yimao_node_prefs',
      JSON.stringify({ textNode: { model: 'saved', ratio: '16:9' } }),
    );
    const { result } = renderHook(() => useNodePrefs('textNode', { model: 'default', size: '1K' }));
    expect(result.current.prefs).toEqual({ model: 'saved', size: '1K', ratio: '16:9' });
  });

  it('set(patch) 合并并写回 localStorage', () => {
    const { result } = renderHook(() => useNodePrefs('textNode', { model: 'a', size: '1K' }));
    act(() => {
      result.current.set({ model: 'b' });
    });
    expect(result.current.prefs).toEqual({ model: 'b', size: '1K' });
    const stored = JSON.parse(prefsMem.get('yimao_node_prefs'));
    expect(stored.textNode).toEqual({ model: 'b', size: '1K' });
  });

  it('set 多次累计合并', () => {
    const { result } = renderHook(() => useNodePrefs('textNode', { model: 'a' }));
    act(() => {
      result.current.set({ ratio: '16:9' });
    });
    act(() => {
      result.current.set({ size: '2K' });
    });
    expect(result.current.prefs).toEqual({ model: 'a', ratio: '16:9', size: '2K' });
    const stored = JSON.parse(prefsMem.get('yimao_node_prefs'));
    expect(stored.textNode.size).toBe('2K');
  });

  it('不同 type 参数互不干扰', () => {
    const a = renderHook(() => useNodePrefs('textNode', { model: 'a' }));
    const b = renderHook(() => useNodePrefs('imageNode', { model: 'img' }));
    act(() => {
      a.result.current.set({ model: 'a2' });
    });
    // 修改 textNode 不影响 imageNode 的内存状态
    expect(b.result.current.prefs.model).toBe('img');
    // 持久化时仅写入各自 type 的 key（set 才落盘，默认值不单独落盘）
    const stored = JSON.parse(prefsMem.get('yimao_node_prefs'));
    expect(stored.textNode.model).toBe('a2');
    expect(stored.imageNode).toBeUndefined();
    // 再次 set imageNode 后两个 key 共存且互不覆盖
    act(() => {
      b.result.current.set({ model: 'img2' });
    });
    const stored2 = JSON.parse(prefsMem.get('yimao_node_prefs'));
    expect(stored2.textNode.model).toBe('a2');
    expect(stored2.imageNode.model).toBe('img2');
  });

  it('loadAll 容错：损坏 JSON 返回 {}（初始化退回纯 defaults）', () => {
    prefsMem.set('yimao_node_prefs', '{ broken json');
    const { result } = renderHook(() => useNodePrefs('textNode', { model: 'a' }));
    // 损坏 JSON 不应抛错，应退回纯默认值
    expect(result.current.prefs).toEqual({ model: 'a' });
  });
});

// ───────────────────────────────────────────────────────────
// 3. imageCompress.js
// 浏览器依赖重（canvas / Image）。测可抽离的纯逻辑：
//   - 空输入抛"无图片可压缩"
//   - toAbsoluteFileUrl 补全（/files/ 相对路径）
//   - 等比缩放计算逻辑（通过 mock loadImageWithTimeout + document.createElement 跑通主干）
// TODO: 浏览器依赖未测 —— 真实 canvas drawImage/toDataURL 的像素输出未在 node 环境断言
// ───────────────────────────────────────────────────────────
const mockImage = { naturalWidth: 0, naturalHeight: 0 };
vi.mock('../../src/components/base/utils/asyncGuard.ts', () => ({
  loadImageWithTimeout: vi.fn(async () => {
    // 返回带尺寸的对象，缩放逻辑可在此验证
    return { naturalWidth: mockImage.naturalWidth, naturalHeight: mockImage.naturalHeight };
  }),
  TimeoutError: class TimeoutError extends Error {},
  isTimeoutError: (e) => e instanceof Error && e.name === 'TimeoutError',
}));
import { compressImage } from '../../src/components/base/utils/imageCompress.ts';

describe('imageCompress —— 压缩（含浏览器依赖，部分 mock）', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockImage.naturalWidth = 0;
    mockImage.naturalHeight = 0;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('非 /files/ 输入原样经 toAbsoluteFileUrl 补全（http 不变）', async () => {
    // 通过 mock Image 尺寸 + document.createElement 验证 URL 被传入 loadImageWithTimeout
    const asyncGuard = await import('../../src/components/base/utils/asyncGuard.ts');
    mockImage.naturalWidth = 100;
    mockImage.naturalHeight = 100;
    // 验证：相对 /files/ 路径会被补全成 API_BASE 绝对地址
    const loadSpy = vi.mocked(asyncGuard.loadImageWithTimeout).mockImplementation(async (url) => {
      expect(url.startsWith('http://127.0.0.1:18080/files/')).toBe(true);
      // loadImageWithTimeout 真实返回 HTMLImageElement；此处用最小替身满足类型（naturalWidth/Height 是测试关心的字段）
      return { naturalWidth: 100, naturalHeight: 100 } as unknown as HTMLImageElement;
    });
    // mock canvas
    setupCanvasMock(100, 100, 'data:image/jpeg;base64,AAAA');
    const out = await compressImage('/files/abc.png');
    expect(out.width).toBe(100);
    expect(out.height).toBe(100);
    expect(out.dataUrl.startsWith('data:image/jpeg')).toBe(true);
    loadSpy.mockRestore();
  });

  it('maxSize 等比缩放：宽>=高时按宽边缩放', async () => {
    mockImage.naturalWidth = 400;
    mockImage.naturalHeight = 200;
    setupCanvasMock(200, 100, 'data:image/jpeg;base64,BBBB');
    const out = await compressImage('http://example.com/img.jpg', { maxSize: 200 });
    expect(out.width).toBe(200);
    expect(out.height).toBe(100); // 200/400*200
  });

  it('maxSize 等比缩放：高>宽时按高边缩放', async () => {
    mockImage.naturalWidth = 200;
    mockImage.naturalHeight = 400;
    setupCanvasMock(100, 200, 'data:image/jpeg;base64,CCCC');
    const out = await compressImage('http://example.com/img.jpg', { maxSize: 200 });
    expect(out.width).toBe(100); // 200/400*200
    expect(out.height).toBe(200);
  });

  it('无 maxSize 时保持原尺寸', async () => {
    mockImage.naturalWidth = 300;
    mockImage.naturalHeight = 150;
    setupCanvasMock(300, 150, 'data:image/jpeg;base64,DDDD');
    const out = await compressImage('http://example.com/img.jpg');
    expect(out.width).toBe(300);
    expect(out.height).toBe(150);
  });

  it('fetch 失败（原图体积获取失败）不阻断，originalSize 为 0', async () => {
    mockImage.naturalWidth = 100;
    mockImage.naturalHeight = 100;
    setupCanvasMock(100, 100, 'data:image/jpeg;base64,EEEE');
    // 非 data: URL 且 fetch 抛错时 originalSize 应回退为 0
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('net');
      }),
    );
    const out = await compressImage('http://example.com/img.jpg');
    expect(out.originalSize).toBe(0);
    expect(out.blob).toBeTruthy();
  });

  it('data: URL 输入时 originalSize 由 base64 推导', async () => {
    mockImage.naturalWidth = 50;
    mockImage.naturalHeight = 50;
    const dataUrl = 'data:image/png;base64,' + Buffer.from('dummy').toString('base64');
    setupCanvasMock(50, 50, dataUrl);
    const out = await compressImage(dataUrl);
    // atob(payload).length === 'dummy'.length === 5
    expect(out.originalSize).toBe(5);
  });
});

// ── 辅助：mock jsdom 的 canvas（drawImage 为空操作，toDataURL 返回预设）──
function setupCanvasMock(w, h, toDataUrlReturn) {
  globalThis.document.createElement = vi.fn((tag) => {
    if (tag === 'canvas') {
      return {
        width: 0,
        height: 0,
        getContext: () => ({
          fillStyle: '',
          fillRect: vi.fn(),
          drawImage: vi.fn(),
        }),
        toDataURL: vi.fn(() => toDataUrlReturn),
      } as unknown as HTMLCanvasElement;
    }
    return {} as unknown as HTMLElement;
  }) as unknown as typeof document.createElement;
}
