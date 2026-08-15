// TODO(全局, 无需 import): controller, localToolStatus, updateInfo, currentVersion, isCheckingUpdate, checkUpdateNow, showToast, y, behavior, block, t, f, n, c, u, v, status, error, s, l, x, message, b, downloadBaseUrl, targetVersion, m, distPath, extensionId, manifestVersion, localToolChanged, w, d, width, i
import { q, e, Kt, J, Ut, Jt, r, a, Wt, Je, Ht, Gt, _, g, C, S, _Component3, _Component4, _Component5, D, E, R } from './shared.js';
import * as W from 'react';
import * as p from 'react';
export default function Qt({
  controller: e,
  localToolStatus: t
}) {
  let [n, r] = W.useState(() => {
    return localStorage.getItem(q) || ``;
  });
  let [i, a] = W.useState(false);
  let [s, c] = W.useState(false);
  let [l, u] = W.useState(false);
  let [d, f] = W.useState(null);
  let {
    updateInfo: p,
    currentVersion: m,
    isCheckingUpdate: g,
    checkUpdateNow: _,
    showToast: v
  } = e;
  let y = W.useRef(null);
  let b = W.useCallback(() => {
    requestAnimationFrame(() => {
      y.current?.scrollIntoView({
        behavior: `smooth`,
        block: `center`
      });
    });
  }, []);
  W.useEffect(() => {
    if (!t.isConnected || !s && !l) {
      return;
    }
    let e = window.setInterval(async () => {
      try {
        let n = await Kt(t.port);
        f(n);
        if (J(n)) {
          window.clearInterval(e);
          c(false);
          u(false);
          v(`本地引擎已完成文件替换，正在重载插件`);
          window.setTimeout(Ut, 800);
        } else if (Jt(n)) {
          window.clearInterval(e);
          c(false);
          u(false);
          v(n.error || n.message || `本地引擎升级失败`);
        }
      } catch (e) {
        f({
          status: `failed`,
          error: e instanceof Error ? e.message : `查询升级状态失败`
        });
        c(false);
        u(false);
      }
    }, 1200);
    return () => {
      return window.clearInterval(e);
    };
  }, [s, l, t.isConnected, t.port, v]);
  let x = e => {
    r(e);
    localStorage.setItem(q, e);
  };
  let S = async () => {
    if (!t.isConnected) {
      v(`请先启动本地引擎后再自动升级`);
      return;
    }
    if (!p?.version) {
      v(`updateInfo version is missing`);
      return;
    }
    x(n.trim());
    c(true);
    f({
      status: `pending`,
      message: `已提交升级请求，等待本地引擎处理`
    });
    a(false);
    b();
    try {
      let e = await Wt(t.port, {
        downloadBaseUrl: `${Je}/plugin`,
        targetVersion: p?.version,
        currentVersion: m,
        distPath: n.trim(),
        extensionId: Ht(),
        manifestVersion: m,
        localToolChanged: !!p?.localToolChanged
      });
      f(e);
      if (J(e)) {
        v(`本地引擎已完成文件替换，正在重载插件`);
        window.setTimeout(Ut, 800);
      }
    } catch (e) {
      c(false);
      f({
        status: `failed`,
        error: e instanceof Error ? e.message : `提交升级请求失败`
      });
      v(e instanceof Error ? e.message : `提交升级请求失败`);
    }
  };
  let C = async () => {
    if (!t.isConnected) {
      v(`请先启动本地引擎后再回退`);
      return;
    }
    x(n.trim());
    u(true);
    f({
      status: `pending`,
      message: `已提交回退请求，等待本地引擎恢复备份`
    });
    b();
    try {
      let e = await Gt(t.port, {
        currentVersion: m,
        distPath: n.trim(),
        extensionId: Ht(),
        targetVersion: p?.previousVersion
      });
      f(e);
      if (J(e)) {
        v(`本地引擎已完成回退，正在重载插件`);
        window.setTimeout(Ut, 800);
      }
    } catch (e) {
      u(false);
      f({
        status: `failed`,
        error: e instanceof Error ? e.message : `提交回退请求失败`
      });
      v(e instanceof Error ? e.message : `提交回退请求失败`);
    }
  };
  let w = s || l;
  const Component39 = `div`;
  const Component40 = `h2`;
  const Component41 = `span`;
  const Component42 = `span`;
  const Component43 = `div`;
  const Component44 = `p`;
  const Component45 = `div`;
  const Component46 = `div`;
  const Component47 = `button`;
  const Component48 = `div`;
  const Component49 = `h3`;
  const Component50 = `p`;
  const Component51 = `div`;
  const Component52 = `div`;
  const Component53 = `div`;
  const Component54 = `h3`;
  const Component55 = `p`;
  const Component56 = `div`;
  const Component57 = `button`;
  const Component58 = `div`;
  const Component59 = `div`;
  const Component60 = `div`;
  const Component61 = `div`;
  const Component62 = `div`;
  const Component63 = `p`;
  const Component64 = `div`;
  const Component65 = `h3`;
  const Component66 = `li`;
  const Component67 = `li`;
  const Component68 = `li`;
  const Component69 = `li`;
  const Component70 = `ol`;
  const Component71 = `div`;
  const Component72 = `h3`;
  const Component73 = `p`;
  const Component74 = `button`;
  const Component75 = `div`;
  const Component76 = `div`;
  const Component77 = `h3`;
  const Component78 = `button`;
  const Component79 = `div`;
  const Component80 = `div`;
  const Component81 = `button`;
  const Component82 = `button`;
  const Component83 = `div`;
  const Component84 = `div`;
  const Component85 = `div`;
  const Component86 = `div`;
  const Component87 = `div`;
  return <Component87 className={`bg-gradient-to-br from-[#1a1a1a] to-[#0d0c0c] rounded-xl overflow-hidden shadow-sm border border-[#222]`}>
      <Component48 className={`flex justify-between items-center p-5 border-b border-[#222] bg-[#1a1a1a]`}>
        <Component46 className={`flex items-center gap-4`}>
          <Component39 className={`flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-500/15 ring-1 ring-blue-400/25`}>
            <_Component3 size={20} className={`text-blue-300`} />
          </Component39>
          <Component45>
            <Component40 className={`font-bold text-gray-100 text-[15px] flex items-center gap-2`}>{`版本升级`}</Component40>
            <Component43 className={`mt-2 flex items-baseline gap-3`}>
              <Component41 className={`text-[12px] font-medium text-gray-500`}>{`当前版本`}</Component41>
              <Component42 className={`text-3xl font-black tracking-tight text-white leading-none`}>
                {`v`}
                {m}
              </Component42>
            </Component43>
            <Component44 className={`text-xs text-gray-500 mt-2`}>{`确认升级后由本地引擎自动替换当前 dist 并重载插件。`}</Component44>
          </Component45>
        </Component46>
        <Component47 onClick={() => {
        return _(true);
      }} disabled={g || w} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-colors ${g || w ? `bg-[#222] text-gray-500 cursor-not-allowed` : `bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/20`}`}>
          <_Component3 size={14} className={g ? `animate-spin` : ``} />
          {g ? `检查中...` : `检查更新`}
        </Component47>
      </Component48>
      <Component76 className={`p-4 space-y-4`}>
        <Component53 className={`rounded-lg border p-4 ${t.isConnected ? `bg-emerald-900/10 border-emerald-500/20` : `bg-red-900/10 border-red-500/20`}`}>
          <Component52 className={`flex items-start gap-3`}>
            <_Component4 size={16} className={t.isConnected ? `text-emerald-400 mt-0.5` : `text-red-400 mt-0.5`} />
            <Component51>
              <Component49 className={`text-sm font-bold ${t.isConnected ? `text-emerald-400` : `text-red-400`}`}>
                {t.isConnected ? `本地引擎已连接` : `本地引擎未连接`}
              </Component49>
              <Component50 className={`text-xs text-gray-400 mt-1`}>
                {t.isConnected ? `端口 ${t.port}` : `自动升级和回退必须依赖本地引擎。`}
              </Component50>
            </Component51>
          </Component52>
        </Component53>
        <Component59 className={`rounded-lg border p-4 ${p?.hasUpdate ? `bg-blue-500/10 border-blue-500/30` : `bg-[#0d0c0c] border-[#333]`}`}>
          <Component58 className={`flex items-start justify-between gap-4`}>
            <Component56>
              <Component54 className={`text-sm font-bold text-gray-200 mb-2`}>
                {p?.hasUpdate ? `发现新版本 v${p.version}` : `暂无可用更新`}
              </Component54>
              <Component55 className={`text-xs text-gray-400 leading-6 whitespace-pre-wrap`}>
                {p?.hasUpdate ? p.changelog || `服务器已发布新版本，确认后将由本地引擎自动完成升级。` : `点击右上角检查更新后，如果发现新版本，可直接确认自动升级。`}
              </Component55>
            </Component56>
            {p?.hasUpdate && <Component57 onClick={() => {
            return a(true);
          }} disabled={w} className={`px-4 py-2 rounded text-xs font-bold whitespace-nowrap ${w ? `bg-[#222] text-gray-500 cursor-not-allowed` : `bg-blue-600 text-white hover:bg-blue-500`}`}>{`确认升级`}</Component57>}
          </Component58>
        </Component59>
        <Component64 ref={y} className={`rounded-lg border p-4 scroll-mt-4 ${Jt(d ?? undefined) ? `bg-red-900/10 border-red-500/20` : `bg-[#0d0c0c] border-[#333]`}`}>
          <Component60 className={`flex items-center gap-2 text-sm font-bold text-gray-200 mb-2`}>
            {w && <_Component3 size={14} className={`animate-spin text-blue-400`} />}
            {`升级状态：`}
            {d?.status || `pending`}
          </Component60>
          {typeof d?.progress == `number` && <Component62 className={`w-full bg-[#222] rounded-full h-2 mb-3`}>
              <Component61 className={`h-2 rounded-full bg-blue-500`} style={{
            width: `${Math.max(0, Math.min(100, d.progress))}%`
          }} />
            </Component62>}
          <Component63 className={`text-xs leading-6 ${Jt(d ?? undefined) ? `text-red-300` : `text-gray-400`}`}>
            {d?.error || d?.message || `等待本地引擎返回状态...`}
          </Component63>
        </Component64>
        <Component71 className={`bg-[#0d0c0c] border border-[#333] rounded-lg p-4`}>
          <Component65 className={`text-sm font-bold text-gray-200 mb-3 flex items-center gap-2`}>
            <_Component5 size={15} className={`text-emerald-400`} />
            {` 自动升级流程`}
          </Component65>
          <Component70 className={`text-xs text-gray-400 space-y-2 leading-6 list-decimal list-inside`}>
            <Component66>{`检查许可证服务器版本信息。`}</Component66>
            <Component67>{`用户点击确认升级。`}</Component67>
            <Component68>{`备份旧版安装包，下载并安装新版安装包`}</Component68>
            <Component69>{`重启插件`}</Component69>
          </Component70>
        </Component71>
        <Component75 className={`bg-[#0d0c0c] border border-[#333] rounded-lg p-4`}>
          <Component72 className={`text-sm font-bold text-gray-200 mb-3 flex items-center gap-2`}>
            <D size={15} className={`text-orange-400`} />
            {` 自动回退`}
          </Component72>
          <Component73 className={`text-xs text-gray-400 leading-6 mb-3`}>{`本地引擎应保留旧版本备份；如果新版异常，可恢复备份 dist 并重载插件。`}</Component73>
          <Component74 onClick={C} disabled={w || !t.isConnected} className={`inline-flex items-center gap-2 px-3 py-2 rounded text-xs border ${w || !t.isConnected ? `bg-[#1a1a1a] text-gray-600 border-[#333] cursor-not-allowed` : `bg-[#222] hover:bg-[#2a2a2a] text-gray-200 border-[#333]`}`}>
            <E size={13} />
            {` 执行回退`}
          </Component74>
        </Component75>
      </Component76>
      {i && p?.hasUpdate && <Component86 className={`fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-start justify-center animate-fade-in px-4 pt-20 pb-6 overflow-y-auto custom-scrollbar`}>
          <Component85 className={`bg-[#1a1a1a] rounded-xl border border-[#333] shadow-2xl max-w-lg w-full max-h-[calc(100vh-7rem)] overflow-hidden flex flex-col`}>
            <Component79 className={`px-6 py-4 border-b border-[#333] flex items-center justify-between`}>
              <Component77 className={`text-lg font-bold text-gray-200 flex items-center gap-2`}>
                <_Component3 size={18} className={`text-blue-400`} />
                {` 确认升级到 v`}
                {p.version}
              </Component77>
              <Component78 onClick={() => {
            return a(false);
          }} className={`text-gray-400 hover:text-gray-200 transition-colors`}>
                <R size={18} />
              </Component78>
            </Component79>
            <Component84 className={`p-6 space-y-4 overflow-y-auto custom-scrollbar`}>
              <Component80 className={`bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 text-xs text-gray-300 leading-6 whitespace-pre-wrap`}>
                {p.changelog || `确认后，本地引擎会自动下载并替换当前 dist 目录。`}
              </Component80>
              <Component83 className={`flex justify-end gap-2 pt-2`}>
                <Component81 onClick={() => {
              return a(false);
            }} className={`px-4 py-2 rounded-lg text-xs font-bold bg-[#222] text-gray-300 hover:bg-[#2a2a2a] border border-[#333]`}>{`取消`}</Component81>
                <Component82 onClick={S} className={`px-4 py-2 rounded-lg text-xs font-bold bg-blue-600 text-white hover:bg-blue-500 shadow-lg shadow-blue-900/20`}>{`确认并自动升级`}</Component82>
              </Component83>
            </Component84>
          </Component85>
        </Component86>}
    </Component87>;
}