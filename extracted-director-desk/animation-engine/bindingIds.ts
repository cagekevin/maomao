// ============================================================
// 3D 导演台 · 动画引擎 · id 规则
// ============================================================

function createId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

export function createScene3DObjectId(): string {
  return createId('scene3d-object')
}
export function createScene3DCameraId(): string {
  return createId('scene3d-camera')
}
export function createScene3DTrajectoryId(): string {
  return createId('scene3d-trajectory')
}
export function createScene3DTrajectoryPointId(): string {
  return createId('scene3d-trajectory-point')
}
export function createScene3DTrajectoryBindingId(): string {
  return createId('scene3d-trajectory-binding')
}
export function createScene3DTrajectoryGroupId(): string {
  return createId('scene3d-trajectory-group')
}

// 相机 aim 绑定 objectId = `${cameraId}:aim`（合成 id，不对应真实节点）。
export const CAMERA_AIM_BINDING_SUFFIX = ':aim'
export function cameraAimBindingId(cameraId: string): string {
  return `${cameraId}${CAMERA_AIM_BINDING_SUFFIX}`
}
export function cameraIdFromAimBindingId(objectId: string): string | null {
  return objectId.endsWith(CAMERA_AIM_BINDING_SUFFIX)
    ? objectId.slice(0, -CAMERA_AIM_BINDING_SUFFIX.length)
    : null
}
