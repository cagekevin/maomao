import React, { forwardRef, useImperativeHandle, useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import { PerspectiveCamera, OrbitControls, useTexture } from '@react-three/drei'
import * as THREE from 'three'

/**
 * 720 全景查看器核心（完整复刻官方 Xl.jsx）。
 *
 * 【依赖】@react-three/fiber@9 + @react-three/drei@10 + three@0.169（React 19）。
 *
 * 【props】
 *  - url            全景图 URL
 *  - panoType       'sphere'（球状）| 'cylinder'（柱状）
 *  - fov            视野角度（滚轮缩放）
 *  - highQuality    高画质（各向异性 = 显卡最大）
 *  - orbitControlsRefLocal  外部 OrbitControls ref（供外壳全屏漫游时控制）
 *
 * 【对外能力】通过 ref.capture(angles, ratio) 截图：
 *  - angles  角度数组，如 [0]、[0,90,180,270]、[0,30,...,330]
 *  - ratio   截图比例字符串，如 '16/9'
 *  返回 dataURL 数组（WebGLRenderTarget 2560 宽渲染各视角）。
 *
 * 纹理映射（对齐官方）：cylinder→UVMapping(300)，sphere→EquirectangularReflectionMapping(303)。
 */
export interface PanoViewerProps {
  /** 全景图 URL */
  url: string
  /** 'sphere'（球状）| 'cylinder'（柱状） */
  panoType: 'sphere' | 'cylinder'
  /** 视野角度（滚轮缩放） */
  fov: number
  /** 高画质（各向异性 = 显卡最大） */
  highQuality: boolean
  /** 外部 OrbitControls ref（供外壳全屏漫游时控制） */
  orbitControlsRefLocal?: React.MutableRefObject<unknown> | null
}

/** 对外能力：通过 ref.capture(angles, ratio) 截图，返回 dataURL 数组 */
export interface PanoViewerHandle {
  capture: (angles: number[], ratioStr: string) => Promise<string[]>
}

const PanoViewer = forwardRef<PanoViewerHandle, PanoViewerProps>(({ url, panoType, fov, highQuality, orbitControlsRefLocal }, ref) => {
  const { gl, scene, camera } = useThree()
  const texture = useTexture(url)

  // 纹理设置（复刻官方 Xl.jsx useEffect [s,c,r]）
  useEffect(() => {
    if (texture) {
      texture.mapping = panoType === 'cylinder' ? THREE.UVMapping : THREE.EquirectangularReflectionMapping
      texture.colorSpace = THREE.SRGBColorSpace
      texture.generateMipmaps = true
      texture.minFilter = THREE.LinearMipmapLinearFilter
      texture.magFilter = THREE.LinearFilter
      texture.anisotropy = highQuality
        ? gl.capabilities.getMaxAnisotropy()
        : Math.min(4, gl.capabilities.getMaxAnisotropy())
      texture.needsUpdate = true
    }
  }, [texture, gl, panoType, highQuality])

  // 同步 fov（复刻官方 Xl.jsx useEffect [n,u]）
  useEffect(() => {
    if (camera instanceof THREE.PerspectiveCamera) {
      camera.fov = fov
      camera.updateProjectionMatrix()
    }
  }, [fov, camera])

  // 截图能力（复刻官方 Xl.jsx useImperativeHandle capture）
  useImperativeHandle(ref, () => ({
    capture: async (angles, ratioStr) => {
      const out = []
      const [rw, rh] = ratioStr.split('/').map(Number)
      const aspect = rw && rh ? rw / rh : 16 / 9
      const width = 2560
      const height = Math.round(width / aspect)
      const target = new THREE.WebGLRenderTarget(width, height, {
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
        format: THREE.RGBAFormat,
        samples: 4,
      })
      target.texture.colorSpace = THREE.SRGBColorSpace
      const shotCam = new THREE.PerspectiveCamera(fov, width / height, 0.1, 2000)
      shotCam.position.set(0, 0, 0)
      shotCam.up.set(0, 1, 0)
      shotCam.updateProjectionMatrix()
      const prevTarget = gl.getRenderTarget()
      for (const deg of angles) {
        const rad = THREE.MathUtils.degToRad(deg)
        shotCam.lookAt(Math.sin(rad), 0, -Math.cos(rad))
        shotCam.updateMatrixWorld(true)
        gl.setRenderTarget(target)
        gl.clear(true, true, true)
        gl.render(scene, shotCam)
        const pixels = new Uint8Array(width * height * 4)
        gl.readRenderTargetPixels(target, 0, 0, width, height, pixels)
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        if (ctx) {
          const imgData = ctx.createImageData(width, height)
          for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
              const src = (y * width + x) * 4
              const dst = ((height - 1 - y) * width + x) * 4
              imgData.data[dst] = pixels[src]
              imgData.data[dst + 1] = pixels[src + 1]
              imgData.data[dst + 2] = pixels[src + 2]
              imgData.data[dst + 3] = 255
            }
          }
          ctx.putImageData(imgData, 0, 0)
          out.push(canvas.toDataURL('image/jpeg', 0.95))
        }
      }
      gl.setRenderTarget(prevTarget)
      target.dispose()
      return out
    },
  }))

  return (
    <>
      <PerspectiveCamera makeDefault position={[0, 0, 0.1]} fov={fov} />
      <OrbitControls
        ref={(e) => { if (orbitControlsRefLocal) orbitControlsRefLocal.current = e }}
        enableZoom={false}
        enablePan={false}
        enableDamping
        dampingFactor={0.1}
        rotateSpeed={-0.5}
      />
      {panoType === 'cylinder' ? (
        <mesh scale={[-1, 1, 1]} renderOrder={-100}>
          <cylinderGeometry args={[500, 500, 1000, 128, 1, true]} />
          <meshBasicMaterial map={texture} side={THREE.BackSide} depthTest={false} depthWrite={false} />
        </mesh>
      ) : (
        <mesh scale={[-1, 1, 1]} renderOrder={-100}>
          <sphereGeometry args={[500, 128, 128]} />
          <meshBasicMaterial map={texture} side={THREE.BackSide} depthTest={false} depthWrite={false} />
        </mesh>
      )}
    </>
  )
})

export default PanoViewer
