// TODO(全局, 无需 import): shape, fallbackColor, r, i, n
import { e, t } from './shared.js';
export default function Nm({
  shape: e,
  fallbackColor: t
}) {
  const Component2084 = `meshStandardMaterial`;
  let n = <Component2084 color={e.color || t || `#d7e7ff`} metalness={0.02} roughness={0.68} />;
  let r = e.args;
  let i;
  switch (e.geometryType) {
    case `sphere`:
      {
        const Component2085 = `sphereGeometry`;
        i = <Component2085 args={[r?.[0] ?? 0.5, r?.[1] ?? 32, r?.[2] ?? 16]} />;
        break;
      }
    case `cylinder`:
      {
        const Component2086 = `cylinderGeometry`;
        i = <Component2086 args={[r?.[0] ?? 0.45, r?.[1] ?? 0.45, r?.[2] ?? 1, r?.[3] ?? 32]} />;
        break;
      }
    case `torus`:
      {
        const Component2087 = `torusGeometry`;
        i = <Component2087 args={[r?.[0] ?? 0.45, r?.[1] ?? 0.14, r?.[2] ?? 16, r?.[3] ?? 48]} />;
        break;
      }
    case `cone`:
      {
        const Component2088 = `coneGeometry`;
        i = <Component2088 args={[r?.[0] ?? 0.5, r?.[1] ?? 1, r?.[2] ?? 32]} />;
        break;
      }
    case `pyramid`:
      {
        const Component2089 = `coneGeometry`;
        i = <Component2089 args={[r?.[0] ?? 0.55, r?.[1] ?? 1, 4]} />;
        break;
      }
    default:
      {
        const Component2090 = `boxGeometry`;
        i = <Component2090 args={[r?.[0] ?? 1, r?.[1] ?? 1, r?.[2] ?? 1]} />;
        break;
      }
  }
  const Component2091 = `mesh`;
  return <Component2091 position={e.position} rotation={e.rotation} scale={e.scale}>
      {i}
      {n}
    </Component2091>;
}