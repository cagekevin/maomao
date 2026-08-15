// TODO(全局, 无需 import): sourceX, sourceY, targetX, targetY, markerEnd, selected, data, setEdges, s, n, r, i, u, sourcePosition, f, p, targetPosition, v, b, m, pointerEvents, x, position, transform, g, fontSize, opacity, transition
import _cmp__Component111 from './_Component111.jsx';
import { id, We, t, Mt, d, X, c, e, S, a, y, h, _, _Component112 } from './shared.js';
import * as Q from 'react';
export default function Mg({
  id: e,
  sourceX: t,
  sourceY: n,
  targetX: r,
  targetY: i,
  markerEnd: a,
  selected: o,
  data: s
}) {
  let {
    setEdges: c
  } = We();
  let l = !!s?.relatedToSelected;
  let u = t;
  let d = n;
  let f = r;
  let p = i;
  let [m, h, g] = Mt({
    sourceX: u,
    sourceY: d,
    sourcePosition: X.Right,
    targetX: f,
    targetY: p,
    targetPosition: X.Left
  });
  let _ = t => {
    t.stopPropagation();
    c(t => {
      return t.filter(t => {
        return t.id !== e;
      });
    });
  };
  let v = !!o || !!l;
  let y = !!o;
  let b = v;
  let x = b;
  let S = `cust-edge-mpath-${e}`;
  const Component2254 = `path`;
  const Component2255 = `path`;
  const Component2256 = `path`;
  const Component2257 = `path`;
  const Component2258 = `button`;
  const Component2259 = `div`;
  return <Q.Fragment>
      {b && <Component2254 id={S} d={m} fill={`none`} stroke={`none`} style={{
      pointerEvents: `none`
    }} />}
      <Component2255 d={m} className={`cust-edge-hit`} />
      {b && <Component2256 d={m} className={`cust-edge-glow is-active`} />}
      <Component2257 d={m} className={`cust-edge-base ${v ? `is-active` : ``}`} markerEnd={typeof a == `string` ? a : undefined} />
      {b && <_cmp__Component111 pathRef={S} edgeId={e} isActive={true} />}
      {(y || x) && <_Component112>
          <Component2259 style={{
        position: `absolute`,
        transform: `translate(-50%, -50%) translate(${h}px,${g}px)`,
        fontSize: 12,
        pointerEvents: `all`,
        opacity: 1,
        transition: `opacity 0.2s`
      }} className={`nodrag nopan group/edge hover:opacity-100`}>
            <Component2258 className={`bg-white hover:bg-gray-100 text-gray-600 hover:text-red-500 rounded-full w-5 h-5 flex items-center justify-center shadow-lg border border-gray-300 cursor-pointer transition-colors`} onClick={_} title={`删除连线`}>{`×`}</Component2258>
          </Component2259>
        </_Component112>}
    </Q.Fragment>;
}