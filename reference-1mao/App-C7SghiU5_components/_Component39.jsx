// TODO(全局, 无需 import): app, onBack, canvasProps, i, o, b, encodeURIComponent, n, t, c, d, p, v, nodes, edges, m, nodeId, path, value, detail, targetProjectId, injections, s, l, f, w, x, y
import { e, ut, r, a, g, B, Pe, C, _, Ct, S, T, me, _Component12, _Component4, N, Je } from './shared.js';
import * as G from 'react';
export default function _Component39({
  app: e,
  onBack: t,
  canvasProps: n
}) {
  let [r, i] = G.useState(true);
  let [a, o] = G.useState(``);
  let [s, c] = G.useState(e.appName || `应用`);
  let [l, d] = G.useState(``);
  let [f, p] = G.useState([]);
  let [m, g] = G.useState([]);
  let [_, v] = G.useState({});
  let [y, b] = G.useState(false);
  let [x, S] = G.useState(false);
  let C = G.useMemo(() => {
    return `__apprun_${e.appId}`;
  }, [e.appId]);
  G.useEffect(() => {
    let t = false;
    (async () => {
      i(true);
      o(``);
      b(false);
      try {
        let n = await ut(`/workflow-apps/${encodeURIComponent(e.appId)}`);
        if (!n.success) {
          throw Error(n.error || `加载失败`);
        }
        let r = n.data;
        let i = r?.data ?? r;
        if (!i) {
          throw Error(r?.error || n.error || `加载失败`);
        }
        if (t) {
          return;
        }
        if (!i.access?.canRun) {
          throw Error(`该应用需要许可证或权限后才能运行`);
        }
        c(i.appName || e.appName || `应用`);
        d(i.description || ``);
        let a = i.inputSchema?.fields || [];
        p(a);
        g(i.mappingSchema?.fields || []);
        v(Object.fromEntries(a.map(e => {
          return [e.id, e.defaultValue ?? ``];
        })));
        let o = i.workflowSnapshot || {
          nodes: [],
          edges: []
        };
        await B.setObject(Pe(C), o);
        if (t) {
          return;
        }
        b(true);
      } catch (e) {
        if (!t) {
          o(e?.message || `加载失败`);
        }
      } finally {
        if (!t) {
          i(false);
        }
      }
    })();
    return () => {
      t = true;
      B.remove(Pe(C)).catch(() => {});
    };
  }, [e.appId, e.appName, C]);
  let w = G.useCallback(() => {
    let e = m.map(e => {
      return {
        nodeId: e.nodeId,
        path: e.path,
        value: _[e.id]
      };
    }).filter(e => {
      return e.nodeId && e.value !== undefined && e.value !== ``;
    });
    window.dispatchEvent(new CustomEvent(Ct, {
      detail: {
        targetProjectId: C,
        injections: e
      }
    }));
    S(true);
    window.setTimeout(() => {
      return S(false);
    }, 1500);
  }, [m, _, C]);
  let T = (e, t) => {
    return v(n => {
      return {
        ...n,
        [e]: t
      };
    });
  };
  const Component187 = `button`;
  const Component188 = `div`;
  const Component189 = `div`;
  const Component190 = `div`;
  const Component191 = `div`;
  const Component192 = `div`;
  const Component193 = `div`;
  const Component194 = `div`;
  const Component195 = `div`;
  const Component196 = `span`;
  const Component197 = `span`;
  const Component198 = `span`;
  const Component199 = `label`;
  const Component200 = `textarea`;
  const Component201 = `input`;
  const Component202 = `input`;
  const Component203 = `div`;
  const Component204 = `div`;
  const Component205 = `button`;
  const Component206 = `div`;
  const Component207 = `div`;
  const Component208 = `div`;
  const Component209 = `div`;
  const Component210 = `div`;
  return <Component210 className={`h-full flex bg-[#0d0c0c]`}>
      <Component207 className={`w-[340px] flex-shrink-0 border-r border-[#1f1f1f] flex flex-col`}>
        <Component191 className={`px-4 py-3 border-b border-[#1f1f1f] flex items-center gap-2`}>
          <Component187 onClick={t} className={`text-gray-400 hover:text-white p-1.5 rounded-lg hover:bg-white/5`}>
            <_Component12 size={16} />
          </Component187>
          <Component190 className={`min-w-0`}>
            <Component188 className={`text-white font-bold text-sm truncate`}>{s}</Component188>
            <Component189 className={`text-[11px] text-gray-500`}>{`应用运行`}</Component189>
          </Component190>
        </Component191>
        <Component204 className={`flex-1 overflow-y-auto p-4 custom-scrollbar space-y-4`}>
          {a && <Component192 className={`rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300`}>
              {a}
            </Component192>}
          {l && <Component193 className={`text-xs text-gray-400 leading-6`}>{l}</Component193>}
          {r ? <Component194 className={`h-40 flex items-center justify-center text-gray-500 text-sm`}>
              <_Component4 size={14} className={`animate-spin mr-2`} />
              {` 加载中…`}
            </Component194> : f.length === 0 ? <Component195 className={`text-xs text-gray-500`}>{`该应用未公开启动参数，可直接运行。`}</Component195> : f.map((e, t) => {
          return <Component203 className={`space-y-1.5`} key={e.id}>
                  <Component199 className={`text-xs text-gray-400 flex items-center gap-2`}>
                    <Component196>
                      {t + 1}
                      {`. `}
                      {e.label || e.key}
                    </Component196>
                    {e.required && <Component197 className={`text-red-400`}>{`*`}</Component197>}
                    <Component198 className={`ml-auto text-[10px] text-gray-600`}>
                      {e.type}
                    </Component198>
                  </Component199>
                  {e.type === `json` ? <Component200 value={_[e.id] ?? ``} onChange={t => {
              return T(e.id, t.target.value);
            }} className={`w-full rounded-lg border border-[#333] bg-[#151515] px-3 py-2 text-sm text-white outline-none focus:border-blue-500 min-h-[80px]`} placeholder={`请输入 ${e.label || e.key}`} /> : e.type === `boolean` ? <Component201 type={`checkbox`} checked={!!_[e.id]} onChange={t => {
              return T(e.id, t.target.checked);
            }} className={`h-4 w-4 accent-blue-500`} /> : <Component202 type={e.type === `number` ? `number` : `text`} value={_[e.id] ?? ``} onChange={t => {
              return T(e.id, e.type === `number` ? Number(t.target.value) : t.target.value);
            }} className={`w-full rounded-lg border border-[#333] bg-[#151515] px-3 py-2 text-sm text-white outline-none focus:border-blue-500`} placeholder={`请输入 ${e.label || e.key}`} />}
                </Component203>;
        })}
        </Component204>
        <Component206 className={`p-4 border-t border-[#1f1f1f]`}>
          <Component205 onClick={w} disabled={r || !y || x} className={`w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-500 disabled:opacity-50`}>
            {x ? <_Component4 size={15} className={`animate-spin`} /> : <N size={15} />}
            {`运行应用`}
          </Component205>
        </Component206>
      </Component207>
      <Component209 className={`flex-1 relative`}>
        {y ? <Je {...n} localToolBaseUrl={me()} projectId={C} /> : <Component208 className={`h-full flex items-center justify-center text-gray-500 text-sm`}>
            {a ? `无法加载应用画布` : `正在准备应用画布…`}
          </Component208>}
      </Component209>
    </Component210>;
}