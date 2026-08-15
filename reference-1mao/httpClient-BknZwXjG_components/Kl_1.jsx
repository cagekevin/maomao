// TODO(全局, 无需 import): data, selected, updateNodeData, handleType, i, o, s, r, inputUrl, l, method, localPort, n, imageUrl, f, lastFetchedUrl, u
import _cmp__Component8 from './_Component8.jsx';
import _cmp__Component12 from './_Component12.jsx';
import { id, We, Qt, Lt, e, Gl, d, Bl, a, X, c, _Component58, _Component25, _Component17, _Component2 } from './shared.js';
import * as _shared from './shared.js';
import * as Z from 'react';
var Kl = Z.memo(({
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
  let a = Gl();
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
        let n = await Bl(o, {
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
  const Component1729 = `input`;
  const Component1730 = `button`;
  const Component1731 = `div`;
  const Component1732 = `span`;
  const Component1733 = `div`;
  const Component1734 = `div`;
  const Component1735 = `img`;
  const Component1736 = `span`;
  const Component1737 = `div`;
  const Component1738 = `div`;
  const Component1739 = `div`;
  const Component1740 = `div`;
  const Component1741 = `div`;
  return <Component1741 className={`relative flex flex-col`}>
      <_cmp__Component8 id={e} data={t} defaultTitle={`网址转图片`} icon={<_Component58 size={11} className={`text-gray-500`} />} />
      <Component1740 className={`w-[260px] bg-[#1a1a1a] rounded-xl shadow-2xl border-2 transition-colors ${n ? `border-[#555]` : `border-[#333] hover:border-[#444]`}`}>
        <_cmp__Component12 type={`target`} position={X.Left} />
        <Component1739 className={`p-3 space-y-3`}>
          <Component1731 className={`flex gap-2`}>
            <Component1729 type={`text`} value={o} onChange={t => {
            s(t.target.value);
            r(e, {
              inputUrl: t.target.value
            });
          }} className={`flex-1 bg-[#111] border border-[#333] rounded px-2 py-1 text-xs text-gray-300 focus:outline-none focus:border-gray-500 nodrag`} placeholder={`输入图片 URL (或连线传入)`} />
            <Component1730 onClick={f} disabled={c || !o} className={`px-2 py-1 bg-[#333] hover:bg-[#444] rounded text-gray-300 disabled:opacity-50 transition-colors`} title={`重新获取`}>
              <_Component25 size={14} className={c ? `animate-spin` : ``} />
            </Component1730>
          </Component1731>
          {u && <Component1733 className={`flex items-center gap-1 text-red-400 text-[10px]`}>
              <_Component17 size={12} />
              <Component1732>{u}</Component1732>
            </Component1733>}
          <Component1738 className={`border border-[#333] rounded-lg overflow-hidden bg-[#111] relative aspect-video flex items-center justify-center`}>
            {c ? <Component1734 className={`text-xs text-gray-500 flex items-center gap-2`}>
                <_Component25 size={14} className={`animate-spin`} />
                {`转换中...`}
              </Component1734> : t.imageUrl ? <Component1735 src={t.imageUrl} loading={`lazy`} decoding={`async`} className={`w-full h-full object-contain cursor-pointer`} onDoubleClick={e => {
            e.stopPropagation();
            if (t.onZoom) {
              t.onZoom(t.imageUrl);
            }
          }} /> : <Component1737 className={`text-[10px] text-gray-600 flex flex-col items-center gap-1`}>
                <_Component2 size={20} className={`opacity-50`} />
                <Component1736>{`等待图片 URL`}</Component1736>
              </Component1737>}
          </Component1738>
        </Component1739>
        <_cmp__Component12 type={`source`} position={X.Right} id={`image`} />
      </Component1740>
    </Component1741>;
});
export default Kl;