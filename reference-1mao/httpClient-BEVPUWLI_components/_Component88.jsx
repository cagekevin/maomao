// TODO(全局, 无需 import): src, alt, className, onDoubleClick, i, o, rootMargin, n, r
import { a, e, t } from './shared.js';
import * as Z from 'react';
var _Component88 = Z.memo(({
  src: e,
  alt: t,
  className: n,
  onDoubleClick: r
}) => {
  let i = Z.useRef(null);
  let [a, o] = Z.useState(false);
  Z.useEffect(() => {
    let e = i.current;
    if (!e || a) {
      return;
    }
    let t = new IntersectionObserver(e => {
      if (e.some(e => {
        return e.isIntersecting;
      })) {
        o(true);
        t.disconnect();
      }
    }, {
      rootMargin: `120px`
    });
    t.observe(e);
    return () => {
      return t.disconnect();
    };
  }, [a]);
  const Component2300 = `img`;
  const Component2301 = `div`;
  return <Component2301 ref={i} className={n} onDoubleClick={r}>
      {a && <Component2300 src={e} alt={t || ``} loading={`lazy`} decoding={`async`} draggable={false} className={`w-full h-full object-cover`} />}
    </Component2301>;
});
export default _Component88;