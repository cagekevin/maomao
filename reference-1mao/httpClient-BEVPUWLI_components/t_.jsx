// TODO(全局, 无需 import): fromX, fromY, toX, toY, fromNode, getNode, lodLevel, i, s, r, n, sourceX, sourceY, l, sourcePosition, targetX, targetY, targetPosition, o, m, p, u, f, filter
import { We, Er, t, a, Mt, X, d } from './shared.js';
import * as _shared from './shared.js';
import * as Q from 'react';
export default function t_({
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
  } = Er();
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
  const Component2282 = `feGaussianBlur`;
  const Component2283 = `feMergeNode`;
  const Component2284 = `feMergeNode`;
  const Component2285 = `feMerge`;
  const Component2286 = `filter`;
  const Component2287 = `defs`;
  const Component2288 = `path`;
  const Component2289 = `path`;
  const Component2290 = `path`;
  const Component2291 = `mpath`;
  const Component2292 = `animateMotion`;
  const Component2293 = `circle`;
  const Component2294 = `g`;
  const Component2295 = `mpath`;
  const Component2296 = `animateMotion`;
  const Component2297 = `circle`;
  const Component2298 = `g`;
  return <Component2298 fill={`none`}>
      <Component2287>
        <Component2286 id={p} x={`-50%`} y={`-50%`} width={`200%`} height={`200%`}>
          <Component2282 stdDeviation={`1.4`} result={`blur`} />
          <Component2285>
            <Component2283 in={`blur`} />
            <Component2284 in={`SourceGraphic`} />
          </Component2285>
        </Component2286>
      </Component2287>
      <Component2288 id={d} d={u} fill={`none`} stroke={`none`} />
      {f && <Component2289 d={u} fill={`none`} className={`cust-edge-glow is-active`} />}
      <Component2290 d={u} fill={`none`} className={`cust-edge-base is-active`} />
      {f && <Q.Fragment>
          <Component2294 filter={`url(#${p})`} aria-hidden={true}>
            {m.map(([e, t, n], r) => {
          return <Component2293 r={e} fill={`#ffffff`} opacity={t} key={`conn-c-${r}`}>
                  <Component2292 dur={`1.8s`} repeatCount={`indefinite`} rotate={`auto`} begin={`-${n}ms`}>
                    <Component2291 xlinkHref={`#${d}`} />
                  </Component2292>
                </Component2293>;
        })}
          </Component2294>
          <Component2297 r={3.6} fill={`#ffffff`} opacity={1} style={{
        filter: `drop-shadow(0 0 6px rgba(255,255,255,1)) drop-shadow(0 0 14px rgba(180,210,255,0.7))`
      }}>
            <Component2296 dur={`1.8s`} repeatCount={`indefinite`} rotate={`auto`} begin={`0s`}>
              <Component2295 xlinkHref={`#${d}`} />
            </Component2296>
          </Component2297>
        </Q.Fragment>}
    </Component2298>;
}