// TODO(全局, 无需 import): data, selected, handleType, handleId, updateNodeData, r, n, s, o, i, loading, errorMsg, type, method, localPort, resultUrl
import _cmp__Component8 from './_Component8.jsx';
import _cmp__Component12 from './_Component12.jsx';
import { id, Qt, Lt, e, We, Gl, t, X, Bl, a, Jl, _Component58, _Component25, _Component17 } from './shared.js';
import * as _shared from './shared.js';
import * as Q from 'react';
export default function Yl({
  id: e,
  data: t,
  selected: n
}) {
  let r = Qt(Lt({
    handleType: `target`,
    handleId: `file-input`
  }).map(e => {
    return e.source;
  }));
  let {
    updateNodeData: i
  } = We();
  let a = Gl();
  let o = t.cloudStorageConfig;
  let s = ``;
  let c = ``;
  if (r.length > 0) {
    let e = r[0].data;
    if (e.imageUrl) {
      s = e.imageUrl;
      c = `image`;
    } else if (e.videoUrl) {
      s = e.videoUrl;
      c = `video`;
    } else if (e.audioUrl) {
      s = e.audioUrl;
      c = `audio`;
    } else if (e.text) {
      s = e.text;
      c = `text`;
    } else if (e.customResultData) {
      s = e.customResultData;
      c = e.customOutputType;
    }
  }
  const Component1742 = `img`;
  const Component1743 = `video`;
  const Component1744 = `span`;
  const Component1745 = `div`;
  const Component1746 = `span`;
  const Component1747 = `div`;
  const Component1748 = `span`;
  const Component1749 = `div`;
  const Component1750 = `div`;
  const Component1751 = `button`;
  const Component1752 = `span`;
  const Component1753 = `div`;
  const Component1754 = `span`;
  const Component1755 = `button`;
  const Component1756 = `div`;
  const Component1757 = `div`;
  const Component1758 = `div`;
  const Component1759 = `div`;
  const Component1760 = `div`;
  const Component1761 = `div`;
  return <Component1761 className={`relative flex flex-col`}>
      <_cmp__Component8 id={e} data={t} defaultTitle={`文件转链接`} icon={<_Component58 size={11} className={`text-gray-500`} />} />
      <Component1760 className={`relative bg-[#1c1c1c] border-2 rounded-xl w-[320px] shadow-2xl transition-all duration-200 flex flex-col ${n ? `border-[#555]` : `border-[#333] hover:border-[#444]`}`}>
        <Component1759 className={`p-4 flex flex-col gap-4 relative`}>
          <_cmp__Component12 type={`target`} position={X.Left} id={`file-input`} />
          <Component1750 className={`bg-[#0d0c0c] rounded-lg border border-[#333] h-32 flex items-center justify-center relative overflow-hidden`}>
            {s ? c === `image` ? <Component1742 src={s} loading={`lazy`} decoding={`async`} className={`w-full h-full object-contain`} alt={`输入预览`} /> : c === `video` ? <Component1743 src={s} preload={`metadata`} className={`w-full h-full object-contain`} /> : c === `audio` ? <Component1745 className={`text-gray-500 text-xs flex flex-col items-center gap-2`}>
                  <_Component58 size={24} className={`text-gray-400`} />
                  <Component1744>{`已连入音频文件`}</Component1744>
                </Component1745> : <Component1747 className={`text-gray-500 text-xs flex flex-col items-center gap-2`}>
                  <_Component58 size={24} className={`text-gray-400`} />
                  <Component1746>
                    {`已连入文件 (`}
                    {c}
                    {`)`}
                  </Component1746>
                </Component1747> : <Component1749 className={`text-gray-500 text-xs flex flex-col items-center gap-2`}>
                <_Component58 size={24} className={`opacity-50`} />
                <Component1748>{`连线传入文件或文本`}</Component1748>
              </Component1749>}
          </Component1750>
          <Component1751 onClick={async () => {
          if (!s) {
            t.onShowToast?.(`没有接收到文件`);
            return;
          }
          if (!o || !o.accessKey) {
            t.onShowToast?.(`未配置对象存储，请先在设置->对象存储中填写`);
            return;
          }
          i(e, {
            loading: true,
            errorMsg: null
          });
          try {
            let n;
            if (c === `text` && !s.startsWith(`data:`) && !s.startsWith(`http`)) {
              n = new Blob([s], {
                type: `text/plain`
              });
            } else {
              n = await (await Bl(s, {
                method: `GET`,
                localPort: a.status.isConnected ? a.status.port : undefined
              })).blob();
            }
            i(e, {
              resultUrl: await Jl(n, o),
              loading: false
            });
            t.onShowToast?.(`上传成功`);
          } catch (t) {
            console.error(t);
            i(e, {
              errorMsg: t.message || `上传失败`,
              loading: false
            });
          }
        }} disabled={!s || t.loading} className={`w-full py-2.5 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-all ${s ? t.loading ? `bg-[#444] text-white cursor-wait opacity-80` : `bg-[#444] hover:bg-[#555] text-white shadow-lg` : `bg-[#222] text-gray-500 cursor-not-allowed`}`}>
            {t.loading ? <Q.Fragment>
                <_Component25 size={16} className={`animate-spin`} />
                {` 上传中...`}
              </Q.Fragment> : <Q.Fragment>{`生成链接`}</Q.Fragment>}
          </Component1751>
          {t.errorMsg && <Component1753 className={`text-xs text-red-400 bg-red-400/10 p-2 rounded flex items-start gap-1.5`}>
              <_Component17 size={14} className={`shrink-0 mt-0.5`} />
              <Component1752 className={`break-words`}>{t.errorMsg}</Component1752>
            </Component1753>}
          {t.resultUrl && <Component1758 className={`bg-[#0d0c0c] p-3 rounded-lg border border-[#444] flex flex-col gap-2`}>
              <Component1756 className={`text-xs text-gray-400 flex items-center justify-between`}>
                <Component1754>{`生成结果:`}</Component1754>
                <Component1755 onClick={() => {
              navigator.clipboard.writeText(t.resultUrl);
              t.onShowToast?.(`链接已复制`);
            }} className={`text-gray-300 hover:text-white transition-colors`}>{`复制`}</Component1755>
              </Component1756>
              <Component1757 className={`text-xs text-gray-200 break-all select-all font-mono`}>
                {t.resultUrl}
              </Component1757>
            </Component1758>}
          <_cmp__Component12 type={`source`} position={X.Right} id={`url-output`} />
        </Component1759>
      </Component1760>
    </Component1761>;
}