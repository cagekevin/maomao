// TODO(全局, 无需 import): pathRef, edgeId, isActive, i, n, r, o, filter
import { t, a } from './shared.js';
import * as _shared from './shared.js';
export default function _Component111({
  pathRef: e,
  edgeId: t,
  isActive: n
}) {
  let r = `1.8s`;
  let i = [];
  for (let e = 0; e < 16; e++) {
    let t = e / 15;
    let n = 4.6 - t * 4;
    let r = Math.max(0.05, 1 - t * 1.05);
    let a = e * 18;
    i.push([n, r, a]);
  }
  let a = `cust-edge-filter-${t}`;
  const Component2240 = `feGaussianBlur`;
  const Component2241 = `feMergeNode`;
  const Component2242 = `feMergeNode`;
  const Component2243 = `feMerge`;
  const Component2244 = `filter`;
  const Component2245 = `defs`;
  const Component2246 = `mpath`;
  const Component2247 = `animateMotion`;
  const Component2248 = `circle`;
  const Component2249 = `g`;
  const Component2250 = `mpath`;
  const Component2251 = `animateMotion`;
  const Component2252 = `circle`;
  const Component2253 = `g`;
  return <Component2253 className={`cust-edge-comet ${n ? `is-active` : ``}`} aria-hidden={true}>
      <Component2245>
        <Component2244 id={a} x={`-50%`} y={`-50%`} width={`200%`} height={`200%`}>
          <Component2240 stdDeviation={`1.4`} result={`blur`} />
          <Component2243>
            <Component2241 in={`blur`} />
            <Component2242 in={`SourceGraphic`} />
          </Component2243>
        </Component2244>
      </Component2245>
      <Component2249 filter={`url(#${a})`}>
        {i.map(([n, i, a], o) => {
        return <Component2248 r={n} fill={`#ffffff`} opacity={i} key={`${t}-c-${o}`}>
              <Component2247 dur={r} repeatCount={`indefinite`} rotate={`auto`} begin={`-${a}ms`}>
                <Component2246 xlinkHref={`#${e}`} />
              </Component2247>
            </Component2248>;
      })}
      </Component2249>
      <Component2252 r={3.4} fill={`#ffffff`} opacity={1} style={{
      filter: `drop-shadow(0 0 6px rgba(255,255,255,1)) drop-shadow(0 0 14px rgba(180,210,255,0.7))`
    }}>
        <Component2251 dur={r} repeatCount={`indefinite`} rotate={`auto`} begin={`0s`}>
          <Component2250 xlinkHref={`#${e}`} />
        </Component2251>
      </Component2252>
    </Component2253>;
}