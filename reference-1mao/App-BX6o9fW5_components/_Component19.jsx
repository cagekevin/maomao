// TODO(全局, 无需 import): schedule, powerOf, onEdit, onDelete, onToggle, i, n, t
import _cmp__Component22 from './_Component22.jsx';
import _cmp__Component14 from './_Component14.jsx';
import { Ne, e, cn, ln, a, r, _Component20, _Component21, F } from './shared.js';
import * as W from 'react';
var _Component19 = ({
  schedule: e,
  powerOf: t,
  onEdit: n,
  onDelete: r,
  onToggle: i
}) => {
  let a = Ne(e.steps);
  const Component275 = `div`;
  const Component276 = `span`;
  const Component277 = `span`;
  const Component278 = `span`;
  const Component279 = `button`;
  const Component280 = `button`;
  const Component281 = `button`;
  const Component282 = `div`;
  const Component283 = `div`;
  const Component288 = `div`;
  const Component289 = `div`;
  return <Component289 className={cn(`relative rounded-2xl border overflow-hidden transition-all`, e.enabled ? `bg-white/[0.05] border-emerald-400/30` : `bg-white/[0.025] border-white/[0.06] hover:bg-white/[0.04]`)}>
      {e.enabled && <Component275 className={`absolute left-0 top-0 bottom-0 w-1 bg-emerald-400/80`} />}
      <Component283 className={`flex items-center gap-3 px-5 pt-4 pb-2`}>
        <Component276 className={`text-[16px] font-bold text-white truncate`} title={e.name}>
          {e.name}
        </Component276>
        <Component277 className={`shrink-0 px-1.5 py-0.5 rounded-md bg-white/[0.06] text-[11px] text-white/50`}>
          {ln[e.category].label}
        </Component277>
        <Component278 className={`shrink-0 text-[12px] text-white/35 tabular-nums`}>
          {e.steps.length}
          {` 模型 · `}
          {a}
          {` 次重试`}
        </Component278>
        <Component282 className={`ml-auto flex items-center gap-1 shrink-0`}>
          <Component279 type={`button`} onClick={i} className={cn(`inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-[12.5px] font-medium transition-all`, e.enabled ? `bg-emerald-500/20 text-emerald-200 hover:bg-emerald-500/30` : `bg-white/[0.06] text-white/45 hover:bg-white/[0.12] hover:text-white/80`)} title={e.enabled ? `已启用，点击停用` : `已停用，点击启用`}>
            <_Component20 className={`w-3.5 h-3.5`} strokeWidth={2.5} />
            {e.enabled ? `启用中` : `已停用`}
          </Component279>
          <Component280 type={`button`} onClick={n} className={`p-2 rounded-lg text-white/35 hover:text-white hover:bg-white/10 transition-colors`} title={`编辑`}>
            <_Component21 className={`w-4 h-4`} />
          </Component280>
          <Component281 type={`button`} onClick={r} className={`p-2 rounded-lg text-white/35 hover:text-red-400 hover:bg-white/10 transition-colors`} title={`删除`}>
            <F className={`w-4 h-4`} />
          </Component281>
        </Component282>
      </Component283>
      <Component288 className={`px-5 pb-4 pt-1 flex items-center gap-2 flex-wrap`}>
        {e.steps.map((e, n) => {
        let r = t.get(e.model) || null;
        const Component284 = `span`;
        const Component285 = `span`;
        const Component286 = `span`;
        const Component287 = `span`;
        return <W.Fragment key={e.model}>
              {n > 0 && <_cmp__Component22 />}
              <Component287 className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/[0.05] text-[12.5px] text-white/80`}>
                <Component284 className={`w-4 h-4 inline-flex items-center justify-center rounded bg-white/10 text-white/55 text-[10px] font-semibold tabular-nums`}>
                  {n + 1}
                </Component284>
                <Component285 className={`truncate max-w-[200px]`} title={e.model}>
                  {e.model}
                </Component285>
                {e.retries > 1 && <Component286 className={`text-white/35 text-[11px]`}>
                    {`×`}
                    {e.retries}
                  </Component286>}
                {r && <_cmp__Component14 model={r} />}
              </Component287>
            </W.Fragment>;
      })}
      </Component288>
    </Component289>;
};
export default _Component19;