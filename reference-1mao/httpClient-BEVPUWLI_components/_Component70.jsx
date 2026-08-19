// TODO(全局, 无需 import): color, position, radius, scale, side, i, r, n
import _cmp_Tp from './Tp.jsx';
import { t, e, a } from './shared.js';
export default function _Component70({
  color: e,
  position: t,
  radius: n,
  scale: r,
  side: i
}) {
  let a = i === `left` ? -1 : 1;
  const Component2019 = `sphereGeometry`;
  const Component2020 = `mesh`;
  const Component2021 = `capsuleGeometry`;
  const Component2022 = `mesh`;
  const Component2023 = `capsuleGeometry`;
  const Component2024 = `mesh`;
  const Component2025 = `group`;
  return <Component2025 position={t} scale={r}>
      <Component2020 name={i === `left` ? `humanoid-left-hand` : `humanoid-right-hand`}>
        <Component2019 args={[n, 18, 18]} />
        <_cmp_Tp color={e} />
      </Component2020>
      <Component2022 name={i === `left` ? `humanoid-left-thumb` : `humanoid-right-thumb`} position={[a * n * 0.76, -n * 0.12, n * 0.36]} rotation={[0.18, 0, a * 0.72]} scale={[0.58, 0.85, 0.52]}>
        <Component2021 args={[n * 0.24, n * 0.62, 8, 12]} />
        <_cmp_Tp color={e} />
      </Component2022>
      <Component2024 name={i === `left` ? `humanoid-left-fingers` : `humanoid-right-fingers`} position={[0, -n * 0.44, n * 0.22]} rotation={[0.18, 0, 0]} scale={[1.12, 0.56, 0.48]}>
        <Component2023 args={[n * 0.34, n * 0.7, 8, 12]} />
        <_cmp_Tp color={e} />
      </Component2024>
    </Component2025>;
}