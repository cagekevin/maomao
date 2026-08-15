// TODO(全局, 无需 import): src, alt, className, onDoubleClick, i, o, rootMargin, n, r
import { a, e, t } from './shared.js';
import * as Z from 'react';
var Lg = Z.memo(({
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
  const Component2278 = `img`;
  const Component2279 = `div`;
  return <Component2279 ref={i} className={n} onDoubleClick={r}>
      {a && <Component2278 src={e} alt={t || ``} loading={`lazy`} decoding={`async`} draggable={false} className={`w-full h-full object-cover`} />}
    </Component2279>;
});
export default Lg;