// 语义道具渲染器（灰模 blockout）：spec 数据在 scene3dPropSpecs.ts（纯模块），
// 这里只有组件——一个通用 PropObject 吃所有 kind，新增道具零组件分支。
import React from 'react'
import * as THREE from 'three'
import type { Scene3DObject } from './scene3dTypes'
import { PROP_SPECS, type PropPart } from './scene3dPropSpecs'

function PropPartGeometryElement({ part }: { part: PropPart }): JSX.Element {
  if (part.geometry === 'box') return <boxGeometry args={[part.size[0], part.size[1], part.size[2]]} />
  if (part.geometry === 'cylinder') return <cylinderGeometry args={[part.size[0], part.size[1], part.size[2], 24]} />
  if (part.geometry === 'cone') return <cylinderGeometry args={[0, part.size[0], part.size[1], 24]} />
  return <sphereGeometry args={[part.size[0], 24, 16]} />
}

/** 通用道具渲染器：按 spec 拼图元。材质与 mesh 对象一致（roughness 0.55），保持全场统一灰模质感。 */
export function PropObject({ object }: { object: Scene3DObject }): JSX.Element | null {
  const spec = object.propKind ? PROP_SPECS[object.propKind] : undefined
  if (!spec) return null
  return (
    <>
      {spec.parts.map((part, index) => (
        <mesh
          key={index}
          position={part.position}
          rotation={part.rotation ? new THREE.Euler(...part.rotation) : undefined}
        >
          <PropPartGeometryElement part={part} />
          <meshStandardMaterial
            color={part.color ?? object.color ?? spec.defaultColor}
            roughness={0.55}
            metalness={0.04}
          />
        </mesh>
      ))}
    </>
  )
}
