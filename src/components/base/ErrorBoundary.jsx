import React from 'react'
import { AlertTriangle, RotateCcw } from 'lucide-react'

/**
 * 崩溃页面（Error Boundary）。
 *
 * 捕获画布/组件渲染错误，显示画面中央的崩溃页 + 「重新载入」按钮：
 *  - 重新载入：清空错误状态重新渲染（软恢复）；若仍失败可强制整页刷新（硬恢复）。
 * 使用方式：在 main.jsx 包住 <App />。
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null, errorInfo: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo })
    // 上报错误（可接后端 /api/logs）
    console.error('[ErrorBoundary]', error, errorInfo)
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null, errorInfo: null })
  }

  handleHardReload = () => {
    window.location.reload()
  }

  render() {
    if (this.state.hasError) {
      const err = this.state.error
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
                画布遇到了异常，请重新载入。<br />
                你的画布进度已保存在本地，重新载入不会丢失。
              </p>
            </div>
            {/* 错误详情（可展开） */}
            {err && (
              <details className="w-full text-left bg-surface-raised border border-edge-faint rounded-lg overflow-hidden">
                <summary className="px-3 py-2 text-caption-sm text-muted cursor-pointer select-none hover:text-[#bbb]">
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
      )
    }
    return this.props.children
  }
}
