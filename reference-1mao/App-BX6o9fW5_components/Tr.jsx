// TODO(全局, 无需 import): isVisible, onClose, onRetry, t, i, n
import { e, r, _Component4, _Component26, _Component3 } from './shared.js';
import * as W from 'react';
import * as G from 'react';
export default function Tr({
  isVisible: e,
  onClose: t,
  onRetry: n
}) {
  let [r, i] = W.useState(false);
  if (e) {
    const Component699 = `div`;
    const Component700 = `h2`;
    const Component701 = `p`;
    const Component702 = `div`;
    const Component703 = `div`;
    const Component704 = `p`;
    const Component705 = `span`;
    const Component706 = `li`;
    const Component707 = `span`;
    const Component708 = `li`;
    const Component709 = `li`;
    const Component710 = `ol`;
    const Component711 = `div`;
    const Component712 = `button`;
    const Component713 = `button`;
    const Component714 = `div`;
    const Component715 = `p`;
    const Component716 = `div`;
    const Component717 = `div`;
    return <Component717 className={`fixed inset-0 bg-black/70 flex items-center justify-center z-[9999]`}>
        <Component716 className={`bg-[#1a1a1a] border border-red-500/50 rounded-xl p-6 max-w-md mx-4 shadow-2xl shadow-red-900/20`}>
          <Component703 className={`flex items-center gap-3 mb-4`}>
            <Component699 className={`w-12 h-12 bg-red-500/20 rounded-full flex items-center justify-center`}>
              <_Component4 size={24} className={`text-red-500`} />
            </Component699>
            <Component702>
              <Component700 className={`text-lg font-bold text-white`}>{`本地引擎未连接`}</Component700>
              <Component701 className={`text-sm text-gray-400`}>{`系统功能需要 localTool 工具支持`}</Component701>
            </Component702>
          </Component703>
          <Component711 className={`bg-[#0d0c0c] rounded-lg p-4 mb-4`}>
            <Component704 className={`text-sm text-gray-300 mb-3`}>{`为了保证系统的完整功能和数据安全，请按照以下步骤操作：`}</Component704>
            <Component710 className={`text-sm text-gray-400 space-y-2 list-decimal list-inside`}>
              <Component706>
                {`确保已安装 `}
                <Component705 className={`text-white font-medium`}>{`local-companion`}</Component705>
                {` 本地伴侣工具`}
              </Component706>
              <Component708>
                {`启动 local-companion 服务（默认端口 `}
                <Component707 className={`text-white font-medium`}>{`18080`}</Component707>
                {`）`}
              </Component708>
              <Component709>{`点击下方重试按钮重新检测连接`}</Component709>
            </Component710>
          </Component711>
          <Component714 className={`flex gap-3`}>
            <Component712 onClick={t} className={`flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors text-sm font-medium`}>{`稍后再说`}</Component712>
            <Component713 onClick={() => {
            i(true);
            n();
            setTimeout(() => {
              return i(false);
            }, 2000);
          }} disabled={r} className={`flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 disabled:cursor-not-allowed text-white rounded-lg transition-colors text-sm font-medium flex items-center justify-center gap-2`}>
              {r ? <G.Fragment>
                  <_Component26 size={16} className={`animate-spin`} />
                  {`检测中...`}
                </G.Fragment> : <G.Fragment>
                  <_Component3 size={16} />
                  {`重试连接`}
                </G.Fragment>}
            </Component713>
          </Component714>
          <Component715 className={`text-xs text-gray-500 mt-4 text-center`}>{`当前状态：未检测到 localTool 连接`}</Component715>
        </Component716>
      </Component717>;
  } else {
    return null;
  }
}