// TODO(全局, 无需 import): data, selected, updateNodeData, handleType, i, o, f, p, u, m, r, text, n, l, prefix, s, separator, suffix
import _cmp__Component8 from './_Component8.jsx';
import _cmp__Component12 from './_Component12.jsx';
import { id, We, Lt, Qt, e, t, Ia, a, c, X, d, _Component18 } from './shared.js';
import * as Z from 'react';
var Rl = Z.memo(({
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
    return Ia(a.find(t => {
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
  const Component1713 = `label`;
  const Component1714 = `input`;
  const Component1715 = `div`;
  const Component1716 = `label`;
  const Component1717 = `input`;
  const Component1718 = `div`;
  const Component1719 = `label`;
  const Component1720 = `input`;
  const Component1721 = `div`;
  const Component1722 = `span`;
  const Component1723 = `label`;
  const Component1724 = `textarea`;
  const Component1725 = `div`;
  const Component1726 = `div`;
  const Component1727 = `div`;
  const Component1728 = `div`;
  return <Component1728 className={`relative flex flex-col`}>
      <_cmp__Component8 id={e} data={t} defaultTitle={`文字拼接`} icon={<_Component18 size={11} className={`text-gray-500`} />} />
      <Component1727 className={`w-[260px] bg-[#1a1a1a] rounded-xl shadow-2xl border-2 transition-colors ${n ? `border-[#555]` : `border-[#333] hover:border-[#444]`}`}>
        <_cmp__Component12 type={`target`} position={X.Left} />
        <Component1726 className={`p-3 space-y-3`}>
          <Component1715 className={`space-y-1`}>
            <Component1713 className={`text-[10px] text-gray-500`}>{`前缀`}</Component1713>
            <Component1714 type={`text`} value={c} onChange={t => {
            l(t.target.value);
            r(e, {
              prefix: t.target.value
            });
          }} className={`w-full bg-[#111] border border-[#333] rounded px-2 py-1 text-xs text-gray-300 focus:outline-none focus:border-gray-500 nodrag`} placeholder={`可选`} />
          </Component1715>
          <Component1718 className={`space-y-1`}>
            <Component1716 className={`text-[10px] text-gray-500`}>{`分隔符 (输入 \\n 表示换行)`}</Component1716>
            <Component1717 type={`text`} value={o} onChange={t => {
            s(t.target.value);
            r(e, {
              separator: t.target.value
            });
          }} className={`w-full bg-[#111] border border-[#333] rounded px-2 py-1 text-xs text-gray-300 focus:outline-none focus:border-gray-500 nodrag`} />
          </Component1718>
          <Component1721 className={`space-y-1`}>
            <Component1719 className={`text-[10px] text-gray-500`}>{`后缀`}</Component1719>
            <Component1720 type={`text`} value={u} onChange={t => {
            d(t.target.value);
            r(e, {
              suffix: t.target.value
            });
          }} className={`w-full bg-[#111] border border-[#333] rounded px-2 py-1 text-xs text-gray-300 focus:outline-none focus:border-gray-500 nodrag`} placeholder={`可选`} />
          </Component1721>
          <Component1725 className={`space-y-1 pt-2 border-t border-[#333]`}>
            <Component1723 className={`text-[10px] text-gray-500 flex justify-between`}>
              <Component1722>
                {`拼接结果 (`}
                {f.length}
                {` 个输入)`}
              </Component1722>
            </Component1723>
            <Component1724 readOnly={true} value={m} className={`w-full bg-[#111] border border-[#333] rounded px-2 py-1 text-xs text-gray-300 h-[60px] resize-y custom-scrollbar`} placeholder={`等待连入文本...`} />
          </Component1725>
        </Component1726>
        <_cmp__Component12 type={`source`} position={X.Right} id={`text`} />
      </Component1727>
    </Component1728>;
});
export default Rl;