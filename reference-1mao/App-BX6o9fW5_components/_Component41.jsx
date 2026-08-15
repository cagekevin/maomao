// TODO(全局, 无需 import): app, onBack, canvasProps, i, o, b, encodeURIComponent, n, t, c, d, p, v, nodes, edges, m, nodeId, path, value, detail, targetProjectId, injections, s, l, f, w, x, y
import { e, ut, r, a, g, z, He, C, _, V, S, T, ge, _Component12, _Component3, _Component0, Ye } from './shared.js';
import * as W from 'react';
export default function _Component41({
  app: e,
  onBack: t,
  canvasProps: n
}) {
  let [r, i] = W.useState(true);
  let [a, o] = W.useState(``);
  let [s, c] = W.useState(e.appName || `应用`);
  let [l, d] = W.useState(``);
  let [f, p] = W.useState([]);
  let [m, g] = W.useState([]);
  let [_, v] = W.useState({});
  let [y, b] = W.useState(false);
  let [x, S] = W.useState(false);
  let C = W.useMemo(() => {
    return `__apprun_${e.appId}`;
  }, [e.appId]);
  W.useEffect(() => {
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
        await z.setObject(He(C), o);
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
      z.remove(He(C)).catch(() => {});
    };
  }, [e.appId, e.appName, C]);
  let w = W.useCallback(() => {
    let e = m.map(e => {
      return {
        nodeId: e.nodeId,
        path: e.path,
        value: _[e.id]
      };
    }).filter(e => {
      return e.nodeId && e.value !== undefined && e.value !== ``;
    });
    window.dispatchEvent(new CustomEvent(V, {
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
  const Component185 = `button`;
  const Component186 = `div`;
  const Component187 = `div`;
  const Component188 = `div`;
  const Component189 = `div`;
  const Component190 = `div`;
  const Component191 = `div`;
  const Component192 = `div`;
  const Component193 = `div`;
  const Component194 = `span`;
  const Component195 = `span`;
  const Component196 = `span`;
  const Component197 = `label`;
  const Component198 = `textarea`;
  const Component199 = `input`;
  const Component200 = `input`;
  const Component201 = `div`;
  const Component202 = `div`;
  const Component203 = `button`;
  const Component204 = `div`;
  const Component205 = `div`;
  const Component206 = `div`;
  const Component207 = `div`;
  const Component208 = `div`;
  return <Component208 className={`h-full flex bg-[#0d0c0c]`}>
      <Component205 className={`w-[340px] flex-shrink-0 border-r border-[#1f1f1f] flex flex-col`}>
        <Component189 className={`px-4 py-3 border-b border-[#1f1f1f] flex items-center gap-2`}>
          <Component185 onClick={t} className={`text-gray-400 hover:text-white p-1.5 rounded-lg hover:bg-white/5`}>
            <_Component12 size={16} />
          </Component185>
          <Component188 className={`min-w-0`}>
            <Component186 className={`text-white font-bold text-sm truncate`}>{s}</Component186>
            <Component187 className={`text-[11px] text-gray-500`}>{`应用运行`}</Component187>
          </Component188>
        </Component189>
        <Component202 className={`flex-1 overflow-y-auto p-4 custom-scrollbar space-y-4`}>
          {a && <Component190 className={`rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300`}>
              {a}
            </Component190>}
          {l && <Component191 className={`text-xs text-gray-400 leading-6`}>{l}</Component191>}
          {r ? <Component192 className={`h-40 flex items-center justify-center text-gray-500 text-sm`}>
              <_Component3 size={14} className={`animate-spin mr-2`} />
              {` 加载中…`}
            </Component192> : f.length === 0 ? <Component193 className={`text-xs text-gray-500`}>{`该应用未公开启动参数，可直接运行。`}</Component193> : f.map((e, t) => {
          return <Component201 className={`space-y-1.5`} key={e.id}>
                  <Component197 className={`text-xs text-gray-400 flex items-center gap-2`}>
                    <Component194>
                      {t + 1}
                      {`. `}
                      {e.label || e.key}
                    </Component194>
                    {e.required && <Component195 className={`text-red-400`}>{`*`}</Component195>}
                    <Component196 className={`ml-auto text-[10px] text-gray-600`}>
                      {e.type}
                    </Component196>
                  </Component197>
                  {e.type === `json` ? <Component198 value={_[e.id] ?? ``} onChange={t => {
              return T(e.id, t.target.value);
            }} className={`w-full rounded-lg border border-[#333] bg-[#151515] px-3 py-2 text-sm text-white outline-none focus:border-blue-500 min-h-[80px]`} placeholder={`请输入 ${e.label || e.key}`} /> : e.type === `boolean` ? <Component199 type={`checkbox`} checked={!!_[e.id]} onChange={t => {
              return T(e.id, t.target.checked);
            }} className={`h-4 w-4 accent-blue-500`} /> : <Component200 type={e.type === `number` ? `number` : `text`} value={_[e.id] ?? ``} onChange={t => {
              return T(e.id, e.type === `number` ? Number(t.target.value) : t.target.value);
            }} className={`w-full rounded-lg border border-[#333] bg-[#151515] px-3 py-2 text-sm text-white outline-none focus:border-blue-500`} placeholder={`请输入 ${e.label || e.key}`} />}
                </Component201>;
        })}
        </Component202>
        <Component204 className={`p-4 border-t border-[#1f1f1f]`}>
          <Component203 onClick={w} disabled={r || !y || x} className={`w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-500 disabled:opacity-50`}>
            {x ? <_Component3 size={15} className={`animate-spin`} /> : <_Component0 size={15} />}
            {`运行应用`}
          </Component203>
        </Component204>
      </Component205>
      <Component207 className={`flex-1 relative`}>
        {y ? <Ye {...n} localToolBaseUrl={ge()} projectId={C} /> : <Component206 className={`h-full flex items-center justify-center text-gray-500 text-sm`}>
            {a ? `无法加载应用画布` : `正在准备应用画布…`}
          </Component206>}
      </Component207>
    </Component208>;
}