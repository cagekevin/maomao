// Director3dNode - 3D导演台节点
// 原版函数名: Th (L28284-L28405)
import { memo, useState, useMemo, useCallback } from 'react';
import { Position, useHandleConnections, useReactFlow } from '@xyflow/react';
import { Film, ExternalLink } from 'lucide-react';
import NodeTitle from './NodeTitle';
import ResizeController from './ResizeController';
import CustomHandle from './CustomHandle';
import type { AppNode } from '../types';

// TODO: implement - Director3D 编辑器弹窗组件
const Director3DEditor = (_props: { initialProject: any; initialPanoramaUrl: string | null; onExit: (result: any) => void }) => null;

// TODO: implement - urlifyAsset
const urlifyAsset = async (_dataUrl: string, _options: any): Promise<any> => {
  throw new Error('Not implemented: urlifyAsset');
};

function Director3dNode({ id, data, selected }: { id: string; data: any; selected?: boolean }) {
  const { updateNodeData } = useReactFlow() as any;
  const nodeData = data;
  const [editorOpen, setEditorOpen] = useState(false);
  const imageUrl = nodeData.imageUrl;
  const connections = useHandleConnections({ type: 'target' });
  const sources = useMemo(() => connections.map((c: any) => c.source), [connections]);

  const panoramaUrl = useMemo(() => {
    if (!sources) return null;
    const arr = Array.isArray(sources) ? sources : [sources];
    for (const s of arr) {
      if (!s) continue;
      const url = s.data?.imageUrl;
      if (typeof url === 'string' && (url.startsWith('http') || url.startsWith('data:image'))) return url;
      if (s.type === 'imageBoxNode' && Array.isArray(s.data?.images)) {
        const idx = typeof s.data.activeIndex === 'number' ? s.data.activeIndex : 0;
        const imgUrl = s.data.images[idx]?.url;
        if (typeof imgUrl === 'string') return imgUrl;
      }
    }
    return null;
  }, [sources]);

  const handleExit = useCallback(async (result: any) => {
    setEditorOpen(false);
    const newCaptures: { url: string; label: string }[] = [];
    const allIds: string[] = [];
    const syncedIds = new Set(nodeData.syncedCaptureIds || []);

    result.project.cameras.forEach((cam: any) => {
      cam.captures?.forEach((cap: any) => {
        allIds.push(cap.id);
        if (!syncedIds.has(cap.id)) {
          newCaptures.push({ url: cap.dataUrl, label: cam.name || '机位截图' });
        }
      });
    });

    if (newCaptures.length > 0) {
      nodeData.onCaptureToBox?.(id, newCaptures);
    }

    updateNodeData(id, {
      directorProject: result.project,
      syncedCaptureIds: allIds,
    });

    if (result.thumbnailDataUrl) {
      updateNodeData(id, { imageUrl: result.thumbnailDataUrl });
      try {
        const uploadResult = await urlifyAsset(result.thumbnailDataUrl, {
          subfolder: 'tasks',
          preferThumbnail: true,
          thumbMaxDim: 480,
          thumbQuality: 75,
        });
        if (uploadResult.url && /^https?:\/\//i.test(uploadResult.url)) {
          updateNodeData(id, {
            imageUrl: uploadResult.url,
            thumbnailUrl: uploadResult.thumbnailUrl,
          });
        }
      } catch (e) {
        console.warn('[Director3DNode] 缩略图 URL 化失败，保留 base64', e);
      }
    }
  }, [id, updateNodeData, nodeData]);

  return (
    <div className="relative w-full h-full flex flex-col group/node">
      <ResizeController visible={!!selected} minWidth={220} minHeight={200} />
      <NodeTitle id={id} data={nodeData} defaultTitle="3D 导演台" icon={<Film size={11} className="text-gray-500" />} />
      <div
        className="relative flex-1 bg-[#151515] rounded-xl overflow-hidden border border-[#333] shadow-xl cursor-pointer"
        onClick={() => setEditorOpen(true)}
      >
        {imageUrl ? (
          <img src={imageUrl} className="w-full h-full object-cover" alt="导演台预览" />
        ) : (
          <div className="flex flex-col items-center justify-center absolute inset-0 gap-2 text-gray-600 pointer-events-none">
            <Film size={56} strokeWidth={1.2} />
            <span className="text-xs text-gray-500">点击打开 3D 导演台</span>
          </div>
        )}
        <div className="absolute inset-0 bg-black/0 group-hover/node:bg-black/30 transition-colors flex items-center justify-center opacity-0 group-hover/node:opacity-100">
          <button
            className="flex items-center gap-1.5 px-3 py-2 bg-white/90 hover:bg-white text-black text-xs font-medium rounded-full shadow-lg transition-colors"
            onClick={e => { e.stopPropagation(); setEditorOpen(true); }}
          >
            <ExternalLink size={13} />
            打开导演台
          </button>
        </div>
      </div>
      <CustomHandle type="target" position={Position.Left} variant="large" />
      <CustomHandle type="source" position={Position.Right} variant="large" />
      {editorOpen && typeof document !== 'undefined' && (
        // @ts-ignore createPortal
        Director3DEditor && document.createElement('div')
      )}
    </div>
  );
}

export default memo(Director3dNode);
