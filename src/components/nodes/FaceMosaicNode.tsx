import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useReactFlow } from '@xyflow/react';
import {
  Upload,
  ScanFace,
  Loader2,
  AlertCircle,
  Image as ImageIcon,
  Wand2,
  Shuffle,
} from 'lucide-react';
import NodeShell from '../base/ui/NodeShell.tsx';
import HoverToolbar from '../base/panels/HoverToolbar.tsx';
import { useConnectedInputs } from '../../hooks/useConnectedInputs.ts';
import { useMediaDegrade } from '../../hooks/useMediaDegrade.ts';
import { uploadFileToLocal, toAbsoluteFileUrl } from '../base/api/index.ts';
import { useRenderImageResolver } from '../base/utils/imageUrl.ts';
import { showToast, toastError, toastWarning } from '../base/core/toastStore.ts';
import { logger } from '../base/core/logger.ts';
import { classifyError } from '../base/utils/genErrors.ts';
import {
  applyMosaic,
  MOSAIC_MODES,
  MOSAIC_PALETTE,
  type MosaicMode,
} from '../base/utils/faceMosaic.ts';
import FaceMosaicEditor from '../base/editors/FaceMosaicEditor.tsx';
import ImageZoomDialog from '../base/editors/ImageZoomDialog.tsx';
import { generateId } from '../base/core/idGen.ts';
import previewUrls from '../base/utils/previewUrl.ts';
import { dataUrlToBlob } from '../base/core/utils.ts';

/**
 * 人脸打码节点（完整复刻官方 Cl.jsx / faceMosaicNode）。
 *
 * 功能：
 *  - 输入：上传图片 或 连接上游含图片的节点（imageNode/promptNode/imageBoxNode 等，经 useConnectedInputs 收集）
 *  - 模式：马赛克 / 黑条 / 网格 / 模糊（MOSAIC_MODES）
 *  - AI打码：MediaPipe 人脸检测 → 按模式打码 → 结果网格 → spawn imageNode 输出
 *  - 手动：打开 FaceMosaicEditor 全屏编辑器，拖拽框选 + 自动识别人脸
 *  - 结果：成功输出 imageNode（与官方 onSpawnImageNode 对齐）
 */
interface FaceMosaicResultInfo {
  count: number;
  faceTotal: number;
}
interface FaceMosaicNodeData {
  label?: string;
  mode?: MosaicMode;
  strength?: number;
  color?: string;
  imageUrls?: string[];
  errorMessage?: string;
  resultInfo?: FaceMosaicResultInfo | null;
  resultUrls?: string[];
  [key: string]: unknown;
}
interface FaceMosaicNodeProps {
  id: string;
  data: FaceMosaicNodeData;
  selected?: boolean;
}
function FaceMosaicNode({ id, data, selected }: FaceMosaicNodeProps) {
  const { setNodes, getNodes, getNode } = useReactFlow();
  // 标题改名 → 写回 data.label，让下游 @名 匹配 / 素材条显示跟随
  const rename = useCallback(
    (name: string) => {
      setNodes((ns) =>
        ns.map((n) => (n.id === id ? { ...n, data: { ...n.data, label: name } } : n)),
      );
    },
    [id, setNodes],
  );
  const { hideMedia } = useMediaDegrade();
  const fileRef = useRef<HTMLInputElement | null>(null);

  // 模式与参数（复刻官方 o/c/u）
  const [mode, setMode] = useState(data.mode || 'mosaic');
  const [strength, setStrength] = useState(data.strength ?? 0.5);
  const [color, setColor] = useState(data.color || '#000000');
  const [manualOpen, setManualOpen] = useState(false);

  // 图片来源：手动上传的 imageUrl + 连接上游收集的图片 URL（复刻官方 Sl）
  const connected = useConnectedInputs(id);
  const [localImages, setLocalImages] = useState(data.imageUrls || []);
  const render = useRenderImageResolver();

  // 卸载时释放所有预览 Blob URL，避免内存泄漏（对齐 VideoProcessNode / AgentPanel）
  useEffect(
    () => () => {
      localImages.forEach((u) => previewUrls.release(u));
    },
    [localImages],
  );
  const imageUrls = useCallback(() => {
    const list = [...localImages];
    const seen = new Set(list);
    for (const img of connected.images || []) {
      if (img?.url && !seen.has(img.url)) {
        seen.add(img.url);
        list.push(img.url);
      }
    }
    // 读取端兜底：相对 /files/ 路径统一补全，刷新不破图
    return list.map((u) => toAbsoluteFileUrl(u));
  }, [localImages, connected]);

  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState(data.errorMessage || '');
  const [resultInfo, setResultInfo] = useState(data.resultInfo || null);
  const [resultUrls, setResultUrls] = useState(data.resultUrls || []);
  const zoomRef = useRef<HTMLDialogElement | null>(null); // 原生 <dialog> 查看大图

  // 写回模式/参数（复刻官方 useEffect r(e,{mode,strength,color})）
  useEffect(() => {
    setNodes((ns) =>
      ns.map((n) => (n.id === id ? { ...n, data: { ...n.data, mode, strength, color } } : n)),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, strength, color, id, setNodes]);

  // 上传文件 → localImages
  const onUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    Array.from(files).forEach(async (file) => {
      try {
        const url = await uploadFileToLocal(file, 'canvas/face_mosaic');
        const target = url || previewUrls.create(file);
        setLocalImages((prev) => [...prev, target]);
      } catch {
        /* ignore */
      }
    });
    e.target.value = '';
  };

  // 输出结果（复刻官方 y）：spawn imageNode（原型无 imageBox 直连，统一 spawn）
  const outputResults = useCallback(
    (items: Array<{ url: string; label: string }>) => {
      const me = getNode(id);
      const baseX = (me?.position?.x ?? 100) + (me?.measured?.width ?? 320) + 60;
      const baseY = me?.position?.y ?? 100;
      const list = items.map((it, i) => ({
        id: `face-mosaic-${id}-${i}-${generateId('fm')}`,
        type: 'imageNode',
        position: { x: baseX, y: baseY + i * 260 },
        data: { imageUrl: it.url, label: it.label },
        style: { width: 360, height: 260 },
      }));
      setNodes((ns) => [...ns, ...list]);
    },
    [id, getNode, setNodes],
  );

  // AI 打码（复刻官方 b）
  const handleAI = async () => {
    const urls = imageUrls();
    if (urls.length === 0) {
      toastWarning('请先上传图片或连接包含图片的节点');
      return;
    }
    setLoading(true);
    setProgress(0);
    setErrorMessage('');
    setResultInfo(null);
    setResultUrls([]);
    const results = [];
    let faceCount = 0;
    let firstErr = '';
    for (let i = 0; i < urls.length; i++) {
      try {
        const r = await applyMosaic(urls[i], { mode, strength, color });
        const url =
          (await uploadFileToLocal(dataUrlToBlob(r.dataUrl, 'image/png'), 'canvas/face_mosaic')) ||
          r.dataUrl;
        results.push({ url, label: `${MODE_LABEL(mode)} ${i + 1}` });
        faceCount += r.faceCount;
      } catch (e) {
        // 【R7 错误分类记录】单张打码失败不中断（部分成功继续处理后续），分类结果进日志供排查；message 原样透传（错误透传铁律）。
        const cls = classifyError(e);
        logger.warn('FaceMosaicNode', 'mosaic single failed', {
          error: e?.message,
          errType: cls.type,
          retryable: cls.retryable,
        });
        firstErr ||= e?.message || '打码失败';
      }
      setProgress(Math.round(((i + 1) / urls.length) * 100));
    }
    if (results.length === 0) {
      setLoading(false);
      setErrorMessage(firstErr || '打码失败');
      toastError(firstErr || '打码失败');
      return;
    }
    setLoading(false);
    setResultInfo({ count: results.length, faceTotal: faceCount });
    setResultUrls(results.map((r) => r.url));
    outputResults(results);
    if (faceCount === 0) toastWarning('未检测到人脸');
    if (firstErr) toastError(`部分图片处理失败：${firstErr}`);
  };

  // 手动打码保存（复刻官方 x：editor onSave）
  const handleManualSave = useCallback(
    async (dataUrl: string) => {
      setManualOpen(false);
      setLoading(true);
      setProgress(0);
      setErrorMessage('');
      setResultInfo(null);
      setResultUrls([]);
      try {
        const url = await uploadFileToLocal(
          dataUrlToBlob(dataUrl, 'image/png'),
          'canvas/face_mosaic',
        );
        const target = url || dataUrl;
        outputResults([{ url: target, label: '手动打码' }]);
        setResultInfo({ count: 1, faceTotal: 0 });
        setResultUrls([target]);
      } catch {
        outputResults([{ url: dataUrl, label: '手动打码' }]);
        setResultInfo({ count: 1, faceTotal: 0 });
        setResultUrls([dataUrl]);
      }
      setLoading(false);
    },
    [id, outputResults],
  );

  const count = imageUrls().length;
  const isHiddenMedia = hideMedia && hideMedia.includes('image');

  const toolbarButtons = [
    {
      key: 'upload',
      icon: <Upload size={14} />,
      title: '上传图片',
      onClick: () => fileRef.current?.click(),
    },
  ];

  return (
    <NodeShell
      id={id}
      label={data.label}
      defaultTitle="人脸打码"
      icon={<Shuffle size={11} className="text-muted" />}
      selected={selected}
      handleVariant="small"
      aspectRatio={null}
      className="min-w-[320px] min-h-[250px]"
      onRename={rename}
    >
      <HoverToolbar buttons={toolbarButtons} />
      <input
        type="file"
        ref={fileRef}
        multiple
        accept="image/*"
        style={{ display: 'none' }}
        onChange={onUpload}
      />

      <div className="flex-1 p-3 flex flex-col gap-2.5 nowheel">
        {/* 图片源状态 + 输入图预览（上传/连接后立即可见，避免「图片消失」） */}
        {count === 0 ? (
          <button
            onClick={() => fileRef.current?.click()}
            className="nodrag flex flex-col items-center justify-center gap-1.5 py-3 rounded-lg border border-dashed border-edge-raised text-muted hover:text-blue-400 hover:border-blue-500/50 transition-colors cursor-pointer"
          >
            <Upload size={20} />
            <span className="text-[11px]">上传图片 或 左侧连接图片节点</span>
          </button>
        ) : (
          <div className="flex flex-col gap-1.5">
            <div className="text-[11px] text-secondary">
              已连接 <span className="text-blue-400">{count}</span> 张图片
            </div>
            {/* 输入图缩略图：上传的图片立即在此显示 */}
            <div className="grid grid-cols-4 gap-1.5">
              {imageUrls().map((u, i) => (
                <div
                  key={i}
                  className="relative aspect-square bg-surface-black rounded-md overflow-hidden border border-edge group"
                >
                  <img
                    src={render(u)}
                    alt={`input-${i}`}
                    className="w-full h-full object-cover"
                    loading="lazy"
                    decoding="async"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {errorMessage && (
          <div className="flex items-center gap-1.5 text-[11px] text-red-400">
            <AlertCircle size={13} className="shrink-0" />
            <span className="break-words">{errorMessage}</span>
          </div>
        )}

        {/* 模式选择 */}
        <div className="grid grid-cols-4 gap-1.5">
          {MOSAIC_MODES.map((m) => (
            <button
              key={m.mode}
              onClick={() => setMode(m.mode)}
              className={`nodrag flex flex-col items-center justify-center gap-1 py-1.5 rounded-md text-caption-sm border transition-colors cursor-pointer ${mode === m.mode ? 'bg-blue-600 text-white border-blue-500' : 'text-body bg-surface-1 hover:bg-surface-hover border-edge'}`}
            >
              {m.label}
            </button>
          ))}
        </div>

        {/* 强度滑块 */}
        <label className="nodrag flex items-center gap-2 text-[10px] text-secondary">
          <span className="w-8">
            {mode === 'grid' ? '密度' : mode === 'bar' ? '透明度' : '程度'}
          </span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={strength}
            onChange={(e) => setStrength(Number(e.target.value))}
            className="nodrag accent-blue-500 flex-1"
          />
          <span className="w-8 text-right text-muted">{Math.round(strength * 100)}%</span>
        </label>

        {/* 颜色（bar/grid） */}
        {(mode === 'bar' || mode === 'grid') && (
          <div className="nodrag flex items-center gap-2 text-[10px] text-secondary">
            <span className="w-8">颜色</span>
            <div className="flex items-center gap-1.5 flex-1">
              {MOSAIC_PALETTE.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={`w-4 h-4 rounded-full border border-edge cursor-pointer ${color === c ? 'ring-2 ring-blue-500 ring-offset-1 ring-offset-surface-raised' : ''}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
        )}

        {/* 结果信息 */}
        {resultInfo && (
          <div className="text-[10px] text-secondary flex items-center gap-2 flex-wrap">
            <span>{resultInfo.count} 张</span>
            {resultInfo.faceTotal > 0 && (
              <>
                <span>·</span>
                <span>
                  共 <span className="text-blue-400">{resultInfo.faceTotal}</span> 张人脸
                </span>
              </>
            )}
          </div>
        )}

        {/* 结果网格 */}
        {resultUrls.length > 0 && (
          <div className="nodrag nowheel mt-1 mb-2 grid grid-cols-2 gap-1.5 max-h-[140px] overflow-y-auto pr-1 custom-scrollbar">
            {resultUrls.map((u, i) => (
              <div
                key={i}
                className="relative aspect-video bg-surface-black rounded-md overflow-hidden border border-edge group"
              >
                <img
                  src={render(u)}
                  alt={`result-${i}`}
                  className="w-full h-full object-cover"
                  loading="lazy"
                  decoding="async"
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    zoomRef.current?.showModal();
                  }}
                />
                <div
                  className="absolute top-1 right-1 p-1 bg-black/60 text-body rounded opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => zoomRef.current?.showModal()}
                >
                  <ImageIcon size={12} />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 操作按钮 */}
        <div className="mt-auto flex items-center gap-2">
          <button
            onClick={() => fileRef.current?.click()}
            className="nodrag flex items-center justify-center h-8 w-8 rounded-md text-body bg-surface-hover hover:bg-surface-hover-strong border border-edge transition-colors cursor-pointer"
            title="上传图片"
          >
            <Upload size={14} />
          </button>
          <button
            onClick={() => {
              if (count === 0) {
                toastWarning('请先上传或连接图片');
                return;
              }
              setManualOpen(true);
            }}
            disabled={count === 0}
            className="nodrag flex items-center justify-center gap-1 h-8 px-2.5 rounded-md text-[12px] text-body bg-surface-hover hover:bg-surface-hover-strong border border-edge disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
            title="手动打码"
          >
            <Wand2 size={13} /> 手动
          </button>
          <button
            onClick={handleAI}
            disabled={loading || count === 0}
            className="nodrag node-btn-primary flex-1 justify-center"
          >
            {loading ? (
              <>
                <Loader2 size={13} className="animate-spin" /> 处理中 {progress || 0}%
              </>
            ) : (
              <>
                <ScanFace size={13} /> AI打码{count > 1 ? `（${count}张）` : ''}
              </>
            )}
          </button>
        </div>
      </div>

      {/* 手动打码编辑器 */}
      {manualOpen && imageUrls()[0] && (
        <FaceMosaicEditor
          imageUrl={imageUrls()[0]}
          onSave={handleManualSave}
          onClose={() => setManualOpen(false)}
        />
      )}

      {/* 放大查看（原生 <dialog>，双击或点图标打开，点图/Esc 关闭，无外框） */}
      {/* 查看大图：共享 ImageZoomDialog（resultUrls[0] 为当前结果图） */}
      <ImageZoomDialog ref={zoomRef} url={resultUrls[0]} />
    </NodeShell>
  );
}

function MODE_LABEL(mode: MosaicMode | string) {
  return MOSAIC_MODES.find((m) => m.mode === mode)?.label || '打码';
}
export default React.memo(FaceMosaicNode);
