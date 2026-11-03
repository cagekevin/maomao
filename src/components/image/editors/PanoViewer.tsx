import React, { useImperativeHandle, useEffect, useRef, useCallback } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { PerspectiveCamera, OrbitControls, useTexture } from '@react-three/drei';
import * as THREE from 'three';
import { toAbsoluteFileUrl } from '@/components/base/utils/media/assetUrl';
import { canvasToImageDataUrl } from '@/components/base/core/utils';

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
 *  - getView()              读当前画面朝向（yaw/pitch），即用户此刻看到的方向
 *  - capture(views, ratio)  按给定朝向逐张截图，返回 dataURL 数组（WebGLRenderTarget 2560 宽）
 *  - reset()                复位到初始朝向
 *
 * 【朝向语义】yawDeg：绕 Y 轴，0 = 看向 -Z（球体贴图的接缝正前方）；pitchDeg：抬头为正。
 * 更新(2026-11-02)：原 capture(angles: number[], …) 只认水平角、pitch 恒 0，且调用方一律传 [0]，
 * 导致「当前视角/截图」两个按钮永远输出默认朝向。现改为按 PanoView 逐张渲染，
 * 当前视角由 getView() 从真实相机方向反算（相机在原点附近绕原点旋转，视线 = getWorldDirection）。
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

/** 一个截图朝向：yawDeg 绕 Y 轴（0 = 看向 -Z），pitchDeg 抬头为正（度）。 */
export interface PanoView {
  yawDeg: number;
  pitchDeg: number;
}

/** 对外能力：getView 读当前朝向 / capture 截图 / reset 复位 */
export interface PanoViewerHandle {
  getView: () => PanoView;
  capture: (views: PanoView[], ratioStr: string) => Promise<string[]>;
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
    // 当前朝向 = 相机视线（相机在原点附近绕原点旋转，OrbitControls 每帧写 position + lookAt(target)）。
    // getWorldDirection 内部会先 updateWorldMatrix，故拖拽中途/阻尼未收敛时读到的也是本帧真实朝向。
    getView: () => {
      const dir = camera.getWorldDirection(new THREE.Vector3());
      return {
        yawDeg: THREE.MathUtils.radToDeg(Math.atan2(dir.x, -dir.z)),
        pitchDeg: THREE.MathUtils.radToDeg(Math.asin(THREE.MathUtils.clamp(dir.y, -1, 1))),
      };
    },
    capture: async (views, ratioStr) => {
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
        for (const view of views) {
          const yaw = THREE.MathUtils.degToRad(view.yawDeg);
          const pitch = THREE.MathUtils.degToRad(view.pitchDeg);
          // 与 getView 同一套球坐标：yaw 绕 Y、pitch 抬头为正，两者互为逆运算（改了这里必须同步 getView）。
          const cosPitch = Math.cos(pitch);
          shotCam.lookAt(Math.sin(yaw) * cosPitch, Math.sin(pitch), -Math.cos(yaw) * cosPitch);
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
                const r = pixels[src];
                const g = pixels[src + 1];
                const b = pixels[src + 2];
                // 像素缓冲按 width×height×4 分配；缺项 = 不可达，跳过该像素
                if (r === undefined || g === undefined || b === undefined) continue;
                imgData.data[dst] = r;
                imgData.data[dst + 1] = g;
                imgData.data[dst + 2] = b;
                imgData.data[dst + 3] = 255;
              }
            }
            ctx.putImageData(imgData, 0, 0);
            // 唯一出口（产出即校验）：失败抛错 → finally 仍恢复渲染目标，调用方 doCapture 有 try/catch
            out.push(canvasToImageDataUrl(canvas, 'image/jpeg', 0.95));
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
