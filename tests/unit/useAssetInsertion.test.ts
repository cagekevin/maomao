// @vitest-environment jsdom
/**
 * useAssetInsertion 单测（TD-04-52 收口）。
 *
 * 契约两条：
 *  ① `insertMention` 引用**跨渲染稳定** —— 它作为 `onInsert` 传给 `memo(ResourceStrip)`，
 *     引用一变就击穿浅比较（原 4 节点各写一份普通函数，memo 从未命中）；
 *  ② `insertMention` 把素材**转发**给 `insertAssetRef` 承接的上抛函数。
 */
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAssetInsertion } from '../../src/hooks/useAssetInsertion.ts';

describe('useAssetInsertion — 富文本素材插入原语（TD-04-52）', () => {
  it('insertMention 跨渲染引用稳定（memo(ResourceStrip) 可命中）', () => {
    // 反证：把 hook 里的 useCallback 去掉、改回普通函数 ⇒ 本断言红。
    const { result, rerender } = renderHook(() => useAssetInsertion());
    const first = result.current.insertMention;
    rerender();
    expect(result.current.insertMention).toBe(first);
    rerender();
    expect(result.current.insertMention).toBe(first);
  });

  it('insertMention 把素材转发给 insertAssetRef 上抛的函数', () => {
    const { result } = renderHook(() => useAssetInsertion());
    const insert = vi.fn();
    act(() => {
      result.current.insertAssetRef.current = insert;
    });
    act(() => {
      result.current.insertMention({ id: 'asset-1' });
    });
    expect(insert).toHaveBeenCalledWith({ id: 'asset-1' });
  });
});
