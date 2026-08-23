// 看全场取景（derive 自场景内容，不写死机位常量）：把全部对象 + 相机 gizmo 框进视锥。
// 两个消费方共用一份数学：① createDefaultScene3DState 的默认编辑器机位——治「进门看不见
// 相机1，以为场景里没相机」（2026-07-20 用户真机反馈：旧默认 [-5,3.2,6] 只框假人，相机1
// [4,2.4,5] 落在 55° 视锥右缘外 ~5°）；② 视口「看全场」按钮（FocusController 哨兵）。
import * as THREE from 'three'
import type { Scene3DCamera, Scene3DObject, Scene3DVector3 } from './scene3dTypes'

/** FocusController 的「看全场」哨兵 focusId（`${SENTINEL}:${nonce}` 触发重复点击） */
export const SCENE_FIT_FOCUS_ID = '__scene-fit__'

// 沿旧默认视向（[-5,3.2,6] 看 [0,0.75,0]）保持观感连续；只有距离/中心按内容推导。
const FIT_VIEW_DIRECTION = new THREE.Vector3(-5, 2.45, 6).normalize()
// 与 Scene3DFullscreen canvasCamera 的垂直 FOV 一致；包围球用 sin(半角) 才保证任意朝向都在锥内。
const EDITOR_CAMERA_FOV_DEG = 55
const FIT_MARGIN = 1.12

function objectPadding(object: Pick<Scene3DObject, 'type' | 'scale'>): number {
  if (object.type === 'mannequin' || object.type === 'mannequinCrowd') return 1.4
  const scale = object.scale ?? [1, 1, 1]
  return Math.max(scale[0], scale[1], scale[2], 0.5) * 0.75
}

export function fitEditorCameraToScene(
  objects: Array<Pick<Scene3DObject, 'position' | 'scale' | 'type'>>,
  cameras: Array<Pick<Scene3DCamera, 'position'>>,
): { position: Scene3DVector3; target: Scene3DVector3 } {
  const box = new THREE.Box3()
  objects.forEach((object) => {
    const pad = objectPadding(object as Pick<Scene3DObject, 'type' | 'scale'>)
    const center = new THREE.Vector3(...object.position)
    box.expandByPoint(center.clone().addScalar(pad))
    box.expandByPoint(center.clone().addScalar(-pad))
  })
  // 相机 gizmo 纳入 fit 是为了「看见相机1」（2026-07-20 反馈）；但被 WASD 飞远的相机会把位姿
  // 写回场景（CameraViewEditController）——position 成天文数字后把包围盒撑爆，distance 算出
  // 极远端机位，场景主体缩成亚像素/被远裁剪面切掉 → 「点看全场就没东西了」白屏
  // （2026-08-07 飞书反馈根因）。离群相机（离对象中心过远）不参与取景；正常相机行为不变。
  const objectCenter = box.isEmpty() ? new THREE.Vector3(0, 0.75, 0) : box.getCenter(new THREE.Vector3())
  const objectRadius = box.isEmpty() ? 2 : Math.max(box.getSize(new THREE.Vector3()).length() / 2, 2)
  const cameraInclusionRadius = Math.max(objectRadius * 4, 50)
  cameras.forEach((camera) => {
    const center = new THREE.Vector3(...camera.position)
    if (center.distanceTo(objectCenter) > cameraInclusionRadius) return
    box.expandByPoint(center.clone().addScalar(0.8))
    box.expandByPoint(center.clone().addScalar(-0.8))
  })
  if (box.isEmpty()) return { position: [-5, 3.2, 6], target: [0, 0.75, 0] }

  const center = box.getCenter(new THREE.Vector3())
  const radius = Math.max(box.getSize(new THREE.Vector3()).length() / 2, 2)
  const halfFovRad = (EDITOR_CAMERA_FOV_DEG / 2) * (Math.PI / 180)
  const distance = (radius / Math.sin(halfFovRad)) * FIT_MARGIN
  const eye = center.clone().addScaledVector(FIT_VIEW_DIRECTION, distance)
  return {
    position: [eye.x, eye.y, eye.z],
    target: [center.x, center.y, center.z],
  }
}
