import React from 'react'
import CometParticles from './base/CometParticles.jsx'

/**
 * 彗星流光（复刻原 _Component111.jsx）
 * 选中边时的流光效果：16 拖尾 + 发光头，沿 CustomEdge 里那条隐藏 path（id=cust-edge-mpath-{edgeId}）运动。
 *
 * 粒子视觉（拖尾/辉光/发光头）抽离到公共组件 CometParticles，本组件只负责：
 *  - 外层 <g> 的 is-active 态（控制粒子流显隐）
 *  - 指定 mpath 指向的隐藏 path id
 */
export default function Comet({ pathRef, edgeId, isActive }) {
  const mpathId = `cust-edge-mpath-${edgeId}`
  const pathTarget = pathRef || mpathId

  return (
    <g className={`cust-edge-comet ${isActive ? 'is-active' : ''}`}>
      <CometParticles pathId={pathTarget} uid={`comet-${edgeId}`} headRadius={3.4} />
    </g>
  )
}
