// TODO(全局, 无需 import): shape, fallbackColor, r, i, n
import { e, t } from './shared.js';
export default function _Component90({
  shape: e,
  fallbackColor: t
}) {
  const Component2062 = `meshStandardMaterial`;
  let n = <Component2062 color={e.color || t || `#d7e7ff`} metalness={0.02} roughness={0.68} />;
  let r = e.args;
  let i;
  switch (e.geometryType) {
    case `sphere`:
      {
        const Component2063 = `sphereGeometry`;
        i = <Component2063 args={[r?.[0] ?? 0.5, r?.[1] ?? 32, r?.[2] ?? 16]} />;
        break;
      }
    case `cylinder`:
      {
        const Component2064 = `cylinderGeometry`;
        i = <Component2064 args={[r?.[0] ?? 0.45, r?.[1] ?? 0.45, r?.[2] ?? 1, r?.[3] ?? 32]} />;
        break;
      }
    case `torus`:
      {
        const Component2065 = `torusGeometry`;
        i = <Component2065 args={[r?.[0] ?? 0.45, r?.[1] ?? 0.14, r?.[2] ?? 16, r?.[3] ?? 48]} />;
        break;
      }
    case `cone`:
      {
        const Component2066 = `coneGeometry`;
        i = <Component2066 args={[r?.[0] ?? 0.5, r?.[1] ?? 1, r?.[2] ?? 32]} />;
        break;
      }
    case `pyramid`:
      {
        const Component2067 = `coneGeometry`;
        i = <Component2067 args={[r?.[0] ?? 0.55, r?.[1] ?? 1, 4]} />;
        break;
      }
    default:
      {
        const Component2068 = `boxGeometry`;
        i = <Component2068 args={[r?.[0] ?? 1, r?.[1] ?? 1, r?.[2] ?? 1]} />;
        break;
      }
  }
  const Component2069 = `mesh`;
  return <Component2069 position={e.position} rotation={e.rotation} scale={e.scale}>
      {i}
      {n}
    </Component2069>;
}