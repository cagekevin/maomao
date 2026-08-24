import React from 'react'

/**
 * 剧本盒子 —— 统一节点内弹层容器（收口所有弹窗的外观差异）。
 *
 * 背景（收口）：StepShots/StepPrompt/GearSettings 各自手写弹层，遮罩/卡片/圆角/宽度不统一，
 * 改一处样式要改多处。本组件收敛「剧本盒子节点内弹层」的唯一外观：
 *  - 遮罩：absolute inset-0 + bg-black/50（相对剧本盒子主容器，节点内部面板）
 *  - 卡片：bg-surface-menu + border-edge + rounded-xl + shadow-2xl
 *  - 标题栏 + 页脚（取消/确定）统一
 *
 * 使用：节点内任意弹层（字段编辑 / 对白编辑 / 重新生成意见 / 设置）都走它。
 * 全屏弹层仍用 base/FullscreenModal（portal 到 body 的全屏），与本组件互补。
 *
 * @param props
 *  - title    标题栏文字
 *  - onClose  关闭回调（点遮罩 / 取消 / Esc）
 *  - width    卡片宽度（默认 440）
 *  - height   卡片高度（可选；不传则随内容）
 *  - children 卡片正文
 *  - footer   自定义页脚；缺省为「取消/确定」两按钮（onOk / onCancelText）
 *  - onOk     确定回调（footer 缺省时）
 *  - okText   确定按钮文字（默认「确定」）
 *  - cancelText 取消按钮文字（默认「取消」）
 *  - bodyClass 内容区追加 class（如内部需要滚动 flex-1）
 */
export default function ScriptBoxModal({ title, onClose, width = 440, height, children, footer, onOk, okText = '确定', cancelText = '取消', bodyClass = '' }) {
  return (
    <div className="absolute inset-0 z-modal flex items-center justify-center bg-black/50 nodrag nowheel" onClick={onClose}>
      <div
        className="bg-surface-menu border border-edge rounded-xl shadow-2xl flex flex-col overflow-hidden nodrag"
        style={{ width, height }}
        onClick={(e) => e.stopPropagation()}
      >
        {title && (
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-edge-faint shrink-0">
            <span className="text-body-xs text-primary font-medium">{title}</span>
            <button className="text-muted hover:text-white text-sm leading-none" title="关闭" onClick={onClose}>×</button>
          </div>
        )}
        <div className={`p-4 min-h-0 overflow-visible custom-scrollbar ${bodyClass}`}>{children}</div>
        {footer !== undefined ? (
          footer
        ) : (
          <div className="flex justify-end gap-2 px-4 pb-4 shrink-0">
            <button className="px-3 py-1 text-caption-sm text-secondary hover:text-white" onClick={onClose}>{cancelText}</button>
            <button className="px-3 py-1 text-caption-sm bg-surface-hover hover:bg-surface-hover-strong text-primary rounded-md" onClick={onOk}>{okText}</button>
          </div>
        )}
      </div>
    </div>
  )
}
