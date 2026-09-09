import React, { useImperativeHandle, useEffect, useRef, useCallback } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { PerspectiveCamera, OrbitControls, useTexture } from '@react-three/drei';
import * as THREE from 'three';
import { toAbsoluteFileUrl } from '../utils/imageUrl.ts';

/**
 * 720 全景查看器核心
 *
 * 【依赖】@react-three/fiber@9 + @react-three/drei@10 + three@0.169（React 19）。
 *
 * 【props】
 *  - url            全景图 URL（内部统一经 toAbsoluteFileUrl 归一化，相对 /files/ 也能加载）
 *  - panoType       'sphere'（球状）| 'cylinder'（柱状）
 *  - fov            视野角度（滚轮缩放）
 *  - highQuality    高画质（各向异性 = 显卡最大）
 *  - orbitControlsRefLocal  外部 OrbitControls ref（供外壳全屏漫游时控制）
 *  - autoRotate     自动漫游（绕水平轴缓慢自转）
 *  - onViewChange   视角变化回传（节流 ~80ms，供 HUD 罗盘/角度显示，避免每帧 setState）
 *
 * 【对外能力】ref：
 *  - capture(angles, ratio) 截图，返回 dataURL 数组（WebGLRenderTarget 2560 宽渲染各视角）
 *  - reset()                复位到初始朝向
 *  - getView()              读取当前 { yaw, pitch }（度）
 *
 * 纹理映射（对齐官方）：cylinder→UVMapping(300)，sphere→EquirectangularReflectionMapping(303)。
 */
export interface PanoViewerProps {
  /** 全景图 URL */
  url: string;
  /** 'sphere'（球状）| 'cylinder'（柱状） */
  panoType: 'sphere' | 'cylinder';
  /** 视野角度（滚轮缩放） */
  fov: number;
  /** 高画质（各向异性 = 显卡最大） */
  highQuality: boolean;
  /** 外部 OrbitControls ref（供外壳全屏漫游时控制） */
  orbitControlsRefLocal?: React.MutableRefObject<unknown> | null;
  /** 自动漫游（绕 Y 轴缓慢自转） */
  autoRotate?: boolean;
  /** 视角变化回传（节流 ~80ms） */
  onViewChange?: (v: PanoView) => void;
}

/** 当前视角（度）：yaw 方位角 0~360，pitch 俯仰角 -90~90 */
export interface PanoView {
  yaw: number;
  pitch: number;
}

/** 对外能力：capture 截图 / reset 复位 / getView 读视角 */
export interface PanoViewerHandle {
  capture: (angles: number[], ratioStr: string) => Promise<string[]>;
  reset: () => void;
  getView: () => PanoView;
}

/** OrbitControls 实例的最小可用契约（避免引入 three-stdlib 类型，只取用得到的成员）。 */
interface PanoOrbit {
  getAzimuthalAngle: () => number;
  getPolarAngle: () => number;
  reset: () => void;
}

/** 从 OrbitControls 读当前视角：azimuth→yaw(0~360)，polar→pitch(-90~90，水平为 0)。 */
function readView(c: PanoOrbit): PanoView {
  const rawYaw = THREE.MathUtils.radToDeg(c.getAzimuthalAngle());
  const yaw = ((rawYaw % 360) + 360) % 360;
  const pitch = 90 - THREE.MathUtils.radToDeg(c.getPolarAngle());
  return { yaw: Math.round(yaw), pitch: Math.round(pitch) };
}

/** React 19：ref 作普通 prop 直接解构（替代已废弃的 forwardRef），useImperativeHandle 依然可用。 */
function PanoViewer({
  url,
  panoType,
  fov,
  highQuality,
  orbitControlsRefLocal,
  autoRotate = false,
  onViewChange,
  ref,
}: PanoViewerProps & { ref?: React.Ref<PanoViewerHandle> }) {
  const { gl, scene, camera } = useThree();
  // 本地 controls 引用（reset / 读视角用）；同时回写给外部 ref，保持原契约不变。
  const controlsRef = useRef<PanoOrbit | null>(null);
  const setControls = useCallback(
    (e: unknown) => {
      controlsRef.current = (e as PanoOrbit) ?? null;
      if (orbitControlsRefLocal) orbitControlsRefLocal.current = e;
    },
    [orbitControlsRefLocal],
  );
  // URL 归一化（统一图片出口）：data.imageUrl 可能是相对 /files/ 路径，
  // 直接喂 TextureLoader 会在画布源（localhost:5180）解析失败 → 球体黑屏。
  const texture = useTexture(toAbsoluteFileUrl(url));

  // 纹理设置（复刻官方 Xl.jsx useEffect [s,c,r]）
  useEffect(() => {
    if (texture) {
      texture.mapping =
        panoType === 'cylinder' ? THREE.UVMapping : THREE.EquirectangularReflectionMapping;
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.generateMipmaps = true;
      texture.minFilter = THREE.LinearMipmapLinearFilter;
      texture.magFilter = THREE.LinearFilter;
      texture.anisotropy = highQuality
        ? gl.capabilities.getMaxAnisotropy()
        : Math.min(4, gl.capabilities.getMaxAnisotropy());
      texture.needsUpdate = true;
    }
  }, [texture, gl, panoType, highQuality]);

  // 同步 fov：首帧直接对齐（避免开场插值），之后由 useFrame 平滑插值到目标值。
  // 为什么平滑：滚轮/滑块改 fov 若逐帧跳变，视觉上是"闪一下"，插值后才是镜头推拉感。
  const targetFov = useRef(fov);
  const fovInited = useRef(false);
  useEffect(() => {
    targetFov.current = fov;
    if (!fovInited.current && camera instanceof THREE.PerspectiveCamera) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
      fovInited.current = true;
    }
  }, [fov, camera]);

  // 每帧：①fov 平滑插值 ②视角节流回传（HUD 罗盘/角度）
  const lastReport = useRef(0);
  useFrame(() => {
    if (camera instanceof THREE.PerspectiveCamera) {
      const diff = targetFov.current - camera.fov;
      if (Math.abs(diff) > 0.05) {
        camera.fov += diff * 0.22;
        camera.updateProjectionMatrix();
      }
    }
    const c = controlsRef.current;
    if (c && onViewChange) {
      const now = performance.now();
      if (now - lastReport.current >= 80) {
        lastReport.current = now;
        onViewChange(readView(c));
      }
    }
  });

  // 截图能力（复刻官方 Xl.jsx useImperativeHandle capture）
  useImperativeHandle(ref, () => ({
    reset: () => {
      const c = controlsRef.current;
      if (!c) return;
      c.reset();
      onViewChange?.(readView(c));
    },
    getView: () => (controlsRef.current ? readView(controlsRef.current) : { yaw: 0, pitch: 0 }),
    capture: async (angles, ratioStr) => {
      const out = [];
      // 用「当前真实 fov」而非目标 fov：fov 是平滑插值的，用户看到什么就截什么（WYSIWYG）。
      const shotFov = camera instanceof THREE.PerspectiveCamera ? camera.fov : fov;
      const [rw, rh] = ratioStr.split('/').map(Number);
      const aspect = rw && rh ? rw / rh : 16 / 9;
      const width = 2560;
      const height = Math.round(width / aspect);
      const target = new THREE.WebGLRenderTarget(width, height, {
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
        format: THREE.RGBAFormat,
        samples: 4,
      });
      target.texture.colorSpace = THREE.SRGBColorSpace;
      const shotCam = new THREE.PerspectiveCamera(shotFov, width / height, 0.1, 2000);
      shotCam.position.set(0, 0, 0);
      shotCam.up.set(0, 1, 0);
      shotCam.updateProjectionMatrix();
      const prevTarget = gl.getRenderTarget();
      try {
        for (const deg of angles) {
          const rad = THREE.MathUtils.degToRad(deg);
          shotCam.lookAt(Math.sin(rad), 0, -Math.cos(rad));
          shotCam.updateMatrixWorld(true);
          gl.setRenderTarget(target);
          gl.clear(true, true, true);
          gl.render(scene, shotCam);
          const pixels = new Uint8Array(width * height * 4);
          gl.readRenderTargetPixels(target, 0, 0, width, height, pixels);
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            const imgData = ctx.createImageData(width, height);
            for (let y = 0; y < height; y++) {
              for (let x = 0; x < width; x++) {
                const src = (y * width + x) * 4;
                const dst = ((height - 1 - y) * width + x) * 4;
                imgData.data[dst] = pixels[src];
                imgData.data[dst + 1] = pixels[src + 1];
                imgData.data[dst + 2] = pixels[src + 2];
                imgData.data[dst + 3] = 255;
              }
            }
            ctx.putImageData(imgData, 0, 0);
            out.push(canvas.toDataURL('image/jpeg', 0.95));
          }
        }
      } finally {
        // 异常路径也要恢复渲染目标并释放 RT，避免画布被污染 / RT 泄漏
        gl.setRenderTarget(prevTarget);
        target.dispose();
      }
      return out;
    },
  }));

  return (
    <>
      {/* fov 不传 prop：交给 useFrame 平滑插值（传了会在 prop 变化时瞬间跳变，失去推拉感）。
          初始值由上面的 useEffect 首帧对齐。 */}
      <PerspectiveCamera makeDefault position={[0, 0, 0.1]} />
      <OrbitControls
        ref={setControls}
        enableZoom={false}
        enablePan={false}
        enableDamping
        dampingFactor={0.08}
        rotateSpeed={-0.42}
        autoRotate={autoRotate}
        autoRotateSpeed={0.45}
        // 俯仰限位：柱状只有一圈画面（半高=半径→±45°），越界会看到柱面外的空洞；
        // 球状留 0.08rad 余量，避免正对天顶/天底时等距柱状图的极点拉伸与朝向抖动。
        minPolarAngle={panoType === 'cylinder' ? Math.PI / 4 : 0.08}
        maxPolarAngle={panoType === 'cylinder' ? Math.PI - Math.PI / 4 : Math.PI - 0.08}
      />
      {panoType === 'cylinder' ? (
        <mesh scale={[-1, 1, 1]} renderOrder={-100}>
          <cylinderGeometry args={[500, 500, 1000, 128, 1, true]} />
          <meshBasicMaterial
            map={texture}
            side={THREE.BackSide}
            depthTest={false}
            depthWrite={false}
          />
        </mesh>
      ) : (
        <mesh scale={[-1, 1, 1]} renderOrder={-100}>
          <sphereGeometry args={[500, 128, 128]} />
          <meshBasicMaterial
            map={texture}
            side={THREE.BackSide}
            depthTest={false}
            depthWrite={false}
          />
        </mesh>
      )}
    </>
  );
}

export default PanoViewer;
