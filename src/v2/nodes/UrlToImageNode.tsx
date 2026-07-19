import { memo, useState, useEffect, useMemo } from 'react';
import { Position, useHandleConnections, useReactFlow } from '@xyflow/react';
import { Link, AlertCircle, ImageIcon, Loader2 } from 'lucide-react';
import CustomHandle from './CustomHandle';
import NodeTitle from './NodeTitle';

// TODO: implement
const fetchWithLocalProxy = async (_url: string, _options: any): Promise<Response> => {
  throw new Error('Not implemented: fetchWithLocalProxy');
};

// TODO: implement
const useLocalToolStatus = (): { status: { isConnected: boolean; port?: number } } => {
  return { status: { isConnected: false, port: undefined } };
};

const UrlToImageNode = memo(({ id, data, selected }: any) => {
  const { updateNodeData } = useReactFlow() as any;
  const targetConnections = useHandleConnections({ type: 'target' });
  const a = useMemo(() => targetConnections.map((conn: any) => conn.source), [targetConnections]);
  const o = useLocalToolStatus();
  const [s, c] = useState(data.inputUrl || '');
  const [l, u] = useState(false);
  const [d, f] = useState<string | null>(null);

  useEffect(() => {
    let t = '';
    for (let e of a) if (e?.data?.text && typeof e.data.text == 'string' && e.data.text.startsWith('http')) {
      t = e.data.text;
      break;
    }
    t && t !== s && (c(t), updateNodeData(id, {
      inputUrl: t
    }));
  }, [a, id, updateNodeData, s]);

  const p = async () => {
    if (s) {
      u(true); f(null);
      try {
        let t = await fetchWithLocalProxy(s, {
          method: 'GET',
          localPort: o.status.isConnected ? o.status.port : undefined
        });
        if (!t.ok) throw Error(`HTTP ${t.status}`);
        let r = await t.blob();
        updateNodeData(id, {
          imageUrl: await new Promise((resolve, reject) => {
            let n = new FileReader();
            n.onload = () => resolve(n.result);
            n.onerror = reject;
            n.readAsDataURL(r);
          })
        });
        data.onShowToast?.('图片转换成功');
      } catch (t: any) {
        console.error(t);
        f(t.message || '转换失败');
        updateNodeData(id, {
          imageUrl: null
        });
      } finally {
        u(false);
      }
    }
  };

  useEffect(() => {
    s && s !== data.lastFetchedUrl && p().then(() => {
      updateNodeData(id, {
        lastFetchedUrl: s
      });
    });
  }, [s, data.lastFetchedUrl]);

  return (
    <div className="relative flex flex-col">
      <NodeTitle id={id} data={data} defaultTitle="网址转图片" icon={<Link size={11} className="text-gray-500" />} />
      <div className={`w-[260px] bg-[#1a1a1a] rounded-xl shadow-2xl border-2 transition-colors ${selected ? 'border-[#555]' : 'border-[#333] hover:border-[#444]'}`}>
        <CustomHandle type="target" position={Position.Left} />
        <div className="p-3 space-y-3">
          <div className="flex gap-2">
            <input
              type="text"
              value={s}
              onChange={t => {
                c(t.target.value);
                updateNodeData(id, { inputUrl: t.target.value });
              }}
              className="flex-1 bg-[#111] border border-[#333] rounded px-2 py-1 text-xs text-gray-300 focus:outline-none focus:border-gray-500 nodrag"
              placeholder="输入图片 URL (或连线传入)"
            />
            <button
              onClick={p}
              disabled={l || !s}
              className="px-2 py-1 bg-[#333] hover:bg-[#444] rounded text-gray-300 disabled:opacity-50 transition-colors"
              title="重新获取"
            >
              <Loader2 size={14} className={l ? 'animate-spin' : ''} />
            </button>
          </div>
          {d && (
            <div className="flex items-center gap-1 text-red-400 text-[10px]">
              <AlertCircle size={12} />
              <span>{d}</span>
            </div>
          )}
          <div className="border border-[#333] rounded-lg overflow-hidden bg-[#111] relative aspect-video flex items-center justify-center">
            {l ? (
              <div className="text-xs text-gray-500 flex items-center gap-2">
                <Loader2 size={14} className="animate-spin" />
                转换中...
              </div>
            ) : data.imageUrl ? (
              <img
                src={data.imageUrl}
                loading="lazy"
                decoding="async"
                className="w-full h-full object-contain cursor-pointer"
                onDoubleClick={e => {
                  e.stopPropagation();
                  data.onZoom && data.onZoom(data.imageUrl);
                }}
              />
            ) : (
              <div className="text-[10px] text-gray-600 flex flex-col items-center gap-1">
                <ImageIcon size={20} className="opacity-50" />
                <span>等待图片 URL</span>
              </div>
            )}
          </div>
        </div>
        <CustomHandle type="source" position={Position.Right} id="image" />
      </div>
    </div>
  );
});

export default UrlToImageNode;