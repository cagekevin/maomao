// TODO(全局, 无需 import): playUrl, loading, error, r, s, o, i, n, Uint8Array, u, l, f, m, p, x, background, b, v, g
import { h, _, a, t, d, c, S, C, Ps, w, y, _Component25, _Component17, Xe, _Component43, _Component44, Dn } from './shared.js';
import * as _shared from './shared.js';
import * as Z from 'react';
export default function Is({
  playUrl: e,
  loading: t,
  error: n
}) {
  let r = Z.useRef(null);
  let i = Z.useRef(null);
  let a = Z.useRef(null);
  let o = Z.useRef(null);
  let s = Z.useRef(null);
  let c = Z.useRef(0);
  let [l, u] = Z.useState(false);
  let [d, f] = Z.useState(0);
  let [p, m] = Z.useState(0);
  let [h, g] = Z.useState(1);
  let [_, v] = Z.useState(false);
  let [y, b] = Z.useState(false);
  Z.useEffect(() => {
    let e = r.current;
    if (e) {
      e.volume = h;
      e.muted = _;
    }
  }, [h, _]);
  let x = Z.useCallback(() => {
    let e = r.current;
    a.current ||= new (window.AudioContext || window.webkitAudioContext)();
    if (a.current.state === `suspended`) {
      a.current.resume();
    }
    if (e && !s.current) {
      try {
        s.current = a.current.createMediaElementSource(e);
        o.current = a.current.createAnalyser();
        o.current.fftSize = 256;
        s.current.connect(o.current);
        o.current.connect(a.current.destination);
      } catch {}
    }
  }, []);
  let S = Z.useCallback(() => {
    let e = i.current;
    let t = o.current;
    if (!e) {
      return;
    }
    let n = e.getContext(`2d`);
    if (!n) {
      return;
    }
    let r = e.width;
    let a = e.height;
    n.clearRect(0, 0, r, a);
    let s = t ? t.frequencyBinCount : 64;
    let u = new Uint8Array(s);
    if (t) {
      t.getByteFrequencyData(u);
    }
    let d = (r - 141) / 48;
    for (let e = 0; e < 48; e++) {
      let r = Math.floor(e / 48 * s);
      let i = t ? u[r] / 255 : l ? 0.2 + Math.random() * 0.3 : 0.06;
      let o = Math.max(3, i * a * 0.92);
      let c = e * (d + 3);
      let f = (a - o) / 2;
      let p = e / 48 * 280 + 200;
      let m = n.createLinearGradient(0, f, 0, f + o);
      m.addColorStop(0, `hsl(${p}, 90%, 65%)`);
      m.addColorStop(1, `hsl(${p + 40}, 85%, 50%)`);
      n.fillStyle = m;
      let h = Math.min(d / 2, 3);
      n.beginPath();
      n.roundRect(c, f, d, o, h);
      n.fill();
    }
    c.current = requestAnimationFrame(S);
  }, [l]);
  Z.useEffect(() => {
    c.current = requestAnimationFrame(S);
    return () => {
      return cancelAnimationFrame(c.current);
    };
  }, [S]);
  let C = Z.useCallback(() => {
    let e = r.current;
    if (e) {
      x();
      if (e.paused) {
        e.play().catch(() => {});
      } else {
        e.pause();
      }
    }
  }, [x]);
  let w = Z.useCallback(e => {
    let t = r.current;
    if (!t) {
      return;
    }
    let n = Number(e.target.value) / 1000 * (t.duration || 0);
    t.currentTime = n;
    f(n);
  }, []);
  const Component1103 = `canvas`;
  const Component1104 = `div`;
  const Component1105 = `div`;
  const Component1106 = `div`;
  const Component1107 = `button`;
  const Component1108 = `span`;
  const Component1109 = `input`;
  const Component1110 = `span`;
  const Component1111 = `button`;
  const Component1112 = `input`;
  const Component1113 = `div`;
  const Component1114 = `div`;
  const Component1115 = `div`;
  const Component1116 = `audio`;
  const Component1117 = `div`;
  return <Component1117 className={`flex-1 flex flex-col bg-gradient-to-b from-[#16181d] to-[#0e0f12]`}>
      <Component1105 className={`relative flex-1 min-h-[80px] mx-3 mt-3 mb-1`}>
        <Component1103 ref={i} width={420} height={120} className={`w-full h-full`} />
        {t && <Component1104 className={`absolute inset-0 flex items-center justify-center gap-2 text-gray-400 text-[12px]`}>
            <_Component25 size={16} className={`animate-spin`} />
            {` 加载中…`}
          </Component1104>}
      </Component1105>
      {n && <Component1106 className={`px-3 text-[10px] text-amber-400/80 flex items-center gap-1`}>
          <_Component17 size={11} />
          {` `}
          {n}
        </Component1106>}
      <Component1115 className={`flex items-center gap-2.5 px-3 py-2.5 nodrag`} onClick={e => {
      return e.stopPropagation();
    }}>
        <Component1107 className={`w-9 h-9 rounded-full bg-white text-black flex items-center justify-center hover:bg-gray-200 transition-colors flex-shrink-0 disabled:opacity-40`} onClick={C} disabled={!e}>
          {l ? <Xe size={16} fill={`currentColor`} /> : <_Component43 size={16} fill={`currentColor`} className={`ml-0.5`} />}
        </Component1107>
        <Component1108 className={`text-[10px] text-gray-400 tabular-nums flex-shrink-0 w-9 text-right`}>
          {Ps(d)}
        </Component1108>
        <Component1109 type={`range`} min={0} max={1000} value={p ? d / p * 1000 : 0} onChange={w} className={`audio-range flex-1 cursor-pointer`} style={{
        background: `linear-gradient(to right, #ffffff 0%, #ffffff ${p ? d / p * 100 : 0}%, #3a3a3a ${p ? d / p * 100 : 0}%, #3a3a3a 100%)`
      }} />
        <Component1110 className={`text-[10px] text-gray-400 tabular-nums flex-shrink-0 w-9`}>
          {Ps(p)}
        </Component1110>
        <Component1114 className={`relative flex-shrink-0`} onMouseEnter={() => {
        return b(true);
      }} onMouseLeave={() => {
        return b(false);
      }}>
          <Component1111 className={`text-gray-400 hover:text-white transition-colors`} title={`音量`} onClick={() => {
          return v(e => {
            return !e;
          });
        }}>
            {_ || h === 0 ? <_Component44 size={15} /> : <Dn size={15} />}
          </Component1111>
          {y && <Component1113 className={`absolute bottom-full right-0 mb-1 bg-[#222] border border-[#333] rounded-md px-2 py-2 z-50 shadow-xl`}>
              <Component1112 type={`range`} min={0} max={100} value={_ ? 0 : Math.round(h * 100)} onChange={e => {
            let t = Number(e.target.value) / 100;
            g(t);
            v(t === 0);
          }} className={`audio-range w-20 cursor-pointer`} style={{
            background: `linear-gradient(to right, #ffffff 0%, #ffffff ${_ ? 0 : h * 100}%, #3a3a3a ${_ ? 0 : h * 100}%, #3a3a3a 100%)`
          }} />
            </Component1113>}
        </Component1114>
      </Component1115>
      <Component1116 ref={r} src={e} onPlay={() => {
      return u(true);
    }} onPause={() => {
      return u(false);
    }} onEnded={() => {
      return u(false);
    }} onTimeUpdate={e => {
      return f(e.currentTarget.currentTime);
    }} onLoadedMetadata={e => {
      return m(e.currentTarget.duration);
    }} crossOrigin={`anonymous`} className={`hidden`} />
    </Component1117>;
}