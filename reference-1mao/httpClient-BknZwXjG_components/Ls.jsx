// TODO(全局, 无需 import): data, selected, updateNodeData, handleType, o, s, i, n, u, m, f, r, signal, audioUrl, audioName, decodeURIComponent, v, width, height, minWidth, minHeight, b, l, p, g
import _cmp__Component8 from './_Component8.jsx';
import _cmp__Component12 from './_Component12.jsx';
import _cmp_Is from './Is.jsx';
import _cmp__Component9 from './_Component9.jsx';
import { id, We, t, Qt, Lt, Ns, h, c, a, y, _, X, d, _Component5, _Component6, Gt, _Component0 } from './shared.js';
import * as _shared from './shared.js';
import * as Z from 'react';
var Ls = Z.memo(({
  id: e,
  data: t,
  selected: n
}) => {
  let {
    updateNodeData: r
  } = We();
  let i = t;
  let a = Z.useRef(null);
  let o = Qt(Lt({
    handleType: `target`
  }).map(e => {
    return e.source;
  }));
  let s = (() => {
    let e = Array.isArray(o) ? o : o ? [o] : [];
    for (let t of e) {
      let e = Ns(t?.data);
      if (e) {
        return e;
      }
    }
    return ``;
  })();
  let c = s || i.audioUrl || ``;
  let [l, u] = Z.useState(``);
  let [d, f] = Z.useState(false);
  let [p, m] = Z.useState(``);
  let h = Z.useRef(``);
  Z.useEffect(() => {
    let e = false;
    let t = new AbortController();
    let n = () => {
      if (h.current) {
        try {
          URL.revokeObjectURL(h.current);
        } catch {}
        h.current = ``;
      }
    };
    if (!c) {
      n();
      u(``);
      m(``);
      f(false);
      return;
    }
    if (c.startsWith(`data:`) || c.startsWith(`blob:`)) {
      n();
      u(c);
      m(``);
      f(false);
      return;
    }
    f(true);
    m(``);
    (async () => {
      try {
        let r = c.trim().replace(/^`+|`+$/g, ``);
        let i = await fetch(r, {
          signal: t.signal
        });
        if (!i.ok) {
          throw Error(`下载失败 HTTP ${i.status}`);
        }
        let a = await i.blob();
        if (e) {
          return;
        }
        n();
        let o = URL.createObjectURL(a);
        h.current = o;
        u(o);
        f(false);
      } catch (t) {
        if (e || t?.name === `AbortError`) {
          return;
        }
        u(c);
        m(t?.message || `加载失败，尝试直接播放`);
        f(false);
      }
    })();
    return () => {
      e = true;
      t.abort();
    };
  }, [c]);
  Z.useEffect(() => {
    return () => {
      if (h.current) {
        try {
          URL.revokeObjectURL(h.current);
        } catch {}
      }
    };
  }, []);
  let g = Z.useCallback(t => {
    r(e, {
      audioUrl: URL.createObjectURL(t),
      audioName: t.name
    });
  }, [e, r]);
  let _ = Z.useCallback(() => {
    r(e, {
      audioUrl: undefined,
      audioName: undefined
    });
  }, [e, r]);
  let v = i.audioName || (c ? decodeURIComponent(c.split(`/`).pop()?.split(`?`)[0] || `音频`) : ``);
  let y = !!c;
  let b = Z.useCallback(async e => {
    e.stopPropagation();
    if (c) {
      try {
        let e = document.createElement(`a`);
        if (c.startsWith(`blob:`) || c.startsWith(`data:`)) {
          e.href = c;
        } else {
          let t = await (await fetch(c.trim().replace(/^`+|`+$/g, ``))).blob();
          e.href = URL.createObjectURL(t);
        }
        e.download = v || `audio`;
        document.body.appendChild(e);
        e.click();
        e.remove();
        if (e.href.startsWith(`blob:`) && !c.startsWith(`blob:`)) {
          setTimeout(() => {
            return URL.revokeObjectURL(e.href);
          }, 4000);
        }
      } catch {}
    }
  }, [c, v]);
  const Component1118 = `button`;
  const Component1119 = `button`;
  const Component1120 = `div`;
  const Component1121 = `div`;
  const Component1122 = `span`;
  const Component1123 = `span`;
  const Component1124 = `div`;
  const Component1125 = `div`;
  const Component1126 = `input`;
  const Component1127 = `div`;
  const Component1128 = `div`;
  return <Component1128 className={`relative flex flex-col items-center group/node transition-all ${n ? `z-50` : `z-10`}`} style={{
    width: `100%`,
    height: `100%`,
    minWidth: 320,
    minHeight: 200
  }}>
      <_cmp__Component8 id={e} data={t} defaultTitle={`音频`} icon={<_Component5 size={11} className={`text-gray-500`} />} />
      {y && <Component1121 className={`absolute -top-12 left-1/2 -translate-x-1/2 z-30 opacity-0 group-hover/node:opacity-100 transition-opacity pointer-events-none group-hover/node:pointer-events-auto nodrag pb-4`}>
          <Component1120 className={`flex items-center gap-1 px-3 py-2 bg-[#1c1c1c]/90 backdrop-blur-md border border-[#333] rounded-full shadow-lg`}>
            <Component1118 className={`p-1.5 text-gray-400 hover:text-white hover:bg-[#333] rounded-md`} title={`下载音频`} onClick={b}>
              <_Component6 size={14} />
            </Component1118>
            {!s && <Component1119 className={`p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-500/10 rounded-md`} title={`清除`} onClick={e => {
          e.stopPropagation();
          _();
        }}>
                <Gt size={14} />
              </Component1119>}
          </Component1120>
        </Component1121>}
      <Component1127 className={`relative bg-[#1c1c1c] rounded-xl border shadow-xl transition-all duration-300 flex flex-col w-full h-full ${n ? `border-[#555]` : `border-[#333] hover:border-[#444]`}`}>
        <_cmp__Component12 type={`target`} position={X.Left} variant={`small`} />
        <_cmp__Component12 type={`source`} position={X.Right} variant={`small`} />
        <Component1125 className={`flex-1 flex flex-col rounded-xl overflow-hidden min-h-0`}>
          {y ? <_cmp_Is playUrl={l} loading={d} error={p} /> : <Component1124 className={`flex-1 flex flex-col items-center justify-center gap-2 text-gray-500 hover:text-blue-400 cursor-pointer bg-[#151515] transition-colors nodrag`} onClick={e => {
          e.stopPropagation();
          a.current?.click();
        }}>
              <_Component0 size={26} />
              <Component1122 className={`text-[12px]`}>{`点击上传音频`}</Component1122>
              <Component1123 className={`text-[10px] text-gray-600`}>{`或从左侧连线接入`}</Component1123>
            </Component1124>}
        </Component1125>
        <Component1126 ref={a} type={`file`} accept={`audio/*,.flac,.aac,.opus,.m4a,.wma,.aiff`} className={`hidden`} onChange={e => {
        let t = e.target.files?.[0];
        if (t) {
          g(t);
        }
        e.currentTarget.value = ``;
      }} />
        <_cmp__Component9 minWidth={320} minHeight={200} />
      </Component1127>
    </Component1128>;
});
export default Ls;