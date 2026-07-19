/**
 * ErrorBoundary — 从 entry.js 提取
 * 捕获 React 渲染错误，显示友好错误页面
 */

import React from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error('[RootErrorBoundary] 捕获到未处理异常:', error, errorInfo);
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '100vh',
            backgroundColor: '#0d0c0c',
            color: '#e0e0e0',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            padding: '2rem',
          }}
        >
          <div
            style={{
              fontSize: '1.5rem',
              fontWeight: 600,
              marginBottom: '1rem',
              color: '#ff6b35',
            }}
          >
            页面加载遇到问题
          </div>
          <div
            style={{
              fontSize: '0.9rem',
              color: '#888',
              marginBottom: '2rem',
              textAlign: 'center',
              maxWidth: '400px',
            }}
          >
            可能是网络或代理导致的问题，请检查连接后重试。
          </div>
          <button
            onClick={this.handleReload}
            style={{
              padding: '0.6rem 1.5rem',
              backgroundColor: '#ff6b35',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '0.9rem',
            }}
          >
            重新加载
          </button>
          {this.state.error && (
            <pre
              style={{
                marginTop: '1.5rem',
                padding: '1rem',
                backgroundColor: '#1a1a1a',
                borderRadius: '6px',
                fontSize: '0.75rem',
                color: '#666',
                maxWidth: '600px',
                overflow: 'auto',
                whiteSpace: 'pre-wrap',
              }}
            >
              {this.state.error.message}
            </pre>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
