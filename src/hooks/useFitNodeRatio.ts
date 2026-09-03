import { useCallback } from 'react'
import type { SyntheticEvent } from 'react'
import { useReactFlow } from '@xyflow/react'
import { useNodeResize } from '../components/base/core/hooks.ts'

/** 媒体真实宽高 → 按比例调整节点形状（宽保持，高 = 宽 / 比例） */
export type FitByRatio = (naturalW: number, naturalH: number) => void

export interface FitNodeRatioApi {
  fitByRatio: FitByRatio
  /** 供 <img onLoad={fitFromImage}> 直接透传 */
  fitFromImage: (e: SyntheticEvent<HTMLImageElement>) => void
  /** 供 <video onLoadedMetadata={fitFromVideo}> 直接透传 */
  fitFromVideo: (e: SyntheticEvent<HTMLVideoElement>) => void
}

/**
 * 让节点按「媒体真实宽高比」自适应形状的 hook。
 *
 * 【为什么抽成 hook】
 * ImageNode 的图片（fitToImageRatio，用 img.naturalWidth/Height）和视频
 * （fitToVideoRatio，用 video.videoWidth/Height）逻辑几乎一样，只差数据源。
 * 统一成 `fitByRatio(w, h)`，图片/视频/任何媒体都能用，新增节点不再写两遍。
 *
 * 行为：宽度保持当前节点宽度，高度 = 宽度 / 比例，限制在 [80, 900]，避免极端比例压扁/拉爆。
 *
 * @param {string} id 节点 id
 * @returns {Function} fitByRatio(naturalW, naturalH) 传入媒体真实宽高即调整节点形状
 */
export function useFitNodeRatio(id: string): FitNodeRatioApi {
  const { getNode } = useReactFlow()
  const { onMainBoxResize } = useNodeResize(id)

  const fitByRatio = useCallback<FitByRatio>(
    (naturalW, naturalH) => {
      if (!naturalW || !naturalH) return
      const ratio = naturalW / naturalH
      if (!isFinite(ratio) || ratio <= 0) return
      const curNode = getNode(id)
      // style.width/height 在 ReactFlow 里可能是字符串（'260px'），统一 Number 化保证后续算术合法
      const curW = Number(curNode?.width ?? curNode?.style?.width ?? 260)
      const h = Math.round(curW / ratio)
      const clamped = Math.min(900, Math.max(80, h))
      const curH = Number(curNode?.height ?? curNode?.style?.height ?? 0)
      if (Math.abs(clamped - curH) < 4) return
      onMainBoxResize(Math.round(curW), clamped)
    },
    [id, getNode, onMainBoxResize]
  )

  // 便捷绑定：图片 img.onLoad / 视频 video.onLoadedMetadata 直接透传
  const fitFromImage = useCallback(
    (e: SyntheticEvent<HTMLImageElement>) => fitByRatio(e.currentTarget.naturalWidth, e.currentTarget.naturalHeight),
    [fitByRatio]
  )
  const fitFromVideo = useCallback(
    (e: SyntheticEvent<HTMLVideoElement>) => fitByRatio(e.currentTarget.videoWidth, e.currentTarget.videoHeight),
    [fitByRatio]
  )

  return { fitByRatio, fitFromImage, fitFromVideo }
}
