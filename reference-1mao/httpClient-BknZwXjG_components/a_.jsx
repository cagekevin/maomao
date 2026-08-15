// TODO(全局, 无需 import): n, r
import { e, t, i_ } from './shared.js';
export default function a_(e, t) {
  if (!e) {
    return e;
  }
  let n = t.map(e => {
    return e.name;
  }).filter(Boolean).sort((e, t) => {
    return t.length - e.length;
  });
  if (n.length === 0) {
    return e;
  }
  let r = RegExp(`(@(?:${n.map(e => {
    return e.replace(/[.*+?^${}()|[\]\\]/g, `\\$&`);
  }).join(`|`)}))`, `g`);
  const Component2405 = `span`;
  return e.split(r).map((e, t) => {
    if (e.startsWith(`@`) && n.includes(e.slice(1))) {
      return <Component2405 className={`${i_} font-medium`} key={`${e}-${t}`}>
          {e}
        </Component2405>;
    } else {
      return e;
    }
  });
}