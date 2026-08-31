import React, { createContext, useContext } from 'react'

/**
 * 画布边/历史注入 Context —— 让节点组件拿到 useCanvasHistory 的 record（否则节点无法原子进 undo 栈）。
 *
 * 背景：节点组件内部只有 ReactFlow 的裸 setNodes/setEdges，无 history 访问途径。
 * 本 Context 由 App.jsx 提供（注入 history），节点通过 useCanvasEdges() 拿到 record，
 * 配合 base/deriveNodes.js 完成「建子节点+连线+record(显式快照)」原子操作。
 */

/**
 * 注入的画布历史句柄（含 record 等方法）。
 * record 真实签名见 useCanvasHistory：record(snapshot?: CanvasSnapshot | null) => void
 * （历史 .d.ts 误写成 (label: string, snapshot?) => void，导致节点用 record(snapshot) 编译不过，此处收口为真实形状）。
 */
type CanvasHistory = {
  record: (snapshot?: unknown) => void
  [key: string]: unknown
}

const CanvasEdgesContext = createContext<CanvasHistory | null>(null)

export function CanvasEdgesProvider({ history, children }: { history: CanvasHistory; children: React.ReactNode }) {
  return (
    <CanvasEdgesContext.Provider value={history}>
      {children}
    </CanvasEdgesContext.Provider>
  )
}

/** 节点组件用：返回 history 对象（含 record），无 Provider 时返回 null */
export function useCanvasEdges(): CanvasHistory | null {
  return useContext(CanvasEdgesContext)
}
