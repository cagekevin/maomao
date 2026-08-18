import React from 'react'
import { Handle } from '@xyflow/react'

/**
 * 幽灵目标节点（复刻官方 ghostTarget）：不可见占位节点。
 * 从端口拖出到空白时，官方在鼠标位置放一个不可见节点 + 一条幽灵边，
 * 弹出「选择下游类型」菜单。选类型后把真实节点放到这里并替换幽灵边。
 *
 * 本组件渲染一个透明的 target Handle（type=target、无 id → 默认 target handle）。
 * 为什么必须有 Handle：React Flow 在创建 edge 时若目标节点没有任何 target handle，
 * 会因找不到 target handle id 而报 error 008「Couldn't create edge for target handle
 * id: null」（见 App.jsx onConnectEnd 建 ghost-edge 的 target=ghost-target）。
 * 加一个透明 Handle 让 React Flow 能解析幽灵边，且节点本体仍不可见（style 1x1 透明）。
 */
export default function GhostTargetNode() {
  return (
    <Handle
      type="target"
      position="left"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        minWidth: 0,
        minHeight: 0,
        background: 'transparent',
        border: 0,
        opacity: 0,
        pointerEvents: 'none'
      }}
    />
  )
}
