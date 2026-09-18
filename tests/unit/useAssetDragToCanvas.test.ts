// @vitest-environment jsdom
/**
 * useAssetDragToCanvas 单测（批 3）。
 * 覆盖：
 *   - makeAssetDragProps(asset, opts)：asset={url,name,type}
 *       · 有 url → draggable=true，onDragStart 写 application/x-yimao-asset 与 effectAllowed=copy
 *       · 文字素材(type==='text') 走异步 fetchText 补全 text（测试中 mock fetch）
 *       · opts.disable=true 或 无 url → draggable=false，onDragStart 不写数据
 *   - useAssetDragToCanvas()：返回 { assetDragProps }，等价于 makeAssetDragProps
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import type { DragEvent as ReactDragEvent } from 'react';

const {
  makeAssetDragProps,
  useAssetDragToCanvas,
  fetchText: _fetchText,
  useTextAsset,
  textCache,
} = await import('../../src/hooks/useAssetDragToCanvas.ts');

// setup.mjs 已把 globalThis.fetch 定义为共享 vi.fn；此处做类型对齐以启用 .mock* / mock.calls。
const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;

function fakeDataTransfer() {
  const store: Record<string, any> = {};
  // 仅 mock 被测用到的 setData/getData/setDragImage/effectAllowed；cast 成 DataTransfer 以满足 onDragStart 入参类型
  return {
    setData: (k: any, v: any) => {
      store[k] = v;
    },
    getData: (k: any) => store[k],
    setDragImage: vi.fn(),
    effectAllowed: '',
    _store: store,
  } as unknown as DataTransfer;
}

describe('makeAssetDragProps', () => {
  beforeEach(() => {
    textCache.clear();
    fetchMock.mockClear();
  });

  it('有 url → draggable=true，拖动写入 x-yimao-asset 信封 + copy 语义', () => {
    const props = makeAssetDragProps({ url: 'http://x/y.png', name: '图', type: 'image' });
    // 源码 dragEnabled = asset && asset.url → draggable 为「真值 URL 字符串」
    expect(props.draggable).toBeTruthy();
    const dt = fakeDataTransfer();
    // 只喂被测用到的 dataTransfer 字段（踩坑记录 #11 的 DOM mock 收尾惯例）
    props.onDragStart({ dataTransfer: dt } as unknown as ReactDragEvent);
    const parsed = JSON.parse(dt.getData('application/x-yimao-asset'));
    expect(parsed).toMatchObject({ url: 'http://x/y.png', name: '图', type: 'image' });
    expect(dt.effectAllowed).toBe('copy');
  });

  it('无 url → draggable 假值，且 onDragStart 不写数据', () => {
    const props = makeAssetDragProps({ name: '无图' });
    expect(props.draggable).toBeFalsy();
    const dt = fakeDataTransfer();
    // 只喂被测用到的 dataTransfer 字段（踩坑记录 #11 的 DOM mock 收尾惯例）
    props.onDragStart({ dataTransfer: dt } as unknown as ReactDragEvent);
    expect(dt.getData('application/x-yimao-asset')).toBeFalsy();
  });

  it('opts.disable=true → 禁用拖拽', () => {
    const props = makeAssetDragProps({ url: 'http://x/y.png' }, { disable: true });
    expect(props.draggable).toBeFalsy();
  });

  it('文字素材 → 异步 fetchText 补全 text 字段', async () => {
    fetchMock.mockImplementation(() => Promise.resolve({ ok: true, text: async () => '正文内容' }));
    const props = makeAssetDragProps({ url: 'http://x/t.txt', name: '文', type: 'text' });
    const dt = fakeDataTransfer();
    // 只喂被测用到的 dataTransfer 字段（踩坑记录 #11 的 DOM mock 收尾惯例）
    props.onDragStart({ dataTransfer: dt } as unknown as ReactDragEvent);
    // 初次仅有 url/name/type
    const first = JSON.parse(dt.getData('application/x-yimao-asset'));
    expect(first.text).toBeUndefined();
    await new Promise((r) => setTimeout(r, 10));
    const updated = JSON.parse(dt.getData('application/x-yimao-asset'));
    expect(updated.text).toBe('正文内容');
    expect(textCache.get('http://x/t.txt')).toBe('正文内容');
  });

  // TD-18-17：读失败必须诚实（判别联合），且**失败值不得写进缓存** —— 旧实现 `.catch(() => '')`
  // 把 `''` 缓存下来，此后该 url 永远命中缓存、永远返回空 ⇒ 失败被固化、不再重试。
  it('读失败 → {ok:false}，失败不入缓存，恢复后能重试成功', async () => {
    // httpRequest 对非 2xx 一律 throw（httpClient.ts:228/244）⇒ 用 reject 走真实失败路径
    fetchMock.mockImplementation(() => Promise.reject(new Error('ECONNREFUSED')));
    const failed = await _fetchText('http://x/fail.txt');
    expect(failed.ok).toBe(false);
    expect(textCache.has('http://x/fail.txt')).toBe(false); // 关键：失败不被固化

    fetchMock.mockImplementation(() =>
      Promise.resolve({ ok: true, text: async () => '恢复后正文' }),
    );
    const recovered = await _fetchText('http://x/fail.txt');
    expect(recovered.ok).toBe(true);
    expect(textCache.get('http://x/fail.txt')).toBe('恢复后正文');
  });
});

describe('useTextAsset（读取 + 三态唯一实现 · 3 处面板副本的收口点）', () => {
  beforeEach(() => {
    textCache.clear();
    fetchMock.mockClear();
  });

  it('成功 → phase 由 loading 变 ok 并带 text', async () => {
    fetchMock.mockImplementation(() => Promise.resolve({ ok: true, text: async () => '正文' }));
    const { result } = renderHook(() => useTextAsset('http://x/a.txt'));
    expect(result.current.phase).toBe('loading');
    await waitFor(() => expect(result.current).toMatchObject({ phase: 'ok', text: '正文' }));
  });

  it('失败 → phase=failed（不再与"真空文件"一同永远停在加载中）', async () => {
    fetchMock.mockImplementation(() => Promise.reject(new Error('ECONNREFUSED')));
    const { result } = renderHook(() => useTextAsset('http://x/b.txt'));
    await waitFor(() => expect(result.current).toMatchObject({ phase: 'failed' }));
    expect(result.current).toHaveProperty('error');
  });
});

describe('useAssetDragToCanvas', () => {
  it('返回 { assetDragProps } 等价于 makeAssetDragProps', () => {
    const { result } = renderHook(() => useAssetDragToCanvas());
    expect(typeof result.current.assetDragProps).toBe('function');
    const props = result.current.assetDragProps({
      url: 'http://x/y.png',
      name: '图',
      type: 'image',
    });
    expect(props.draggable).toBeTruthy();
    const dt = fakeDataTransfer();
    // 只喂被测用到的 dataTransfer 字段（踩坑记录 #11 的 DOM mock 收尾惯例）
    props.onDragStart({ dataTransfer: dt } as unknown as ReactDragEvent);
    expect(JSON.parse(dt.getData('application/x-yimao-asset')).url).toBe('http://x/y.png');
  });
});
