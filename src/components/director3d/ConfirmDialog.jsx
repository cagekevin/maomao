// 自定义确认层 —— 收敛 replace 掉散落的 window.confirm（横切审计 D8）。
// 设计意图：
//   1. 统一确认弹窗样式（遮罩 + 按钮），与 Toast/主题 token 一致，取代风格不一的原生 confirm。
//   2. 命令式 API：ask(message[, opts]) => Promise<boolean>，调用方 await 结果决定是否继续，
//      不引入全局状态库；底层用 ref 持有 resolver + 本地 state 驱动渲染。
// 用法（组件内）：
//   const { ask, renderConfirm } = useConfirm()
//   const ok = await ask(`删除“xxx”？`, { confirmText: '删除', danger: true })
//   ... // 在 JSX 末尾渲染 {renderConfirm}
import { useCallback, useState } from 'react'

const DEFAULT_OPTS = { confirmText: '确定', cancelText: '取消', danger: false }

/**
 * 命令式确认框。返回：
 *  - ask(message, opts?) => Promise<boolean>：弹出确认；resolve(true) 确认 / resolve(false) 取消
 *  - renderConfirm：需渲染到组件 JSX 根节点的确认层节点
 */
export function useConfirm() {
  // state: null 表示无弹窗；否则 { message, confirmText, cancelText, danger }
  const [state, setState] = useState(null)
  // 持有当前弹窗的 resolver，避免 setState 异步回调作用域丢失
  const resolverRef = useState({ cur: null })[0]

  const ask = useCallback((message, opts) => {
    const { confirmText, cancelText, danger } = { ...DEFAULT_OPTS, ...(opts || {}) }
    return new Promise(resolve => {
      // 若已有弹窗未决，先以取消关闭旧弹窗，避免状态覆盖
      if (resolverRef.cur) resolverRef.cur(false)
      resolverRef.cur = resolve
      setState({ message, confirmText, cancelText, danger })
    })
  }, [resolverRef])

  const settle = useCallback(result => {
    const resolve = resolverRef.cur
    resolverRef.cur = null
    setState(null)
    if (resolve) resolve(result)
  }, [resolverRef])

  const renderConfirm = state ? (
    <div className="confirm-overlay" role="dialog" aria-modal="true">
      <div className="confirm-dialog">
        <div className="confirm-message">{state.message}</div>
        <div className="confirm-actions">
          <button type="button" className="confirm-btn" onClick={() => settle(false)}>{state.cancelText}</button>
          <button
            type="button"
            className={state.danger ? 'confirm-btn is-danger' : 'confirm-btn is-primary'}
            onClick={() => settle(true)}
          >
            {state.confirmText}
          </button>
        </div>
      </div>
    </div>
  ) : null

  return { ask, renderConfirm }
}