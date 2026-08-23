// ============================================================
// 3D 导演台 · 动画引擎 · 语义道具 footprint
// 抽自 Nomi scene3dPropSpecs.ts（仅 footprint，供 objectVisualHalfHeight）
// ============================================================
import type { Scene3DPropKind } from './types'

export const PROP_FOOTPRINTS: Record<Scene3DPropKind, { width: number; depth: number }> = {
  car: { width: 1.9, depth: 4.6 },
  building: { width: 6.4, depth: 6.4 },
  tree: { width: 2.3, depth: 2.3 },
  streetlamp: { width: 1.0, depth: 1.0 },
  wall: { width: 4.0, depth: 0.3 },
  suv: { width: 1.95, depth: 4.6 },
  bus: { width: 2.35, depth: 7.4 },
  bicycle: { width: 0.6, depth: 1.9 },
  scooter: { width: 0.5, depth: 1.5 },
  sofa: { width: 2.3, depth: 1.05 },
  diningTable: { width: 1.9, depth: 1.15 },
  fridge: { width: 0.85, depth: 0.8 },
  washingMachine: { width: 0.7, depth: 0.7 },
  trashBins: { width: 1.75, depth: 0.6 },
  atm: { width: 1.1, depth: 0.8 },
  backpack: { width: 0.5, depth: 0.4 },
}

export function propGroundFootprint(kind: Scene3DPropKind): { width: number; depth: number } {
  return PROP_FOOTPRINTS[kind]
}
