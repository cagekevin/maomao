// ============================================================
// SceneContent 占位版（M1 阶段）
// 目的：让 Scene3DFullscreen 壳布局 1:1 渲染，中央画布先显示占位 3D 场景。
// M2 阶段用 Nomi 真实 scene3dSceneContent 替换（含假人/相机/网格渲染）。
// 这里渲染一个简单 r3f 场景：网格 + 坐标轴 + 占位对象。
// ============================================================
import React from 'react'
import type { JSX } from 'react'
import { Canvas } from '@react-three/fiber'
import { Grid, OrbitControls } from '@react-three/drei'
import type { Scene3DState, Scene3DSelection } from './scene3dTypes'

type SceneContentProps = Record<string, unknown> & {
  state: Scene3DState
  selection: Scene3DSelection
}

export function SceneContent({ state }: SceneContentProps): JSX.Element {
  return (
    <Canvas camera={{ position: [8, 6, 10], fov: 45 }} gl={{ antialias: true }}>
      <ambientLight intensity={1.15} />
      <directionalLight intensity={1.2} position={[8, 10, 6]} />
      <Grid cellThickness={1} fadeDistance={80} infiniteGrid sectionColor="#2A4065" cellColor="#1e293b" position={[0, 0, 0]} />
      <axesHelper args={[4]} />
      <OrbitControls makeDefault />
      {/* 占位：把 objects 渲染成简单立方体 */}
      {state.objects.map((obj) => (
        <mesh key={obj.id} position={obj.position}>
          <boxGeometry args={[0.5, 0.5, 0.5]} />
          <meshStandardMaterial color={obj.color || '#7c8ea0'} />
        </mesh>
      ))}
    </Canvas>
  )
}
