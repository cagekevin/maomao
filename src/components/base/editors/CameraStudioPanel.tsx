/**
 * 摄影棚全屏面板。
 * 3D 视口 + 参数控件，生成摄影棚提示词。
 * 布局：左 3D 视口 | 右参数面板，底部提示词预览 + 操作按钮。
 */
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Camera, Lightbulb, Combine, X, Copy, Check, RotateCcw, Sparkles } from 'lucide-react';
import * as THREE from 'three';
import {
  CAMERA_PRESETS,
  DEFAULT_CAMERA_STATE,
  DEFAULT_LIGHT_STATE,
  LIGHT_PRESETS,
  buildStudioPrompt,
  normalizeCameraYaw,
  type CameraDistance,
  type CameraLens,
  type CameraStudioCameraState,
  type CameraStudioLightState,
  type CameraStudioMode,
  type CameraStudioResult,
  type LightTemperature,
} from './cameraStudio.ts';

// 模块级持久化：跨面板开关保留上一次参数
let _lastCamera: CameraStudioCameraState | null = null;
let _lastLight: CameraStudioLightState | null = null;
let _lastMode: CameraStudioMode | null = null;
let _lastActiveControl: 'camera' | 'lighting' | null = null;

interface CameraStudioPanelProps {
  isOpen: boolean;
  imageUrl?: string;
  onClose: () => void;
  onGenerate: (result: CameraStudioResult) => void;
}

interface StudioViewportProps {
  imageUrl?: string;
  mode: CameraStudioMode;
  activeControl: 'camera' | 'lighting';
  cameraState: CameraStudioCameraState;
  lightState: CameraStudioLightState;
  onCameraChange: (patch: Partial<CameraStudioCameraState>) => void;
  onLightChange: (patch: Partial<CameraStudioLightState>) => void;
}

const DISTANCE_OPTIONS: Array<{ value: CameraDistance; label: string }> = [
  { value: 'far', label: '远景' },
  { value: 'full', label: '全身' },
  { value: 'medium', label: '中景' },
  { value: 'close', label: '近景' },
  { value: 'extreme-close', label: '特写' },
];

const LENS_OPTIONS: CameraLens[] = ['15mm', '24mm', '35mm', '50mm', '85mm', '200mm', 'fisheye'];

const TEMPERATURE_OPTIONS: Array<{ value: LightTemperature; label: string }> = [
  { value: 'cool', label: '冷光' },
  { value: 'neutral', label: '中性' },
  { value: 'warm', label: '暖光' },
];

function sphericalPosition(yaw: number, pitch: number, radius: number): THREE.Vector3 {
  const yawRad = THREE.MathUtils.degToRad(yaw);
  const pitchRad = THREE.MathUtils.degToRad(pitch);
  return new THREE.Vector3(
    Math.sin(yawRad) * Math.cos(pitchRad) * radius,
    Math.sin(pitchRad) * radius,
    Math.cos(yawRad) * Math.cos(pitchRad) * radius,
  );
}

function StudioViewport({
  imageUrl,
  mode,
  activeControl,
  cameraState,
  lightState,
  onCameraChange,
  onLightChange,
}: StudioViewportProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const cameraMarkerRef = useRef<THREE.Group | null>(null);
  const lightMarkerRef = useRef<THREE.Group | null>(null);
  const lightRef = useRef<THREE.PointLight | null>(null);
  const dragRef = useRef<{
    pointerId: number;
    x: number;
    y: number;
    yaw: number;
    pitch: number;
  } | null>(null);
  const cameraStateRef = useRef(cameraState);
  const lightStateRef = useRef(lightState);
  const modeRef = useRef(mode);

  useEffect(() => {
    cameraStateRef.current = cameraState;
    lightStateRef.current = lightState;
    modeRef.current = mode;
  }, [cameraState, lightState, mode]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const initialCamera = cameraStateRef.current;
    const initialLight = lightStateRef.current;
    const initialMode = modeRef.current;

    const scene = new THREE.Scene();
    const renderCamera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
    renderCamera.position.set(0, 0.25, 6.1);
    renderCamera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    mount.appendChild(renderer.domElement);

    const ambient = new THREE.AmbientLight(0xffffff, 1.4);
    scene.add(ambient);

    // 线框球体
    const sphereGeometry = new THREE.SphereGeometry(1.72, 28, 18);
    const sphereMaterial = new THREE.MeshBasicMaterial({
      color: 0x676767,
      wireframe: true,
      transparent: true,
      opacity: 0.38,
    });
    scene.add(new THREE.Mesh(sphereGeometry, sphereMaterial));

    // 圆环
    const ringGeometry = new THREE.TorusGeometry(1.73, 0.008, 8, 96);
    const ringMaterial = new THREE.MeshBasicMaterial({
      color: 0x676767,
      transparent: true,
      opacity: 0.7,
    });
    const horizontalRing = new THREE.Mesh(ringGeometry, ringMaterial);
    horizontalRing.rotation.x = Math.PI / 2;
    scene.add(horizontalRing);
    const verticalRing = new THREE.Mesh(ringGeometry, ringMaterial.clone());
    scene.add(verticalRing);

    // 主体平面
    const subjectGroup = new THREE.Group();
    const subjectBack = new THREE.Mesh(
      new THREE.CircleGeometry(0.83, 48),
      new THREE.MeshBasicMaterial({ color: 0x676767, transparent: true, opacity: 0.24 }),
    );
    subjectGroup.add(subjectBack);
    scene.add(subjectGroup);

    let subjectTexture: THREE.Texture | undefined;
    let disposed = false;
    if (imageUrl) {
      new THREE.TextureLoader().load(
        imageUrl,
        (texture) => {
          if (disposed) {
            texture.dispose();
            return;
          }
          subjectTexture = texture;
          texture.colorSpace = THREE.SRGBColorSpace;
          const material = new THREE.MeshBasicMaterial({
            map: texture,
            transparent: true,
            side: THREE.DoubleSide,
          });
          const plane = new THREE.Mesh(new THREE.PlaneGeometry(1.45, 1.45), material);
          plane.position.z = 0.02;
          subjectGroup.add(plane);
        },
        undefined,
        undefined,
      );
    }

    // ==========================================
    // 摄像机标记 — 极简设计，镜头朝向 +Z 轴（对准中心）
    // ==========================================
    const cameraMarker = new THREE.Group();
    const camBodyMat = new THREE.MeshStandardMaterial({
      color: 0x3d6fd6,
      roughness: 0.45,
      metalness: 0.3,
    });
    const camLensMat = new THREE.MeshStandardMaterial({
      color: 0x24356e,
      roughness: 0.4,
      metalness: 0.5,
    });
    const camRingMat = new THREE.MeshStandardMaterial({
      color: 0xe8c46a,
      roughness: 0.25,
      metalness: 0.85,
    }); // 金色装饰环
    const camGlassMat = new THREE.MeshPhysicalMaterial({
      color: 0x0e3a66,
      roughness: 0.05,
      metalness: 0.6,
      clearcoat: 1.0,
      emissive: 0x1a5fa8,
      emissiveIntensity: 0.45,
    });

    // 核心机身
    const camBody = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.32, 0.16), camBodyMat);

    // 顶部取景器
    const camEVF = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.06, 0.14), camBodyMat);
    camEVF.position.set(0, 0.19, 0);

    // 镜头筒 (放置在 +Z 轴)
    const camLensBarrel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.13, 0.13, 0.22, 32),
      camLensMat,
    );
    camLensBarrel.rotation.x = Math.PI / 2;
    camLensBarrel.position.z = 0.19;

    // 镜头前端金属环
    const camAccentRing = new THREE.Mesh(
      new THREE.CylinderGeometry(0.132, 0.132, 0.015, 32),
      camRingMat,
    );
    camAccentRing.rotation.x = Math.PI / 2;
    camAccentRing.position.z = 0.29;

    // 前镜片 (深邃幽蓝反光)
    const camGlass = new THREE.Mesh(new THREE.CircleGeometry(0.11, 32), camGlassMat);
    camGlass.position.z = 0.301;

    // 金属快门按钮
    const camShutter = new THREE.Mesh(
      new THREE.CylinderGeometry(0.025, 0.025, 0.02, 16),
      camRingMat,
    );
    camShutter.position.set(0.16, 0.17, -0.02);

    cameraMarker.add(camBody, camEVF, camLensBarrel, camAccentRing, camGlass, camShutter);

    cameraMarker.visible = initialMode !== 'lighting';
    cameraMarker.position.copy(sphericalPosition(initialCamera.yaw, initialCamera.pitch, 2.0));
    // lookAt 会将局部 +Z 轴指向目标 (0,0,0)
    cameraMarker.lookAt(0, 0, 0);
    cameraMarker.rotateZ(THREE.MathUtils.degToRad(initialCamera.roll));
    scene.add(cameraMarker);
    cameraMarkerRef.current = cameraMarker;

    // ==========================================
    // 光源标记 — 悬浮式极简常亮面板 (无支架)
    // ==========================================
    const lightMarker = new THREE.Group();
    const lightFrameMat = new THREE.MeshStandardMaterial({
      color: 0xd06a28,
      roughness: 0.55,
      metalness: 0.25,
    });
    const lightMountMat = new THREE.MeshStandardMaterial({
      color: 0x9c4a1a,
      roughness: 0.5,
      metalness: 0.4,
    });

    // 纤薄外框
    const lightFrame = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.36, 0.025), lightFrameMat);

    // 背部散热 / 挂载模块
    const lightBackMount = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 0.03), lightMountMat);
    lightBackMount.position.z = -0.025;

    // 发光面板 (放置在 +Z 轴朝向中心)
    const lightPanel = new THREE.Mesh(
      new THREE.PlaneGeometry(0.48, 0.32),
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        emissive: 0xffd98a,
        emissiveIntensity: 1.8,
        roughness: 1.0,
        metalness: 0,
        side: THREE.DoubleSide,
      }),
    );
    lightPanel.position.z = 0.013;

    lightMarker.add(lightFrame, lightBackMount, lightPanel);

    lightMarker.visible = initialMode !== 'camera';
    const initialLightPos = sphericalPosition(initialLight.yaw, initialLight.pitch, 2.0);
    lightMarker.position.copy(initialLightPos);
    // lookAt 会将局部 +Z 轴 (发光面) 指向目标 (0,0,0)
    lightMarker.lookAt(0, 0, 0);
    scene.add(lightMarker);
    lightMarkerRef.current = lightMarker;

    // 点光源
    const keyLight = new THREE.PointLight(0xffdd88, 2.5, 12);
    keyLight.position.copy(initialLightPos);
    keyLight.intensity = initialLight.intensity / 24;
    scene.add(keyLight);
    lightRef.current = keyLight;

    const resize = () => {
      const width = Math.max(1, mount.clientWidth);
      const height = Math.max(1, mount.clientHeight);
      renderer.setSize(width, height, false);
      renderCamera.aspect = width / height;
      renderCamera.updateProjectionMatrix();
    };
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(mount);
    resize();

    let animationFrame = 0;
    const render = () => {
      horizontalRing.rotation.z += 0.0008;
      renderer.render(scene, renderCamera);
      animationFrame = requestAnimationFrame(render);
    };
    render();

    return () => {
      disposed = true;
      cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
      cameraMarkerRef.current = null;
      lightMarkerRef.current = null;
      lightRef.current = null;
      subjectTexture?.dispose();
      scene.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return;
        object.geometry.dispose();
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach((m) => m.dispose());
      });
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [imageUrl]);

  useEffect(() => {
    const marker = cameraMarkerRef.current;
    if (!marker) return;
    marker.visible = mode !== 'lighting';
    marker.position.copy(sphericalPosition(cameraState.yaw, cameraState.pitch, 2.0));
    marker.lookAt(0, 0, 0);
    marker.rotateZ(THREE.MathUtils.degToRad(cameraState.roll));
  }, [cameraState.pitch, cameraState.roll, cameraState.yaw, mode]);

  useEffect(() => {
    const marker = lightMarkerRef.current;
    const kl = lightRef.current;
    if (!marker || !kl) return;
    marker.visible = mode !== 'camera';
    const pos = sphericalPosition(lightState.yaw, lightState.pitch, 2.0);
    marker.position.copy(pos);
    marker.lookAt(0, 0, 0);
    kl.position.copy(pos);
    kl.intensity = lightState.intensity / 24;
  }, [lightState.intensity, lightState.pitch, lightState.yaw, mode]);

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      event.currentTarget.setPointerCapture(event.pointerId);
      const target = mode === 'dual' ? activeControl : mode;
      const state = target === 'lighting' ? lightState : cameraState;
      dragRef.current = {
        pointerId: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        yaw: state.yaw,
        pitch: state.pitch,
      };
    },
    [activeControl, cameraState, lightState, mode],
  );

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      const yaw = normalizeCameraYaw(drag.yaw + (event.clientX - drag.x) * 0.45);
      const pitch = Math.max(-80, Math.min(80, drag.pitch - (event.clientY - drag.y) * 0.35));
      const target = mode === 'dual' ? activeControl : mode;
      if (target === 'lighting') onLightChange({ yaw, pitch });
      else onCameraChange({ yaw, pitch });
    },
    [activeControl, mode, onCameraChange, onLightChange],
  );

  const handlePointerUp = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.pointerId !== event.pointerId) return;
    dragRef.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
  }, []);

  return (
    <div
      ref={mountRef}
      className="camera-studio-viewport"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    />
  );
}

interface RangeControlProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  onChange: (value: number) => void;
}

function RangeControl({
  label,
  value,
  min,
  max,
  step = 1,
  suffix = '',
  onChange,
}: RangeControlProps) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-caption text-muted block mb-1 w-12 shrink-0">{label}</span>
      <input
        type="range"
        className="camera-studio-range flex-1"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <span className="text-caption-sm font-medium text-secondary text-right min-w-[32px] shrink-0">
        {Math.round(value * 10) / 10}
        {suffix}
      </span>
    </div>
  );
}

function CameraStudioPanel({ isOpen, imageUrl, onClose, onGenerate }: CameraStudioPanelProps) {
  const [mode, setMode] = useState<CameraStudioMode>(() => _lastMode ?? 'camera');
  const [activeControl, setActiveControl] = useState<'camera' | 'lighting'>(
    () => _lastActiveControl ?? 'camera',
  );
  const [cameraState, setCameraState] = useState<CameraStudioCameraState>(() =>
    _lastCamera ? { ..._lastCamera } : { ...DEFAULT_CAMERA_STATE },
  );
  const [lightState, setLightState] = useState<CameraStudioLightState>(() =>
    _lastLight ? { ..._lastLight } : { ...DEFAULT_LIGHT_STATE },
  );
  const [copied, setCopied] = useState(false);

  const prompt = useMemo(
    () => buildStudioPrompt(mode, cameraState, lightState),
    [cameraState, lightState, mode],
  );

  const updateCamera = useCallback((patch: Partial<CameraStudioCameraState>) => {
    setCameraState((prev) => {
      const next = { ...prev, ...patch };
      _lastCamera = next;
      return next;
    });
  }, []);

  const updateLight = useCallback((patch: Partial<CameraStudioLightState>) => {
    setLightState((prev) => {
      const next = { ...prev, ...patch };
      _lastLight = next;
      return next;
    });
  }, []);

  const handleModeChange = useCallback((nextMode: CameraStudioMode) => {
    setMode(nextMode);
    _lastMode = nextMode;
    if (nextMode !== 'dual') {
      setActiveControl(nextMode);
      _lastActiveControl = nextMode;
    }
  }, []);

  const handleReset = useCallback(() => {
    _lastCamera = _lastLight = _lastMode = _lastActiveControl = null;
    setCameraState({ ...DEFAULT_CAMERA_STATE });
    setLightState({ ...DEFAULT_LIGHT_STATE });
    setMode('camera');
    setActiveControl('camera');
  }, []);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }, [prompt]);

  const handleGenerate = useCallback(() => {
    onGenerate({ mode, camera: cameraState, light: lightState, prompt });
  }, [cameraState, lightState, mode, onGenerate, prompt]);

  // Esc 关闭
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const showCamera = mode === 'camera' || (mode === 'dual' && activeControl === 'camera');

  return createPortal(
    <div
      className="fixed inset-0 z-ceiling-2 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4"
      onMouseDown={(e) => e.stopPropagation()}
      onWheel={(e) => e.stopPropagation()}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="relative bg-surface-raised border border-edge rounded-xl shadow-2xl flex flex-col overflow-hidden"
        style={{
          width: 'min(96vw, 1180px)',
          height: 'min(90vh, 760px)',
          maxWidth: '98vw',
          maxHeight: '98vh',
        }}
      >
        {/* ===== 顶部栏 ===== */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-edge-faint bg-surface-1 flex-shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-sm text-primary font-medium">摄影棚</span>
            {/* 模式 Tab */}
            <div
              className="flex gap-0 bg-surface rounded-lg p-0.5 border border-edge"
              role="tablist"
              aria-label="摄影棚模式"
            >
              <button
                type="button"
                role="tab"
                className={`flex-1 px-2.5 py-1.5 text-caption-sm text-center whitespace-nowrap cursor-pointer transition-colors border-none bg-transparent flex items-center justify-center gap-1 hover:text-primary hover:bg-surface-hover rounded-md ${mode === 'camera' ? 'text-strong bg-surface-raised border border-edge' : 'text-muted'}`}
                onClick={() => handleModeChange('camera')}
              >
                <Camera size={13} />
                摄影机
              </button>
              <button
                type="button"
                role="tab"
                className={`flex-1 px-2.5 py-1.5 text-caption-sm text-center whitespace-nowrap cursor-pointer transition-colors border-none bg-transparent flex items-center justify-center gap-1 hover:text-primary hover:bg-surface-hover rounded-md ${mode === 'lighting' ? 'text-strong bg-surface-raised border border-edge' : 'text-muted'}`}
                onClick={() => handleModeChange('lighting')}
              >
                <Lightbulb size={13} />
                打光
              </button>
              <button
                type="button"
                role="tab"
                className={`flex-1 px-2.5 py-1.5 text-caption-sm text-center whitespace-nowrap cursor-pointer transition-colors border-none bg-transparent flex items-center justify-center gap-1 hover:text-primary hover:bg-surface-hover rounded-md ${mode === 'dual' ? 'text-strong bg-surface-raised border border-edge' : 'text-muted'}`}
                onClick={() => handleModeChange('dual')}
              >
                <Combine size={13} />
                联动
              </button>
            </div>
          </div>
          <button
            className="p-1.5 text-secondary hover:text-white hover:bg-white/10 rounded transition-colors"
            onClick={onClose}
            title="关闭"
          >
            <X size={16} />
          </button>
        </div>

        {/* ===== 主体内容 ===== */}
        <div className="flex flex-1 min-h-0">
          {/* 左侧：3D 视口 */}
          <div className="flex-1 relative flex flex-col min-w-0">
            {/* 联动模式下的焦点切换 */}
            {mode === 'dual' && (
              <div className="absolute top-2 left-1/2 -translate-x-1/2 z-10 flex gap-1 bg-black/50 rounded-lg p-0.5">
                <button
                  type="button"
                  className={`px-2.5 py-1 rounded-md text-caption-sm transition-colors ${
                    activeControl === 'camera'
                      ? 'bg-surface-hover text-white'
                      : 'text-muted hover:text-primary'
                  }`}
                  onClick={() => setActiveControl('camera')}
                >
                  摄影机
                </button>
                <button
                  type="button"
                  className={`px-2.5 py-1 rounded-md text-caption-sm transition-colors ${
                    activeControl === 'lighting'
                      ? 'bg-surface-hover text-white'
                      : 'text-muted hover:text-primary'
                  }`}
                  onClick={() => setActiveControl('lighting')}
                >
                  主光源
                </button>
              </div>
            )}
            <StudioViewport
              imageUrl={imageUrl}
              mode={mode}
              activeControl={activeControl}
              cameraState={cameraState}
              lightState={lightState}
              onCameraChange={updateCamera}
              onLightChange={updateLight}
            />
          </div>

          {/* 右侧：参数面板 */}
          <aside className="w-60 flex-shrink-0 border-l border-edge-faint bg-surface-1 flex flex-col">
            <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-3">
              {showCamera ? (
                <>
                  {/* 摄影机参数 */}
                  <div className="flex items-center gap-1.5 text-caption-sm text-secondary">
                    <Camera size={13} className="text-blue-400" />
                    <span>摄影机参数</span>
                  </div>

                  {/* 预设按钮 */}
                  <div className="grid grid-cols-2 gap-1.5">
                    {CAMERA_PRESETS.map((preset) => (
                      <button
                        key={preset.id}
                        type="button"
                        className="px-1.5 py-1 rounded text-caption-sm border border-edge text-muted hover:text-primary hover:border-edge-strong hover:bg-surface-hover transition-colors bg-surface"
                        onClick={() =>
                          updateCamera({
                            yaw: preset.yaw,
                            pitch: preset.pitch,
                            roll: preset.roll ?? 0,
                            ...(preset.lens ? { lens: preset.lens } : {}),
                          })
                        }
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>

                  {/* 滑杆 */}
                  <div className="space-y-2">
                    <RangeControl
                      label="水平角度"
                      value={cameraState.yaw}
                      min={-180}
                      max={180}
                      suffix="°"
                      onChange={(yaw) => updateCamera({ yaw })}
                    />
                    <RangeControl
                      label="垂直角度"
                      value={cameraState.pitch}
                      min={-80}
                      max={80}
                      suffix="°"
                      onChange={(pitch) => updateCamera({ pitch })}
                    />
                    <RangeControl
                      label="画面倾斜"
                      value={cameraState.roll}
                      min={-45}
                      max={45}
                      suffix="°"
                      onChange={(roll) => updateCamera({ roll })}
                    />
                  </div>

                  {/* 下拉选择 */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-caption text-muted block mb-1">景别</span>
                      <select
                        className="bg-surface-hover border border-edge rounded-md px-2 py-1 text-caption-sm text-primary cursor-pointer outline-none w-full hover:border-edge-strong focus:border-edge-strong"
                        value={cameraState.distance}
                        onChange={(e) =>
                          updateCamera({ distance: e.target.value as CameraDistance })
                        }
                      >
                        {DISTANCE_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <span className="text-caption text-muted block mb-1">镜头</span>
                      <select
                        className="bg-surface-hover border border-edge rounded-md px-2 py-1 text-caption-sm text-primary cursor-pointer outline-none w-full hover:border-edge-strong focus:border-edge-strong"
                        value={cameraState.lens}
                        onChange={(e) => updateCamera({ lens: e.target.value as CameraLens })}
                      >
                        {LENS_OPTIONS.map((lens) => (
                          <option key={lens} value={lens}>
                            {lens}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* 开关 */}
                  <label className="flex items-center gap-2 cursor-pointer">
                    <div
                      className={`camera-studio-toggle ${cameraState.promptEnhance ? 'is-on' : ''}`}
                      onClick={() => updateCamera({ promptEnhance: !cameraState.promptEnhance })}
                    />
                    <span className="text-caption-sm text-muted">电影感增强</span>
                  </label>
                </>
              ) : (
                <>
                  {/* 主光源参数 */}
                  <div className="flex items-center gap-1.5 text-caption-sm text-secondary">
                    <Lightbulb size={13} className="text-red-400" />
                    <span>主光源参数</span>
                  </div>

                  {/* 预设按钮 */}
                  <div className="grid grid-cols-2 gap-1.5">
                    {LIGHT_PRESETS.map((preset) => (
                      <button
                        key={preset.id}
                        type="button"
                        className="px-1.5 py-1 rounded text-caption-sm border border-edge text-muted hover:text-primary hover:border-edge-strong hover:bg-surface-hover transition-colors bg-surface"
                        onClick={() => updateLight({ yaw: preset.yaw, pitch: preset.pitch })}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>

                  {/* 滑杆 */}
                  <div className="space-y-2">
                    <RangeControl
                      label="水平角度"
                      value={lightState.yaw}
                      min={-180}
                      max={180}
                      suffix="°"
                      onChange={(yaw) => updateLight({ yaw })}
                    />
                    <RangeControl
                      label="垂直角度"
                      value={lightState.pitch}
                      min={-80}
                      max={80}
                      suffix="°"
                      onChange={(pitch) => updateLight({ pitch })}
                    />
                    <RangeControl
                      label="光照强度"
                      value={lightState.intensity}
                      min={10}
                      max={100}
                      suffix="%"
                      onChange={(intensity) => updateLight({ intensity })}
                    />
                  </div>

                  {/* 色温 */}
                  <div>
                    <span className="text-caption text-muted block mb-1">色温</span>
                    <div className="flex gap-1">
                      {TEMPERATURE_OPTIONS.map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          className={`flex-1 px-2 py-1 rounded text-caption-sm border transition-colors ${
                            lightState.temperature === opt.value
                              ? 'bg-blue-500/15 border-blue-500/60 text-blue-300'
                              : 'border-edge text-muted hover:text-primary hover:border-edge-strong hover:bg-surface-hover'
                          }`}
                          onClick={() => updateLight({ temperature: opt.value })}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 开关 */}
                  <div className="flex gap-3">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <div
                        className={`camera-studio-toggle ${lightState.fillLight ? 'is-on' : ''}`}
                        onClick={() => updateLight({ fillLight: !lightState.fillLight })}
                      />
                      <span className="text-caption-sm text-muted">柔和补光</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <div
                        className={`camera-studio-toggle ${lightState.rimLight ? 'is-on' : ''}`}
                        onClick={() => updateLight({ rimLight: !lightState.rimLight })}
                      />
                      <span className="text-caption-sm text-muted">轮廓光</span>
                    </label>
                  </div>
                </>
              )}
            </div>

            {/* 底部操作区 */}
            <div className="border-t border-edge-faint p-3 space-y-2 bg-surface">
              {/* 提示词预览 */}
              <div className="bg-surface-strong border border-edge rounded-lg px-3 py-2.5 text-caption-sm leading-relaxed text-body min-h-[60px] max-h-20 overflow-y-auto break-words whitespace-pre-wrap">
                {prompt}
              </div>
              {/* 按钮 */}
              <div className="flex items-center gap-2 whitespace-nowrap">
                <button
                  type="button"
                  className="flex items-center gap-1 px-2 py-1.5 rounded text-caption-sm text-muted hover:text-primary hover:bg-surface-hover border border-edge transition-colors"
                  onClick={handleCopy}
                  title={copied ? '已复制' : '复制提示词'}
                >
                  {copied ? <Check size={13} className="text-green-400" /> : <Copy size={13} />}
                  <span>{copied ? '已复制' : '复制'}</span>
                </button>
                <button
                  type="button"
                  className="flex items-center gap-1 px-2 py-1.5 rounded text-caption-sm text-muted hover:text-primary hover:bg-surface-hover border border-edge transition-colors"
                  onClick={handleReset}
                  title="重置参数"
                >
                  <RotateCcw size={13} />
                  <span>重置</span>
                </button>
                <div className="flex-1" />
                <button
                  type="button"
                  className="flex items-center gap-1 px-2 py-1.5 rounded text-caption-sm text-muted hover:text-primary hover:bg-surface-hover border border-edge transition-colors"
                  onClick={handleGenerate}
                >
                  <Sparkles size={13} />
                  <span>生成图片</span>
                </button>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export default memo(CameraStudioPanel);
