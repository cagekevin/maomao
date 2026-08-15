import { useCallback } from 'react'
import { useReactFlow } from '@xyflow/react'
import { useNodeResize } from './hooks.js'

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
export function useFitNodeRatio(id) {
  const { getNodes } = useReactFlow()
  const { onMainBoxResize } = useNodeResize(id)

  const fitByRatio = useCallback(
    (naturalW, naturalH) => {
      if (!naturalW || !naturalH) return
      const ratio = naturalW / naturalH
      if (!isFinite(ratio) || ratio <= 0) return
      const curNode = getNodes().find((n) => n.id === id)
      const curW = curNode?.width ?? curNode?.style?.width ?? 260
      const h = Math.round(curW / ratio)
      const clamped = Math.min(900, Math.max(80, h))
      if (Math.abs(clamped - (curNode?.height ?? curNode?.style?.height ?? 0)) < 4) return
      onMainBoxResize(Math.round(curW), clamped)
    },
    [id, getNodes, onMainBoxResize]
  )

  // 便捷绑定：图片 img.onLoad / 视频 video.onLoadedMetadata 直接透传
  const fitFromImage = useCallback((e) => fitByRatio(e.currentTarget.naturalWidth, e.currentTarget.naturalHeight), [fitByRatio])
  const fitFromVideo = useCallback((e) => fitByRatio(e.currentTarget.videoWidth, e.currentTarget.videoHeight), [fitByRatio])

  return { fitByRatio, fitFromImage, fitFromVideo }
}
