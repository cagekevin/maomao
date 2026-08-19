// TODO(全局, 无需 import): text, names, placeholder, className, style, scrollTop, scrollLeft, s, l, n, i, userSelect, WebkitUserSelect, fontFamily, u, fontSize, fontWeight, fontStyle, fontVariant, fontStretch, letterSpacing, tabSize, lineHeight, whiteSpace, wordBreak, overflowWrap, textRendering, r, scrollbarGutter, f, transform
import { bo, e, t, c, d } from './shared.js';
export default function _Component18({
  text: e,
  names: t,
  placeholder: n,
  className: r = ``,
  style: i,
  scrollTop: a = 0,
  scrollLeft: o = 0
}) {
  let s = bo(e, t);
  let c = [];
  let l = 0;
  s.forEach((t, n) => {
    if (t.start > l) {
      c.push(e.slice(l, t.start));
    }
    const Component234 = `span`;
    c.push(<Component234 className={`text-cyan-400 font-medium`} key={`${t.start}-${n}`}>
        {t.value}
      </Component234>);
    l = t.end;
  });
  if (l < e.length) {
    c.push(e.slice(l));
  }
  let u = i || {};
  let d = {
    userSelect: `none`,
    WebkitUserSelect: `none`,
    fontFamily: u.fontFamily,
    fontSize: u.fontSize,
    fontWeight: u.fontWeight,
    fontStyle: u.fontStyle,
    fontVariant: u.fontVariant,
    fontStretch: u.fontStretch,
    letterSpacing: u.letterSpacing,
    tabSize: u.tabSize,
    lineHeight: u.lineHeight,
    whiteSpace: `pre-wrap`,
    wordBreak: `break-word`,
    overflowWrap: `break-word`,
    textRendering: `auto`
  };
  let f = !e;
  const Component235 = `div`;
  const Component236 = `div`;
  return <Component236 aria-hidden={true} className={`mention-highlight pointer-events-none overflow-hidden text-gray-200 ${r}`} style={{
    ...i,
    scrollbarGutter: `stable`
  }}>
      <Component235 className={`whitespace-pre-wrap break-words ${f && n ? `mention-placeholder-empty` : ``}`} data-placeholder={n || undefined} style={{
      transform: `translate(${-o}px, ${-a}px)`,
      scrollbarGutter: `stable`,
      ...d
    }}>
        {e ? c : null}
      </Component235>
    </Component236>;
}