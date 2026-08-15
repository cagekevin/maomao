// TODO(全局, 无需 import): text, streaming, t, o, n, i
import { r, a, e } from './shared.js';
import * as W from 'react';
export default function Sr({
  text: e,
  streaming: t
}) {
  let [n, r] = W.useState(true);
  let [i, a] = W.useState(false);
  let o = W.useRef(t);
  W.useEffect(() => {
    if (o.current && !t) {
      r(false);
      a(true);
    }
    o.current = t;
  }, [t]);
  const Component672 = `polyline`;
  const Component673 = `svg`;
  const Component674 = `span`;
  const Component675 = `span`;
  const Component676 = `button`;
  const Component677 = `span`;
  const Component678 = `div`;
  const Component679 = `div`;
  return <Component679 className={`mb-1 border border-[#2a2a2a] rounded-md bg-[#0a0a0a]`}>
      <Component676 type={`button`} onClick={() => {
      r(!n);
      a(false);
    }} className={`w-full flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] text-gray-400 hover:text-gray-300 transition-colors`}>
        <Component673 width={`10`} height={`10`} viewBox={`0 0 24 24`} fill={`none`} stroke={`currentColor`} strokeWidth={`2.5`} strokeLinecap={`round`} strokeLinejoin={`round`} className={`transition-transform ${n ? `rotate-90` : ``}`}>
          <Component672 points={`9 18 15 12 9 6`} />
        </Component673>
        <Component674 className={`font-medium`}>
          {t ? `思考中...` : i ? `已思考` : `思考过程`}
        </Component674>
        {!t && <Component675 className={`ml-auto text-[10px] text-gray-600`}>
            {n ? `点击折叠` : `点击展开`}
          </Component675>}
      </Component676>
      {n && <Component678 className={`px-3 pb-2 pt-0.5 text-[12px] text-gray-500 whitespace-pre-wrap break-words border-t border-[#222] leading-relaxed`}>
          {e}
          {t && <Component677 className={`inline-block w-1 h-3 bg-gray-600 ml-0.5 animate-pulse align-middle`} />}
        </Component678>}
    </Component679>;
}