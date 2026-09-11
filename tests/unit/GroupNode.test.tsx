/**
 * GroupNode 单测（2026-09-07 方案 D4）。
 * 编组折叠态已整体下线 → 编组只有一种形态：无折叠按钮、无小胶囊。
 * 覆盖：展开态渲染 NodeShell + 标题 / data.name 缺省回落「编组」/ 无折叠按钮与胶囊。
 */
import 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@xyflow/react', () => ({
  // GroupNode 经 useNodeRename → useReactFlow 取 setNodes，单测隔离 Provider 树
  useReactFlow: () => ({ setNodes: () => {} }),
}));
vi.mock('../../src/components/base/ui/NodeShell.tsx', () => ({
  default: ({ children, titleRight, label }) => (
    <div data-testid="shell" data-label={label}>
      {titleRight}
      {children}
    </div>
  ),
}));
vi.mock('../../src/components/edges/CustomHandle.tsx', () => ({ default: () => null }));

import GroupNode from '../../src/components/nodes/GroupNode.tsx';

function setup(props = {}) {
  return render(<GroupNode id="g1" data={{ name: '我的编组' }} selected={false} {...props} />);
}

describe('GroupNode', () => {
  it('渲染 NodeShell + 标题', () => {
    setup();
    const shell = screen.getByTestId('shell');
    expect(shell).toBeTruthy();
    expect(shell.getAttribute('data-label')).toBe('我的编组');
  });

  it('data.name 缺省回落「编组」', () => {
    setup({ data: {} });
    expect(screen.getByTestId('shell').getAttribute('data-label')).toBe('编组');
  });

  it('编组只有一种形态：无折叠按钮、无小胶囊（折叠态已下线）', () => {
    const { container } = setup();
    // 无「折叠」标题按钮（titleRight 不再渲染）
    expect(screen.queryByTitle('折叠')).toBeNull();
    // 展开外壳在（胶囊形态不得出现）
    expect(screen.getByTestId('shell')).toBeTruthy();
    expect(container.querySelector('.cursor-pointer')).toBeNull();
  });
});
