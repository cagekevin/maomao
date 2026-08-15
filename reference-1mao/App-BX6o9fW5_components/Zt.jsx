// TODO(全局, 无需 import): controller
import { e, _Component3, R } from './shared.js';
export default function Zt({
  controller: e
}) {
  if (e.isUpdateBannerVisible) {
    const Component31 = `span`;
    const Component32 = `span`;
    const Component33 = `div`;
    const Component34 = `button`;
    const Component35 = `button`;
    const Component36 = `button`;
    const Component37 = `div`;
    const Component38 = `div`;
    return <Component38 className={`flex justify-end px-4 mb-3 animate-fade-in`}>
        <Component37 className={`inline-flex items-center gap-3 rounded-xl border border-[#333] bg-[#1c1c1c] pl-3 pr-2 py-2 shadow-xl`}>
          <_Component3 size={14} className={`flex-shrink-0 text-gray-300 animate-spin [animation-duration:3s]`} />
          <Component33 className={`flex items-center gap-2 whitespace-nowrap`}>
            <Component31 className={`text-[13px] font-bold text-white`}>
              {`发现新版本 v`}
              {e.updateInfo?.version}
            </Component31>
            <Component32 className={`rounded-md bg-white/10 px-1.5 py-0.5 text-[10px] font-medium text-gray-300`}>{`推荐升级`}</Component32>
          </Component33>
          <Component34 onClick={() => {
          e.openUpgradeSettings();
          e.dismissUpdateBanner();
        }} className={`rounded-lg bg-white px-3.5 py-1 text-[13px] font-bold text-slate-900 transition-all hover:bg-gray-200`}>{`升级`}</Component34>
          <Component35 onClick={e.ignoreUpdateVersion} className={`rounded-lg px-2 py-1 text-[11px] text-gray-500 transition-colors hover:bg-white/10 hover:text-gray-300 whitespace-nowrap`} title={`忽略此版本，刷新后也不再提示`}>{`不再提示`}</Component35>
          <Component36 onClick={e.dismissUpdateBanner} className={`rounded-lg p-1 text-gray-500 transition-colors hover:bg-white/10 hover:text-gray-200`} title={`暂时关闭，下次刷新仍会提示`}>
            <R size={15} />
          </Component36>
        </Component37>
      </Component38>;
  } else {
    return null;
  }
}