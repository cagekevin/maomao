import { Suspense, memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { ContactShadows, Grid, OrbitControls, TransformControls } from '@react-three/drei'
import * as THREE from 'three'
import { StudioPerson, ImportedModel } from './models.jsx'
import { PrimitiveModel } from './primitives.jsx'
import { DepthMeshModel } from './depth.jsx'
import { CAMERA_ID, aspectValue, pathSamplePoints } from './project.js'
import SceneGizmo from './SceneGizmo.jsx'

const normalizeNum = value => (Number.isFinite(Number(value)) ? Number(value) : 0)

function sceneObjectIdFromIntersection(intersection) {
  let object = intersection?.object
  while (object && !object.userData?.sceneObjectId) object = object.parent
  return object?.userData?.sceneObjectId || null
}

function shouldKeepCurrentSelection(event, selectedId, selected, transformMode) {
  // 当前没有选中目标 → 允许点击选中任意物体
  if (!selected || !selectedId) return false
  // 已选中：非 select 模式（translate/rotate/scale）点击当前已选中的物体时保持选择，
  // 便于继续拖动/旋转；点击其它物体则允许切换选中。
  if (transformMode !== 'select') {
    return event.intersections?.some(intersection => sceneObjectIdFromIntersection(intersection) === selectedId) ?? false
  }
  if (event.altKey || event.nativeEvent?.altKey) return false
  return event.intersections?.some(intersection => sceneObjectIdFromIntersection(intersection) === selectedId)
}

function SceneObject({ data, selected, selectedId, activeJoint, transformMode, transformSpace = 'world', snapEnabled = true, groundRequest, onSelect, onUpdate, onJointSelect, animationTime = 0, preview = false }) {
  const groupRef = useRef(null)
  const objectRotateDrag = useRef(null)
  const scaleTransformStart = useRef(null)
  const appliedGroundRequest = useRef(null)
  const orbitControls = useThree(state => state.controls)
  const invalidate = useThree(state => state.invalidate)
  const scaleAxisLocks = Array.isArray(data.scaleAxisLocks) ? data.scaleAxisLocks : [false, false, false]
  const stateAnimationTime = Math.max(0, animationTime - (Number.isFinite(data.motionStartTime) ? data.motionStartTime : 0))
  useEffect(() => {
    if (!groundRequest || groundRequest.id !== data.id || !groupRef.current || data.locked || preview) return
    const requestKey = `${groundRequest.id}:${groundRequest.nonce}`
    if (appliedGroundRequest.current === requestKey) return
    const object = groupRef.current
    object.updateWorldMatrix(true, true)
    const bounds = new THREE.Box3().setFromObject(object)
    if (!Number.isFinite(bounds.min.y)) return
    appliedGroundRequest.current = requestKey
    object.position.y -= bounds.min.y
    onUpdate(data.id, { position: object.position.toArray() })
  }, [data.id, data.locked, groundRequest?.id, groundRequest?.nonce, onUpdate, preview])
  const syncTransform = useCallback(() => {
    const object = groupRef.current
    if (!object) return
    let nextScale = object.scale.toArray()
    if (transformMode === 'scale' && scaleTransformStart.current) {
      const baseline = scaleTransformStart.current
      const locks = Array.isArray(data.scaleAxisLocks) ? data.scaleAxisLocks : [false, false, false]
      if (data.proportionalScale) {
        const changedAxis = nextScale
          .map((value, axis) => ({ axis, change: locks[axis] ? -1 : Math.abs(value / Math.max(0.0001, baseline[axis]) - 1) }))
          .sort((left, right) => right.change - left.change)[0]
        const factor = changedAxis?.change > 0.00001 ? nextScale[changedAxis.axis] / Math.max(0.0001, baseline[changedAxis.axis]) : 1
        nextScale = baseline.map((value, axis) => locks[axis] ? value : Math.max(0.05, value * factor))
      } else nextScale = nextScale.map((value, axis) => locks[axis] ? baseline[axis] : Math.max(0.05, value))
      object.scale.fromArray(nextScale)
    }
    onUpdate(data.id, {
      position: object.position.toArray(),
      rotation: [object.rotation.x, object.rotation.y, object.rotation.z],
      scale: nextScale,
    })
  }, [data.id, data.proportionalScale, data.scaleAxisLocks, onUpdate, transformMode])
  const beginObjectInteraction = useCallback(event => {
    if (shouldKeepCurrentSelection(event, selectedId, selected, transformMode)) return
    event.stopPropagation()
    onSelect(data.id)
    if (data.locked) return
    if (!selected || transformMode !== 'rotate' || !groupRef.current) return
    event.nativeEvent?.stopImmediatePropagation?.()
    event.target?.setPointerCapture?.(event.pointerId)
    objectRotateDrag.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      rotation: [groupRef.current.rotation.x, groupRef.current.rotation.y, groupRef.current.rotation.z],
    }
    if (orbitControls) orbitControls.enabled = false
    document.body.style.cursor = 'grabbing'
  }, [data.id, data.locked, onSelect, orbitControls, selected, selectedId, transformMode])
  const rotateObjectFromSurface = useCallback(event => {
    const drag = objectRotateDrag.current
    const object = groupRef.current
    if (!drag || !object || event.pointerId !== drag.pointerId) return
    event.stopPropagation()
    const dx = event.clientX - drag.startX
    const dy = event.clientY - drag.startY
    const roll = Boolean(event.shiftKey || event.nativeEvent?.shiftKey)
    object.rotation.set(
      roll ? drag.rotation[0] : drag.rotation[0] + dy * 0.01,
      roll ? drag.rotation[1] : drag.rotation[1] + dx * 0.01,
      roll ? drag.rotation[2] + dx * 0.01 : drag.rotation[2],
    )
    // frameloop="demand"：表面旋转直接改 three 对象（不经 React 提交），需手动触发重绘
    invalidate()
  }, [invalidate])
  const endObjectInteraction = useCallback(event => {
    const drag = objectRotateDrag.current
    if (!drag || event.pointerId !== drag.pointerId) return
    event.stopPropagation()
    event.target?.releasePointerCapture?.(event.pointerId)
    objectRotateDrag.current = null
    if (orbitControls) orbitControls.enabled = true
    document.body.style.cursor = ''
    syncTransform()
  }, [orbitControls, syncTransform])
  useEffect(() => () => {
    if (objectRotateDrag.current) {
      document.body.style.cursor = ''
      if (orbitControls) orbitControls.enabled = true
    }
  }, [orbitControls])
  const content = (
    <group
      ref={groupRef}
      position={data.position}
      rotation={data.rotation}
      scale={data.scale}
      visible={data.visible !== false}
      userData={{ sceneObjectId: data.id }}
      onPointerDown={preview ? undefined : beginObjectInteraction}
      onPointerMove={preview ? undefined : rotateObjectFromSurface}
      onPointerUp={preview ? undefined : endObjectInteraction}
      onPointerCancel={preview ? undefined : endObjectInteraction}
    >
      {data.type === 'person' ? (
        <StudioPerson
          bodyType={data.bodyType}
          pose={data.pose}
          poseTime={data.poseTime}
          continuousMotion={data.continuousMotion}
          animationTime={stateAnimationTime}
          rigRoot={data.rigRoot}
          joints={data.joints}
          footLock={data.footLock}
          color={data.color}
          selected={selected}
          selectedJoint={activeJoint}
          showBoneGizmo={!preview && transformMode === 'select'}
          onSelectJoint={jointId => onJointSelect?.(data.id, jointId)}
          onRotateJoint={(jointId, rotation) => onUpdate(data.id, {
            joints: { ...data.joints, [jointId]: rotation },
          })}
          onRotateJoints={rotations => onUpdate(data.id, {
            joints: { ...data.joints, ...rotations },
          })}
          onSurfacePointerDown={beginObjectInteraction}
          onSurfacePointerMove={rotateObjectFromSurface}
          onSurfacePointerUp={endObjectInteraction}
        />
      ) : data.type === 'depthMesh' && data.depthMapUrl ? (
        <DepthMeshModel url={data.depthMapUrl} settings={data.depthSettings} color={data.color} selected={selected} />
      ) : data.type === 'model' && data.url ? (
        <Suspense fallback={<mesh position={[0, 0.5, 0]}><boxGeometry /><meshStandardMaterial color="#7f7b72" wireframe /></mesh>}><ImportedModel url={data.url} selected={selected} /></Suspense>
      ) : (
        <PrimitiveModel type={data.type} color={data.color || '#c7c2b7'} selected={selected} parts={data.parts} />
      )}
    </group>
  )

  return (
    <>
      {content}
      {selected && !data.locked && !preview && transformMode !== 'select' && (
        <TransformControls
          object={groupRef}
          mode={transformMode}
          space={transformSpace}
          size={0.8}
          showX={transformMode !== 'scale' || !scaleAxisLocks[0]}
          showY={transformMode !== 'scale' || !scaleAxisLocks[1]}
          showZ={transformMode !== 'scale' || !scaleAxisLocks[2]}
          translationSnap={snapEnabled ? 0.1 : null}
          rotationSnap={snapEnabled ? Math.PI / 36 : null}
          scaleSnap={snapEnabled ? 0.1 : null}
          onMouseDown={() => { if (transformMode === 'scale' && groupRef.current) scaleTransformStart.current = groupRef.current.scale.toArray() }}
          onObjectChange={syncTransform}
          onMouseUp={() => { syncTransform(); scaleTransformStart.current = null }}
        />
      )}
    </>
  )
}

// P2：静止对象（非持续动作人物）的动画时间不影响渲染；回调 props 约定语义稳定。
// 播放时这些对象的 data 引用不变，比较器让它们跳过逐帧重渲染，从而不再逐帧重建姿势/重放骨骼。
const sceneObjectNeedsAnimation = data => data?.type === 'person' && Boolean(data.continuousMotion)
function sceneObjectPropsEqual(prev, next) {
  if (prev.data !== next.data) return false
  if (prev.selected !== next.selected) return false
  if (prev.selectedId !== next.selectedId) return false
  if (prev.activeJoint !== next.activeJoint) return false
  if (prev.transformMode !== next.transformMode) return false
  if (prev.transformSpace !== next.transformSpace) return false
  if (prev.snapEnabled !== next.snapEnabled) return false
  if (prev.groundRequest !== next.groundRequest) return false
  if (prev.preview !== next.preview) return false
  if (sceneObjectNeedsAnimation(next.data) && prev.animationTime !== next.animationTime) return false
  return true
}
const MemoSceneObject = memo(SceneObject, sceneObjectPropsEqual)

// 摄像机取景框：一个以镜头为顶点、沿 -Z（相机朝向）张开的线框锥台。
// 锥台张开角度由真实焦距（垂直 FOV = 2·atan(12/focalLength)，24mm 传感器半高）与画幅比例共同决定，
// 因此无论「始终面对对象」把相机转到什么角度，这个黄色线框都忠实反映相机实际看向的方向与取景范围，
// 与 3D 相机机身朝向保持一致。
function CameraFrustum({ focalLength = 42, aspectRatio = '16:9', selected = false, length = 2.2, apexZ = -0.42 }) {
  const geometry = useMemo(() => {
    const focal = Math.max(8, Number(focalLength) || 42)
    const aspect = aspectValue(aspectRatio)
    // 相机传感器 36×24mm：垂直半视场角 = atan(12/focal)，水平半视场角 = atan(12/focal·aspect)
    const halfH = 12 / focal * length
    const halfW = halfH * aspect
    const zFar = apexZ - length
    const corners = [
      [-halfW, -halfH, zFar],
      [halfW, -halfH, zFar],
      [halfW, halfH, zFar],
      [-halfW, halfH, zFar],
    ]
    const positions = []
    // 顶点 → 四个角（4 条棱线）
    for (let i = 0; i < 4; i += 1) {
      positions.push(0, 0, apexZ, corners[i][0], corners[i][1], corners[i][2])
    }
    // 远端四条边（取景框）
    for (let i = 0; i < 4; i += 1) {
      const a = corners[i]
      const b = corners[(i + 1) % 4]
      positions.push(a[0], a[1], a[2], b[0], b[1], b[2])
    }
    const next = new THREE.BufferGeometry()
    next.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    return next
  }, [apexZ, aspectRatio, focalLength, length])
  useEffect(() => () => geometry.dispose(), [geometry])
  return (
    <lineSegments geometry={geometry} raycast={() => null}>
      <lineBasicMaterial color={selected ? '#eabf62' : '#8e8a80'} transparent opacity={selected ? 0.8 : 0.35} depthWrite={false} />
    </lineSegments>
  )
}

function CameraModel({ data, selected, selectedId, transformMode, transformSpace = 'world', snapEnabled = true, onSelect, onUpdate }) {
  const groupRef = useRef(null)
  // 相机朝向欧拉用 'YXZ'（先 yaw 后 pitch）：与 cameraRotationToward 的生成约定一致，
  // 保证「始终面向对象」/路径切线朝向在目标位于侧方/后方时也精确对准（'XYZ' 有象限歧义会偏）。
  const groupRotation = useMemo(() => new THREE.Euler(...data.rotation, 'YXZ'), [data.rotation])
  const syncTransform = useCallback(() => {
    if (!groupRef.current) return
    onUpdate({
      position: groupRef.current.position.toArray(),
      rotation: [groupRef.current.rotation.x, groupRef.current.rotation.y, groupRef.current.rotation.z],
    })
  }, [onUpdate])
  useLayoutEffect(() => {
    if (!groupRef.current) return
    groupRef.current.position.fromArray(data.position)
    groupRef.current.rotation.set(...data.rotation, 'YXZ')
  }, [data.position, data.rotation])
  const selectCamera = event => {
    if (shouldKeepCurrentSelection(event, selectedId, selected, transformMode)) return
    event.stopPropagation()
    onSelect(CAMERA_ID)
  }
  const rig = (
    <group ref={groupRef} position={data.position} rotation={groupRotation} userData={{ sceneObjectId: CAMERA_ID }} onPointerDown={selectCamera}>
      {/* 机身：简洁线框盒，与取景框同一套线框语言，选中时统一高亮为黄色。
          NOTE: 相机是辅助/工具对象，不参与阴影投射——线框 + castShadow 会在地面投出
          一个与透明线框不一致的「实心盒子阴影」，导致相机部件有的有影子有的没有。 */}
      <mesh>
        <boxGeometry args={[0.5, 0.32, 0.42]} />
        <meshBasicMaterial color={selected ? '#eabf62' : '#8e8a80'} wireframe transparent opacity={selected ? 0.85 : 0.42} depthWrite={false} />
      </mesh>
      {/* 镜头：实体圆筒，明确指示朝向（与取景框顶点衔接） */}
      <mesh position={[0, 0, -0.34]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.2, 0.26, 0.26, 20]} />
        <meshStandardMaterial color="#232322" roughness={0.4} metalness={0.5} />
      </mesh>
      {/* 传感器/中心标记：一个小实体点，标出相机锚点，便于对齐与移动 */}
      <mesh>
        <sphereGeometry args={[0.06, 12, 12]} />
        <meshBasicMaterial color={selected ? '#eabf62' : '#6b6a66'} />
      </mesh>
      <CameraFrustum focalLength={data.focalLength} aspectRatio={data.aspectRatio} selected={selected} />
    </group>
  )
  return (
    <>
      {rig}
      {selected && ['translate', 'rotate'].includes(transformMode) && (
        <TransformControls
          object={groupRef}
          mode={transformMode}
          space={transformSpace}
          size={0.8}
          translationSnap={snapEnabled ? 0.1 : null}
          rotationSnap={snapEnabled ? Math.PI / 36 : null}
          onObjectChange={syncTransform}
          onMouseUp={syncTransform}
        />
      )}
    </>
  )
}

const DEFAULT_STUDIO_LIGHTING = {
  ambientIntensity: 1.35,
  keyIntensity: 2.8,
  fillIntensity: 1.1,
  keyAzimuth: 39,
  keyElevation: 51,
  exposure: 0.9,
  ambientColor: '#f7f1e6',
  keyColor: '#fff6e8',
  fillColor: '#a9c2c6',
}

function StudioLights({ lighting = DEFAULT_STUDIO_LIGHTING }) {
  const azimuth = THREE.MathUtils.degToRad(lighting.keyAzimuth ?? DEFAULT_STUDIO_LIGHTING.keyAzimuth)
  const elevation = THREE.MathUtils.degToRad(lighting.keyElevation ?? DEFAULT_STUDIO_LIGHTING.keyElevation)
  const horizontal = Math.cos(elevation) * 10
  const height = Math.sin(elevation) * 10
  const keyPosition = [Math.sin(azimuth) * horizontal, height, Math.cos(azimuth) * horizontal]
  const fillPosition = [-keyPosition[0] * 0.85, Math.max(2.5, height * 0.42), -keyPosition[2] * 0.85]
  return (
    <>
      <hemisphereLight intensity={lighting.ambientIntensity ?? DEFAULT_STUDIO_LIGHTING.ambientIntensity} color={lighting.ambientColor || DEFAULT_STUDIO_LIGHTING.ambientColor} groundColor="#343536" />
      <directionalLight castShadow position={keyPosition} intensity={lighting.keyIntensity ?? DEFAULT_STUDIO_LIGHTING.keyIntensity} color={lighting.keyColor || DEFAULT_STUDIO_LIGHTING.keyColor} shadow-mapSize={[2048, 2048]} shadow-camera-left={-10} shadow-camera-right={10} shadow-camera-top={10} shadow-camera-bottom={-10} />
      <directionalLight position={fillPosition} intensity={lighting.fillIntensity ?? DEFAULT_STUDIO_LIGHTING.fillIntensity} color={lighting.fillColor || DEFAULT_STUDIO_LIGHTING.fillColor} />
    </>
  )
}

// 性能模式专用：近似 Blender/C4D 默认光的轻量两盏布光——主光（右前上）+ 弱补光（左后上），
// 均不投射阴影，光源数 2、无阴影贴图，开销远低于完整 StudioLights，但暗部不死黑、立体感自然。
function PerformanceLight({ lighting = DEFAULT_STUDIO_LIGHTING }) {
  const azimuth = THREE.MathUtils.degToRad(lighting.keyAzimuth ?? DEFAULT_STUDIO_LIGHTING.keyAzimuth)
  const elevation = THREE.MathUtils.degToRad(lighting.keyElevation ?? DEFAULT_STUDIO_LIGHTING.keyElevation)
  const horizontal = Math.cos(elevation) * 10
  const height = Math.sin(elevation) * 10
  const keyPosition = [Math.sin(azimuth) * horizontal, height, Math.cos(azimuth) * horizontal]
  return (
    <>
      <directionalLight position={keyPosition} intensity={(lighting.keyIntensity ?? DEFAULT_STUDIO_LIGHTING.keyIntensity) * 1.1} color={lighting.keyColor || DEFAULT_STUDIO_LIGHTING.keyColor} />
      <directionalLight position={[-keyPosition[0] * 0.9, Math.max(3, height * 0.5), -keyPosition[2] * 0.9]} intensity={0.8} color={lighting.fillColor || DEFAULT_STUDIO_LIGHTING.fillColor} />
    </>
  )
}

function RendererExposure({ value = DEFAULT_STUDIO_LIGHTING.exposure }) {
  const { gl } = useThree()
  useEffect(() => {
    gl.toneMappingExposure = value
  }, [gl, value])
  return null
}

function Ground({ showGrid = true, showSurface = true, plain = false, surfaceColor = null }) {
  const color = surfaceColor || (plain ? '#5a5a57' : '#4b4b48')
  // 无缝背景模式（surfaceColor 非空）：地面放大到远超相机 far（200），
  // 这样从任何地面以上的视角都看不到地面边缘，与天空在 horizon 处同色衔接。
  const size = surfaceColor ? 1200 : (plain ? 200 : 60)
  return (
    <>
      {showSurface && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.025, 0]} receiveShadow={!plain}>
          <planeGeometry args={[size, size]} />
          <meshStandardMaterial color={color} roughness={0.96} />
        </mesh>
      )}
      {showGrid && <Grid position={[0, 0.002, 0]} args={[30, 30]} cellSize={0.5} cellThickness={0.5} cellColor="#777771" sectionSize={5} sectionThickness={0.8} sectionColor="#555555" fadeDistance={24} fadeStrength={1} infiniteGrid />}
    </>
  )
}

function ViewFocusController({ request }) {
  const { camera, controls } = useThree()
  useEffect(() => {
    if (!request || !controls) return
    const target = new THREE.Vector3(...request.position)
    target.y += request.height || 0
    const direction = camera.position.clone().sub(controls.target).normalize()
    if (!Number.isFinite(direction.x) || direction.lengthSq() < 0.001) direction.set(1, 0.65, 1).normalize()
    controls.target.copy(target)
    camera.position.copy(target).addScaledVector(direction, request.distance || 5)
    controls.update()
  }, [camera, controls, request])
  return null
}

function EditorCameraReporter({ enabled, onChange }) {
  const { camera, controls } = useThree()
  useEffect(() => {
    if (!enabled || !controls || !onChange) return undefined
    let frame = 0
    const report = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => onChange({
        position: camera.position.toArray(),
        rotation: [camera.rotation.x, camera.rotation.y, camera.rotation.z],
        target: controls.target.toArray(),
      }))
    }
    controls.addEventListener('change', report)
    report()
    return () => {
      cancelAnimationFrame(frame)
      controls.removeEventListener('change', report)
    }
  }, [camera, controls, enabled, onChange])
  return null
}

// 曲线上加点（PS 钢笔式）：NDC 距离阈值 ≈ 屏幕 4-5%（600px 画布约 25px），太窄则曲线难命中
const CURVE_HOVER_THRESHOLD = 0.04
// pathSamplePoints 每段采样点数，与 PathEditor 中 pathSamplePoints(points, false, 12) 一致，用于定位插入段
const CURVE_SAMPLES = 12

// 「曲线上加点」自定义光标：深色圆底 + 金色加号，与 3D 导演台金色控制点（#ffd469）主题一致，
// 替代生硬的浏览器内置 copy 光标。热点在加号中心（12,12）。
const CURVE_ADD_CURSOR = `url("data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5" fill="rgba(28,27,24,0.88)" stroke="rgba(255,212,105,0.9)" stroke-width="1.4"/><path d="M12 7.8v8.4M7.8 12h8.4" stroke="#ffd469" stroke-width="1.9" stroke-linecap="round"/></svg>',
)}") 12 12, crosshair`

// 屏幕恒定尺寸控制点：相机拉远/拉近（OrbitControls dolly）时保持屏幕像素大小基本不变，便于选中。
// 原理：世界半径 ∝ 相机到点的距离（distance=10 基准 → 屏幕直径 ≈22px@600px 高画布），
// 每帧按距离补偿 scale；但远距离做封顶，避免相机拉太远时点被放得过大。悬停/拖动中再 ×1.4 高亮放大。
// 颜色 hover 时变亮金色。
const DOT_DIST_RATIO_CAP = 2 // 距离补偿封顶：distance>20(=10*2) 后点不再变大，避免拉远时点过大
function ScreenConstantDot({ point, radius = 0.07, hot = false, onPointerDown, onPointerOver, onPointerOut, onContextMenu }) {
  const ref = useRef()
  const { camera } = useThree()
  const worldPos = useMemo(() => new THREE.Vector3(), [])
  const hotRef = useRef(hot)
  hotRef.current = hot
  useFrame(() => {
    const mesh = ref.current
    if (!mesh) return
    const distance = camera.position.distanceTo(mesh.getWorldPosition(worldPos))
    // 基准 distance=10 时 scale=2.2（球半径 0.07 → 屏幕直径约 22px）；距离补偿封顶，拉远不会无限放大
    const ratio = Math.min(distance / 10, DOT_DIST_RATIO_CAP)
    mesh.scale.setScalar(ratio * 2.2 * (hotRef.current ? 1.4 : 1))
  })
  return (
    <mesh ref={ref} position={[point.x, point.y, point.z]}
      onPointerOver={onPointerOver} onPointerOut={onPointerOut}
      onPointerDown={onPointerDown} onContextMenu={onContextMenu}>
      <sphereGeometry args={[radius, 16, 16]} />
      <meshBasicMaterial color={hot ? '#ffd469' : '#bf9948'} depthTest={false} />
    </mesh>
  )
}

function PathEditor({ pathDraft, anchorY = 0, onPathChange, density = 'mid', drawing = false, onContextMenuAt }) {
  // 控制点抽稀间距：拖动超过该距离才新增一个点。档位越大点越少（曲线由平滑样条补齐，无需密点）
  const spacing = { dense: 0.6, mid: 1.4, sparse: 2.8 }[density] || 1.4
  const { camera, gl, invalidate } = useThree()
  const controls = useThree(state => state.controls)
  const [points, setPoints] = useState([])
  const activeMode = useRef(null) // null | 'draw' | grab 的索引
  const trailRef = useRef([]) // 绘制态进行中的笔画轨迹
  const [selectedDot, setSelectedDot] = useState(-1)
  const [hoveredDot, setHoveredDot] = useState(-1)
  const [curveHover, setCurveHover] = useState(false) // 鼠标是否落在曲线附近（可加点）

  // 光标反馈（PS 钢笔式）：绘制态 → 十字；拖动中 → 抓握手势；悬停控制点 → 抓取手势；
  // 落在曲线上 → 加号（可在此加点）；空白 → 十字。
  // 用 selectedDot（拖动中 ≥0）代理 activeMode ref，保证 state 变化能触发重新渲染。
  useEffect(() => {
    if (drawing || selectedDot >= 0) document.body.style.cursor = selectedDot >= 0 ? 'grabbing' : 'crosshair'
    else if (hoveredDot >= 0) document.body.style.cursor = 'grab'
    else if (curveHover) document.body.style.cursor = CURVE_ADD_CURSOR // 金色加号：点击可在曲线上加点
    else document.body.style.cursor = 'crosshair'
    return () => { document.body.style.cursor = '' }
  }, [drawing, hoveredDot, selectedDot, curveHover])

  const syncFromDraft = useCallback(() => {
    const list = (pathDraft?.points || []).map(p => ({ x: normalizeNum(p.x), y: anchorY, z: normalizeNum(p.z) }))
    trailRef.current = []
    setPoints(list)
  }, [pathDraft, anchorY])
  useEffect(() => { syncFromDraft() }, [syncFromDraft])

  // 屏幕坐标 → 水平面（y=anchorY）世界坐标
  const toWorld = useCallback((clientX, clientY) => {
    const rect = gl.domElement.getBoundingClientRect()
    const ndc = new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1,
    )
    const raycaster = new THREE.Raycaster()
    raycaster.setFromCamera(ndc, camera)
    const plane = new THREE.Plane()
    plane.setFromNormalAndCoplanarPoint(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, anchorY, 0))
    const hit = new THREE.Vector3()
    if (!raycaster.ray.intersectPlane(plane, hit)) return null
    return { x: hit.x, y: anchorY, z: hit.z }
  }, [anchorY, camera, gl])

  const beginDraw = useCallback(event => {
    event.stopPropagation()
    const point = toWorld(event.clientX, event.clientY)
    if (!point) return
    activeMode.current = 'draw'
    trailRef.current = [point]
    setPoints(trailRef.current)
    if (controls) controls.enabled = false
    invalidate()
  }, [controls, invalidate, toWorld])

  const beginGrab = useCallback((index, event) => {
    event.stopPropagation()
    activeMode.current = index
    setSelectedDot(index)
    if (controls) controls.enabled = false
    invalidate()
  }, [controls, invalidate])

  const handleMove = useCallback(event => {
    if (activeMode.current == null) return
    const point = toWorld(event.clientX, event.clientY)
    if (!point) return
    if (activeMode.current === 'draw') {
      const trail = trailRef.current
      const last = trail[trail.length - 1]
      const dx = point.x - last.x
      const dz = point.z - last.z
      if (Math.hypot(dx, dz) > spacing) trail.push(point)
      setPoints([...trail])
    } else {
      setPoints(list => list.map((item, index) => index === activeMode.current ? point : item))
    }
    invalidate()
  }, [invalidate, toWorld])

  const endInteraction = useCallback(() => {
    if (activeMode.current == null) return
    if (activeMode.current === 'draw') {
      const trail = trailRef.current
      if (trail.length >= 2) {
        setPoints(trail)
        onPathChange(trail.map(p => ({ x: p.x, y: p.y, z: p.z })))
      } else {
        setPoints([])
      }
      trailRef.current = []
    } else {
      setPoints(list => {
        onPathChange(list.map(p => ({ x: p.x, y: p.y, z: p.z })))
        return list
      })
      setSelectedDot(-1)
    }
    activeMode.current = null
    if (controls) controls.enabled = true
    invalidate()
  }, [controls, invalidate, onPathChange])

  useEffect(() => {
    if (activeMode.current == null) return undefined
    window.addEventListener('pointermove', handleMove)
    window.addEventListener('pointerup', endInteraction)
    return () => {
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerup', endInteraction)
    }
  }, [handleMove, endInteraction, activeMode.current]) // eslint-disable-line react-hooks/exhaustive-deps

  const curvePoints = useMemo(() => pathSamplePoints(points, false, 12), [points])
  const lineGeometry = useMemo(() => {
    const geometry = new THREE.BufferGeometry().setFromPoints(curvePoints.map(p => new THREE.Vector3(p.x, p.y, p.z)))
    return geometry
  }, [curvePoints])

  // PS 钢笔式「曲线上加点」：
  // - 曲线 hover 检测：把鼠标屏幕坐标与采样点集比 NDC 距离，命中阈值内视为「在曲线上」（光标变加号）
  // - 单击曲线 → 在鼠标处插入新控制点，插入位置按最近采样点所在段落到两个控制点之间
  const nearestOnCurve = useCallback((clientX, clientY) => {
    const rect = gl.domElement.getBoundingClientRect()
    const ndcX = ((clientX - rect.left) / rect.width) * 2 - 1
    const ndcY = -((clientY - rect.top) / rect.height) * 2 + 1
    const v = new THREE.Vector3()
    let best = Infinity
    let bestIndex = -1
    for (let i = 0; i < curvePoints.length; i += 1) {
      v.set(curvePoints[i].x, curvePoints[i].y, curvePoints[i].z).project(camera)
      const dx = v.x - ndcX
      const dy = v.y - ndcY
      const d = dx * dx + dy * dy
      if (d < best) { best = d; bestIndex = i }
    }
    return { dist: Math.sqrt(best), index: bestIndex }
  }, [camera, curvePoints, gl])

  const handleCurvePointerMove = useCallback(event => {
    if (activeMode.current !== null) return // 拖动/绘制中不切换加点提示
    const nearest = nearestOnCurve(event.clientX, event.clientY)
    setCurveHover(nearest.dist <= CURVE_HOVER_THRESHOLD)
  }, [nearestOnCurve])

  const insertPointOnCurve = useCallback(event => {
    event.stopPropagation()
    const point = toWorld(event.clientX, event.clientY)
    if (!point || curvePoints.length < 2) return
    const nearest = nearestOnCurve(event.clientX, event.clientY)
    if (nearest.dist > CURVE_HOVER_THRESHOLD) return
    const segment = Math.min(Math.floor(nearest.index / CURVE_SAMPLES), points.length - 2)
    setPoints(list => {
      const next = [...list.slice(0, segment + 1), point, ...list.slice(segment + 1)]
      onPathChange(next.map(p => ({ x: p.x, y: p.y, z: p.z })))
      return next
    })
    invalidate()
  }, [curvePoints, invalidate, nearestOnCurve, onPathChange, points.length, toWorld])

  const addPointOnDoubleClick = useCallback(event => {
    event.stopPropagation()
    const point = toWorld(event.clientX, event.clientY)
    if (!point) return
    setPoints(list => {
      const next = [...list, point]
      onPathChange(next.map(p => ({ x: p.x, y: p.y, z: p.z })))
      return next
    })
    invalidate()
  }, [invalidate, onPathChange, toWorld])

  const onRightClick = useCallback(event => {
    event.stopPropagation()
    event.preventDefault() // 屏蔽浏览器原生菜单，改用自己的「删除此点/删除整条曲线」菜单
    // 找到离光标最近的控制点，连同屏幕坐标上报给外层弹出「删除此点/删除整条」菜单
    const point = toWorld(event.clientX, event.clientY)
    let nearest = -1
    if (point && points.length) {
      let best = Infinity
      points.forEach((item, index) => {
        const d = (item.x - point.x) ** 2 + (item.z - point.z) ** 2
        if (d < best) { best = d; nearest = index }
      })
    }
    onContextMenuAt?.(nearest, event.clientX, event.clientY)
  }, [onContextMenuAt, points, toWorld])

  return (
    <group>
      {/* 交互平面：左键拖动画线仅限「绘制态」；编辑态鼠标落在曲线上 → 单击在该处加点（PS 钢笔式），
          pointermove 检测曲线 hover 切换加号光标；双击空白补点、右键菜单任何编辑态都可用 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, anchorY - 0.005, 0]}
        onPointerDown={event => {
          if (drawing) { beginDraw(event); return }
          const nearest = nearestOnCurve(event.clientX, event.clientY)
          if (nearest.dist <= CURVE_HOVER_THRESHOLD) insertPointOnCurve(event)
        }}
        onPointerMove={drawing ? undefined : handleCurvePointerMove}
        onDoubleClick={drawing ? undefined : addPointOnDoubleClick} onContextMenu={drawing ? undefined : onRightClick}>
        <planeGeometry args={[200, 200]} />
        <meshBasicMaterial visible={false} side={THREE.DoubleSide} transparent opacity={0} />
      </mesh>
      {/* 曲线本体 */}
      {curvePoints.length > 1 && (
        <line>
          <primitive object={lineGeometry} attach="geometry" />
          <lineBasicMaterial color="#d7675b" />
        </line>
      )}
      {/* 金色控制点（复用骨骼关节标记视觉：MixamoJointMarker）。屏幕恒定大小（缩放不缩）；
          悬停/拖动 → 高亮放大 + 抓取光标提示可拖；单击即抓住进入编辑态，按住左键拖拽微调；
          双击请落在空白处补点；右键弹「删除此点/删除整条曲线」菜单 */}
      {points.map((point, index) => {
        const hot = index === hoveredDot || index === selectedDot // 悬停或拖动中的点高亮放大
        return (
          <ScreenConstantDot key={index} point={point} hot={hot}
            onPointerOver={event => { event.stopPropagation(); setHoveredDot(index) }}
            onPointerOut={() => setHoveredDot(-1)}
            onPointerDown={event => beginGrab(index, event)}
            onContextMenu={drawing ? undefined : onRightClick} />
        )
      })}
    </group>
  )
}

function EditorScene({ objects, selectedId, activeJoint, onSelect, onJointSelect, transformMode, transformSpace, snapEnabled, groundRequest, onUpdateObject, cameraData, cameraAspect, onUpdateCamera, editorCameraData, onEditorCameraChange, lighting, showGrid, performanceMode = false, focusRequest, referenceVisible = false, cameraView = false, animationTime = 0, onGizmoReady, pathEditing = false, pathDrawing = false, pathDraft = null, pathAnchorY = 0, pathDensity = 'mid', onPathChange, onContextMenuAt, seamlessBackground = false }) {
  return (
    <>
      {!referenceVisible && (seamlessBackground ? <color attach="background" args={['#555653']} /> : <color attach="background" args={['#4b4b48']} />)}
      {!performanceMode && seamlessBackground && <fog attach="fog" args={['#555653', 18, 42]} />}
      <RendererExposure value={lighting?.exposure} />
      {performanceMode ? (
        <PerformanceLight lighting={lighting} />
      ) : (
        <StudioLights lighting={lighting} />
      )}
      <Ground showGrid={showGrid} showSurface={!referenceVisible} plain={performanceMode} surfaceColor={seamlessBackground ? null : '#4b4b48'} />
      {objects.map(object => <MemoSceneObject key={object.id} data={object} selected={selectedId === object.id} selectedId={selectedId} activeJoint={activeJoint} transformMode={transformMode} transformSpace={transformSpace} snapEnabled={snapEnabled} groundRequest={groundRequest} onSelect={onSelect} onJointSelect={onJointSelect} onUpdate={onUpdateObject} animationTime={animationTime} />)}
      {!cameraView && <CameraModel data={cameraData} selected={selectedId === CAMERA_ID} selectedId={selectedId} transformMode={transformMode} transformSpace={transformSpace} snapEnabled={snapEnabled} onSelect={onSelect} onUpdate={onUpdateCamera} />}
      {pathEditing && !cameraView && <PathEditor pathDraft={pathDraft} anchorY={pathAnchorY} density={pathDensity} drawing={pathDrawing} onPathChange={onPathChange} onContextMenuAt={onContextMenuAt} />}
      {!performanceMode && <ContactShadows position={[0, 0.01, 0]} opacity={0.42} scale={18} blur={2.4} far={9} />}
      {cameraView ? <PreviewCameraController cameraData={cameraData} cameraAspect={cameraAspect} /> : <OrbitControls makeDefault target={editorCameraData?.target || [0, 1, 0]} minDistance={2} maxDistance={35} maxPolarAngle={Math.PI} />}
      <EditorCameraReporter enabled={!cameraView} onChange={onEditorCameraChange} />
      {!cameraView && <ViewFocusController request={focusRequest} />}
      {!cameraView && !performanceMode && <SceneGizmo onReady={onGizmoReady} />}
    </>
  )
}

function PreviewCameraController({ cameraData, cameraAspect }) {
  const { camera, size } = useThree()
  useFrame(() => {
    camera.position.fromArray(cameraData.position)
    // 'YXZ'（先 yaw 后 pitch）：与 cameraRotationToward 的生成约定一致，目标在侧方/后方也精确对准
    camera.rotation.set(...cameraData.rotation, 'YXZ')
    const fov = THREE.MathUtils.radToDeg(2 * Math.atan(24 / (2 * cameraData.focalLength)))
    const nextAspect = Number.isFinite(cameraAspect) && cameraAspect > 0 ? cameraAspect : size.width / Math.max(1, size.height)
    if (Math.abs(camera.fov - fov) > 0.01 || Math.abs(camera.aspect - nextAspect) > 0.0001) {
      camera.fov = fov
      camera.aspect = nextAspect
      camera.updateProjectionMatrix()
    }
  })
  return null
}

function CanvasBackground({ canvas }) {
  const texture = useMemo(() => {
    if (!canvas) return null
    const next = new THREE.CanvasTexture(canvas)
    next.colorSpace = THREE.SRGBColorSpace
    next.needsUpdate = true
    return next
  }, [canvas])
  useEffect(() => () => texture?.dispose(), [texture])
  return texture ? <primitive attach="background" object={texture} /> : <color attach="background" args={['#9b9c98']} />
}

function PreviewScene({ objects, cameraData, cameraAspect, lighting, backgroundCanvas = null, animationTime = 0, performanceMode = false, lightweight = false, seamlessBackground = false }) {
  return (
    <>
      {backgroundCanvas ? <CanvasBackground canvas={backgroundCanvas} /> : seamlessBackground ? <color attach="background" args={['#9b9c98']} /> : <color attach="background" args={['#4b4b48']} />}
      {!performanceMode && seamlessBackground && <fog attach="fog" args={['#9b9c98', 18, 38]} />}
      <RendererExposure value={lighting?.exposure} />
      {performanceMode ? (
        <PerformanceLight lighting={lighting} />
      ) : (
        <StudioLights lighting={lighting} />
      )}
      <Ground showGrid={false} showSurface={!backgroundCanvas} plain={performanceMode} surfaceColor={seamlessBackground || backgroundCanvas ? null : '#4b4b48'} />
      {objects.map(object => <MemoSceneObject key={object.id} data={object} animationTime={animationTime} preview />)}
      {!performanceMode && !lightweight && <ContactShadows position={[0, 0.01, 0]} opacity={0.35} scale={18} blur={2.2} far={9} />}
      <PreviewCameraController cameraData={cameraData} cameraAspect={cameraAspect} />
    </>
  )
}

export function MainViewport(props) {
  const editorCamera = props.editorCameraData || {}
  // 摄像机视角的初始相机朝向用 'YXZ'：与 cameraRotationToward 生成约定一致（见 PreviewCameraController）
  const shotCameraRotation = useMemo(() => new THREE.Euler(...(props.cameraData.rotation || [0, 0, 0]), 'YXZ'), [props.cameraData.rotation])
  const cameraSettings = props.cameraView
    ? { position: props.cameraData.position, rotation: shotCameraRotation, fov: 42, near: 0.05, far: 200 }
    : {
        position: editorCamera.position || [8.5, 6.4, 9.5],
        ...(editorCamera.rotation ? { rotation: editorCamera.rotation } : {}),
        fov: 42,
        near: 0.05,
        far: 200,
      }
  return (
    <Canvas
      shadows={props.performanceMode ? false : 'basic'}
      dpr={props.performanceMode ? 1 : [1, 1.75]}
      frameloop="demand"
      camera={cameraSettings}
      onPointerMissed={() => props.onSelect(null)}
      gl={{ alpha: true, antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 0.88 }}
    >
      <EditorScene {...props} />
    </Canvas>
  )
}

export function CameraPreview({ objects, cameraData, cameraAspect, lighting, backgroundCanvas = null, animationTime = 0, onCanvasReady, exportMode = false, performanceMode = false, seamlessBackground = false }) {
  // 监视器小窗（非导出）始终轻量渲染：dpr=1、无阴影、无接触阴影、无抗锯齿，静止时零渲染；
  // 导出画布（exportMode）保持最终画质（阴影取决于性能模式）。两者都按需渲染 frameloop="demand"。
  const lightweight = !exportMode
  return (
    <Canvas
      shadows={!lightweight && !performanceMode ? 'basic' : false}
      dpr={1}
      frameloop="demand"
      camera={{ position: cameraData.position, fov: 40, aspect: cameraAspect, near: 0.05, far: 200 }}
      gl={{ antialias: !lightweight, preserveDrawingBuffer: exportMode || Boolean(onCanvasReady), toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 0.9 }}
      onCreated={({ gl }) => onCanvasReady?.(gl.domElement)}
    >
      <PreviewScene objects={objects} cameraData={cameraData} cameraAspect={cameraAspect} lighting={lighting} performanceMode={performanceMode} lightweight={lightweight} backgroundCanvas={backgroundCanvas} animationTime={animationTime} seamlessBackground={seamlessBackground} />
    </Canvas>
  )
}
