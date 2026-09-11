// @vitest-environment jsdom
/**
 * useNodeField 单测（收口：ImageGenerate / TextGenerate / VideoGenerate / TemplateNode 里
 * 逐字重复的「useState + setXPersist 包装 + 写回 effect」三段样板）。
 * 覆盖：挂载写回初始值 / setValue 写回 / 函数式更新（原 setXPersist 提供的能力）/ 字段名映射。
 * 本 hook 不依赖 reactflow（writer 由调用方注入），故无需 mock @xyflow/react。
 */
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useNodeField } from '../../src/hooks/useNodeField.ts';

describe('useNodeField — 本地 state → node.data 字段', () => {
  it('挂载即把初始值写回 { field: initial }（与既有 useEffect 落盘行为一致）', () => {
    const write = vi.fn();
    renderHook(() => useNodeField('prompt', 'hi', write));
    expect(write).toHaveBeenCalledWith({ prompt: 'hi' });
  });

  it('setValue 写回新值，且 patch 只带该字段名（不覆盖其它 data 字段）', () => {
    const write = vi.fn();
    const { result } = renderHook(() => useNodeField('prompt', 'hi', write));

    act(() => result.current[1]('next'));

    expect(result.current[0]).toBe('next');
    expect(write).toHaveBeenLastCalledWith({ prompt: 'next' });
  });

  it('支持函数式更新（等价于被删掉的 setXPersist 包装能力）', () => {
    const write = vi.fn();
    const { result } = renderHook(() => useNodeField('prompt', 'a', write));

    act(() => result.current[1]((prev) => `${prev}b`));

    expect(result.current[0]).toBe('ab');
    expect(write).toHaveBeenLastCalledWith({ prompt: 'ab' });
  });

  it('boolean 字段（如 autoSplit / inputLocked）切换即写回', () => {
    const write = vi.fn();
    const { result } = renderHook(() => useNodeField('inputLocked', true, write));

    act(() => result.current[1](false));

    expect(result.current[0]).toBe(false);
    expect(write).toHaveBeenLastCalledWith({ inputLocked: false });
  });

  it('写回走的是当次传入的 writer（防抖/即时可分别注入，无需改 hook）', () => {
    const debounced = vi.fn();
    const { result } = renderHook(() => useNodeField('text', 'x', debounced));

    act(() => result.current[1]('y'));

    expect(debounced).toHaveBeenLastCalledWith({ text: 'y' });
  });
});
