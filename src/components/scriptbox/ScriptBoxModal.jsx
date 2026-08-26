import React from 'react'
import { Minimize2 } from 'lucide-react'

/**
 * 剧本盒子 —— 统一节点内弹层容器（收口所有弹窗的外观差异）。
 *
 * 背景（收口）：StepShots/StepPrompt/GearSettings 各自手写弹层，遮罩/卡片/圆角/宽度不统一，
 * 改一处样式要改多处。本组件收敛「剧本盒子节点内弹层」的唯一外观：
 *  - 遮罩：absolute inset-0 + bg-black/50（相对剧本盒子主容器，节点内部面板）
 *  - 卡片：bg-surface-menu + border-edge + rounded-xl + shadow-2xl
 *  - 无标题栏（对齐 FullscreenEditor）：右上角「缩小」按钮（Minimize2）点击即关闭
 *  - 页脚（自定义 footer / 缺省「取消/确定」两按钮）统一极简胶囊样式
 *
 * 使用：节点内任意弹层（字段编辑 / 对白编辑 / 提示词 AI 改写 / 重新生成意见 / 设置）都走它。
 * 全屏弹层仍用 base/FullscreenModal（portal 到 body 的全屏），与本组件互补。
 *
 * @param props
 *  - title    标题栏文字（留空则不渲染标题栏，仅右上角缩小按钮）
 *  - onClose  关闭回调（点遮罩 / 缩小 / 取消 / Esc）
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
        className="relative bg-surface-menu border border-edge rounded-xl shadow-2xl flex flex-col overflow-hidden nodrag"
        style={{ width, height }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 右上角「缩小」按钮（参考 FullscreenEditor 的极简风格，用剧本盒自有 token）：点击即关闭。title 为空时也不显示标题文字，仅此按钮。 */}
        <button
          className="absolute top-4 right-4 z-10 p-1.5 text-secondary hover:text-white hover:bg-surface-hover rounded-md transition-colors"
          onClick={onClose}
          title="缩小"
        >
          <Minimize2 size={16} />
        </button>

        {title && (
          <div className="flex items-center px-5 py-3 border-b border-edge-faint shrink-0 pr-14">
            <span className="text-body-xs text-primary font-medium">{title}</span>
          </div>
        )}
        <div className={`p-5 min-h-0 overflow-visible custom-scrollbar ${bodyClass}`}>{children}</div>
        {footer !== undefined ? (
          footer
        ) : (
          <div className="flex justify-end gap-2 px-4 pb-4 shrink-0">
            <button className="px-3 py-1 text-caption-sm text-secondary hover:text-white transition-colors" onClick={onClose}>{cancelText}</button>
            <button className="px-3 py-1 text-caption-sm bg-surface-hover hover:bg-surface-hover-strong text-primary rounded-md transition-colors" onClick={onOk}>{okText}</button>
          </div>
        )}
      </div>
    </div>
  )
}
