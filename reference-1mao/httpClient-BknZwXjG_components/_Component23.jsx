// TODO(全局, 无需 import): targetRef, onRequestFullscreen, onResizeEnd, minWidth, maxWidth, minHeight, maxHeight, className, s, u, f, p, l, m, r, i, o, n, g
import { t, e, d, c, a, h } from './shared.js';
import * as Z from 'react';
var _Component23 = ({
  targetRef: e,
  onRequestFullscreen: t,
  onResizeEnd: n,
  minWidth: r = 360,
  maxWidth: i = 900,
  minHeight: a = 60,
  maxHeight: o = 9999,
  className: s = ``
}) => {
  let [c, l] = Z.useState(false);
  let u = Z.useCallback(t => {
    t.preventDefault();
    t.stopPropagation();
    let s = e.current;
    if (!s) {
      return;
    }
    let c = t.clientX;
    let l = t.clientY;
    let u = s.getBoundingClientRect();
    let d = s.offsetWidth;
    let f = s.offsetHeight;
    let p = d ? u.width / d : 1;
    let m = f ? u.height / f : 1;
    let h = e => {
      let t = (e.clientX - c) / (p || 1);
      let n = (e.clientY - l) / (m || 1);
      let u = Math.max(r, Math.min(i, d + t));
      let h = Math.max(a, Math.min(o, f + n));
      s.style.width = `${u}px`;
      s.style.height = `${h}px`;
    };
    let g = () => {
      window.removeEventListener(`mousemove`, h);
      window.removeEventListener(`mouseup`, g);
      if (n && s) {
        n(s.offsetWidth, s.offsetHeight);
      }
    };
    window.addEventListener(`mousemove`, h);
    window.addEventListener(`mouseup`, g);
  }, [e, r, i, a, o, n]);
  const Component167 = `line`;
  const Component168 = `line`;
  const Component169 = `line`;
  const Component170 = `svg`;
  const Component171 = `span`;
  const Component172 = `div`;
  return <Component172 className={`absolute right-1.5 bottom-1.5 w-5 h-5 flex items-end justify-end cursor-nwse-resize select-none nodrag nopan nowheel z-30 ${s}`} title={`拖动调整大小，双击全屏编辑`} onMouseEnter={() => {
    return l(true);
  }} onMouseLeave={() => {
    return l(false);
  }} onMouseDown={u} onDoubleClick={e => {
    e.preventDefault();
    e.stopPropagation();
    t?.();
  }}>
      <Component170 viewBox={`0 0 16 16`} width={`16`} height={`16`} className={`block text-gray-400 hover:text-blue-400 transition-colors pointer-events-none`} aria-hidden={`true`}>
        <Component167 x1={`14`} y1={`6`} x2={`6`} y2={`14`} stroke={`currentColor`} strokeWidth={`1.6`} strokeLinecap={`round`} />
        <Component168 x1={`14`} y1={`9.5`} x2={`9.5`} y2={`14`} stroke={`currentColor`} strokeWidth={`1.6`} strokeLinecap={`round`} />
        <Component169 x1={`14`} y1={`13`} x2={`13`} y2={`14`} stroke={`currentColor`} strokeWidth={`1.6`} strokeLinecap={`round`} />
      </Component170>
      {c && <Component171 className={`absolute top-full right-0 mt-1 whitespace-nowrap px-2 py-1 rounded bg-black/85 text-white text-[10px] leading-none shadow-lg pointer-events-none z-40`}>{`拖动改尺寸 · 双击全屏`}</Component171>}
    </Component172>;
};
export default _Component23;