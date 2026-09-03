/*
 * ============================================================================
 * 3D 导演台关键帧系统 · 扩展指南
 * 如何给「新增的功能/属性」加上关键帧记录能力
 * ============================================================================
 *
 * 一、两条关键帧轨道
 * ----------------------------------------------------------------------------
 * 1) 摄像机轨道  keyframes（全局单条轨道）
 *    关键帧对象形状：
 *      { frame, interpolation, position: [x,y,z], rotation: [x,y,z], focalLength }
 *    录制：本文件 addKeyframe()
 *    插值：project.js 的 cameraAtFrame()
 *    应用：animatedCamera -> displayCamera -> Viewport.jsx 的 PreviewCameraController
 *          （后者每帧把 position/rotation/fov 写到 three 相机上）
 *
 * 2) 物体轨道  characterKeyframes[objectId]（每个物体一条轨道）
 *    关键帧对象形状（由 project.js 的 objectKeyframeFromObject() 生成）：
 *      { frame, interpolation, position, rotation, scale, pose, poseTime,
 *        continuousMotion, rigRoot, joints }
 *    录制：本文件 addObjectKeyframe()（内部调用 objectKeyframeFromObject）
 *    插值：project.js 的 objectAtFrame()
 *    应用：animatedObjects -> Viewport.jsx 的 MemoSceneObject / SceneObject
 *
 * 二、可动画属性的五段管线
 * ----------------------------------------------------------------------------
 * 数据模型(project.js) -> 录制(本文件 + project.js) -> 插值(project.js)
 * -> 求值(本文件) -> 应用(Viewport.jsx 消费组件)
 *
 * 三、逐步做法（以「给物体新增一个可记录关键帧的字段 X」为例）
 * ----------------------------------------------------------------------------
 * ① 数据模型（project.js）
 *    - 在 initialObjects / initialCamera 里给 X 一个默认值；
 *    - 在归一化入口补上 X（物体走 normalizePerson()，相机走 normalizeCamera()，
 *      整个工程入口是 normalizeProjectData() -> normalizeShot()）。
 *      这一步保证旧工程/旧镜头加载时不缺字段、不出现 undefined 泄漏到插值。
 *
 * ② 录制（写关键帧时把「当前值」快照进关键帧）
 *    - 物体：在 project.js 的 objectKeyframeFromObject(object, frame) 返回对象里加 x: object.x；
 *    - 摄像机：在本文件 addKeyframe() 的 next 对象里加 x: camera.x。
 *    这样点「记录关键帧」时当前值就被写进关键帧，拖动播放头时会重新插值出来。
 *
 * ③ 插值（project.js）
 *    - cameraAtFrame()：插值分支的 return 里加 x: lerp(left.x, right.x, t)（数字型字段）。
 *      精确帧/越界分支因为直接 spread 关键帧对象，会自动带上 X，无需改动。
 *    - objectAtFrame()：在 applyKey() 和插值 return 里同样补 X。
 *      · 数字型字段：用 lerp 线性插值；
 *      · 离散值（字符串/布尔，如 pose、continuousMotion）：参考 objectAtFrame 里
 *        pose / sameState 的做法，取最近/左关键帧的值，不要 lerp。
 *
 * ④ 求值（本文件）
 *    - 物体动画后的对象在 animatedObjects，相机动画后的对象在 animatedCamera /
 *      displayCamera。任何消费端（面板展示、导出）从这里读 X 的当前值即可。
 *
 * ⑤ 应用（Viewport.jsx 消费组件）
 *    - 相机：在 PreviewCameraController 里把 X 应用到相机；
 *    - 物体：在 MemoSceneObject / SceneObject 里把 X 应用到 3D 对象。
 *    注意 SceneObject 做了 memo + 自定义比较器，只比较 data 引用，新字段放进
 *    data 里即可（静止对象不逐帧重算，播放时跟随）。
 *
 * ⑥ UI（Inspector / 各面板）
 *    - 在对应面板加一个控件，通过 onUpdateObject / onUpdateCamera 写当前值。
 *      关键帧录的就是这个「当前值」，所以面板与录制共用同一份数据。
 *
 * 四、摄像机轨道特别提醒（重要，容易踩坑）
 * ----------------------------------------------------------------------------
 * 播放 / 拖动播放头 / 暂停 / 播放到末尾 / 导出恢复时，会通过本文件的
 * setCameraAtFrame() 把 cameraAtFrame 的插值结果写回 camera state。
 * cameraAtFrame 只返回关键帧变换字段，所以 setCameraAtFrame 必须显式保留
 * 「非关键帧、但属于摄像机持久化配置」的字段（目前是 targetMode / targetId，
 * 即「始终面向对象」的配置），否则一播放就会被冲掉、朝向失效。
 *
 *   规则：
 *   - 新属性「本身要随关键帧插值」（新的数值字段）-> 放进 cameraAtFrame 即可，
 *     不要动 setCameraAtFrame；
 *   - 新属性是「摄像机持久化配置」（类似 targetMode）-> 必须在 setCameraAtFrame
 *     和导出恢复用的 originalCamera 两处都保留合并，否则播放后丢失。
 *
 * 五、纪律与坑
 * ----------------------------------------------------------------------------
 * - 关键帧数组必须不可变更新：filter + spread + sort((a,b)=>a.frame-b.frame)，
 *   禁止原地 mutate（撤销/自动保存依赖引用变化）。
 * - 录制快照的字段形状与插值输出的字段形状必须一致，否则出现「记录不上」或
 *   「播放不跟随」。
 * - 新增字段必须进归一化（normalizePerson / normalizeCamera），向后兼容旧工程。
 * - 撤销 / 重做 / 自动保存是自动的：currentProject（projectData）已经包含
 *   objects / camera / keyframes / objectKeyframes，只要新字段放进这些 state
 *   （而不是孤立的 useState），历史与持久化就自动覆盖它，无需额外接线。
 * - 时间轴（panels/Timeline.jsx）按轨道泛化渲染：新字段默认不需要改时间轴代码；
 *   只有想让它在时间轴上显示为独立行时才需要扩展。
 * ============================================================================
 */

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle, Axis3D, BoxSelect, Camera, CheckCircle2, ChevronLeft, ChevronRight, Download, FileImage, FileVideo2,
  FolderOpen, ImagePlus, Info, Magnet, Maximize2, Minimize2, Minus, MousePointer2, Move3D, PenLine, Redo2,
  RotateCw, Save, SlidersHorizontal, Trash2, Undo2, Video, X, XCircle, ZoomIn,
} from 'lucide-react'
import { MainViewport, CameraPreview } from './Viewport.tsx'
import { measureModelScale } from './models.tsx'
import { AssetMenu } from './panels/AssetMenu.tsx'
import { cloneJointPose, normalizePoseId, poseForObject, presetJoints, presetPhase, presetRoot } from './rig.ts'
import {
  CAMERA_ID, CUSTOM_POSE_STORAGE_KEY, DEFAULT_LIGHTING, DEFAULT_PATH_SETTINGS, DEFAULT_PROJECT_SETTINGS, DEFAULT_REFERENCE,
  PROJECT_STORAGE_KEY, aspectLabel, aspectValue, bakePathKeyframes, cameraAtFrame, cameraRotationToward, clamp, cloneProjectValue,
  createEmptyPath, countChannelKeyframes, defaultShotName, exportDimensionsForAspect, initialCamera, initialCharacterKeyframes,
  initialKeyframes, initialObjects, keyframeMaxFrame, normalizeCameraPath, normalizeFrameNumber,
  normalizeInterpolation, normalizeLighting, normalizeProjectData, normalizeProjectSettings,
  normalizeReference, objectAtFrame, objectKeyframeFromObject, objectsAtFrame, pathActive, pathPositionAtFraction, pathTangentAtFraction, projectData,
  readCachedProject, readCustomPoses, referenceCanvasForExport, referenceImageFromFile,
  snapshotKeysForTrack,
  timecodeAtFrame, uid, uniqueShotName, visualCenterForObject,
} from './project.ts'
import type { ChannelKey, ChannelTracks } from './project.ts'
import {
  bakeCameraPath, bakeObjectPath, clearObjectTrack, duplicateObjectTrack,
  moveCameraFrame, moveCameraFrames, moveObjectFrame, moveObjectFrames, removeCameraFrames, removeObjectFrames,
  setCameraInterpolation, setObjectInterpolation, upsertCameraSnapshot, upsertObjectSnapshot,
} from './tracks.ts'
import { ToolButton } from './panels/controls.tsx'
import { LeftSidebar } from './panels/Sidebar.tsx'
import { Inspector } from './panels/Inspector.tsx'
import { CameraAnglePanel } from './panels/CameraAnglePanel.tsx'
import { Timeline } from './panels/Timeline.tsx'
import { ReferenceOverlay } from './panels/ReferenceOverlay.tsx'
import { consumeDefer, createHistoryState, flushChange, HISTORY_DEBOUNCE_MS, recordChange, redoPeek, resetHistory, undoPeek } from './history.ts'
import { log } from './log.ts'
import { writeJson } from './storage.ts'
import { hydrateProject } from './d3dPersistence.ts'
import { useToast } from './useToast.ts'
import { thumbnailFromCanvas } from './thumbnails.ts'
import { useConfirm } from './ConfirmDialog.tsx'

const nextPaint = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))

// Toast 四档状态图标（对齐 maomao 统一通知：success 绿 / error 红 / warning 黄 / info 蓝）
const TOAST_ICONS = {
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  error: XCircle,
}

// P1：面板类组件的回调 props（onXxx）约定为语义稳定，比较时忽略；仅当数据 props 变化才重渲染，
// 避免播放时 currentFrame 逐帧更新连带重算这些不依赖时间轴的面板（时间轴本身依赖 currentFrame，不在此列）。
const ignoreCallbackProps = (prev, next) => {
  const keys = new Set([...Object.keys(prev), ...Object.keys(next)])
  for (const key of keys) {
    if (key.startsWith('on')) continue
    if (prev[key] !== next[key]) return false
  }
  return true
}
const MemoLeftSidebar = memo(LeftSidebar, ignoreCallbackProps)
const MemoInspector = memo(Inspector, ignoreCallbackProps)
export function Director3DApp({ storageKey, onExport, onExit, onThumbnail }) {
  // 受控工程存储 key：每节点独立（director3d-project-<nodeId>）；默认兼容独立运行（director3d-project）
  const projectStorageKey = storageKey || PROJECT_STORAGE_KEY
  const startupProject = useMemo(() => readCachedProject(projectStorageKey), [projectStorageKey])
  const [settings, setSettings] = useState(() => normalizeProjectSettings(startupProject?.settings))
  const [shots, setShots] = useState(() => startupProject?.shots || [{
    id: 'shot-01', name: '镜头 01', thumbnail: '', fps: DEFAULT_PROJECT_SETTINGS.fps, durationSeconds: DEFAULT_PROJECT_SETTINGS.durationSeconds, loopPlayback: false,
    objects: cloneProjectValue(initialObjects), camera: cloneProjectValue(initialCamera), lighting: cloneProjectValue(DEFAULT_LIGHTING), reference: cloneProjectValue(DEFAULT_REFERENCE), keyframes: [], objectKeyframes: {}, paths: {},
  }])
  const [activeShotId, setActiveShotId] = useState(() => startupProject?.activeShotId || 'shot-01')
  const [objects, setObjects] = useState(() => startupProject?.objects || initialObjects)
  const [selectedId, setSelectedId] = useState(() => startupProject?.objects?.[0]?.id || 'actor-lead')
  const [selectedJoint, setSelectedJoint] = useState('mixamorigSpine2')
  const [transformMode, setTransformMode] = useState('translate')
  const [transformSpace, setTransformSpace] = useState('world')
  const [snapEnabled, setSnapEnabled] = useState(true)
  const [groundRequest, setGroundRequest] = useState(null)
  const [camera, setCamera] = useState(() => ({ ...initialCamera, ...startupProject?.camera }))
  const [lighting, setLighting] = useState(() => normalizeLighting(startupProject?.lighting))
  const [reference, setReference] = useState(() => normalizeReference(startupProject?.reference))
  const [keyframes, setKeyframes] = useState(() => startupProject?.keyframes || initialKeyframes)
  const [characterKeyframes, setCharacterKeyframes] = useState<Record<string, ChannelTracks | ChannelKey[]>>(() => startupProject?.objectKeyframes || startupProject?.characterKeyframes || initialCharacterKeyframes)
  // 当前镜头下 targetId → 运动路径表（targetId 即对象 id，摄像机用 CAMERA_ID），随镜头切换一起走
  const [paths, setPaths] = useState(() => startupProject?.paths || {})
  // 画线编辑：editMode='path' 表示正在为选中对象（含摄像机）画运动路径；pathDraft 为当时正在编辑的路径
  const [editMode, setEditMode] = useState('')
  const [pathMenuOpen, setPathMenuOpen] = useState(false)
  // 是否处于「绘制态」：true 时左键拖动在场景里画曲线；false 为查看/调整态（可拖控制点、不画线）
  const [pathDrawing, setPathDrawing] = useState(false)
  const [pathDraft, setPathDraft] = useState(null)
  // 右键菜单：{ x, y, index } index 为最近控制点下标（-1 = 空白处），用于「删除此点 / 删除整条曲线」
  const [pathContextMenu, setPathContextMenu] = useState(null)
  const [pathTiming, setPathTiming] = useState(() => ({
    startSec: 0,
    endSec: DEFAULT_PROJECT_SETTINGS.durationSeconds,
    density: 'sparse',
    keyframeCount: DEFAULT_PATH_SETTINGS.keyframeCount,
  }))
  const [objectDrafts, setObjectDrafts] = useState({})
  const [currentFrame, setCurrentFrame] = useState(0)
  const [selectedKeyframe, setSelectedKeyframe] = useState(null)
  const [keyframeClipboard, setKeyframeClipboard] = useState(null)
  const [customPoses, setCustomPoses] = useState(() => readCustomPoses())
  const [playing, setPlaying] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [capturingImage, setCapturingImage] = useState(false)
  const [exportReferenceBackground, setExportReferenceBackground] = useState(null)
  const [monitorReferenceBackground, setMonitorReferenceBackground] = useState(null)
  const [exportProgress, setExportProgress] = useState(0)
  const [showGrid, setShowGrid] = useState(true)
  const [performanceMode, setPerformanceMode] = useState(false)
  const [seamlessBackground, setSeamlessBackground] = useState(false)
  const [cameraView, setCameraView] = useState(false)
  const [cameraAnglePanelOpen, setCameraAnglePanelOpen] = useState(false)
  const [viewOptionsCollapsed, setViewOptionsCollapsed] = useState(false)
  const [monitorMode, setMonitorMode] = useState('minimized')
  const [editorView, setEditorView] = useState({ position: [8.5, 6.4, 9.5], target: [0, 1, 0] })
  const [viewFocusRequest, setViewFocusRequest] = useState(null)
  const [saveStatus, setSaveStatus] = useState(startupProject ? '已恢复自动保存' : '自动保存已开启')
  const [, setHistoryVersion] = useState(0)
  const loadRef = useRef(null)
  const referenceFileRef = useRef(null)
  const playStartRef = useRef(null)
  const currentFrameRef = useRef(0)
  const exportCanvasRef = useRef(null)
  const imageCaptureCanvasRef = useRef(null)
  const monitorCanvasRef = useRef(null)
  const editorViewRef = useRef(editorView)
  const gizmoApiRef = useRef(null)
  const exportLockRef = useRef(false)
  const historyRef = useRef(createHistoryState())
  const latestProjectRef = useRef(null)
  // 路径烘焙去重唯一依据：target → 上一批由路径生成的帧号（同步更新，避免高频 onPathChange + React 批处理读过期闭包导致旧帧清不掉而叠加）
  const pathFramesRef = useRef({})

  // 队列化 toast（剥离到 useToast.js）：每条独立 1800ms 自动消失，视觉对齐 maomao 统一通知（顶部居中、四档状态色）。
  const { toasts, setToast, dismiss } = useToast()
  // 自定义确认层（替代原生 window.confirm，D8）
  const { ask, renderConfirm } = useConfirm()

  const handleReferenceUpload = async event => {
    const input = event.currentTarget
    const file = input.files?.[0]
    if (!file) return
    try {
      const image = await referenceImageFromFile(file)
      setReference(normalizeReference({ ...DEFAULT_REFERENCE, image, name: file.name }))
      setToast(`参考图“${file.name}”已加入 · 可切换到“摄像机视角”核对导出构图`)
    } catch (error) {
      log.error('参考图上传失败', error)
      setToast(error.message || '参考图上传失败', 'error')
    } finally {
      input.value = ''
    }
  }

  const fps = settings.fps
  const totalFrames = fps * settings.durationSeconds

  const selected = useMemo(() => selectedId === CAMERA_ID ? { id: CAMERA_ID } : objects.find(object => object.id === selectedId), [objects, selectedId])
  const activeObject = useMemo(() => selected?.id && selected.id !== CAMERA_ID ? selected : null, [selected])
  const activeShot = useMemo(() => shots.find(shot => shot.id === activeShotId) || shots[0], [activeShotId, shots])
  const displayedShots = useMemo(() => shots.map(shot => shot.id === activeShotId ? {
    ...shot,
    fps: settings.fps,
    durationSeconds: settings.durationSeconds,
    loopPlayback: settings.loopPlayback,
    objects,
    camera,
    lighting,
    reference,
    keyframes,
    objectKeyframes: characterKeyframes,
  } : shot), [activeShotId, camera, characterKeyframes, keyframes, lighting, objects, reference, settings.durationSeconds, settings.fps, settings.loopPlayback, shots])
  const maxKeyframeFrame = useMemo(() => keyframeMaxFrame(keyframes, characterKeyframes), [characterKeyframes, keyframes])
  // 对象实体类型解析：通道结构需按实体类型 flatten 成整快照数组供查找/复制（M1-C1 实体通道划分）
  const entityTypeFor = useCallback(id => objects.find(object => object.id === id)?.type || 'object', [objects])
  const selectedKeyframeInfo = useMemo(() => {
    if (!selectedKeyframe) return null
    // M1：轨道已是通道结构（camera → {transform,lens}，object → {transform,action,skeleton}），
    // 经读侧桥 flatten 成整快照数组后按帧查找；插值取自该帧（各通道同帧插值一致）。
    const track = selectedKeyframe.kind === 'camera'
      ? snapshotKeysForTrack(keyframes, 'camera')
      : snapshotKeysForTrack(characterKeyframes[selectedKeyframe.trackId], entityTypeFor(selectedKeyframe.trackId))
    const key = track?.find(item => item.frame === selectedKeyframe.frame)
    return key ? { ...selectedKeyframe, interpolation: normalizeInterpolation(key.interpolation) } : null
  }, [characterKeyframes, entityTypeFor, keyframes, selectedKeyframe])
  // 当前镜头相机若有运动路径，则直接沿路径「弧长匀速」取位置与朝向（贝塞尔思路：
  // 关键帧只作时间起止，位置不在离散关键帧上分段插值，从而消除转角顿挫与走走停停）。
  const cameraPathSnapshot = useCallback(frame => {
    const path = paths[CAMERA_ID]
    if (!path || !Array.isArray(path.points) || path.points.length < 2) return null
    const start = Math.max(0, Math.round(Number(path.startFrame) || 0))
    const end = Math.max(start + 1, Math.round(Number(path.endFrame) || totalFrames))
    const u = clamp((frame - start) / Math.max(1, end - start), 0, 1)
    const pos = pathPositionAtFraction(path, u)
    if (!pos) return null
    const tangent = pathTangentAtFraction(path, u) || [0, 0, -1]
    const position = [pos.x, pos.y, pos.z]
    const snapshot: { position: number[]; rotation?: number[] } = { position }
    if (camera.targetMode !== 'object') {
      snapshot.rotation = cameraRotationToward(position, [pos.x + tangent[0], pos.y + tangent[1], pos.z + tangent[2]])
    }
    return snapshot
  }, [camera.targetMode, paths, totalFrames])
  const animatedCamera = useMemo(() => {
    const snap = cameraPathSnapshot(currentFrame)
    if (snap) return { ...camera, ...snap }
    // M1：keyframes 为通道结构，用「已打点帧数」判断是否有相机动画（代替旧数组 .length）
    return countChannelKeyframes(keyframes) ? cameraAtFrame(keyframes, currentFrame, camera.aspectRatio) : camera
  }, [camera, cameraPathSnapshot, currentFrame, keyframes])
  const isAnimating = playing || exporting
  const hasObjectAnimation = useMemo(() => Object.values(characterKeyframes).some(track => countChannelKeyframes(track) > 0), [characterKeyframes])
  const animatedObjects = useMemo(() => {
    // M3：路径作为独立位置来源（pathActive）随 paths 一并交给求值引擎；
    // 「有路径」即视为位置来源存在，仅路径无关键帧时也走路径（M3-C3）。
    const hasAnyPath = Object.values(paths).some(pathActive)
    if (!hasObjectAnimation && !hasAnyPath) return objects
    return objectsAtFrame(objects, characterKeyframes, currentFrame, fps, paths)
      .map(object => objectDrafts[object.id] || object)
  }, [hasObjectAnimation, objects, characterKeyframes, currentFrame, fps, paths, objectDrafts])
  const inspectorSelected = useMemo(() => selectedId === CAMERA_ID ? selected : animatedObjects.find(object => object.id === selectedId), [animatedObjects, selected, selectedId])
  // 始终面向对象（参考 director3d 的 C4D Target）：targetMode==='object' 时注视点锁定目标对象，
  // 用目标对象（动画后）的视觉中心覆写摄像机旋转，使其始终朝向目标（目标移动/打关键帧也会跟随）
  const cameraLookTarget = useMemo(() => {
    if (camera.targetMode !== 'object' || !camera.targetId) return null
    const target = animatedObjects.find(object => object.id === camera.targetId)
    return target ? visualCenterForObject(target) : null
  }, [animatedObjects, camera.targetId, camera.targetMode])
  const displayCamera = useMemo(() => {
    const base = isAnimating ? animatedCamera : camera
    if (!cameraLookTarget) return base
    return { ...base, rotation: cameraRotationToward(base.position, cameraLookTarget) }
  }, [animatedCamera, camera, cameraLookTarget, isAnimating])
  const previewAspect = aspectValue(displayCamera.aspectRatio)
  const previewAspectClass = previewAspect >= 16 / 9 ? 'is-wide' : 'is-tall'
  const exportDimensions = useMemo(() => exportDimensionsForAspect(camera.aspectRatio), [camera.aspectRatio])
  const currentProject = useMemo(() => projectData({
    settings,
    objects,
    camera,
    lighting,
    reference,
    keyframes,
    objectKeyframes: characterKeyframes,
    paths,
    shots,
    activeShotId,
  }), [settings, objects, camera, lighting, reference, keyframes, characterKeyframes, paths, shots, activeShotId])

  useEffect(() => {
    currentFrameRef.current = currentFrame
  }, [currentFrame])

  useEffect(() => {
    let active = true
    if (!reference.image || !reference.includeInExport) {
      setMonitorReferenceBackground(null)
      return () => { active = false }
    }
    referenceCanvasForExport(reference, exportDimensions.width, exportDimensions.height)
      .then(canvas => { if (active) setMonitorReferenceBackground(canvas) })
      .catch(() => { if (active) setMonitorReferenceBackground(null) })
    return () => { active = false }
  }, [exportDimensions.height, exportDimensions.width, reference])

  useEffect(() => {
    // 姿势库持久化（写入失败不影响工程编辑，writeJson 内部已记录日志）
    writeJson(CUSTOM_POSE_STORAGE_KEY, customPoses)
  }, [customPoses])

  useEffect(() => {
    if (selectedKeyframe?.kind === 'object' && selectedKeyframe.trackId !== selectedId) setSelectedKeyframe(null)
  }, [selectedId, selectedKeyframe])

  useEffect(() => {
    latestProjectRef.current = currentProject
    const history = historyRef.current
    // 非用户编辑（播放/拖帧镜头预览、切镜头）的抑制写入：只推进基线，不入栈
    if (consumeDefer(history, currentProject)) return
    if (!history.last) {
      history.last = currentProject
      return
    }
    if (history.restoring) {
      history.restoring = false
      history.last = currentProject
      return
    }
    clearTimeout(history.timer)
    const previous = history.last
    history.timer = setTimeout(() => {
      if (latestProjectRef.current === previous) return
      recordChange(history, previous, latestProjectRef.current)
      setHistoryVersion(version => version + 1)
    }, HISTORY_DEBOUNCE_MS)
    return () => clearTimeout(history.timer)
  }, [currentProject])

  useEffect(() => {
    setSaveStatus('保存中…')
    const timer = setTimeout(() => {
      // 自动保存失败升级为可见状态灯 + toast 告警（writeJson 内部已记录日志，报错不吞）
      const ok = writeJson(projectStorageKey, currentProject)
      setSaveStatus(ok ? '已自动保存' : '自动保存空间不足')
      if (!ok) setToast('自动保存空间不足，请使用「导出工程」备份', 'error')
    }, 900)
    return () => clearTimeout(timer)
  }, [currentProject, setToast])

  const applyProjectSnapshot = useCallback(snapshot => {
    const normalized = normalizeProjectData(snapshot)
    if (!normalized) return
    setSettings(normalized.settings)
    setShots(normalized.shots)
    setActiveShotId(normalized.activeShotId)
    setObjects(normalized.objects)
    setCamera(normalized.camera)
    setLighting(normalized.lighting)
    setReference(normalized.reference)
    setKeyframes(normalized.keyframes)
    setCharacterKeyframes(normalized.objectKeyframes)
    setPaths(normalized.paths || {})
    setObjectDrafts({})
    setSelectedKeyframe(null)
    setPlaying(false)
    setCurrentFrame(frame => {
      const nextFrame = clamp(frame, 0, normalized.settings.fps * normalized.settings.durationSeconds)
      currentFrameRef.current = nextFrame
      return nextFrame
    })
    setSelectedId(current => current === CAMERA_ID || normalized.objects.some(object => object.id === current) ? current : normalized.objects[0]?.id || CAMERA_ID)
  }, [])

  // docs/45 批次B：启动异步 hydrate（KV 权威覆盖）。
  // 时序安全：写入是 fire-and-forget、读取异步化——此处挂载后一次性拉 KV。
  //   - 同步种子（startupProject / useMemo readCachedProject）仍走 localStorage，保证降级不丢图；
  //   - hydrate 拉取的是 KV 权威版本（可能比本地种子新），完成后 applyProjectSnapshot 覆盖；
  //   - KV 为空且本地有 → hydrate 内部已写回 KV（一次性迁移），本地照常复用；
  //   - 用 alive 标志，组件卸载 / key 变化时取消过期覆盖，防竞态覆盖用户新编辑。
  useEffect(() => {
    let alive = true
    hydrateProject(projectStorageKey)
      .then(project => {
        if (!alive || !project) return
        applyProjectSnapshot(project)
      })
      .catch(error => {
        log.error('director3d 工程 hydrate 失败（已用本地种子，不阻塞）', { key: projectStorageKey }, error)
      })
    return () => { alive = false }
  }, [projectStorageKey])

  const flushHistory = useCallback(() => {
    const history = historyRef.current
    clearTimeout(history.timer)
    history.timer = null
    flushChange(history, latestProjectRef.current)
  }, [])

  const undo = useCallback(() => {
    flushHistory()
    const previous = undoPeek(historyRef.current)
    if (!previous) {
      setToast('没有任何可撤销的操作')
      return
    }
    applyProjectSnapshot(previous)
    setHistoryVersion(version => version + 1)
    setToast('已撤销')
  }, [applyProjectSnapshot, flushHistory])

  const redo = useCallback(() => {
    const next = redoPeek(historyRef.current)
    if (!next) return
    applyProjectSnapshot(next)
    setHistoryVersion(version => version + 1)
    setToast('已重做')
  }, [applyProjectSnapshot])

  // ---- 画线运动路径（编辑曲线工具） ----
  // 选中任意对象（含摄像机）→ 进入 path 模式 → 在地面拖出曲线 → 自动把曲线烘焙成该对象的 position 关键帧。
  // 一条曲线 = 一个对象的运动轨道；摄像机额外烘焙朝向（沿路径切线），对象只写 position、保留姿态。
  const pathEditing = editMode === 'path'
  // 画线交互落点所在的水平高度：物件用其脚底高（object.position.y），摄像机用相机高度，避免贴地穿模
  const pathAnchorY = useMemo(() => {
    if (selectedId === CAMERA_ID) return camera.position[1]
    const object = animatedObjects.find(item => item.id === selectedId)
    return object ? (object.position?.[1] || 0) : 0
  }, [animatedObjects, camera.position, selectedId])

  const applyTimingToPath = useCallback(path => {
    if (!path) return path
    return {
      ...path,
      startFrame: Math.round(pathTiming.startSec * fps),
      endFrame: Math.round(pathTiming.endSec * fps),
      keyframeCount: pathTiming.keyframeCount,
    }
  }, [fps, pathTiming])

  const togglePathEditor = useCallback(() => {
    if (pathEditing) {
      setEditMode('')
      setPathDraft(null)
      setPathDrawing(false)
      setPathMenuOpen(false)
      setPathContextMenu(null)
      setTransformMode('select')
      return
    }
    const existing = paths[selectedId]
    pathFramesRef.current[selectedId] = existing?.sourceKeyframeFrames || []
    const base = existing ? normalizeCameraPath(existing) : createEmptyPath(settings)
    setPathDraft(applyTimingToPath(base))
    setEditMode('path')
    setPathDrawing(false) // 进入编辑态是查看/调整态，不自动开始画线
    setPathMenuOpen(true)
    setTransformMode('select')
  }, [applyTimingToPath, pathEditing, paths, selectedId, settings])

  // 切换选中对象时，路径编辑目标跟随选中项（各对象/摄像机各自一张路径表）
  useEffect(() => {
    if (editMode !== 'path') return
    const existing = paths[selectedId]
    pathFramesRef.current[selectedId] = existing?.sourceKeyframeFrames || []
    const base = existing ? normalizeCameraPath(existing) : createEmptyPath(settings)
    setPathDraft(applyTimingToPath(base))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, editMode])

  const applyPathBake = useCallback(path => {
    if (!path || !Array.isArray(path.points) || path.points.length < 2) return
    const baked = bakePathKeyframes(path, fps)
    if (!baked.frames.length) return
    const target = selectedId
    if (pathFramesRef.current[target] === undefined) {
      pathFramesRef.current[target] = paths[target]?.sourceKeyframeFrames || []
    }
    const removeFrames = new Set(pathFramesRef.current[target])

    if (target === CAMERA_ID) {
      // 相机路径烘焙（先删旧路径帧、再按曲线逐帧写 transform/lens，逻辑在 tracks.js）
      setKeyframes(channels => bakeCameraPath(channels, path, camera, baked.frames, [...removeFrames]))
    } else {
      const source = objects.find(object => object.id === target)
      if (source) {
        // 对象路径烘焙：路径帧只产 position 来源标识、先删后加原子 batch（M3-C2/C5 + M4-C5）
        setCharacterKeyframes(tracks => bakeObjectPath(tracks, target, source.type, baked.frames, [...removeFrames]))
      }
    }
    // 同步记录本批生成帧号，下次烘焙用它们先删后加
    pathFramesRef.current[target] = baked.sourceKeyframeFrames
    setPaths(all => ({ ...all, [target]: { ...path, sourceKeyframeFrames: baked.sourceKeyframeFrames } }))
    // 数据写回 activeShot 走 currentProject → 防抖自动入栈，无需手动 recordChange
  }, [camera.focalLength, fps, objects, paths, selectedId])

  const commitPathPoints = useCallback(nextPoints => {
    setPathDraft(draft => {
      if (!draft) return draft
      const next = { ...draft, points: nextPoints }
      applyPathBake(next)
      return next
    })
  }, [applyPathBake])

  // 时间范围 / 画点密度 / 关键帧数量：先自动生成，再随时调整即时重烘焙
  const updatePathTiming = useCallback(patch => {
    setPathTiming(timing => ({ ...timing, ...patch }))
  }, [])

  // 「开始绘制/完成」：进入绘制态先清空旧曲线（一个对象只有一条路径，重画必须先删旧的），
  // 左键拖动在场景里画出新线；点「完成」退出绘制态，回到查看/调整态（可拖控制点）。
  const togglePathDrawing = useCallback(() => {
    if (pathDrawing) {
      setPathDrawing(false)
      return
    }
    // 重画 = 先从当前选中对象清掉旧路径与旧关键帧，避免两条线冲突
    const target = selectedId
    pathFramesRef.current[target] = []
    const removeFrames = new Set((paths[target]?.sourceKeyframeFrames) || [])
    if (target === CAMERA_ID) {
      // 清相机路径帧：transform/lens 同时删（tracks.js）
      setKeyframes(channels => removeCameraFrames(channels, [...removeFrames]))
    } else {
      // 清对象路径帧：统一写入口 remove（轨道写空后自动移除该对象条目，tracks.js）
      setCharacterKeyframes(tracks => removeObjectFrames(tracks, target, [...removeFrames]))
    }
    setPaths(all => {
      const next = { ...all }
      delete next[target]
      return next
    })
    setPathDraft(draft => draft ? { ...draft, points: [], sourceKeyframeFrames: [] } : draft)
    setPathDrawing(true)
  }, [pathDrawing, paths, selectedId])

  // 三个时间参数变化 → 用当前曲线的控制点（形状不变）按新参数重新烘焙位置关键帧
  useEffect(() => {
    if (editMode !== 'path' || !pathDraft || pathDraft.points.length < 2) return
    const next = applyTimingToPath(pathDraft)
    applyPathBake(next)
    setPathDraft(next)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathTiming])

  const clearPath = useCallback(() => {
    const target = selectedId
    pathFramesRef.current[target] = []
    const removeFrames = new Set((paths[target]?.sourceKeyframeFrames) || [])
    if (target === CAMERA_ID) {
      // 清相机路径帧：transform/lens 同时删（tracks.js）
      setKeyframes(channels => removeCameraFrames(channels, [...removeFrames]))
    } else {
      // 清对象路径帧：统一写入口 remove（轨道写空后自动移除该对象条目，tracks.js）
      setCharacterKeyframes(tracks => removeObjectFrames(tracks, target, [...removeFrames]))
    }
    setPaths(all => {
      const next = { ...all }
      delete next[target]
      return next
    })
    setPathDraft(draft => draft ? { ...draft, points: [], sourceKeyframeFrames: [] } : draft)
  }, [paths, selectedId])

  const openPathContextMenu = useCallback((index, clientX, clientY) => {
    setPathContextMenu({ x: clientX, y: clientY, index })
  }, [])

  const closePathContextMenu = useCallback(() => setPathContextMenu(null), [])

  // 删除单个控制点：从曲线上挖掉该点，重新烘焙关键帧；若剩点不足 2 个则视为删整条曲线
  const deletePathPoint = useCallback(index => {
    closePathContextMenu()
    setPathDraft(draft => {
      if (!draft || !Array.isArray(draft.points) || index < 0 || index >= draft.points.length) return draft
      const nextPoints = draft.points.filter((_, i) => i !== index)
      if (nextPoints.length < 2) {
        clearPath()
        return { ...draft, points: [], sourceKeyframeFrames: [] }
      }
      const next = { ...draft, points: nextPoints }
      applyPathBake(next)
      return next
    })
  }, [applyPathBake, clearPath, closePathContextMenu])

  const deleteWholePath = useCallback(() => {
    closePathContextMenu()
    clearPath()
  }, [clearPath, closePathContextMenu])

  // 右键菜单打开时：Escape 关闭
  useEffect(() => {
    if (!pathContextMenu) return undefined
    const onKey = event => { if (event.key === 'Escape') closePathContextMenu() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [pathContextMenu, closePathContextMenu])

  const focusSelected = useCallback(() => {
    if (selectedId === CAMERA_ID) {
      setViewFocusRequest({ position: [...displayCamera.position], height: 0, distance: 4, nonce: Date.now() })
      return
    }
    const object = animatedObjects.find(item => item.id === selectedId)
    if (!object) return
    const maxScale = Math.max(...(object.scale || [1, 1, 1]).map(value => Math.abs(value) || 1))
    setViewFocusRequest({
      position: visualCenterForObject(object),
      height: 0,
      distance: clamp(maxScale * 4.5, 2.8, 14),
      nonce: Date.now(),
    })
  }, [animatedObjects, displayCamera.position, selectedId])

  // 把关键帧插值结果写回 camera state 时保留非关键帧属性（targetMode/targetId）：
  // cameraAtFrame 只输出关键帧变换字段，直接 setCamera 会把「始终面向对象」的配置冲掉，
  // 导致播放/拖动播放头/暂停后朝向失效。统一走这个入口。
  // P0-C：此入口仅在播放/暂停/拖帧等「非用户编辑」场景被调用，故统一挂抑制计数，
  //   让历史副作用对该写入「只推进基线、不入栈」，避免撤销栈被逐帧预览写污染。
  const setCameraAtFrame = useCallback(frame => {
    historyRef.current.deferCount += 1
    setCamera(current => {
      const snap = cameraPathSnapshot(frame)
      if (snap) return { ...current, ...snap, targetMode: current.targetMode, targetId: current.targetId }
      const interpolated = cameraAtFrame(keyframes, frame, current.aspectRatio)
      return { ...interpolated, targetMode: current.targetMode, targetId: current.targetId }
    })
  }, [cameraPathSnapshot, keyframes])

  const seekToFrame = useCallback(frame => {
    const nextFrame = clamp(Math.round(frame), 0, totalFrames)
    setPlaying(false)
    // 仅当存在未提交的拖拽草稿时才重置，避免拖动播放头时每次 seek 都新建空对象触发无谓重渲染
    setObjectDrafts(drafts => Object.keys(drafts).length ? {} : drafts)
    setCurrentFrame(nextFrame)
    currentFrameRef.current = nextFrame
    setCameraAtFrame(nextFrame)
  }, [setCameraAtFrame, totalFrames])

  const togglePlayback = useCallback(() => {
    setPlaying(wasPlaying => {
      if (wasPlaying) {
        const pausedFrame = currentFrameRef.current
        setCameraAtFrame(pausedFrame)
      }
      if (!wasPlaying && currentFrameRef.current >= totalFrames) {
        setCurrentFrame(0)
        currentFrameRef.current = 0
        setCameraAtFrame(0)
      }
      if (!wasPlaying) setObjectDrafts({})
      return !wasPlaying
    })
  }, [setCameraAtFrame, totalFrames])

  useEffect(() => {
    if (!playing) { playStartRef.current = null; return }
    let frameId
    const animate = timestamp => {
      if (playStartRef.current === null) playStartRef.current = timestamp - currentFrameRef.current / fps * 1000
      let frame = Math.floor((timestamp - playStartRef.current) / 1000 * fps)
      if (frame >= totalFrames) {
        if (settings.loopPlayback) {
          frame %= totalFrames
          playStartRef.current = timestamp - frame / fps * 1000
        } else {
          setCurrentFrame(totalFrames)
          currentFrameRef.current = totalFrames
          setCameraAtFrame(totalFrames)
          setPlaying(false)
          return
        }
      }
      setCurrentFrame(frame)
      currentFrameRef.current = frame
      frameId = requestAnimationFrame(animate)
    }
    frameId = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(frameId)
  }, [playing, fps, totalFrames, settings.loopPlayback, setCameraAtFrame])

  useEffect(() => {
    const onKeyDown = event => {
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return
      if (event.key.toLowerCase() === 'w') { setTransformMode('translate'); event.stopImmediatePropagation() }
      if (event.key.toLowerCase() === 'r') { setTransformMode('rotate'); event.stopImmediatePropagation() }
      if (event.key.toLowerCase() === 'e') { setTransformMode('scale'); event.stopImmediatePropagation() }
      if (event.key.toLowerCase() === 'f') { focusSelected(); event.stopImmediatePropagation() }
      if (event.code === 'Space') { event.preventDefault(); event.stopImmediatePropagation(); togglePlayback() }
      if ((event.key === 'Delete' || event.key === 'Backspace') && selectedId !== CAMERA_ID) { event.preventDefault(); event.stopImmediatePropagation(); deleteSelected() }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'd') { event.preventDefault(); event.stopImmediatePropagation(); duplicateSelected() }
      if ((event.ctrlKey || event.metaKey) && !event.shiftKey && event.key.toLowerCase() === 'z') { event.preventDefault(); event.stopImmediatePropagation(); undo() }
      if ((event.ctrlKey || event.metaKey) && (event.key.toLowerCase() === 'y' || (event.shiftKey && event.key.toLowerCase() === 'z'))) { event.preventDefault(); event.stopImmediatePropagation(); redo() }
      // 标准视角快捷键：与右下角 3D 轴立方体共用同一 jumpTo，F1 回到默认自由视角
      if (event.key === 'F1') { event.preventDefault(); event.stopImmediatePropagation(); gizmoApiRef.current?.('perspective') }
      if (event.key === 'F2') { event.preventDefault(); event.stopImmediatePropagation(); gizmoApiRef.current?.('top') }
      if (event.key === 'F3') { event.preventDefault(); event.stopImmediatePropagation(); gizmoApiRef.current?.('left') }
      if (event.key === 'F4') { event.preventDefault(); event.stopImmediatePropagation(); gizmoApiRef.current?.('back') }
    }
    // 捕获阶段注册：在 maomao 画布（React Flow）之前处理，避免 Delete 触发画布删除导致 overlay 退出
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [selectedId, objects, togglePlayback, undo, redo, focusSelected])

  const applySettings = nextSettings => {
    const next = normalizeProjectSettings(nextSettings)
    const nextTotalFrames = next.fps * next.durationSeconds
    const lastKeyframeFrame = normalizeFrameNumber(maxKeyframeFrame)
    if (nextTotalFrames < lastKeyframeFrame) {
      const requiredSeconds = Math.max(1, Math.ceil(lastKeyframeFrame / next.fps))
      setToast(`最后关键帧在第 ${lastKeyframeFrame} 帧，时长至少 ${requiredSeconds} 秒`)
      return
    }
    setPlaying(false)
    setSettings(next)
    setShots(list => list.map(shot => shot.id === activeShotId ? { ...shot, fps: next.fps, durationSeconds: next.durationSeconds, loopPlayback: next.loopPlayback } : shot))
    setCurrentFrame(frame => {
      const nextFrame = clamp(frame, 0, nextTotalFrames)
      currentFrameRef.current = nextFrame
      return nextFrame
    })
    setToast(`时间轴已更新 · ${next.fps} FPS · ${next.durationSeconds} 秒`)
  }

  // 镜头缩略图唯一入口：从监视器画面截取。监视器小窗默认关闭时无画面可截（缩略图保持原样），
  // 打开监视器后即可正常更新。绘制逻辑收敛到 thumbnails.js（纯函数），此处仅以 ref 注入命令式取数，
  // 解耦跨组件取画布边界。刻意不为此创建额外 WebGL 上下文——避免每次镜头操作挂载/销毁画布导致黑屏。
  const thumbnailFromMonitor = () => thumbnailFromCanvas(monitorCanvasRef.current)

  const liveShotRecord = (shot, thumbnail = shot?.thumbnail || '') => ({
    ...shot,
    id: shot?.id || activeShotId,
    name: shot?.name || '镜头',
    thumbnail,
    fps: settings.fps,
    durationSeconds: settings.durationSeconds,
    loopPlayback: settings.loopPlayback,
    objects,
    camera,
    lighting,
    reference,
    keyframes,
    objectKeyframes: characterKeyframes,
    paths,
  })

  const applyShotState = shot => {
    setPlaying(false)
    setObjectDrafts({})
    setSelectedKeyframe(null)
    setKeyframeClipboard(null)
    setSettings(current => ({ ...current, fps: shot.fps, durationSeconds: shot.durationSeconds, loopPlayback: shot.loopPlayback }))
    setObjects(cloneProjectValue(shot.objects))
    setCamera(cloneProjectValue(shot.camera))
    setLighting(normalizeLighting(shot.lighting))
    setReference(normalizeReference(shot.reference))
    setKeyframes(cloneProjectValue(shot.keyframes || []))
    setCharacterKeyframes(cloneProjectValue(shot.objectKeyframes || {}))
    setPaths(cloneProjectValue(shot.paths || {}))
    setEditMode('')
    setPathDraft(null)
    setPathMenuOpen(false)
    setCurrentFrame(0)
    currentFrameRef.current = 0
    setActiveShotId(shot.id)
    setSelectedId(shot.objects?.[0]?.id || CAMERA_ID)
  }

  const switchShot = shotId => {
    if (shotId === activeShotId) return
    const target = shots.find(shot => shot.id === shotId)
    if (!target) return
    // P2-B：纯切换镜头属浏览行为，非用户编辑——抑制本次入栈，避免频繁切镜头挤占 50 条撤销上限
    historyRef.current.deferCount += 1
    const thumbnail = thumbnailFromMonitor()
    setShots(list => list.map(shot => shot.id === activeShotId ? liveShotRecord(shot, thumbnail || shot.thumbnail) : shot))
    applyShotState(target)
    setToast(`已切换到“${target.name}”`)
  }

  const addShot = () => {
    if (shots.length >= 30) { setToast('每个工程最多 30 个镜头'); return }
    const thumbnail = thumbnailFromMonitor()
    const id = `shot-${uid()}`
    const nextShot = {
      id,
      name: uniqueShotName(shots, defaultShotName(shots.length)),
      thumbnail,
      fps: settings.fps,
      durationSeconds: settings.durationSeconds,
      loopPlayback: settings.loopPlayback,
      objects: cloneProjectValue(objects),
      camera: cloneProjectValue(camera),
      lighting: cloneProjectValue(lighting),
      reference: cloneProjectValue(DEFAULT_REFERENCE),
      keyframes: [],
      objectKeyframes: {},
    }
    setShots(list => [...list.map(shot => shot.id === activeShotId ? liveShotRecord(shot, thumbnail || shot.thumbnail) : shot), nextShot])
    applyShotState(nextShot)
    setToast(`已新建“${nextShot.name}” · 场景已复制，关键帧和参考图为空`)
  }

  const duplicateShot = shotId => {
    if (shots.length >= 30) { setToast('每个工程最多 30 个镜头'); return }
    const thumbnail = thumbnailFromMonitor()
    const storedSource = shots.find(shot => shot.id === shotId)
    if (!storedSource) return
    const source = shotId === activeShotId ? liveShotRecord(storedSource, thumbnail || storedSource.thumbnail) : storedSource
    const duplicate = cloneProjectValue({ ...source, id: `shot-${uid()}`, name: uniqueShotName(shots, `${source.name} 副本`) })
    setShots(list => {
      const persisted = list.map(shot => shot.id === activeShotId ? liveShotRecord(shot, thumbnail || shot.thumbnail) : shot)
      const sourceIndex = persisted.findIndex(shot => shot.id === shotId)
      return [...persisted.slice(0, sourceIndex + 1), duplicate, ...persisted.slice(sourceIndex + 1)]
    })
    applyShotState(duplicate)
    setToast(`已复制“${source.name}”`)
  }

  const deleteShot = async shotId => {
    if (shots.length <= 1) return
    const sourceIndex = shots.findIndex(shot => shot.id === shotId)
    const source = shots[sourceIndex]
    if (!source) return
    const ok = await ask(`删除镜头“${source.name}”？`, { confirmText: '删除', danger: true })
    if (!ok) return
    const thumbnail = thumbnailFromMonitor()
    const persisted = shots.map(shot => shot.id === activeShotId ? liveShotRecord(shot, thumbnail || shot.thumbnail) : shot)
    const remaining = persisted.filter(shot => shot.id !== shotId)
    setShots(remaining)
    if (shotId === activeShotId) applyShotState(remaining[Math.min(sourceIndex, remaining.length - 1)])
    setToast(`已删除“${source.name}”`)
  }

  const renameShot = (shotId, name, commit = false) => setShots(list => {
    const index = list.findIndex(shot => shot.id === shotId)
    if (index < 0) return list
    const draft = String(name || '').slice(0, 30)
    const nextName = commit ? (draft.trim() || defaultShotName(index)) : draft
    return list.map(shot => shot.id === shotId ? { ...shot, name: nextName } : shot)
  })

  const captureShotThumbnail = shotId => {
    if (shotId !== activeShotId) { setToast('请先切换到该镜头再更新缩略图'); return }
    const thumbnail = thumbnailFromMonitor()
    if (!thumbnail) { setToast('打开监视器窗口后可更新缩略图'); return }
    setShots(list => list.map(shot => shot.id === shotId ? { ...shot, thumbnail } : shot))
    setToast('镜头缩略图已更新')
  }

  const addPerson = bodyType => {
    const id = uid()
    const person = { id, name: `人物 · ${objects.filter(item => item.type === 'person').length + 1}`, type: 'person', bodyType, pose: 'idle', poseTime: presetPhase('idle'), joints: presetJoints(), rigRoot: [0, 0, 0], footLock: false, continuousMotion: false, position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1], color: '#e8e3d8' }
    setObjects(list => [...list, person])
    setSelectedId(id)
  }
  const addPrimitive = type => {
    const id = uid()
    const labels = { box: '方块', sphere: '球体', cylinder: '圆柱', plane: '平面', arch: '拱门', stairs: '楼梯', table: '桌子', chair: '椅子', sofa: '沙发', door: '门', window: '窗', tree: '树木', vehicle: '车辆', roof: '屋顶' }
    const defaultScales = { arch: [1.8, 2.2, 0.45], stairs: [2.2, 1.4, 2.8], door: [1.2, 2.2, 0.25], window: [1.5, 1.3, 0.22], table: [1.7, 1, 1.1], chair: [0.8, 1, 0.8], sofa: [2.2, 1.1, 1], tree: [1.8, 2.6, 1.8], vehicle: [2.8, 1.2, 1.6], roof: [2.8, 1.2, 2.2] }
    const positionY = type === 'plane' ? 0.02 : (type === 'tree' ? 1.3 : 0.5)
    setObjects(list => [...list, { id, name: `${labels[type] || type} · ${list.filter(item => item.type === type).length + 1}`, type, position: [0, positionY, 0], rotation: [0, 0, 0], scale: type === 'plane' ? [2, 1, 2] : (defaultScales[type] || [1, 1, 1]), color: type === 'tree' ? '#9ca68d' : '#c7c2b7' }])
    setSelectedId(id)
  }
  const importModel = async event => {
    const file = event.target.files?.[0]
    if (!file) return
    try {
      // 模型 URL 用 data URL 落进工程对象，保证保存/加载后可继续显示（blob URL 无法跨会话持久化）
      const url = await new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onerror = () => reject(new Error('模型读取失败'))
        reader.onload = () => resolve(reader.result)
        reader.readAsDataURL(file)
      })
      // 导入即自动适配：按包围盒高度缩放到内置人物高度并落地，失败则回退 scale=1
      const { scale, positionY } = await measureModelScale(await file.arrayBuffer())
      const id = uid()
      setObjects(list => [...list, { id, name: file.name.replace(/\.(glb|gltf)$/i, ''), type: 'model', url, position: [0, positionY, 0], rotation: [0, 0, 0], scale, color: '#ddd8cc' }])
      setSelectedId(id)
      setToast(scale === 1 ? '模型已加入场景' : '模型已加入场景 · 已自动适配尺寸')
    } catch (error) {
      log.error('模型导入失败', error)
      setToast(error?.message || '模型导入失败', 'error')
    }
    event.target.value = ''
  }
  const updateObjectById = (id, patch) => {
    setObjectDrafts(drafts => {
      if (!countChannelKeyframes(characterKeyframes[id])) {
        if (!(id in drafts)) return drafts
        const next = { ...drafts }
        delete next[id]
        return next
      }
      const source = drafts[id] || objectAtFrame(objects.find(object => object.id === id), characterKeyframes[id], currentFrame, fps)
      return source ? { ...drafts, [id]: { ...source, ...patch } } : drafts
    })
    setObjects(list => list.map(object => object.id === id ? { ...object, ...patch } : object))
  }
  const updateSelected = patch => updateObjectById(selectedId, patch)
  const groundSelected = () => {
    if (!activeObject || activeObject.locked) return
    setGroundRequest({ id: activeObject.id, nonce: Date.now() })
    setToast('已按模型最低点落到地面')
  }
  const resetSelectedRotation = () => {
    if (!activeObject || activeObject.locked) return
    updateSelected({ rotation: [0, 0, 0] })
    setToast('整体旋转已归零')
  }
  const resetSelectedScale = () => {
    if (!activeObject || activeObject.locked) return
    updateSelected({ scale: [1, 1, 1] })
    setToast('整体缩放已恢复为 1')
  }
  const captureEditorView = useCallback(view => {
    if (view?.position?.length === 3 && view?.rotation?.length === 3 && view?.target?.length === 3) editorViewRef.current = view
  }, [])
  const openCameraView = () => {
    setEditorView(cloneProjectValue(editorViewRef.current))
    setCameraView(true)
    // 进入摄像机视角后，主视口即显示该机位画面，右下角 monitor 与之重复，
    // 自动最小化避免两处几乎相同的画面并列、误导用户以为是两个机位。
    setMonitorMode('minimized')
    // 同时选中主摄像机，让右侧属性面板直接显示「镜头」属性（焦距/常用焦距等）
    setSelectedId(CAMERA_ID)
  }
  const openEditorView = () => {
    setCameraView(false)
    setCameraAnglePanelOpen(false)
    setMonitorMode('normal')
  }
  const levelCameraHorizon = () => {
    setCamera(current => {
      const rotation = Array.isArray(current.rotation) ? [...current.rotation] : [0, 0, 0]
      rotation[2] = 0
      return { ...current, rotation }
    })
    setToast('摄像机翻滚已归零 · 地面水平线已校正')
  }
  const collapseViewOptions = () => {
    setViewOptionsCollapsed(true)
    setCameraAnglePanelOpen(false)
  }
  // 【产品确认项】姿势库 customPoses 的增删「不可撤销」：它是独立的用户资产集合（非工程内容），
  // 每次变更仅写 customPoses + 持久化到 localStorage（CUSTOM_POSE_STORAGE_KEY），不进撤销栈。
  // 误删无法 Ctrl+Z 恢复（弹 confirm 确认）。「应用姿势」applyCustomPose 则走 updateSelected
  // 修改 objects，是可撤销的。若后续需要姿势库可撤销，需单独设计（纳入工程快照或独立历史）。
  const saveCustomPose = person => {
    if (!person || person.type !== 'person') return
    const suggestedName = `自定义姿势 ${customPoses.length + 1}`
    const name = window.prompt('为当前姿势命名', suggestedName)?.trim()
    if (!name) return
    const rig = poseForObject(person)
    setCustomPoses(list => [...list, {
      id: uid(),
      name,
      pose: normalizePoseId(person.pose),
      poseTime: Number.isFinite(person.poseTime) ? person.poseTime : presetPhase(person.pose),
      rigRoot: [...rig.root],
      joints: cloneJointPose(rig.joints),
    }])
    setToast(`姿势“${name}”已保存到本机`)
  }
  const applyCustomPose = customPose => {
    if (!customPose || !activeObject || activeObject.type !== 'person') return
    updateSelected({
      pose: normalizePoseId(customPose.pose),
      poseTime: Number.isFinite(customPose.poseTime) ? customPose.poseTime : presetPhase(customPose.pose),
      rigRoot: [...(customPose.rigRoot || presetRoot(customPose.pose))],
      joints: cloneJointPose(customPose.joints),
    })
    setToast(`已应用姿势“${customPose.name}”`)
  }
  const deleteCustomPose = async poseId => {
    const pose = customPoses.find(item => item.id === poseId)
    if (!pose) return
    const ok = await ask(`删除姿势“${pose.name}”？`, { confirmText: '删除', danger: true })
    if (!ok) return
    setCustomPoses(list => list.filter(item => item.id !== poseId))
    setToast(`已删除姿势“${pose.name}”`)
  }
  const deleteSelected = () => {
    if (selectedId === CAMERA_ID) return
    const source = objects.find(object => object.id === selectedId)
    if (source?.locked) { setToast('物体已锁定，请先解除锁定'); return }
    setObjects(list => list.filter(object => object.id !== selectedId))
    // 删除对象时随对象清空其整条通道轨（tracks.js）
    setCharacterKeyframes(tracks => clearObjectTrack(tracks, selectedId))
    setObjectDrafts(drafts => {
      const next = { ...drafts }
      delete next[selectedId]
      return next
    })
    setSelectedId(CAMERA_ID)
  }
  const duplicateSelected = () => {
    const source = objects.find(object => object.id === selectedId)
    if (!source) return
    const id = uid()
    const duplicate = { ...source, id, name: `${source.name} 副本`, position: [source.position[0] + 0.6, source.position[1], source.position[2] + 0.6] }
    setObjects(list => [...list, duplicate])
    // 复制轨道到副本：仅 transform.position 偏移 0.6 错开站位，动作/骨骼原样（tracks.js）
    setCharacterKeyframes(tracks => duplicateObjectTrack(tracks, source.id, id, 0.6))
    setSelectedId(id)
  }
  const addKeyframe = () => {
    const existing = snapshotKeysForTrack(keyframes, 'camera').find(key => key.frame === currentFrame)
    // 取当前帧实际渲染的相机位姿：路径动画存在时用路径上的位置，否则用相机当前值（所见即所得）
    const pose = paths[CAMERA_ID] ? animatedCamera : camera
    const next = { frame: currentFrame, interpolation: normalizeInterpolation(existing?.interpolation), position: [...pose.position], rotation: [...pose.rotation], focalLength: pose.focalLength }
    // 相机轨为通道结构，整快照拆进 transform/lens（tracks.js）
    setKeyframes(channels => upsertCameraSnapshot(channels, next))
    setSelectedKeyframe({ kind: 'camera', frame: currentFrame, trackId: null })
    setToast(`已记录第 ${currentFrame} 帧`)
  }
  const deleteKeyframe = frame => {
    // 相机轨为通道结构，transform/lens 同时删该帧，避免漏删幽灵 key（tracks.js）
    setKeyframes(channels => removeCameraFrames(channels, [frame]))
    if (selectedKeyframe?.kind === 'camera' && selectedKeyframe.frame === frame) setSelectedKeyframe(null)
  }
  const addObjectKeyframe = () => {
    if (!activeObject) return
    // 优先用当前帧动画后的对象（路径动画存在时取其路径上的位置），否则回落到当前实例（所见即所得）
    const animatedSource = animatedObjects.find(item => item.id === activeObject.id) || activeObject
    const source = objectDrafts[activeObject.id] || animatedSource
    const existing = snapshotKeysForTrack(characterKeyframes[activeObject.id], activeObject.type).find(key => key.frame === currentFrame)
    const next = { ...objectKeyframeFromObject(source, currentFrame), interpolation: normalizeInterpolation(existing?.interpolation) }
    // 对象轨为通道结构，整快照按实体类型拆通道写入（person→transform/action/skeleton，object→transform，tracks.js）
    setCharacterKeyframes(tracks => upsertObjectSnapshot(tracks, activeObject.id, activeObject.type, next))
    setSelectedKeyframe({ kind: 'object', frame: currentFrame, trackId: activeObject.id })
    setObjectDrafts(drafts => {
      const nextDrafts = { ...drafts }
      delete nextDrafts[activeObject.id]
      return nextDrafts
    })
    setToast(activeObject.type === 'person' ? `已记录“${activeObject.name}”第 ${currentFrame} 帧角色状态` : `已记录“${activeObject.name}”第 ${currentFrame} 帧`)
  }
  const deleteObjectKeyframe = frame => {
    if (!activeObject) return
    // 对象轨统一写入口 remove（轨道写空后自动移除该对象条目，tracks.js）
    setCharacterKeyframes(tracks => removeObjectFrames(tracks, activeObject.id, frame))
    if (selectedKeyframe?.kind === 'object' && selectedKeyframe.trackId === activeObject.id && selectedKeyframe.frame === frame) setSelectedKeyframe(null)
  }
  const moveKeyframe = ({ kind, trackId, fromFrame, toFrame }) => {
    // 通道结构下逐通道整体平移该帧，保证各通道同帧一致（tracks.js）
    if (kind === 'camera') setKeyframes(channels => moveCameraFrame(channels, fromFrame, toFrame))
    else setCharacterKeyframes(tracks => moveObjectFrame(tracks, trackId, fromFrame, toFrame))
    setSelectedKeyframe({ kind, trackId, frame: toFrame })
    seekToFrame(toFrame)
    setToast(`关键帧已移动到第 ${toFrame} 帧`)
  }

  // 批量删除关键帧（时间轴框选/多选删除）：相机/对象按轨道分组一次删整批（tracks.js）
  const deleteKeyframes = useCallback(keys => {
    if (!Array.isArray(keys) || !keys.length) return
    const cameraFrames = keys.filter(key => key.kind === 'camera').map(key => key.frame)
    if (cameraFrames.length) setKeyframes(channels => removeCameraFrames(channels, cameraFrames))
    const objectGroups = {}
    for (const key of keys) {
      if (key.kind !== 'object' || !key.trackId) continue
      objectGroups[key.trackId] = [...(objectGroups[key.trackId] || []), key.frame]
    }
    for (const [id, frames] of Object.entries(objectGroups)) {
      setCharacterKeyframes(tracks => removeObjectFrames(tracks, id, frames))
    }
    setSelectedKeyframe(null)
  }, [])

  // 批量平移关键帧（时间轴框选拖动）：同一轨道内整组平移，先删旧帧再整批插新（tracks.js 原子 batch）
  const moveKeyframes = useCallback(moves => {
    if (!Array.isArray(moves) || !moves.length) return
    const cameraMap = {}
    const objectMaps = {}
    for (const move of moves) {
      if (move.kind === 'camera') cameraMap[move.fromFrame] = move.toFrame
      else if (move.trackId) objectMaps[move.trackId] = { ...objectMaps[move.trackId], [move.fromFrame]: move.toFrame }
    }
    if (Object.keys(cameraMap).length) setKeyframes(channels => moveCameraFrames(channels, cameraMap))
    for (const [id, map] of Object.entries(objectMaps)) {
      setCharacterKeyframes(tracks => moveObjectFrames(tracks, id, map))
    }
  }, [])
  // 改指定帧插值（时间轴右键菜单用）：按参数操作，不依赖 selectedKeyframe 状态
  const changeKeyframeInterpolation = (kind, trackId, frame, value) => {
    const normalized = normalizeInterpolation(value)
    if (kind === 'camera') setKeyframes(channels => setCameraInterpolation(channels, frame, normalized))
    else setCharacterKeyframes(tracks => setObjectInterpolation(tracks, trackId, frame, normalized))
  }
  const copySelectedKeyframe = () => {
    if (!selectedKeyframeInfo) return
    // M1：轨道为通道结构，flatten 成整快照数组后取该帧 key（含该实体全部通道字段，粘贴时再拆回通道）
    const track = selectedKeyframeInfo.kind === 'camera'
      ? snapshotKeysForTrack(keyframes, 'camera')
      : snapshotKeysForTrack(characterKeyframes[selectedKeyframeInfo.trackId], entityTypeFor(selectedKeyframeInfo.trackId))
    const key = track?.find(item => item.frame === selectedKeyframeInfo.frame)
    if (!key) return
    setKeyframeClipboard({ kind: selectedKeyframeInfo.kind, key: JSON.parse(JSON.stringify(key)) })
    setToast('关键帧已复制')
  }
  const pasteKeyframe = () => {
    if (!keyframeClipboard) return
    const next = { ...JSON.parse(JSON.stringify(keyframeClipboard.key)), frame: currentFrame }
    if (keyframeClipboard.kind === 'camera') {
      // 粘贴整快照 key → 拆进相机 transform/lens 通道（tracks.js）
      setKeyframes(channels => upsertCameraSnapshot(channels, next))
      setSelectedKeyframe({ kind: 'camera', frame: currentFrame, trackId: null })
    } else {
      if (!activeObject) { setToast('请先选择要粘贴关键帧的物体'); return }
      // 粘贴整快照 key → 按目标物体实体类型拆进对应通道（粘贴允许跨实体，以目标类型为准，tracks.js）
      setCharacterKeyframes(tracks => upsertObjectSnapshot(tracks, activeObject.id, activeObject.type, next))
      setSelectedKeyframe({ kind: 'object', frame: currentFrame, trackId: activeObject.id })
    }
    setToast(`关键帧已粘贴到第 ${currentFrame} 帧`)
  }
  const deleteSelectedKeyframe = () => {
    if (!selectedKeyframeInfo) return
    if (selectedKeyframeInfo.kind === 'camera') deleteKeyframe(selectedKeyframeInfo.frame)
    else if (activeObject?.id === selectedKeyframeInfo.trackId) deleteObjectKeyframe(selectedKeyframeInfo.frame)
  }
  const saveProject = ({ download = false } = {}) => {
    const data = projectData({ settings, objects, camera, lighting, reference, keyframes, objectKeyframes: characterKeyframes, paths, shots, activeShotId })
    const cached = writeJson(projectStorageKey, data)
    if (download) {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const link = document.createElement('a')
      link.href = URL.createObjectURL(blob)
      const safeName = settings.name.replace(/[\\/:*?"<>|]+/g, '-').trim() || 'director3d-project'
      link.download = `${safeName}.director3d.json`
      link.click()
      URL.revokeObjectURL(link.href)
    }
    if (download) setToast(cached ? '工程 JSON 已导出' : '工程已导出，但浏览器自动保存空间不足')
    else setToast(cached ? '工程已保存到浏览器' : '浏览器保存空间不足，请使用“导出工程”备份')
  }
  const handleCaptureImage = async () => {
    if (exportLockRef.current || exporting || capturingImage) return
    exportLockRef.current = true
    setPlaying(false)
    imageCaptureCanvasRef.current = null
    try {
      const { width, height } = exportDimensions
      const backgroundCanvas = await referenceCanvasForExport(reference, width, height)
      setExportReferenceBackground(backgroundCanvas)
      setCapturingImage(true)
      let canvas = null
      for (let attempt = 0; attempt < 90; attempt += 1) {
        await nextPaint()
        canvas = imageCaptureCanvasRef.current
        if (canvas?.width === width && canvas?.height === height) break
      }
      if (!canvas || canvas.width !== width || canvas.height !== height) throw new Error('截图画面初始化失败')
      await nextPaint()
      const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(result => result ? resolve(result) : reject(new Error('PNG 生成失败')), 'image/png'))
      const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
      const fileName = `director3d-shot-${stamp}-frame-${String(currentFrameRef.current).padStart(3, '0')}.png`
      // 受控导出：先把产物交给宿主（落盘/回写画布），再按需触发浏览器下载
      if (onExport) {
        onExport({ type: 'image', blob, fileName })
        // 缩略图回传：宿主用它做节点预览图
        try {
          onThumbnail?.(URL.createObjectURL(blob))
        } catch { /* 缩略图生成失败不影响截图导出 */ }
        setToast(`摄像机截图已生成 · ${width} × ${height}`)
      } else {
        const link = document.createElement('a')
        link.href = URL.createObjectURL(blob)
        link.download = fileName
        document.body.appendChild(link)
        link.click()
        link.remove()
        URL.revokeObjectURL(link.href)
        setToast(`摄像机截图已导出 · ${width} × ${height}`)
      }
    } catch (error) {
      log.error('摄像机截图失败', error)
      setToast(error?.message || '摄像机截图失败', 'error')
    } finally {
      setCapturingImage(false)
      setExportReferenceBackground(null)
      imageCaptureCanvasRef.current = null
      exportLockRef.current = false
    }
  }
  const handleExportMp4 = async () => {
    if (exportLockRef.current || exporting || capturingImage) return
    exportLockRef.current = true
    const nextExportFrameCount = totalFrames
    const originalFrame = currentFrameRef.current
    const originalCamera = countChannelKeyframes(keyframes)
      ? { ...cameraAtFrame(keyframes, originalFrame, camera.aspectRatio), targetMode: camera.targetMode, targetId: camera.targetId }
      : camera
    let output

    setPlaying(false)
    setObjectDrafts({})
    setCamera(originalCamera)
    setExportProgress(0)
    exportCanvasRef.current = null

    try {
      if (typeof VideoEncoder === 'undefined') throw new Error('当前浏览器不支持视频编码，请使用最新版 Chrome 或 Edge')
      const {
        BufferTarget, CanvasSource, Mp4OutputFormat, Output,
        QUALITY_HIGH, getFirstEncodableVideoCodec,
      } = await import('mediabunny')
      const { width, height } = exportDimensions
      const backgroundCanvas = await referenceCanvasForExport(reference, width, height)
      setExportReferenceBackground(backgroundCanvas)
      setExporting(true)
      const codec = await getFirstEncodableVideoCodec(['avc', 'av1', 'vp9'], { width, height, quality: QUALITY_HIGH })
      if (!codec) throw new Error('当前设备没有可用的 MP4 视频编码器')

      let canvas = null
      for (let attempt = 0; attempt < 120; attempt += 1) {
        await nextPaint()
        canvas = exportCanvasRef.current
        if (canvas?.width === width && canvas?.height === height) break
      }
      if (!canvas || canvas.width !== width || canvas.height !== height) throw new Error('导出画面初始化失败')

      output = new Output({ format: new Mp4OutputFormat(), target: new BufferTarget() })
      const videoSource = new CanvasSource(canvas, {
        codec,
        quality: QUALITY_HIGH,
        keyFrameInterval: 2,
        latencyMode: 'quality',
      })
      output.addVideoTrack(videoSource, { frameRate: fps })
      await output.start()

      for (let sample = 0; sample < nextExportFrameCount; sample += 1) {
        const timelineFrame = Math.min(sample, totalFrames)
        setCurrentFrame(timelineFrame)
        currentFrameRef.current = timelineFrame
        await nextPaint()
        await videoSource.add(sample / fps, 1 / fps, { keyFrame: sample % (fps * 2) === 0 })
        setExportProgress(Math.round((sample + 1) / nextExportFrameCount * 100))
      }

      await output.finalize()
      const buffer = output.target.buffer
      if (!buffer) throw new Error('MP4 文件生成失败')
      const blob = new Blob([buffer], { type: 'video/mp4' })
      const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
      const safeName = settings.name.replace(/[\\/:*?"<>|]+/g, '-').trim() || 'director3d-animation'
      const fileName = `${safeName}-${stamp}.mp4`
      // 受控导出：先把产物交给宿主（落盘/回写画布），再按需触发浏览器下载
      if (onExport) {
        onExport({ type: 'video', blob, fileName })
        setToast(`MP4 已生成 · ${width} × ${height} · ${fps} FPS · ${settings.durationSeconds} 秒`)
      } else {
        const link = document.createElement('a')
        link.href = URL.createObjectURL(blob)
        link.download = fileName
        document.body.appendChild(link)
        link.click()
        link.remove()
        URL.revokeObjectURL(link.href)
        setToast(`MP4 已导出 · ${width} × ${height} · ${fps} FPS · ${settings.durationSeconds} 秒`)
      }
    } catch (error) {
      log.error('MP4 导出失败', error)
      if (output && output.state !== 'finalized') await output.cancel().catch(() => {})
      setToast(error?.message || 'MP4 导出失败', 'error')
    } finally {
      setCurrentFrame(originalFrame)
      currentFrameRef.current = originalFrame
      setCamera(originalCamera)
      setExporting(false)
      setExportProgress(0)
      setExportReferenceBackground(null)
      exportCanvasRef.current = null
      exportLockRef.current = false
    }
  }
  const loadProject = event => {
    const file = event.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const loaded = normalizeProjectData(JSON.parse(String(reader.result)))
        if (!loaded) throw new Error('invalid project')
        setSettings(loaded.settings)
        setShots(loaded.shots)
        setActiveShotId(loaded.activeShotId)
        setObjects(loaded.objects)
        setCamera(loaded.camera)
        setLighting(loaded.lighting)
        setReference(loaded.reference)
        setKeyframes(loaded.keyframes)
        setCharacterKeyframes(loaded.objectKeyframes)
        setObjectDrafts({})
        setSelectedKeyframe(null)
        setCurrentFrame(0)
        currentFrameRef.current = 0
        setPlaying(false)
        setSelectedId(CAMERA_ID)
        setToast(`工程已打开 · ${loaded.shots.length} 个镜头`)
        // P1-A：加载新工程后重置历史栈（清空 past/future、last 置空），下次副作用以新工程重建基线，
        //   避免 Ctrl+Z 退回已废弃的旧工程
        resetHistory(historyRef.current, clearTimeout)
      } catch (error) {
        log.error('打开工程失败', error)
        setToast('工程文件无法读取', 'error')
      }
    }
    reader.readAsText(file)
    event.target.value = ''
  }
  const resetProject = () => {
    const resetObjects = cloneProjectValue(initialObjects)
    const resetCamera = cloneProjectValue(initialCamera)
    setSettings({ ...DEFAULT_PROJECT_SETTINGS })
    setShots([{ id: 'shot-01', name: '镜头 01', thumbnail: '', fps: DEFAULT_PROJECT_SETTINGS.fps, durationSeconds: DEFAULT_PROJECT_SETTINGS.durationSeconds, loopPlayback: DEFAULT_PROJECT_SETTINGS.loopPlayback, objects: resetObjects, camera: resetCamera, lighting: cloneProjectValue(DEFAULT_LIGHTING), reference: cloneProjectValue(DEFAULT_REFERENCE), keyframes: [], objectKeyframes: {} }])
    setActiveShotId('shot-01')
    setObjects(resetObjects)
    setCamera(resetCamera)
    setLighting(cloneProjectValue(DEFAULT_LIGHTING))
    setReference(cloneProjectValue(DEFAULT_REFERENCE))
    setKeyframes(initialKeyframes)
    setCharacterKeyframes(initialCharacterKeyframes)
    setObjectDrafts({})
    setSelectedKeyframe(null)
    setCurrentFrame(0)
    currentFrameRef.current = 0
    setPlaying(false)
    setSelectedId('actor-lead')
    setToast('已新建空关键帧工程 · 可在时间轴右侧设置时长')
    // P1-A：重置工程后同样重置历史栈，避免撤销退回旧工程
    resetHistory(historyRef.current, clearTimeout)
  }

  return (
    <main className="app-shell" aria-busy={exporting || capturingImage}>
      <header className="topbar">
        <nav className="top-actions">
          {onExit && (
            <button type="button" onClick={() => onExit?.()} title="返回画布" aria-label="返回画布">
              <ChevronLeft size={14} /> 返回画布
            </button>
          )}
          <span className="top-divider" />
          <button onClick={() => loadRef.current?.click()}><FolderOpen size={14} /> 打开</button>
          <button onClick={() => saveProject()}><Save size={14} /> 保存</button>
          <input ref={loadRef} className="visually-hidden" type="file" accept=".json" onChange={loadProject} />
          <span className="top-divider" />
          <AssetMenu onAddPerson={addPerson} onAddPrimitive={addPrimitive} onImport={importModel} />
          <span className="top-divider" />
          <ToolButton icon={Undo2} label="撤销" shortcut="Ctrl+Z" onClick={undo} disabled={!historyRef.current.past.length} />
          <ToolButton icon={Redo2} label="重做" shortcut="Ctrl+Y" onClick={redo} disabled={!historyRef.current.future.length} />
        </nav>
        {/* NOTE: 保存状态灯是有意这样写的，不是 bug。
           saveStatus 为 '保存中…' 时类名留空（点灭），保存完成/已自动保存时显示 .live（绿灯）。
           设计取舍：进行中是"安静"态，完成才点亮确认，避免每次自动保存闪烁。
           不要改成"保存中才亮"，除非产品明确要呼吸/加载指示。 */}
        <div className="project-title"><i className={`status-dot ${saveStatus === '保存中…' ? '' : 'live'}`} /><span className="project-title-name">{settings.name}</span><small>{activeShot?.name} · {saveStatus}</small></div>
        <div className="export-actions">
          <button className="project-export-button" onClick={() => saveProject({ download: true })} disabled={exporting || capturingImage}><Download size={14} /> 导出工程</button>
          <button className="project-export-button capture-image-button" onClick={handleCaptureImage} disabled={exporting || capturingImage}><FileImage size={14} /> {capturingImage ? '截图中…' : '截图'}</button>
          <button className="export-button" onClick={handleExportMp4} disabled={exporting || capturingImage}><FileVideo2 size={14} /> {exporting ? `${exportProgress}%` : '导出 MP4'}</button>
        </div>
      </header>

      <div className="workspace">
        {/* NOTE: onToggleVisible 的 `?.visible === false` 写法等价于 `!visible`，逻辑正确，不是 bug。
           可见(visible 为 undefined/true) → `undefined === false` 为 false → 设为 false(隐藏)；
           隐藏(visible === false)        → `false === false` 为 true  → 设为 true(显示)。
           之前审查曾误判为"写反"，实为正确。如需更直观可改写为 `!objects.find(...).visible`。 */}
        <MemoLeftSidebar objects={objects} selectedId={selectedId} onSelect={setSelectedId} onToggleVisible={id => updateObjectById(id, { visible: objects.find(item => item.id === id)?.visible === false })} onToggleLock={id => updateObjectById(id, { locked: !objects.find(item => item.id === id)?.locked })} shots={displayedShots} activeShotId={activeShotId} onSelectShot={switchShot} onAddShot={addShot} onDuplicateShot={duplicateShot} onDeleteShot={deleteShot} onRenameShot={renameShot} onCaptureShot={captureShotThumbnail} />
        <section className="viewport-shell">
          <div className="viewport-toolbar floating-panel">
            <ToolButton icon={MousePointer2} label="选择" active={!['translate', 'rotate', 'scale'].includes(transformMode)} onClick={() => setTransformMode('select')} shortcut="Q" />
            <span />
            <ToolButton icon={Move3D} label="移动" active={transformMode === 'translate'} onClick={() => setTransformMode('translate')} shortcut="W" />
            <ToolButton icon={RotateCw} label="旋转" active={transformMode === 'rotate'} onClick={() => setTransformMode('rotate')} shortcut="R" />
            <ToolButton icon={BoxSelect} label="缩放" active={transformMode === 'scale'} onClick={() => setTransformMode('scale')} shortcut="E" />
            <span />
            <ToolButton icon={Axis3D} label={transformSpace === 'world' ? '世界坐标' : '局部坐标'} active={transformSpace === 'local'} disabled={transformMode === 'select'} onClick={() => setTransformSpace(space => space === 'world' ? 'local' : 'world')} />
            <ToolButton icon={Magnet} label={snapEnabled ? '关闭吸附' : '开启吸附'} active={snapEnabled} disabled={transformMode === 'select'} onClick={() => setSnapEnabled(value => !value)} />
            <span />
            <ToolButton icon={ImagePlus} label={reference.image ? '更换背景图' : '上传背景图'} active={Boolean(reference.image)} onClick={() => referenceFileRef.current?.click()} />
            <span />
            <ToolButton icon={PenLine} label="编辑曲线" active={pathEditing} onClick={togglePathEditor} />
          </div>
          {pathMenuOpen && (
            <div className="floating-panel reference-panel path-panel">
              <label><span>起点</span><input type="range" min="0" max={settings.durationSeconds} step="0.5" value={pathTiming.startSec} onChange={e => updatePathTiming({ startSec: clamp(Number(e.target.value), 0, settings.durationSeconds) })} /><em>{pathTiming.startSec}s</em></label>
              <label><span>终点</span><input type="range" min="0" max={settings.durationSeconds} step="0.5" value={pathTiming.endSec} onChange={e => updatePathTiming({ endSec: clamp(Number(e.target.value), 0, settings.durationSeconds) })} /><em>{pathTiming.endSec}s</em></label>
              <label><span>帧数</span><input type="range" min="2" max="5" value={pathTiming.keyframeCount} onChange={e => updatePathTiming({ keyframeCount: clamp(Number(e.target.value), 2, 5) })} /><em>{pathTiming.keyframeCount}</em></label>
              <button type="button" className={pathDrawing ? 'is-active' : ''} onClick={togglePathDrawing}>{pathDrawing ? '完成绘制' : '开始绘制'}</button>
              {paths[selectedId] && <button type="button" title="删除整条路径" aria-label="删除整条路径" onClick={clearPath}><Trash2 size={12} /></button>}
            </div>
          )}
          {/* 路径右键菜单：删除此点 / 删除整条曲线（仅编辑态） */}
          {pathContextMenu && (
            <>
              <div className="path-context-backdrop" onMouseDown={closePathContextMenu} onContextMenu={event => { event.preventDefault(); closePathContextMenu() }} />
              <div className="floating-panel path-context-menu" style={{ left: pathContextMenu.x, top: pathContextMenu.y }}>
                <button type="button" disabled={pathContextMenu.index < 0} onClick={() => deletePathPoint(pathContextMenu.index)}>删除此点</button>
                <button type="button" onClick={deleteWholePath} disabled={!paths[selectedId]}>删除整条曲线</button>
              </div>
            </>
          )}
          <input ref={referenceFileRef} className="visually-hidden" type="file" accept="image/*,.png,.jpg,.jpeg,.webp,.bmp,.gif" onChange={handleReferenceUpload} />
          <div className={`viewport-view-options floating-panel ${viewOptionsCollapsed ? 'is-collapsed' : ''}`}>
            {viewOptionsCollapsed ? (
              <button className="view-options-expand" onClick={() => setViewOptionsCollapsed(false)} title="展开视角工具" aria-label="展开视角工具"><ChevronLeft size={14} /></button>
            ) : (
              <>
                <button className={!cameraView ? 'is-active' : ''} onClick={openEditorView} title="使用固定的编辑观察相机自由布置场景"><RotateCw size={14} /> 编辑视角</button>
                <button className={cameraView ? 'is-active' : ''} onClick={openCameraView} title="切换到场景中主摄像机的实际画面"><Camera size={14} /> 摄像机视角</button>
                {cameraView && <button className={cameraAnglePanelOpen ? 'is-active' : ''} onClick={() => setCameraAnglePanelOpen(value => !value)} title="调整参考图视角中的地面和水平线"><SlidersHorizontal size={14} /> 镜头角度</button>}
                <button className="view-options-collapse" onClick={collapseViewOptions} title="收起视角工具" aria-label="收起视角工具"><ChevronRight size={14} /></button>
              </>
            )}
          </div>
          {cameraView && cameraAnglePanelOpen && <CameraAnglePanel camera={camera} onChange={patch => setCamera(current => ({ ...current, ...patch }))} onClose={() => setCameraAnglePanelOpen(false)} onLevel={levelCameraHorizon} />}
          <ReferenceOverlay reference={reference} onChange={setReference} cameraMode={cameraView} cameraAspect={previewAspect}>
            <div className="viewport-canvas-layer">
              <MainViewport key={cameraView ? 'shot-view' : 'scene-view'} cameraView={cameraView} cameraAspect={previewAspect} editorCameraData={editorView} onEditorCameraChange={captureEditorView} onGizmoReady={api => { gizmoApiRef.current = api }} objects={animatedObjects} animationTime={currentFrame / fps} selectedId={selectedId} activeJoint={selectedJoint} onSelect={setSelectedId} onJointSelect={(objectId, jointId) => { setSelectedId(objectId); setSelectedJoint(jointId) }} transformMode={transformMode} transformSpace={transformSpace} snapEnabled={snapEnabled} groundRequest={groundRequest} onUpdateObject={updateObjectById} cameraData={displayCamera} onUpdateCamera={patch => setCamera(current => ({ ...current, ...patch }))} lighting={lighting} showGrid={showGrid} performanceMode={performanceMode} seamlessBackground={seamlessBackground} focusRequest={viewFocusRequest} referenceVisible={Boolean(reference.image && reference.visible)} pathEditing={pathEditing} pathDrawing={pathDrawing} pathDraft={pathDraft} pathAnchorY={pathAnchorY} pathDensity={pathTiming.density} onPathChange={commitPathPoints} onClearPath={clearPath} onContextMenuAt={openPathContextMenu} />
            </div>
          </ReferenceOverlay>

          <div className={`camera-monitor is-${monitorMode}`}>
            <div className="monitor-head"><div><Video size={13} /><strong>主摄像机 01</strong></div><div className="monitor-head-actions">
              {monitorMode === 'minimized' ? <button title="恢复摄像机窗口" onClick={() => setMonitorMode('normal')}><Maximize2 size={13} /></button> : <>
                <button title="选择场景中的主摄像机" onClick={() => setSelectedId(CAMERA_ID)}><Camera size={12} /></button>
                <button title="最小化摄像机窗口" onClick={() => setMonitorMode('minimized')}><Minus size={13} /></button>
                <button title={monitorMode === 'expanded' ? '恢复摄像机窗口大小' : '放大摄像机窗口'} onClick={() => setMonitorMode(mode => mode === 'expanded' ? 'normal' : 'expanded')}>{monitorMode === 'expanded' ? <Minimize2 size={13} /> : <Maximize2 size={13} />}</button>
                <button title="切换到摄像机视角" onClick={openCameraView}><ZoomIn size={13} /></button>
              </>}
            </div></div>
            {monitorMode !== 'minimized' && <div className="monitor-frame">
              <div className={`monitor-canvas ${previewAspectClass}`} style={{ '--preview-aspect': previewAspect } as React.CSSProperties}>
                <CameraPreview objects={animatedObjects} animationTime={currentFrame / fps} cameraData={displayCamera} cameraAspect={previewAspect} lighting={lighting} performanceMode={performanceMode} seamlessBackground={seamlessBackground} backgroundCanvas={monitorReferenceBackground} onCanvasReady={canvas => { monitorCanvasRef.current = canvas }} />
                <span className="safe-frame" />
                <span className="monitor-timecode">{timecodeAtFrame(currentFrame, fps)}</span>
                <span className="monitor-focal">{Math.round(displayCamera.focalLength)} mm · {aspectLabel(displayCamera.aspectRatio)}</span>
              </div>
            </div>}
          </div>
        </section>
        <MemoInspector selected={inspectorSelected} objects={objects} camera={camera} cameraAspect={camera.aspectRatio} onAspectChange={aspectRatio => setCamera(current => ({ ...current, aspectRatio }))} projectSettings={settings} onApplySettings={applySettings} maxKeyframeFrame={maxKeyframeFrame} showGrid={showGrid} onToggleGrid={() => setShowGrid(value => !value)} performanceMode={performanceMode} onTogglePerformance={() => setPerformanceMode(value => !value)} seamlessBackground={seamlessBackground} onToggleSeamless={() => setSeamlessBackground(value => !value)} lighting={lighting} onLightingChange={setLighting} selectedJoint={selectedJoint} customPoses={customPoses} onSelectJoint={setSelectedJoint} onUpdateObject={updateSelected} onUpdateCamera={patch => setCamera(current => ({ ...current, ...patch }))} onDelete={deleteSelected} onDuplicate={duplicateSelected} onFocus={focusSelected} onToggleLock={() => activeObject && updateSelected({ locked: !activeObject.locked })} onGround={groundSelected} onResetRotation={resetSelectedRotation} onResetScale={resetSelectedScale} onSaveCustomPose={saveCustomPose} onApplyCustomPose={applyCustomPose} onDeleteCustomPose={deleteCustomPose} />
        <Timeline
          currentFrame={currentFrame}
          fps={fps}
          totalFrames={totalFrames}
          onSeek={seekToFrame}
          playing={playing}
          onTogglePlay={togglePlayback}
          keyframes={snapshotKeysForTrack(keyframes, 'camera')}
          onAddKeyframe={addKeyframe}
          onDeleteKeyframe={deleteKeyframe}
          objectTrack={activeObject ? { id: activeObject.id, name: activeObject.name, type: activeObject.type, continuousMotion: activeObject.continuousMotion, keyframes: snapshotKeysForTrack(characterKeyframes[activeObject.id], activeObject.type) } : null}
          onAddObjectKeyframe={addObjectKeyframe}
          onDeleteObjectKeyframe={deleteObjectKeyframe}
          selectedKeyframe={selectedKeyframeInfo}
          onSelectKeyframe={setSelectedKeyframe}
          onMoveKeyframe={moveKeyframe}
          onMoveKeyframes={moveKeyframes}
          onDeleteKeyframes={deleteKeyframes}
          onDeleteSelectedKeyframe={deleteSelectedKeyframe}
          onCopyKeyframe={copySelectedKeyframe}
          onChangeInterpolationAt={changeKeyframeInterpolation}
        />
      </div>
      {capturingImage && (
        <div className="export-render-surface" style={{ width: exportDimensions.width, height: exportDimensions.height }} aria-hidden="true">
          <CameraPreview objects={animatedObjects} animationTime={currentFrame / fps} cameraData={displayCamera} cameraAspect={exportDimensions.width / exportDimensions.height} lighting={lighting} exportMode backgroundCanvas={exportReferenceBackground} onCanvasReady={canvas => { imageCaptureCanvasRef.current = canvas }} />
        </div>
      )}
      {exporting && (
        <>
          <div className="export-render-surface" style={{ width: exportDimensions.width, height: exportDimensions.height }} aria-hidden="true">
            <CameraPreview objects={animatedObjects} animationTime={currentFrame / fps} cameraData={displayCamera} cameraAspect={exportDimensions.width / exportDimensions.height} lighting={lighting} exportMode backgroundCanvas={exportReferenceBackground} onCanvasReady={canvas => { exportCanvasRef.current = canvas }} />
          </div>
          <div className="export-progress-overlay" role="status" aria-live="polite">
            <div className="export-progress-card">
              <FileVideo2 size={20} />
              <div className="export-progress-copy"><strong>正在编码 MP4</strong><span>{exportDimensions.width} × {exportDimensions.height} · {fps} FPS · 第 {Math.round(exportProgress / 100 * totalFrames)} / {totalFrames} 帧</span></div>
              <output>{exportProgress}%</output>
              <div className="export-progress-track"><i style={{ width: `${exportProgress}%` }} /></div>
            </div>
          </div>
        </>
      )}
      <div className="toast-stack">
        {toasts.map(item => {
          const tier = item.level || 'info'
          const Icon = TOAST_ICONS[tier] || Info
          return (
            <div key={item.id} className={`toast toast-${tier}`}>
              <Icon size={12} className="toast-icon" />
              <span className="toast-text">{item.text}</span>
              <button type="button" className="toast-close" onClick={() => dismiss(item.id)} title="关闭"><X size={11} /></button>
            </div>
          )
        })}
      </div>
      {renderConfirm}
    </main>
  )
}

export default Director3DApp
