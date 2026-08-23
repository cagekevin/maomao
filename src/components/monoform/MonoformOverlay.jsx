import { useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { MonoformApp } from './App.jsx'
import './styles.css'

/**
 * MonoformOverlay：把 monoform 白膜预演作为全屏 overlay 嵌入画布节点。
 *
 * 由 Director3DNode 双击节点后 createPortal 挂载到 document.body。
 * 每个节点用独立 storageKey（monoform-project-<nodeId>），工程互不干扰。
 *
 * Props：
 *  - nodeId：节点 id，用于生成独立工程存储 key
 *  - onExit：退出回调，回传 { thumbnailDataUrl?, captures? }
 */
export function MonoformOverlay({ nodeId, onExit }) {
  const capturesRef = useRef([])
  const thumbnailRef = useRef(null)
  const storageKey = nodeId ? `monoform-project-${nodeId}` : null

  // 受控导出：收集产物（Blob），退出时交给宿主落盘/回写画布
  const handleExport = useCallback(({ type, blob, fileName }) => {
    capturesRef.current = [...capturesRef.current, { type, blob, fileName }]
  }, [])

  // 缩略图回传：App 每次截图成功后给出节点预览图
  const handleThumbnail = useCallback((dataUrl) => {
    if (dataUrl) thumbnailRef.current = dataUrl
  }, [])

  // 退出：把收集的产物整理为 thumbnailDataUrl + captures 回传
  const handleExit = useCallback(() => {
    onExit?.({
      thumbnailDataUrl: thumbnailRef.current || null,
      captures: capturesRef.current.map((it) => ({ type: it.type, blob: it.blob, fileName: it.fileName })),
    })
  }, [onExit])

  return createPortal(
    <div
      className="monoform-overlay"
      style={{ position: 'fixed', inset: 0, zIndex: 2147483000, background: '#181817' }}
    >
      <MonoformApp
        storageKey={storageKey}
        onExport={handleExport}
        onExit={handleExit}
        onThumbnail={handleThumbnail}
      />
    </div>,
    document.body
  )
}

export default MonoformOverlay
