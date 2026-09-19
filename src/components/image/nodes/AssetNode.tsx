import React, { useState, useRef, useCallback } from 'react';
import { logger } from '@/components/base/core/logger';
import {
  Image as ImageIcon,
  ImageOff,
  Video,
  Music,
  FileText,
  Plus,
  Send,
  Download,
  Camera,
  Layers,
} from 'lucide-react';
import { useReactFlow } from '@xyflow/react';
import NodeShell from '@/components/base/ui/NodeShell';
import HoverToolbar from '@/components/canvas/HoverToolbar';
import ImageZoomDialog from '@/components/base/ui/ImageZoomDialog';
import VideoThumbnail from '@/components/base/ui/VideoThumbnail';
import { replaceNodeImage } from '@/components/canvas/nodeImage';
import { detectAssetType, detectFileType } from '@/components/base/utils/assetType';
import { fileNameFromUrl } from '@/components/base/core/utils';
import { assetTypeLabel, type AssetType } from '@/types';
import { useAssetDegrade } from '@/hooks/useAssetDegrade';
import { NODE_AREA_FIXED_BASE_SIZE } from '@/components/base/core/config';
import { useVideoPoster } from '@/hooks/useVideoPoster';
import { useNodeRename } from '@/hooks/useNodeRename';
import { patchNodeDataById } from '@/hooks/useNodeData';
import { toAbsoluteFileUrl, resolveNodeAssetUrl } from '@/components/base/api/index';
import { UPLOAD_DIRS } from '@/components/base/utils/uploadDirs';
import { resolveAssetDisplayUrl, buildContentUrlResolver } from '@/components/base/utils/assetUrl';
import { useImageFallbackSrc } from '@/components/base/utils/useImageFallbackSrc';
import { useImageHoverActions } from '@/components/image/useImageHoverActions';
import { downloadUrl } from '@/components/base/utils/clipboard';
import { showToast, toastError } from '@/components/base/core/toastStore';
import { sendToResourceLibrary, getResources } from '@/components/resource/resourceStore';
import { openResourceLibrary } from '@/components/base/store/taskStore';
import { CameraStudioPanel } from '@/components/editors';
import type { CameraStudioResult } from '@/components/editors';
import { useCanvasEdges } from '@/components/canvas/CanvasEdgesContext';
import { DepthVideoModal, spawnDepthVideoNode } from '@/components/video';

import { commitNewNodes } from '@/components/canvas/deriveNodes';
import { injectNodePrefs } from '@/components/canvas/nodePrefs';
import { generateId } from '@/components/base/core/idGen';

/**
 * 素材节点
 * 支持 image / video / audio / text / empty 五种内容态（类型用 detectAssetType 统一判断）。
 * 已迁移到 NodeShell 基座（外壳 + 端口 + 尺寸管理统一）。
 *
 * hover 工具栏「裁剪」「编辑(标记)」→ 打开全屏 ImageEditor：
 *  - 裁剪 = initialTool='crop'
 *  - 编辑 = initialTool='pencil'
 * 保存后把 canvas dataURL 写回 data.assetUrl（useReactFlow setNodes 不可变更新）。
 *
 * 通用能力抽到 base/：useAssetDegrade（性能降级），宽高比自适应走 NodeShell 的 useSizeSync（area-fixed），
 * useVideoPoster（视频首帧封面）、detectAssetType（类型判断）。
 */
interface AssetNodeData {
  label?: string;
  assetUrl?: string;
  url?: string;
  /** docs/122 #4：文件型持稳定 contentId（sha1:<hex>，与后端同源）；内联 dataURL/blob 无此字段 */
  contentId?: string;
  assetType?: AssetType;
  demoImage?: string;
  text?: string;
}
interface AssetNodeProps {
  id: string;
  data: AssetNodeData;
  selected?: boolean;
}
function AssetNode({ id, data, selected }: AssetNodeProps) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  // 【docs/122 #4/#5】渲染解析统一入口（resolveAssetDisplayUrl）：文件型持稳定 contentId →
  // 经 resourceStore 解析 url（resource 行改名/移动只改 context，contentId→url 自动跟随，永不破图）；
  // 内联 dataURL/blob 持 url 直用；存量 assetUrl 兼容兜底。资源查无 → 显式「素材已移除」缺失态
  //（fail-loud：边界契约失效，UI 呈现，不静默破图）。
  const assetRef = resolveAssetDisplayUrl(data, buildContentUrlResolver(getResources()));
  // 读取端兜底：相对 /files/ 路径统一补全为绝对 URL，刷新不破图。
  const url = (assetRef.kind === 'ok' ? toAbsoluteFileUrl(assetRef.url) : '') || '';
  const assetMissing = assetRef.kind === 'missing';
  const { setNodes, getNodes, getNode, getEdges, setEdges } = useReactFlow();
  const [isCameraStudioOpen, setIsCameraStudioOpen] = useState(false);
  // 深度转视频弹窗开关 + 画布历史（undo）：供 spawnDepthVideoNode 原子提交，复用 VideoGenerate 范式
  const [depthOpen, setDepthOpen] = useState(false);
  const history = useCanvasEdges();

  // 查看大图：原生 <dialog> 弹层（双击图片 → showModal，点图/Esc 关闭，无外框/标题栏）。
  const dialogRef = useRef<HTMLDialogElement | null>(null);

  // 内容类型：优先显式 data.assetType（blob: 等无扩展名/前缀的 URL 无法靠字符串判断，
  // 由产出方明确标注，如视频处理节点的 audio/video 输出），否则统一走 detectAssetType
  const type = data.assetType || detectAssetType(url);

  // 性能模式媒体降级（hideMedia：'image' / 'image video audio' / ''，见 useAssetDegrade）
  const { hideMedia } = useAssetDegrade();

  // 节点按媒体真实宽高比自适应：area-fixed 模式下，媒体加载/裁剪后把比例交给 useSizeSync
  // 锁定面积（与 ImageGenerate / VideoGenerate 统一的面积恒定模型），形状跟随媒体比例。
  const [mediaRatio, setMediaRatio] = useState<string | null>(null);

  // 图片两段回退（契约另一半在后端 `handleThumbnail`：缩略图失败是显式 4xx/5xx，
  // 由前端 <img onError> 回退原图 —— 后端注释承诺已久，此前 AssetNode 侧从未实现，
  // 于是缩略图端点失败（如源格式 Jimp 不可编码 / 缩放失败）只表现为浏览器裂图，失败不可见）。
  //  thumb → renderUrl（本地文件走按需小图）；失败 → original（原图 url，浏览器多能直接显示）；
  //  原图再失败 → failed（显式破图占位，与 LazyImage 同一失败可见性，不静默裂图）。
  // 图片显示地址 + 两段失败回退（小图 → 原图 → 显式占位）走**唯一实现** useImageFallbackSrc，
  // 与 LazyImage / 助手气泡共用同一策略（此前本节点自持一份，导致同一故障在不同出口表现不一致）。
  const { src: imgSrc, failed: imgFailed, onError: onImgError } = useImageFallbackSrc(url);
  const applyMediaRatio = useCallback((w: number, h: number) => {
    if (w && h) setMediaRatio(`${w}:${h}`);
  }, []);

  // 视频首帧封面（未播放时显示首帧，避免视频 URL 当 img 破图）
  const posterUrl = useVideoPoster(url, type === 'video');

  // 编辑器/压缩/裁剪保存 → 写回节点图片。
  // ★ 唯一写入口 replaceNodeImage（docs/118 §五 C5b）：字段写入收口；尺寸模型仍留在本节点
  //   （AssetNode 用 mediaRatio `${w}:${h}`，与 ImageGenerate 的 fitByRatio 模型不同，不硬合并）。
  // dims 为可选画布真实尺寸（扩图/裁剪后画布尺寸变化），传入则按真实比例自适应节点形状，
  // 避免缩略图端点压到最长边 640 后吞掉等比外扩带来的比例变化（扩图后节点比例不变的问题）。
  const replaceImage = useCallback(
    (dataUrl: string, dims?: { width: number; height: number }) => {
      if (!dataUrl) return;
      replaceNodeImage({ id, dataUrl, dims }, setNodes, (d) => {
        if (d?.width && d?.height) setMediaRatio(`${d.width}:${d.height}`);
      });
    },
    [id, setNodes],
  );

  // 共享图片 hover 能力（裁剪/标记/压缩）：写回走 replaceImage
  const {
    editor: _editor,
    setEditor: _setEditor,
    renderEditor,
    renderInlineCropper,
    imageButtons,
  } = useImageHoverActions({
    id,
    url,
    hasImage: type === 'image',
    label: data.label ?? '',
    onImageReplaced: replaceImage,
  });

  // 下载当前内容（图片/视频/音频/文本共用）。用 <a download> 触发浏览器保存，
  // 文件名优先用节点 label，其次是 URL 里的文件名；无扩展名时按类型补扩展名。
  const handleDownload = useCallback(() => {
    if (!url) return;
    const extMap: Partial<Record<AssetType, string>> = {
      image: 'png',
      video: 'mp4',
      audio: 'm4a',
      text: 'txt',
    };
    let filename = data.label || '';
    // TD-16-14：URL→文件名统一走 core/utils 唯一原语（URL 解析剥 ?# + decode 一次）
    const fromUrl = fileNameFromUrl(url);
    if (fromUrl && !/^blob:|^data:/.test(url)) filename = filename || fromUrl;
    const ext =
      (filename.match(/\.[a-z0-9]{2,5}$/i) || [])[0] ||
      (type !== 'image' ? `.${extMap[type] || 'bin'}` : '');
    if (filename && !ext) filename += ext;
    if (!filename) filename = `image-${type || 'content'}${ext || '.png'}`;
    downloadUrl(url, filename);
  }, [url, data.label, type]);

  // 「上传/替换」真正读取所选文件（修复：此前 fileRef input 无 onChange，选完不读 → 上传按钮失效）。
  // 图片/视频/音频：优先上传 localTool 成 /files/ 持久 URL（刷新不丢），失败回退 dataURL 内联（仍可显示，靠 base64 外置兜底）。
  // 文本文件：读文本写回 data.text，节点切到文本态。
  // 标题改名 → 写回 data.label（下游 @名 匹配 / 素材条显示跟随），单一实现收口到 useNodeRename
  const rename = useNodeRename(id);

  // 摄影棚生成回调：创建新 ImageGenerate，用户手动触发生成
  const handleCameraStudioGenerate = useCallback(
    (result: CameraStudioResult) => {
      const sourceNode = getNodes().find((n) => n.id === id);
      if (!sourceNode) return;

      const { mode, prompt } = result;
      const modeLabel =
        mode === 'camera' ? '摄影机视角' : mode === 'lighting' ? '摄影棚打光' : '视角与打光';

      const newNodeId = generateId();
      // 新节点位置：右下偏移，避免重叠
      const newPos = {
        x: sourceNode.position.x + 340,
        y: sourceNode.position.y + 300,
      };

      // 【同步默认参数】摄像机新建节点绕过 App.addNode，需手动注入上次记忆的参数
      // （模型/比例/尺寸），否则新 imageGenerateNode 会落到纯常量默认（Auto/1K/空模型），
      // 与手动新建的生图节点默认不一致（记忆只影响新建，不污染存量）。
      const nodeData: Record<string, unknown> = {
        type: 'imageGenerateNode',
        label: modeLabel,
        prompt: prompt,
        role: 'generator',
        status: 'idle',
        promptState: 'completed',
      };
      injectNodePrefs('imageGenerateNode', nodeData);

      const newNode = {
        id: newNodeId,
        type: 'imageGenerateNode',
        position: newPos,
        data: nodeData,
      };

      const newEdge = {
        id: `e-${id}-${newNodeId}`,
        source: id,
        target: newNodeId,
      };

      // TD-04-2：自建子节点统一走 commitNewNodes（补结构默认 width/height/style + 原子写 + 进 undo 栈）。
      // 原裸 addNodes/addEdges 不补结构默认（手写 420 与 nodeDefaults 漂移）、不进 history（Ctrl+Z 撤不掉）。
      commitNewNodes(
        { nodes: [newNode], edges: [newEdge] },
        { getNodes, getEdges, setNodes, setEdges, history: history ?? undefined },
      );
      setIsCameraStudioOpen(false);
    },
    [id, getNodes, getEdges, setNodes, setEdges, history],
  );
  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0];
      e.target.value = '';
      if (!f) return;
      // 判型唯一入口（TD-16-20 收口）：此前 `f.type.startsWith('text/') || detectAssetType(f.name)==='text'`
      // 是 detectFileType 的手抄（mime 优先 + 扩展名兜底），现走单源。
      if (detectFileType(f) === 'text') {
        const fr = new FileReader();
        fr.onload = () => {
          patchNodeDataById(setNodes, id, {
            text: fr.result,
            assetType: 'text',
            // 切文本态 = 清空主图（assetUrl 为主、url 为存量兼容字段）：
            // 这里写 undefined 是【清空】不是【写值】，两者都必须清，否则渲染端
            // `assetUrl || url` 会从 url 兜底读回旧图 → 文本态节点显示旧图。
            assetUrl: undefined,
            url: undefined,
          });
          // 节点已切到文本态，结果可见，无需 toast
        };
        fr.readAsText(f);
        return;
      }
      // 图片/视频/音频：统一落盘策略（File 直传 → 落盘失败内联兜底 → 连内联都拿不到才提示），
      // 唯一实现见 filesApi.resolveNodeAssetUrl；assetType 交由 detectAssetType 由 URL 判断。
      const up = await resolveNodeAssetUrl(f, UPLOAD_DIRS.canvasDrop, f.name);
      // 【2026-09-17 消费者只转发】带上**生产者判词**（如"落盘失败（xxx），且读不出内联数据"）——
      // 原来只有笼统一句"上传失败"。
      if (!up.ok) {
        toastError(`上传失败：${up.message}`);
        return;
      }
      const url = up.url;
      // 「上传替换节点内容」也收口到唯一写入口：主图走 replaceNodeImage，`assetType/text` 置空
      // （交回 detectAssetType 按新 URL 判定）。此前这里是第三处直写 assetUrl/url 的地方（docs/118 §7.3 ⑤）。
      // docs/122 #4：持久文件 → 同时落稳定 contentId（sha1:<hex>）；内联 dataURL 无 contentId。
      // 【TD-08-28 收口】contentId **由落盘权威（后端）产出并随 `UploadOutcome` 回传** ⇒ 消费者只转发。
      // 原实现在此处 `contentIdOfBytes(f)` 再算一遍：同一身份两份计算（后端 sha1(字节) 与本处必须永远相等，
      // 一旦算法/编码差一点就漂移成两个身份），且白读一遍文件字节。
      const contentId = up.contentId;
      replaceNodeImage(
        {
          id,
          dataUrl: url,
          dataPatch: {
            assetType: undefined,
            text: undefined,
            ...(contentId ? { contentId } : {}),
          },
        },
        setNodes,
      );
      // 节点已显示新图，结果可见，无需 toast
    },
    [id, setNodes],
  );

  // 显示名取自资产类型目录（`assetTypeLabel`）；非内容状态（other/empty）沿用历史回退「图片」
  const defaultTitle = assetTypeLabel(type, '图片');
  const titleIcon =
    type === 'video' ? (
      <Video size={11} />
    ) : type === 'audio' ? (
      <Music size={11} />
    ) : type === 'text' ? (
      <FileText size={11} />
    ) : (
      <ImageIcon size={11} />
    );
  // 画布内显示地址由 useImageFallbackSrc 给出（本地 /files/ → 按需小图，治全分辨率解码卡顿；
  // 外部 http/data/blob → 原图），失败回退策略与 LazyImage 同一出处；缩放弹层与发送仍用原图 `url`。

  // hover 操作栏按钮：图片类共享能力(crop/edit/compress)走 useImageHoverActions，
  // upload/send/download 按本节点多类型语义各自声明。
  const toolbarButtons = [
    {
      key: 'upload',
      icon: <Plus size={14} />,
      title: '上传/替换',
      onClick: () => fileRef.current?.click(),
    },
    {
      key: 'cameraStudio',
      icon: <Camera size={14} />,
      title: '摄影棚',
      show: type === 'image',
      onClick: () => setIsCameraStudioOpen(true),
    },
    {
      key: 'depth',
      icon: <Layers size={14} />,
      title: '转深度视频',
      hoverClass: 'hover:text-sky-400',
      show: type === 'video' && !!url,
      onClick: () => setDepthOpen(true),
    },
    ...imageButtons,
    {
      key: 'send',
      icon: <Send size={14} />,
      title: '发送到素材库',
      hoverClass: 'hover:text-blue-400',
      // 【用户裁定 2026-09-18】**文本 / 视频不提供**「发送到素材库」；图片保留。
      //   · 文本那半本来就是**假入口**：按钮对 text 也显示，但文本内联无 `url`
      //     ⇒ 点了一律走下面的 `if (!url)` 弹「没有可发送的素材」，原 `type:'text'` 分支永远执行不到（已删）。
      //   · 视频那半：视频不提供该能力（与 VideoGenerate 一致 —— 那里也不加此按钮）。
      //   · 音频：用户未点名，**保守保留**（素材库语义本就含"用户自放的可复用音频"）。
      show: type === 'image' || type === 'audio',
      onClick: () => {
        if (!url) {
          toastError('没有可发送的素材');
          return;
        }
        const name = (data.label && String(data.label).trim()) || '';
        openResourceLibrary();
        // 【TD-12-10】成功 toast 必须等落盘完成（唯一知道真相的那层）再弹：
        // 此前在发起处同步宣告成功 → 落盘失败也显示「已发送」，用户只见成功、库里无物、零报错。
        // type 恒为 'image'（上方 show 已把入口限定在图片资产）⇒ 不再需要运行时判别。
        void sendToResourceLibrary(url, { name, type: 'image' }).then((outcome) => {
          if (outcome.ok) showToast('已发送到素材库', { type: 'success' });
          else showToast('发送到素材库失败，请稍后重试', { type: 'error' });
        });
      },
    },
    {
      key: 'download',
      icon: <Download size={14} />,
      title: '下载',
      onClick: handleDownload,
      show: !!url,
    },
  ];

  return (
    <>
      <NodeShell
        id={id}
        label={data.label}
        defaultTitle={defaultTitle}
        icon={titleIcon}
        selected={selected}
        handleVariant="small"
        sourceHandleId="main-output"
        aspectRatio={mediaRatio ?? undefined}
        sizeMode="area-fixed"
        baseSize={NODE_AREA_FIXED_BASE_SIZE}
        onRename={rename}
        minWidth={120}
        minHeight={80}
        className="min-w-[120px] min-h-[80px]"
      >
        <HoverToolbar buttons={toolbarButtons} />

        <input
          type="file"
          ref={fileRef}
          style={{ display: 'none' }}
          accept="image/*,video/*,audio/*,text/plain"
          multiple
          onChange={handleFileSelect}
        />

        {/* 就地裁剪浮层：挂在「主框层级」（与主容器同级），absolute inset-0 覆盖整个节点内容区，
          取消/裁剪按钮栏 top-full 以「主框底边 = 节点底边」为基准，稳定落在节点正下方、
          不与节点本体重叠（此前挂在主容器 relative 子容器内，某些状态下主容器高度≠主框，
          按钮栏会压到节点上）。详见 InlineImageCropper。 */}
        {renderInlineCropper()}

        {/* 主容器：背景/边框/阴影已由 NodeShell 主容器提供，这里只保留布局。
          relative 必须保留——内部空态/播放图标是 absolute inset-0 定位，依赖本容器做定位上下文 */}
        <div className="relative w-full flex flex-col flex-1">
          <div
            className="flex-1 p-0 bg-surface-strong flex items-center justify-center relative overflow-hidden rounded-xl"
            style={{ minHeight: 160 }}
          >
            {/* 性能模式媒体降级：缩小时隐藏图片/视频/音频（复刻官方"图片视频已隐藏"） */}
            {hideMedia && (
              <div className="absolute inset-0 flex items-center justify-center bg-surface-strong">
                <div className="flex flex-col items-center gap-1 opacity-60">
                  <ImageIcon size={18} className="text-muted-2" />
                  <span className="text-meta text-muted">性能模式已隐藏</span>
                </div>
              </div>
            )}
            {/* 素材已移除：引用的 resource 已删（fail-loud，docs/122 #5）。显式呈现缺失态，不静默破图 */}
            {assetMissing && (
              <div className="absolute inset-0 flex items-center justify-center bg-surface-strong">
                <div className="flex flex-col items-center gap-1 opacity-70">
                  <ImageIcon size={18} className="text-muted-2" />
                  <span className="text-caption text-muted">素材已移除</span>
                </div>
              </div>
            )}
            {/* 图片（onLoad 按实际比例自适应节点形状；双击查看大图，复刻官方 onDoubleClick→onZoom）。
              onError 两段回退见 imgStage —— 缩略图端点失败不再等于「用户看到裂图」。 */}
            {type === 'image' && !hideMedia.includes('image') && imgSrc && !imgFailed && (
              <img
                src={imgSrc}
                alt="Content"
                loading="lazy"
                decoding="async"
                onLoad={(e) =>
                  applyMediaRatio(e.currentTarget.naturalWidth, e.currentTarget.naturalHeight)
                }
                onError={onImgError}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  dialogRef.current?.showModal();
                }}
                className="w-full h-full object-cover cursor-pointer"
                draggable={false}
              />
            )}
            {/* 图片加载失败（缩略图与原图都失败）→ 显式占位，替代浏览器默认裂图（失败可见） */}
            {type === 'image' && imgFailed && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-surface-strong">
                <ImageOff size={20} className="text-muted-2" />
                <span className="text-caption-sm text-muted">图片加载失败</span>
              </div>
            )}
            {/* 视频：统一 VideoThumbnail 组件（与视频生成节点一致）。
              封面用抓取的 posterUrl（首帧 dataURL）；playable 开启节点内 controls 播放态；
              onLoadedMetadata 按视频宽高自适应节点形状（area-fixed 锁面积）；
              双击容器打开自定义大图弹窗（含截屏/下载当前帧按钮）。 */}
            {type === 'video' && !hideMedia.includes('video') && (
              <VideoThumbnail
                src={url}
                poster={posterUrl}
                fit="cover"
                size="lg"
                playable
                onLoadedMetadata={(e) =>
                  applyMediaRatio(e.currentTarget.videoWidth, e.currentTarget.videoHeight)
                }
                onContainerDoubleClick={() => dialogRef.current?.showModal()}
              />
            )}
            {/* 音频 */}
            {type === 'audio' && !hideMedia.includes('audio') && (
              <div className="w-full h-full flex flex-col items-center justify-center bg-surface p-2 gap-2">
                <Music size={24} className="text-blue-500 mb-2" />
                {/* 【2026-09-17 TD-16-29②】原来是**裸 `<audio>`（无 onError）**：音频文件缺失/4xx 时
                    控件照常渲染但按了没声、无任何提示（与"文件好好的"不可区分）。
                    音频无法走 LazyImage（那是图片组件）⇒ 就近补 onError 显式失败态，
                    与同文件图片的 `onImgError` / 视频的 VideoThumbnail 保持一致。 */}
                <audio
                  src={url}
                  controls
                  className="w-full max-w-[200px] h-8"
                  onError={(e) => {
                    e.stopPropagation();
                    logger.warn('AssetNode', '音频素材加载失败', { id, url });
                  }}
                />
              </div>
            )}
            {/* 文本文件 */}
            {type === 'text' && (
              <div className="w-full h-full flex flex-col items-center justify-center bg-surface p-2">
                <FileText size={24} className="text-secondary mb-2" />
                <span className="text-caption text-muted">文本/数据文件</span>
              </div>
            )}
            {/* 空态。
              【2026-09-17 TD-16-29①】原判据只有 `type === 'empty'`：当引用的 resource 已删（`assetMissing`）
              且解析后 url 为空时，`detectAssetType('')` 同样返回 'empty' ⇒ **两态同时成立**；
              而本块 DOM 在缺失态**之后**且带底色 ⇒ **空态盖住缺失态**，用户看到"上传空框"而非
              "素材已移除" —— fail-loud 的缺失态（docs/122 #5）被同屏空态吃掉。
              两态声明**互斥**：缺失态优先（用户在"上传新图"与"这张图已被移除"之间必须看到后者）。 */}
            {type === 'empty' && !assetMissing && (
              <div
                className="flex flex-col items-center justify-center absolute inset-0 bg-surface-muted hover:bg-surface transition-colors cursor-pointer group"
                onClick={(e) => {
                  e.stopPropagation();
                  fileRef.current?.click();
                }}
              >
                <div className="w-12 h-12 rounded-xl bg-surface-1 border border-dashed border-edge-muted group-hover:border-blue-500/50 flex flex-col items-center justify-center transition-all">
                  <ImageIcon
                    size={20}
                    className="text-muted-2 group-hover:text-blue-500/80 transition-colors"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </NodeShell>

      {/* 全屏图片编辑器（裁剪/标记入口）：用当前显示图作为编辑源 */}
      {/* 图片编辑器（裁剪/标记）：统一机制渲染，editor 关闭时返回 null */}
      {renderEditor()}

      {/* 查看大图：共享 ImageZoomDialog。
        图片→kind="image" 看海报/大图；视频→kind="video" 统一走视频播放预览（含截屏按钮） */}
      <ImageZoomDialog ref={dialogRef} url={url} kind={type === 'video' ? 'video' : 'image'} />

      {/* 深度转视频弹窗：视频态可转，产出落盘后 spawn 下游深度视频节点（链式） */}
      {depthOpen && type === 'video' && url && (
        <DepthVideoModal
          videoUrl={url}
          name={data.label || fileNameFromUrl(url) || '视频'}
          onClose={() => setDepthOpen(false)}
          onSave={(outUrl, outName) => {
            spawnDepthVideoNode(id, outUrl, outName, {
              getNode: (nid: string) => getNode(nid) ?? null,
              getNodes,
              getEdges,
              setNodes,
              setEdges,
              history: history ?? undefined,
            });
            setDepthOpen(false);
          }}
        />
      )}

      {/* 摄影棚面板 */}
      <CameraStudioPanel
        isOpen={isCameraStudioOpen}
        assetUrl={type === 'image' ? url : undefined}
        onClose={() => setIsCameraStudioOpen(false)}
        onGenerate={handleCameraStudioGenerate}
      />
    </>
  );
}
export default React.memo(AssetNode);
