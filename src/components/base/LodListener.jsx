import React, { useEffect, useRef } from 'react'
import { useStore } from '@xyflow/react'

/**
 * LOD 视口缩放监听器（复刻 _Component122.jsx）。
 *
 * 监听 ReactFlow 视口缩放，计算 lodLevel 并：
 *  - 给 `.react-flow` 容器加 lod-1/2/3 / zoomed-out-lod class（供 CSS 做降级）
 *  - 通过 onLodChange 回调通知上层（用于驱动 LodProvider 的 value）
 *
 * lodLevel 计算（与源码一致）：
 *  - 缩放 <= 0.5 → 1
 *  - 缩放 <= 0.3 → 2
 *  - 缩放 <= 0.2 → 3
 *
 * @param onLodChange (level) => void
 * @param enablePerformanceMode 默认 true；false 时清空 class 并回调 0
 */
export default function LodListener({ onLodChange, enablePerformanceMode = true }) {
  // 监听 viewport.transform[2]（缩放值）的变化
  const zoom = useStore((s) => s.transform?.[2] ?? 1)
  const rafRef = useRef(0)
  const lastRef = useRef(0)

  useEffect(() => {
    const container = document.querySelector('.react-flow')

    if (!enablePerformanceMode) {
      if (lastRef.current !== 0) {
        lastRef.current = 0
        onLodChange?.(0)
        container?.classList.remove('lod-1', 'lod-2', 'lod-3', 'zoomed-out-lod')
      }
      return
    }

    // 计算 lodLevel（复刻 H_.jsx:11548）：zoom<=0.2→3，<=0.3→2，<=0.5→1，否则 0
    const level = zoom <= 0.2 ? 3 : zoom <= 0.3 ? 2 : zoom <= 0.5 ? 1 : 0
    if (level === lastRef.current) return

    cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(() => {
      container?.classList.remove('lod-1', 'lod-2', 'lod-3', 'zoomed-out-lod')
      if (level >= 1) container?.classList.add('lod-1')
      if (level >= 2) container?.classList.add('lod-2')
      if (level >= 3) {
        container?.classList.add('lod-3')
        container?.classList.add('zoomed-out-lod')
      }
      lastRef.current = level
      onLodChange?.(level)
    })
  }, [zoom, onLodChange, enablePerformanceMode])

  return null
}
