// ============================================================
// 3D 导演台 · 动画引擎 · 数学工具
// 抽自 Nomi scene3dMath.ts（动画/K帧所需部分）
// ============================================================
import * as THREE from 'three'
import { CAMERA_DEFAULT_TARGET, MANNEQUIN_DEFAULT_POSE, MANNEQUIN_REST_ROTATION_KEY } from './constants'
import type { Scene3DObject, Scene3DVector3 } from './types'
import { propGroundFootprint } from './propSpecs'

export function vectorFromArray(value: Scene3DVector3): THREE.Vector3 {
  return new THREE.Vector3(value[0], value[1], value[2])
}

export function vectorToArray(value: THREE.Vector3): Scene3DVector3 {
  return [
    Number(value.x.toFixed(4)),
    Number(value.y.toFixed(4)),
    Number(value.z.toFixed(4)),
  ]
}

export function eulerToArray(value: THREE.Euler): Scene3DVector3 {
  return [
    Number(value.x.toFixed(4)),
    Number(value.y.toFixed(4)),
    Number(value.z.toFixed(4)),
  ]
}

export function cameraLookAtRotation(position: Scene3DVector3, target: Scene3DVector3): Scene3DVector3 {
  const cameraObject = new THREE.Object3D()
  cameraObject.position.fromArray(position)
  cameraObject.lookAt(vectorFromArray(target))
  return eulerToArray(cameraObject.rotation)
}

export function normalizeMannequinBoneName(boneName: string): string {
  return boneName.replace(/^mixamorig:/, 'mixamorig')
}

export function mannequinBoneNameVariants(boneName: string): string[] {
  const normalizedName = normalizeMannequinBoneName(boneName)
  const colonName = normalizedName.replace(/^mixamorig/, 'mixamorig:')
  return Array.from(new Set([boneName, normalizedName, colonName]))
}

export function mannequinPoseOffsetForBone(
  pose: Record<string, Scene3DVector3> | undefined,
  boneName: string,
): Scene3DVector3 | undefined {
  if (!pose) return undefined
  for (const candidate of mannequinBoneNameVariants(boneName)) {
    const rotation = pose[candidate]
    if (rotation) return rotation
  }
  return undefined
}

export function cameraViewPosition(cameraData: {
  position: Scene3DVector3
  target?: Scene3DVector3
  lensDepth?: number
  near?: number
}): THREE.Vector3 {
  const position = vectorFromArray(cameraData.position)
  const target = vectorFromArray(cameraData.target || CAMERA_DEFAULT_TARGET)
  const direction = target.clone().sub(position)
  const distance = direction.length()
  if (distance < 0.001) return position
  const depth = THREE.MathUtils.clamp(cameraData.lensDepth ?? 0, -100, 100) / 100
  if (Math.abs(depth) < 0.001) return position
  direction.normalize()
  const rawOffset = distance * 0.85 * depth
  const safeForwardOffset = Math.max(0, distance - Math.max(cameraData.near ?? 0.1, 0.1) - 0.2)
  const offset = depth > 0 ? Math.min(rawOffset, safeForwardOffset) : rawOffset
  return position.addScaledVector(direction, offset)
}

// ── 对象视觉半高（objectVisualHalfHeight）──
export function objectVisualHalfHeight(object: Scene3DObject, scale: Scene3DVector3 = object.scale): number {
  const scaleY = Math.max(0.08, Math.abs(scale[1] || 1))
  if (object.type === 'light') return 0.12 * scaleY
  if (object.type === 'prop') return 0 // origin 在地面中心
  if (object.type === 'mannequin' || object.type === 'mannequinCrowd') return 0.5 * scaleY
  if (object.geometry === 'sphere') return 0.55 * scaleY
  if (object.geometry === 'cylinder') return 0.55 * scaleY
  if (object.geometry === 'plane') return 0
  return 0.5 * scaleY
}

export function objectGroundFootprint(object: Scene3DObject): { width: number; depth: number } {
  const scaleX = Math.max(0.08, Math.abs(object.scale[0] || 1))
  const scaleY = Math.max(0.08, Math.abs(object.scale[1] || 1))
  const scaleZ = Math.max(0.08, Math.abs(object.scale[2] || 1))
  if (object.type === 'light') return { width: 0.42 * scaleX, depth: 0.42 * scaleZ }
  if (object.type === 'mannequin') return { width: 0.78 * scaleX, depth: 0.54 * scaleZ }
  if (object.type === 'prop' && object.propKind) {
    const footprint = propGroundFootprint(object.propKind)
    return { width: footprint.width * scaleX, depth: footprint.depth * scaleZ }
  }
  if (object.type === 'model' || object.type === 'group') return { width: 1 * scaleX, depth: 1 * scaleZ }
  if (object.geometry === 'sphere') return { width: 1.1 * scaleX, depth: 1.1 * scaleZ }
  if (object.geometry === 'cylinder') return { width: 0.92 * scaleX, depth: 0.92 * scaleZ }
  if (object.geometry === 'plane') return { width: scaleX, depth: scaleY }
  return { width: scaleX, depth: scaleZ }
}

// ── 假人骨骼姿势应用 ──
export function rememberMannequinRestPose(root: THREE.Object3D): void {
  root.traverse((object) => {
    if (!(object instanceof THREE.Bone)) return
    object.userData[MANNEQUIN_REST_ROTATION_KEY] = [
      object.rotation.x,
      object.rotation.y,
      object.rotation.z,
    ] satisfies Scene3DVector3
  })
}

export function resetMannequinSkeletonToRest(root: THREE.Object3D): void {
  root.traverse((object) => {
    if (!(object instanceof THREE.Bone)) return
    const restRotation = object.userData[MANNEQUIN_REST_ROTATION_KEY] as Scene3DVector3 | undefined
    if (!restRotation) return
    object.rotation.set(restRotation[0], restRotation[1], restRotation[2])
  })
  root.updateMatrixWorld(true)
}

export function applyMannequinSkeletonPose(root: THREE.Object3D, pose?: Record<string, Scene3DVector3>): void {
  root.traverse((object) => {
    if (!(object instanceof THREE.Bone)) return
    const restRotation = object.userData[MANNEQUIN_REST_ROTATION_KEY] as Scene3DVector3 | undefined
    if (!restRotation) return
    object.rotation.set(restRotation[0], restRotation[1], restRotation[2])
  })
  root.traverse((object) => {
    if (!(object instanceof THREE.Bone)) return
    const defaultOffset = MANNEQUIN_DEFAULT_POSE[normalizeMannequinBoneName(object.name)]
    const savedOffset = mannequinPoseOffsetForBone(pose, object.name)
    if (!defaultOffset && !savedOffset) return
    object.rotation.x += (defaultOffset?.[0] || 0) + (savedOffset?.[0] || 0)
    object.rotation.y += (defaultOffset?.[1] || 0) + (savedOffset?.[1] || 0)
    object.rotation.z += (defaultOffset?.[2] || 0) + (savedOffset?.[2] || 0)
  })
  root.updateMatrixWorld(true)
}

// locomotion 动画态下手臂走静态「下垂」姿势（只碰手臂链骨）。
const ARM_DOWN_BONE_PATTERN = /(Shoulder|Arm|ForeArm|Hand)/
function isArmDownBoneName(boneName: string): boolean {
  if (!/(Left|Right)/.test(boneName)) return false
  return ARM_DOWN_BONE_PATTERN.test(boneName)
}

export function applyMannequinArmDownPose(root: THREE.Object3D): void {
  root.traverse((object) => {
    if (!(object instanceof THREE.Bone)) return
    if (!isArmDownBoneName(object.name)) return
    const restRotation = object.userData[MANNEQUIN_REST_ROTATION_KEY] as Scene3DVector3 | undefined
    if (restRotation) object.rotation.set(restRotation[0], restRotation[1], restRotation[2])
    const offset = MANNEQUIN_DEFAULT_POSE[normalizeMannequinBoneName(object.name)]
    if (!offset) return
    object.rotation.x += offset[0]
    object.rotation.y += offset[1]
    object.rotation.z += offset[2]
  })
  root.updateMatrixWorld(true)
}

const MANNEQUIN_GROUND_REF_KEY = 'scene3dGroundRefY'
const MANNEQUIN_GROUND_BASE_KEY = 'scene3dGroundBaseY'
const _groundVertex = new THREE.Vector3()

function lowestMannequinLocalY(root: THREE.Object3D): number | null {
  let minY: number | null = null
  root.updateMatrixWorld(true)
  root.traverse((object) => {
    if (!(object instanceof THREE.SkinnedMesh)) return
    const position = object.geometry.getAttribute('position')
    if (!position) return
    for (let i = 0; i < position.count; i += 1) {
      _groundVertex.fromBufferAttribute(position, i)
      object.applyBoneTransform(i, _groundVertex)
      object.localToWorld(_groundVertex)
      root.worldToLocal(_groundVertex)
      if (minY === null || _groundVertex.y < minY) minY = _groundVertex.y
    }
  })
  if (minY !== null) return minY
  const point = new THREE.Vector3()
  root.traverse((object) => {
    if (!(object instanceof THREE.Bone)) return
    object.getWorldPosition(point)
    root.worldToLocal(point)
    if (minY === null || point.y < minY) minY = point.y
  })
  return minY
}

export function captureMannequinGroundReference(root: THREE.Group): void {
  applyMannequinSkeletonPose(root, undefined)
  const inner = root.children[0]
  if (!inner) return
  if (inner.userData[MANNEQUIN_GROUND_BASE_KEY] === undefined) {
    inner.userData[MANNEQUIN_GROUND_BASE_KEY] = inner.position.y
  }
  root.updateMatrixWorld(true)
  const minY = lowestMannequinLocalY(root)
  if (minY !== null) root.userData[MANNEQUIN_GROUND_REF_KEY] = minY
}

export function groundMannequinModel(root: THREE.Group): void {
  const inner = root.children[0]
  const refY = root.userData[MANNEQUIN_GROUND_REF_KEY] as number | undefined
  if (!inner || refY === undefined) return
  const baseY = (inner.userData[MANNEQUIN_GROUND_BASE_KEY] as number | undefined) ?? inner.position.y
  inner.position.y = baseY
  root.updateMatrixWorld(true)
  const minY = lowestMannequinLocalY(root)
  if (minY === null) return
  inner.position.y = baseY + (refY - minY)
  root.updateMatrixWorld(true)
}
