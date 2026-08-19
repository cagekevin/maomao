// TODO(全局, 无需 import): data, selected, handleType, handleId, updateNodeData, r, n, s, o, i, loading, errorMsg, type, method, localPort, resultUrl
import _cmp_Ti from './Ti.jsx';
import _cmp__Component10 from './_Component10.jsx';
import { id, Qt, Lt, e, We, fu, t, X, su, a, hu, _Component56, _Component22, _Component16 } from './shared.js';
import * as _shared from './shared.js';
import * as Q from 'react';
export default function gu({
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
  let a = fu();
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
  const Component1764 = `img`;
  const Component1765 = `video`;
  const Component1766 = `span`;
  const Component1767 = `div`;
  const Component1768 = `span`;
  const Component1769 = `div`;
  const Component1770 = `span`;
  const Component1771 = `div`;
  const Component1772 = `div`;
  const Component1773 = `button`;
  const Component1774 = `span`;
  const Component1775 = `div`;
  const Component1776 = `span`;
  const Component1777 = `button`;
  const Component1778 = `div`;
  const Component1779 = `div`;
  const Component1780 = `div`;
  const Component1781 = `div`;
  const Component1782 = `div`;
  const Component1783 = `div`;
  return <Component1783 className={`relative flex flex-col`}>
      <_cmp_Ti id={e} data={t} defaultTitle={`文件转链接`} icon={<_Component56 size={11} className={`text-gray-500`} />} />
      <Component1782 className={`relative bg-[#1c1c1c] border-2 rounded-xl w-[320px] shadow-2xl transition-all duration-200 flex flex-col ${n ? `border-[#555]` : `border-[#333] hover:border-[#444]`}`}>
        <Component1781 className={`p-4 flex flex-col gap-4 relative`}>
          <_cmp__Component10 type={`target`} position={X.Left} id={`file-input`} />
          <Component1772 className={`bg-[#0d0c0c] rounded-lg border border-[#333] h-32 flex items-center justify-center relative overflow-hidden`}>
            {s ? c === `image` ? <Component1764 src={s} loading={`lazy`} decoding={`async`} className={`w-full h-full object-contain`} alt={`输入预览`} /> : c === `video` ? <Component1765 src={s} preload={`metadata`} className={`w-full h-full object-contain`} /> : c === `audio` ? <Component1767 className={`text-gray-500 text-xs flex flex-col items-center gap-2`}>
                  <_Component56 size={24} className={`text-gray-400`} />
                  <Component1766>{`已连入音频文件`}</Component1766>
                </Component1767> : <Component1769 className={`text-gray-500 text-xs flex flex-col items-center gap-2`}>
                  <_Component56 size={24} className={`text-gray-400`} />
                  <Component1768>
                    {`已连入文件 (`}
                    {c}
                    {`)`}
                  </Component1768>
                </Component1769> : <Component1771 className={`text-gray-500 text-xs flex flex-col items-center gap-2`}>
                <_Component56 size={24} className={`opacity-50`} />
                <Component1770>{`连线传入文件或文本`}</Component1770>
              </Component1771>}
          </Component1772>
          <Component1773 onClick={async () => {
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
              n = await (await su(s, {
                method: `GET`,
                localPort: a.status.isConnected ? a.status.port : undefined
              })).blob();
            }
            i(e, {
              resultUrl: await hu(n, o),
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
                <_Component22 size={16} className={`animate-spin`} />
                {` 上传中...`}
              </Q.Fragment> : <Q.Fragment>{`生成链接`}</Q.Fragment>}
          </Component1773>
          {t.errorMsg && <Component1775 className={`text-xs text-red-400 bg-red-400/10 p-2 rounded flex items-start gap-1.5`}>
              <_Component16 size={14} className={`shrink-0 mt-0.5`} />
              <Component1774 className={`break-words`}>{t.errorMsg}</Component1774>
            </Component1775>}
          {t.resultUrl && <Component1780 className={`bg-[#0d0c0c] p-3 rounded-lg border border-[#444] flex flex-col gap-2`}>
              <Component1778 className={`text-xs text-gray-400 flex items-center justify-between`}>
                <Component1776>{`生成结果:`}</Component1776>
                <Component1777 onClick={() => {
              navigator.clipboard.writeText(t.resultUrl);
              t.onShowToast?.(`链接已复制`);
            }} className={`text-gray-300 hover:text-white transition-colors`}>{`复制`}</Component1777>
              </Component1778>
              <Component1779 className={`text-xs text-gray-200 break-all select-all font-mono`}>
                {t.resultUrl}
              </Component1779>
            </Component1780>}
          <_cmp__Component10 type={`source`} position={X.Right} id={`url-output`} />
        </Component1781>
      </Component1782>
    </Component1783>;
}