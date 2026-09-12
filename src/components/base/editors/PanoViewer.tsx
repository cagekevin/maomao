import React, { useImperativeHandle, useEffect, useRef, useCallback } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { PerspectiveCamera, OrbitControls, useTexture } from '@react-three/drei';
import * as THREE from 'three';
import { toAbsoluteFileUrl } from '../utils/assetUrl.ts';

/**
 * 720 全景查看器核心
 *
 * 【依赖】@react-three/fiber@9 + @react-three/drei@10 + three@0.169（React 19）。
 *
 * 【props】
 *  - url            全景图 URL（内部统一经 toAbsoluteFileUrl 归一化，相对 /files/ 也能加载）
 *  - fov            视野角度（滚轮缩放）
 *  - autoRotate     自动漫游（绕水平轴缓慢自转）
 *
 * 【对外能力】ref：
 *  - capture(angles, ratio) 截图，返回 dataURL 数组（WebGLRenderTarget 2560 宽渲染各视角）
 *  - reset()                复位到初始朝向
 *
 * 纹理映射：等距柱状 → EquirectangularReflectionMapping(303)。
 */
export interface PanoViewerProps {
  /** 全景图 URL */
  url: string;
  /** 视野角度（滚轮缩放） */
  fov: number;
  /** 自动漫游（绕 Y 轴缓慢自转） */
  autoRotate?: boolean;
}

/** 对外能力：capture 截图 / reset 复位 */
export interface PanoViewerHandle {
  capture: (angles: number[], ratioStr: string) => Promise<string[]>;
  reset: () => void;
}

/** OrbitControls 实例的最小可用契约（避免引入 three-stdlib 类型，只取用得到的成员）。 */
interface PanoOrbit {
  reset: () => void;
}

/** React 19：ref 作普通 prop 直接解构（替代已废弃的 forwardRef），useImperativeHandle 依然可用。 */
function PanoViewer({
  url,
  fov,
  autoRotate = false,
  ref,
}: PanoViewerProps & { ref?: React.Ref<PanoViewerHandle> }) {
  const { gl, scene, camera } = useThree();
  // 本地 controls 引用（reset 用）。
  const controlsRef = useRef<PanoOrbit | null>(null);
  const setControls = useCallback((e: unknown) => {
    controlsRef.current = (e as PanoOrbit) ?? null;
  }, []);
  // URL 归一化（统一图片出口）：data.assetUrl 可能是相对 /files/ 路径，
  // 直接喂 TextureLoader 会在画布源（localhost:5180）解析失败 → 球体黑屏。
  const texture = useTexture(toAbsoluteFileUrl(url));

  // 纹理设置（复刻官方 Xl.jsx useEffect [s,c,r]）
  useEffect(() => {
    if (texture) {
      texture.mapping = THREE.EquirectangularReflectionMapping;
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.generateMipmaps = true;
      texture.minFilter = THREE.LinearMipmapLinearFilter;
      texture.magFilter = THREE.LinearFilter;
      texture.anisotropy = Math.min(4, gl.capabilities.getMaxAnisotropy());
      texture.needsUpdate = true;
    }
  }, [texture, gl]);

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

  // 每帧：fov 平滑插值
  useFrame(() => {
    if (camera instanceof THREE.PerspectiveCamera) {
      const diff = targetFov.current - camera.fov;
      if (Math.abs(diff) > 0.05) {
        camera.fov += diff * 0.22;
        camera.updateProjectionMatrix();
      }
    }
  });

  // 截图能力（复刻官方 Xl.jsx useImperativeHandle capture）
  useImperativeHandle(ref, () => ({
    reset: () => {
      controlsRef.current?.reset();
    },
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
        // 俯仰限位：留 0.08rad 余量，避免正对天顶/天底时等距柱状图的极点拉伸与朝向抖动。
        minPolarAngle={0.08}
        maxPolarAngle={Math.PI - 0.08}
      />
      <mesh scale={[-1, 1, 1]} renderOrder={-100}>
        <sphereGeometry args={[500, 128, 128]} />
        <meshBasicMaterial
          map={texture}
          side={THREE.BackSide}
          depthTest={false}
          depthWrite={false}
        />
      </mesh>
    </>
  );
}

export default PanoViewer;
