/**
 * 拖拽中的临时连线（复刻原 Pg.jsx）：与选中 comet 同一套视觉
 * （cust-edge-glow + cust-edge-base is-active + 粒子流光）。
 *
 * 【2026-09-30 · docs/plan/139】原「LOD 降级（`lodLevel>=2` → 关辉光/粒子）」断言已删 ——
 * 该降级已撤销：拖拽线是**交互反馈**，性能模式不降它（隐藏后用户看不见连到哪 = 能力受损）。
 * 现锁：基础线 + 辉光 + 粒子流**始终**渲染；bezier path d 透传给各层 path。
 * （性能模式的边降级只作用于正式边，由 index.css 的 `.perf-on .react-flow__edge` 承接，不在本组件。）
 */
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render } from '@testing-library/react';

const h = vi.hoisted(() => {
  const particles: any[] = [];
  return {
    particles,
    CometParticlesMock: (props: any) => {
      h.particles.push(props);
      return <g data-testid="comet-particles" />;
    },
  };
});

// 固定 bezier path：让「d 透传给各层」可判（真实 getBezierPath 的曲率随 @xyflow/react 版本变化，不该锁它）
vi.mock('@xyflow/react', () => ({
  getBezierPath: vi.fn(() => ['M0,0 C10,10 90,10 100,100']),
  Position: { Left: 'left', Right: 'right', Top: 'top', Bottom: 'bottom' },
}));

vi.mock('../../src/components/canvas/edges/CometParticles.tsx', () => ({
  default: (props: any) => h.CometParticlesMock(props),
}));

import ConnectionLine from '../../src/components/canvas/edges/ConnectionLine.tsx';

describe('ConnectionLine — 始终渲染（性能模式不降拖拽线）', () => {
  afterEach(() => {
    h.particles.length = 0;
  });

  function setup(props: Partial<React.ComponentProps<typeof ConnectionLine>> = {}) {
    return render(
      React.createElement(
        ConnectionLine as unknown as React.ComponentType<Record<string, unknown>>,
        {
          fromX: 0,
          fromY: 0,
          toX: 100,
          toY: 100,
          ...props,
        },
      ),
    );
  }

  it('渲染隐藏 mpath path（供粒子沿其运动）', () => {
    const view = setup();
    const mpath = view.container.querySelector('#cust-conn-mpath')!;
    expect(mpath).toBeTruthy();
    expect(mpath.getAttribute('d')).toBe('M0,0 C10,10 90,10 100,100');
  });

  it('渲染基础线 + 辉光层（is-active）', () => {
    const view = setup();
    expect(view.container.querySelector('.cust-edge-base')).toBeTruthy();
    expect(view.container.querySelector('.cust-edge-base.is-active')).toBeTruthy();
    expect(view.container.querySelector('.cust-edge-glow')).toBeTruthy();
    expect(view.container.querySelector('.cust-edge-glow.is-active')).toBeTruthy();
  });

  it('始终渲染粒子流光（不再受 lodLevel 影响）', () => {
    const view = setup();
    expect(h.particles).toHaveLength(1);
    expect(h.particles[0].pathId).toBe('cust-conn-mpath');
    expect(h.particles[0].headRadius).toBe(3.6);
    expect(view.container.querySelector('[data-testid="comet-particles"]')).toBeTruthy();
  });

  it('bezier path d 透传给各层 path', () => {
    const view = setup();
    const d = 'M0,0 C10,10 90,10 100,100';
    expect(view.container.querySelector('.cust-edge-base')!.getAttribute('d')).toBe(d);
    expect(view.container.querySelector('.cust-edge-glow')!.getAttribute('d')).toBe(d);
  });
});
