// TODO(全局, 无需 import): ratio, bottomPadding, showRuleOfThirds, onToggleRuleOfThirds, safeAreaInsets, width, height, s, n, i, o, r, left, u, l
import { a, e, wm, c, _Component28 } from './shared.js';
import * as _shared from './shared.js';
import * as Z from 'react';
export default function Tm({
  ratio: e,
  bottomPadding: t = 40,
  showRuleOfThirds: n = false,
  onToggleRuleOfThirds: r,
  safeAreaInsets: i
}) {
  let a = Z.useRef(null);
  let [o, s] = Z.useState({
    width: 0,
    height: 0
  });
  Z.useLayoutEffect(() => {
    let e = a.current;
    if (!e) {
      return;
    }
    let t = 0;
    let n = 0;
    let r = null;
    let i = () => {
      let n = {
        width: e.clientWidth,
        height: e.clientHeight
      };
      s(e => {
        if (e.width === n.width && e.height === n.height) {
          return e;
        } else {
          return n;
        }
      });
      if ((n.width === 0 || n.height === 0) && t === 0) {
        t = window.setTimeout(() => {
          t = 0;
          i();
        }, 60);
      }
    };
    let o = () => {
      cancelAnimationFrame(n);
      n = requestAnimationFrame(i);
    };
    i();
    o();
    window.addEventListener(`resize`, o);
    if (typeof ResizeObserver > `u`) {
      return () => {
        window.clearTimeout(t);
        cancelAnimationFrame(n);
        window.removeEventListener(`resize`, o);
      };
    } else {
      r = new ResizeObserver(o);
      r.observe(e);
      return () => {
        window.clearTimeout(t);
        cancelAnimationFrame(n);
        window.removeEventListener(`resize`, o);
        r?.disconnect();
      };
    }
  }, [e]);
  let c = Z.useMemo(() => {
    return wm(e, o.width, o.height, t, i);
  }, [t, o.height, o.width, e, i]);
  let l = Z.useMemo(() => {
    if (c) {
      return {
        width: `${c.width}px`,
        height: `${c.height}px`,
        left: `${c.left}px`,
        top: `${c.top}px`
      };
    } else {
      return null;
    }
  }, [c]);
  let u = Z.useMemo(() => {
    if (c) {
      return {
        '--viewport-aspect-frame-left': `${c.left}px`,
        '--viewport-aspect-frame-top': `${c.top}px`,
        '--viewport-aspect-frame-width': `${c.width}px`,
        '--viewport-aspect-frame-height': `${c.height}px`
      };
    } else {
      return null;
    }
  }, [c]);
  if (!l || !c) {
    return null;
  } else {
    const Component2084 = `div`;
    const Component2085 = `button`;
    const Component2086 = `div`;
    const Component2087 = `div`;
    const Component2088 = `div`;
    const Component2089 = `div`;
    const Component2090 = `div`;
    const Component2091 = `div`;
    const Component2092 = `div`;
    return <Component2092 className={`viewport-aspect-overlay`} ref={a}>
        {u ? <Component2084 className={`viewport-aspect-mask`} aria-label={`视口画幅遮罩`} aria-hidden={`true`} style={u} /> : null}
        <Component2091 className={`viewport-aspect-frame-shell`} aria-label={`视口画幅框`} data-aspect-ratio={e} style={l}>
          <Component2085 aria-label={n ? `关闭九宫格辅助线` : `开启九宫格辅助线`} aria-pressed={n} className={`viewport-aspect-guide-toggle${n ? ` is-active` : ``}`} type={`button`} onClick={() => {
          return r?.(!n);
        }}>
            <_Component28 aria-hidden={`true`} size={15} strokeWidth={1.8} />
          </Component2085>
          {n ? <Component2090 className={`viewport-rule-of-thirds`} aria-label={`九宫格辅助线`}>
              <Component2086 aria-label={`九宫格辅助线-竖线`} aria-hidden={`true`} className={`viewport-rule-of-thirds-line is-vertical is-one-third`} />
              <Component2087 aria-label={`九宫格辅助线-竖线`} aria-hidden={`true`} className={`viewport-rule-of-thirds-line is-vertical is-two-thirds`} />
              <Component2088 aria-label={`九宫格辅助线-横线`} aria-hidden={`true`} className={`viewport-rule-of-thirds-line is-horizontal is-one-third`} />
              <Component2089 aria-label={`九宫格辅助线-横线`} aria-hidden={`true`} className={`viewport-rule-of-thirds-line is-horizontal is-two-thirds`} />
            </Component2090> : null}
        </Component2091>
      </Component2092>;
  }
}