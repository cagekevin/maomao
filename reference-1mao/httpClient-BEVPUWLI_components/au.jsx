// TODO(全局, 无需 import): data, selected, updateNodeData, handleType, i, o, f, p, u, m, r, text, n, l, prefix, s, separator, suffix
import _cmp_Ti from './Ti.jsx';
import _cmp__Component10 from './_Component10.jsx';
import { id, We, Lt, Qt, e, t, Ua, a, c, X, d, _Component17 } from './shared.js';
import * as Z from 'react';
var au = Z.memo(({
  id: e,
  data: t,
  selected: n
}) => {
  let {
    updateNodeData: r
  } = We();
  let i = Lt({
    handleType: `target`
  });
  let a = Qt(i.map(e => {
    return e.source;
  }));
  let [o, s] = Z.useState(t.separator === undefined ? `\\n` : t.separator);
  let [c, l] = Z.useState(t.prefix || ``);
  let [u, d] = Z.useState(t.suffix || ``);
  let f = i.map(e => {
    return Ua(a.find(t => {
      return t?.id === e.source;
    }));
  }).filter(e => {
    return e;
  });
  let p = o.replace(/\\n/g, `
`);
  let m = f.length > 0 ? `${c}${f.join(p)}${u}` : ``;
  Z.useEffect(() => {
    if (t.text !== m) {
      r(e, {
        text: m
      });
    }
  }, [m, e, r, t.text]);
  const Component1735 = `label`;
  const Component1736 = `input`;
  const Component1737 = `div`;
  const Component1738 = `label`;
  const Component1739 = `input`;
  const Component1740 = `div`;
  const Component1741 = `label`;
  const Component1742 = `input`;
  const Component1743 = `div`;
  const Component1744 = `span`;
  const Component1745 = `label`;
  const Component1746 = `textarea`;
  const Component1747 = `div`;
  const Component1748 = `div`;
  const Component1749 = `div`;
  const Component1750 = `div`;
  return <Component1750 className={`relative flex flex-col`}>
      <_cmp_Ti id={e} data={t} defaultTitle={`文字拼接`} icon={<_Component17 size={11} className={`text-gray-500`} />} />
      <Component1749 className={`w-[260px] bg-[#1a1a1a] rounded-xl shadow-2xl border-2 transition-colors ${n ? `border-[#555]` : `border-[#333] hover:border-[#444]`}`}>
        <_cmp__Component10 type={`target`} position={X.Left} />
        <Component1748 className={`p-3 space-y-3`}>
          <Component1737 className={`space-y-1`}>
            <Component1735 className={`text-[10px] text-gray-500`}>{`前缀`}</Component1735>
            <Component1736 type={`text`} value={c} onChange={t => {
            l(t.target.value);
            r(e, {
              prefix: t.target.value
            });
          }} className={`w-full bg-[#111] border border-[#333] rounded px-2 py-1 text-xs text-gray-300 focus:outline-none focus:border-gray-500 nodrag`} placeholder={`可选`} />
          </Component1737>
          <Component1740 className={`space-y-1`}>
            <Component1738 className={`text-[10px] text-gray-500`}>{`分隔符 (输入 \\n 表示换行)`}</Component1738>
            <Component1739 type={`text`} value={o} onChange={t => {
            s(t.target.value);
            r(e, {
              separator: t.target.value
            });
          }} className={`w-full bg-[#111] border border-[#333] rounded px-2 py-1 text-xs text-gray-300 focus:outline-none focus:border-gray-500 nodrag`} />
          </Component1740>
          <Component1743 className={`space-y-1`}>
            <Component1741 className={`text-[10px] text-gray-500`}>{`后缀`}</Component1741>
            <Component1742 type={`text`} value={u} onChange={t => {
            d(t.target.value);
            r(e, {
              suffix: t.target.value
            });
          }} className={`w-full bg-[#111] border border-[#333] rounded px-2 py-1 text-xs text-gray-300 focus:outline-none focus:border-gray-500 nodrag`} placeholder={`可选`} />
          </Component1743>
          <Component1747 className={`space-y-1 pt-2 border-t border-[#333]`}>
            <Component1745 className={`text-[10px] text-gray-500 flex justify-between`}>
              <Component1744>
                {`拼接结果 (`}
                {f.length}
                {` 个输入)`}
              </Component1744>
            </Component1745>
            <Component1746 readOnly={true} value={m} className={`w-full bg-[#111] border border-[#333] rounded px-2 py-1 text-xs text-gray-300 h-[60px] resize-y custom-scrollbar`} placeholder={`等待连入文本...`} />
          </Component1747>
        </Component1748>
        <_cmp__Component10 type={`source`} position={X.Right} id={`text`} />
      </Component1749>
    </Component1750>;
});
export default au;