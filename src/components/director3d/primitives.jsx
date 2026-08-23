import { useMemo } from 'react'
import * as THREE from 'three'

const whiteMaterial = { roughness: 0.78, metalness: 0.02 }

function ArchPrimitive({ color }) {
  const shape = useMemo(() => {
    const outer = new THREE.Shape()
    outer.moveTo(-0.5, -0.5)
    outer.lineTo(0.5, -0.5)
    outer.lineTo(0.5, 0.5)
    outer.lineTo(-0.5, 0.5)
    outer.closePath()
    const opening = new THREE.Path()
    opening.moveTo(-0.29, -0.5)
    opening.lineTo(-0.29, -0.08)
    opening.absarc(0, -0.08, 0.29, Math.PI, 0, true)
    opening.lineTo(0.29, -0.5)
    opening.closePath()
    outer.holes.push(opening)
    return outer
  }, [])
  const settings = useMemo(() => ({ depth: 0.36, bevelEnabled: true, bevelSize: 0.018, bevelThickness: 0.018, bevelSegments: 2, curveSegments: 28 }), [])
  return (
    <mesh position={[0, 0, -0.18]} castShadow receiveShadow>
      <extrudeGeometry args={[shape, settings]} />
      <meshStandardMaterial color={color} {...whiteMaterial} />
    </mesh>
  )
}

function RoofPrimitive({ color }) {
  const shape = useMemo(() => {
    const triangle = new THREE.Shape()
    triangle.moveTo(-0.5, -0.5)
    triangle.lineTo(0.5, -0.5)
    triangle.lineTo(0, 0.5)
    triangle.closePath()
    return triangle
  }, [])
  const settings = useMemo(() => ({ depth: 1, bevelEnabled: false }), [])
  return <mesh position={[0, 0, -0.5]} castShadow receiveShadow><extrudeGeometry args={[shape, settings]} /><meshStandardMaterial color={color} {...whiteMaterial} /></mesh>
}

function SimplePart({ shape = 'box', color }) {
  if (shape === 'sphere') return <mesh castShadow receiveShadow><sphereGeometry args={[0.5, 20, 14]} /><meshStandardMaterial color={color} {...whiteMaterial} /></mesh>
  if (shape === 'cylinder') return <mesh castShadow receiveShadow><cylinderGeometry args={[0.5, 0.5, 1, 20]} /><meshStandardMaterial color={color} {...whiteMaterial} /></mesh>
  if (shape === 'arch') return <ArchPrimitive color={color} />
  return <mesh castShadow receiveShadow><boxGeometry args={[1, 1, 1]} /><meshStandardMaterial color={color} {...whiteMaterial} /></mesh>
}

function AssemblyModel({ parts = [], color }) {
  return (
    <group>
      {parts.map((part, index) => (
        <group
          key={index}
          position={part.position || [0, 0, 0]}
          rotation={(part.rotationDegrees || [0, 0, 0]).map(value => THREE.MathUtils.degToRad(value))}
          scale={part.scale || [1, 1, 1]}
        >
          <SimplePart shape={part.shape} color={color} />
        </group>
      ))}
    </group>
  )
}

function StairsModel({ color }) {
  const steps = 7
  return <group>{Array.from({ length: steps }, (_, index) => {
    const height = (index + 1) / steps
    return <group key={index} position={[0, -0.5 + height / 2, -0.5 + (index + 0.5) / steps]} scale={[1, height, 1 / steps]}><SimplePart color={color} /></group>
  })}</group>
}

function TableModel({ color }) {
  return <group><group position={[0, 0.34, 0]} scale={[1, 0.14, 0.82]}><SimplePart color={color} /></group>{[-0.41, 0.41].flatMap(x => [-0.31, 0.31].map(z => <group key={`${x}-${z}`} position={[x, -0.08, z]} scale={[0.1, 0.72, 0.1]}><SimplePart color={color} /></group>))}</group>
}

function ChairModel({ color }) {
  return <group><group position={[0, 0.02, 0]} scale={[0.82, 0.13, 0.78]}><SimplePart color={color} /></group><group position={[0, 0.3, 0.34]} scale={[0.82, 0.58, 0.12]}><SimplePart color={color} /></group>{[-0.32, 0.32].flatMap(x => [-0.29, 0.29].map(z => <group key={`${x}-${z}`} position={[x, -0.27, z]} scale={[0.09, 0.48, 0.09]}><SimplePart color={color} /></group>))}</group>
}

function SofaModel({ color }) {
  return <group><group position={[0, -0.17, 0]} scale={[1, 0.42, 0.82]}><SimplePart color={color} /></group><group position={[0, 0.22, 0.32]} rotation={[-0.12, 0, 0]} scale={[1, 0.62, 0.18]}><SimplePart color={color} /></group><group position={[-0.45, 0.08, 0]} scale={[0.12, 0.38, 0.82]}><SimplePart color={color} /></group><group position={[0.45, 0.08, 0]} scale={[0.12, 0.38, 0.82]}><SimplePart color={color} /></group></group>
}

function DoorModel({ color }) {
  return <group><group position={[-0.46, 0, 0]} scale={[0.09, 1, 0.16]}><SimplePart color={color} /></group><group position={[0.46, 0, 0]} scale={[0.09, 1, 0.16]}><SimplePart color={color} /></group><group position={[0, 0.46, 0]} scale={[0.92, 0.09, 0.16]}><SimplePart color={color} /></group><group position={[0, -0.02, 0]} scale={[0.78, 0.86, 0.07]}><SimplePart color={color} /></group><group position={[0.27, -0.02, -0.07]} scale={[0.045, 0.045, 0.045]}><SimplePart shape="sphere" color="#625c50" /></group></group>
}

function WindowModel({ color }) {
  return <group><group position={[-0.46, 0, 0]} scale={[0.08, 1, 0.14]}><SimplePart color={color} /></group><group position={[0.46, 0, 0]} scale={[0.08, 1, 0.14]}><SimplePart color={color} /></group><group position={[0, 0.46, 0]} scale={[1, 0.08, 0.14]}><SimplePart color={color} /></group><group position={[0, -0.46, 0]} scale={[1, 0.08, 0.14]}><SimplePart color={color} /></group><group scale={[0.06, 0.86, 0.08]}><SimplePart color={color} /></group><group scale={[0.86, 0.06, 0.08]}><SimplePart color={color} /></group></group>
}

function TreeModel({ color }) {
  return <group><group position={[0, -0.23, 0]} scale={[0.2, 0.55, 0.2]}><SimplePart shape="cylinder" color="#766b57" /></group><group position={[0, 0.2, 0]} scale={[0.78, 0.65, 0.78]}><SimplePart shape="sphere" color={color} /></group><group position={[-0.25, 0.04, 0.08]} scale={[0.48, 0.45, 0.48]}><SimplePart shape="sphere" color={color} /></group><group position={[0.25, 0.03, -0.08]} scale={[0.48, 0.43, 0.48]}><SimplePart shape="sphere" color={color} /></group></group>
}

function VehicleModel({ color }) {
  return <group><group position={[0, -0.08, 0]} scale={[1, 0.42, 0.78]}><SimplePart color={color} /></group><group position={[0.08, 0.22, -0.03]} scale={[0.52, 0.34, 0.66]}><SimplePart color={color} /></group>{[-0.34, 0.34].flatMap(x => [-0.32, 0.32].map(z => <group key={`${x}-${z}`} position={[x, -0.34, z]} rotation={[0, 0, Math.PI / 2]} scale={[0.22, 0.13, 0.22]}><SimplePart shape="cylinder" color="#343432" /></group>))}</group>
}

function PrimitiveModel({ type, color, selected, parts = [] }) {
  const materialColor = selected ? '#f3dba5' : color
  if (type === 'sphere') return <SimplePart shape="sphere" color={materialColor} />
  if (type === 'cylinder') return <SimplePart shape="cylinder" color={materialColor} />
  if (type === 'plane') return <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow><planeGeometry args={[1, 1]} /><meshStandardMaterial color={materialColor} roughness={0.9} side={THREE.DoubleSide} /></mesh>
  if (type === 'arch') return <ArchPrimitive color={materialColor} />
  if (type === 'stairs') return <StairsModel color={materialColor} />
  if (type === 'table') return <TableModel color={materialColor} />
  if (type === 'chair') return <ChairModel color={materialColor} />
  if (type === 'sofa') return <SofaModel color={materialColor} />
  if (type === 'door') return <DoorModel color={materialColor} />
  if (type === 'window') return <WindowModel color={materialColor} />
  if (type === 'tree') return <TreeModel color={materialColor} />
  if (type === 'vehicle') return <VehicleModel color={materialColor} />
  if (type === 'roof') return <RoofPrimitive color={materialColor} />
  if (type === 'assembly' && parts.length) return <AssemblyModel parts={parts} color={materialColor} />
  return <SimplePart color={materialColor} />
}

export { ArchPrimitive, RoofPrimitive, SimplePart, AssemblyModel, StairsModel, TableModel, ChairModel, SofaModel, DoorModel, WindowModel, TreeModel, VehicleModel, PrimitiveModel }
