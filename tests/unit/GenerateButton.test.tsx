/**
 * GenerateButton —— 生成按钮的行为契约（146 · ADR-0061「生成链路不提供中止入口」）。
 *
 * 锁两条（都可被证伪：把对应实现改回去即红）：
 *  ① `loading` 为真 ⇒ **不渲染任何按钮**（既无「停止」也无「刷新」—— 前端不拥有中止）；
 *  ② 非 loading ⇒ 渲染「生成」且点击触发 `onGenerate`。
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import GenerateButton from '../../src/components/canvas/parts/GenerateButton.tsx';

describe('GenerateButton（ADR-0061：生成链路不提供中止入口）', () => {
  it('loading 时不渲染任何按钮（无「停止」/「刷新」/「生成」）', () => {
    render(<GenerateButton loading onGenerate={vi.fn()} />);
    expect(screen.queryByText('停止')).toBeNull();
    expect(screen.queryByText('刷新')).toBeNull();
    expect(screen.queryByText('生成')).toBeNull();
  });

  it('非 loading 时渲染「生成」，点击触发 onGenerate', () => {
    const onGenerate = vi.fn();
    render(<GenerateButton loading={false} onGenerate={onGenerate} />);
    fireEvent.click(screen.getByText('生成'));
    expect(onGenerate).toHaveBeenCalledTimes(1);
  });
});
