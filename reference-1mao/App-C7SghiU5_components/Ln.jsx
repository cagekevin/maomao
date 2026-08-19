// TODO(全局, 无需 import): title, code, emptyHint, t, n
import { e, r, F } from './shared.js';
import * as G from 'react';
var Ln = ({
  title: e,
  code: t,
  emptyHint: n
}) => {
  let r = G.useCallback(async () => {
    if (t) {
      try {
        await navigator.clipboard.writeText(t);
      } catch {}
    }
  }, [t]);
  const Component391 = `span`;
  const Component392 = `button`;
  const Component393 = `div`;
  const Component394 = `span`;
  const Component395 = `pre`;
  const Component396 = `div`;
  return <Component396 className={`rounded bg-black/30`}>
      <Component393 className={`flex items-center justify-between px-2 py-1 text-[10px] text-gray-500`}>
        <Component391 className={`font-mono`}>{e}</Component391>
        {t && <Component392 onClick={r} className={`hover:text-gray-300 inline-flex items-center gap-1`} title={`复制${e}`}>
            <F size={10} />
          </Component392>}
      </Component393>
      <Component395 className={`px-2 pb-2 text-[10px] text-gray-300 max-h-48 overflow-auto custom-scrollbar nowheel nopan nodrag font-mono leading-relaxed`}>
        {t || <Component394 className={`text-gray-600`}>{n || `(空)`}</Component394>}
      </Component395>
    </Component396>;
};
export default Ln;