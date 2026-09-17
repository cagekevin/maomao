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
    // 【TD-16-37】重试**成功**时不得出现"已重试 N 次"提示（只有真失败才升级文案，不许乱喊）
    expect(screen.queryByText(/已重试/)).toBeNull();
  });

  it('【TD-16-37】重试仍失败必须可见：错误框明说「已重试 N 次仍出错」（node 粒度）', () => {
    // 债的本质（2026-09-17 探针修正后）：不是"没重置状态"，而是**重试也失败时界面零信息** ——
    // 用户看到的是与首次崩溃一模一样的一张图 ⇒ 观感"点了没反应"。此用例锁"失败可见"。
    render(
      <ErrorBoundary variant="node">
        <BoomAny />
      </ErrorBoundary>,
    );
    expect(screen.queryByText(/已重试/)).toBeNull(); // 首次崩溃：不提"重试"
    fireEvent.click(screen.getByText('重新载入'));
    expect(screen.getByText('已重试 1 次仍出错')).toBeTruthy();
    fireEvent.click(screen.getByText('重新载入'));
    expect(screen.getByText('已重试 2 次仍出错')).toBeTruthy();
    expect(screen.getByText('该节点渲染出错')).toBeTruthy(); // 失败仍如实呈现，不假称已恢复
  });

  it('【TD-16-37】full 粒度重试仍失败：只陈述本组件生产的事实，不替生产者解释原因', () => {
    render(
      <ErrorBoundary>
        <BoomAny />
      </ErrorBoundary>,
    );
    fireEvent.click(screen.getByText('重新载入'));
    expect(screen.getByText(/已重试 1 次仍出错/)).toBeTruthy();
    // 【越权红线 · 2026-09-17 用户裁定「只有生产者才有权呈现错误」】边界是转发者/承载容器，
    // 不得替真正失败的那层下**因果结论**（原实现写过「仍失败说明问题来自画布数据或运行环境」——
    // 该结论无人生产，且与"渲染里必然抛的 bug 也会重试必败"矛盾，已撤除）。此处锁"不许再写回来"。
    expect(screen.queryByText(/问题来自|说明问题|根因|原因是/)).toBeNull();
  });

  it('【TD-16-37】「重新载入」= 重挂载出错子树（实测锁定：子树内部 state 归零）', () => {
    // 探针实测（2026-09-17）：崩前子树内部 state=1 → 重置后回到 0 ⇒ React 卸载并**重新挂载**该子树，
    // 故原债文"不重置子树任何状态"不成立。锁这条是因为它是按钮**承诺**的兑现方式：若将来有人把
    // fallback 改成"保留子树实例"（如缓存 element），坏状态会复活，重试就真成了"没反应"。
    let boom = false;
    function Counter() {
      const [n, setN] = React.useState(0);
      if (boom) throw new Error('boom after state');
      return (
        <button data-testid="cnt" onClick={() => setN((v) => v + 1)}>
          {n}
        </button>
      );
    }
    render(
      <ErrorBoundary variant="node">
        <Counter />
      </ErrorBoundary>,
    );
    fireEvent.click(screen.getByTestId('cnt'));
    expect(screen.getByTestId('cnt').textContent).toBe('1');
    boom = true;
    fireEvent.click(screen.getByTestId('cnt')); // 子树自身重渲染 → 抛错被边界捕获
    expect(screen.getByText('该节点渲染出错')).toBeTruthy();
    boom = false;
    fireEvent.click(screen.getByText('重新载入'));
    expect(screen.getByTestId('cnt').textContent).toBe('0'); // 归零 = 确实重新挂载
  });
});
