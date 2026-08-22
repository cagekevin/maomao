/**
 * 多窗口画布同步检测 hook（复刻官方 H_.jsx:480-492 + 870-880）。
 *
 * 【职责】每窗口唯一 tabId；BroadcastChannel('yimao_canvas_sync') 监听：收到「其他窗口」
 * 保存的同一项目 CANVAS_SAVED → 置 canvasConflict=true（App 据此显示红色警告条）。
 *
 * 【从 App.jsx 抽出】原内联逻辑 + tabIdRef/persistCanvas 广播共用同一 tabId，故一并暴露
 * tabIdRef，供 App 的 persistCanvas 广播 CANVAS_SAVED 时带上自身 tabId（被其他窗口过滤掉）。
 *
 * @param {() => string} getProjectId 返回当前项目 id 的函数（App 传 getCurrentProject().id）
 * @returns {{ canvasConflict: boolean, tabIdRef: React.RefObject<string> }}
 */
import { useEffect, useRef, useState } from 'react'
import { generateId } from './idGen.js'
import { logger } from './logger.js'

export function useCanvasSync(getProjectId) {
  const tabIdRef = useRef(generateId('tab'))
  const [canvasConflict, setCanvasConflict] = useState(false)

  useEffect(() => {
    let channel
    try {
      channel = new BroadcastChannel('yimao_canvas_sync')
      channel.onmessage = (e) => {
        if (
          e?.data?.type === 'CANVAS_SAVED' &&
          e.data.projectId === getProjectId?.() &&
          e.data.tabId !== tabIdRef.current
        ) {
          setCanvasConflict(true)
        }
      }
    } catch (err) {
      logger.warn('Canvas', 'BroadcastChannel 不可用', err?.message)
    }
    return () => { try { channel?.close() } catch { /* ignore */ } }
  }, [getProjectId])

  return { canvasConflict, tabIdRef }
}
