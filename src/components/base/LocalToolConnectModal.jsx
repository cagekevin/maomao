import React from 'react'
import { AlertTriangle, RefreshCw, Loader2 } from 'lucide-react'

/**
 * 本地引擎未连接全屏提醒 —— 完整复刻官方 Tr.jsx（App-BX6o9fW5_components/Tr.jsx）。
 *
 * props（对齐官方 Tr）：
 *  - isVisible: boolean    是否显示（官方 `e`）
 *  - onClose: () => void   点「稍后再说」（官方 `t`；父层还需同时标记「用户已关闭」避免再次自动弹）
 *  - onRetry: () => void   点「重试连接」（官方 `n`；父层传 checkConnection）
 *
 * 内部细节（对齐官方）：
 *  - 全屏遮罩 fixed inset-0 bg-black/70 z-[9999]
 *  - 顶部红色警告图标 + 「本地引擎未连接」标题 + 「系统功能需要 localTool 工具支持」副标题
 *  - 步骤列表（安装 local-companion / 启动 18080 端口 / 点击重试）
 *  - 底部按钮：「稍后再说」（灰）+ 「重试连接」（蓝，点击后转圈 2s 还原，官方用 setTimeout 2000 复位）
 *  - 底部状态文案「当前状态：未检测到 localTool 连接」
 */
export default function LocalToolConnectModal({ isVisible, onClose, onRetry }) {
  const [retrying, setRetrying] = React.useState(false)
  if (!isVisible) return null

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-modal">
      <div className="bg-surface border border-red-500/50 rounded-xl p-6 max-w-md mx-4 shadow-2xl shadow-red-900/20">
        {/* 头部：图标 + 标题 */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 bg-red-500/20 rounded-full flex items-center justify-center">
            <AlertTriangle size={24} className="text-red-500" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">本地引擎未连接</h2>
            <p className="text-sm text-gray-400">系统功能需要 localTool 工具支持</p>
          </div>
        </div>

        {/* 步骤说明 */}
        <div className="bg-canvas rounded-lg p-4 mb-4">
          <p className="text-sm text-gray-300 mb-3">为了保证系统的完整功能和数据安全，请按照以下步骤操作：</p>
          <ol className="text-sm text-gray-400 space-y-2 list-decimal list-inside">
            <li>
              确保已安装 <span className="text-white font-medium">local-companion</span> 本地伴侣工具
            </li>
            <li>
              启动 local-companion 服务（默认端口 <span className="text-white font-medium">18080</span>）
            </li>
            <li>点击下方重试按钮重新检测连接</li>
          </ol>
        </div>

        {/* 按钮区 */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors text-sm font-medium"
          >
            稍后再说
          </button>
          <button
            onClick={() => {
              setRetrying(true)
              onRetry()
              setTimeout(() => setRetrying(false), 2000)
            }}
            disabled={retrying}
            className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 disabled:cursor-not-allowed text-white rounded-lg transition-colors text-sm font-medium flex items-center justify-center gap-2"
          >
            {retrying ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                检测中...
              </>
            ) : (
              <>
                <RefreshCw size={16} />
                重试连接
              </>
            )}
          </button>
        </div>

        <p className="text-xs text-gray-500 mt-4 text-center">当前状态：未检测到 localTool 连接</p>
      </div>
    </div>
  )
}
