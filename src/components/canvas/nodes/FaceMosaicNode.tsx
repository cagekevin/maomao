import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useReactFlow } from '@xyflow/react';
import { ScanFace, Loader2, AlertCircle, Image as ImageIcon, Wand2, Shuffle } from 'lucide-react';
import NodeShell from '@/components/base/ui/NodeShell';
import { ASSET_NODE_SIZE } from '@/components/canvas/nodeDefaults';
import HoverToolbar from '@/components/base/panels/HoverToolbar';
import { useConnectedInputs } from '@/hooks/useConnectedInputs';
import { useNodeData } from '@/hooks/useNodeData';
import { useNodeRename } from '@/hooks/useNodeRename';
import { uploadFileToLocal, toAbsoluteFileUrl } from '@/components/base/api/index';
// 落盘目录取中央表（TD-03-18：此前本文件裸写 'canvas/face_mosaic'，表外目录 = 孤儿目录的来源）
import { UPLOAD_DIRS } from '@/components/base/utils/uploadDirs';
import { useRenderAssetResolver } from '@/components/base/utils/assetUrl';
import { toastError, toastWarning } from '@/components/base/core/toastStore';
import { logger } from '@/components/base/core/logger';
import { classifyError } from '@/components/base/utils/genErrors';
import {
  applyMosaic,
  MOSAIC_MODES,
  MOSAIC_PALETTE,
  type MosaicMode,
} from '@/components/base/utils/faceMosaic';
import { FaceMosaicEditor } from '@/components/editors';
import ImageZoomDialog from '@/components/base/ui/ImageZoomDialog';
import { generateId } from '@/components/base/core/idGen';
import previewUrls from '@/components/base/utils/previewUrl';
import { dataUrlToBlob } from '@/components/base/core/utils';

/**
 * 人脸打码节点（完整复刻官方 Cl.jsx / faceMosaicNode）。
 *
 * 功能：
 *  - 输入：连接上游含图片的节点（assetNode/imageGenerateNode/imageBoxNode 等，经 useConnectedInputs 收集）
 *  - 模式：马赛克 / 黑条 / 网格 / 模糊（MOSAIC_MODES）
 *  - AI打码：MediaPipe 人脸检测 → 按模式打码 → 结果网格 → spawn assetNode 输出
 *  - 手动：打开 FaceMosaicEditor 全屏编辑器，拖拽框选 + 自动识别人脸
 *  - 结果：成功输出 assetNode（与官方 onSpawnImageNode 对齐）
 */
interface FaceMosaicResultInfo {
  count: number;
  faceTotal: number;
}
/**
 * 人脸打码节点 data 契约。
 *
 * 【结果为什么不在 data 里】本节点产物经 `outputResults` spawn `assetNode` 子节点持久
 * （对齐 spec/CONTEXT.md §五 审计豁免：FaceMosaic 结果经子节点交付，本节点仅预览）。
 * 因此 `resultUrls / resultInfo / errorMessage` 天生是**会话内预览态**，只存 useState、不落盘。
 *
 * 2026-09-11 数据体检（`npm run check:node-data`）：这三个字段原先在接口声明且用
 * `data.xxx` 初始化读取，但**全库（含 TS 迁移前的 .jsx 版本）从无任何写入点** ——
 * 属幽灵字段（读了永远拿不到的默认值）。已删声明与读取，行为零变化。
 */
interface FaceMosaicNodeData {
  label?: string;
  mode?: MosaicMode;
  strength?: number;
  color?: string;
  /**
   * 图片源（palette 默认 `[]`，由上游连线注入，刷新不丢）。
   * 落盘失败退回的 `blob:` 预览不入 data（刷新即死链，写进快照等于存垃圾）。
   * 上游连线来的图不在此字段（每次实时读 `connected`）。
   */
  assetUrls?: string[];
}
interface FaceMosaicNodeProps {
  id: string;
  data: FaceMosaicNodeData;
  selected?: boolean;
}
function FaceMosaicNode({ id, data, selected }: FaceMosaicNodeProps) {
  const { setNodes, getNodes: _getNodes, getNode } = useReactFlow();
  // data 写回唯一入口（收口）：模式参数 + 图源都走它（§5.4.9 节点样板收口 hook）
  const { patchData } = useNodeData(id);
  // 标题改名 → 写回 data.label（下游 @名 匹配 / 素材条显示跟随），单一实现收口到 useNodeRename
  const rename = useNodeRename(id);
  // 旧的 `const { hideMedia: _hideMedia } = useAssetDegrade()` 已删：本节点未落地降级隐藏，纯死调用
  // （保留会在"谁真正响应性能降级"的排查里误导）。要加降级时再按需引入。
  // 模式与参数（复刻官方 o/c/u）
  const [mode, setMode] = useState(data.mode || 'mosaic');
  const [strength, setStrength] = useState(data.strength ?? 0.5);
  const [color, setColor] = useState(data.color || '#000000');
  const [manualOpen, setManualOpen] = useState(false);

  // 图片来源：连接上游收集的图片 URL（复刻官方 Sl）
  const connected = useConnectedInputs(id);
  const [localImages] = useState(data.assetUrls || []);
  const render = useRenderAssetResolver();

  // 卸载时释放所有预览 Blob URL，避免内存泄漏（对齐 VideoProcessNode / AgentPanel）
  useEffect(
    () => () => {
      localImages.forEach((u) => previewUrls.release(u));
    },
    [localImages],
  );
  const assetUrls = useCallback(() => {
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
  // 以下三个为会话内预览态（不落盘，原因见 FaceMosaicNodeData 注释）：不从 data 初始化
  const [errorMessage, setErrorMessage] = useState('');
  const [resultInfo, setResultInfo] = useState<FaceMosaicResultInfo | null>(null);
  const [resultUrls, setResultUrls] = useState<string[]>([]);
  const zoomRef = useRef<HTMLDialogElement | null>(null); // 原生 <dialog> 查看大图

  // 写回模式/参数（复刻官方 useEffect r(e,{mode,strength,color})）——统一走 useNodeData.patchData
  useEffect(() => {
    patchData({ mode, strength, color });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, strength, color, patchData]);

  // 输出结果（复刻官方 y）：spawn assetNode（原型无 imageBox 直连，统一 spawn）
  const outputResults = useCallback(
    (items: Array<{ url: string; label: string }>) => {
      const me = getNode(id);
      const baseX = (me?.position?.x ?? 100) + (me?.measured?.width ?? 320) + 60;
      const baseY = me?.position?.y ?? 100;
      const list = items.map((it, i) => ({
        id: `face-mosaic-${id}-${i}-${generateId('fm')}`,
        type: 'assetNode',
        position: { x: baseX, y: baseY + i * 260 },
        data: { assetUrl: it.url, label: it.label },
        style: { ...ASSET_NODE_SIZE.image }, // 尺寸单源（TD-16-48）：图片档 = 360×260
      }));
      setNodes((ns) => [...ns, ...list]);
    },
    [id, getNode, setNodes],
  );

  // AI 打码（复刻官方 b）
  const handleAI = async () => {
    const urls = assetUrls();
    if (urls.length === 0) {
      toastWarning('请先连接包含图片的节点');
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
        const up = await uploadFileToLocal(
          dataUrlToBlob(r.dataUrl, 'image/png'),
          UPLOAD_DIRS.faceMosaic,
        );
        // 【2026-09-17 判据】落盘失败 → **保留内联 dataURL**（真兜底：图仍能上屏，不丢图），
        // 但**原因不吞**：原 `|| r.dataUrl` 把失败彻底静默（用户与开发者都不知道没落盘）。
        if (!up.ok) firstErr ||= `结果未落盘：${up.message}`;
        const url = up.ok ? up.url : r.dataUrl;
        results.push({ url, label: `${MODE_LABEL(mode)} ${i + 1}` });
        faceCount += r.faceCount;
      } catch (e) {
        // 【R7 错误分类记录】单张打码失败不中断（部分成功继续处理后续），分类结果进日志供排查；message 原样透传（错误透传铁律）。
        const cls = classifyError(e);
        logger.warn('FaceMosaicNode', 'mosaic single failed', {
          error: (e as { message?: string })?.message,
          errType: cls.type,
          retryable: cls.retryable,
        });
        firstErr ||= (e as { message?: string })?.message || '打码失败';
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
        const up = await uploadFileToLocal(
          dataUrlToBlob(dataUrl, 'image/png'),
          UPLOAD_DIRS.faceMosaic,
        );
        // 【2026-09-17】落盘失败 → 保留内联 dataURL（真兜底，不丢图），但**原因要可见**
        //（原来 `|| dataUrl` ＋ 下面的**空 catch** 双重静默）。
        if (!up.ok) toastWarning(`结果未落盘（${up.message}），已保留内联图`);
        const target = up.ok ? up.url : dataUrl;
        outputResults([{ url: target, label: '手动打码' }]);
        setResultInfo({ count: 1, faceTotal: 0 });
        setResultUrls([target]);
      } catch (e) {
        // 【2026-09-17】原为空 `catch {}` —— 失败连日志都没有。现留痕（开发者）+ 提示（用户）。
        const msg = (e as { message?: string })?.message || '处理失败';
        logger.warn('FaceMosaicNode', '手动打码结果落盘前置失败', { message: msg });
        toastWarning(`手动打码结果未落盘（${msg}），已保留内联图`);
        outputResults([{ url: dataUrl, label: '手动打码' }]);
        setResultInfo({ count: 1, faceTotal: 0 });
        setResultUrls([dataUrl]);
      }
      setLoading(false);
    },
    [outputResults], // id 在函数体内未使用
  );

  const count = assetUrls().length;

  const toolbarButtons: never[] = [];

  return (
    <NodeShell
      id={id}
      label={data.label}
      defaultTitle="人脸打码"
      icon={<Shuffle size={11} className="text-muted" />}
      selected={selected}
      handleVariant="small"
      aspectRatio={undefined}
      className="min-w-[320px] min-h-[250px]"
      onRename={rename}
    >
      <HoverToolbar buttons={toolbarButtons} />

      <div className="flex-1 p-3 flex flex-col gap-2.5 nowheel">
        {/* 图片源状态 + 输入图预览（连接后立即可见，避免「图片消失」） */}
        {count === 0 ? (
          <div className="nodrag flex flex-col items-center justify-center gap-1.5 py-3 rounded-lg border border-dashed border-edge-raised text-muted">
            <span className="text-[11px]">左侧连接图片节点以导入</span>
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            <div className="text-[11px] text-secondary">
              已连接 <span className="text-blue-400">{count}</span> 张图片
            </div>
            {/* 输入图缩略图：连接的图片立即在此显示 */}
            <div className="grid grid-cols-4 gap-1.5">
              {assetUrls().map((u, i) => (
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
            onClick={() => {
              if (count === 0) {
                toastWarning('请先连接图片节点');
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
      {manualOpen && assetUrls()[0] && (
        <FaceMosaicEditor
          assetUrl={assetUrls()[0]}
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
