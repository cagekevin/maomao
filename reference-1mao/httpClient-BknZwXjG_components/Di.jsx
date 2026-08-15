// TODO(全局, 无需 import): intervalMs, category, className, r, s, i, n, fontFamily, fontWeight, animation, o, opacity, transition
import { t, Ei, e, a, c } from './shared.js';
import * as Z from 'react';
export default function Di({
  intervalMs: e = 10000,
  category: t,
  className: n = ``
}) {
  let r = t ? Ei.filter(e => {
    return e.category === t || e.category === `general`;
  }) : Ei;
  let [i, a] = Z.useState(() => {
    return Math.floor(Math.random() * Math.max(1, r.length));
  });
  let [o, s] = Z.useState(true);
  Z.useEffect(() => {
    if (r.length <= 1) {
      return;
    }
    let t = window.setInterval(() => {
      s(false);
      window.setTimeout(() => {
        a(e => {
          return (e + 1) % r.length;
        });
        s(true);
      }, 320);
    }, e);
    return () => {
      return window.clearInterval(t);
    };
  }, [r.length, e]);
  let c = r[i]?.text ?? ``;
  const Component162 = `style`;
  const Component163 = `span`;
  const Component164 = `p`;
  const Component165 = `div`;
  return <Component165 className={`flex flex-col items-start text-left ${n}`}>
      <Component162>{`
        @keyframes genTipIn {
          0% { opacity: 0; transform: translateY(6px); }
          100% { opacity: 1; transform: translateY(0); }
        }
      `}</Component162>
      <Component163 className={`text-[11px] tracking-[0.3em] text-white/35 mb-2`} style={{
      fontFamily: `"Songti SC", "STSong", "SimSun", serif`
    }}>{`TIPS`}</Component163>
      <Component164 className={`text-[17px] leading-[1.7] text-white/85`} style={{
      fontFamily: `"Songti SC", "STSong", "SimSun", "Noto Serif SC", serif`,
      fontWeight: 500,
      animation: o ? `genTipIn 0.4s ease-out both` : `none`,
      opacity: o ? undefined : 0,
      transition: `opacity 0.32s ease`
    }} key={i}>
        {c}
      </Component164>
    </Component165>;
}