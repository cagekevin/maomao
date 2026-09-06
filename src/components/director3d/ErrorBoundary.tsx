import { Component } from 'react';
import { log } from './log.ts';

/**
 * 顶层错误边界：兜住 overlay 内任意同步渲染异常，避免「整屏白屏」。
 *
 * 仅能捕获渲染期（render）与生命周期钩子中的同步错误；
 * 事件回调 / Promise 异步错误不在此列，需配合 log.js 在 catch 处记录。
 * 落错误时把原因透传给 log.error 便于集中排查，同时提供崩溃占位 UI 供用户重载。
 *
 * Props：
 *  - label：边界名称（用于日志定位，默认 "Director3D"）
 *  - onReset：点“重新加载”时的回调（默认重载窗口）
 */
interface ErrorBoundaryProps {
  /** 边界名称（用于日志定位，默认 "Director3D"） */
  label?: string;
  /** 点“重新加载”时的回调（默认重载窗口） */
  onReset?: () => void;
  children: React.ReactNode;
}
interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, message: '' };

  static getDerivedStateFromError(error) {
    return { hasError: true, message: error?.message || String(error) };
  }

  componentDidCatch(error, info) {
    log.error('ErrorBoundary 捕获到渲染异常', error, info?.componentStack);
  }

  handleReset = () => {
    const { onReset } = this.props;
    if (typeof onReset === 'function') {
      onReset();
      return;
    }
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;
    const label = this.props.label || 'Director3D';
    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 2147483000,
          background: '#181817',
          color: '#e8e3d8',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          gap: 16,
          fontFamily: 'system-ui, sans-serif',
          padding: 24,
          textAlign: 'center',
        }}
      >
        <div style={{ fontSize: 28, fontWeight: 700 }}>{label} 出现异常</div>
        <div style={{ fontSize: 14, color: '#a89f92', maxWidth: 520, wordBreak: 'break-all' }}>
          {this.state.message || '未知错误'}
        </div>
        <button
          onClick={this.handleReset}
          style={{
            marginTop: 8,
            padding: '10px 24px',
            fontSize: 14,
            cursor: 'pointer',
            background: '#4a6fea',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
          }}
        >
          重新加载
        </button>
      </div>
    );
  }
}

export default ErrorBoundary;
