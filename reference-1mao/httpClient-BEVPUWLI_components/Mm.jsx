// TODO(全局, 无需 import): color, geometryType, n
import { e, t } from './shared.js';
export default function Mm({
  color: e = `#d7e7ff`,
  geometryType: t
}) {
  const Component2071 = `meshStandardMaterial`;
  let n = <Component2071 color={e} metalness={0.02} roughness={0.68} />;
  if (t === `sphere`) {
    const Component2072 = `sphereGeometry`;
    const Component2073 = `mesh`;
    return <Component2073 name={`geometry-sphere`}>
        <Component2072 args={[0.55, 32, 16]} />
        {n}
      </Component2073>;
  } else if (t === `cylinder`) {
    const Component2074 = `cylinderGeometry`;
    const Component2075 = `mesh`;
    return <Component2075 name={`geometry-cylinder`}>
        <Component2074 args={[0.45, 0.45, 1.2, 32]} />
        {n}
      </Component2075>;
  } else if (t === `torus`) {
    const Component2076 = `torusGeometry`;
    const Component2077 = `mesh`;
    return <Component2077 name={`geometry-torus`} rotation={[Math.PI / 2, 0, 0]}>
        <Component2076 args={[0.45, 0.14, 16, 48]} />
        {n}
      </Component2077>;
  } else if (t === `cone`) {
    const Component2078 = `coneGeometry`;
    const Component2079 = `mesh`;
    return <Component2079 name={`geometry-cone`}>
        <Component2078 args={[0.5, 1.1, 32]} />
        {n}
      </Component2079>;
  } else if (t === `pyramid`) {
    const Component2080 = `coneGeometry`;
    const Component2081 = `mesh`;
    return <Component2081 name={`geometry-pyramid`}>
        <Component2080 args={[0.55, 1.1, 4]} />
        {n}
      </Component2081>;
  } else {
    const Component2082 = `boxGeometry`;
    const Component2083 = `mesh`;
    return <Component2083 name={`geometry-box`}>
        <Component2082 args={[1, 1, 1]} />
        {n}
      </Component2083>;
  }
}