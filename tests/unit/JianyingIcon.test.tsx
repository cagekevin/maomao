/**
 * JianyingIcon 深度测试。
 *
 * 剪映 Logo 图标（发送到剪映素材库按钮用）。此前测试只有「挂载不崩」冒烟，
 * 无法检测图标尺寸/可访问性回归。本文件改为断言真实渲染：
 *  - 尺寸默认 14、可传 size 覆盖
 *  - viewBox 固定 0 0 1389 1024（复刻剪映 logo 比例）
 *  - aria-hidden（装饰性图标，避免被读屏朗读）
 *  - 唯一 path 存在（防止 SVG 内容被误删成空壳）
 */
import { must } from '../helpers/must';
import 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import JianyingIcon from '../../src/components/base/ui/JianyingIcon.tsx';

describe('JianyingIcon', () => {
  it('默认渲染 14px 剪映图标', () => {
    const { container } = render(<JianyingIcon />);
    const svg = must(container.querySelector('svg'), 'container');
    expect(svg).toBeTruthy();
    expect(svg.getAttribute('width')).toBe('14');
    expect(svg.getAttribute('height')).toBe('14');
    expect(svg.getAttribute('viewBox')).toBe('0 0 1389 1024');
    expect(svg.getAttribute('fill')).toBe('currentColor');
  });

  it('可传入自定义 size 覆盖宽高', () => {
    const { container } = render(<JianyingIcon size={20} />);
    const svg = must(container.querySelector('svg'), 'container');
    expect(svg.getAttribute('width')).toBe('20');
    expect(svg.getAttribute('height')).toBe('20');
  });

  it('装饰性图标带 aria-hidden，不被读屏朗读', () => {
    const { container } = render(<JianyingIcon />);
    expect(must(container.querySelector('svg'), 'container').getAttribute('aria-hidden')).toBe('true');
    // 无 title/文本节点：不向辅助技术暴露多余内容
    expect(screen.queryByRole('img')).toBeNull();
  });

  it('SVG 内容非空壳：含路径且可被查询', () => {
    const { container } = render(<JianyingIcon />);
    const path = must(container.querySelector('path'), 'container');
    expect(path).toBeTruthy();
    expect(must(path.getAttribute('d'), 'path').length).toBeGreaterThan(50);
  });
});
