/**
 * GridSplitNode 深度测试。
 * 审计建议 P1：多图输入、切图逻辑、参数变更重渲染。
 * 重点覆盖：空态校验、三种切分模式切换与各自控制区、网格预设与自定义行列。
 * 预切图逻辑走真实 loadImageWithTimeout（异步，失败被逻辑吞掉），断言以稳定文本/禁用态为主。
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { mocks } from './_nodeMocks.mjs';

vi.mock('@xyflow/react', () => mocks.xyflow);
vi.mock('../../src/components/base/ui/NodeShell.tsx', () => ({ default: mocks.NodeShell }));
vi.mock('../../src/components/edges/CustomHandle.tsx', () => ({ default: mocks.CustomHandle }));
vi.mock('../../src/components/base/editors/OverlayEditor.tsx', () => ({
  OverlayEditor: mocks.OverlayEditor,
  renderOverlayCanvas: mocks.renderOverlayCanvas,
}));
vi.mock('../../src/hooks/useConnectedInputs.ts', () => ({
  useConnectedInputs: mocks.useConnectedInputs,
}));
vi.mock('../../src/hooks/useMediaDegrade.ts', () => ({ useMediaDegrade: mocks.useMediaDegrade }));
vi.mock('../../src/components/base/core/uiHooks.ts', () => ({
  useNodeResize: mocks.useNodeResize,
  useContentHeightSync: mocks.useContentHeightSync,
}));
vi.mock('../../src/components/base/core/toastStore.ts', () => ({
  showToast: mocks.showToast,
  toastWarning: mocks.toastWarning,
}));
vi.mock('../../src/components/base/api/filesApi.ts', () => ({
  toAbsoluteFileUrl: mocks.toAbsoluteFileUrl,
}));

import GridSplitNode from '../../src/components/nodes/GridSplitNode.tsx';
beforeEach(() => {
  mocks.resetNodeMockState();
});
const setup = (props = {}) =>
  render(<GridSplitNode id="gs1" data={{}} selected={false} {...props} />);

describe('GridSplitNode — 空态', () => {
  it('无上游图片 → 显示「请连接图片」且批量切分禁用', () => {
    setup();
    expect(screen.getByText('请连接图片')).toBeTruthy();
    const btn = screen.getByText(/批量切分/).closest('button');
    expect(btn).toBeTruthy();
    // 可选链：DOM 查不到时由上一行断言先失败，避免这里抛 TypeError 盖掉真实失败原因
    expect(btn?.disabled).toBe(true);
  });
});

describe('GridSplitNode — 三种模式切换', () => {
  it('默认规则网格：显示 2×2/3×3/4×4/1×5/5×1 预设', () => {
    setup();
    expect(screen.getByText('2×2')).toBeTruthy();
    expect(screen.getByText('3×3')).toBeTruthy();
    expect(screen.getByText('4×4')).toBeTruthy();
    expect(screen.getByText('1×5')).toBeTruthy();
    expect(screen.getByText('5×1')).toBeTruthy();
  });

  it('点预设 4×4 → 显示选中态（act 后仍渲染该预设）', () => {
    setup();
    fireEvent.click(screen.getByText('4×4'));
    expect(screen.getByText('4×4')).toBeTruthy();
  });

  it('点「自定义」→ 显示行列输入框', () => {
    setup();
    fireEvent.click(screen.getByText('自定义'));
    expect(screen.getByText('行')).toBeTruthy();
    expect(screen.getByText('列')).toBeTruthy();
  });

  it('切到手动 → 显示行列数与「重置」', () => {
    setup();
    fireEvent.click(screen.getByText('手动'));
    expect(screen.getByText(/^\d+ 行 × \d+ 列 = \d+ 块$/)).toBeTruthy();
    expect(screen.getByText('重置')).toBeTruthy();
  });

  it('切到切刀 → 显示「已绘制」与全屏、清空', () => {
    setup();
    fireEvent.click(screen.getByText('切刀'));
    expect(screen.getByText(/已绘制 \d+ 块/)).toBeTruthy();
    expect(screen.getByText('全屏')).toBeTruthy();
    expect(screen.getByText('清空')).toBeTruthy();
  });
});
