import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import ErrorBoundary from './components/base/ErrorBoundary.jsx'
import '@xyflow/react/dist/style.css'
import './index.css'
import { initStorage } from './components/base/storageAdapter.js'
import { logger } from './components/base/logger.js'

// Chrome 插件环境：启动时从 chrome.storage.local 加载配置缓存；普通环境无副作用
initStorage()

// ── 全局异常兜底（P0-5）────────────────────────────────────────────
// window error / unhandledrejection 统一定向 logger.error（→ localTool /api/logs 落盘），
// 让「异步回调/定时器/非渲染期 JS 异常」从"隐形"变"可排查"——这类异常 ErrorBoundary 罩不到。
// 设计要点：
//  ① 只记不可还原的运行时异常，符合 logger 头注释"高价值"原则；
//  ② 相同 (type+name+message) 5s 内合并，避免同一错误连续触发刷爆日志文件；
//  ③ 自身用朴素 try/catch 兜底，防兜底逻辑再抛导致无限递归。
const _globalErrThrottle = { key: '', ts: 0 }
// 【已知无害告警过滤】ReactFlow（@xyflow/react）内部 useResizeObserver 在「新建节点挂载瞬间」
// 对节点 wrapper 注册观察 + 回调内调 updateNodeInternals，会偶发触发浏览器原生
// `ResizeObserver loop completed with undelivered notifications`：
//  - 所有节点类型新建都会偶发（已用 e2e 复现验证，非业务代码问题）；
//  - 发生在挂载瞬间的一次性竞态，节点尺寸稳定后不再触发，功能不受影响；
//  - 无 stack（非应用 JS 抛错），是浏览器派发的 error 事件。
// 第三方库内部行为项目代码无法根治，故在此过滤，避免污染错误日志。
const _HARMLESS_GLOBAL_ERROR_MSGS = [
  'ResizeObserver loop',
  'ResizeObserver loop completed',
]
function reportGlobalError(type, e) {
  try {
    const message = (e instanceof Error)
      ? e.message
      : typeof e === 'string' ? e
      : (e && typeof e === 'object' && 'message' in e ? String(e.message) : '')
    // 已知无害的浏览器/库内部告警：直接忽略，不计入错误日志
    if (_HARMLESS_GLOBAL_ERROR_MSGS.some((m) => message.includes(m))) return
    const isError = e instanceof Error
    const name = isError ? e.name : 'Error'
    const stack = isError && e.stack ? e.stack : ''
    const key = `${type}:${name}:${message}`
    const now = Date.now()
    if (key === _globalErrThrottle.key && now - _globalErrThrottle.ts < 5000) return
    _globalErrThrottle.key = key
    _globalErrThrottle.ts = now
    logger.error('运行时', type, { name, message, error: String(e), stack })
  } catch {
    /* 防递归：全局兜底自身异常不再上报 */
  }
}
window.addEventListener('error', (e) => reportGlobalError('windowError', e.error || e))
window.addEventListener('unhandledrejection', (e) => reportGlobalError('unhandledRejection', e.reason))

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
)
