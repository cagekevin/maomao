// 摘自 3d-director-desk UE4MannequinModel.tsx（MIT, © 2026 YZ）——spike 评估用。
// 关键：Box3.setFromObject(object, /* precise */ true) 按真实蒙皮顶点算包围盒——
// 该 GLB 几何 bind 空间是厘米(高 182)而骨骼世界是米(1.82)，非 precise 包围盒会差 100 倍。
import { Box3, Matrix4, Vector3, type Object3D } from 'three'

export function getBoundsInParentLocal(object: Object3D): Box3 {
  ;(object.parent ?? object).updateMatrixWorld(true)
  const worldBounds = new Box3().setFromObject(object, true)
  if (!object.parent || worldBounds.isEmpty()) return worldBounds
  const parentInverse = new Matrix4().copy(object.parent.matrixWorld).invert()
  const bounds = new Box3().makeEmpty()
  const vertex = new Vector3()
  for (const x of [worldBounds.min.x, worldBounds.max.x]) {
    for (const y of [worldBounds.min.y, worldBounds.max.y]) {
      for (const z of [worldBounds.min.z, worldBounds.max.z]) {
        vertex.set(x, y, z).applyMatrix4(parentInverse)
        bounds.expandByPoint(vertex)
      }
    }
  }
  return bounds
}

export function alignUE4MannequinToGround(scene: Object3D): number {
  const rootX = scene.position.x
  const rootZ = scene.position.z
  scene.position.set(rootX, 0, rootZ)
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const bounds = getBoundsInParentLocal(scene)
    const correctionY = bounds.isEmpty() || !Number.isFinite(bounds.min.y) ? 0 : -bounds.min.y
    if (Math.abs(correctionY) < 0.00001) break
    scene.position.set(rootX, scene.position.y + correctionY, rootZ)
  }
  scene.position.set(rootX, scene.position.y, rootZ)
  ;(scene.parent ?? scene).updateMatrixWorld(true)
  return scene.position.y
}
