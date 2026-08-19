// TODO(全局, 无需 import): imageUrl, onSave, onClose, r, b, i, n, x, o, m, g, p, k, s, l, mode, label, icon, u, f, backgroundColor, v, width, height, cursor, touchAction, left
import { w, h, e, t, y, a, E, C, T, Ll, d, D, P, O, N, Fn, Bl, c, zl, _, A, j, M, Gt, Se, S, _Component51, _Component25 } from './shared.js';
import * as Z from 'react';
import * as Q from 'react';
export default function Vl({
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
        Ll(t, s === `bar` || s === `grid` ? n : e, r, s, l, `rect`, d);
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
  const Component1654 = `span`;
  const Component1655 = `span`;
  const Component1656 = `div`;
  const Component1657 = `button`;
  const Component1658 = `button`;
  const Component1659 = `div`;
  const Component1660 = `div`;
  const Component1661 = `button`;
  const Component1662 = `input`;
  const Component1663 = `label`;
  const Component1664 = `input`;
  const Component1665 = `label`;
  const Component1666 = `div`;
  const Component1667 = `button`;
  const Component1668 = `div`;
  const Component1669 = `div`;
  const Component1670 = `button`;
  const Component1671 = `button`;
  const Component1672 = `button`;
  const Component1673 = `button`;
  const Component1674 = `div`;
  const Component1675 = `canvas`;
  const Component1676 = `div`;
  const Component1677 = `div`;
  const Component1678 = `div`;
  const Component1679 = `div`;
  return Fn.createPortal(<Component1679 className={`fixed inset-0 z-[9999] bg-black/80 flex flex-col`} onClick={n}>
      <Component1660 className={`flex items-center justify-between px-4 py-2.5 bg-[#1c1c1c] border-b border-[#333]`} onClick={e => {
      return e.stopPropagation();
    }}>
        <Component1656 className={`flex items-center gap-2`}>
          <Component1654 className={`text-[13px] text-gray-200 font-medium`}>{`人脸打码 · 手动编辑`}</Component1654>
          <Component1655 className={`text-[11px] text-gray-500`}>{`在图上拖拽框选要打码的区域`}</Component1655>
        </Component1656>
        <Component1659 className={`flex items-center gap-2`}>
          <Component1657 onClick={n} className={`flex items-center gap-1 px-2.5 h-7 rounded-md text-[12px] text-gray-300 bg-[#2a2a2a] hover:bg-[#333] border border-[#333]`}>
            <Gt size={13} />
            {` 取消`}
          </Component1657>
          <Component1658 onClick={() => {
          let e = r.current;
          if (e) {
            t(e.toDataURL(`image/png`));
          }
        }} className={`flex items-center gap-1 px-3 h-7 rounded-md text-[12px] font-medium bg-white text-[#141414] hover:bg-gray-200`}>
            <Se size={13} />
            {` 完成`}
          </Component1658>
        </Component1659>
      </Component1660>
      <Component1674 className={`flex items-center gap-2 px-4 py-2 bg-[#181818] border-b border-[#2a2a2a] flex-wrap`} onClick={e => {
      return e.stopPropagation();
    }}>
        {Bl.map(({
        mode: e,
        label: t,
        icon: _Component50
      }) => {
        return <Component1661 onClick={() => {
          return c(e);
        }} className={`flex items-center gap-1 px-2.5 h-7 rounded-md text-[12px] border transition-colors ${s === e ? `bg-blue-600 text-white border-blue-500` : `text-gray-300 bg-[#2a2a2a] hover:bg-[#333] border-[#333]`}`} key={e}>
              <_Component50 size={13} />
              {` `}
              {t}
            </Component1661>;
      })}
        {s !== `bar` && <Component1663 className={`flex items-center gap-1.5 text-[11px] text-gray-400 ml-1`}>
            {s === `grid` ? `密度` : `程度`}
            <Component1662 type={`range`} min={0} max={1} step={0.05} value={l} onChange={e => {
          return u(Number(e.target.value));
        }} className={`accent-blue-500 w-28`} />
          </Component1663>}
        {s === `bar` && <Component1665 className={`flex items-center gap-1.5 text-[11px] text-gray-400 ml-1`}>
            {`透明度`}
            <Component1664 type={`range`} min={0} max={1} step={0.05} value={l} onChange={e => {
          return u(Number(e.target.value));
        }} className={`accent-blue-500 w-28`} />
          </Component1665>}
        {(s === `bar` || s === `grid`) && <Q.Fragment>
            <Component1666 className={`w-px h-5 bg-[#333] mx-1`} />
            <Component1668 className={`flex items-center gap-1`}>
              {[`#000000`, `#ffffff`, `#ef4444`, `#22c55e`, `#3b82f6`, `#eab308`, `#a855f7`, `#ec4899`].map(e => {
            return <Component1667 onClick={() => {
              return f(e);
            }} className={`w-4 h-4 rounded-full border border-[#333] ${d === e ? `ring-2 ring-blue-500 ring-offset-1 ring-offset-[#181818]` : ``}`} style={{
              backgroundColor: e
            }} title={e} key={e} />;
          })}
            </Component1668>
          </Q.Fragment>}
        <Component1669 className={`w-px h-5 bg-[#333] mx-1`} />
        <Component1670 onClick={async () => {
        let t = r.current;
        let n = t?.getContext(`2d`);
        let i = o.current;
        if (!!t && !!n && !!i) {
          v(true);
          try {
            let r = await zl(e);
            if (r.length === 0) {
              return;
            }
            let a = s === `mosaic` || s === `blur` ? `ellipse` : `rect`;
            for (let e of r) {
              Ll(n, s === `bar` || s === `grid` ? i : t, e, s, l, a, d);
            }
            D();
          } finally {
            v(false);
          }
        }
      }} disabled={_} className={`flex items-center gap-1 px-2.5 h-7 rounded-md text-[12px] text-gray-300 bg-[#2a2a2a] hover:bg-[#333] border border-[#333] disabled:opacity-40`}>
          {_ ? `识别中…` : `自动识别人脸`}
        </Component1670>
        <Component1671 onClick={() => {
        return N && O(b - 1);
      }} disabled={!N} className={`flex items-center gap-1 px-2 h-7 rounded-md text-[12px] text-gray-300 bg-[#2a2a2a] hover:bg-[#333] border border-[#333] disabled:opacity-40`} title={`撤销 (Ctrl+Z)`}>
          <S size={14} />
        </Component1671>
        <Component1672 onClick={() => {
        return P && O(b + 1);
      }} disabled={!P} className={`flex items-center gap-1 px-2 h-7 rounded-md text-[12px] text-gray-300 bg-[#2a2a2a] hover:bg-[#333] border border-[#333] disabled:opacity-40`} title={`前进 (Ctrl+Shift+Z)`}>
          <_Component51 size={14} />
        </Component1672>
        <Component1673 onClick={() => {
        return O(0);
      }} disabled={!N} className={`flex items-center gap-1 px-2 h-7 rounded-md text-[12px] text-gray-300 bg-[#2a2a2a] hover:bg-[#333] border border-[#333] disabled:opacity-40`} title={`重置`}>
          <_Component25 size={14} />
        </Component1673>
      </Component1674>
      <Component1678 ref={a} className={`flex-1 overflow-auto flex items-center justify-center p-4`} onClick={e => {
      return e.stopPropagation();
    }}>
        <Component1677 className={`relative`} style={{
        width: p.w * h,
        height: p.h * h
      }}>
          <Component1675 ref={r} onPointerDown={A} onPointerMove={j} onPointerUp={M} onPointerLeave={M} style={{
          width: p.w * h,
          height: p.h * h,
          cursor: `crosshair`,
          touchAction: `none`
        }} className={`block bg-[#111]`} />
          {T && <Component1676 className={`absolute border-2 border-blue-400 bg-blue-400/20 pointer-events-none`} style={{
          left: T.x * h,
          top: T.y * h,
          width: T.w * h,
          height: T.h * h
        }} />}
        </Component1677>
      </Component1678>
    </Component1679>, document.body);
}