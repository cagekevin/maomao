// 语义道具的 spec 数据与纯函数（与渲染组件 scene3dProps.tsx 分文件：react-refresh 要求
// 组件文件只导出组件；serializer/toolbar/模板 builder 等纯逻辑消费方也不用拖进 three/r3f）。
// 每种道具 = 图元组合的数据 spec，新增 kind 只加一条 spec。origin 在**地面中心**
// （y=0 落地即贴地；objectVisualHalfHeight 对 prop 返回 0，绑轨迹时底面贴着轨迹走，如车沿路径开）。
import type { Scene3DObject, Scene3DPropKind, Scene3DVector3 } from './scene3dTypes'
import { createScene3DObjectId } from './scene3dBindingIds'

export type PropPartGeometry = 'box' | 'cylinder' | 'sphere' | 'cone'

export type PropPart = {
  geometry: PropPartGeometry
  /** box: [宽,高,深]；cylinder: [顶半径,底半径,高]；cone: [底半径,高]；sphere: [半径] */
  size: number[]
  position: Scene3DVector3
  rotation?: Scene3DVector3
  /** 缺省 = 用 object.color（该 kind 的「主体色」部件） */
  color?: string
}

export type PropSpec = {
  label: string
  /** 该 kind 的出厂主体色（3D 渲染色，主题无关——与 scene3d 现有对象色同例） */
  defaultColor: string
  /** 地面占位（未缩放），供避让摆位/选中包围用 */
  footprint: { width: number; depth: number }
  parts: PropPart[]
}

export const PROP_SPECS: Record<Scene3DPropKind, PropSpec> = {
  car: {
    label: '车辆',
    defaultColor: '#8f9aa8',
    footprint: { width: 1.9, depth: 4.6 },
    parts: [
      { geometry: 'box', size: [1.8, 0.7, 4.4], position: [0, 0.55, 0] },
      { geometry: 'box', size: [1.6, 0.6, 2.2], position: [0, 1.2, -0.3] },
      { geometry: 'cylinder', size: [0.34, 0.34, 0.26], position: [0.85, 0.34, 1.4], rotation: [0, 0, Math.PI / 2], color: '#3a3a3e' },
      { geometry: 'cylinder', size: [0.34, 0.34, 0.26], position: [-0.85, 0.34, 1.4], rotation: [0, 0, Math.PI / 2], color: '#3a3a3e' },
      { geometry: 'cylinder', size: [0.34, 0.34, 0.26], position: [0.85, 0.34, -1.4], rotation: [0, 0, Math.PI / 2], color: '#3a3a3e' },
      { geometry: 'cylinder', size: [0.34, 0.34, 0.26], position: [-0.85, 0.34, -1.4], rotation: [0, 0, Math.PI / 2], color: '#3a3a3e' },
    ],
  },
  building: {
    label: '建筑',
    defaultColor: '#b3aca0',
    footprint: { width: 6.4, depth: 6.4 },
    parts: [
      { geometry: 'box', size: [6, 12, 6], position: [0, 6, 0] },
      { geometry: 'box', size: [6.4, 0.3, 6.4], position: [0, 12.15, 0], color: '#8d867b' },
    ],
  },
  tree: {
    label: '树木',
    defaultColor: '#5c9457',
    footprint: { width: 2.3, depth: 2.3 },
    parts: [
      { geometry: 'cylinder', size: [0.14, 0.18, 1.4], position: [0, 0.7, 0], color: '#7c5a3a' },
      { geometry: 'sphere', size: [1.15], position: [0, 2.35, 0] },
      { geometry: 'sphere', size: [0.85], position: [0.35, 3.0, 0.15] },
    ],
  },
  streetlamp: {
    label: '路灯',
    defaultColor: '#6b7078',
    footprint: { width: 1.0, depth: 1.0 },
    parts: [
      { geometry: 'cylinder', size: [0.06, 0.09, 4.2], position: [0, 2.1, 0] },
      { geometry: 'box', size: [0.9, 0.07, 0.07], position: [0.42, 4.15, 0] },
      { geometry: 'box', size: [0.5, 0.12, 0.22], position: [0.8, 4.1, 0] },
      { geometry: 'sphere', size: [0.09], position: [0.8, 4.0, 0], color: '#ffd9a0' },
    ],
  },
  wall: {
    label: '墙面',
    defaultColor: '#b9b2a6',
    footprint: { width: 4.0, depth: 0.3 },
    parts: [
      { geometry: 'box', size: [4, 2.6, 0.24], position: [0, 1.3, 0] },
    ],
  },
  // ── 2026-08-03 批量扩充（交通/家居/街景 11 种）──
  // 几何参考开源导演台 3d-director-desk 的 BuiltInLifeModel（MIT, © 2026 YZ,
  // github.com/xiaozangao/3d-director-desk），逐件重标定到本世界米制
  // （对方车长 1.75 单位≈玩具比例，此处按真实尺寸重设；家具对方本就真实比例，微调沿用）。
  // 长轴一律沿 Z（与 car 同例：绑轨迹时沿路径「开」）。
  suv: {
    label: 'SUV',
    defaultColor: '#6b7650',
    footprint: { width: 1.95, depth: 4.6 },
    parts: [
      { geometry: 'box', size: [1.85, 1.0, 4.4], position: [0, 0.85, 0] },
      { geometry: 'box', size: [1.7, 0.75, 2.4], position: [0, 1.7, -0.2] },
      { geometry: 'cylinder', size: [0.4, 0.4, 0.28], position: [0.9, 0.4, 1.45], rotation: [0, 0, Math.PI / 2], color: '#33363b' },
      { geometry: 'cylinder', size: [0.4, 0.4, 0.28], position: [-0.9, 0.4, 1.45], rotation: [0, 0, Math.PI / 2], color: '#33363b' },
      { geometry: 'cylinder', size: [0.4, 0.4, 0.28], position: [0.9, 0.4, -1.45], rotation: [0, 0, Math.PI / 2], color: '#33363b' },
      { geometry: 'cylinder', size: [0.4, 0.4, 0.28], position: [-0.9, 0.4, -1.45], rotation: [0, 0, Math.PI / 2], color: '#33363b' },
    ],
  },
  bus: {
    label: '公交车',
    defaultColor: '#d5a13a',
    footprint: { width: 2.35, depth: 7.4 },
    parts: [
      { geometry: 'box', size: [2.2, 2.3, 7.2], position: [0, 1.45, 0] },
      { geometry: 'box', size: [2.26, 0.62, 5.4], position: [0, 2.0, 0], color: '#89b5c8' },
      { geometry: 'box', size: [1.9, 0.5, 0.06], position: [0, 1.7, 3.62], color: '#dbe7ed' },
      { geometry: 'cylinder', size: [0.45, 0.45, 0.3], position: [1.0, 0.45, 2.6], rotation: [0, 0, Math.PI / 2], color: '#33363b' },
      { geometry: 'cylinder', size: [0.45, 0.45, 0.3], position: [-1.0, 0.45, 2.6], rotation: [0, 0, Math.PI / 2], color: '#33363b' },
      { geometry: 'cylinder', size: [0.45, 0.45, 0.3], position: [1.0, 0.45, -2.6], rotation: [0, 0, Math.PI / 2], color: '#33363b' },
      { geometry: 'cylinder', size: [0.45, 0.45, 0.3], position: [-1.0, 0.45, -2.6], rotation: [0, 0, Math.PI / 2], color: '#33363b' },
    ],
  },
  bicycle: {
    label: '自行车',
    defaultColor: '#e85f4d',
    footprint: { width: 0.6, depth: 1.9 },
    parts: [
      { geometry: 'cylinder', size: [0.34, 0.34, 0.06], position: [0, 0.34, 0.65], rotation: [0, 0, Math.PI / 2], color: '#22272e' },
      { geometry: 'cylinder', size: [0.34, 0.34, 0.06], position: [0, 0.34, -0.65], rotation: [0, 0, Math.PI / 2], color: '#22272e' },
      { geometry: 'box', size: [0.06, 0.06, 1.0], position: [0, 0.62, 0.05], rotation: [0.5, 0, 0] },
      { geometry: 'box', size: [0.06, 0.06, 0.9], position: [0, 0.62, -0.1], rotation: [-0.5, 0, 0] },
      { geometry: 'box', size: [0.06, 0.75, 0.06], position: [0, 0.95, 0.6], rotation: [-0.15, 0, 0], color: '#2d3741' },
      { geometry: 'box', size: [0.55, 0.05, 0.06], position: [0, 1.3, 0.65], color: '#2d3741' },
      { geometry: 'box', size: [0.26, 0.06, 0.18], position: [0, 1.0, -0.18], color: '#20262c' },
    ],
  },
  scooter: {
    label: '电动踏板车',
    defaultColor: '#3d566e',
    footprint: { width: 0.5, depth: 1.5 },
    parts: [
      { geometry: 'box', size: [0.32, 0.1, 1.15], position: [0, 0.2, -0.05] },
      { geometry: 'box', size: [0.07, 1.2, 0.07], position: [0, 0.82, 0.52], rotation: [-0.08, 0, 0] },
      { geometry: 'box', size: [0.55, 0.06, 0.06], position: [0, 1.42, 0.58], color: '#202831' },
      { geometry: 'cylinder', size: [0.16, 0.16, 0.07], position: [0, 0.16, 0.58], rotation: [0, 0, Math.PI / 2], color: '#22272e' },
      { geometry: 'cylinder', size: [0.16, 0.16, 0.07], position: [0, 0.16, -0.58], rotation: [0, 0, Math.PI / 2], color: '#22272e' },
    ],
  },
  sofa: {
    label: '沙发',
    defaultColor: '#b26d4f',
    footprint: { width: 2.3, depth: 1.05 },
    parts: [
      { geometry: 'box', size: [2.1, 0.5, 0.95], position: [0, 0.55, 0] },
      { geometry: 'box', size: [2.0, 0.8, 0.24], position: [0, 1.0, 0.34], rotation: [-0.12, 0, 0], color: '#9b5c43' },
      { geometry: 'box', size: [0.22, 0.62, 0.95], position: [-1.04, 0.75, 0], color: '#8b513b' },
      { geometry: 'box', size: [0.22, 0.62, 0.95], position: [1.04, 0.75, 0], color: '#8b513b' },
      { geometry: 'box', size: [0.14, 0.3, 0.14], position: [-0.8, 0.15, 0], color: '#3b302b' },
      { geometry: 'box', size: [0.14, 0.3, 0.14], position: [0.8, 0.15, 0], color: '#3b302b' },
    ],
  },
  diningTable: {
    label: '餐桌',
    defaultColor: '#8b5a36',
    footprint: { width: 1.9, depth: 1.15 },
    parts: [
      { geometry: 'box', size: [1.8, 0.12, 1.05], position: [0, 0.78, 0] },
      { geometry: 'box', size: [0.12, 0.72, 0.12], position: [-0.75, 0.36, -0.4], color: '#654128' },
      { geometry: 'box', size: [0.12, 0.72, 0.12], position: [0.75, 0.36, -0.4], color: '#654128' },
      { geometry: 'box', size: [0.12, 0.72, 0.12], position: [-0.75, 0.36, 0.4], color: '#654128' },
      { geometry: 'box', size: [0.12, 0.72, 0.12], position: [0.75, 0.36, 0.4], color: '#654128' },
    ],
  },
  fridge: {
    label: '冰箱',
    defaultColor: '#e6e9ec',
    footprint: { width: 0.85, depth: 0.8 },
    parts: [
      { geometry: 'box', size: [0.75, 1.85, 0.72], position: [0, 0.925, 0] },
      { geometry: 'box', size: [0.02, 1.2, 0.05], position: [0, 1.1, 0.37], color: '#b9c8ce' },
      { geometry: 'box', size: [0.05, 0.4, 0.04], position: [-0.12, 1.15, 0.39], color: '#69767c' },
      { geometry: 'box', size: [0.05, 0.4, 0.04], position: [0.12, 1.15, 0.39], color: '#69767c' },
    ],
  },
  washingMachine: {
    label: '洗衣机',
    defaultColor: '#e6e9ec',
    footprint: { width: 0.7, depth: 0.7 },
    parts: [
      { geometry: 'box', size: [0.65, 0.9, 0.65], position: [0, 0.45, 0] },
      { geometry: 'cylinder', size: [0.26, 0.26, 0.06], position: [0, 0.48, 0.34], rotation: [Math.PI / 2, 0, 0], color: '#273744' },
      { geometry: 'cylinder', size: [0.18, 0.18, 0.06], position: [0, 0.48, 0.36], rotation: [Math.PI / 2, 0, 0], color: '#81a8bc' },
      { geometry: 'box', size: [0.5, 0.1, 0.04], position: [0, 0.82, 0.33], color: '#303942' },
    ],
  },
  trashBins: {
    label: '分类垃圾桶',
    defaultColor: '#4b9664',
    footprint: { width: 1.75, depth: 0.6 },
    parts: [
      { geometry: 'box', size: [0.45, 1.05, 0.5], position: [-0.55, 0.55, 0], color: '#4386b2' },
      { geometry: 'box', size: [0.45, 1.05, 0.5], position: [0, 0.55, 0] },
      { geometry: 'box', size: [0.45, 1.05, 0.5], position: [0.55, 0.55, 0], color: '#d09144' },
    ],
  },
  atm: {
    label: 'ATM 机',
    defaultColor: '#315e78',
    footprint: { width: 1.1, depth: 0.8 },
    parts: [
      { geometry: 'box', size: [1.0, 1.7, 0.7], position: [0, 0.85, 0] },
      { geometry: 'box', size: [0.6, 0.42, 0.06], position: [0, 1.25, 0.36], rotation: [-0.16, 0, 0], color: '#172b38' },
      { geometry: 'box', size: [0.46, 0.28, 0.03], position: [0, 1.27, 0.4], rotation: [-0.16, 0, 0], color: '#87b9c9' },
    ],
  },
  backpack: {
    label: '背包',
    defaultColor: '#516b55',
    footprint: { width: 0.5, depth: 0.4 },
    parts: [
      { geometry: 'box', size: [0.45, 0.6, 0.28], position: [0, 0.32, 0] },
      { geometry: 'box', size: [0.32, 0.24, 0.12], position: [0, 0.2, 0.19], color: '#334837' },
    ],
  },
}

export const PROP_KINDS = Object.keys(PROP_SPECS) as Scene3DPropKind[]

export function propKindLabel(kind: Scene3DPropKind): string {
  return PROP_SPECS[kind].label
}

export function propDefaultColor(kind: Scene3DPropKind): string {
  return PROP_SPECS[kind].defaultColor
}

export function propGroundFootprint(kind: Scene3DPropKind): { width: number; depth: number } {
  return PROP_SPECS[kind].footprint
}

export function makePropObject(kind: Scene3DPropKind): Scene3DObject {
  return {
    id: createScene3DObjectId(),
    name: propKindLabel(kind),
    type: 'prop',
    visible: true,
    position: [0, 0, 0], // origin 在地面中心：y=0 即贴地
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
    color: propDefaultColor(kind),
    propKind: kind,
  }
}

// 语义道具摆位（AI 侧共享原语）：kind 必填，位置/朝向/缩放可选。站位工具与运镜工具共用同一份
// （P4 一套能力两入口，无并行版）。position 省略 → 沿主体右侧(+X)铺开，不与原点主体堆叠。
export type ScenePropPlacement = {
  kind: Scene3DPropKind
  position?: [number, number] // [x, z]，地面坐标
  rotationY?: number // 度
  scale?: number
}

const DEG_TO_RAD = Math.PI / 180

export function buildPlacedProps(props: ScenePropPlacement[] | undefined): Scene3DObject[] {
  if (!props || props.length === 0) return []
  const known = props.filter((prop) => (prop.kind as string) in PROP_SPECS)
  return known.map((prop, index) => {
    const object = makePropObject(prop.kind)
    const [x, z] = prop.position ?? [2.5 + index * 2.2, -0.5]
    object.position = [x, 0, z]
    if (typeof prop.rotationY === 'number' && Number.isFinite(prop.rotationY)) {
      object.rotation = [0, prop.rotationY * DEG_TO_RAD, 0]
    }
    if (typeof prop.scale === 'number' && Number.isFinite(prop.scale) && prop.scale > 0) {
      const s = Math.min(10, Math.max(0.1, prop.scale))
      object.scale = [s, s, s]
    }
    return object
  })
}

