// TODO(全局, 无需 import): imageUrl, onSave, onClose, r, b, i, n, x, o, m, g, p, k, s, l, mode, label, icon, u, f, backgroundColor, v, width, height, cursor, touchAction, left
import { w, h, e, t, y, a, E, C, T, gl, d, D, P, O, N, Fn, yl, c, vl, _, A, j, M, Gt, Se, S, _Component52, Me } from './shared.js';
import * as Z from 'react';
import * as Q from 'react';
export default function _Component55({
  imageUrl: e,
  onSave: t,
  onClose: n
}) {
  let r = Z.useRef(null);
  let a = Z.useRef(null);
  let o = Z.useRef(null);
  let [s, c] = Z.useState(`mosaic`);
  let [l, u] = Z.useState(0.5);
  let [d, f] = Z.useState(`#000000`);
  let [p, m] = Z.useState({
    w: 0,
    h: 0
  });
  let [h, g] = Z.useState(1);
  let [_, v] = Z.useState(false);
  let y = Z.useRef([]);
  let [b, x] = Z.useState(0);
  let [C, w] = Z.useState(null);
  let [T, E] = Z.useState(null);
  let D = Z.useCallback(() => {
    let e = r.current;
    let t = e?.getContext(`2d`);
    if (!e || !t) {
      return;
    }
    let n = t.getImageData(0, 0, e.width, e.height);
    let i = y.current.slice(0, b + 1);
    i.push(n);
    y.current = i;
    x(i.length - 1);
  }, [b]);
  let O = Z.useCallback(e => {
    let t = r.current;
    let n = t?.getContext(`2d`);
    if (!!t && !!n && !!y.current[e]) {
      n.putImageData(y.current[e], 0, 0);
      x(e);
    }
  }, []);
  Z.useEffect(() => {
    let t = new Image();
    t.crossOrigin = `anonymous`;
    t.onload = () => {
      let e = r.current;
      let n = e?.getContext(`2d`);
      if (!e || !n) {
        return;
      }
      e.width = t.naturalWidth;
      e.height = t.naturalHeight;
      n.drawImage(t, 0, 0);
      o.current = t;
      m({
        w: t.naturalWidth,
        h: t.naturalHeight
      });
      y.current = [n.getImageData(0, 0, e.width, e.height)];
      x(0);
      let i = a.current;
      if (i) {
        let e = i.clientWidth - 32;
        let n = i.clientHeight - 32;
        let r = Math.min(e / t.naturalWidth, n / t.naturalHeight, 1);
        g(r > 0 ? r : 1);
      }
    };
    t.onerror = () => {
      return n();
    };
    t.src = e;
  }, [e, n]);
  let k = (e, t) => {
    let n = r.current.getBoundingClientRect();
    let i = (e - n.left) / h;
    let a = (t - n.top) / h;
    return {
      x: Math.max(0, Math.min(p.w, i)),
      y: Math.max(0, Math.min(p.h, a))
    };
  };
  let A = e => {
    let t = k(e.clientX, e.clientY);
    w(t);
    E({
      x: t.x,
      y: t.y,
      w: 0,
      h: 0
    });
  };
  let j = e => {
    if (!C) {
      return;
    }
    let t = k(e.clientX, e.clientY);
    E({
      x: Math.min(C.x, t.x),
      y: Math.min(C.y, t.y),
      w: Math.abs(t.x - C.x),
      h: Math.abs(t.y - C.y)
    });
  };
  let M = () => {
    if (T && T.w > 4 && T.h > 4) {
      let e = r.current;
      let t = e?.getContext(`2d`);
      let n = o.current;
      if (e && t && n) {
        let r = {
          x: Math.round(T.x),
          y: Math.round(T.y),
          w: Math.round(T.w),
          h: Math.round(T.h)
        };
        gl(t, s === `bar` || s === `grid` ? n : e, r, s, l, `rect`, d);
        D();
      }
    }
    w(null);
    E(null);
  };
  let N = b > 0;
  let P = b < y.current.length - 1;
  Z.useEffect(() => {
    let e = e => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === `z`) {
        e.preventDefault();
        if (e.shiftKey) {
          if (P) {
            O(b + 1);
          }
        } else if (N) {
          O(b - 1);
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === `y`) {
        e.preventDefault();
        if (P) {
          O(b + 1);
        }
      } else if (e.key === `Escape`) {
        n();
      }
    };
    window.addEventListener(`keydown`, e);
    return () => {
      return window.removeEventListener(`keydown`, e);
    };
  }, [N, P, b, O, n]);
  const Component1632 = `span`;
  const Component1633 = `span`;
  const Component1634 = `div`;
  const Component1635 = `button`;
  const Component1636 = `button`;
  const Component1637 = `div`;
  const Component1638 = `div`;
  const Component1639 = `button`;
  const Component1640 = `input`;
  const Component1641 = `label`;
  const Component1642 = `input`;
  const Component1643 = `label`;
  const Component1644 = `div`;
  const Component1645 = `button`;
  const Component1646 = `div`;
  const Component1647 = `div`;
  const Component1648 = `button`;
  const Component1649 = `button`;
  const Component1650 = `button`;
  const Component1651 = `button`;
  const Component1652 = `div`;
  const Component1653 = `canvas`;
  const Component1654 = `div`;
  const Component1655 = `div`;
  const Component1656 = `div`;
  const Component1657 = `div`;
  return Fn.createPortal(<Component1657 className={`fixed inset-0 z-[9999] bg-black/80 flex flex-col`} onClick={n}>
      <Component1638 className={`flex items-center justify-between px-4 py-2.5 bg-[#1c1c1c] border-b border-[#333]`} onClick={e => {
      return e.stopPropagation();
    }}>
        <Component1634 className={`flex items-center gap-2`}>
          <Component1632 className={`text-[13px] text-gray-200 font-medium`}>{`人脸打码 · 手动编辑`}</Component1632>
          <Component1633 className={`text-[11px] text-gray-500`}>{`在图上拖拽框选要打码的区域`}</Component1633>
        </Component1634>
        <Component1637 className={`flex items-center gap-2`}>
          <Component1635 onClick={n} className={`flex items-center gap-1 px-2.5 h-7 rounded-md text-[12px] text-gray-300 bg-[#2a2a2a] hover:bg-[#333] border border-[#333]`}>
            <Gt size={13} />
            {` 取消`}
          </Component1635>
          <Component1636 onClick={() => {
          let e = r.current;
          if (e) {
            t(e.toDataURL(`image/png`));
          }
        }} className={`flex items-center gap-1 px-3 h-7 rounded-md text-[12px] font-medium bg-white text-[#141414] hover:bg-gray-200`}>
            <Se size={13} />
            {` 完成`}
          </Component1636>
        </Component1637>
      </Component1638>
      <Component1652 className={`flex items-center gap-2 px-4 py-2 bg-[#181818] border-b border-[#2a2a2a] flex-wrap`} onClick={e => {
      return e.stopPropagation();
    }}>
        {yl.map(({
        mode: e,
        label: t,
        icon: _Component51
      }) => {
        return <Component1639 onClick={() => {
          return c(e);
        }} className={`flex items-center gap-1 px-2.5 h-7 rounded-md text-[12px] border transition-colors ${s === e ? `bg-blue-600 text-white border-blue-500` : `text-gray-300 bg-[#2a2a2a] hover:bg-[#333] border-[#333]`}`} key={e}>
              <_Component51 size={13} />
              {` `}
              {t}
            </Component1639>;
      })}
        {s !== `bar` && <Component1641 className={`flex items-center gap-1.5 text-[11px] text-gray-400 ml-1`}>
            {s === `grid` ? `密度` : `程度`}
            <Component1640 type={`range`} min={0} max={1} step={0.05} value={l} onChange={e => {
          return u(Number(e.target.value));
        }} className={`accent-blue-500 w-28`} />
          </Component1641>}
        {s === `bar` && <Component1643 className={`flex items-center gap-1.5 text-[11px] text-gray-400 ml-1`}>
            {`透明度`}
            <Component1642 type={`range`} min={0} max={1} step={0.05} value={l} onChange={e => {
          return u(Number(e.target.value));
        }} className={`accent-blue-500 w-28`} />
          </Component1643>}
        {(s === `bar` || s === `grid`) && <Q.Fragment>
            <Component1644 className={`w-px h-5 bg-[#333] mx-1`} />
            <Component1646 className={`flex items-center gap-1`}>
              {[`#000000`, `#ffffff`, `#ef4444`, `#22c55e`, `#3b82f6`, `#eab308`, `#a855f7`, `#ec4899`].map(e => {
            return <Component1645 onClick={() => {
              return f(e);
            }} className={`w-4 h-4 rounded-full border border-[#333] ${d === e ? `ring-2 ring-blue-500 ring-offset-1 ring-offset-[#181818]` : ``}`} style={{
              backgroundColor: e
            }} title={e} key={e} />;
          })}
            </Component1646>
          </Q.Fragment>}
        <Component1647 className={`w-px h-5 bg-[#333] mx-1`} />
        <Component1648 onClick={async () => {
        let t = r.current;
        let n = t?.getContext(`2d`);
        let i = o.current;
        if (!!t && !!n && !!i) {
          v(true);
          try {
            let r = await vl(e);
            if (r.length === 0) {
              return;
            }
            let a = s === `mosaic` || s === `blur` ? `ellipse` : `rect`;
            for (let e of r) {
              gl(n, s === `bar` || s === `grid` ? i : t, e, s, l, a, d);
            }
            D();
          } finally {
            v(false);
          }
        }
      }} disabled={_} className={`flex items-center gap-1 px-2.5 h-7 rounded-md text-[12px] text-gray-300 bg-[#2a2a2a] hover:bg-[#333] border border-[#333] disabled:opacity-40`}>
          {_ ? `识别中…` : `自动识别人脸`}
        </Component1648>
        <Component1649 onClick={() => {
        return N && O(b - 1);
      }} disabled={!N} className={`flex items-center gap-1 px-2 h-7 rounded-md text-[12px] text-gray-300 bg-[#2a2a2a] hover:bg-[#333] border border-[#333] disabled:opacity-40`} title={`撤销 (Ctrl+Z)`}>
          <S size={14} />
        </Component1649>
        <Component1650 onClick={() => {
        return P && O(b + 1);
      }} disabled={!P} className={`flex items-center gap-1 px-2 h-7 rounded-md text-[12px] text-gray-300 bg-[#2a2a2a] hover:bg-[#333] border border-[#333] disabled:opacity-40`} title={`前进 (Ctrl+Shift+Z)`}>
          <_Component52 size={14} />
        </Component1650>
        <Component1651 onClick={() => {
        return O(0);
      }} disabled={!N} className={`flex items-center gap-1 px-2 h-7 rounded-md text-[12px] text-gray-300 bg-[#2a2a2a] hover:bg-[#333] border border-[#333] disabled:opacity-40`} title={`重置`}>
          <Me size={14} />
        </Component1651>
      </Component1652>
      <Component1656 ref={a} className={`flex-1 overflow-auto flex items-center justify-center p-4`} onClick={e => {
      return e.stopPropagation();
    }}>
        <Component1655 className={`relative`} style={{
        width: p.w * h,
        height: p.h * h
      }}>
          <Component1653 ref={r} onPointerDown={A} onPointerMove={j} onPointerUp={M} onPointerLeave={M} style={{
          width: p.w * h,
          height: p.h * h,
          cursor: `crosshair`,
          touchAction: `none`
        }} className={`block bg-[#111]`} />
          {T && <Component1654 className={`absolute border-2 border-blue-400 bg-blue-400/20 pointer-events-none`} style={{
          left: T.x * h,
          top: T.y * h,
          width: T.w * h,
          height: T.h * h
        }} />}
        </Component1655>
      </Component1656>
    </Component1657>, document.body);
}