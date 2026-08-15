// TODO(全局, 无需 import): category, presetPrompts, onApply, onToast, f, i, l, u, n, p, m, s, o, r
import _cmp__Component16 from './_Component16.jsx';
import { t, e, d, c, eo, a, h, ao, _Component14 } from './shared.js';
import * as Z from 'react';
import * as Q from 'react';
export default function _Component21({
  category: e,
  presetPrompts: t,
  onApply: n,
  onToast: r
}) {
  let [i, a] = Z.useState(false);
  let [o, s] = Z.useState(false);
  let [c, l] = Z.useState([]);
  let u = Z.useRef(null);
  let d = t.filter(e => {
    return e.enabled !== false;
  });
  let f = t => {
    return t.type === e || t.type === `all` || !t.type;
  };
  let p = [...d.filter(f), ...d.filter(e => {
    return !f(e);
  })];
  let m = [...c.filter(t => {
    return t.category === e;
  }), ...c.filter(t => {
    return t.category !== e;
  })];
  Z.useEffect(() => {
    if (i) {
      eo().then(l).catch(() => {});
    }
  }, [i]);
  Z.useEffect(() => {
    if (!i) {
      return;
    }
    let e = e => {
      if (u.current && !u.current.contains(e.target)) {
        a(false);
      }
    };
    document.addEventListener(`mousedown`, e, true);
    return () => {
      return document.removeEventListener(`mousedown`, e, true);
    };
  }, [i]);
  let h = e => {
    n(e);
    a(false);
  };
  const Component220 = `div`;
  const Component221 = `span`;
  const Component222 = `button`;
  const Component223 = `div`;
  const Component224 = `div`;
  const Component225 = `span`;
  const Component226 = `button`;
  const Component227 = `button`;
  const Component228 = `div`;
  const Component229 = `button`;
  const Component230 = `button`;
  const Component231 = `div`;
  const Component232 = `div`;
  const Component233 = `div`;
  return <Component233 className={`relative nodrag flex items-center`} ref={u}>
      <Component220 className={`w-[1px] h-3 bg-[#444] flex-shrink-0 mr-1.5`} />
      <Component222 className={`flex items-center gap-1 h-6 px-2 bg-transparent hover:bg-[#2a2a2a] border border-transparent hover:border-[#333] rounded text-[11px] text-gray-300 transition-colors cursor-pointer max-w-[80px]`} onClick={e => {
      e.stopPropagation();
      a(e => {
        return !e;
      });
    }}>
        <Component221 className={`truncate`}>{`提示词`}</Component221>
      </Component222>
      {i && <Component232 className={`absolute bottom-full left-0 mb-1 w-56 bg-[#222] border border-[#333] rounded-lg shadow-xl z-50 flex flex-col max-h-72 overflow-hidden nowheel nopan nodrag`} onClick={e => {
      return e.stopPropagation();
    }}>
          <Component223 className={`shrink-0 px-3 pt-2 pb-1.5 text-[10px] text-gray-500`}>{`提示词`}</Component223>
          <Component228 className={`flex-1 overflow-y-auto custom-scrollbar px-2`}>
            {p.length === 0 && m.length === 0 ? <Component224 className={`px-2 py-1.5 text-[11px] text-gray-600`}>{`暂无提示词`}</Component224> : <Q.Fragment>
                {m.map(e => {
            return <Component226 className={`w-full flex items-center gap-1.5 mb-1 text-left px-2 py-1.5 text-[11px] rounded-md transition-colors truncate text-gray-400 hover:bg-[#2a2a2a] hover:text-gray-200`} onClick={() => {
              return h(e.content);
            }} title={e.title} key={`fav-${e.id}`}>
                      <Component225 className={`truncate`}>{e.title}</Component225>
                      <_Component14 size={12} className={`shrink-0 text-white`} />
                    </Component226>;
          })}
                {p.map((e, t) => {
            return <Component227 className={`w-full block mb-1 text-left px-2 py-1.5 text-[11px] rounded-md transition-colors truncate text-gray-400 hover:bg-[#2a2a2a] hover:text-gray-200`} onClick={() => {
              return h(e.prompt);
            }} title={e.title} key={`local-${t}`}>
                      {e.title}
                    </Component227>;
          })}
              </Q.Fragment>}
          </Component228>
          <Component231 className={`shrink-0 flex items-center justify-between gap-2 px-2 py-1.5 border-t border-[#333]`}>
            <Component229 className={`text-[10px] text-gray-400 hover:text-gray-200 transition-colors`} onClick={() => {
          ao();
          a(false);
        }}>{`本地配置`}</Component229>
            <Component230 className={`flex items-center gap-1 text-[10px] text-blue-400 hover:text-blue-300 transition-colors`} onClick={() => {
          s(true);
          a(false);
        }}>
              <_Component14 size={11} />
              {`提示词库`}
            </Component230>
          </Component231>
        </Component232>}
      <_cmp__Component16 open={o} onClose={() => {
      return s(false);
    }} onUse={e => {
      return n(e.content);
    }} onToast={r} defaultCategory={e} />
    </Component233>;
}