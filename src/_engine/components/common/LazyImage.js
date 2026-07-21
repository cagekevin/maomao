import { i as e } from "../../rolldown-runtime-aKtaBQYM.js";
import { Nr as le, Ar as o, Mr as ae } from "../../vendor-Cr1JWW-B.js";

var Y = e(le(), 1),
  Un = ae();
var X = o();
var Fh = Y.memo(({
  src: e,
  alt: t,
  className: n,
  onDoubleClick: r
}) => {
  let i = Y.useRef(null),
    [a, o] = Y.useState(false);
  return Y.useEffect(() => {
    let e = i.current;
    if (!e || a) return;
    let t = new IntersectionObserver(e => {
      e.some(e => e.isIntersecting) && (o(true), t.disconnect());
    }, {
      rootMargin: `120px`
    });
    return t.observe(e), () => t.disconnect();
  }, [a]), X.jsx(`div`, {
    ref: i,
    className: n,
    onDoubleClick: r,
    children: a && X.jsx(`img`, {
      src: e,
      alt: t || ``,
      loading: `lazy`,
      decoding: `async`,
      draggable: false,
      className: `w-full h-full object-cover`
    })
  });
});

export { Fh };
