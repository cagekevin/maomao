// TODO(全局, 无需 import): data, selected, updateNodeData, handleType, i, o, s, r, inputUrl, l, method, localPort, n, imageUrl, f, lastFetchedUrl, u
import _cmp_Ti from './Ti.jsx';
import _cmp__Component10 from './_Component10.jsx';
import { id, We, Qt, Lt, e, fu, d, su, a, X, c, _Component56, _Component22, _Component16, _Component2 } from './shared.js';
import * as _shared from './shared.js';
import * as Z from 'react';
var pu = Z.memo(({
  id: e,
  data: t,
  selected: n
}) => {
  let {
    updateNodeData: r
  } = We();
  let i = Qt(Lt({
    handleType: `target`
  }).map(e => {
    return e.source;
  }));
  let a = fu();
  let [o, s] = Z.useState(t.inputUrl || ``);
  let [c, l] = Z.useState(false);
  let [u, d] = Z.useState(null);
  Z.useEffect(() => {
    let t = ``;
    for (let e of i) {
      if (e?.data?.text && typeof e.data.text == `string` && e.data.text.startsWith(`http`)) {
        t = e.data.text;
        break;
      }
    }
    if (t && t !== o) {
      s(t);
      r(e, {
        inputUrl: t
      });
    }
  }, [i, e, r, o]);
  let f = async () => {
    if (o) {
      l(true);
      d(null);
      try {
        let n = await su(o, {
          method: `GET`,
          localPort: a.status.isConnected ? a.status.port : undefined
        });
        if (!n.ok) {
          throw Error(`HTTP ${n.status}`);
        }
        let i = await n.blob();
        r(e, {
          imageUrl: await new Promise((e, t) => {
            let n = new FileReader();
            n.onload = () => {
              return e(n.result);
            };
            n.onerror = t;
            n.readAsDataURL(i);
          })
        });
        t.onShowToast?.(`图片转换成功`);
      } catch (t) {
        console.error(t);
        d(t.message || `转换失败`);
        r(e, {
          imageUrl: null
        });
      } finally {
        l(false);
      }
    }
  };
  Z.useEffect(() => {
    if (o && o !== t.lastFetchedUrl) {
      f().then(() => {
        r(e, {
          lastFetchedUrl: o
        });
      });
    }
  }, [o, t.lastFetchedUrl]);
  const Component1751 = `input`;
  const Component1752 = `button`;
  const Component1753 = `div`;
  const Component1754 = `span`;
  const Component1755 = `div`;
  const Component1756 = `div`;
  const Component1757 = `img`;
  const Component1758 = `span`;
  const Component1759 = `div`;
  const Component1760 = `div`;
  const Component1761 = `div`;
  const Component1762 = `div`;
  const Component1763 = `div`;
  return <Component1763 className={`relative flex flex-col`}>
      <_cmp_Ti id={e} data={t} defaultTitle={`网址转图片`} icon={<_Component56 size={11} className={`text-gray-500`} />} />
      <Component1762 className={`w-[260px] bg-[#1a1a1a] rounded-xl shadow-2xl border-2 transition-colors ${n ? `border-[#555]` : `border-[#333] hover:border-[#444]`}`}>
        <_cmp__Component10 type={`target`} position={X.Left} />
        <Component1761 className={`p-3 space-y-3`}>
          <Component1753 className={`flex gap-2`}>
            <Component1751 type={`text`} value={o} onChange={t => {
            s(t.target.value);
            r(e, {
              inputUrl: t.target.value
            });
          }} className={`flex-1 bg-[#111] border border-[#333] rounded px-2 py-1 text-xs text-gray-300 focus:outline-none focus:border-gray-500 nodrag`} placeholder={`输入图片 URL (或连线传入)`} />
            <Component1752 onClick={f} disabled={c || !o} className={`px-2 py-1 bg-[#333] hover:bg-[#444] rounded text-gray-300 disabled:opacity-50 transition-colors`} title={`重新获取`}>
              <_Component22 size={14} className={c ? `animate-spin` : ``} />
            </Component1752>
          </Component1753>
          {u && <Component1755 className={`flex items-center gap-1 text-red-400 text-[10px]`}>
              <_Component16 size={12} />
              <Component1754>{u}</Component1754>
            </Component1755>}
          <Component1760 className={`border border-[#333] rounded-lg overflow-hidden bg-[#111] relative aspect-video flex items-center justify-center`}>
            {c ? <Component1756 className={`text-xs text-gray-500 flex items-center gap-2`}>
                <_Component22 size={14} className={`animate-spin`} />
                {`转换中...`}
              </Component1756> : t.imageUrl ? <Component1757 src={t.imageUrl} loading={`lazy`} decoding={`async`} className={`w-full h-full object-contain cursor-pointer`} onDoubleClick={e => {
            e.stopPropagation();
            if (t.onZoom) {
              t.onZoom(t.imageUrl);
            }
          }} /> : <Component1759 className={`text-[10px] text-gray-600 flex flex-col items-center gap-1`}>
                <_Component2 size={20} className={`opacity-50`} />
                <Component1758>{`等待图片 URL`}</Component1758>
              </Component1759>}
          </Component1760>
        </Component1761>
        <_cmp__Component10 type={`source`} position={X.Right} id={`image`} />
      </Component1762>
    </Component1763>;
});
export default pu;