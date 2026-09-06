/**
 * Comet 深度测试。
 *
 * 彗星流光：选中边的粒子流光效果，外层 <g> 控制 is-active 态，粒子视觉
 * 委托给公共组件 CometParticles（拖尾/辉光/发光头）。此前测试只有「挂载不崩」
 * 冒烟。本文件捕获 CometParticles 收到的 props，断言：
 *  - isActive=true/false 切换外层 className 的 is-active 态（显隐契约）
 *  - mpath 指向的隐藏 path id：edgeId → cust-edge-mpath-{edgeId}
 *  - 传 pathRef 时优先用 pathRef（外部引用）
 *  - headRadius 固定 3.4（与选中 comet 视觉一致）
 *  - uid 唯一标识避免多实例 filter 冲突
 */
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render } from '@testing-library/react';

const h = vi.hoisted(() => {
  const calls = [];
  return {
    calls,
    CometParticlesMock: (props) => {
      h.calls.push(props);
      return <g data-testid="comet-particles" />;
    },
  };
});

vi.mock('../../src/components/base/ui/CometParticles.tsx', () => ({
  default: (props) => h.CometParticlesMock(props),
}));

import Comet from '../../src/components/edges/Comet.tsx';

describe('Comet', () => {
  afterEach(() => {
    h.calls.length = 0;
  });

  function setup(props) {
    const view = render(<Comet {...props} />);
    const g = view.container.querySelector('g');
    return { view, g };
  }

  it('isActive=true 时外层 g 带 is-active（粒子流显示）', () => {
    const { g } = setup({ edgeId: 'e1', isActive: true });
    expect(g.className).toContain('cust-edge-comet');
    expect(g.className).toContain('is-active');
  });

  it('isActive=false 时无 is-active（粒子流隐藏）', () => {
    const { g } = setup({ edgeId: 'e1', isActive: false });
    expect(g.className).toContain('cust-edge-comet');
    expect(g.className).not.toContain('is-active');
  });

  it('默认按 edgeId 生成 mpath 引用（cust-edge-mpath-{edgeId}）', () => {
    setup({ edgeId: 'e-42', isActive: true });
    expect(h.calls).toHaveLength(1);
    expect(h.calls[0].pathId).toBe('cust-edge-mpath-e-42');
    expect(h.calls[0].headRadius).toBe(3.4);
  });

  it('传入 pathRef 时优先使用外部 path 引用', () => {
    setup({ edgeId: 'e1', pathRef: 'cust-conn-mpath', isActive: true });
    expect(h.calls[0].pathId).toBe('cust-conn-mpath');
  });

  it('uid 用 comet-{edgeId}，避免多实例 filter 冲突', () => {
    setup({ edgeId: 'e-7', isActive: true });
    expect(h.calls[0].uid).toBe('comet-e-7');
  });

  it('渲染 CometParticles 粒子内容', () => {
    const { view } = setup({ edgeId: 'e1', isActive: true });
    expect(view.container.querySelector('[data-testid="comet-particles"]')).toBeTruthy();
  });
});
