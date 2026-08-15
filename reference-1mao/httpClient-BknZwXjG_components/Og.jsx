// TODO(全局, 无需 import): data, selected, updateNodeData, setNodes, l, o, r, name, s, f, i, n, collapsed, expandedWidth, expandedHeight, style, width, height, backgroundColor, border, u, m, p
import { id, We, t, a, c, e, X, d, Kt, _Component63, _Component110, _Component36 } from './shared.js';
import * as Z from 'react';
export default function Og({
  id: e,
  data: t,
  selected: n
}) {
  let {
    updateNodeData: r,
    setNodes: i
  } = We();
  let [a, o] = Z.useState(false);
  let [s, c] = Z.useState(t?.name || `编组`);
  let l = Z.useRef(null);
  let u = t?.collapsed || false;
  Z.useEffect(() => {
    if (a && l.current) {
      l.current.focus();
      l.current.select();
    }
  }, [a]);
  let d = e => {
    c(e.target.value);
  };
  let f = () => {
    o(false);
    r(e, {
      name: s
    });
  };
  let p = e => {
    if (e.key === `Enter`) {
      f();
    }
  };
  let m = t => {
    t.stopPropagation();
    let n = !u;
    i(t => {
      return t.map(t => {
        if (t.id === e) {
          if (n) {
            let e = t.style?.width || t.measured?.width || 300;
            let n = t.style?.height || t.measured?.height || 200;
            return {
              ...t,
              data: {
                ...t.data,
                collapsed: true,
                expandedWidth: e,
                expandedHeight: n
              },
              style: {
                ...t.style,
                width: `max-content`,
                height: 40,
                backgroundColor: `transparent`,
                border: `none`
              }
            };
          } else {
            return {
              ...t,
              data: {
                ...t.data,
                collapsed: false
              },
              style: {
                ...t.style,
                width: t.data?.expandedWidth || 300,
                height: t.data?.expandedHeight || 200,
                backgroundColor: undefined,
                border: undefined
              }
            };
          }
        }
        return t;
      });
    });
  };
  if (u) {
    const Component2233 = `span`;
    const Component2234 = `div`;
    return <Component2234 className={`relative flex items-center justify-center bg-[#2a1f24] border border-dashed ${n ? `border-[#555]` : `border-[#444]`} rounded-xl px-4 py-2 shadow-lg min-w-[120px] h-[40px] cursor-pointer hover:bg-[#352a30] hover:border-gray-400 transition-all duration-300`} onClick={m}>
        <Kt type={`target`} position={X.Left} className={`!w-2 !h-2 !bg-gray-500 !border-gray-600 !opacity-0`} />
        <_Component63 className={`w-4 h-4 text-gray-400 mr-1`} />
        <_Component110 className={`w-4 h-4 text-[#8b92a5] mr-2`} />
        <Component2233 className={`text-gray-300 text-sm select-none`}>{s}</Component2233>
        <Kt type={`source`} position={X.Right} className={`!w-2 !h-2 !bg-gray-500 !border-gray-600 !opacity-0`} />
      </Component2234>;
  } else {
    const Component2235 = `button`;
    const Component2236 = `input`;
    const Component2237 = `span`;
    const Component2238 = `div`;
    const Component2239 = `div`;
    return <Component2239 className={`relative w-full h-full rounded-xl transition-all duration-300 ${n ? `border border-[#555]` : `border border-transparent hover:border-white/10`} bg-[#1e171b]/50 hover:bg-[#161214] group`}>
        <Component2238 className={`absolute -top-8 left-0 flex items-center px-2 py-1`} onDoubleClick={() => {
        return o(true);
      }}>
          <Component2235 onClick={m} className={`mr-1 hover:bg-white/10 rounded p-0.5 transition-colors`}>
            <_Component36 className={`w-4 h-4 text-gray-500 group-hover:text-gray-300`} />
          </Component2235>
          <_Component110 className={`w-4 h-4 text-[#8b92a5] mr-1.5`} />
          {a ? <Component2236 ref={l} type={`text`} value={s} onChange={d} onBlur={f} onKeyDown={p} className={`bg-[#2a2a2a] border border-[#444] rounded outline-none text-gray-200 text-sm w-32 focus:border-blue-500 px-1 py-0.5`} /> : <Component2237 className={`text-gray-400 group-hover:text-gray-300 text-sm select-none cursor-text transition-colors`}>
              {s}
            </Component2237>}
        </Component2238>
      </Component2239>;
  }
}