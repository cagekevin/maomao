// TODO(全局, 无需 import): className, variant, title, outerOffset, ballOutset, nodeCount, handleFollowLimit, u, l, n, r, i, o, s, f, p, position, m, width, height, left, right, g, bottom, minWidth, minHeight, margin, transform, background, border, borderRadius, opacity
import { a, t, xr, d, c, e, h, _, Kt } from './shared.js';
import * as Z from 'react';
var _Component12 = Z.memo(({
  className: e = ``,
  variant: t = `large`,
  title: n,
  outerOffset: r,
  ballOutset: i,
  ...a
}) => {
  let o = a.position === `left`;
  let s = a.position === `right`;
  let c = t === `large` ? 48 : 32;
  let l = Z.useRef(null);
  let {
    nodeCount: u,
    handleFollowLimit: d = 60
  } = xr();
  let f = u <= d;
  let p = c;
  Z.useEffect(() => {
    let e = l.current;
    if (!e) {
      return;
    }
    if (!f) {
      e.style.setProperty(`--cust-shift-x`, `0px`);
      e.style.setProperty(`--cust-shift-y`, `0px`);
      return;
    }
    let t = t => {
      let n = e.getBoundingClientRect();
      let r = n.left + n.width / 2;
      let i = n.top + n.height / 2;
      let a = t.clientX - r;
      let c = t.clientY - i;
      let l = Math.max(-14, Math.min(14, a * 0.35));
      let u = Math.max(-14, Math.min(14, c * 0.35));
      if (o) {
        l = Math.min(0, l);
      } else if (s) {
        l = Math.max(0, l);
      }
      e.style.setProperty(`--cust-shift-x`, `${l}px`);
      e.style.setProperty(`--cust-shift-y`, `${u}px`);
    };
    let n = () => {
      e.style.setProperty(`--cust-shift-x`, `0px`);
      e.style.setProperty(`--cust-shift-y`, `0px`);
    };
    e.addEventListener(`mousemove`, t);
    e.addEventListener(`mouseleave`, n);
    return () => {
      e.removeEventListener(`mousemove`, t);
      e.removeEventListener(`mouseleave`, n);
    };
  }, [f, o, s]);
  let m = p / 2;
  let h = typeof r == `number` ? r : 16;
  let g = Math.max(0, Math.min(p, h - (typeof i == `number` ? i : 0)));
  let _ = {
    position: `absolute`,
    top: typeof a.style?.top == `string` || typeof a.style?.top == `number` ? `calc(${a.style.top} - ${m}px)` : `calc(50% - ${m}px)`,
    width: p,
    height: p,
    ...(o ? {
      left: -h
    } : s ? {
      right: -h
    } : {}),
    '--cust-anchor-x': o ? `${g / p * 100}%` : s ? `${100 - g / p * 100}%` : `50%`
  };
  const Component96 = `span`;
  const Component97 = `span`;
  const Component98 = `span`;
  const Component99 = `div`;
  return <Component99 ref={l} className={`cust-handle-wrap ${t === `small` ? `is-small` : ``}`} style={_} title={n}>
        <Kt {...a} className={`!absolute !inset-0 !w-full !h-full !min-w-0 !min-h-0 !top-0 !left-0 !right-0 !bottom-0 !transform-none !bg-transparent !border-0 !rounded-none !opacity-0 ${e}`} style={{
      position: `absolute`,
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      width: `100%`,
      height: `100%`,
      minWidth: 0,
      minHeight: 0,
      margin: 0,
      transform: `none`,
      background: `transparent`,
      border: 0,
      borderRadius: 0,
      opacity: 0
    }} />
        <Component96 className={`cust-handle-ring`} />
        <Component97 className={`cust-handle-plus`} />
        <Component98 className={`cust-handle-dot`} />
      </Component99>;
});
export default _Component12;