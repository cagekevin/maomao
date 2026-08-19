// TODO(全局, 无需 import): isVisible, onClose, onRetry, t, i, n
import { e, r, _Component5, _Component25, _Component4 } from './shared.js';
import * as G from 'react';
import * as K from 'react';
export default function Fr({
  isVisible: e,
  onClose: t,
  onRetry: n
}) {
  let [r, i] = G.useState(false);
  if (e) {
    const Component701 = `div`;
    const Component702 = `h2`;
    const Component703 = `p`;
    const Component704 = `div`;
    const Component705 = `div`;
    const Component706 = `p`;
    const Component707 = `span`;
    const Component708 = `li`;
    const Component709 = `span`;
    const Component710 = `li`;
    const Component711 = `li`;
    const Component712 = `ol`;
    const Component713 = `div`;
    const Component714 = `button`;
    const Component715 = `button`;
    const Component716 = `div`;
    const Component717 = `p`;
    const Component718 = `div`;
    const Component719 = `div`;
    return <Component719 className={`fixed inset-0 bg-black/70 flex items-center justify-center z-[9999]`}>
        <Component718 className={`bg-[#1a1a1a] border border-red-500/50 rounded-xl p-6 max-w-md mx-4 shadow-2xl shadow-red-900/20`}>
          <Component705 className={`flex items-center gap-3 mb-4`}>
            <Component701 className={`w-12 h-12 bg-red-500/20 rounded-full flex items-center justify-center`}>
              <_Component5 size={24} className={`text-red-500`} />
            </Component701>
            <Component704>
              <Component702 className={`text-lg font-bold text-white`}>{`本地引擎未连接`}</Component702>
              <Component703 className={`text-sm text-gray-400`}>{`系统功能需要 localTool 工具支持`}</Component703>
            </Component704>
          </Component705>
          <Component713 className={`bg-[#0d0c0c] rounded-lg p-4 mb-4`}>
            <Component706 className={`text-sm text-gray-300 mb-3`}>{`为了保证系统的完整功能和数据安全，请按照以下步骤操作：`}</Component706>
            <Component712 className={`text-sm text-gray-400 space-y-2 list-decimal list-inside`}>
              <Component708>
                {`确保已安装 `}
                <Component707 className={`text-white font-medium`}>{`local-companion`}</Component707>
                {` 本地伴侣工具`}
              </Component708>
              <Component710>
                {`启动 local-companion 服务（默认端口 `}
                <Component709 className={`text-white font-medium`}>{`18080`}</Component709>
                {`）`}
              </Component710>
              <Component711>{`点击下方重试按钮重新检测连接`}</Component711>
            </Component712>
          </Component713>
          <Component716 className={`flex gap-3`}>
            <Component714 onClick={t} className={`flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors text-sm font-medium`}>{`稍后再说`}</Component714>
            <Component715 onClick={() => {
            i(true);
            n();
            setTimeout(() => {
              return i(false);
            }, 2000);
          }} disabled={r} className={`flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 disabled:cursor-not-allowed text-white rounded-lg transition-colors text-sm font-medium flex items-center justify-center gap-2`}>
              {r ? <K.Fragment>
                  <_Component25 size={16} className={`animate-spin`} />
                  {`检测中...`}
                </K.Fragment> : <K.Fragment>
                  <_Component4 size={16} />
                  {`重试连接`}
                </K.Fragment>}
            </Component715>
          </Component716>
          <Component717 className={`text-xs text-gray-500 mt-4 text-center`}>{`当前状态：未检测到 localTool 连接`}</Component717>
        </Component718>
      </Component719>;
  } else {
    return null;
  }
}