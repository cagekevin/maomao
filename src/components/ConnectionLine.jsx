import React from 'react'
import { getBezierPath, Position } from '@xyflow/react'
import CometParticles from './base/CometParticles.jsx'
import { useLod } from './base/useLod.js'

/**
 * 拖拽中的临时连线（复刻原 Pg.jsx）
 * 与选中 comet 同一套视觉：cust-edge-glow + cust-edge-base is-active + 粒子流光。
 * 固定 sourcePosition:Right / targetPosition:Left。
 *
 * LOD 降级（复刻 Pg.jsx 的 f = o < 2）：lodLevel >= 2（缩到很小）时关闭辉光与粒子流，
 * 只保留基础线，节省大画布性能。
 */
export default function ConnectionLine({ fromX, fromY, toX, toY }) {
  const { lodLevel = 0 } = useLod()
  const [path] = getBezierPath({
    sourceX: fromX,
    sourceY: fromY,
    sourcePosition: Position.Right,
    targetX: toX,
    targetY: toY,
    targetPosition: Position.Left
  })

  const mpathId = 'cust-conn-mpath'
  const enableFx = lodLevel < 2 // 复刻 Pg.jsx：lodLevel < 2 才渲染辉光 + 粒子

  return (
    <g fill="none">
      <path id={mpathId} d={path} fill="none" stroke="none" />
      {enableFx && <path d={path} fill="none" className="cust-edge-glow is-active" />}
      <path d={path} fill="none" className="cust-edge-base is-active" />

      {enableFx && (
        <CometParticles pathId={mpathId} uid="conn" headRadius={3.6} />
      )}
    </g>
  )
}
