// TODO(全局, 无需 import): color, geometryType, n
import { e, t } from './shared.js';
export default function _Component94({
  color: e = `#d7e7ff`,
  geometryType: t
}) {
  const Component2049 = `meshStandardMaterial`;
  let n = <Component2049 color={e} metalness={0.02} roughness={0.68} />;
  if (t === `sphere`) {
    const Component2050 = `sphereGeometry`;
    const Component2051 = `mesh`;
    return <Component2051 name={`geometry-sphere`}>
        <Component2050 args={[0.55, 32, 16]} />
        {n}
      </Component2051>;
  } else if (t === `cylinder`) {
    const Component2052 = `cylinderGeometry`;
    const Component2053 = `mesh`;
    return <Component2053 name={`geometry-cylinder`}>
        <Component2052 args={[0.45, 0.45, 1.2, 32]} />
        {n}
      </Component2053>;
  } else if (t === `torus`) {
    const Component2054 = `torusGeometry`;
    const Component2055 = `mesh`;
    return <Component2055 name={`geometry-torus`} rotation={[Math.PI / 2, 0, 0]}>
        <Component2054 args={[0.45, 0.14, 16, 48]} />
        {n}
      </Component2055>;
  } else if (t === `cone`) {
    const Component2056 = `coneGeometry`;
    const Component2057 = `mesh`;
    return <Component2057 name={`geometry-cone`}>
        <Component2056 args={[0.5, 1.1, 32]} />
        {n}
      </Component2057>;
  } else if (t === `pyramid`) {
    const Component2058 = `coneGeometry`;
    const Component2059 = `mesh`;
    return <Component2059 name={`geometry-pyramid`}>
        <Component2058 args={[0.55, 1.1, 4]} />
        {n}
      </Component2059>;
  } else {
    const Component2060 = `boxGeometry`;
    const Component2061 = `mesh`;
    return <Component2061 name={`geometry-box`}>
        <Component2060 args={[1, 1, 1]} />
        {n}
      </Component2061>;
  }
}