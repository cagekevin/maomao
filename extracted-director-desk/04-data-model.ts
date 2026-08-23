// 3D 导演台 · 核心数据模型（提取）
// 来源：Nomi `scene3d/scene3dTypes.ts`
// 用途：导演台持久化状态的结构。重构时可整体复用此类型。

export type Scene3DVector3 = [number, number, number]

export type Scene3DTransformMode = 'translate' | 'rotate' | 'scale'
export type Scene3DControlMode = 'edit' | 'fly'
export type Scene3DObjectType = 'mesh' | 'model' | 'light' | 'group' | 'mannequin' | 'mannequinCrowd' | 'prop'

// 语义道具（灰模摆场件）。spec 数据在 scene3dPropSpecs.ts。
export type Scene3DPropKind =
  | 'car' | 'building' | 'tree' | 'streetlamp' | 'wall'
  | 'suv' | 'bus' | 'bicycle' | 'scooter'
  | 'sofa' | 'diningTable' | 'fridge' | 'washingMachine' | 'trashBins'
  | 'atm' | 'backpack'

export type Scene3DGeometry = 'box' | 'sphere' | 'cylinder' | 'plane'
export type Scene3DLightType = 'point' | 'directional' | 'spot'
export type Scene3DAspectRatio = '16:9' | '9:16' | '4:3' | '3:4' | '1:1' | '2.39:1'
export type Scene3DTrajectoryDirection = 'forward' | 'reverse'

export type Scene3DObject = {
  id: string
  name: string
  type: Scene3DObjectType
  visible: boolean
  position: Scene3DVector3
  rotation: Scene3DVector3
  scale: Scene3DVector3
  parentId?: string
  color?: string
  geometry?: Scene3DGeometry
  // type='prop' 时的道具种类；origin 在地面中心（y=0 即贴地）。
  propKind?: Scene3DPropKind
  modelUrl?: string
  lightType?: Scene3DLightType
  lightColor?: string
  lightIntensity?: number
  crowdRows?: number
  crowdColumns?: number
  crowdSpacing?: number
  pose?: Record<string, Scene3DVector3>
  // 动作随时间变化的轨道（录 take 用）。time 为绝对场景时间轴秒，与 trajectoryBinding.startTime 同一时钟。
  poseTrack?: Scene3DPoseKeyframe[]
  // 被操控角色「确定性迈腿」locomotion clip 名（如 'walk'）。
  locomotionClip?: string
  children?: string[]
  // 场景模板一键铺出的对象带组标（如「城市街道」）：场景树按组折叠。
  templateGroup?: string
}

// pose-over-time 单帧：在时刻 time 把该假人切到 pose。
export type Scene3DPoseKeyframe = {
  time: number
  presetId?: string
  pose?: Record<string, Scene3DVector3>
}

export type Scene3DCamera = {
  id: string
  name: string
  visible: boolean
  position: Scene3DVector3
  rotation: Scene3DVector3
  target: Scene3DVector3
  followTargetId?: string
  // 相机运镜 take：相机注视点随时间走的「瞄准轨迹」id。
  aimTrajectoryId?: string
  fov: number
  aspectRatio: Scene3DAspectRatio
  lensDepth: number
  near: number
  far: number
  // 手持抖动强度 0-100。
  shakeAmplitude?: number
  // 'auto' = 系统按主体安全画幅自动取景；'manual' = 用户手动接管。
  framing?: 'auto' | 'manual'
}

export type Scene3DTrajectoryPoint = {
  id: string
  position: Scene3DVector3
  timeRatio?: number
}

export type Scene3DTrajectoryCurveControl = {
  segmentStartPointId: string
  position: Scene3DVector3
}

export type Scene3DTrajectory = {
  id: string
  name: string
  points: Scene3DTrajectoryPoint[]
  curveControls?: Scene3DTrajectoryCurveControl[]
  tension: number
  closed: boolean
  color: string
}

export type Scene3DTrajectoryBoundObject = {
  objectId: string
  offsetRatio: number
}

export type Scene3DTrajectoryBinding = {
  id: string
  trajectoryId: string
  objects: Scene3DTrajectoryBoundObject[]
  startTime: number
  endTime: number
  direction: Scene3DTrajectoryDirection
  // FOV 随段进度线性渐变（变焦推/拉）。两者都缺省 = 用相机静态 fov。
  fovFrom?: number
  fovTo?: number
}

export type Scene3DTrajectoryGroup = {
  id: string
  name: string
  trajectoryIds: string[]
}

export type Scene3DTimeline = {
  totalDuration: number
}

export type Scene3DEnvironmentMode = 'panorama' | 'sphere'

export type Scene3DState = {
  objects: Scene3DObject[]
  cameras: Scene3DCamera[]
  trajectories: Scene3DTrajectory[]
  trajectoryBindings: Scene3DTrajectoryBinding[]
  trajectoryGroups: Scene3DTrajectoryGroup[]
  sceneTimeline: Scene3DTimeline
  environment: {
    preset: string
    showGrid: boolean
    showAxes: boolean
    showSky: boolean
    darkMode: boolean
    backgroundColor: string
    panoramaUrl?: string
    panoramaFileName?: string
    panoramaRotation: number
    environmentMode: Scene3DEnvironmentMode
    sphereRadius: number
  }
  editorCamera: {
    position: Scene3DVector3
    target: Scene3DVector3
    rotation: Scene3DVector3
    mode: Scene3DControlMode
  }
  lastThumbnail?: string
}

export type Scene3DSelection =
  | { type: 'object'; id: string }
  | { type: 'camera'; id: string }
  | null

export type Scene3DCaptureResult = {
  dataUrl: string
  width: number
  height: number
  title: string
  source: 'scene3d-viewport' | 'scene3d-camera'
}

export type CaptureApi = {
  captureViewport: () => Scene3DCaptureResult | null
  captureCamera: (camera: Scene3DCamera) => Scene3DCaptureResult | null
}

export const SCENE3D_ASPECT_RATIOS: Record<Scene3DAspectRatio, number> = {
  '16:9': 16 / 9,
  '9:16': 9 / 16,
  '4:3': 4 / 3,
  '3:4': 3 / 4,
  '1:1': 1,
  '2.39:1': 2.39, // 宽银幕 cinemascope
}

export const SCENE3D_ASPECT_OPTIONS = Object.keys(SCENE3D_ASPECT_RATIOS) as Scene3DAspectRatio[]

// 时间线默认时长（scene3dTimeline.ts）：10s
export const DEFAULT_SCENE_TIMELINE_DURATION = 10
