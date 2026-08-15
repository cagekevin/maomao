import React from 'react'
import { LodContext } from './useLod.js'

/**
 * LOD Provider（复刻 _Component131.jsx）。
 *
 * 提供 LOD context 给画布内所有节点/边消费。value 缺省字段会用默认值兜底，
 * 因此不传 viewportMoving 等也能正常工作。
 *
 * @param props
 *  - value { lodLevel, viewportMoving, nodeCount, handleFollowLimit, edgeFxLimit, useThumbnail }
 *  - children
 */
export default function LodProvider({ value = {}, children }) {
  const v = {
    lodLevel: value.lodLevel ?? 0,
    viewportMoving: value.viewportMoving ?? false,
    nodeCount: value.nodeCount ?? 0,
    handleFollowLimit: value.handleFollowLimit ?? 60,
    edgeFxLimit: value.edgeFxLimit ?? 50,
    useThumbnail: value.useThumbnail ?? false
  }
  const memoValue = React.useMemo(() => v, [v.lodLevel, v.viewportMoving, v.nodeCount, v.handleFollowLimit, v.edgeFxLimit, v.useThumbnail])
  return <LodContext.Provider value={memoValue}>{children}</LodContext.Provider>
}
