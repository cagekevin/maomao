// TODO(全局, 无需 import): imageUrl, initialTool, onSave, onClose, x, visible, text, clientX, clientY, scrollLeft, scrollTop, i, r, n, z, ee, m, o, s, ce, l, p, u, b, g, f, se, oe, cursor, display, flex, touchAction, width, height, pointerEvents, position, left, color, fontSize, fontWeight, background, border, outline, padding, margin, zIndex, minWidth, transform, lineHeight, ie
import _cmp_Er from "./Er.jsx";
import { t, y, w, h, F, a, e, N, B, P, R, te, L, d, W, S, C, _, ne, Fn, A, j, D, E, O, I, H, U, le, G, M, V, ae, re, _Component54, _Component34, _Component18, _Component47, Ct, T, Wt, De, Y, Ze, Ce, Ot, Se, Gt, _Component27, _Component65, _Component1, Tn } from "./shared.js";
import * as _shared from "./shared.js";
import * as Z from "react";
import * as Q from "react";
export default function _Component129({
  imageUrl: e,
  initialTool: t,
  onSave: n,
  onClose: r
}) {
  let i = Z.useRef(null);
  let a = Z.useRef(null);
  let [o, s] = Z.useState(t || `pencil`);
  let [c, l] = Z.useState(`#ff0000`);
  let [u, d] = Z.useState(3);
  let [f, p] = Z.useState(false);
  let [m, h] = Z.useState([]);
  let [g, _] = Z.useState({
    x: 0,
    y: 0
  });
  let [y, b] = Z.useState(1);
  let [x, S] = Z.useState({
    visible: false,
    x: 0,
    y: 0,
    text: ``,
    clientX: 0,
    clientY: 0
  });
  let C = Z.useRef(null);
  let [w, E] = Z.useState();
  let [D, O] = Z.useState();
  let [A, j] = Z.useState(undefined);
  let [M, N] = Z.useState(1);
  let [P, F] = Z.useState({
    w: 0,
    h: 0
  });
  let [I, ee] = Z.useState(false);
  let [L, R] = Z.useState(false);
  let te = Z.useRef({
    x: 0,
    y: 0,
    scrollLeft: 0,
    scrollTop: 0
  });
  let z = Z.useRef(null);
  Z.useEffect(() => {
    let t = i.current;
    let n = t?.getContext(`2d`);
    if (!t || !n) {
      return;
    }
    let r = new Image();
    r.crossOrigin = `Anonymous`;
    r.onload = () => {
      t.width = r.naturalWidth;
      t.height = r.naturalHeight;
      n.drawImage(r, 0, 0);
      z.current = r;
      F({
        w: r.naturalWidth,
        h: r.naturalHeight
      });
      let e = a.current;
      if (e) {
        let t = e.clientWidth - 32;
        let n = e.clientHeight - 32;
        let i = Math.min(t / r.naturalWidth, n / r.naturalHeight, 1);
        N(i > 0 ? i : 1);
      }
      h([n.getImageData(0, 0, t.width, t.height)]);
    };
    r.src = e;
  }, [e]);
  let ne = () => {
    let e = i.current;
    let t = e?.getContext(`2d`);
    if (!!e && !!t) {
      h(n => {
        return [...n, t.getImageData(0, 0, e.width, e.height)];
      });
    }
  };
  let B = e => {
    return Math.min(8, Math.max(0.05, e));
  };
  let re = () => {
    return N(e => {
      return B(e * 1.2);
    });
  };
  let V = () => {
    return N(e => {
      return B(e / 1.2);
    });
  };
  let ie = () => {
    let e = a.current;
    if (!e || !P.w || !P.h) {
      N(1);
      return;
    }
    let t = e.clientWidth - 32;
    let n = e.clientHeight - 32;
    N(B(Math.min(t / P.w, n / P.h, 1)));
  };
  let ae = () => {
    return N(1);
  };
  let oe = e => {
    e.preventDefault();
    N(t => {
      return B(t * (e.deltaY < 0 ? 1.1 : 0.9));
    });
  };
  Z.useEffect(() => {
    let e = e => {
      if (e.code === `Space` && !x.visible) {
        let t = e.target;
        if (t && (t.tagName === `INPUT` || t.tagName === `TEXTAREA`)) {
          return;
        }
        e.preventDefault();
        ee(true);
      }
    };
    let t = e => {
      if (e.code === `Space`) {
        ee(false);
        R(false);
      }
    };
    window.addEventListener(`keydown`, e);
    window.addEventListener(`keyup`, t);
    return () => {
      window.removeEventListener(`keydown`, e);
      window.removeEventListener(`keyup`, t);
    };
  }, [x.visible]);
  let H = e => {
    let t = a.current;
    if (t) {
      e.preventDefault();
      R(true);
      te.current = {
        x: e.clientX,
        y: e.clientY,
        scrollLeft: t.scrollLeft,
        scrollTop: t.scrollTop
      };
    }
  };
  Z.useEffect(() => {
    if (!L) {
      return;
    }
    let e = e => {
      let t = a.current;
      if (t) {
        t.scrollLeft = te.current.scrollLeft - (e.clientX - te.current.x);
        t.scrollTop = te.current.scrollTop - (e.clientY - te.current.y);
      }
    };
    let t = () => {
      return R(false);
    };
    window.addEventListener(`mousemove`, e);
    window.addEventListener(`mouseup`, t);
    return () => {
      window.removeEventListener(`mousemove`, e);
      window.removeEventListener(`mouseup`, t);
    };
  }, [L]);
  let se = () => {
    if (m.length <= 1) {
      return;
    }
    let e = i.current;
    let t = e?.getContext(`2d`);
    if (!e || !t) {
      return;
    }
    let n = m.slice(0, -1);
    h(n);
    let r = n[n.length - 1];
    e.width = r.width;
    e.height = r.height;
    t.putImageData(r, 0, 0);
  };
  let ce = e => {
    let t = i.current;
    if (!t) {
      return {
        x: 0,
        y: 0
      };
    }
    let n = t.getBoundingClientRect();
    let r = t.width / n.width;
    let a = t.height / n.height;
    let o;
    let s;
    if (`touches` in e) {
      o = e.touches[0].clientX;
      s = e.touches[0].clientY;
    } else {
      o = e.clientX;
      s = e.clientY;
    }
    return {
      x: (o - n.left) * r,
      y: (s - n.top) * a
    };
  };
  let U = e => {
    let {
      x: t,
      y: n
    } = ce(e);
    let r = i.current;
    let d = r?.getContext(`2d`);
    if (!!r && !!d) {
      if (o === `eyedropper`) {
        let e = d.getImageData(t, n, 1, 1).data;
        l(`#${`000000${(e[0] << 16 | e[1] << 8 | e[2]).toString(16)}`.slice(-6)}`);
        s(`pencil`);
        return;
      }
      if (o === `text`) {
        if (x.visible && x.text.trim()) {
          W();
        }
        let r;
        let i;
        if (`touches` in e) {
          r = e.touches[0].clientX;
          i = e.touches[0].clientY;
        } else {
          r = e.clientX;
          i = e.clientY;
        }
        let o = r;
        let s = i;
        if (a.current) {
          let e = a.current.getBoundingClientRect();
          o = r - e.left + a.current.scrollLeft;
          s = i - e.top + a.current.scrollTop;
        }
        S({
          visible: true,
          x: t,
          y: n,
          text: ``,
          clientX: o,
          clientY: s
        });
        setTimeout(() => {
          C.current?.focus();
        }, 0);
        return;
      }
      p(true);
      _({
        x: t,
        y: n
      });
      if (o === `pencil`) {
        d.beginPath();
        d.moveTo(t, n);
        d.strokeStyle = c;
        d.lineWidth = u;
        d.lineCap = `round`;
        d.lineJoin = `round`;
      } else if (o === `eraser`) {
        if (z.current) {
          d.save();
          d.beginPath();
          d.arc(t, n, u * 3, 0, Math.PI * 2);
          d.clip();
          d.drawImage(z.current, 0, 0, r.width, r.height);
          d.restore();
        }
      } else if (o === `number`) {
        ne();
        d.beginPath();
        d.arc(t, n, Math.max(15, u * 3), 0, Math.PI * 2);
        d.fillStyle = c;
        d.fill();
        d.fillStyle = `#ffffff`;
        d.font = `bold ${Math.max(16, u * 3)}px sans-serif`;
        d.textAlign = `center`;
        d.textBaseline = `middle`;
        d.fillText(y.toString(), t, n + 1);
        b(e => {
          return e + 1;
        });
        p(false);
      } else {
        ne();
      }
    }
  };
  let W = () => {
    if (!x.visible || !x.text.trim()) {
      S(e => {
        return {
          ...e,
          visible: false,
          text: ``
        };
      });
      return;
    }
    let e = i.current;
    let t = e?.getContext(`2d`);
    if (!!e && !!t) {
      ne();
      t.fillStyle = c;
      t.font = `bold ${Math.max(20, u * 5)}px sans-serif`;
      t.textAlign = `left`;
      t.textBaseline = `top`;
      t.fillText(x.text, x.x, x.y + 4);
      S({
        visible: false,
        x: 0,
        y: 0,
        text: ``,
        clientX: 0,
        clientY: 0
      });
    }
  };
  let le = e => {
    if (!f) {
      return;
    }
    let {
      x: t,
      y: n
    } = ce(e);
    let r = i.current;
    let a = r?.getContext(`2d`);
    if (!!r && !!a) {
      if (o === `pencil`) {
        a.lineTo(t, n);
        a.stroke();
      } else if (o === `eraser`) {
        if (z.current) {
          a.save();
          a.beginPath();
          a.arc(t, n, u * 3, 0, Math.PI * 2);
          a.clip();
          a.drawImage(z.current, 0, 0, r.width, r.height);
          a.restore();
        }
      } else if (o === `square` || o === `circle` || o === `line` || o === `arrow`) {
        if (m.length > 0) {
          a.putImageData(m[m.length - 1], 0, 0);
        }
        a.beginPath();
        a.strokeStyle = c;
        a.lineWidth = u;
        a.lineCap = `round`;
        a.lineJoin = `round`;
        if (o === `square`) {
          a.rect(g.x, g.y, t - g.x, n - g.y);
        } else if (o === `circle`) {
          let e = Math.sqrt((t - g.x) ** 2 + (n - g.y) ** 2);
          a.arc(g.x, g.y, e, 0, Math.PI * 2);
        } else if (o === `line`) {
          a.moveTo(g.x, g.y);
          a.lineTo(t, n);
        } else if (o === `arrow`) {
          let e = Math.max(10, u * 3);
          let r = t - g.x;
          let i = n - g.y;
          let o = Math.atan2(i, r);
          a.moveTo(g.x, g.y);
          a.lineTo(t, n);
          a.moveTo(t, n);
          a.lineTo(t - e * Math.cos(o - Math.PI / 6), n - e * Math.sin(o - Math.PI / 6));
          a.moveTo(t, n);
          a.lineTo(t - e * Math.cos(o + Math.PI / 6), n - e * Math.sin(o + Math.PI / 6));
        }
        a.stroke();
      }
    }
  };
  let G = () => {
    if (f) {
      p(false);
      if (o === `pencil`) {
        ne();
      }
    }
  };
  const Component2816 = `span`;
  const Component2817 = `button`;
  const Component2818 = `button`;
  const Component2819 = `button`;
  const Component2820 = `button`;
  const Component2821 = `button`;
  const Component2822 = `button`;
  const Component2823 = `button`;
  const Component2824 = `button`;
  const Component2825 = `button`;
  const Component2826 = `button`;
  const Component2827 = `div`;
  const Component2828 = `div`;
  const Component2829 = `input`;
  const Component2830 = `input`;
  const Component2831 = `div`;
  const Component2832 = `button`;
  const Component2833 = `button`;
  const Component2834 = `div`;
  const Component2835 = `option`;
  const Component2836 = `option`;
  const Component2837 = `option`;
  const Component2838 = `option`;
  const Component2839 = `option`;
  const Component2840 = `option`;
  const Component2841 = `select`;
  const Component2842 = `button`;
  const Component2843 = `button`;
  const Component2844 = `button`;
  const Component2845 = `div`;
  const Component2846 = `div`;
  const Component2847 = `canvas`;
  const Component2848 = `div`;
  const Component2849 = `input`;
  const Component2850 = `button`;
  const Component2851 = `button`;
  const Component2852 = `button`;
  const Component2853 = `div`;
  const Component2854 = `button`;
  const Component2855 = `div`;
  const Component2856 = `div`;
  const Component2857 = `div`;
  return Fn.createPortal(<Component2857 className={`fixed inset-0 z-[9999] flex flex-col bg-[#0d0c0c] select-none`}>
      <Component2846 className={`flex items-center justify-between p-3 bg-[#1c1c1c] border-b border-[#333]`}>
        <Component2834 className={`flex items-center gap-2`}>
          <Component2816 className={`text-white font-medium mr-4`}>{`图片编辑`}</Component2816>
          <Component2827 className={`flex items-center bg-[#2a2a2a] rounded-lg p-1`}>
            <Component2817 className={`p-2 rounded ${o === `pencil` ? `bg-blue-500 text-white` : `text-gray-400 hover:text-white`}`} onClick={() => {
            return s(`pencil`);
          }} title={`画笔`}>
              <_Component54 size={16} />
            </Component2817>
            <Component2818 className={`p-2 rounded ${o === `eraser` ? `bg-blue-500 text-white` : `text-gray-400 hover:text-white`}`} onClick={() => {
            return s(`eraser`);
          }} title={`橡皮擦`}>
              <_Component34 size={16} />
            </Component2818>
            <Component2819 className={`p-2 rounded ${o === `text` ? `bg-blue-500 text-white` : `text-gray-400 hover:text-white`}`} onClick={() => {
            return s(`text`);
          }} title={`文字`}>
              <_Component18 size={16} />
            </Component2819>
            <Component2820 className={`p-2 rounded ${o === `line` ? `bg-blue-500 text-white` : `text-gray-400 hover:text-white`}`} onClick={() => {
            return s(`line`);
          }} title={`直线`}>
              <_Component47 size={16} />
            </Component2820>
            <Component2821 className={`p-2 rounded ${o === `arrow` ? `bg-blue-500 text-white` : `text-gray-400 hover:text-white`}`} onClick={() => {
            return s(`arrow`);
          }} title={`箭头`}>
              <Ct size={16} />
            </Component2821>
            <Component2822 className={`p-2 rounded ${o === `square` ? `bg-blue-500 text-white` : `text-gray-400 hover:text-white`}`} onClick={() => {
            return s(`square`);
          }} title={`方框`}>
              <T size={16} />
            </Component2822>
            <Component2823 className={`p-2 rounded ${o === `circle` ? `bg-blue-500 text-white` : `text-gray-400 hover:text-white`}`} onClick={() => {
            return s(`circle`);
          }} title={`圆框`}>
              <Wt size={16} />
            </Component2823>
            <Component2824 className={`p-2 rounded ${o === `number` ? `bg-blue-500 text-white` : `text-gray-400 hover:text-white`}`} onClick={() => {
            return s(`number`);
          }} title={`序号标记`}>
              <De size={16} />
            </Component2824>
            <Component2825 className={`p-2 rounded ${o === `eyedropper` ? `bg-blue-500 text-white` : `text-gray-400 hover:text-white`}`} onClick={() => {
            return s(`eyedropper`);
          }} title={`吸管取色`}>
              <Y size={16} />
            </Component2825>
            <Component2826 className={`p-2 rounded ${o === `crop` ? `bg-blue-500 text-white` : `text-gray-400 hover:text-white`}`} onClick={() => {
            return s(`crop`);
          }} title={`裁剪`}>
              <Ze size={16} />
            </Component2826>
          </Component2827>
          <Component2828 className={`h-6 w-[1px] bg-[#444] mx-2`} />
          <Component2829 type={`color`} value={c} onChange={e => {
          return l(e.target.value);
        }} className={`w-8 h-8 rounded cursor-pointer bg-transparent border-none p-0`} />
          <Component2830 type={`range`} min={`1`} max={`20`} value={u} onChange={e => {
          return d(parseInt(e.target.value));
        }} className={`w-24 accent-blue-500 ml-2`} title={`粗细: ${u}px`} />
          <Component2831 className={`h-6 w-[1px] bg-[#444] mx-2`} />
          <Component2832 className={`p-2 rounded text-gray-400 hover:text-white hover:bg-[#333] ${m.length <= 1 ? `opacity-50 cursor-not-allowed` : ``}`} onClick={se} disabled={m.length <= 1} title={`撤销`}>
            <Ce size={16} />
          </Component2832>
          <Component2833 className={`p-2 rounded text-gray-400 hover:text-red-400 hover:bg-[#333]`} onClick={() => {
          let e = i.current;
          let t = e?.getContext(`2d`);
          if (!!e && !!t && !!z.current) {
            e.width = z.current.naturalWidth;
            e.height = z.current.naturalHeight;
            t.clearRect(0, 0, e.width, e.height);
            t.drawImage(z.current, 0, 0);
            ne();
            b(1);
          }
        }} title={`清空涂鸦`}>
            <Ot size={16} />
          </Component2833>
        </Component2834>
        <Component2845 className={`flex items-center gap-2`}>
          {o === `crop` && <Q.Fragment>
              <Component2841 className={`bg-[#2a2a2a] text-xs text-gray-200 px-2 py-1.5 rounded border border-[#444] focus:outline-none`} value={A || `free`} onChange={e => {
            return j(e.target.value === `free` ? undefined : parseFloat(e.target.value));
          }}>
                <Component2835 value={`free`}>{`自由尺寸`}</Component2835>
                <Component2836 value={16 / 9}>{`16:9`}</Component2836>
                <Component2837 value={9 / 16}>{`9:16`}</Component2837>
                <Component2838 value={1}>{`1:1`}</Component2838>
                <Component2839 value={4 / 3}>{`4:3`}</Component2839>
                <Component2840 value={3 / 4}>{`3:4`}</Component2840>
              </Component2841>
              <Component2842 onClick={() => {
            if (D && i.current) {
              let e = i.current;
              let t = e.getContext(`2d`);
              if (!t) {
                return;
              }
              let n = e.width / e.offsetWidth;
              let r = e.height / e.offsetHeight;
              let o = Math.round(D.x * n);
              let c = Math.round(D.y * r);
              let l = Math.round(D.width * n);
              let u = Math.round(D.height * r);
              o = Math.max(0, Math.min(o, e.width));
              c = Math.max(0, Math.min(c, e.height));
              l = Math.max(1, Math.min(l, e.width - o));
              u = Math.max(1, Math.min(u, e.height - c));
              let d = t.getImageData(o, c, l, u);
              ne();
              e.width = l;
              e.height = u;
              t.putImageData(d, 0, 0);
              z.current = null;
              F({
                w: l,
                h: u
              });
              let f = a.current;
              if (f) {
                let e = f.clientWidth - 32;
                let t = f.clientHeight - 32;
                let n = Math.min(e / l, t / u, 1);
                N(n > 0 ? n : 1);
              }
              E(undefined);
              O(undefined);
              s(`pencil`);
            }
          }} className={`px-3 py-1.5 rounded-lg bg-green-600 hover:bg-green-500 text-white transition-colors flex items-center gap-1 text-sm font-medium mr-2`}>
                <Se size={16} />
                {`确认裁剪`}
              </Component2842>
            </Q.Fragment>}
          <Component2843 onClick={r} className={`px-3 py-1.5 rounded-lg text-gray-300 hover:bg-[#333] transition-colors flex items-center gap-1 text-sm`}>
            <Gt size={16} />
            {`取消`}
          </Component2843>
          <Component2844 onClick={() => {
          if (i.current) {
            _cmp_Er(i.current.toDataURL(`image/jpeg`, 0.9), 2048, 0.85).then(e => {
              n(e);
            });
          }
        }} className={`px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition-colors flex items-center gap-1 text-sm font-medium`}>
            <Se size={16} />
            {`保存`}
          </Component2844>
        </Component2845>
      </Component2846>
      <Component2856 ref={a} onWheel={oe} onMouseDown={I ? H : undefined} className={`flex-1 overflow-auto bg-[#0a0a0a] relative`} style={{
      cursor: I ? L ? `grabbing` : `grab` : undefined
    }}>
        <Component2848 className={`min-w-full min-h-full flex items-center justify-center p-4 w-fit`}>
          <_Component27 crop={w} onChange={e => {
          return E(e);
        }} onComplete={e => {
          return O(e);
        }} aspect={A} disabled={o !== `crop`} style={{
          display: `block`,
          flex: `none`
        }}>
            <Component2847 ref={i} onMouseDown={o === `crop` ? undefined : U} onMouseMove={o === `crop` ? undefined : le} onMouseUp={o === `crop` ? undefined : G} onMouseLeave={o === `crop` ? undefined : G} onTouchStart={o === `crop` ? undefined : U} onTouchMove={o === `crop` ? undefined : le} onTouchEnd={o === `crop` ? undefined : G} className={`block shadow-2xl bg-white ${o === `eyedropper` ? `cursor-crosshair` : o === `text` ? `cursor-text` : o === `crop` ? `cursor-default` : `cursor-crosshair`}`} style={{
            touchAction: `none`,
            width: P.w ? `${P.w * M}px` : undefined,
            height: P.h ? `${P.h * M}px` : undefined,
            pointerEvents: I ? `none` : undefined
          }} />
          </_Component27>
        </Component2848>
        {x.visible && <Component2849 ref={C} type={`text`} value={x.text} onChange={e => {
        return S(t => {
          return {
            ...t,
            text: e.target.value
          };
        });
      }} onKeyDown={e => {
        if (e.key === `Enter`) {
          W();
        }
      }} onBlur={W} style={{
        position: `absolute`,
        left: x.clientX,
        top: x.clientY,
        color: c,
        fontSize: `${Math.max(20, u * 5)}px`,
        fontWeight: `bold`,
        background: `transparent`,
        border: `1px dashed #666`,
        outline: `none`,
        padding: 0,
        margin: 0,
        zIndex: 10000,
        minWidth: `20px`,
        transform: `translateY(-2px)`,
        lineHeight: 1
      }} placeholder={`输入文字...`} />}
        <Component2855 className={`absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1 px-2 py-1.5 bg-[#1c1c1c]/95 border border-[#333] rounded-lg shadow-xl backdrop-blur z-[10001]`}>
          <Component2850 onClick={V} className={`p-1.5 rounded text-gray-300 hover:text-white hover:bg-[#333]`} title={`缩小 (滚轮)`}>
            <_Component65 size={15} />
          </Component2850>
          <Component2851 onClick={ae} className={`px-2 text-[11px] text-gray-200 tabular-nums min-w-[44px] text-center hover:text-white`} title={`重置为 100%（空格拖动平移）`}>
            {Math.round(M * 100)}
            {`%`}
          </Component2851>
          <Component2852 onClick={re} className={`p-1.5 rounded text-gray-300 hover:text-white hover:bg-[#333]`} title={`放大 (滚轮)`}>
            <_Component1 size={15} />
          </Component2852>
          <Component2853 className={`w-[1px] h-4 bg-[#444] mx-0.5`} />
          <Component2854 onClick={ie} className={`p-1.5 rounded text-gray-300 hover:text-white hover:bg-[#333]`} title={`适应屏幕`}>
            <Tn size={15} />
          </Component2854>
        </Component2855>
      </Component2856>
    </Component2857>, document.body);
}