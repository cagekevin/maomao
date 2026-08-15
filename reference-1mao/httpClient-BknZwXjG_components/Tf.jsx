// TODO(全局, 无需 import): title, className, children, n
import { t, e } from './shared.js';
export default function Tf({
  title: e,
  className: t,
  children: n
}) {
  const Component1924 = `h3`;
  const Component1925 = `section`;
  return <Component1925 className={`inspector-section${t ? ` ${t}` : ``}`}>
      <Component1924>{e}</Component1924>
      {n}
    </Component1925>;
}