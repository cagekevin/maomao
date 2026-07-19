import { memo, useMemo } from 'react';
import { Position, useHandleConnections, useReactFlow } from '@xyflow/react';
import { Link, AlertCircle, Loader2 } from 'lucide-react';
import CustomHandle from './CustomHandle';
import NodeTitle from './NodeTitle';

// TODO: implement
const fetchWithLocalProxy = async (_url: string, _options: any): Promise<Response> => {
  throw new Error('Not implemented: fetchWithLocalProxy');
};

// TODO: implement
const uploadToCloudStorage = async (_blob: Blob, _config: any): Promise<string> => {
  throw new Error('Not implemented: uploadToCloudStorage');
};

// TODO: implement
const useLocalToolStatus = (): { status: { isConnected: boolean; port?: number } } => {
  return { status: { isConnected: false, port: undefined } };
};

const FileToUrlNode = memo(({ id, data, selected }: any) => {
  const targetConnections = useHandleConnections({ type: 'target', id: 'file-input' });
  const i = useMemo(() => targetConnections.map((conn: any) => conn.source), [targetConnections]);
  const { updateNodeData } = useReactFlow() as any;
  const o = useLocalToolStatus();
  const s = data.cloudStorageConfig;
  let c = '';
  let l = '';

  if (i.length > 0) {
    let e = i[0].data;
    e.imageUrl ? (c = e.imageUrl, l = 'image') : e.videoUrl ? (c = e.videoUrl, l = 'video') : e.audioUrl ? (c = e.audioUrl, l = 'audio') : e.text ? (c = e.text, l = 'text') : e.customResultData && (c = e.customResultData, l = e.customOutputType);
  }

  return (
    <div className="relative flex flex-col">
      <NodeTitle id={id} data={data} defaultTitle="文件转链接" icon={<Link size={11} className="text-gray-500" />} />
      <div className={`relative bg-[#1c1c1c] border-2 rounded-xl w-[320px] shadow-2xl transition-all duration-200 flex flex-col ${selected ? 'border-[#555]' : 'border-[#333] hover:border-[#444]'}`}>
        <div className="p-4 flex flex-col gap-4 relative">
          <CustomHandle type="target" position={Position.Left} id="file-input" />
          <div className="bg-[#0d0c0c] rounded-lg border border-[#333] h-32 flex items-center justify-center relative overflow-hidden">
            {c ? l === 'image' ? (
              <img src={c} loading="lazy" decoding="async" className="w-full h-full object-contain" alt="输入预览" />
            ) : l === 'video' ? (
              <video src={c} preload="metadata" className="w-full h-full object-contain" />
            ) : l === 'audio' ? (
              <div className="text-gray-500 text-xs flex flex-col items-center gap-2">
                <Link size={24} className="text-gray-400" />
                <span>已连入音频文件</span>
              </div>
            ) : (
              <div className="text-gray-500 text-xs flex flex-col items-center gap-2">
                <Link size={24} className="text-gray-400" />
                <span>已连入文件 ({l})</span>
              </div>
            ) : (
              <div className="text-gray-500 text-xs flex flex-col items-center gap-2">
                <Link size={24} className="opacity-50" />
                <span>连线传入文件或文本</span>
              </div>
            )}
          </div>
          <button
            onClick={async () => {
              if (!c) {
                data.onShowToast?.('没有接收到文件');
                return;
              }
              if (!s || !s.accessKey) {
                data.onShowToast?.('未配置对象存储，请先在设置->对象存储中填写');
                return;
              }
              updateNodeData(id, {
                loading: true,
                errorMsg: null
              });
              try {
                let t;
                t = l === 'text' && !c.startsWith('data:') && !c.startsWith('http') ? new Blob([c], {
                  type: 'text/plain'
                }) : await (await fetchWithLocalProxy(c, {
                  method: 'GET',
                  localPort: o.status.isConnected ? o.status.port : undefined
                })).blob();
                updateNodeData(id, {
                  resultUrl: await uploadToCloudStorage(t, s),
                  loading: false
                });
                data.onShowToast?.('上传成功');
              } catch (t: any) {
                console.error(t);
                updateNodeData(id, {
                  errorMsg: t.message || '上传失败',
                  loading: false
                });
              }
            }}
            disabled={!c || data.loading}
            className={`w-full py-2.5 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-all ${c ? data.loading ? 'bg-[#444] text-white cursor-wait opacity-80' : 'bg-[#444] hover:bg-[#555] text-white shadow-lg' : 'bg-[#222] text-gray-500 cursor-not-allowed'}`}
          >
            {data.loading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                {' 上传中...'}
              </>
            ) : (
              <>生成链接</>
            )}
          </button>
          {data.errorMsg && (
            <div className="text-xs text-red-400 bg-red-400/10 p-2 rounded flex items-start gap-1.5">
              <AlertCircle size={14} className="shrink-0 mt-0.5" />
              <span className="break-words">{data.errorMsg}</span>
            </div>
          )}
          {data.resultUrl && (
            <div className="bg-[#0d0c0c] p-3 rounded-lg border border-[#444] flex flex-col gap-2">
              <div className="text-xs text-gray-400 flex items-center justify-between">
                <span>生成结果:</span>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(data.resultUrl);
                    data.onShowToast?.('链接已复制');
                  }}
                  className="text-gray-300 hover:text-white transition-colors"
                >
                  复制
                </button>
              </div>
              <div className="text-xs text-gray-200 break-all select-all font-mono">
                {data.resultUrl}
              </div>
            </div>
          )}
          <CustomHandle type="source" position={Position.Right} id="url-output" />
        </div>
      </div>
    </div>
  );
});

export default FileToUrlNode;