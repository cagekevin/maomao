// TODO(全局, 无需 import): visible, minWidth, minHeight, maxWidth, maxHeight, keepAspectRatio, radius, o, n, r, i, width, s, height, translate, transform, background, border, borderRadius, cursor
import { t, a, Ne } from './shared.js';
export default function _Component9({
  visible: e = true,
  minWidth: t = 120,
  minHeight: n = 80,
  maxWidth: r,
  maxHeight: i,
  keepAspectRatio: a = false,
  radius: o = 12
}) {
  if (!e) {
    return null;
  }
  let s = o * 2;
  const Component103 = `path`;
  const Component104 = `svg`;
  return <Ne position={`bottom-right`} minWidth={t} minHeight={n} maxWidth={r} maxHeight={i} keepAspectRatio={a} style={{
    width: s,
    height: s,
    translate: `-100% -100%`,
    transform: `none`,
    background: `transparent`,
    border: `none`,
    borderRadius: 0,
    cursor: `nwse-resize`
  }}>
      <Component104 viewBox={`0 0 ${s} ${s}`} width={s} height={s} className={`block text-white/50 hover:text-blue-400 transition-colors pointer-events-none`} aria-hidden={`true`}>
        <Component103 d={`M ${o} ${s} A ${o} ${o} 0 0 0 ${s} ${o}`} fill={`none`} stroke={`currentColor`} strokeWidth={`2.5`} strokeLinecap={`round`} />
      </Component104>
    </Ne>;
}