// TODO(全局, 无需 import): data, selected, updateNodeData, i, handleType, l, n, o, s, url, label, r, directorProject, syncedCaptureIds, imageUrl, subfolder, preferThumbnail, thumbMaxDim, thumbQuality, thumbnailUrl, u
import _cmp_Ei from './Ei.jsx';
import _cmp_Ti from './Ti.jsx';
import _cmp__Component10 from './_Component10.jsx';
import _cmp__Component84 from './_Component84.jsx';
import { id, We, t, Lt, Qt, c, e, a, xi, X, Fn, d, _Component26, _Component48, Ke } from './shared.js';
import * as Z from 'react';
var Jg = Z.memo(({
  id: e,
  data: t,
  selected: n
}) => {
  let {
    updateNodeData: r
  } = We();
  let i = t;
  let [a, o] = Z.useState(false);
  let s = i.imageUrl;
  let c = Lt({
    handleType: `target`
  });
  let l = Qt(Z.useMemo(() => {
    return c.map(e => {
      return e.source;
    });
  }, [c]));
  let u = Z.useMemo(() => {
    if (!l) {
      return null;
    }
    let e = Array.isArray(l) ? l : [l];
    for (let t of e) {
      if (!t) {
        continue;
      }
      let e = t.data?.imageUrl;
      if (typeof e == `string` && (e.startsWith(`http`) || e.startsWith(`data:image`))) {
        return e;
      }
      if (t.type === `imageBoxNode` && Array.isArray(t.data?.images)) {
        let e = typeof t.data.activeIndex == `number` ? t.data.activeIndex : 0;
        let n = t.data.images[e]?.url;
        if (typeof n == `string`) {
          return n;
        }
      }
    }
    return null;
  }, [l]);
  let d = Z.useCallback(async t => {
    o(false);
    let n = [];
    let a = [];
    let s = new Set(i.syncedCaptureIds || []);
    t.project.cameras.forEach(e => {
      if (e.captures) {
        e.captures.forEach(t => {
          a.push(t.id);
          if (!s.has(t.id)) {
            n.push({
              url: t.dataUrl,
              label: e.name || `机位截图`
            });
          }
        });
      }
    });
    if (n.length > 0) {
      i.onCaptureToBox?.(e, n);
    }
    r(e, {
      directorProject: t.project,
      syncedCaptureIds: a
    });
    if (t.thumbnailDataUrl) {
      r(e, {
        imageUrl: t.thumbnailDataUrl
      });
      try {
        let n = await xi(t.thumbnailDataUrl, {
          subfolder: `tasks`,
          preferThumbnail: true,
          thumbMaxDim: 480,
          thumbQuality: 75
        });
        if (n.url && /^https?:\/\//i.test(n.url)) {
          r(e, {
            imageUrl: n.url,
            thumbnailUrl: n.thumbnailUrl
          });
        }
      } catch (e) {
        console.warn(`[Director3DNode] 缩略图 URL 化失败，保留 base64`, e);
      }
    }
  }, [e, r, i]);
  const Component2248 = `img`;
  const Component2249 = `span`;
  const Component2250 = `div`;
  const Component2251 = `button`;
  const Component2252 = `div`;
  const Component2253 = `div`;
  const Component2254 = `div`;
  return <Component2254 className={`relative w-full h-full flex flex-col group/node`}>
      <_cmp_Ei visible={!!n} minWidth={220} minHeight={200} />
      <_cmp_Ti id={e} data={t} defaultTitle={`3D 导演台`} icon={<_Component26 size={11} className={`text-gray-500`} />} />
      <Component2253 className={`relative flex-1 bg-[#151515] rounded-xl overflow-hidden border border-[#333] shadow-xl cursor-pointer`} onClick={() => {
      return o(true);
    }}>
        {s ? <Component2248 src={s} className={`w-full h-full object-cover`} alt={`导演台预览`} /> : <Component2250 className={`flex flex-col items-center justify-center absolute inset-0 gap-2 text-gray-600 pointer-events-none`}>
            <_Component48 size={56} strokeWidth={1.2} />
            <Component2249 className={`text-xs text-gray-500`}>{`点击打开 3D 导演台`}</Component2249>
          </Component2250>}
        <Component2252 className={`absolute inset-0 bg-black/0 group-hover/node:bg-black/30 transition-colors flex items-center justify-center opacity-0 group-hover/node:opacity-100`}>
          <Component2251 className={`flex items-center gap-1.5 px-3 py-2 bg-white/90 hover:bg-white text-black text-xs font-medium rounded-full shadow-lg transition-colors`} onClick={e => {
          e.stopPropagation();
          o(true);
        }}>
            <Ke size={13} />
            {`打开导演台`}
          </Component2251>
        </Component2252>
      </Component2253>
      <_cmp__Component10 type={`target`} position={X.Left} variant={`large`} />
      <_cmp__Component10 type={`source`} position={X.Right} variant={`large`} />
      {a && Fn.createPortal(<_cmp__Component84 initialProject={i.directorProject ?? null} initialPanoramaUrl={u} onExit={d} />, document.body)}
    </Component2254>;
});
export default Jg;