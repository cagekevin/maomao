/**
 * 统一确认弹窗（confirm）store —— 全局唯一确认入口，范式严格对齐 toastStore。
 *
 * 【为什么用模块级 store，而非 React Context / hook】
 * 与 toastStore 同一个理由：确认需求常发生在**非 React 模块的异步链路中途**
 * （如 cloudSync 上传到一半发现云端更新、需要问用户"是否覆盖"）。
 * 用 Context 要包 Provider、用 hook 要把 ask 一层层传进去，都会把「业务链路」和「UI 树」绑死。
 * 模块级 store + 订阅：
 *  - 任何模块 `import { askConfirm }` 即可 `await` 用户选择，无需 Provider、无需传参；
 *  - 渲染端（ConfirmContainer）在 App 根挂一次，subscribe store 把它画出来；
 *  - 与 toastStore 完全同形，心智负担为零。
 *
 * 【接入约定】
 *   const ok = await askConfirm({ title: '确定删除？', danger: true })
 *   if (!ok) return   // 用户取消
 * 支持富内容：items 是被操作影响的条目清单（如「将被覆盖的 3 项」），原生 window.confirm 做不到。
 *
 * 【与 director3d/ConfirmDialog 的关系】
 * 那是 3D 子模块内的 hook 版（私有 CSS class），无法被非 React 模块调用，本次未动它。
 * 全局（含云同步）一律走本 store，禁止再出现第三份确认实现。
 */

/** askConfirm 选项 */
export interface ConfirmOptions {
  /** 标题（一句话说清要做什么决定） */
  title: string
  /** 补充说明（可选，如时间、影响范围） */
  message?: string
  /** 受影响的条目清单（可选，如「将被覆盖的项目」）——原生 confirm 无法表达，是本 store 的核心价值 */
  items?: string[]
  /** 确认按钮文案，默认「确定」 */
  confirmText?: string
  /** 取消按钮文案，默认「取消」 */
  cancelText?: string
  /** 危险操作（删除/覆盖）→ 确认按钮转红色，默认 false */
  danger?: boolean
}

/** 一条待确认请求（渲染端消费的形态：选项已套默认值 + 自增 id） */
export interface ConfirmRequest extends ConfirmOptions {
  id: number
  title: string
  confirmText: string
  cancelText: string
  danger: boolean
}

const DEFAULT_CONFIRM_TEXT = '确定'
const DEFAULT_CANCEL_TEXT = '取消'

/** 当前待确认请求 + 其 resolver（成对持有，避免异步回调作用域丢失） */
let pending: { request: ConfirmRequest; resolve: (ok: boolean) => void } | null = null
let listeners = new Set<() => void>()
let seq = 0

/**
 * 弹出确认框，等用户选择。
 * @param opts 见 ConfirmOptions
 * @returns {Promise<boolean>} true = 确认；false = 取消
 * @remarks 重入保护：若已有未决确认（理论上不该发生），旧请求先按「取消」结算，
 *          避免 resolver 被覆盖后旧 await 永久挂起（异步操作不得无限等待）。
 */
export function askConfirm(opts: ConfirmOptions): Promise<boolean> {
  // 旧弹窗未决 → 先以取消结算，保证每个 askConfirm 的 Promise 都会 settle
  if (pending) settle(pending, false)
  return new Promise<boolean>((resolve) => {
    const request: ConfirmRequest = {
      ...opts,
      id: ++seq,
      confirmText: opts.confirmText || DEFAULT_CONFIRM_TEXT,
      cancelText: opts.cancelText || DEFAULT_CANCEL_TEXT,
      danger: !!opts.danger,
    }
    pending = { request, resolve }
    emit()
  })
}

/**
 * 结算当前确认框（渲染端按钮/遮罩/Esc 调用）。
 * @param ok true = 用户确认；false = 用户取消
 */
export function resolveConfirm(ok: boolean): void {
  if (pending) settle(pending, !!ok)
}

/** 订阅（返回取消函数）。ConfirmContainer 用它渲染。 */
export function subscribeConfirm(listener: () => void): () => boolean {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** 读当前待确认请求（无则 null） */
export function getConfirm(): ConfirmRequest | null {
  return pending?.request ?? null
}

/** 结算并清理：先摘 pending 再 resolve，防止 resolve 回调里又触发新弹窗时被覆盖 */
function settle(item: { resolve: (ok: boolean) => void }, ok: boolean): void {
  if (pending && pending.resolve === item.resolve) pending = null
  emit()
  item.resolve(ok)
}

function emit(): void {
  listeners.forEach((l) => l())
}
