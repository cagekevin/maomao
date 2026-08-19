// TODO(全局, 无需 import): pathRef, edgeId, isActive, i, n, r, o, filter
import { t, a } from './shared.js';
import * as _shared from './shared.js';
export default function Qg({
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
  const Component2262 = `feGaussianBlur`;
  const Component2263 = `feMergeNode`;
  const Component2264 = `feMergeNode`;
  const Component2265 = `feMerge`;
  const Component2266 = `filter`;
  const Component2267 = `defs`;
  const Component2268 = `mpath`;
  const Component2269 = `animateMotion`;
  const Component2270 = `circle`;
  const Component2271 = `g`;
  const Component2272 = `mpath`;
  const Component2273 = `animateMotion`;
  const Component2274 = `circle`;
  const Component2275 = `g`;
  return <Component2275 className={`cust-edge-comet ${n ? `is-active` : ``}`} aria-hidden={true}>
      <Component2267>
        <Component2266 id={a} x={`-50%`} y={`-50%`} width={`200%`} height={`200%`}>
          <Component2262 stdDeviation={`1.4`} result={`blur`} />
          <Component2265>
            <Component2263 in={`blur`} />
            <Component2264 in={`SourceGraphic`} />
          </Component2265>
        </Component2266>
      </Component2267>
      <Component2271 filter={`url(#${a})`}>
        {i.map(([n, i, a], o) => {
        return <Component2270 r={n} fill={`#ffffff`} opacity={i} key={`${t}-c-${o}`}>
              <Component2269 dur={r} repeatCount={`indefinite`} rotate={`auto`} begin={`-${a}ms`}>
                <Component2268 xlinkHref={`#${e}`} />
              </Component2269>
            </Component2270>;
      })}
      </Component2271>
      <Component2274 r={3.4} fill={`#ffffff`} opacity={1} style={{
      filter: `drop-shadow(0 0 6px rgba(255,255,255,1)) drop-shadow(0 0 14px rgba(180,210,255,0.7))`
    }}>
        <Component2273 dur={r} repeatCount={`indefinite`} rotate={`auto`} begin={`0s`}>
          <Component2272 xlinkHref={`#${e}`} />
        </Component2273>
      </Component2274>
    </Component2275>;
}