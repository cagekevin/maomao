// TODO(全局, 无需 import): state, onChange, upstreamUrls, layers, canvasWidth, canvasHeight, l, r, n, o, i, s, zIndex, u, imageUrl, x, scale, rotation, opacity, f, visible, naturalWidth, naturalHeight, p, bgColor, displayW, displayH, mode, layerId, startX, startY, origX, origY, origScale, origRotation, origCenterX, origCenterY, width, height, v, b, maskUrl, m, x0, y0, x1, y1, ce, se, drawing, lastX, lastY, z, cursor, touchAction, backgroundColor, backgroundImage, backgroundSize, backgroundPosition, g, left, transform, transformOrigin, visibility, background, ie, oe, k, locked, icon, label, disabled, onClick, danger, ee
import { e, I, F, t, a, c, d, P, N, zo, id, Ro, y, E, _, Ho, R, te, re, w, ae, h, S, C, T, O, U, V, ne, D, H, W, j, A, M, le, B, L, Fn, Gt, Ke, _Component30, _Component31, _Component32, _e, _Component33, _Component34, Ot, En, Sn, _Component36, _Component37 } from './shared.js';
import * as Z from 'react';
import * as Q from 'react';
export default function Uo({
  state: e,
  onChange: t,
  upstreamUrls: n
}) {
  let {
    layers: r,
    canvasWidth: i,
    canvasHeight: a
  } = e;
  let [s, c] = Z.useState(null);
  let [l, u] = Z.useState(null);
  let [d, p] = Z.useState(40);
  let [m, h] = Z.useState(`erase`);
  let [g, _] = Z.useState(null);
  let [v, y] = Z.useState(null);
  let b = Z.useRef(null);
  let x = Z.useRef(null);
  let S = Z.useRef(null);
  let C = Z.useRef([]);
  let w = Z.useRef([]);
  let T = Z.useRef(null);
  let E = Z.useRef(null);
  let [D, O] = Z.useState(null);
  let [k, A] = Z.useState(null);
  let [j, M] = Z.useState(null);
  let [N, P] = Z.useState(null);
  let [F, I] = Z.useState(false);
  Z.useEffect(() => {
    if (!l) {
      I(false);
    }
  }, [l]);
  Z.useEffect(() => {
    if (!F) {
      return;
    }
    let e = e => {
      if (e.key === `Escape`) {
        I(false);
      }
    };
    window.addEventListener(`keydown`, e);
    return () => {
      return window.removeEventListener(`keydown`, e);
    };
  }, [F]);
  let ee = Z.useCallback((n, i) => {
    let a = [...r].sort((e, t) => {
      return t.zIndex - e.zIndex;
    });
    let o = a.findIndex(e => {
      return e.id === n;
    });
    if (o < 0) {
      return;
    }
    let s = o;
    if (i === `top`) {
      s = 0;
    } else if (i === `bottom`) {
      s = a.length - 1;
    } else if (i === `up`) {
      s = Math.max(0, o - 1);
    } else if (i === `down`) {
      s = Math.min(a.length - 1, o + 1);
    }
    if (s === o) {
      return;
    }
    let c = a.slice();
    let [l] = c.splice(o, 1);
    c.splice(s, 0, l);
    let u = c.length;
    let d = c.map((e, t) => {
      return {
        ...e,
        zIndex: u - t
      };
    });
    t({
      ...e,
      layers: d
    });
  }, [r, e, t]);
  Z.useEffect(() => {
    if (!N) {
      return;
    }
    let e = () => {
      return P(null);
    };
    window.addEventListener(`click`, e);
    window.addEventListener(`contextmenu`, e);
    return () => {
      window.removeEventListener(`click`, e);
      window.removeEventListener(`contextmenu`, e);
    };
  }, [N]);
  let L = r.find(e => {
    return e.id === s;
  }) || null;
  Z.useEffect(() => {
    let o = false;
    (async () => {
      let s = new Set(n);
      let c = new Set(r.map(e => {
        return e.imageUrl;
      }));
      let l = n.filter(e => {
        return !c.has(e);
      });
      let u = r.filter(e => {
        return !s.has(e.imageUrl);
      });
      if (l.length === 0 && u.length === 0) {
        return;
      }
      let d = [];
      let f = r.reduce((e, t) => {
        return Math.max(e, t.zIndex);
      }, 0);
      for (let e of l) {
        let t = await zo(e);
        if (o) {
          return;
        }
        if (!t) {
          continue;
        }
        let n = t.naturalWidth || t.width;
        let r = t.naturalHeight || t.height;
        let s = Math.min(i / n, a / r, 1);
        f += 1;
        d.push({
          id: Ro(),
          imageUrl: e,
          x: (i - n * s) / 2,
          y: (a - r * s) / 2,
          scale: s,
          rotation: 0,
          opacity: 1,
          zIndex: f,
          visible: true,
          naturalWidth: n,
          naturalHeight: r
        });
      }
      if (o) {
        return;
      }
      let p = new Set(u.map(e => {
        return e.id;
      }));
      t({
        ...e,
        layers: [...r.filter(e => {
          return !p.has(e.id);
        }), ...d]
      });
    })();
    return () => {
      o = true;
    };
  }, [n.join(`|`), i, a]);
  Z.useEffect(() => {
    if (E.current) {
      window.clearTimeout(E.current);
    }
    let t = l ? 60 : 200;
    E.current = window.setTimeout(async () => {
      _(await Ho({
        layers: r,
        canvasWidth: i,
        canvasHeight: a,
        bgColor: e.bgColor
      }, 600));
    }, t);
    return () => {
      if (E.current) {
        window.clearTimeout(E.current);
      }
    };
  }, [r, i, a, e.bgColor, l]);
  let R = Z.useMemo(() => {
    let e = F ? Math.min(window.innerWidth - 80, 1600) : 320;
    let t = F ? Math.min(window.innerHeight - 200, 1000) : 360;
    let n = i / a;
    let r = e;
    let o = e / n;
    if (o > t) {
      o = t;
      r = o * n;
    }
    return {
      displayW: r,
      displayH: o,
      scale: r / i
    };
  }, [i, a, F]);
  let te = Z.useCallback((n, i) => {
    t({
      ...e,
      layers: r.map(e => {
        if (e.id === n) {
          return {
            ...e,
            ...i
          };
        } else {
          return e;
        }
      })
    });
  }, [r, e, t]);
  let z = Z.useCallback(n => {
    t({
      ...e,
      layers: r.filter(e => {
        return e.id !== n;
      })
    });
    if (s === n) {
      c(null);
    }
  }, [r, e, t, s]);
  let ne = Z.useCallback((e, t, n) => {
    if (t.locked || l) {
      return;
    }
    e.stopPropagation();
    e.preventDefault();
    c(t.id);
    let r = t.naturalWidth || 0;
    let i = t.naturalHeight || 0;
    y({
      mode: n,
      layerId: t.id,
      startX: e.clientX,
      startY: e.clientY,
      origX: t.x,
      origY: t.y,
      origScale: t.scale,
      origRotation: t.rotation,
      origCenterX: t.x + r * t.scale / 2,
      origCenterY: t.y + i * t.scale / 2,
      width: r,
      height: i
    });
  }, [l]);
  Z.useEffect(() => {
    if (!v) {
      return;
    }
    let e = e => {
      let t = (e.clientX - v.startX) / R.scale;
      let n = (e.clientY - v.startY) / R.scale;
      if (v.mode === `move`) {
        te(v.layerId, {
          x: v.origX + t,
          y: v.origY + n
        });
      } else if (v.mode === `scale`) {
        let e = v.origX + v.width * v.origScale + t;
        let n = Math.max(0.05, (e - v.origX) / v.width);
        te(v.layerId, {
          scale: n
        });
      } else if (v.mode === `rotate`) {
        let t = v.origCenterX;
        let n = v.origCenterY;
        let r = b.current?.getBoundingClientRect();
        if (!r) {
          return;
        }
        let i = (e.clientX - r.left) / R.scale;
        let a = (e.clientY - r.top) / R.scale;
        let o = Math.atan2(a - n, i - t) * 180 / Math.PI + 90;
        te(v.layerId, {
          rotation: o
        });
      }
    };
    let t = () => {
      return y(null);
    };
    window.addEventListener(`mousemove`, e);
    window.addEventListener(`mouseup`, t);
    return () => {
      window.removeEventListener(`mousemove`, e);
      window.removeEventListener(`mouseup`, t);
    };
  }, [v, te, R.scale]);
  let B = Z.useCallback(e => {
    u(e.id);
    c(e.id);
  }, []);
  let re = Z.useRef(null);
  Z.useEffect(() => {
    if (!l) {
      re.current = null;
      return;
    }
    if (re.current === l) {
      return;
    }
    let e = r.find(e => {
      return e.id === l;
    });
    if (!e) {
      return;
    }
    let t = e.naturalWidth || 0;
    let n = e.naturalHeight || 0;
    if (t <= 0 || n <= 0) {
      return;
    }
    let i = false;
    (async () => {
      await new Promise(e => {
        return requestAnimationFrame(() => {
          return e();
        });
      });
      if (i) {
        return;
      }
      let r = x.current;
      if (!r) {
        return;
      }
      r.width = t;
      r.height = n;
      let a = r.getContext(`2d`);
      if (!a) {
        return;
      }
      a.clearRect(0, 0, t, n);
      if (e.maskUrl) {
        let r = await zo(e.maskUrl);
        if (i) {
          return;
        }
        if (r) {
          a.drawImage(r, 0, 0, t, n);
        } else {
          a.fillStyle = `#fff`;
          a.fillRect(0, 0, t, n);
        }
      } else {
        a.fillStyle = `#fff`;
        a.fillRect(0, 0, t, n);
      }
      w.current = [];
      let o = a.getImageData(0, 0, r.width, r.height);
      w.current.push(o);
      re.current = l;
    })();
    return () => {
      i = true;
    };
  }, [l]);
  let V = () => {
    let e = x.current;
    if (!e) {
      return;
    }
    let t = e.getContext(`2d`);
    if (!t) {
      return;
    }
    let n = t.getImageData(0, 0, e.width, e.height);
    w.current.push(n);
    if (w.current.length > 20) {
      w.current.shift();
    }
  };
  let ie = () => {
    let e = x.current;
    if (!e || w.current.length <= 1) {
      return;
    }
    w.current.pop();
    let t = w.current[w.current.length - 1];
    let n = e.getContext(`2d`);
    if (n) {
      n.putImageData(t, 0, 0);
    }
  };
  let ae = Z.useCallback(() => {
    if (!l) {
      return;
    }
    let e = x.current;
    if (e) {
      te(l, {
        maskUrl: e.toDataURL(`image/png`)
      });
    }
  }, [l, te]);
  let oe = () => {
    ae();
    u(null);
  };
  let H = () => {
    ae();
    u(null);
  };
  let se = Z.useCallback((e, t, n) => {
    let r = b.current;
    if (!r) {
      return null;
    }
    let o = r.getBoundingClientRect();
    if (o.width <= 0 || o.height <= 0) {
      return null;
    }
    let s = (e - o.left) * (i / o.width);
    let c = (t - o.top) * (a / o.height);
    let l = n.x + (n.naturalWidth || 0) * n.scale / 2;
    let u = n.y + (n.naturalHeight || 0) * n.scale / 2;
    let d = -(n.rotation * Math.PI) / 180;
    let f = s - l;
    let p = c - u;
    let m = f * Math.cos(d) - p * Math.sin(d) + l;
    let h = f * Math.sin(d) + p * Math.cos(d) + u;
    return {
      x: (m - n.x) / n.scale,
      y: (h - n.y) / n.scale
    };
  }, [i, a]);
  let ce = Z.useCallback((e, t, n, r) => {
    let i = S.current;
    if (!i) {
      return;
    }
    let a = i.getContext(`2d`);
    if (a) {
      a.lineCap = `round`;
      a.lineJoin = `round`;
      a.lineWidth = d;
      a.globalCompositeOperation = `source-over`;
      if (m === `erase`) {
        a.strokeStyle = `rgba(250,204,21,0.85)`;
      } else {
        a.strokeStyle = `rgba(96,165,250,0.85)`;
      }
      a.beginPath();
      a.moveTo(e, t);
      a.lineTo(n, r);
      a.stroke();
      C.current.push({
        x0: e,
        y0: t,
        x1: n,
        y1: r
      });
    }
  }, [d, m]);
  let U = Z.useCallback(() => {
    let e = C.current;
    C.current = [];
    let t = S.current;
    if (t) {
      t.getContext(`2d`)?.clearRect(0, 0, t.width, t.height);
    }
    if (e.length === 0) {
      return;
    }
    let n = x.current;
    if (!n) {
      return;
    }
    let r = n.getContext(`2d`);
    if (r) {
      r.save();
      r.lineCap = `round`;
      r.lineJoin = `round`;
      r.lineWidth = d;
      if (m === `erase`) {
        r.globalCompositeOperation = `destination-out`;
        r.strokeStyle = `rgba(0,0,0,1)`;
      } else {
        r.globalCompositeOperation = `source-over`;
        r.strokeStyle = `rgba(255,255,255,1)`;
      }
      r.beginPath();
      for (let t of e) {
        r.moveTo(t.x0, t.y0);
        r.lineTo(t.x1, t.y1);
      }
      r.stroke();
      r.restore();
    }
  }, [d, m]);
  Z.useEffect(() => {
    if (!l) {
      return;
    }
    let e = r.find(e => {
      return e.id === l;
    });
    if (!e) {
      return;
    }
    let t = b.current;
    if (!t) {
      return;
    }
    let n = null;
    let i = null;
    let a = () => {
      i = null;
      let e = T.current;
      if (!!e && !!e.drawing && !!n) {
        ce(e.lastX, e.lastY, n.x, n.y);
        e.lastX = n.x;
        e.lastY = n.y;
        n = null;
      }
    };
    let o = n => {
      let r = se(n.clientX, n.clientY, e);
      if (!r) {
        return;
      }
      let i = e.naturalWidth || 0;
      let a = e.naturalHeight || 0;
      if (!(r.x < -50) && !(r.y < -50) && !(r.x > i + 50) && !(r.y > a + 50)) {
        n.preventDefault();
        n.stopPropagation();
        t.setPointerCapture?.(n.pointerId);
        T.current = {
          drawing: true,
          lastX: r.x,
          lastY: r.y
        };
        ce(r.x, r.y, r.x, r.y);
      }
    };
    let s = r => {
      let o = t.getBoundingClientRect();
      if (o.width > 0 && o.height > 0) {
        let e = t.clientWidth / o.width;
        let n = t.clientHeight / o.height;
        let i = (r.clientX - o.left) * e;
        let a = (r.clientY - o.top) * n;
        if (i >= 0 && a >= 0 && i <= t.clientWidth && a <= t.clientHeight) {
          O({
            x: i,
            y: a
          });
        } else {
          O(null);
        }
      }
      let s = T.current;
      if (!s || !s.drawing) {
        return;
      }
      let c = se(r.clientX, r.clientY, e);
      if (c) {
        n = c;
        i ??= requestAnimationFrame(a);
      }
    };
    let c = e => {
      let n = T.current;
      if (n?.drawing) {
        a();
        n.drawing = false;
        T.current = null;
        try {
          t.releasePointerCapture?.(e.pointerId);
        } catch {}
        U();
        V();
        ae();
      }
    };
    t.addEventListener(`pointerdown`, o);
    window.addEventListener(`pointermove`, s);
    window.addEventListener(`pointerup`, c);
    window.addEventListener(`pointercancel`, c);
    return () => {
      if (i != null) {
        cancelAnimationFrame(i);
      }
      t.removeEventListener(`pointerdown`, o);
      window.removeEventListener(`pointermove`, s);
      window.removeEventListener(`pointerup`, c);
      window.removeEventListener(`pointercancel`, c);
    };
  }, [l, r, d, m, se, ce, ae, U]);
  let W = Z.useMemo(() => {
    return [...r].sort((e, t) => {
      return t.zIndex - e.zIndex;
    });
  }, [r]);
  Z.useEffect(() => {
    if (!s && !l) {
      return;
    }
    let e = e => {
      if (e.key !== `Delete` && e.key !== `Backspace`) {
        return;
      }
      let t = e.target;
      if (!t || t.tagName !== `INPUT` && t.tagName !== `TEXTAREA` && !t.isContentEditable) {
        if (l) {
          e.stopPropagation();
          e.preventDefault();
          return;
        }
        if (s) {
          e.stopPropagation();
          e.preventDefault();
          z(s);
        }
      }
    };
    window.addEventListener(`keydown`, e, true);
    return () => {
      return window.removeEventListener(`keydown`, e, true);
    };
  }, [s, l, z]);
  let le = Z.useCallback((n, i) => {
    if (n === i) {
      return;
    }
    let a = [...r].sort((e, t) => {
      return t.zIndex - e.zIndex;
    });
    let o = a.findIndex(e => {
      return e.id === n;
    });
    let s = a.findIndex(e => {
      return e.id === i;
    });
    if (o < 0 || s < 0) {
      return;
    }
    let c = a.slice();
    let [l] = c.splice(o, 1);
    c.splice(s, 0, l);
    let u = c.length;
    let d = c.map((e, t) => {
      return {
        ...e,
        zIndex: u - t
      };
    });
    t({
      ...e,
      layers: d
    });
  }, [r, e, t]);
  const Component554 = `span`;
  const Component555 = `input`;
  const Component556 = `span`;
  const Component557 = `input`;
  const Component558 = `div`;
  const Component559 = `button`;
  const Component560 = `img`;
  const Component568 = `div`;
  const Component569 = `div`;
  const Component570 = `button`;
  const Component571 = `button`;
  const Component572 = `span`;
  const Component573 = `input`;
  const Component574 = `span`;
  const Component575 = `button`;
  const Component576 = `button`;
  const Component577 = `button`;
  const Component578 = `button`;
  const Component579 = `div`;
  const Component580 = `span`;
  const Component581 = `div`;
  const Component582 = `div`;
  const Component590 = `div`;
  const Component591 = `span`;
  const Component592 = `input`;
  const Component593 = `span`;
  const Component594 = `span`;
  const Component595 = `input`;
  const Component596 = `span`;
  const Component597 = `input`;
  const Component598 = `div`;
  const Component603 = `div`;
  return <Component603 className={`space-y-2`}>
      <Component558 className={`flex items-center gap-1.5 text-[10px] text-gray-400 nodrag flex-wrap`}>
        <Component554>{`画布`}</Component554>
        <Component555 type={`number`} min={64} max={4096} value={i} onChange={n => {
        return t({
          ...e,
          canvasWidth: Math.max(64, Math.min(4096, parseInt(n.target.value || `0`, 10) || i))
        });
      }} className={`w-16 bg-[#2a2a2a] text-gray-200 rounded px-1.5 py-0.5 border border-[#333] outline-none`} />
        <Component556>{`×`}</Component556>
        <Component557 type={`number`} min={64} max={4096} value={a} onChange={n => {
        return t({
          ...e,
          canvasHeight: Math.max(64, Math.min(4096, parseInt(n.target.value || `0`, 10) || a))
        });
      }} className={`w-16 bg-[#2a2a2a] text-gray-200 rounded px-1.5 py-0.5 border border-[#333] outline-none`} />
      </Component558>
      <Component569 className={F ? `fixed inset-0 z-[9999] bg-black/95 backdrop-blur-md flex flex-col items-center justify-center p-6 nodrag nowheel` : `flex justify-center bg-[#0d0d0d] rounded border border-[#333] p-2 nodrag`} onClick={F ? e => {
      return e.stopPropagation();
    } : undefined} onWheel={F ? e => {
      return e.stopPropagation();
    } : undefined}>
        {F && <Component559 className={`absolute top-3 right-3 flex items-center gap-1 px-2 py-1 rounded border bg-[#2a2a2a] border-[#444] text-gray-200 hover:text-white hover:border-[#666] text-xs`} onClick={() => {
        return I(false);
      }} title={`退出全屏 (Esc)`}>
            <Gt size={13} />
            {` 退出全屏`}
          </Component559>}
        <Component568 ref={b} className={`relative`} style={{
        width: R.displayW,
        height: R.displayH,
        cursor: l ? `crosshair` : `default`,
        touchAction: l ? `none` : `auto`,
        backgroundColor: `#1a1a1a`,
        backgroundImage: `linear-gradient(45deg, #2a2a2a 25%, transparent 25%), linear-gradient(-45deg, #2a2a2a 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #2a2a2a 75%), linear-gradient(-45deg, transparent 75%, #2a2a2a 75%)`,
        backgroundSize: `12px 12px`,
        backgroundPosition: `0 0, 0 6px, 6px -6px, -6px 0`
      }} onMouseDown={e => {
        e.stopPropagation();
        if (!l) {
          c(null);
        }
      }}>
          {g && <Component560 src={g} alt={`Preview`} className={`absolute inset-0 w-full h-full object-fill pointer-events-none`} />}
          {!l && r.filter(e => {
          return e.visible !== false;
        }).map(e => {
          let t = e.id === s;
          let n = e.naturalWidth || 0;
          let r = e.naturalHeight || 0;
          let i = n * e.scale * R.scale;
          let a = r * e.scale * R.scale;
          let o = e.x * R.scale;
          let l = e.y * R.scale;
          const Component561 = `div`;
          const Component562 = `div`;
          const Component563 = `div`;
          return <Component563 className={`absolute ${t ? `outline outline-1 outline-blue-400` : `outline outline-1 outline-transparent hover:outline-blue-300/40`} ${e.locked ? `cursor-not-allowed` : `cursor-move`}`} style={{
            left: o,
            top: l,
            width: i,
            height: a,
            transform: `rotate(${e.rotation}deg)`,
            transformOrigin: `center center`
          }} onMouseDown={t => {
            return ne(t, e, `move`);
          }} onContextMenu={t => {
            t.preventDefault();
            t.stopPropagation();
            c(e.id);
            let n = t.clientX;
            let r = t.clientY;
            setTimeout(() => {
              return P({
                id: e.id,
                x: n,
                y: r
              });
            }, 0);
          }} key={e.id}>
                    {t && !e.locked && <Q.Fragment>
                        <Component561 className={`absolute -right-1.5 -bottom-1.5 w-3 h-3 bg-blue-400 border border-white rounded-sm cursor-se-resize`} onMouseDown={t => {
                return ne(t, e, `scale`);
              }} />
                        <Component562 className={`absolute left-1/2 -translate-x-1/2 -top-5 w-2 h-2 bg-blue-400 border border-white rounded-full cursor-grab`} onMouseDown={t => {
                return ne(t, e, `rotate`);
              }} />
                      </Q.Fragment>}
                  </Component563>;
        })}
          {l && (() => {
          let e = r.find(e => {
            return e.id === l;
          });
          if (!e) {
            return null;
          }
          let t = e.naturalWidth || 0;
          let n = e.naturalHeight || 0;
          let a = b.current;
          let o = a ? a.clientWidth / i : R.scale;
          let s = t * e.scale * o;
          let c = n * e.scale * o;
          const Component564 = `canvas`;
          const Component565 = `canvas`;
          const Component566 = `div`;
          return <Component566 className={`absolute outline outline-2 outline-orange-400/80 pointer-events-none`} style={{
            left: e.x * o,
            top: e.y * o,
            width: s,
            height: c,
            transform: `rotate(${e.rotation}deg)`,
            transformOrigin: `center center`
          }}>
                  <Component564 ref={x} className={`w-full h-full block`} style={{
              visibility: `hidden`
            }} />
                  <Component565 ref={S} className={`absolute inset-0 w-full h-full block`} width={t} height={n} />
                </Component566>;
        })()}
          {l && D && (() => {
          let e = r.find(e => {
            return e.id === l;
          });
          if (!e) {
            return null;
          }
          let t = b.current;
          let n = t ? t.clientWidth / i : R.scale;
          let a = d * e.scale * n;
          const Component567 = `div`;
          return <Component567 className={`absolute rounded-full border border-white/80 shadow-[0_0_4px_rgba(0,0,0,0.6)] pointer-events-none`} style={{
            width: a,
            height: a,
            left: D.x - a / 2,
            top: D.y - a / 2,
            background: m === `erase` ? `rgba(244,63,94,0.25)` : `rgba(96,165,250,0.25)`
          }} />;
        })()}
        </Component568>
      </Component569>
      {l && <Component579 className={`flex flex-wrap items-center gap-1.5 text-[10px] text-gray-300 bg-[#1c1c1c] border border-orange-500/40 rounded p-1.5 nodrag`}>
          <Component570 className={`px-1.5 py-0.5 rounded border ${m === `erase` ? `bg-orange-500/15 border-orange-500/60 text-orange-300` : `bg-[#2a2a2a] border-[#333] text-gray-300`}`} onClick={() => {
        return h(`erase`);
      }}>{`擦除`}</Component570>
          <Component571 className={`px-1.5 py-0.5 rounded border ${m === `restore` ? `bg-orange-500/15 border-orange-500/60 text-orange-300` : `bg-[#2a2a2a] border-[#333] text-gray-300`}`} onClick={() => {
        return h(`restore`);
      }}>{`恢复`}</Component571>
          <Component572 className={`ml-1`}>{`笔刷`}</Component572>
          <Component573 type={`range`} min={4} max={200} value={d} onChange={e => {
        return p(parseInt(e.target.value, 10));
      }} className={`w-20 accent-orange-400`} />
          <Component574 className={`text-gray-400`}>
            {d}
            {`px`}
          </Component574>
          <Component575 className={`ml-auto px-1.5 py-0.5 rounded border bg-[#2a2a2a] border-[#333] text-gray-300 hover:text-white`} onClick={() => {
        return I(true);
      }} title={`全屏涂抹`}>
            <Ke size={11} />
          </Component575>
          <Component576 className={`px-1.5 py-0.5 rounded border bg-[#2a2a2a] border-[#333] text-gray-300 hover:text-white`} onClick={ie}>{`撤销`}</Component576>
          <Component577 className={`px-1.5 py-0.5 rounded border bg-[#2a2a2a] border-[#333] text-gray-300 hover:text-white`} onClick={H}>{`取消`}</Component577>
          <Component578 className={`px-1.5 py-0.5 rounded border bg-orange-500/15 border-orange-500/60 text-orange-200`} onClick={oe}>{`完成`}</Component578>
        </Component579>}
      <Component590 className={`bg-[#1c1c1c] border border-[#333] rounded p-1.5 max-h-[180px] overflow-y-auto nodrag`}>
        <Component581 className={`flex items-center gap-1 text-[10px] text-gray-400 mb-1`}>
          <_Component30 size={11} />
          <Component580>
            {`图层（`}
            {r.length}
            {`）`}
          </Component580>
        </Component581>
        {W.length === 0 ? <Component582 className={`text-[10px] text-gray-500 py-2 text-center`}>{`连线一张图即作为新图层导入`}</Component582> : W.map(e => {
        let t = k === e.id;
        let n = j === e.id && k !== e.id;
        const Component583 = `button`;
        const Component584 = `button`;
        const Component585 = `img`;
        const Component586 = `span`;
        const Component587 = `button`;
        const Component588 = `button`;
        const Component589 = `div`;
        return <Component589 draggable={true} onDragStart={t => {
          t.stopPropagation();
          A(e.id);
          t.dataTransfer.effectAllowed = `move`;
          t.dataTransfer.setData(`application/x-yimao-layer`, e.id);
          let n = document.createElement(`div`);
          n.style.cssText = `position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;opacity:0;`;
          document.body.appendChild(n);
          t.dataTransfer.setDragImage(n, 0, 0);
          setTimeout(() => {
            try {
              document.body.removeChild(n);
            } catch {}
          }, 0);
        }} onDragEnter={t => {
          if (k !== null) {
            t.preventDefault();
            t.stopPropagation();
            M(e.id);
          }
        }} onDragOver={e => {
          if (k !== null) {
            e.preventDefault();
            e.stopPropagation();
            e.dataTransfer.dropEffect = `move`;
          }
        }} onDragLeave={t => {
          t.stopPropagation();
          M(t => {
            if (t === e.id) {
              return null;
            } else {
              return t;
            }
          });
        }} onDrop={t => {
          t.preventDefault();
          t.stopPropagation();
          let n = t.dataTransfer.getData(`application/x-yimao-layer`) || k;
          if (n && n !== e.id) {
            le(n, e.id);
          }
          A(null);
          M(null);
        }} onDragEnd={e => {
          e.stopPropagation();
          A(null);
          M(null);
        }} className={`flex items-center gap-1 px-1 py-0.5 rounded text-[10px] cursor-grab active:cursor-grabbing transition-colors
              ${s === e.id ? `bg-blue-500/15` : `hover:bg-white/5`}
              ${t ? `opacity-40` : ``}
              ${n ? `ring-1 ring-blue-400 bg-blue-400/10` : ``}
            `} onMouseDown={e => {
          return e.stopPropagation();
        }} onClick={t => {
          t.stopPropagation();
          c(e.id);
        }} onContextMenu={t => {
          t.preventDefault();
          t.stopPropagation();
          c(e.id);
          let n = t.clientX;
          let r = t.clientY;
          setTimeout(() => {
            return P({
              id: e.id,
              x: n,
              y: r
            });
          }, 0);
        }} key={e.id}>
                <Component583 className={`text-gray-400 hover:text-white`} onClick={t => {
            t.stopPropagation();
            te(e.id, {
              visible: e.visible === false
            });
          }} title={`显隐`}>
                  {e.visible === false ? <_Component31 size={11} /> : <_Component32 size={11} />}
                </Component583>
                <Component584 className={`text-gray-400 hover:text-white`} onClick={t => {
            t.stopPropagation();
            te(e.id, {
              locked: !e.locked
            });
          }} title={`锁定`}>
                  {e.locked ? <_e size={11} /> : <_Component33 size={11} />}
                </Component584>
                <Component585 src={e.imageUrl} alt={``} className={`w-6 h-6 object-cover rounded pointer-events-none`} />
                <Component586 className={`flex-1 truncate text-gray-300`}>
                  {`图层 `}
                  {e.zIndex}
                </Component586>
                <Component587 className={`text-gray-400 hover:text-orange-300`} onClick={t => {
            t.stopPropagation();
            B(e);
          }} title={`涂抹擦除`}>
                  <_Component34 size={11} />
                </Component587>
                <Component588 className={`text-gray-400 hover:text-red-300`} onClick={t => {
            t.stopPropagation();
            z(e.id);
          }} title={`删除`}>
                  <Ot size={11} />
                </Component588>
              </Component589>;
      })}
      </Component590>
      {L && !l && <Component598 className={`flex items-center gap-1.5 text-[10px] text-gray-400 nodrag`}>
          <Component591>{`不透明`}</Component591>
          <Component592 type={`range`} min={0} max={100} value={Math.round(L.opacity * 100)} onChange={e => {
        return te(L.id, {
          opacity: parseInt(e.target.value, 10) / 100
        });
      }} className={`w-20 accent-blue-400`} />
          <Component593>
            {Math.round(L.opacity * 100)}
            {`%`}
          </Component593>
          <Component594 className={`ml-2`}>{`缩放`}</Component594>
          <Component595 type={`number`} min={0.05} max={10} step={0.05} value={Number(L.scale.toFixed(2))} onChange={e => {
        return te(L.id, {
          scale: Math.max(0.05, parseFloat(e.target.value) || L.scale)
        });
      }} className={`w-14 bg-[#2a2a2a] text-gray-200 rounded px-1 py-0.5 border border-[#333] outline-none`} />
          <Component596 className={`ml-2`}>{`旋转`}</Component596>
          <Component597 type={`number`} min={-360} max={360} step={1} value={Math.round(L.rotation)} onChange={e => {
        return te(L.id, {
          rotation: parseFloat(e.target.value) || 0
        });
      }} className={`w-14 bg-[#2a2a2a] text-gray-200 rounded px-1 py-0.5 border border-[#333] outline-none`} />
        </Component598>}
      {N && Fn.createPortal((() => {
      let e = r.find(e => {
        return e.id === N.id;
      });
      if (!e) {
        return null;
      }
      let t = [...r].sort((e, t) => {
        return t.zIndex - e.zIndex;
      });
      let n = t.findIndex(t => {
        return t.id === e.id;
      });
      let i = n === 0;
      let a = n === t.length - 1;
      const Component599 = `span`;
      const Component600 = `button`;
      let _Component35 = ({
        icon: e,
        label: t,
        disabled: n,
        onClick: r,
        danger: i
      }) => {
        return <Component600 disabled={n} onClick={e => {
          e.stopPropagation();
          if (!n) {
            r();
            P(null);
          }
        }} className={`w-full flex items-center gap-2 px-2 py-1 text-[11px] text-left rounded transition-colors ${n ? `opacity-40 cursor-not-allowed` : i ? `text-red-300 hover:bg-red-500/15` : `text-gray-200 hover:bg-blue-500/15`}`}>
                  {e}
                  <Component599>{t}</Component599>
                </Component600>;
      };
      const Component601 = `div`;
      const Component602 = `div`;
      return <Component602 className={`fixed z-[10000] min-w-[140px] bg-[#1c1c1c] border border-[#333] rounded-md shadow-2xl p-1`} style={{
        top: N.y,
        left: N.x
      }} onClick={e => {
        return e.stopPropagation();
      }} onContextMenu={e => {
        return e.preventDefault();
      }}>
                <_Component35 icon={<En size={12} />} label={`移到顶部`} disabled={i} onClick={() => {
          return ee(e.id, `top`);
        }} />
                <_Component35 icon={<Sn size={12} />} label={`上移一层`} disabled={i} onClick={() => {
          return ee(e.id, `up`);
        }} />
                <_Component35 icon={<_Component36 size={12} />} label={`下移一层`} disabled={a} onClick={() => {
          return ee(e.id, `down`);
        }} />
                <_Component35 icon={<_Component37 size={12} />} label={`移到底部`} disabled={a} onClick={() => {
          return ee(e.id, `bottom`);
        }} />
                <Component601 className={`h-px my-1 bg-[#333]`} />
                <_Component35 icon={<_Component34 size={12} />} label={`涂抹擦除`} onClick={() => {
          return B(e);
        }} />
                <_Component35 icon={<Ot size={12} />} label={`删除图层`} onClick={() => {
          return z(e.id);
        }} danger={true} />
              </Component602>;
    })(), document.body)}
    </Component603>;
}