import React from 'react'
import {
  cameraLookAtRotation,
  editorCameraFromSceneCamera,
  vectorAlmostEqual,
} from './scene3dMath'
import { cameraWithPlaybackPosition } from './scene3dPlayback'
import type { Scene3DCamera, Scene3DState } from './scene3dTypes'

// 相机「取景态」编排（从 Scene3DFullscreen 壳抽出，R9 防巨壳）。取景 = 编辑器相机切 fly + 把相机
// 位姿实时写回该场景相机（CameraViewEditController 接管）。相机操控（运镜）复用同一套（enterCameraViewEdit）。
// state（cameraViewEditId）仍住壳里（被 delete/快捷键/渲染多处读），这里只收编排回调，避免再开一份真相源。
export function useScene3DCameraViewEdit({
  readOnly,
  selectedCamera,
  cameraViewEditId,
  cameraViewEditCamera,
  stateRef,
  latestEditorCameraRef,
  playheadRef,
  activeTrajectoryIds,
  setSelection,
  setCameraViewEditId,
  setViewLocked,
  setFocusId,
  setState,
  patchCamera,
  setTimelineOpen,
}: {
  readOnly: boolean
  selectedCamera: Scene3DCamera | undefined
  cameraViewEditId: string | null
  cameraViewEditCamera: Scene3DCamera | undefined
  stateRef: React.MutableRefObject<Scene3DState>
  latestEditorCameraRef: React.MutableRefObject<Scene3DState['editorCamera']>
  playheadRef: React.MutableRefObject<number>
  activeTrajectoryIds: ReadonlySet<string> | null
  setSelection: (selection: { type: 'camera'; id: string }) => void
  setCameraViewEditId: React.Dispatch<React.SetStateAction<string | null>>
  setViewLocked: (locked: boolean) => void
  setFocusId: (id: string) => void
  setState: React.Dispatch<React.SetStateAction<Scene3DState>>
  patchCamera: (id: string, patch: Partial<Scene3DCamera>) => void
  setTimelineOpen: (open: boolean) => void
}): {
  enterCameraViewEdit: (cameraData: Scene3DCamera) => void
  exitCameraViewEdit: () => void
  toggleCameraViewEdit: () => void
  levelSelectedCamera: () => void
  previewMode: boolean
  setPreviewMode: React.Dispatch<React.SetStateAction<boolean>>
  handleTogglePreview: () => void
  updateEditorCamera: (editorCamera: Scene3DState['editorCamera']) => void
} {
  // 被取景相机被删 → 退出取景态（state 在壳里，effect 也住壳；这里只清 id 兜底）。
  React.useEffect(() => {
    if (cameraViewEditId && !cameraViewEditCamera) {
      setCameraViewEditId(null)
    }
  }, [cameraViewEditCamera, cameraViewEditId, setCameraViewEditId])

  // 编辑器相机写回（从壳内迁入，R9 防巨壳）：更新 latest ref + 幂等 setState（位姿没变则跳过，省重渲染）。
  const updateEditorCamera = React.useCallback((editorCamera: Scene3DState['editorCamera']) => {
    latestEditorCameraRef.current = editorCamera
    setState((current) => {
      const nextEditorCamera = {
        ...current.editorCamera,
        ...editorCamera,
      }
      if (
        current.editorCamera.mode === nextEditorCamera.mode &&
        vectorAlmostEqual(current.editorCamera.position, nextEditorCamera.position) &&
        vectorAlmostEqual(current.editorCamera.rotation, nextEditorCamera.rotation) &&
        vectorAlmostEqual(current.editorCamera.target, nextEditorCamera.target)
      ) {
        return current
      }
      return {
        ...current,
        editorCamera: nextEditorCamera,
      }
    })
  }, [latestEditorCameraRef, setState])

  const enterCameraViewEdit = React.useCallback((cameraData: Scene3DCamera) => {
    if (readOnly) return
    const editorCamera = editorCameraFromSceneCamera(cameraData)
    latestEditorCameraRef.current = editorCamera
    setSelection({ type: 'camera', id: cameraData.id })
    setCameraViewEditId(cameraData.id)
    setViewLocked(false)
    setFocusId('')
    updateEditorCamera(editorCamera)
  }, [latestEditorCameraRef, readOnly, setCameraViewEditId, setFocusId, setSelection, setViewLocked, updateEditorCamera])

  const exitCameraViewEdit = React.useCallback(() => {
    setCameraViewEditId(null)
    setViewLocked(false)
    setFocusId('')
  }, [setCameraViewEditId, setFocusId, setViewLocked])

  // 成片预览态（第2期）：主视口 live 跟随播放头看运镜回放。与取景态同属「主视口视图模式」，收在同一 hook
  // （P1 内聚，一处管工作/取景/预览三态）。互斥：进预览退取景 + 开时间轴（好拖着看回放）。
  const [previewMode, setPreviewMode] = React.useState(false)
  const handleTogglePreview = React.useCallback(() => {
    setPreviewMode((on) => {
      const next = !on
      if (next) {
        if (cameraViewEditId) exitCameraViewEdit()
        setTimelineOpen(true)
      }
      return next
    })
  }, [cameraViewEditId, exitCameraViewEdit, setTimelineOpen])

  const toggleCameraViewEdit = React.useCallback(() => {
    if (!selectedCamera || readOnly) return
    if (cameraViewEditId === selectedCamera.id) return
    enterCameraViewEdit(cameraWithPlaybackPosition(stateRef.current, selectedCamera, playheadRef.current, activeTrajectoryIds))
  }, [activeTrajectoryIds, cameraViewEditId, enterCameraViewEdit, playheadRef, readOnly, selectedCamera, stateRef])

  const levelSelectedCamera = React.useCallback(() => {
    if (!selectedCamera || readOnly) return
    const displayCamera = cameraWithPlaybackPosition(stateRef.current, selectedCamera, playheadRef.current, activeTrajectoryIds)
    patchCamera(selectedCamera.id, {
      rotation: cameraLookAtRotation(displayCamera.position, displayCamera.target),
    })
  }, [activeTrajectoryIds, patchCamera, playheadRef, readOnly, selectedCamera, stateRef])

  return { enterCameraViewEdit, exitCameraViewEdit, toggleCameraViewEdit, levelSelectedCamera, previewMode, setPreviewMode, handleTogglePreview, updateEditorCamera }
}
