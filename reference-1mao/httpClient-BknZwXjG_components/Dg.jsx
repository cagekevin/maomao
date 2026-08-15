// TODO(全局, 无需 import): data, selected, updateNodeData, i, handleType, l, n, o, s, url, label, r, directorProject, syncedCaptureIds, imageUrl, subfolder, preferThumbnail, thumbMaxDim, thumbQuality, thumbnailUrl, u
import _cmp__Component9 from './_Component9.jsx';
import _cmp__Component8 from './_Component8.jsx';
import _cmp__Component12 from './_Component12.jsx';
import _cmp_Eg from './Eg.jsx';
import { id, We, t, Lt, Qt, c, e, a, hi, X, Fn, d, _Component29, _Component49, Ke } from './shared.js';
import * as Z from 'react';
var Dg = Z.memo(({
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
        let n = await hi(t.thumbnailDataUrl, {
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
  const Component2226 = `img`;
  const Component2227 = `span`;
  const Component2228 = `div`;
  const Component2229 = `button`;
  const Component2230 = `div`;
  const Component2231 = `div`;
  const Component2232 = `div`;
  return <Component2232 className={`relative w-full h-full flex flex-col group/node`}>
      <_cmp__Component9 visible={!!n} minWidth={220} minHeight={200} />
      <_cmp__Component8 id={e} data={t} defaultTitle={`3D 导演台`} icon={<_Component29 size={11} className={`text-gray-500`} />} />
      <Component2231 className={`relative flex-1 bg-[#151515] rounded-xl overflow-hidden border border-[#333] shadow-xl cursor-pointer`} onClick={() => {
      return o(true);
    }}>
        {s ? <Component2226 src={s} className={`w-full h-full object-cover`} alt={`导演台预览`} /> : <Component2228 className={`flex flex-col items-center justify-center absolute inset-0 gap-2 text-gray-600 pointer-events-none`}>
            <_Component49 size={56} strokeWidth={1.2} />
            <Component2227 className={`text-xs text-gray-500`}>{`点击打开 3D 导演台`}</Component2227>
          </Component2228>}
        <Component2230 className={`absolute inset-0 bg-black/0 group-hover/node:bg-black/30 transition-colors flex items-center justify-center opacity-0 group-hover/node:opacity-100`}>
          <Component2229 className={`flex items-center gap-1.5 px-3 py-2 bg-white/90 hover:bg-white text-black text-xs font-medium rounded-full shadow-lg transition-colors`} onClick={e => {
          e.stopPropagation();
          o(true);
        }}>
            <Ke size={13} />
            {`打开导演台`}
          </Component2229>
        </Component2230>
      </Component2231>
      <_cmp__Component12 type={`target`} position={X.Left} variant={`large`} />
      <_cmp__Component12 type={`source`} position={X.Right} variant={`large`} />
      {a && Fn.createPortal(<_cmp_Eg initialProject={i.directorProject ?? null} initialPanoramaUrl={u} onExit={d} />, document.body)}
    </Component2232>;
});
export default Dg;