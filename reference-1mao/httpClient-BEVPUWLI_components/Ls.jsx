// TODO(全局, 无需 import): score, n, r, i, width
import { e, t } from './shared.js';
export default function Ls({
  score: e
}) {
  let t = [];
  for (let n = 0; n < 5; n++) {
    let r = n * 20;
    let i = 0;
    if (e != null) {
      let t = e - r;
      if (t >= 20) {
        i = 1;
      } else if (t > 0) {
        i = 0.5;
      }
    }
    const Component891 = `span`;
    const Component892 = `span`;
    t.push(<Component892 className={`relative inline-block w-3 h-[3px] rounded-sm bg-[#3a3a3a] overflow-hidden`} key={n}>
        {i > 0 && <Component891 className={`absolute left-0 top-0 h-full bg-white/90 rounded-sm`} style={{
        width: i === 1 ? `100%` : `50%`
      }} />}
      </Component892>);
  }
  const Component893 = `span`;
  const Component894 = `span`;
  const Component895 = `span`;
  return <Component895 className={`inline-flex items-center gap-1 flex-wrap`}>
      <Component893 className={`inline-flex items-center gap-0.5`}>{t}</Component893>
      {e != null && <Component894 className={`text-[10px] text-gray-400 tabular-nums`}>{e}</Component894>}
    </Component895>;
}