// TODO(全局, 无需 import): data, defaultTitle, icon, className, floating, updateNodeData, n, r, o, label, i, l, s, u
import { id, We, t, c, e, a, d } from './shared.js';
import * as Z from 'react';
export default function _Component8({
  id: e,
  data: t,
  defaultTitle: n,
  icon: r,
  className: i = ``,
  floating: a = false
}) {
  let {
    updateNodeData: o
  } = We();
  let [s, c] = Z.useState(t.label || n);
  let [l, u] = Z.useState(false);
  Z.useEffect(() => {
    c(t.label || n);
  }, [t.label, n]);
  let d = t => {
    let r = t.trim() || n;
    c(r);
    o(e, {
      label: r
    });
  };
  const Component100 = `input`;
  const Component101 = `button`;
  const Component102 = `div`;
  return <Component102 className={`${a ? `absolute -top-6 left-0 z-30` : `mb-1 self-start`} flex items-center gap-1.5 text-[11px] text-gray-400 drag-handle cursor-move ${i}`}>
      {r}
      {l ? <Component100 value={s} onChange={e => {
      return c(e.target.value);
    }} onBlur={e => {
      u(false);
      d(e.target.value);
    }} onKeyDown={e => {
      if (e.key === `Enter`) {
        u(false);
        d(e.currentTarget.value);
      }
      if (e.key === `Escape`) {
        u(false);
        c(t.label || n);
      }
    }} onClick={e => {
      return e.stopPropagation();
    }} onMouseDown={e => {
      return e.stopPropagation();
    }} className={`nodrag nowheel nopan w-32 rounded border border-[#444] bg-[#111] px-1.5 py-0.5 text-[11px] text-gray-200 outline-none focus:border-blue-500`} autoFocus={true} /> : <Component101 type={`button`} onDoubleClick={e => {
      e.stopPropagation();
      u(true);
    }} className={`max-w-[180px] truncate rounded px-0.5 text-left hover:text-gray-200 hover:bg-white/5`} title={`双击修改名称`}>
          {s || n}
        </Component101>}
    </Component102>;
}