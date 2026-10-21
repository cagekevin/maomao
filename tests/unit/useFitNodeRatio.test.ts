// @vitest-environment jsdom
/**
 * useFitNodeRatio 单测（批 3）。
 * 覆盖 useFitNodeRatio(id).fitByRatio(naturalW, naturalH)：
 *   - 按当前节点宽度 + 媒体真实宽高比算高度，clamp 到 [80,900]
 *   - 调 onMainBoxResize（→ setNodes）写回 width/height（不可变）
 *   - 非法输入（缺宽高/比例非正）→ 不写
 * 通过 mock @xyflow/react 捕获 setNodes 验证。
 */
import { describe, it, expect, vi } from 'vitest';
import { at } from '../helpers/at';
import { renderHook } from '@testing-library/react';
import type { SyntheticEvent } from 'react';

const setNodes = vi.fn();
const getNodes = vi.fn(() => [
  { id: 'n1', width: 400, height: 100, style: { width: 400, height: 100 } },
]);
// P7：useFitNodeRatio 改为 getNode(id) 实时读（替 getNodes().find），测试 mock 需同步提供
const getNode = vi.fn((id) => getNodes().find((n) => n.id === id));
const updateNodeInternals = vi.fn();

vi.mock('@xyflow/react', () => ({
  useReactFlow: () => ({ getNodes, getNode, setNodes, screenToFlowPosition: (p: any) => p }),
  useUpdateNodeInternals: () => updateNodeInternals,
}));

const { useFitNodeRatio } = await import('../../src/components/image/hooks/useFitNodeRatio.ts');

function lastSetNodesUpdate() {
  const updater = at(setNodes.mock.calls, setNodes.mock.calls.length - 1)[0];
  return updater([{ id: 'n1', data: {}, style: {} }])[0];
}

/**
 * 构造仅带媒体尺寸的合成事件替身。
 * React 合成事件只能由 React 自己派发，测试无法 `new`；这里按 `BaseSyntheticEvent` 的**全形状**
 * 逐项填齐（被测不读的成员给安全实现）⇒ 缺成员时 tsc 直接报错，不靠断言骗类型。
 * `naturalWidth` / `videoWidth` 是只读属性，只能用 defineProperty 注入。
 */
function mediaEvent(tag: 'img', dims: Record<string, number>): SyntheticEvent<HTMLImageElement>;
function mediaEvent(tag: 'video', dims: Record<string, number>): SyntheticEvent<HTMLVideoElement>;
function mediaEvent(tag: 'img' | 'video', dims: Record<string, number>): SyntheticEvent<Element> {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(dims))
    Object.defineProperty(el, k, { value: v, configurable: true });
  return syntheticOf(el);
}

/** 全形状 `BaseSyntheticEvent`（`Element extends Node extends EventTarget`，故 `currentTarget` 可直接赋值）。 */
function syntheticOf<E extends Element>(currentTarget: E): SyntheticEvent<E> {
  return {
    nativeEvent: new Event('load'),
    currentTarget,
    target: currentTarget,
    bubbles: false,
    cancelable: false,
    defaultPrevented: false,
    eventPhase: 0,
    isTrusted: true,
    preventDefault: () => undefined,
    isDefaultPrevented: () => false,
    stopPropagation: () => undefined,
    isPropagationStopped: () => false,
    persist: () => undefined,
    timeStamp: 0,
    type: 'load',
  };
}

describe('useFitNodeRatio', () => {
  it('宽高比 2 → 高度 = 宽/2 = 200，写回 width 保持、height=200', () => {
    const { result } = renderHook(() => useFitNodeRatio('n1'));
    setNodes.mockClear();
    result.current.fitByRatio(2000, 1000);
    const node = lastSetNodesUpdate();
    expect(node.width).toBe(400);
    expect(node.height).toBe(200);
    expect(node.style).toMatchObject({ width: 400, height: 200 });
  });

  it('极端宽高比（1000x50 → ratio20 → h=20 <80 → clamp 到 80）', () => {
    const { result } = renderHook(() => useFitNodeRatio('n1'));
    setNodes.mockClear();
    result.current.fitByRatio(1000, 50);
    const node = lastSetNodesUpdate();
    expect(node.height).toBe(80);
  });

  it('非法输入（缺宽/高或比例<=0）→ 不写 setNodes', () => {
    const { result } = renderHook(() => useFitNodeRatio('n1'));
    setNodes.mockClear();
    result.current.fitByRatio(0, 0);
    result.current.fitByRatio(100, 0);
    result.current.fitByRatio(100, -5);
    expect(setNodes).not.toHaveBeenCalled();
  });

  it('fitFromImage / fitFromVideo 透传到 fitByRatio（读取节点尺寸）', () => {
    const { result } = renderHook(() => useFitNodeRatio('n1'));
    getNode.mockClear();
    result.current.fitFromImage(
      mediaEvent('img', { naturalWidth: 800, naturalHeight: 400 }),
    );
    // handler 透传 media 尺寸 → fitByRatio 读取当前节点尺寸
    expect(getNode).toHaveBeenCalled();
    getNode.mockClear();
    result.current.fitFromVideo(
      mediaEvent('video', { videoWidth: 1600, videoHeight: 400 }),
    );
    expect(getNode).toHaveBeenCalled();
  });
});
