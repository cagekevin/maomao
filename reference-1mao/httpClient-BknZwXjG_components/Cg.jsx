// TODO(全局, 无需 import): onSnapshotChange, rightOffset, snapshot, n, right, fov, position, alpha, antialias, r
import _cmp_Sg from './Sg.jsx';
import { qh, e, ig, W, t, ng, ag, _Component61 } from './shared.js';
export default function Cg({
  onSnapshotChange: e,
  rightOffset: t = qh,
  snapshot: n
}) {
  function r(t) {
    e(ig(n, new W(...t)));
  }
  const Component2208 = `button`;
  const Component2209 = `div`;
  const Component2210 = `div`;
  return <Component2210 className={`viewport-gizmo-overlay`} aria-label={`3D视口原生坐标控件`} style={{
    right: `${t}px`
  }}>
      <_Component61 className={`viewport-gizmo-canvas`} camera={{
      fov: n.fov,
      position: [0, 0, 1]
    }} gl={{
      alpha: true,
      antialias: true
    }}>
        <_cmp_Sg onSnapshotChange={e} snapshot={n} />
      </_Component61>
      <Component2209 className={`viewport-gizmo-hit-layer`} aria-label={`3D视口坐标切换按钮`}>
        {ng.map(e => {
        return <Component2208 aria-label={e.label} className={`viewport-gizmo-hit-button ${e.className}`} style={ag(n, e.direction)} type={`button`} onClick={() => {
          return r(e.direction);
        }} key={e.label} />;
      })}
      </Component2209>
    </Component2210>;
}