// TODO(全局, 无需 import): score, n, r, i, width
import { e, t } from './shared.js';
export default function _Component40({
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
    const Component885 = `span`;
    const Component886 = `span`;
    t.push(<Component886 className={`relative inline-block w-3 h-[3px] rounded-sm bg-[#3a3a3a] overflow-hidden`} key={n}>
        {i > 0 && <Component885 className={`absolute left-0 top-0 h-full bg-white/90 rounded-sm`} style={{
        width: i === 1 ? `100%` : `50%`
      }} />}
      </Component886>);
  }
  const Component887 = `span`;
  const Component888 = `span`;
  const Component889 = `span`;
  return <Component889 className={`inline-flex items-center gap-1 flex-wrap`}>
      <Component887 className={`inline-flex items-center gap-0.5`}>{t}</Component887>
      {e != null && <Component888 className={`text-[10px] text-gray-400 tabular-nums`}>{e}</Component888>}
    </Component889>;
}