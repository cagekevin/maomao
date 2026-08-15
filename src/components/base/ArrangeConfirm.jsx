import React from 'react'

/**
 * 整理后「是否保留此次整理结果？」确认弹窗（复刻 H_.jsx:11993-12012）。
 *
 * 【抉择：为什么用「快照 + 确认」而非「撤销栈」】
 * 官方整理后弹窗提供「还原/保留」。实现上不用历史栈的 undo，而是**单独存一份
 * 排列前快照**（snapshot={nodes,edges}）：
 *  - 还原 = 把这份快照整体写回（干净利落，一次 setNodes/setEdges 搞定）；
 *  - 保留 = 仅关弹窗，保留已写回的整理结果。
 * 这样「整理」天然可反悔，且不污染全局撤销栈（撤销栈仍按正常操作记录）。
 *
 * 【抉择：本组件是「纯 UI」，不碰数据】
 * 本组件只负责**渲染弹窗 + 回调上抛**。快照在哪存、怎么写回、fitView 归谁，全部由
 * 调用方（App.revertArrange / keepArrange）决定。因此换个宿主可整组件复用。
 *
 * 【接真实系统】
 * 无需改动：真引擎的节点/边结构同为 {id,type,position,data,...}，快照直接可写回。
 * 若后续要「整理可多次撤销」，把 snapshot 改成数组栈即可（本组件签名不变）。
 *
 * @param {Object} props
 * @param {Object|null} props.snapshot  排列前快照 { nodes, edges }；null 时不渲染
 * @param {Function} props.onRevert     还原按钮回调（调用方写回快照 + fitView + 关闭）
 * @param {Function} props.onKeep       保留按钮回调（调用方关闭弹窗）
 */
export default function ArrangeConfirm({ snapshot, onRevert, onKeep }) {
  if (!snapshot) return null

  return (
    <div className="absolute bottom-full left-0 mb-4 bg-surface-1 border border-edge rounded-xl shadow-2xl p-4 w-[240px] text-gray-300 animate-slide-up origin-bottom-left z-popover pointer-events-auto">
      <div className="text-sm font-medium mb-4 text-center">是否保留此次整理结果？</div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onRevert}
          className="flex-1 py-1.5 rounded-lg text-sm transition-colors text-gray-400 hover:text-white hover:bg-surface-hover-strong border border-edge-muted"
        >
          还原
        </button>
        <button
          type="button"
          onClick={onKeep}
          className="flex-1 py-1.5 rounded-lg text-sm font-medium transition-colors bg-surface-hover-strong text-white hover:bg-surface-3 border border-edge-strong"
        >
          保留
        </button>
      </div>
    </div>
  )
}
