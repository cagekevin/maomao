// TODO(全局, 无需 import): fromX, fromY, toX, toY, fromNode, getNode, lodLevel, i, s, r, n, sourceX, sourceY, l, sourcePosition, targetX, targetY, targetPosition, o, m, p, u, f, filter
import { We, xr, t, a, Mt, X, d } from './shared.js';
import * as _shared from './shared.js';
import * as Q from 'react';
export default function Pg({
  fromX: e,
  fromY: t,
  toX: n,
  toY: r,
  fromNode: i
}) {
  let {
    getNode: a
  } = We();
  let {
    lodLevel: o = 0
  } = xr();
  let s = i;
  let c = e;
  let l = t;
  if (s?.parentId) {
    let e = a(s.parentId);
    if (e?.data?.collapsed) {
      let t = e?.internals?.positionAbsolute?.x ?? e.position.x;
      let n = e?.internals?.positionAbsolute?.y ?? e.position.y;
      let r = e.measured?.width ?? 120;
      let i = e.measured?.height ?? 40;
      c = t + r - 2;
      l = n + i / 2;
    }
  }
  let [u] = Mt({
    sourceX: c,
    sourceY: l,
    sourcePosition: X.Right,
    targetX: n,
    targetY: r,
    targetPosition: X.Left
  });
  let d = `cust-conn-mpath`;
  let f = o < 2;
  let p = `cust-conn-filter`;
  let m = [];
  for (let e = 0; e < 16; e++) {
    let t = e / 15;
    let n = 4.6 - t * 4;
    let r = Math.max(0.05, 1 - t * 1.05);
    let i = e * 18;
    m.push([n, r, i]);
  }
  const Component2260 = `feGaussianBlur`;
  const Component2261 = `feMergeNode`;
  const Component2262 = `feMergeNode`;
  const Component2263 = `feMerge`;
  const Component2264 = `filter`;
  const Component2265 = `defs`;
  const Component2266 = `path`;
  const Component2267 = `path`;
  const Component2268 = `path`;
  const Component2269 = `mpath`;
  const Component2270 = `animateMotion`;
  const Component2271 = `circle`;
  const Component2272 = `g`;
  const Component2273 = `mpath`;
  const Component2274 = `animateMotion`;
  const Component2275 = `circle`;
  const Component2276 = `g`;
  return <Component2276 fill={`none`}>
      <Component2265>
        <Component2264 id={p} x={`-50%`} y={`-50%`} width={`200%`} height={`200%`}>
          <Component2260 stdDeviation={`1.4`} result={`blur`} />
          <Component2263>
            <Component2261 in={`blur`} />
            <Component2262 in={`SourceGraphic`} />
          </Component2263>
        </Component2264>
      </Component2265>
      <Component2266 id={d} d={u} fill={`none`} stroke={`none`} />
      {f && <Component2267 d={u} fill={`none`} className={`cust-edge-glow is-active`} />}
      <Component2268 d={u} fill={`none`} className={`cust-edge-base is-active`} />
      {f && <Q.Fragment>
          <Component2272 filter={`url(#${p})`} aria-hidden={true}>
            {m.map(([e, t, n], r) => {
          return <Component2271 r={e} fill={`#ffffff`} opacity={t} key={`conn-c-${r}`}>
                  <Component2270 dur={`1.8s`} repeatCount={`indefinite`} rotate={`auto`} begin={`-${n}ms`}>
                    <Component2269 xlinkHref={`#${d}`} />
                  </Component2270>
                </Component2271>;
        })}
          </Component2272>
          <Component2275 r={3.6} fill={`#ffffff`} opacity={1} style={{
        filter: `drop-shadow(0 0 6px rgba(255,255,255,1)) drop-shadow(0 0 14px rgba(180,210,255,0.7))`
      }}>
            <Component2274 dur={`1.8s`} repeatCount={`indefinite`} rotate={`auto`} begin={`0s`}>
              <Component2273 xlinkHref={`#${d}`} />
            </Component2274>
          </Component2275>
        </Q.Fragment>}
    </Component2276>;
}