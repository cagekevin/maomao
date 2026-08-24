import { Suspense, memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { ContactShadows, Grid, OrbitControls, TransformControls } from '@react-three/drei'
import * as THREE from 'three'
import { StudioPerson, ImportedModel } from './models.jsx'
import { PrimitiveModel } from './primitives.jsx'
import { DepthMeshModel } from './depth.jsx'
import { CAMERA_ID, aspectValue } from './project.js'

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
            joints: { ...(data.joints || {}), [jointId]: rotation },
          })}
          onRotateJoints={rotations => onUpdate(data.id, {
            joints: { ...(data.joints || {}), ...rotations },
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
    groupRef.current.rotation.set(...data.rotation, 'XYZ')
  }, [data.position, data.rotation])
  const selectCamera = event => {
    if (shouldKeepCurrentSelection(event, selectedId, selected, transformMode)) return
    event.stopPropagation()
    onSelect(CAMERA_ID)
  }
  const rig = (
    <group ref={groupRef} position={data.position} rotation={data.rotation} userData={{ sceneObjectId: CAMERA_ID }} onPointerDown={selectCamera}>
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

function RendererExposure({ value = DEFAULT_STUDIO_LIGHTING.exposure }) {
  const { gl } = useThree()
  useEffect(() => {
    gl.toneMappingExposure = value
  }, [gl, value])
  return null
}

function Ground({ showGrid = true, showSurface = true, plain = false }) {
  return (
    <>
      {showSurface && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.025, 0]} receiveShadow={!plain}>
          <planeGeometry args={[plain ? 200 : 60, plain ? 200 : 60]} />
          <meshStandardMaterial color={plain ? '#5a5a57' : '#4b4b48'} roughness={0.96} />
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

function EditorScene({ objects, selectedId, activeJoint, onSelect, onJointSelect, transformMode, transformSpace, snapEnabled, groundRequest, onUpdateObject, cameraData, cameraAspect, onUpdateCamera, editorCameraData, onEditorCameraChange, lighting, showGrid, performanceMode = false, focusRequest, referenceVisible = false, cameraView = false, animationTime = 0 }) {
  return (
    <>
      {!referenceVisible && <color attach="background" args={['#555653']} />}
      {!performanceMode && <fog attach="fog" args={['#555653', 18, 42]} />}
      <RendererExposure value={lighting?.exposure} />
      {performanceMode ? (
        <ambientLight intensity={1.5} color="#ffffff" />
      ) : (
        <StudioLights lighting={lighting} />
      )}
      <Ground showGrid={showGrid} showSurface={!referenceVisible} plain={performanceMode} />
      {objects.map(object => <MemoSceneObject key={object.id} data={object} selected={selectedId === object.id} selectedId={selectedId} activeJoint={activeJoint} transformMode={transformMode} transformSpace={transformSpace} snapEnabled={snapEnabled} groundRequest={groundRequest} onSelect={onSelect} onJointSelect={onJointSelect} onUpdate={onUpdateObject} animationTime={animationTime} />)}
      {!cameraView && <CameraModel data={cameraData} selected={selectedId === CAMERA_ID} selectedId={selectedId} transformMode={transformMode} transformSpace={transformSpace} snapEnabled={snapEnabled} onSelect={onSelect} onUpdate={onUpdateCamera} />}
      {!performanceMode && <ContactShadows position={[0, 0.01, 0]} opacity={0.42} scale={18} blur={2.4} far={9} />}
      {cameraView ? <PreviewCameraController cameraData={cameraData} cameraAspect={cameraAspect} /> : <OrbitControls makeDefault target={editorCameraData?.target || [0, 1, 0]} minDistance={2} maxDistance={35} maxPolarAngle={Math.PI * 0.49} />}
      <EditorCameraReporter enabled={!cameraView} onChange={onEditorCameraChange} />
      {!cameraView && <ViewFocusController request={focusRequest} />}
    </>
  )
}

function PreviewCameraController({ cameraData, cameraAspect }) {
  const { camera, size } = useThree()
  useFrame(() => {
    camera.position.fromArray(cameraData.position)
    camera.rotation.set(...cameraData.rotation, 'XYZ')
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

function PreviewScene({ objects, cameraData, cameraAspect, lighting, backgroundCanvas = null, animationTime = 0, performanceMode = false, lightweight = false }) {
  return (
    <>
      <CanvasBackground canvas={backgroundCanvas} />
      {!performanceMode && <fog attach="fog" args={['#9b9c98', 18, 38]} />}
      <RendererExposure value={lighting?.exposure} />
      {performanceMode ? (
        <ambientLight intensity={1.5} color="#ffffff" />
      ) : (
        <StudioLights lighting={lighting} />
      )}
      <Ground showGrid={false} showSurface={!backgroundCanvas} plain={performanceMode} />
      {objects.map(object => <MemoSceneObject key={object.id} data={object} animationTime={animationTime} preview />)}
      {!performanceMode && !lightweight && <ContactShadows position={[0, 0.01, 0]} opacity={0.35} scale={18} blur={2.2} far={9} />}
      <PreviewCameraController cameraData={cameraData} cameraAspect={cameraAspect} />
    </>
  )
}

export function MainViewport(props) {
  const editorCamera = props.editorCameraData || {}
  const cameraSettings = props.cameraView
    ? { position: props.cameraData.position, rotation: props.cameraData.rotation, fov: 42, near: 0.05, far: 200 }
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
      dpr={[1, 1.75]}
      frameloop="demand"
      camera={cameraSettings}
      onPointerMissed={() => props.onSelect(null)}
      gl={{ alpha: true, antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 0.88 }}
    >
      <EditorScene {...props} />
    </Canvas>
  )
}

export function CameraPreview({ objects, cameraData, cameraAspect, lighting, backgroundCanvas = null, animationTime = 0, onCanvasReady, exportMode = false, performanceMode = false }) {
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
      <PreviewScene objects={objects} cameraData={cameraData} cameraAspect={cameraAspect} lighting={lighting} performanceMode={performanceMode} lightweight={lightweight} backgroundCanvas={backgroundCanvas} animationTime={animationTime} />
    </Canvas>
  )
}
