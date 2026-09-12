// @vitest-environment jsdom
/**
 * OverlayEditor —— 上游图片同步的「异步回写不丢更新」回归测试（TD-06-8，2026-09-13）。
 *
 * 【锁什么】组件内有一个**异步 effect**：upstreamUrls 变化 → `await loadImageOrNull` → 增删 layers。
 * 异步跨越 render 周期，闭包里的 `state` 是**那次 render 的快照**。若期间外部 state 已变化
 * （用户拖动图层 / 改背景色），旧实现 `onChange({ ...闭包旧state, layers })` 会**回写覆盖**用户改动。
 *
 * 【行为断言】不测「onChange 收到函数还是对象」（那是实现形式），而测**可观察结果**：
 * 异步加载期间发生的 bgColor 变更，在 effect 完成后**必须仍在**，且新图层已被追加。
 *
 * 【先红后绿】还原为对象形式 `onChange({ ...state, ... })` → 本用例必红（bgColor 被旧值覆盖）。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, act } from '@testing-library/react';
import React, { useState } from 'react';

/** 可控的 loadImageOrNull：每次调用返回一个挂起 promise，由测试决定何时 resolve */
const pending: Array<(img: unknown) => void> = [];
vi.mock('../../src/components/base/utils/asyncGuard.ts', () => ({
  loadImageOrNull: vi.fn(
    () =>
      new Promise((res) => {
        pending.push(res as (img: unknown) => void);
      }),
  ),
}));

/** 全屏快捷键 hook 与本次无关，置空避免副作用 */
vi.mock('../../src/components/base/core/modalLayer.ts', () => ({
  useFullscreenEditorKeys: () => {},
}));

import OverlayEditor, {
  type OverlayState,
} from '../../src/components/base/editors/OverlayEditor.tsx';

/** 受控 harness：真实 useState 复现「父层持 state、子组件受控」的形态 */
let setOuterState: React.Dispatch<React.SetStateAction<OverlayState>> | null = null;
let latestState: OverlayState | null = null;

function Harness({ upstreamUrls, initial }: { upstreamUrls: string[]; initial: OverlayState }) {
  const [state, setState] = useState<OverlayState>(initial);
  setOuterState = setState;
  latestState = state;
  return <OverlayEditor state={state} onChange={setState} upstreamUrls={upstreamUrls} />;
}

/** 1x1 假图元（effect 只读 naturalWidth/Height 算尺寸） */
const FAKE_IMG = { naturalWidth: 100, naturalHeight: 100, width: 100, height: 100 };

beforeEach(() => {
  pending.length = 0;
  setOuterState = null;
  latestState = null;
});

describe('OverlayEditor 上游同步（TD-06-8）', () => {
  it('异步加载期间的外部更新（bgColor）不被旧 state 覆盖，且新图层被追加', async () => {
    const initial: OverlayState = {
      layers: [],
      canvasWidth: 400,
      canvasHeight: 400,
      bgColor: '#000000',
    };
    const { rerender } = render(<Harness upstreamUrls={[]} initial={initial} />);

    // ① 上游变化 → effect 触发 → 进入 await（promise 挂起）
    await act(async () => {
      rerender(<Harness upstreamUrls={['/files/a.png']} initial={initial} />);
    });
    expect(pending.length).toBe(1); // 已发起图片加载

    // ② 加载期间「用户操作」：改背景色（外部 state 前进一格）
    await act(async () => {
      setOuterState!((prev) => ({ ...prev, bgColor: '#ffffff' }));
    });
    expect(latestState!.bgColor).toBe('#ffffff');

    // ③ 图片加载完成 → effect 继续 → 调用 onChange 增删 layers
    await act(async () => {
      pending.forEach((resolve) => resolve(FAKE_IMG));
    });

    // ④ 关键断言：用户改的 bgColor 仍在（未被闭包旧 state 覆盖），新图层已追加
    expect(latestState!.bgColor).toBe('#ffffff');
    expect(latestState!.layers.map((l) => l.assetUrl)).toEqual(['/files/a.png']);
  });
});
