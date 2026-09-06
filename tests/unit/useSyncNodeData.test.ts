// @vitest-environment jsdom
/**
 * useSyncNodeData 单测（批 1-9，hook 类）。
 * 覆盖：节点 data 字段变化 → 对应 setter 被调用；首次渲染（初始化）不调用 setter；
 * 未变化的字段不重复调用；只对 setters 映射中存在的字段生效。
 * 策略：jsdom + @testing-library/react renderHook + rerender 改变 data。
 * 该 hook 仅依赖 React，无需 mock 任何业务模块。
 */
import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';

const { useSyncNodeData } = await import('../../src/hooks/useSyncNodeData.ts');

describe('useSyncNodeData — 字段同步', () => {
  it('data 中映射字段变化 → 对应 setter 被调用', () => {
    const setAspect = vi.fn();
    const setPrompt = vi.fn();
    const { rerender } = renderHook(
      ({ data }) => useSyncNodeData(data, { aspectRatio: setAspect, prompt: setPrompt }),
      { initialProps: { data: { aspectRatio: '16:9', prompt: 'a' } } },
    );
    // 首次不调用
    expect(setAspect).not.toHaveBeenCalled();
    expect(setPrompt).not.toHaveBeenCalled();

    rerender({ data: { aspectRatio: '1:1', prompt: 'a' } });
    expect(setAspect).toHaveBeenCalledWith('1:1');
    expect(setPrompt).not.toHaveBeenCalled(); // prompt 未变
  });

  it('多个字段同时变化都触发', () => {
    const setAspect = vi.fn();
    const setPrompt = vi.fn();
    const { rerender } = renderHook(
      ({ data }) => useSyncNodeData(data, { aspectRatio: setAspect, prompt: setPrompt }),
      { initialProps: { data: { aspectRatio: '16:9', prompt: 'a' } } },
    );
    rerender({ data: { aspectRatio: '4:3', prompt: 'b' } });
    expect(setAspect).toHaveBeenCalledWith('4:3');
    expect(setPrompt).toHaveBeenCalledWith('b');
  });

  it('未变化的字段不重复调用', () => {
    const setAspect = vi.fn();
    const { rerender } = renderHook(
      ({ data }) => useSyncNodeData(data, { aspectRatio: setAspect }),
      { initialProps: { data: { aspectRatio: '16:9' } } },
    );
    rerender({ data: { aspectRatio: '16:9' } });
    expect(setAspect).not.toHaveBeenCalled();
  });

  it('setters 中不存在的字段不触发任何调用', () => {
    const setAspect = vi.fn();
    const { rerender } = renderHook(
      ({ data }) => useSyncNodeData(data, { aspectRatio: setAspect }),
      { initialProps: { data: { aspectRatio: '16:9', prompt: 'x' } } },
    );
    rerender({ data: { aspectRatio: '16:9', prompt: 'y' } });
    expect(setAspect).not.toHaveBeenCalled();
  });
});
