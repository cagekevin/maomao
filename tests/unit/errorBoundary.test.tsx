import { describe, it, expect, vi, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import ErrorBoundary from '../../src/components/base/ui/ErrorBoundary.tsx';

/** 抛错的子组件：渲染时 throw，模拟「节点内容渲染崩溃」 */
function Boom() {
  throw new Error('节点内容模拟崩溃');
}
const BoomAny = Boom as unknown as React.ComponentType;

/** 正常子组件 */
function Fine() {
  return <div data-testid="fine">正常内容</div>;
}

describe('ErrorBoundary §架构地基', () => {
  // 捕获 React 对「渲染抛错」的 console.error 噪音（ErrorBoundary 捕获是正常流程，不视为失败）
  const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
  afterEach(() => spy.mockClear());

  it('node 粒度：children 崩溃 → 渲染节点内错误框，而非全屏崩溃页', () => {
    const onError = vi.fn();
    render(
      <ErrorBoundary variant="node" onError={onError}>
        <BoomAny />
      </ErrorBoundary>,
    );
    // 节点内错误框（NodeShell 用）
    expect(screen.getByText('该节点渲染出错')).toBeTruthy();
    expect(screen.getByText('重新载入')).toBeTruthy();
    // 不应出现根级全屏崩溃页文案
    expect(screen.queryByText('画面出错了')).toBeNull();
    // onError 回调被调用（供 logger 上报）
    expect(onError).toHaveBeenCalled();
  });

  it('node 粒度：正常 children 直接渲染，无错误框', () => {
    render(
      <ErrorBoundary variant="node">
        <Fine />
      </ErrorBoundary>,
    );
    expect(screen.getByTestId('fine')).toBeTruthy();
    expect(screen.queryByText('该节点渲染出错')).toBeNull();
  });

  it('full 粒度（默认）：children 崩溃 → 渲染全屏崩溃页（根级 main.jsx 用）', () => {
    render(
      <ErrorBoundary>
        <BoomAny />
      </ErrorBoundary>,
    );
    expect(screen.getByText('画面出错了')).toBeTruthy();
    expect(screen.getByText('重新载入')).toBeTruthy();
  });

  it('node 粒度：点「重新载入」清空错误 → 恢复渲染 children', () => {
    // 用可变 flag：第一次渲染崩，reload 后不崩（验证软恢复）
    let boom = true;
    function ToggleBoom() {
      if (boom) throw new Error('x');
      return <div data-testid="recovered">恢复成功</div>;
    }
    render(
      <ErrorBoundary variant="node">
        <ToggleBoom />
      </ErrorBoundary>,
    );
    expect(screen.getByText('该节点渲染出错')).toBeTruthy();
    boom = false; // 恢复条件
    fireEvent.click(screen.getByText('重新载入'));
    expect(screen.getByTestId('recovered')).toBeTruthy();
    expect(screen.queryByText('该节点渲染出错')).toBeNull();
  });
});
