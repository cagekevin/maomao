import React from 'react'
import { AlertTriangle, RotateCcw } from 'lucide-react'
import { logger } from './logger.js'

/**
 * 崩溃边界（Error Boundary）。
 *
 * 捕获画布/组件渲染错误。两种粒度：
 *  - variant="full"（默认）：根级全屏崩溃页（main.jsx 包 <App/> 用）。
 *  - variant="node"：节点内局部错误框（NodeShell 包每个节点内容用），
 *    单个节点崩溃只在该节点内降级，不影响整个画布/其它节点。
 *  - onError：可选回调（上报后端等），node 粒度默认传 logger。
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
    this.props.onError?.(error, errorInfo)
    // 统一日志上报（TASK-056 2.1）：走 logger 而非裸 console，接 localTool /api/logs 落盘，
    // 崩溃日志与全链路日志同源，便于后端/AI grep 排查（原裸 console.error 绕过统一日志）。
    logger.error('ErrorBoundary', 'componentDidCatch', { message: error?.message || String(error), error: String(error), stack: errorInfo?.componentStack || '' })
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null, errorInfo: null })
  }

  handleHardReload = () => {
    window.location.reload()
  }

  render() {
    if (!this.state.hasError) return this.props.children
    const err = this.state.error
    // 节点内局部错误框（NodeShell 用）：不破坏节点尺寸/端口定位，只占内容区
    if (this.props.variant === 'node') {
      return (
        <div className="flex flex-col items-center justify-center gap-2 w-full h-full min-h-[120px] p-3 text-center">
          <AlertTriangle size={20} className="text-amber-400" />
          <div className="text-caption-sm text-gray-300">该节点渲染出错</div>
          <button
            type="button"
            className="px-3 py-1 text-caption-sm bg-surface-hover hover:bg-surface-hover-strong text-gray-200 rounded-md cursor-pointer border-none"
            onClick={this.handleReload}
          >
            重新载入
          </button>
        </div>
      )
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
