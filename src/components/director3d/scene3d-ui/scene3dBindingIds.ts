// 3D 场景 id 规则的单一真相源：新建实体的 id 工厂 + 相机 aim 合成 id 约定。
// 叶子模块（零依赖，不拖 THREE）——工厂/录 take/持久化/剪贴板共用同一套规则，
// 且纯数据模块（scene3dPropSpecs 等）引它不会被拖进 serializer 的依赖树（防环）。

function createScene3DId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

export function createScene3DObjectId(): string {
  return createScene3DId('scene3d-object')
}

export function createScene3DCameraId(): string {
  return createScene3DId('scene3d-camera')
}

export function createScene3DTrajectoryId(): string {
  return createScene3DId('scene3d-trajectory')
}

export function createScene3DTrajectoryPointId(): string {
  return createScene3DId('scene3d-trajectory-point')
}

export function createScene3DTrajectoryBindingId(): string {
  return createScene3DId('scene3d-trajectory-binding')
}

export function createScene3DTrajectoryGroupId(): string {
  return createScene3DId('scene3d-trajectory-group')
}

// aim 绑定的 objectId = `${cameraId}:aim`（一个合成 id，不对应任何真实节点）。
// 相机 aimTrajectoryId 只是「有没有 aim 轨迹」的标志，实际采样按合成 id 在 trajectoryBindings 里找。
export const CAMERA_AIM_BINDING_SUFFIX = ':aim'

export function cameraAimBindingId(cameraId: string): string {
  return `${cameraId}${CAMERA_AIM_BINDING_SUFFIX}`
}

/** 合成 aim 绑定 objectId → 相机 id；非 aim 绑定 id 返回 null。 */
export function cameraIdFromAimBindingId(objectId: string): string | null {
  return objectId.endsWith(CAMERA_AIM_BINDING_SUFFIX)
    ? objectId.slice(0, -CAMERA_AIM_BINDING_SUFFIX.length)
    : null
}
