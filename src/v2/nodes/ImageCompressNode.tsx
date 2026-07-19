import { memo, useState, useEffect, useMemo, useRef, useCallback, Fragment } from 'react';
import { useReactFlow, useHandleConnections, Position } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import { AlertCircle, ImageIcon, Loader2, Upload, Zap } from 'lucide-react';
import CustomHandle from './CustomHandle';
import NodeTitle from './NodeTitle';

// TODO: implement - tc: 从连接的源节点中提取图片URL数组
// const tc = (sourceIds: string[]): string[] => { ... };

// TODO: implement - Xs: 图片压缩函数
// const Xs = (url: string, options: { maxSize: number; quality: number; format: string; targetKB?: number }): Promise<{ dataUrl: string; originalSize: number; size: number }> => { ... };

// TODO: implement - Zs: 尺寸选项数组
// const Zs = [{ value: 0, label: '原始' }, ...];

// TODO: implement - Qs: 清晰度选项数组
// const Qs = [{ value: 0.8, label: '80%' }, ...];

// TODO: implement - $s: 格式选项数组
// const $s = [{ value: 'image/jpeg', label: 'JPEG' }, ...];

// TODO: implement - ec: 文件大小格式化
// const ec = (bytes: number): string => { ... };

// TODO: implement - ci: 节点选中指示器组件
// import SelectionIndicator from './SelectionIndicator';

interface ImageCompressNodeData {
  maxSize?: number;
  quality?: number;
  format?: string;
  targetKB?: number;
  loading?: boolean;
  progress?: number;
  errorMessage?: string;
  resultInfo?: {
    count: number;
    totalOriginal: number;
    totalSize: number;
  };
  imageUrls?: string[];
  onAddImage?: (nodeId: string, url: string) => void;
  onShowToast?: (message: string) => void;
  onPushImagesToImageBox?: (nodeId: string, images: Array<{ url: string; label: string }>) => boolean;
  onSpawnImageNode?: (nodeId: string, url: string, label: string) => void;
  [key: string]: unknown;
}

const ImageCompressNode = memo(({ id, data, selected }: NodeProps<{ data: ImageCompressNodeData }>) => {
  const { updateNodeData } = useReactFlow();
  const a = data;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [maxSize, setMaxSize] = useState(data.maxSize ?? 0);
  const [quality, setQuality] = useState(data.quality ?? 0.8);
  const [format, setFormat] = useState(data.format || 'image/jpeg');
  const [targetKBEnabled, setTargetKBEnabled] = useState(!!data.targetKB);
  const [targetKB, setTargetKB] = useState(data.targetKB || 200);

  const connections = useHandleConnections({ type: 'target' });
  const sourceIds = useMemo(() => connections.map(e => e.source), [connections]);
  const imageUrls = useMemo(() => (tc as any)(Array.isArray(sourceIds) ? sourceIds : sourceIds ? [sourceIds] : []), [sourceIds]);

  useEffect(() => {
    updateNodeData(id, { imageUrls });
  }, [imageUrls, id, updateNodeData]);

  useEffect(() => {
    updateNodeData(id, {
      maxSize,
      quality,
      format,
      targetKB: targetKBEnabled ? targetKB : undefined,
    });
  }, [maxSize, quality, format, targetKBEnabled, targetKB, id, updateNodeData]);

  const handleFileChange = (t: React.ChangeEvent<HTMLInputElement>) => {
    const files = t.target.files;
    if (!files || files.length === 0) return;
    Array.from(files).forEach(file => {
      const url = URL.createObjectURL(file);
      a.onAddImage?.(id, url);
    });
    t.target.value = '';
  };

  const handleCompress = useCallback(async () => {
    const urls = imageUrls;
    if (!urls || urls.length === 0) {
      a.onShowToast?.('请先上传图片或连接包含图片的节点');
      return;
    }

    updateNodeData(id, {
      loading: true,
      progress: 0,
      errorMessage: undefined,
      resultInfo: undefined,
    });

    const compressedImages: Array<{ url: string; label: string }> = [];
    let totalOriginal = 0;
    let totalSize = 0;
    let errorMsg = '';

    for (let i = 0; i < urls.length; i++) {
      try {
        const result = await (Xs as any)(urls[i], {
          maxSize,
          quality,
          format,
          targetKB: targetKBEnabled ? targetKB : undefined,
        });
        compressedImages.push({
          url: result.dataUrl,
          label: `压缩图 ${i + 1}`,
        });
        totalOriginal += result.originalSize;
        totalSize += result.size;
      } catch (err: any) {
        errorMsg ||= err?.message || '压缩失败';
      }
      updateNodeData(id, {
        progress: Math.round((i + 1) / urls.length * 100),
      });
    }

    if (compressedImages.length === 0) {
      updateNodeData(id, {
        loading: false,
        errorMessage: errorMsg || '压缩失败',
      });
      a.onShowToast?.(errorMsg || '压缩失败');
      return;
    }

    updateNodeData(id, {
      loading: false,
      resultInfo: {
        count: compressedImages.length,
        totalOriginal,
        totalSize,
      },
    });

    const pushed = a.onPushImagesToImageBox?.(id, compressedImages);
    if (!pushed) {
      compressedImages.forEach(img => a.onSpawnImageNode?.(id, img.url, img.label));
    }
    errorMsg && a.onShowToast?.(`部分图片压缩失败：${errorMsg}`);
  }, [imageUrls, maxSize, quality, format, targetKBEnabled, targetKB, id, updateNodeData, a]);

  const isLoading = !!a.loading;
  const hasResult = !!a.resultInfo;
  const isPng = format === 'image/png';
  const imageCount = imageUrls.length;

  return (
    <div className="relative group/node w-full h-full min-w-[300px] min-h-[200px]">
      <NodeTitle
        id={id}
        data={data}
        defaultTitle="图片压缩"
        icon={<ImageIcon size={11} className="text-gray-500" />}
        floating={true}
      />
      {/* TODO: implement - ci (SelectionIndicator) component */}
      {/* <SelectionIndicator visible={!!selected} minWidth={300} minHeight={200} /> */}
      <div className={`w-full h-full bg-[#1c1c1c] rounded-xl overflow-hidden border shadow-xl transition-all duration-300 flex flex-col drag-handle cursor-move ${selected ? 'border-[#555]' : 'border-[#333] hover:border-[#444]'}`}>
        <CustomHandle
          type="target"
          position={Position.Left}
        />
        <input
          type="file"
          ref={fileInputRef}
          multiple
          style={{ display: 'none' }}
          accept="image/*"
          onChange={handleFileChange}
        />
        <div className="flex-1 p-3 flex flex-col gap-2.5">
          {imageCount === 0 ? (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="nodrag flex flex-col items-center justify-center gap-1.5 py-3 rounded-lg border border-dashed border-[#3a3a3a] text-gray-500 hover:text-blue-400 hover:border-blue-500/50 transition-colors"
            >
              <Upload size={20} />
              <span className="text-[11px]">上传图片 或 左侧连接图片节点</span>
            </button>
          ) : (
            <div className="text-[11px] text-gray-400">
              已连接 <span className="text-blue-400">{imageCount}</span> 张图片
            </div>
          )}
          {a.errorMessage && (
            <div className="flex items-center gap-1.5 text-[11px] text-red-400">
              <AlertCircle size={13} className="shrink-0" />
              <span className="break-words">{a.errorMessage}</span>
            </div>
          )}
          <div className="grid grid-cols-3 gap-2">
            <label className="nodrag flex flex-col gap-1 text-[10px] text-gray-500">
              尺寸
              <select
                value={maxSize}
                onChange={e => setMaxSize(Number(e.target.value))}
                className="nodrag bg-[#222] border border-[#333] rounded px-1.5 py-1 text-[11px] text-gray-200 outline-none focus:border-[#555]"
              >
                {/* TODO: implement - Zs (size options) */}
                {(Zs as any[]).map(e => (
                  <option key={e.value} value={e.value}>{e.label}</option>
                ))}
              </select>
            </label>
            <label className="nodrag flex flex-col gap-1 text-[10px] text-gray-500">
              清晰度
              <select
                value={quality}
                disabled={isPng || targetKBEnabled}
                onChange={e => setQuality(Number(e.target.value))}
                className="nodrag bg-[#222] border border-[#333] rounded px-1.5 py-1 text-[11px] text-gray-200 outline-none focus:border-[#555] disabled:opacity-40"
              >
                {/* TODO: implement - Qs (quality options) */}
                {(Qs as any[]).map(e => (
                  <option key={e.value} value={e.value}>{e.label}</option>
                ))}
              </select>
            </label>
            <label className="nodrag flex flex-col gap-1 text-[10px] text-gray-500">
              格式
              <select
                value={format}
                onChange={e => setFormat(e.target.value)}
                className="nodrag bg-[#222] border border-[#333] rounded px-1.5 py-1 text-[11px] text-gray-200 outline-none focus:border-[#555]"
              >
                {/* TODO: implement - $s (format options) */}
                {($s as any[]).map(e => (
                  <option key={e.value} value={e.value}>{e.label}</option>
                ))}
              </select>
            </label>
          </div>
          {!isPng && (
            <label className="nodrag flex items-center gap-2 text-[10px] text-gray-400">
              <input
                type="checkbox"
                checked={targetKBEnabled}
                onChange={e => setTargetKBEnabled(e.target.checked)}
                className="nodrag accent-blue-500"
              />
              <span>限制目标大小</span>
              {targetKBEnabled && (
                <Fragment>
                  <input
                    type="number"
                    min={10}
                    max={20000}
                    value={targetKB}
                    onChange={e => setTargetKB(Math.max(10, Number(e.target.value) || 10))}
                    className="nodrag w-16 bg-[#222] border border-[#333] rounded px-1.5 py-0.5 text-[11px] text-gray-200 outline-none focus:border-[#555]"
                  />
                  <span>KB</span>
                </Fragment>
              )}
            </label>
          )}
          {a.resultInfo && (
            <div className="text-[10px] text-gray-400 flex items-center gap-2 flex-wrap">
              <span>{a.resultInfo.count} 张</span>
              <span>·</span>
              {a.resultInfo.totalOriginal ? (
                <span>
                  {(ec as any)(a.resultInfo.totalOriginal)} → <span className="text-blue-400">{(ec as any)(a.resultInfo.totalSize)}</span>
                </span>
              ) : (
                <span className="text-blue-400">{(ec as any)(a.resultInfo.totalSize)}</span>
              )}
            </div>
          )}
          <div className="mt-auto flex items-center gap-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="nodrag flex items-center justify-center h-8 w-8 rounded-md text-gray-300 bg-[#2a2a2a] hover:bg-[#333] border border-[#333] transition-colors"
              title="上传图片"
            >
              <Upload size={14} />
            </button>
            <button
              onClick={handleCompress}
              disabled={isLoading || imageCount === 0}
              className="nodrag flex-1 flex items-center justify-center gap-1.5 h-8 rounded-md text-[12px] font-medium bg-white text-[#141414] hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? (
                <Fragment>
                  <Loader2 size={13} className="animate-spin" /> 压缩中 {a.progress || 0}%
                </Fragment>
              ) : (
                <Fragment>
                  <Zap size={13} /> {hasResult ? '重新免费压缩' : '免费压缩'}{imageCount > 1 ? `（${imageCount}张）` : ''}
                </Fragment>
              )}
            </button>
          </div>
        </div>
        <CustomHandle
          type="source"
          position={Position.Right}
          id="main-output"
        />
      </div>
    </div>
  );
});

export default ImageCompressNode;