// TODO(全局, 无需 import): title, className, children, n
import { t, e } from './shared.js';
export default function Kf({
  title: e,
  className: t,
  children: n
}) {
  const Component1946 = `h3`;
  const Component1947 = `section`;
  return <Component1947 className={`inspector-section${t ? ` ${t}` : ``}`}>
      <Component1946>{e}</Component1946>
      {n}
    </Component1947>;
}