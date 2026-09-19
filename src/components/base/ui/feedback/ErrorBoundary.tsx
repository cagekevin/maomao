import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { logger } from '@/components/base/core/log/logger';

/**
 * 崩溃边界（Error Boundary）。
 *
 * 捕获画布/组件渲染错误。两种粒度：
 *  - variant="full"（默认）：根级全屏崩溃页（main.jsx 包 <App/> 用）。
 *  - variant="node"：节点内局部错误框（NodeShell 包每个节点内容用），
 *    单个节点崩溃只在该节点内降级，不影响整个画布/其它节点。
 *  - onError：可选回调（上报后端等），node 粒度默认传 logger。
 *
 * 【「重新载入」到底做了什么（TD-16-37 · 2026-09-17 实测澄清）】
 *  - 清错误位 ⇒ React **卸载出错子树、重新挂载**：实测（子组件内部 state 崩前为 1，重载后回到 0）
 *    子组件内部状态**确实被重置** —— 原债文写的"不重置子树任何状态"经探针证伪。
 *  - 但若崩溃根因**不在子树内部 state**（store/父级数据/props/环境），重新挂载后必然立刻再抛 ⇒
 *    用户看到的是"同一张错误图"、**没有任何"我点过了、它又失败了"的信息** = 观感"点了没反应"。
 *  - 故本组件补的**不是**"重置更多状态"，而是把重试**变成可见事实**：`retryCount` 计数 +
 *    文案「已重试 N 次仍出错」+ 日志带 `retryCount`（崩溃循环可离线 grep）。
 *  - 【越权边界 · 2026-09-17 用户裁定「只有生产者才有权呈现错误」】本组件**只呈现自己生产的事实**
 *    （"重试了几次、现在又崩了"）；**不得**替真正失败的那层解释原因 —— 曾写过
 *    「仍失败说明问题来自画布数据或运行环境」，那是个**无人生产过的因果结论**，与"渲染里必然抛的 bug
 *    也会重试必败"矛盾，已撤除。真正的失败原因只能来自抛错方（`error.message` 原样展示）。
 */
/** ErrorBoundary 粒度：'full' 根级全屏崩溃页 / 'node' 节点内局部错误框。 */
type ErrorBoundaryVariant = 'full' | 'node';

interface ErrorBoundaryProps {
  /** 降级粒度：'full' 全屏崩溃页（默认） | 'node' 节点内局部错误框 */
  variant?: ErrorBoundaryVariant;
  /** 捕获回调（上报后端等）；node 粒度默认传 logger */
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  children?: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
  /**
   * 用户点过「重新载入」的次数（本边界实例内累计）。
   * 【TD-16-37】唯一用途：让"重试了、又崩了"成为**用户可见 / 日志可查**的事实 ——
   * 否则重试失败与"按钮坏了"在观感上完全一样（这是诚实性债，不是功能缺失）。
   */
  retryCount: number;
}

export default class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null, retryCount: 0 };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({ errorInfo });
    this.props.onError?.(error, errorInfo);
    // 统一日志上报（TASK-056 2.1）：走 logger 而非裸 console，接 localTool /api/logs 落盘，
    // 崩溃日志与全链路日志同源，便于后端/AI grep 排查（原裸 console.error 绕过统一日志）。
    const retryCount = this.state.retryCount;
    logger.error('ErrorBoundary', retryCount > 0 ? '重试后再次崩溃' : 'componentDidCatch', {
      message: error?.message || String(error),
      error: String(error),
      stack: errorInfo?.componentStack || '',
      // 【TD-16-37】带重试次数 ⇒ 崩溃循环（点了 N 次仍在崩）在日志侧可直接识别，不必靠用户描述。
      retryCount,
    });
  }

  /**
   * 「重新载入」＝清错误位，让 React **卸载并重新挂载出错子树**（子树内部 state 随之归零，已实测）。
   * 不清其它任何东西：根因在子树之外时重试会再崩 —— 那是**如实发生**的事实，由 `retryCount`
   * 计数后在界面上明说（不再让用户猜"按钮是不是没反应"）。
   */
  handleReload = () => {
    this.setState((s) => ({
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: s.retryCount + 1,
    }));
  };

  handleHardReload = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;
    const err = this.state.error;
    // 节点内局部错误框（NodeShell 用）：不破坏节点尺寸/端口定位，只占内容区
    if (this.props.variant === 'node') {
      return (
        <div className="flex flex-col items-center justify-center gap-2 w-full h-full min-h-[120px] p-3 text-center">
          <AlertTriangle size={20} className="text-amber-400" />
          <div className="text-caption-sm text-body">该节点渲染出错</div>
          {/* 【TD-16-37】重试过、又崩了 ⇒ 必须看得见（否则与"按钮没反应"无法区分） */}
          {this.state.retryCount > 0 && (
            <div className="text-caption-sm text-muted">
              已重试 {this.state.retryCount} 次仍出错
            </div>
          )}
          <button
            type="button"
            className="px-3 py-1 text-caption-sm bg-surface-hover hover:bg-surface-hover-strong text-primary rounded-md cursor-pointer border-none"
            onClick={this.handleReload}
          >
            重新载入
          </button>
        </div>
      );
    }
    // 根级全屏崩溃页（main.jsx 用）
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 z-overlay-error bg-input flex items-center justify-center">
          <div className="flex flex-col items-center gap-5 max-w-[420px] px-6 text-center">
            {/* 图标 */}
            <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center">
              <AlertTriangle size={30} className="text-red-400" />
            </div>
            {/* 标题 */}
            <div className="flex flex-col items-center gap-1.5">
              <h2 className="text-lg font-semibold text-white m-0">画面出错了</h2>
              <p className="text-body-xs text-muted m-0 leading-[1.6]">
                画布遇到了异常，请重新载入。
                <br />
                你的画布进度已保存在本地，重新载入不会丢失。
              </p>
              {/* 【TD-16-37】重试过、又崩了 ⇒ 明说这件事，别把用户丢回一张一模一样的图（那会像"按钮没反应"）。
                  【越权边界】只陈述**本组件自己生产的事实**（重试次数 + 仍在崩）。原因不归本组件解释：
                  真正的原因在下方「错误详情」里由抛错方给出（`error.message`），下一步动作由既有按钮承担。 */}
              {this.state.retryCount > 0 && (
                <p className="text-body-xs text-amber-400 m-0 leading-[1.6]">
                  已重试 {this.state.retryCount} 次仍出错。
                </p>
              )}
            </div>
            {/* 错误详情（可展开） */}
            {err && (
              <details className="w-full text-left bg-surface-raised border border-edge-faint rounded-lg overflow-hidden">
                <summary className="px-3 py-2 text-caption-sm text-muted cursor-pointer select-none hover:text-secondary">
                  错误详情
                </summary>
                <pre className="m-0 px-3 pb-3 text-caption text-red-400/90 overflow-auto max-h-[120px] whitespace-pre-wrap break-all">
                  {err.message || String(err)}
                </pre>
              </details>
            )}
            {/* 按钮 */}
            <div className="flex items-center gap-3">
              <button
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-body-sm font-medium transition-colors cursor-pointer border-none"
                onClick={this.handleReload}
              >
                <RotateCcw size={15} /> 重新载入
              </button>
              <button
                className="px-5 py-2.5 rounded-xl bg-surface-hover hover:bg-surface-hover-strong text-body text-body-sm transition-colors cursor-pointer border-none"
                onClick={this.handleHardReload}
              >
                强制刷新
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
