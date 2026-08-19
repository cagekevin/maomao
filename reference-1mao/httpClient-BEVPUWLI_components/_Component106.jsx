// TODO(全局, 无需 import): imageUrl, onClose, x, r, o, s, n, u, l, transform, i, transition
import { y, e, t, a, c, d } from './shared.js';
import * as Z from 'react';
var _Component106 = ({
  imageUrl: e,
  onClose: t
}) => {
  let [n, r] = Z.useState(1);
  let [i, a] = Z.useState({
    x: 0,
    y: 0
  });
  let o = Z.useRef(false);
  let s = Z.useRef({
    x: 0,
    y: 0
  });
  Z.useEffect(() => {
    let e = e => {
      if (e.key === `Escape`) {
        t();
      }
    };
    window.addEventListener(`keydown`, e);
    return () => {
      return window.removeEventListener(`keydown`, e);
    };
  }, [t]);
  let c = e => {
    e.preventDefault();
    e.stopPropagation();
    let t = e.deltaY * -0.002;
    r(e => {
      return Math.min(Math.max(0.1, e + t), 10);
    });
  };
  let l = e => {
    o.current = true;
    s.current = {
      x: e.clientX,
      y: e.clientY
    };
  };
  let u = e => {
    if (!o.current) {
      return;
    }
    let t = e.clientX - s.current.x;
    let n = e.clientY - s.current.y;
    a(e => {
      return {
        x: e.x + t,
        y: e.y + n
      };
    });
    s.current = {
      x: e.clientX,
      y: e.clientY
    };
  };
  let d = () => {
    o.current = false;
  };
  const Component3009 = `path`;
  const Component3010 = `path`;
  const Component3011 = `svg`;
  const Component3012 = `button`;
  const Component3013 = `img`;
  const Component3014 = `div`;
  const Component3015 = `div`;
  return <Component3015 className={`fixed inset-0 z-[9999] flex items-center justify-center bg-black/90 overflow-hidden`} onClick={t} onWheel={c} onPointerMove={u} onPointerUp={d} onPointerLeave={d}>
      <Component3012 className={`absolute top-4 right-4 text-white hover:text-gray-300 bg-black/50 p-2 rounded-full transition-colors z-[10000]`} onClick={e => {
      e.stopPropagation();
      t();
    }}>
        <Component3011 xmlns={`http://www.w3.org/2000/svg`} width={`32`} height={`32`} viewBox={`0 0 24 24`} fill={`none`} stroke={`currentColor`} strokeWidth={`2`} strokeLinecap={`round`} strokeLinejoin={`round`}>
          <Component3009 d={`M18 6 6 18`} />
          <Component3010 d={`m6 6 12 12`} />
        </Component3011>
      </Component3012>
      <Component3014 className={`cursor-grab active:cursor-grabbing w-full h-full flex items-center justify-center`} onPointerDown={l} onClick={e => {
      return e.stopPropagation();
    }} onDoubleClick={e => {
      e.stopPropagation();
      t();
    }}>
        <Component3013 src={e} alt={`Zoomed Content`} className={`max-w-none max-h-none object-contain pointer-events-none`} style={{
        transform: `translate(${i.x}px, ${i.y}px) scale(${n})`,
        transition: o.current ? `none` : `transform 0.1s ease-out`
      }} draggable={false} />
      </Component3014>
    </Component3015>;
};
export default _Component106;