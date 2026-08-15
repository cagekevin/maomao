// TODO(全局, 无需 import): title, code, emptyHint, t, n
import { e, r, I } from './shared.js';
import * as W from 'react';
var Mn = ({
  title: e,
  code: t,
  emptyHint: n
}) => {
  let r = W.useCallback(async () => {
    if (t) {
      try {
        await navigator.clipboard.writeText(t);
      } catch {}
    }
  }, [t]);
  const Component390 = `span`;
  const Component391 = `button`;
  const Component392 = `div`;
  const Component393 = `span`;
  const Component394 = `pre`;
  const Component395 = `div`;
  return <Component395 className={`rounded bg-black/30`}>
      <Component392 className={`flex items-center justify-between px-2 py-1 text-[10px] text-gray-500`}>
        <Component390 className={`font-mono`}>{e}</Component390>
        {t && <Component391 onClick={r} className={`hover:text-gray-300 inline-flex items-center gap-1`} title={`复制${e}`}>
            <I size={10} />
          </Component391>}
      </Component392>
      <Component394 className={`px-2 pb-2 text-[10px] text-gray-300 max-h-48 overflow-auto custom-scrollbar nowheel nopan nodrag font-mono leading-relaxed`}>
        {t || <Component393 className={`text-gray-600`}>{n || `(空)`}</Component393>}
      </Component394>
    </Component395>;
};
export default Mn;