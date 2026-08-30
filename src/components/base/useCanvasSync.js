/**
 * 多窗口画布同步检测 hook（复刻官方 H_.jsx:480-492 + 870-880）。
 *
 * 【职责】每窗口唯一 tabId；BroadcastChannel('yimao_canvas_sync') 监听：收到「其他窗口」
 * 保存的同一项目 CANVAS_SAVED → 置 canvasConflict=true（App 据此显示红色警告条）。
 *
 * 【从 App.jsx 抽出】原内联逻辑 + tabIdRef/persistCanvas 广播共用同一 tabId，故一并暴露
 * tabIdRef，供 App 的 persistCanvas 广播 CANVAS_SAVED 时带上自身 tabId（被其他窗口过滤掉）。
 *
 * 【项目变化重置】画布冲突标记只在「当前项目内」有效。切换项目后必须重置 canvasConflict，
 * 否则旧项目的冲突状态会残留到新项目。此逻辑收口在本 hook 内部：监听 getProjectId()
 * 返回值变化时自动 setCanvasConflict(false)，App 无需接触 setter。
 *
 * @param {() => string} getProjectId 返回当前项目 id 的函数（App 传 getCurrentProject().id）
 * @returns {{ canvasConflict: boolean, tabIdRef: React.RefObject<string> }}
 */
import { useEffect, useRef, useState } from 'react'
import { generateId } from './idGen.ts'
import { logger } from './logger.js'

export function useCanvasSync(getProjectId) {
  const tabIdRef = useRef(generateId('tab'))
  const [canvasConflict, setCanvasConflict] = useState(false)
  // 用 ref 存最新 getProjectId：监听 effect 只在挂载时注册一次（对齐官方），内部实时读当前项目 id
  const getProjectIdRef = useRef(getProjectId)
  getProjectIdRef.current = getProjectId
  // 记录上一次项目 id，用于「切换项目后重置冲突」
  const prevProjectIdRef = useRef()

  // 监听 BroadcastChannel（只在挂载时注册一次；项目切换不重建 channel）
  useEffect(() => {
    let channel
    try {
      channel = new BroadcastChannel('yimao_canvas_sync')
      channel.onmessage = (e) => {
        if (
          e?.data?.type === 'CANVAS_SAVED' &&
          e.data.projectId === getProjectIdRef.current?.() &&
          e.data.tabId !== tabIdRef.current
        ) {
          setCanvasConflict(true)
        }
      }
    } catch (err) {
      logger.warn('Canvas', 'BroadcastChannel 不可用', err?.message)
    }
    return () => { try { channel?.close() } catch { /* ignore */ } }
  }, [])

  // 切换项目后重置冲突标记（官方在 projectId 变化时不应残留旧项目冲突）。
  // 用 getProjectIdRef 实时读，仅当返回的 id 变化才重置（避免每次渲染都 setState）。
  useEffect(() => {
    const id = getProjectIdRef.current?.()
    if (prevProjectIdRef.current !== id) {
      prevProjectIdRef.current = id
      setCanvasConflict(false)
    }
  })

  return { canvasConflict, tabIdRef }
}
