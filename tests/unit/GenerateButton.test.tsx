/**
 * GenerateButton —— 生成按钮的行为契约（146 · ADR-0061「生成链路不提供中止入口」）。
 *
 * 锁三条（都可被证伪：把对应实现改回去即红）：
 *  ① `loading` 为真 ⇒ 渲染**禁用态**（按钮在场 + `aria-disabled="true"`），仍无「停止」/「刷新」—— 前端不拥有中止；
 *  ② `loading` 为真 ⇒ 点击**不触发** `onGenerate`（防连点）；
 *  ③ 非 loading ⇒ 渲染「生成」且点击触发 `onGenerate`。
 *
 * 【2026-09-30】①由「不渲染任何按钮」改为「渲染禁用态」：原实现让按钮整块消失，
 * 用户看不到状态、且引起面板布局跳动。护栏意图（不提供中止入口）不变，只是把「忙」画出来。
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import GenerateButton from '../../src/components/canvas/parts/GenerateButton.tsx';

describe('GenerateButton（ADR-0061：生成链路不提供中止入口）', () => {
  it('loading 时渲染禁用态：按钮在场、无「停止」/「刷新」、点击不触发', () => {
    const onGenerate = vi.fn();
    const { container } = render(<GenerateButton loading onGenerate={onGenerate} />);
    // 仍无中止入口
    expect(screen.queryByText('停止')).toBeNull();
    expect(screen.queryByText('刷新')).toBeNull();
    // 按钮不再消失（原实现 return null 会让这行拿不到元素）
    expect(screen.getByText('生成')).toBeTruthy();
    // 禁用语义可见
    expect(container.querySelector('[aria-disabled="true"]')).toBeTruthy();
    // 点击被拦下
    fireEvent.click(screen.getByText('生成'));
    expect(onGenerate).not.toHaveBeenCalled();
  });

  it('非 loading 时渲染「生成」，点击触发 onGenerate', () => {
    const onGenerate = vi.fn();
    const { container } = render(<GenerateButton loading={false} onGenerate={onGenerate} />);
    expect(container.querySelector('[aria-disabled="true"]')).toBeNull();
    fireEvent.click(screen.getByText('生成'));
    expect(onGenerate).toHaveBeenCalledTimes(1);
  });
});
