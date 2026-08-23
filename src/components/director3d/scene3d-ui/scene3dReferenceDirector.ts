// scene3dReferenceDirector 临时 stub：
// 原实现依赖 generationCanvas 的节点/边/agent/controls（把 3D 截图接到下游视频节点）。
// 这里保留完整类型与导出签名，函数返回「未连接」安全默认值，先跑通界面。
// 之后要接下游节点引用，把 Nomi 原逻辑（scene3d/scene3dReferenceDirector.ts）搬回来。

export type Scene3DReferenceFrameSupport = {
  firstFrame: boolean
  lastFrame: boolean
}

export type Scene3DReferenceTargetSummary =
  | {
      state: 'not-connected'
      targetNodeId?: undefined
      targetTitle?: undefined
      videoRefModeId?: undefined
      videoRefMetaKey?: undefined
      currentFrameSupport: Scene3DReferenceFrameSupport
      anyFrameSupport: Scene3DReferenceFrameSupport
    }
  | {
      state: 'video-ref'
      targetNodeId: string
      targetTitle: string
      videoRefModeId: string
      videoRefMetaKey: string
      currentFrameSupport: Scene3DReferenceFrameSupport
      anyFrameSupport: Scene3DReferenceFrameSupport
    }
  | {
      state: 'prompt-fallback'
      targetNodeId: string
      targetTitle: string
      videoRefModeId?: undefined
      videoRefMetaKey?: undefined
      currentFrameSupport: Scene3DReferenceFrameSupport
      anyFrameSupport: Scene3DReferenceFrameSupport
    }

const NOT_CONNECTED: Scene3DReferenceTargetSummary = {
  state: 'not-connected',
  currentFrameSupport: { firstFrame: false, lastFrame: false },
  anyFrameSupport: { firstFrame: false, lastFrame: false },
}

export function summarizeScene3DReferenceTarget(): Scene3DReferenceTargetSummary {
  return NOT_CONNECTED
}

export function referenceSlotForScene3DCaptureTitle(_title: string): 'first_frame' | 'last_frame' | null {
  return null
}

export function shouldAttachScene3DFrameReference(): boolean {
  return false
}

export function scene3DReferenceTargetLabel(target: Scene3DReferenceTargetSummary): string {
  if (target.state === 'not-connected') return '未连接视频镜头'
  if (target.state === 'video-ref') return `video_ref · ${target.targetTitle}`
  return `prompt · ${target.targetTitle}`
}
