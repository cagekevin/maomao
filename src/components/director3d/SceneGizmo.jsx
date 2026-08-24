// 3D 轴视图导航：使用 drei Hud 渲染 + 基础图元绘制三轴，瞬移跳转（无 slerp 动画）
import { useRef, useEffect, useMemo, useState, useCallback } from 'react'
import { useThree, useFrame } from '@react-three/fiber'
import { Hud, OrthographicCamera } from '@react-three/drei'
import * as THREE from 'three'

const FOCUS = new THREE.Vector3(0, 1, 0)
const _pos = new THREE.Vector3()
const _mat = new THREE.Matrix4()

const VIEW_DIRS = {
  perspective: [8.5, 5.4, 9.5],
  top: [0, 1, 0],
  left: [1, 0, 0],
  back: [0, 0, -1],
}

function Axis({ color, rotation }) {
  return (
    <group rotation={rotation}>
      <mesh position={[0.4, 0, 0]}>
        <boxGeometry args={[0.8, 0.08, 0.08]} />
        <meshBasicMaterial color={color} toneMapped={false} depthWrite={false} />
      </mesh>
    </group>
  )
}

function AxisHead({ color, label, position, onJump }) {
  const gl = useThree(s => s.gl)
  const [hover, setHover] = useState(false)
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 64
    canvas.height = 64
    const ctx = canvas.getContext('2d')
    ctx.beginPath()
    ctx.arc(32, 32, 16, 0, 2 * Math.PI)
    ctx.closePath()
    ctx.fillStyle = color
    ctx.fill()
    if (label) {
      ctx.font = '18px Inter var, Arial, sans-serif'
      ctx.textAlign = 'center'
      ctx.fillStyle = '#000'
      ctx.fillText(label, 32, 41)
    }
    return new THREE.CanvasTexture(canvas)
  }, [color, label])
  const scale = (label ? 1 : 0.75) * (hover ? 1.2 : 1) * 1.3
  return (
    <sprite
      position={position}
      scale={scale}
      onPointerDown={e => { e.stopPropagation(); onJump(position) }}
      onPointerOver={e => { e.stopPropagation(); setHover(true) }}
      onPointerOut={e => { e.stopPropagation(); setHover(false) }}
    >
      <spriteMaterial
        map={texture}
        map-anisotropy={gl.capabilities.getMaxAnisotropy() || 1}
        alphaTest={0.3}
        opacity={label ? 1 : 0.75}
        toneMapped={false}
        depthTest={false}
        depthWrite={false}
      />
    </sprite>
  )
}

export default function SceneGizmo({ onReady }) {
  const mainCamera = useThree(s => s.camera)
  const controls = useThree(s => s.controls)
  const invalidate = useThree(s => s.invalidate)
  const size = useThree(s => s.size)
  const groupRef = useRef(null)

  const jump = useCallback((dir) => {
    const d = new THREE.Vector3(dir[0], dir[1], dir[2])
    // 顶/底视图加微偏移避免万向锁（up 向量与视线共线）
    if (Math.abs(d.y) > 0.99) d.x += 0.0001
    const radius = mainCamera.position.distanceTo(FOCUS)
    _pos.copy(d).multiplyScalar(radius).add(FOCUS)
    mainCamera.position.copy(_pos)
    mainCamera.up.set(0, 1, 0)
    mainCamera.lookAt(FOCUS)
    if (controls) controls.update()
    invalidate()
  }, [mainCamera, controls, invalidate])

  useEffect(() => {
    onReady?.(name => {
      jump(VIEW_DIRS[name] || VIEW_DIRS.perspective)
    })
    return () => onReady?.(null)
  }, [onReady, jump])

  useFrame(() => {
    if (groupRef.current) {
      _mat.copy(mainCamera.matrix).invert()
      groupRef.current.quaternion.setFromRotationMatrix(_mat)
    }
  })

  const x = size.width / 2 - 72
  const y = -size.height / 2 + 40
  const colors = { x: '#e5484d', y: '#46a758', z: '#3e63dd' }
  const onJump = useCallback(pos => jump([pos[0], pos[1], pos[2]]), [jump])

  return (
    <Hud renderPriority={1}>
      <OrthographicCamera makeDefault position={[0, 0, 200]} />
      <group ref={groupRef} scale={32} position={[x, y, 0]}>
        <Axis color={colors.x} rotation={[0, 0, 0]} />
        <Axis color={colors.y} rotation={[0, 0, Math.PI / 2]} />
        <Axis color={colors.z} rotation={[0, -Math.PI / 2, 0]} />
        <AxisHead color={colors.x} label="X" position={[1, 0, 0]} onJump={onJump} />
        <AxisHead color={colors.y} label="Y" position={[0, 1, 0]} onJump={onJump} />
        <AxisHead color={colors.z} label="Z" position={[0, 0, 1]} onJump={onJump} />
        <AxisHead color={colors.x} position={[-1, 0, 0]} onJump={onJump} />
        <AxisHead color={colors.y} position={[0, -1, 0]} onJump={onJump} />
        <AxisHead color={colors.z} position={[0, 0, -1]} onJump={onJump} />
      </group>
    </Hud>
  )
}
