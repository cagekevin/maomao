// FaceMosaicNode - 人脸打码节点
// 原版函数名: Cc (L17950-L18288)
import { memo, useState, useRef, useEffect, useMemo, useCallback, Fragment } from 'react';
import { Position, useReactFlow, useHandleConnections } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import {
  ScanFace,
  Upload,
  AlertCircle,
  ZoomIn,
  Play,
  Loader2,
  Pencil,
  Grid3X3,
  Rows3,
  Droplets,
} from 'lucide-react';
import NodeTitle from './NodeTitle';
import CustomHandle from './CustomHandle';
import ResizeController from './ResizeController';
import type { AppNode } from '../types';

// TODO: implement - Sc: 从节点 ID 列表中提取图片 URL
// function Sc(nodeIds: string[]): string[] { ... }
const getConnectedImageUrls = (nodeIds: string[]): string[] => {
  // TODO: implement
  return [];
};

// TODO: implement - _c: 人脸打码处理
// function _c(imageUrl: string, options: { mode: string; strength: number; color: string }): Promise<{ dataUrl: string; faceCount: number }> { ... }
const processFaceMosaic = async (
  _imageUrl: string,
  _options: { mode: string; strength: number; color: string },
): Promise<{ dataUrl: string; faceCount: number }> => {
  // TODO: implement
  throw new Error('Not implemented: processFaceMosaic');
};

// TODO: implement - ii: 上传 data URL 并返回 URL
// function ii(dataUrl: string, options: { preferThumbnail?: boolean; subfolder?: string }): Promise<{ url: string }> { ... }
const uploadDataUrl = async (
  _dataUrl: string,
  _options?: { preferThumbnail?: boolean; subfolder?: string },
): Promise<{ url: string }> => {
  // TODO: implement
  throw new Error('Not implemented: uploadDataUrl');
};

// TODO: implement - Lr: 缩略图 URL 转换
// function Lr(url: string, width: number, type: string): string | null { ... }
const getThumbnailUrl = (_url: string, _width: number, _type: string): string | null => {
  // TODO: implement
  return null;
};

// TODO: implement - bc: 手动打码弹窗组件
// function bc({ imageUrl, onSave, onClose }: { imageUrl: string; onSave: (dataUrl: string) => void; onClose: () => void }) { ... }
const ManualMosaicDialog = (_props: {
  imageUrl: string;
  onSave: (dataUrl: string) => void;
  onClose: () => void;
}) => null;

// TODO: implement - pr: 获取画布设置 (useThumbnail)
// function pr(): { useThumbnail: boolean } { ... }
const useCanvasSettings = (): { useThumbnail: boolean } => {
  // TODO: implement
  return { useThumbnail: false };
};

// xc: 打码模式选项
const mosaicModes = [
  { mode: `mosaic`, label: `马赛克`, icon: Grid3X3 },
  { mode: `bar`, label: `黑条`, icon: Rows3 },
  { mode: `grid`, label: `网格`, icon: Grid3X3 },
  { mode: `blur`, label: `模糊`, icon: Droplets },
];

interface FaceMosaicNodeData {
  mode?: string;
  strength?: number;
  color?: string;
  loading?: boolean;
  progress?: number;
  errorMessage?: string;
  resultInfo?: {
    count: number;
    faceTotal: number;
  };
  resultUrls?: string[];
  imageUrls?: string[];
  onAddImage?: (nodeId: string, url: string) => void;
  onPushImagesToImageBox?: (nodeId: string, images: Array<{ url: string; label: string }>) => void;
  onSpawnImageNode?: (nodeId: string, url: string, label: string) => void;
  onShowToast?: (msg: string) => void;
  onZoom?: (nodeId: string, url: string, displayUrl: string) => void;
  [key: string]: unknown;
}

function FaceMosaicNode({ id, data, selected }: NodeProps<AppNode>) {
  const { updateNodeData } = useReactFlow();
  const nodeData = data as unknown as FaceMosaicNodeData;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState(nodeData.mode || `mosaic`);
  const [strength, setStrength] = useState(nodeData.strength ?? 0.5);
  const [color, setColor] = useState(nodeData.color || `#000000`);
  const [showManual, setShowManual] = useState(false);

  const targetConnections = useHandleConnections({ type: `target` });
  const sourceIds = useMemo(() => targetConnections.map((conn) => conn.source), [targetConnections]);
  const imageUrls = useMemo(
    () => getConnectedImageUrls(Array.isArray(sourceIds) ? sourceIds : sourceIds ? [sourceIds] : []),
    [sourceIds],
  );

  useEffect(() => {
    updateNodeData(id, {
      imageUrls,
    });
  }, [imageUrls, id, updateNodeData]);

  useEffect(() => {
    updateNodeData(id, {
      mode,
      strength,
      color,
    });
  }, [mode, strength, color, id, updateNodeData]);

  const { useThumbnail } = useCanvasSettings();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    !files || files.length === 0 || (Array.from(files).forEach((file) => {
      const url = URL.createObjectURL(file);
      nodeData.onAddImage?.(id, url);
    }), e.target.value = ``);
  };

  const pushResults = useCallback((results: Array<{ url: string; label: string }>) => {
    nodeData.onPushImagesToImageBox && nodeData.onPushImagesToImageBox(id, results) || results.forEach((item) => nodeData.onSpawnImageNode?.(id, item.url, item.label));
  }, [id, nodeData]);

  const handleProcess = useCallback(async () => {
    const urls = imageUrls;
    if (!urls || urls.length === 0) {
      nodeData.onShowToast?.(`请先上传图片或连接包含图片的节点`);
      return;
    }
    updateNodeData(id, {
      loading: true,
      progress: 0,
      errorMessage: undefined,
      resultInfo: undefined,
      resultUrls: undefined,
    });
    const results: Array<{ url: string; label: string }> = [];
    let faceTotal = 0;
    let errorMsg = ``;
    const modeLabel = mosaicModes.find((m) => m.mode === mode)?.label || `打码`;
    for (let idx = 0; idx < urls.length; idx++) {
      try {
        const result = await processFaceMosaic(urls[idx], {
          mode,
          strength,
          color,
        });
        const uploaded = await uploadDataUrl(result.dataUrl, {
          preferThumbnail: true,
          subfolder: `canvas/face_mosaic`,
        });
        results.push({
          url: uploaded.url,
          label: `${modeLabel} ${idx + 1}`,
        });
        faceTotal += result.faceCount;
      } catch (err: unknown) {
        const error = err as Error | null;
        errorMsg ||= error?.message || `打码失败`;
      }
      updateNodeData(id, {
        progress: Math.round((idx + 1) / urls.length * 100),
      });
    }
    if (results.length === 0) {
      updateNodeData(id, {
        loading: false,
        errorMessage: errorMsg || `打码失败`,
      });
      nodeData.onShowToast?.(errorMsg || `打码失败`);
      return;
    }
    const resultUrls = results.map((r) => r.url);
    updateNodeData(id, {
      loading: false,
      resultInfo: {
        count: results.length,
        faceTotal,
      },
      resultUrls,
    });
    pushResults(results);
    faceTotal === 0 && nodeData.onShowToast?.(`未检测到人脸`);
    errorMsg && nodeData.onShowToast?.(`部分图片处理失败：${errorMsg}`);
  }, [imageUrls, mode, strength, color, id, updateNodeData, nodeData, pushResults]);

  const handleManualSave = useCallback(async (dataUrl: string) => {
    setShowManual(false);
    updateNodeData(id, {
      loading: true,
      progress: 0,
      errorMessage: undefined,
      resultInfo: undefined,
      resultUrls: undefined,
    });
    try {
      const url = (await uploadDataUrl(dataUrl, {
        preferThumbnail: true,
        subfolder: `canvas/face_mosaic`,
      })).url;
      pushResults([{
        url,
        label: `手动打码`,
      }]);
      updateNodeData(id, {
        resultInfo: {
          count: 1,
          faceTotal: 0,
        },
        resultUrls: [url],
        loading: false,
      });
    } catch {
      pushResults([{
        url: dataUrl,
        label: `手动打码`,
      }]);
      updateNodeData(id, {
        resultInfo: {
          count: 1,
          faceTotal: 0,
        },
        resultUrls: [dataUrl],
        loading: false,
      });
    }
  }, [pushResults, id, updateNodeData]);

  const isLoading = !!nodeData.loading;
  const imageCount = imageUrls.length;

  return (
    <div className={`relative group/node w-full h-full min-w-[320px] min-h-[250px]`}>
      <NodeTitle
        id={id}
        data={data}
        defaultTitle={`人脸打码`}
        icon={
          <ScanFace
            size={11}
            className={`text-gray-500`}
          />
        }
        floating={true}
      />
      <ResizeController
        visible={!!selected}
        minWidth={320}
        minHeight={250}
      />
      <div className={`w-full h-full bg-[#1c1c1c] rounded-xl overflow-hidden border shadow-xl transition-all duration-300 flex flex-col drag-handle cursor-move ${selected ? `border-[#555]` : `border-[#333] hover:border-[#444]`}`}>
        <CustomHandle
          type={`target`}
          position={Position.Left}
        />
        <input
          type={`file`}
          ref={fileInputRef}
          multiple={true}
          style={{
            display: `none`,
          }}
          accept={`image/*`}
          onChange={handleFileChange}
        />
        <div className={`flex-1 p-3 flex flex-col gap-2.5`}>
          {imageCount === 0 ? (
            <button
              onClick={() => fileInputRef.current?.click()}
              className={`nodrag flex flex-col items-center justify-center gap-1.5 py-3 rounded-lg border border-dashed border-[#3a3a3a] text-gray-500 hover:text-blue-400 hover:border-blue-500/50 transition-colors`}
            >
              <Upload
                size={20}
              />
              <span className={`text-[11px]`}>
                上传图片 或 左侧连接图片节点
              </span>
            </button>
          ) : (
            <div className={`text-[11px] text-gray-400`}>
              {`已连接 `}
              <span className={`text-blue-400`}>
                {imageCount}
              </span>
              {` 张图片`}
            </div>
          )}
          {nodeData.errorMessage && (
            <div className={`flex items-center gap-1.5 text-[11px] text-red-400`}>
              <AlertCircle
                size={13}
                className={`shrink-0`}
              />
              <span className={`break-words`}>
                {nodeData.errorMessage}
              </span>
            </div>
          )}
          <div className={`grid grid-cols-4 gap-1.5`}>
            {mosaicModes.map(({
              mode: m,
              label: l,
              icon: Icon,
            }) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`nodrag flex flex-col items-center justify-center gap-1 py-1.5 rounded-md text-[11px] border transition-colors ${mode === m ? `bg-blue-600 text-white border-blue-500` : `text-gray-300 bg-[#222] hover:bg-[#2a2a2a] border-[#333]`}`}
              >
                <Icon
                  size={14}
                />
                {l}
              </button>
            ))}
          </div>
          <label className={`nodrag flex items-center gap-2 text-[10px] text-gray-400`}>
            <span className={`w-8`}>
              {mode === `grid` ? `密度` : mode === `bar` ? `透明度` : `程度`}
            </span>
            <input
              type={`range`}
              min={0}
              max={1}
              step={0.05}
              value={strength}
              onChange={(e) => setStrength(Number(e.target.value))}
              className={`nodrag accent-blue-500 flex-1`}
            />
            <span className={`w-8 text-right text-gray-500`}>
              {Math.round(strength * 100)}
              {`%`}
            </span>
          </label>
          {(mode === `bar` || mode === `grid`) && (
            <div className={`nodrag flex items-center gap-2 text-[10px] text-gray-400`}>
              <span className={`w-8`}>
                颜色
              </span>
              <div className={`flex items-center gap-1.5 flex-1`}>
                {[`#000000`, `#ffffff`, `#ef4444`, `#22c55e`, `#3b82f6`, `#eab308`, `#a855f7`, `#ec4899`].map((c) => (
                  <button
                    key={c}
                    onClick={() => setColor(c)}
                    className={`w-4 h-4 rounded-full border border-[#333] ${color === c ? `ring-2 ring-blue-500 ring-offset-1 ring-offset-[#1c1c1c]` : ``}`}
                    style={{
                      backgroundColor: c,
                    }}
                  />
                ))}
              </div>
            </div>
          )}
          {nodeData.resultInfo && (
            <div className={`text-[10px] text-gray-400 flex items-center gap-2 flex-wrap`}>
              <span>
                {nodeData.resultInfo.count}
                {` 张`}
              </span>
              {nodeData.resultInfo.faceTotal > 0 && (
                <Fragment>
                  <span>
                    ·
                  </span>
                  <span>
                    {`共 `}
                    <span className={`text-blue-400`}>
                      {nodeData.resultInfo.faceTotal}
                    </span>
                    {` 张人脸`}
                  </span>
                </Fragment>
              )}
            </div>
          )}
          {nodeData.resultUrls && nodeData.resultUrls.length > 0 && (
            <div
              className={`nodrag nowheel mt-1 mb-2 grid grid-cols-2 gap-1.5 max-h-[140px] overflow-y-auto pr-1`}
              style={{
                scrollbarWidth: `thin`,
              }}
            >
              {nodeData.resultUrls.map((url, idx) => {
                const displayUrl = useThumbnail && getThumbnailUrl(url, 420, `image`) || url;
                return (
                  <div
                    key={idx}
                    className={`relative aspect-video bg-[#111] rounded-md overflow-hidden border border-[#333] group`}
                  >
                    <img
                      src={displayUrl}
                      alt={`result-${idx}`}
                      className={`w-full h-full object-cover`}
                      loading={`lazy`}
                      onError={(e: React.SyntheticEvent<HTMLImageElement>) => {
                        const img = e.currentTarget;
                        img.src !== url && (img.src = url);
                      }}
                      onDoubleClick={(e: React.MouseEvent) => {
                        e.stopPropagation();
                        nodeData.onZoom?.(id, url, displayUrl);
                      }}
                    />
                    <div
                      className={`absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors pointer-events-none`}
                    />
                    <button
                      className={`absolute top-1 right-1 p-1 bg-black/60 text-gray-300 hover:text-white rounded opacity-0 group-hover:opacity-100 transition-opacity`}
                      onClick={(e: React.MouseEvent) => {
                        e.stopPropagation();
                        nodeData.onZoom?.(id, url, displayUrl);
                      }}
                      title={`放大查看`}
                    >
                      <ZoomIn
                        size={12}
                      />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
          <div className={`mt-auto flex items-center gap-2`}>
            <button
              onClick={() => fileInputRef.current?.click()}
              className={`nodrag flex items-center justify-center h-8 w-8 rounded-md text-gray-300 bg-[#2a2a2a] hover:bg-[#333] border border-[#333] transition-colors`}
              title={`上传图片`}
            >
              <Upload
                size={14}
              />
            </button>
            <button
              onClick={() => {
                if (imageCount === 0) {
                  nodeData.onShowToast?.(`请先上传或连接图片`);
                  return;
                }
                setShowManual(true);
              }}
              disabled={imageCount === 0}
              className={`nodrag flex items-center justify-center gap-1 h-8 px-2.5 rounded-md text-[12px] text-gray-300 bg-[#2a2a2a] hover:bg-[#333] border border-[#333] disabled:opacity-40 disabled:cursor-not-allowed transition-colors`}
              title={`手动打码`}
            >
              <Pencil
                size={13}
              />
              {` 手动`}
            </button>
            <button
              onClick={handleProcess}
              disabled={isLoading || imageCount === 0}
              className={`nodrag flex-1 flex items-center justify-center gap-1.5 h-8 rounded-md text-[12px] font-medium bg-white text-[#141414] hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors`}
            >
              {isLoading ? (
                <Fragment>
                  <Loader2
                    size={13}
                    className={`animate-spin`}
                  />
                  {` 处理中 `}
                  {nodeData.progress || 0}
                  {`%`}
                </Fragment>
              ) : (
                <Fragment>
                  <Play
                    size={13}
                  />
                  {` AI打码`}{imageCount > 1 ? `（${imageCount}张）` : ``}
                </Fragment>
              )}
            </button>
          </div>
        </div>
        <CustomHandle
          type={`source`}
          position={Position.Right}
          id={`main-output`}
        />
      </div>
      {showManual && imageUrls[0] && (
        <ManualMosaicDialog
          imageUrl={imageUrls[0]}
          onSave={handleManualSave}
          onClose={() => setShowManual(false)}
        />
      )}
    </div>
  );
}

export default memo(FaceMosaicNode);