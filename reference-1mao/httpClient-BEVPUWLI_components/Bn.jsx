// TODO(全局, 无需 import): url, fallbackExt, onToast, size, className, i, r, o, n, fileUrl, fileName
import _cmp__Component from './_Component.jsx';
import { a, In, e, Ln, t } from './shared.js';
import * as Z from 'react';
export default function Bn({
  url: e,
  fallbackExt: t = `mp4`,
  onToast: n,
  size: r = 14,
  className: i
}) {
  let [a, o] = Z.useState(false);
  const Component3 = `button`;
  return <Component3 className={i ?? `p-1.5 text-gray-400 hover:text-emerald-400 hover:bg-[#333] rounded-md transition-colors ${a ? `opacity-50 cursor-wait` : ``}`} title={`发送到剪映素材库`} onClick={async r => {
    r.stopPropagation();
    if (!e || a) {
      return;
    }
    o(true);
    n?.(`正在发送到剪映…`);
    let i = await In({
      fileUrl: e,
      fileName: Ln(e, t)
    });
    n?.(i.message);
    o(false);
  }} disabled={a}>
      <_cmp__Component size={r} />
    </Component3>;
}