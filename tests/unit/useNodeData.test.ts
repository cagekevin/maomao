// @vitest-environment jsdom
/**
 * useNodeData 单测（P0-2-a 基础设施）。
 * 纯 hook 逻辑：patchData 不可变局部更新 / patchDebounced 防抖 + flush。
 * 用 vi.mock 隔离 @xyflow/react（仅取 useReactFlow().setNodes），不依赖真实 ReactFlowProvider。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const setNodesMock = vi.hoisted(() => vi.fn());
vi.mock('@xyflow/react', () => ({
  useReactFlow: () => ({ setNodes: setNodesMock }),
}));

const { useNodeData } = await import('../../src/hooks/useNodeData.ts');

describe('useNodeData — patchData', () => {
  beforeEach(() => setNodesMock.mockClear());

  it('不可变局部更新：只合并目标节点 data，其它节点不动', () => {
    const ns = [
      { id: 'n1', data: { a: 1 } },
      { id: 'n2', data: { a: 9 } },
    ];
    let updater;
    setNodesMock.mockImplementation((u) => {
      updater = u;
    });
    const { result } = renderHook(() => useNodeData('n1'));

    act(() => result.current.patchData({ b: 2 }));
    // setNodes 应收到「函数式更新器」，才能做不可变局部更新
    expect(typeof updater).toBe('function');

    const next = updater!(ns);
    expect(next).not.toBe(ns);
    expect(next[0]).toEqual({ id: 'n1', data: { a: 1, b: 2 } });
    expect(next[1].data).toBe(ns[1].data); // 其它节点 data 引用不动
  });
});

describe('useNodeData — patchDebounced', () => {
  beforeEach(() => setNodesMock.mockClear());

  it('防抖：连续多次调用不立即写，flush 后只写最后一次', () => {
    const ns = [{ id: 'n1', data: { a: 1 } }];
    let updater;
    setNodesMock.mockImplementation((u) => {
      updater = u;
    });
    const { result } = renderHook(() => useNodeData('n1'));

    act(() => {
      result.current.patchDebounced({ a: 2 });
      result.current.patchDebounced({ a: 3 });
    });
    // 防抖窗口内未 flush 前不触发 setNodes
    expect(setNodesMock).not.toHaveBeenCalled();

    act(() => result.current.patchDebounced.flush());
    expect(typeof updater).toBe('function');
    expect(updater!(ns)[0].data).toEqual({ a: 3 }); // 只写最后一次
  });
});

describe('useNodeData — 字典 GC（TD-05-13 · I1：孤儿字典项不得随快照落盘）', () => {
  beforeEach(() => setNodesMock.mockClear());

  /** 挂好 updater，返回「跑一次 updater」的闭包 */
  const mount = (id = 'n1') => {
    let updater;
    setNodesMock.mockImplementation((u) => {
      updater = u;
    });
    const { result } = renderHook(() => useNodeData(id));
    return { result, run: (ns: unknown[]) => updater!(ns) };
  };

  it('写 prompt 时裁掉已删胶囊的孤儿字典项', () => {
    const ns = [
      {
        id: 'n1',
        data: {
          prompt: '@{cp_style-643:暖阳}', // 用户刚删掉 cp_style-999 的胶囊
          creativePresets: {
            'cp_style-643': { kind: 'style', name: '暖阳', prompt: '视觉风格：暖阳' },
            'cp_style-999': { kind: 'style', name: '孤儿', prompt: '被删' },
          },
        },
      },
    ];
    const { result, run } = mount();
    act(() => result.current.patchData({ prompt: '@{cp_style-643:暖阳}' }));
    const data = run(ns)[0].data;
    expect(Object.keys(data.creativePresets)).toEqual(['cp_style-643']);
  });

  it('prompt 里胶囊全删 → 字典清空（不只留空壳）', () => {
    const ns = [
      {
        id: 'n1',
        data: {
          prompt: '纯文本',
          creativePresets: { 'cp_style-1': { kind: 'style', prompt: 'x' } },
        },
      },
    ];
    const { result, run } = mount();
    act(() => result.current.patchData({ prompt: '纯文本' }));
    expect(run(ns)[0].data.creativePresets).toEqual({});
  });

  it('不触及 prompt/text 的 patch 不做 GC（避免无谓重建 / 误删）', () => {
    const dict = { 'cp_style-1': { kind: 'style', prompt: 'x' } };
    const ns = [{ id: 'n1', data: { prompt: '无胶囊', creativePresets: dict } }];
    const { result, run } = mount();
    act(() => result.current.patchData({ selectedModel: 'gpt-4o' }));
    // 未触及 chip 字段 → 字典原引用不动（GC 不该在无关写回上跑）
    expect(run(ns)[0].data.creativePresets).toBe(dict);
  });

  it('TextGenerate：胶囊在 text 字段时按 text 保留（prompt/text 并集）', () => {
    const ns = [
      {
        id: 'n1',
        data: {
          prompt: '',
          text: '@{cp_prompt-1:我的提示词}',
          creativePresets: {
            'cp_prompt-1': { kind: 'prompt', prompt: '正文' },
            'cp_style-9': { kind: 'style', prompt: '孤儿' },
          },
        },
      },
    ];
    const { result, run } = mount();
    act(() => result.current.patchData({ text: '@{cp_prompt-1:我的提示词}' }));
    expect(Object.keys(run(ns)[0].data.creativePresets)).toEqual(['cp_prompt-1']);
  });

  it('无字典时不引入空字段（不污染新建节点 data）', () => {
    const ns = [{ id: 'n1', data: { prompt: '文本' } }];
    const { result, run } = mount();
    act(() => result.current.patchData({ prompt: '文本' }));
    expect('creativePresets' in run(ns)[0].data).toBe(false);
  });

  it('插入→保留→删除→清除（与 addCreativePreset 的顺序兼容）', () => {
    // 模拟真实序列：addCreativePreset 立即写字典（此时 prompt 还是旧的），
    // 随后的 prompt 写回（防抖 600ms 后才到）里已含胶囊 → 必须保留该键。
    const inserted = [
      {
        id: 'n1',
        data: {
          prompt: '',
          creativePresets: { 'cp_style-643': { kind: 'style', prompt: '暖阳' } },
        },
      },
    ];
    const { result, run } = mount();
    act(() => result.current.patchData({ prompt: '@{cp_style-643:暖阳}' }));
    expect(Object.keys(run(inserted)[0].data.creativePresets)).toEqual(['cp_style-643']);

    // 用户接着删掉胶囊 → 再写 prompt → 该键被清除
    const removed = [
      {
        id: 'n1',
        data: {
          prompt: '@{cp_style-643:暖阳}',
          creativePresets: { 'cp_style-643': { kind: 'style', prompt: '暖阳' } },
        },
      },
    ];
    act(() => result.current.patchData({ prompt: '' }));
    expect(run(removed)[0].data.creativePresets).toEqual({});
  });
});
