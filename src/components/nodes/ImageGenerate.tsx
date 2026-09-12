import React, { useState, useRef, useCallback, useMemo } from 'react';
import { useReactFlow } from '@xyflow/react';
import {
  Image as ImageIcon,
  Plus,
  ZoomIn,
  Send,
  Download,
  AlertCircle,
  Camera,
} from 'lucide-react';
import NodeShell from '../base/ui/NodeShell.tsx';
import HoverToolbar from '../base/panels/HoverToolbar.tsx';
import ExpandablePanel from '../base/ui/ExpandablePanel.tsx';
import GenerateButton from '../base/ui/GenerateButton.tsx';
import ModelSelect from '../base/ui/ModelSelect.tsx';
import PromptInput from '../base/prompt/PromptInput.tsx';
import ResourceStrip from '../base/panels/ResourceStrip.tsx';
import ResizeFullscreenHandle from '../base/ui/ResizeFullscreenHandle.tsx';
import FullscreenEditor from '../base/panels/FullscreenEditor.tsx';
import GeneratingOverlay from '../base/ui/GeneratingOverlay.tsx';
import { NODE_AREA_FIXED_BASE_SIZE } from '../base/core/config.ts';
import ImageZoomDialog from '../base/editors/ImageZoomDialog.tsx';
import '../base/editors/ImageEditor.tsx';
import { useImageHoverActions } from './useImageHoverActions.tsx';
import { replaceNodeImage } from '../base/nodeImage.ts';
import { useNodeData } from '../../hooks/useNodeData.ts';
import { useDisconnectSource } from '../../hooks/useDisconnectSource.ts';
import { useNodeRename } from '../../hooks/useNodeRename.ts';
import { useNodeExpanded } from '../../hooks/useNodeExpanded.ts';
import { useNodeField } from '../../hooks/useNodeField.ts';
import PromptLibraryButton from '../base/prompt/PromptLibraryButton.tsx';
import { downloadUrl, resolveDownloadFilename } from '../base/utils/clipboard.ts';
import JianyingIcon from '../base/ui/JianyingIcon.tsx';
import { showToast, toastError } from '../base/core/toastStore.ts';
import { sendToResourceLibrary } from '../base/store/resourceStore.ts';
import { openResourceLibrary } from '../base/store/taskStore.ts';
import { useNodeResize, useOutsideClick } from '../base/core/uiHooks.ts';
import { useConnectedInputs } from '../../hooks/useConnectedInputs.ts';
import { useAssetDegrade } from '../../hooks/useAssetDegrade.ts';
import { useGenerateNode } from '../../hooks/useGenerateNode.ts';
import { useFitNodeRatio } from '../../hooks/useFitNodeRatio.ts';
import '../base/api/index.ts';
import { logger } from '../base/core/logger.ts';
import { fetchTasks, generateImage, resolveNodeAssetUrl } from '../base/api/index.ts';
import { useNodePrefs, injectNodePrefs } from '../base/canvas/nodePrefs.ts';
import { commitNewNodes } from '../base/canvas/deriveNodes.ts';
import { useCanvasEdges } from '../base/canvas/CanvasEdgesContext.tsx';
import { useRenderAssetResolver } from '../base/utils/assetUrl.ts';
import { resolveProviderModel } from '../base/utils/providerModels.ts';
import { mergeRefImages, buildEffectivePrompt } from '../base/core/utils.ts';
import { resolvePromptChips } from '../base/prompt/promptChips.ts';
import CameraStudioPanel from '../base/editors/CameraStudioPanel.tsx';
import CameraSettingsSelector from '../base/editors/cameraParams/CameraSettingsSelector.tsx';
import { applyCameraSettingsToPrompt } from '../base/editors/cameraParams/cameraPrompt.ts';
import type { CameraGenerationSettings } from '../base/editors/cameraParams/types.ts';
import { generateId } from '../base/core/idGen.ts';
import { UPLOAD_DIRS } from '../base/utils/uploadDirs.ts';
import type { CameraStudioResult } from '../base/editors/cameraStudio.ts';

/**
 * 生图节点（复刻原 bo.jsx / imageGenerateNode）
 * 已迁移到基座：NodeShell + HoverToolbar + ExpandablePanel + PromptInput + GenerateButton + ModelSelect。
 * 保留差异化：主图片框、素材缩略图区、画质/比例/渲染质量菜单、请求格式、批量 xN。
 * 性能降级用通用 useAssetDegrade：lodLevel>=2 藏生图结果（与官方横幅"图片已隐藏"一致）。
 */
/** 参考图素材形态（ResourceStrip / PromptInput / generateImage 共用） */
interface RefImage {
  id: string;
  url: string;
  label?: string;
  sourceNodeId?: string;
}

/** 参考文本形态（resolvePromptChips 要求 id/label 必填） */
interface RefText {
  id: string;
  label: string;
  text?: string;
  sourceNodeId?: string;
}

/** 生图节点 data 契约 */
interface ImageGenerateData {
  label?: string;
  prompt?: string;
  assetUrl?: string;
  aspectRatio?: string;
  imageSize?: string;
  quality?: string;
  selectedModel?: string;
  count?: number;
  expanded?: boolean;
  inputWidth?: number;
  inputHeight?: number;
  images?: RefImage[];
  texts?: RefText[];
  /** 摄影参数（焦距/快门效果/光圈/曝光时间）；缺省 = 全自动，不写入提示词 */
  cameraSettings?: CameraGenerationSettings;
}

/** 上游产出（来自 useConnectedInputs）的共享返回类型真相源：src/hooks/useConnectedInputs.ts NodeOutputGroup。
 *  不在此处重复声明 ConnectedOutput，避免与 hook 返回类型漂移（防假收窄）。 */

interface ImageGenerateProps {
  id: string;
  data: ImageGenerateData;
  selected?: boolean;
}

function ImageGenerate({ id, data, selected }: ImageGenerateProps) {
  const render = useRenderAssetResolver();
  // 性能模式媒体降级（通用 hook）：hideResult = isHidden('image')，即 lodLevel>=2
  const { isHidden } = useAssetDegrade();
  const hideResult = isHidden('image');

  // 通用连线数据传递：读取直接上游节点的产出（图片/文本）作为参考输入
  const connected = useConnectedInputs(id);
  // 抽屉展开/收起：本地 state + 写回 data.expanded + 外部（Tab/Agent）同步，收口到 useNodeExpanded
  const { expanded, toggleExpanded } = useNodeExpanded(id, data.expanded);
  // 提示词落盘 + 其它 data 字段写回唯一入口（本地 state → node.data；卸载 flush 由 useNodeData 承接）
  const { patchData, patchDebounced } = useNodeData(id);
  const [prompt, setPrompt] = useNodeField('prompt', data.prompt || '', patchDebounced);

  // 参考输入 = 连线上游的产出（useConnectedInputs）+ 自身 data.images/texts。
  // 为什么合并两处：useConnectedInputs 是「通用连线机制」（任意上游节点 → 本节点）；
  // data.images 是剧本盒子连下游时用 collectAssets 按 @资产名 匹配后塞给本节点的资产参考图（更精准）。
  // 上游为空 + data 无图 → 两者都空 → 素材区隐藏，绝不显示假示例。
  // 【必须放在 prompt 定义之后、useNodeGeneration 之前】否则其 config 闭包首帧访问会触发 TDZ。
  // 【memo 优化】用 useMemo 稳定 refImages/refTexts 引用：否则每次 render 新建数组，传给 memo 子组件
  // （ResourceStrip/PromptInput）会失效导致每次重渲染。依赖用 connected.*/data.* 引用而非整对象，
  // 上游/自身数据未变时引用稳定。
  const refImages = useMemo(
    // 合并「连线上游产出」+「剧本盒等塞给本节点的 data.images」时，可能同一批资产图
    // 走了两条路重复进入（同 id，如 script-asset-xxx），mergeRefImages 按 id 去重避免渲染 key 重复。
    () => mergeRefImages(connected.images, data.images),
    [connected.images, data.images],
  );
  const refTexts = useMemo(
    () => [...(connected.texts || []), ...(data.texts?.length ? data.texts : [])],
    [connected.texts, data.texts],
  );

  // 【修复】上游文本节点连进来时，文字只进入 refTexts（素材区），不会被自动填进 prompt。
  // 构造「有效提示词」= 本地 prompt + 上游文本 合并：两者都参与生成，
  // 本地写的主提示词在前，上游文本节点/资产文字追加在后，一起送进生图请求。
  // 多个上游文本节点自动合并；多个上游图片节点也已在 refImages 中合并。
  const effectivePrompt = buildEffectivePrompt(prompt, refTexts);
  // 【富文本芯片解析】prompt 里可能含 `@{id:label}` 素材芯片（图片 → 参考图，文本 → 纯文本）。
  // 生成前统一解析：chipResolved.text 是发给 AI 的纯文本；chipResolved.refImages 是用户显式 @ 的参考图
  // （其顺序对应 text 里的「图片N」序号）。memo 稳定引用，避免每次 render 重算。
  const chipResolved = useMemo(
    () => resolvePromptChips(effectivePrompt, refImages, refTexts),
    [effectivePrompt, refImages, refTexts],
  );
  // 提示词输入框双击全屏编辑（复刻 TextGenerate 的交互：ResizeFullscreenHandle 双击 → 弹层）
  const [fullscreenPrompt, setFullscreenPrompt] = useState(false);
  // 记住上次选择的比例/尺寸/模型（跨节点/跨会话）；初始用记忆值，无记忆回退默认
  const { prefs: imgPrefs, set: setImgPrefs } = useNodePrefs('imageGenerateNode', {
    model: '',
    aspectRatio: 'Auto',
    imageSize: '1K',
  });
  // ⚠️【记忆只影响新建，不污染存量】组件初始化只读 data，缺字段用纯常量默认，
  // 绝不读记忆(imgPrefs)做回退——记忆已在新建入口 App.addNode 注入新节点 data。
  // 这样已挂载/快照还原的存量节点不会被记忆反向改写（见 nodePrefs.js 注释）。
  const [aspectRatio, setAspectRatio] = useState(data.aspectRatio ?? 'Auto');
  const [imageSize, setImageSize] = useState(data.imageSize ?? '1K');
  const [quality, setQuality] = useState(data.quality ?? 'auto');
  const [selectedModel, setSelectedModel] = useState(data.selectedModel ?? '');
  // 摄影参数（焦距/快门效果/光圈/曝光时间）：与 data.cameraSettings 同步，生成时拼进提示词
  const [cameraSettings, setCameraSettings] = useState<CameraGenerationSettings | undefined>(
    data.cameraSettings,
  );
  const [count, setCount] = useState(data.count || 1);
  const [assetUrl, setAssetUrl] = useState(data.assetUrl || '');
  const [showImgMenu, setShowImgMenu] = useState(false);
  const [showCountMenu, setShowCountMenu] = useState(false);
  const mainImgRef = useRef<HTMLImageElement | null>(null);
  // 编辑保存（裁剪/扩图）刚用 dims 的 fitByRatio 设过节点框时的标记：防「切 Auto」useEffect
  // 用旧 <img> 尺寸覆盖刚设的正确比例（编辑保存后 aspectRatio 置 Auto 会误触发该 effect）。
  // ⚠️ 置位条件必须带 `aspectRatio !== 'Auto'`：本来就是 Auto 时 setAspectRatio('Auto') 不变更 →
  // effect 不跑 → 标记残留（docs/117 §8）。见下方 onImageReplaced 内的置位注释。
  const editedRatioRef = useRef(false);
  // useSyncNodeData（Agent update_node 改 data → 同步本地 state）已收进 useGenerateNode 的 sync 参数，此处不再手写。
  const { setNodes, setEdges, getEdges, getNodes } = useReactFlow();
  // 画布历史句柄：供 commitNewNodes 原子记录自建子节点（TD-04-2）
  const history = useCanvasEdges();

  // 断连线：点击素材缩略图红色 ×，删除该素材来源节点 → 本节点的连线。
  // 仅对来自连线的素材有效（有 sourceNodeId）；data.images（剧本盒子资产）无来源连线，不处理。
  // TD-04-12：收口到 useDisconnectSource（原先 4 节点逐字重复）。
  const disconnectSource = useDisconnectSource(id);
  // 节点框按媒体真实宽高比自适应（类似 AssetNode）：
  //  - Auto 比例下，<img onLoad={fitFromImage}> 让节点框跟随图片真实比例；
  //  - 裁剪/扩图保存后 onImageReplaced 用 fitByRatio(dims) 让节点框跟随编辑后真实画布。
  // 配合 useSizeSync 的「Auto 不干预」改动，编辑/生成后节点框不再被旧比例锁定（见 docs/78 复盘）。
  const { fitFromImage, fitByRatio } = useFitNodeRatio(id);

  // 用户切到 Auto 时（且已有图）：useSizeSync 已改为 Auto 不干预（见 hooks.ts Auto 分支），
  // 需主动读当前图片真实尺寸让节点框跟随图片本身比例（否则 <img> src 未变不触发 onLoad）。
  // 编辑保存（editedRatioRef 为 true）时跳过：dims 的 fitByRatio 已设正确尺寸，避免旧图覆盖。
  React.useEffect(() => {
    if (editedRatioRef.current) {
      editedRatioRef.current = false;
      return;
    }
    if (aspectRatio !== 'Auto') return;
    const im = mainImgRef.current;
    if (im && im.naturalWidth && im.naturalHeight) {
      fitByRatio(im.naturalWidth, im.naturalHeight);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aspectRatio]);

  // 标题改名 → 写回 data.label（下游 @名 匹配 / 素材条显示跟随），单一实现收口到 useNodeRename
  const rename = useNodeRename(id);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const promptInputRef = useRef<HTMLDivElement | null>(null); // 提示词编辑器 ref（供面板右下角手柄拖拽改尺寸）
  // 双击大图：原生 <dialog> 弹窗（无外框、无背景容器，只显示图片）
  const zoomRef = useRef<HTMLDialogElement | null>(null);
  const [zoomUrl, setZoomUrl] = useState<string | null>(null);
  const openZoom = useCallback((url: string) => {
    if (!url) return;
    setZoomUrl(url);
    requestAnimationFrame(() => zoomRef.current?.showModal());
  }, []);

  // 【刷新不丢·根治】挂载时若 data.assetUrl 为空，从任务中心按 nodeId 拉取已完成任务的持久化 resultUrl 回填。
  // 覆盖两类场景：① 旧代码生成的存量节点（onSuccess 从未写回 data.assetUrl）；② 落盘/写回竞态导致 data 里没存持久 URL。
  // 任务中心 resultUrl 是已落盘到 /files/tasks/ 的持久地址，回填后随画布快照自动保存，刷新不再丢图。
  const recoveredRef = useRef(false);
  React.useEffect(() => {
    if (recoveredRef.current) return;
    recoveredRef.current = true;
    if (data.assetUrl) return; // 已有图，不覆盖
    let cancelled = false;
    fetchTasks({ pageSize: 1000 })
      .then((d) => {
        if (cancelled) return;
        const items = (d && d.data && d.data.items) || [];
        const hit = items.find((t) => t.nodeId === id && t.status === 'completed' && t.resultUrl);
        if (hit && hit.resultUrl) {
          setAssetUrl(hit.resultUrl);
          patchData({ assetUrl: hit.resultUrl });
        }
      })
      .catch((e) => logger.warn('task', 'restore-fail', { nodeId: id, error: e?.message }));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // 三个下拉菜单容器（画质/格式/数量）：ref 绑外层 relative，使「按钮+菜单」都在内，点外部才关
  const imgMenuRef = useRef<HTMLDivElement | null>(null);
  const countMenuRef = useRef<HTMLDivElement | null>(null);
  useOutsideClick(imgMenuRef, showImgMenu, () => setShowImgMenu(false));
  useOutsideClick(countMenuRef, showCountMenu, () => setShowCountMenu(false));

  // 输入框尺寸写回 node.data（基座 useNodeResize，复刻官方 inputWidth/inputHeight）
  const { onInputResize } = useNodeResize(id);

  // 供应商/模型 + useSyncNodeData(外部变更同步) + 默认模型回填 + useNodeGeneration(统一契约)
  // 全部收进 useGenerateNode（P0-2 收口，第68+71行）。prefs/selectedModel 由本节点持有并传入（无死锁）。
  // providers/primary/models 一并汇出供 run / ModelSelect 使用；任务上报提示词取 effectivePrompt。
  const {
    providers,
    primary,
    models,
    loading,
    error,
    stop: onStop,
    start: handleGenerate,
  } = useGenerateNode({
    nodeId: id,
    type: 'image',
    // 上报用解析后的纯文本（芯片已替换为可读内容）+ 摄影参数片段，与实发 finalPrompt 一致
    prompt: applyCameraSettingsToPrompt(chipResolved.text || effectivePrompt || '', cameraSettings),
    data,
    prefs: imgPrefs,
    setPrefs: setImgPrefs,
    selectedModel,
    setSelectedModel,
    // 收编 useSyncNodeData：Agent(update_node) 改 data 字段 → 同步本地 state（替原手写字段映射）
    sync: {
      aspectRatio: setAspectRatio,
      selectedModel: setSelectedModel,
      quality: setQuality,
      imageSize: setImageSize,
      cameraSettings: setCameraSettings,
    },
    resultField: 'assetUrl',
    recoverable: true,
    // 前置校验：本地 prompt（含芯片解析后的文本或参考图）或上游文本任一非空即可生图
    validate: () =>
      effectivePrompt?.trim() || chipResolved.refImages.length > 0 ? '' : '请输入提示词',
    run: async ({ progress, signal, taskId }) => {
      // 从「providerId::modelId」解析出实际 provider 和 modelId（跨 provider 选模型）
      const { provider: useProvider, modelId } = resolveProviderModel(
        providers,
        selectedModel,
        primary,
      );
      // 参考图 = 用户显式 @ 的芯片图（顺序对应 prompt 里的「图片N」）+ 其余连线上游图（去重）。
      // 图生图：把参考图传下去（网关 image_urls 字段）；signal 支持真取消（Step C）
      const chipUrls = chipResolved.refImages.map((im) => im.url);
      const upstreamUrls = refImages.map((img) => img.url);
      const refUrls = [...new Set([...chipUrls, ...upstreamUrls])];
      // 摄影参数 → 提示词片段（仅在本节点为生图时生效）：拼接在最终提示词末尾
      // （"Camera settings: <英文片段>."），与参考项目 AINodeDialog 完全一致。
      const finalPrompt = applyCameraSettingsToPrompt(
        chipResolved.text || effectivePrompt || '',
        cameraSettings,
      );
      return generateImage(
        {
          provider: useProvider,
          // 芯片解析后的纯文本（图片芯片已替换为「图片N」，文本芯片已替换为纯文本）+ 摄影参数片段
          prompt: finalPrompt,
          model: modelId,
          size: imageSize,
          n: count,
          aspectRatio,
          quality,
          images: refUrls,
          taskId, // P0-A 请求级贯穿
        },
        (pct) => progress(Math.max(15, Math.min(98, Math.round(pct)))),
        signal,
      );
    },
    onSuccess: (r) => {
      // 【S3 落盘唯一出口】data.assetUrl 由 resultField:'assetUrl' 在 hook 内自动 patchData(原始 r.url)，
      // 落盘后 useNodeGeneration 主落盘再把持久 /files/ URL 覆盖写回 node.data[resultKey]，
      // 经 useSyncNodeData 同步回本节点 state → 节点显示持久 URL。此处不再二次 saveResultToTasks
      // (旧逻辑为补"落盘持久 URL 未回写 node.data"的洞而多落一次 → 双落盘)，S3 统一由主落盘出口承接。
      setAssetUrl(r.url); // 即时反馈(可能短暂显示原始 URL，data 同步后覆盖为持久 URL)
      // 记忆本次参数（模型/比例/尺寸），供新建节点复用
      setImgPrefs({ model: selectedModel, aspectRatio, imageSize });
    },
    // 【精准节点回填】异步任务刷新后恢复轮询完成的广播 → 节点恢复显示图（resultUrl 写回 data 由 recoverable 自动）。
    // 仅生图 async 模式会命中（有 pollTaskId）；sync 同步无任务广播。
    onRecover: ({ resultUrl }) => {
      // 【异步安全兜底】节点在生成期间被删除/合并而消失 → 用结果重建节点（复用原 id 保持任务关联），
      // 避免「任务中心有图、画布没图」错位。吸收大雄 canvas-agent 的「live 节点消失→结果重建」经验。
      if (!getNodes().some((n) => n.id === id)) {
        // 原节点已不在画布：用原 id + 生图节点类型重建，带 resultUrl 与 label/prompt，放固定偏移位置。
        // 注意 addNodes 重复同 id 会告警，但此处仅在「确认不存在」时走，安全。
        // TD-04-2：重建亦走 commitNewNodes（补结构默认 + 进 undo 栈），替代原裸 addNodes。
        commitNewNodes(
          {
            nodes: [
              {
                id,
                type: 'imageGenerateNode',
                position: { x: 100, y: 100 },
                data: {
                  ...(data?.label ? { label: data.label } : {}),
                  ...(data?.prompt ? { prompt: data.prompt } : {}),
                  assetUrl: resultUrl,
                  aspectRatio: data?.aspectRatio || 'Auto',
                },
              },
            ],
          },
          { getNodes, getEdges, setNodes, setEdges, history },
        );
        return;
      }
      setAssetUrl(String(resultUrl ?? ''));
    },
  });

  // 图片可选比例（含 1:3 / 3:1 极端竖/横比例，不含 1:2 / 2:1）
  const ratioOptions = [
    'Auto',
    '1:1',
    '16:9',
    '9:16',
    '3:2',
    '2:3',
    '4:3',
    '3:4',
    '21:9',
    '9:21',
    '1:3',
    '3:1',
  ];
  const sizeOptions = ['1K', '2K', '4K'];
  const qualityOptions = [
    { value: 'auto', label: '自动' },
    { value: 'low', label: '低质量' },
    { value: 'medium', label: '中质量' },
    { value: 'high', label: '高质量' },
  ];
  const costMap = { 'dall-e-3': 4 };

  // 富文本素材插入：由 PromptInput 挂载后通过 onReady 上抛（在光标处插芯片）。
  // ResourceStrip 的蓝色 @按钮点击也走这里，复用同一插入能力（保持组件职责内聚）。
  const insertAssetRef = useRef<((asset: unknown) => void) | null>(null);
  const insertMention = (asset: unknown) => {
    if (typeof insertAssetRef.current === 'function') {
      insertAssetRef.current(asset);
    }
  };
  const hasImage = !!assetUrl;
  const [isCameraStudioOpen, setIsCameraStudioOpen] = useState(false);

  // 下载生成的图片（<a download> 触发浏览器保存；文件名推导走统一 resolveDownloadFilename）
  const handleDownload = () => {
    if (!assetUrl) return;
    // 【2026-09-11】原为 `data.label || (data.name as string)`：`name` 不在本节点 data 契约里
    // （只有 group 的 data 有 name，见 nodeDefaults/applyNodeTypeDefaults），恒为 undefined——
    // 此前被 `[key: string]: unknown` 索引签名 + `as` 掩盖成"看起来有兜底"。删掉后语义不变：
    // 无 label 时由 resolveDownloadFilename 从 URL 推导文件名。
    downloadUrl(
      assetUrl,
      resolveDownloadFilename(data.label, assetUrl, {
        ext: 'png',
        fallback: 'generated.png',
      }),
    );
  };

  // 摄影棚生成：创建新生图节点，预填摄影棚提示词，连线提供垫图
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
      // （模型/比例/尺寸），否则组件只能落到纯常量默认（Auto/1K/空模型），
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

      // TD-04-2：自建子节点统一走 commitNewNodes（补结构默认 + 原子写 + 进 undo 栈），
      // 替代原裸 addNodes/addEdges（不补结构默认、Ctrl+Z 撤不掉）。
      commitNewNodes(
        { nodes: [newNode], edges: [newEdge] },
        { getNodes, getEdges, setNodes, setEdges, history },
      );
      setIsCameraStudioOpen(false);
    },
    [id, getNodes, getEdges, setNodes, setEdges, history],
  );

  // 共享图片 hover 能力（裁剪/标记/压缩）：写回走 setAssetUrl + patchData（不可变落盘）。
  const {
    editor: _editor,
    setEditor: _setEditor,
    cropping,
    renderEditor,
    renderInlineCropper,
    imageButtons,
  } = useImageHoverActions({
    id,
    url: assetUrl,
    hasImage,
    label: data.label,
    onImageReplaced: (dataUrl, dims) => {
      // 本地 state 立即生效（渲染读 state，先于节点 data 落盘）。
      setAssetUrl(dataUrl);
      // ★ 图片字段唯一写入口（docs/118 §五 C5b）；尺寸模型仍留在本节点 afterWrite：
      // 消费 dims（裁剪/扩图后画布真实尺寸）→ fitByRatio 让节点框跟随编辑后真实比例 +
      // aspectRatio 置 'Auto'（useSizeSync 不再按固定比例锁框，也不把自定义 'W:H' 污染后续生图比例）。
      replaceNodeImage({ id, dataUrl, dims }, setNodes, (d) => {
        if (!d?.width || !d?.height) return;
        const w = Math.round(d.width);
        const h = Math.round(d.height);
        if (w <= 0 || h <= 0) return;
        // ★ 只在「aspectRatio 真的会由非 Auto 变到 Auto」时才置跳过标记（docs/117 §8 的 flag 残留）：
        //   若本来就是 Auto，setAspectRatio('Auto') 不触发 [aspectRatio] effect（值未变），
        //   标记会残留成 true 且无人消费。残留本身不改变可观测行为（下一次切换会把它消费掉，
        //   而那次切换若不是 Auto 本来就 return），但它是「谁动了 effect 顺序就会踩」的雷 —— 顺手消掉。
        if (aspectRatio !== 'Auto') editedRatioRef.current = true;
        fitByRatio(w, h); // 直接改 node 尺寸跟随图片，等价 AssetNode 消费 dims 的落点
        setAspectRatio('Auto');
        patchData({ aspectRatio: 'Auto' }); // 写的是 aspectRatio 不是图，故不经 replaceNodeImage
      });
    },
  });

  // 「上传参考图」：本地文件 → 统一落盘策略（File 直传 → 落盘失败内联兜底，见 filesApi.resolveNodeAssetUrl）
  // → 追加进 data.images 作为参考图（refImages = 连线上游 + data.images 合并）。
  // 【修死按钮】此前该 input 只有 ref 没有 onChange：点「上传参考图」弹出文件框，选完什么都不发生
  // （与 AssetNode 曾修过的「选完不读」同一类缺陷）。
  const handleRefFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0];
      e.target.value = '';
      if (!f) return;
      const url = await resolveNodeAssetUrl(f, UPLOAD_DIRS.canvasDrop, f.name);
      if (!url) {
        toastError('上传失败');
        return;
      }
      patchData({
        images: [...(data.images || []), { id: generateId('img'), url, label: f.name }],
      });
    },
    [data.images, patchData],
  );

  // hover 操作栏按钮：图片类共享能力(crop/edit/compress)走 useImageHoverActions（带 onClick，修死按钮），
  // zoom/upload/send/jianying/download 按生图节点语义各自声明。
  const toolbarButtons = [
    ...(refImages.length === 0
      ? [
          {
            key: 'upload',
            icon: <Plus size={14} />,
            title: '上传参考图',
            onClick: () => fileRef.current?.click(),
          },
        ]
      : []),
    ...(hasImage
      ? [
          { key: 'zoom', icon: <ZoomIn size={14} />, title: '放大' },
          {
            key: 'cameraStudio',
            icon: <Camera size={14} />,
            title: '摄影棚',
            onClick: () => setIsCameraStudioOpen(true),
          },
          // 共享图片能力：裁剪/标记（开 ImageEditor）/压缩，show 已由 hook 控制为 hasImage
          ...imageButtons,
          {
            key: 'send',
            icon: <Send size={14} />,
            title: '发送到素材库',
            hoverClass: 'hover:text-blue-400',
            onClick: () => {
              if (!assetUrl) {
                showToast('没有可发送的素材', { type: 'error' });
                return;
              }
              const name = (data.label && String(data.label).trim()) || '';
              sendToResourceLibrary(assetUrl, { name, type: 'image' });
              openResourceLibrary();
              showToast('已发送到素材库', { type: 'success' });
            },
          },
          {
            key: 'jianying',
            icon: <JianyingIcon size={14} />,
            title: '发送到剪映素材库',
            hoverClass: 'hover:text-emerald-400',
          },
          { key: 'download', icon: <Download size={14} />, title: '下载', onClick: handleDownload },
        ]
      : [
          {
            key: 'cameraStudio',
            icon: <Camera size={14} />,
            title: '摄影棚',
            onClick: () => setIsCameraStudioOpen(true),
          },
        ]),
  ];

  return (
    <>
      <NodeShell
        id={id}
        label={data.label}
        defaultTitle="生图节点"
        icon={<ImageIcon size={11} className="text-muted" />}
        selected={selected}
        minWidth={160}
        minHeight={160}
        handleVariant="small"
        aspectRatio={aspectRatio}
        sizeMode="area-fixed"
        baseSize={NODE_AREA_FIXED_BASE_SIZE}
        onRename={rename}
      >
        {/* hover 操作栏（loading 时隐藏） */}
        {!loading && <HoverToolbar buttons={toolbarButtons} />}

        <input
          type="file"
          ref={fileRef}
          style={{ display: 'none' }}
          accept="image/*"
          onChange={handleRefFileSelect}
        />

        {/* 就地裁剪浮层：挂在「主框层级」（与图片区同级），absolute inset-0 覆盖整个节点内容区，
          取消/裁剪按钮栏 top-full 以「主框底边 = 节点底边」为基准，稳定落在节点正下方、
          不与节点本体重叠（此前挂在图片区 relative 子容器内，某些状态下图片区高度≠主框，
          按钮栏会压到节点上）。详见 InlineImageCropper。
          提至此层级还顺带避免点击浮层冒泡到图片区 onClick 误触发展开/收起。 */}
        {renderInlineCropper()}

        {/* 主图片框：点击切换展开/收起；flex-1 填满 wrapper（高度由 useSizeSync 同步）。
          背景/边框/阴影已由 NodeShell 主容器提供，这里只保留布局与点击行为 */}
        <div
          className="relative cursor-pointer group/image w-full flex flex-col flex-1 min-h-0"
          onClick={toggleExpanded}
          onDoubleClick={(e) => {
            e.stopPropagation();
            openZoom(assetUrl);
          }}
        >
          <div
            className={`flex items-center justify-center absolute inset-0 rounded-xl overflow-hidden ${hasImage ? '' : 'bg-canvas'}`}
          >
            {/* 性能模式媒体降级：缩小时隐藏生图结果（复刻官方"图片已隐藏"） */}
            {hasImage && !loading && !error && hideResult && (
              <div className="flex flex-col items-center justify-center gap-1 absolute inset-0 bg-surface-muted">
                <ImageIcon size={24} className="text-muted" />
                <span className="text-caption text-muted">性能模式已隐藏</span>
              </div>
            )}
            {hasImage && !hideResult && (
              <img
                ref={mainImgRef}
                src={render(assetUrl)}
                alt="Generated Content"
                loading="lazy"
                decoding="async"
                onLoad={fitFromImage}
                className={`max-w-full w-full h-full object-cover block ${loading ? 'opacity-50 blur-sm' : ''}`}
                draggable={false}
              />
            )}
            {loading && (
              <GeneratingOverlay label="生图中..." backgroundUrl={assetUrl} category="image" />
            )}
            {error && !loading && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-red-500 z-10 bg-surface p-4 text-center">
                <AlertCircle size={32} />
                <span className="text-caption font-medium max-w-full break-words">{error}</span>
                <span className="text-caption bg-surface-hover-strong hover:bg-surface-3 text-body px-3 py-1 rounded-full border border-edge-raised transition-colors">
                  请检查设置或重试
                </span>
              </div>
            )}
            {!hasImage && !loading && !error && (
              <div className="flex flex-col items-center justify-center absolute inset-0 bg-surface-muted pointer-events-none">
                <ImageIcon size={80} className="text-muted" strokeWidth={1.2} />
              </div>
            )}
            <div className="absolute inset-0 bg-black/0 hover:bg-black/10 transition-colors flex items-center justify-center opacity-0 hover:opacity-100 pointer-events-none" />
          </div>
        </div>

        {/* 展开的提示词面板。手柄由节点在 children 里渲染（targetRef=textarea，写回 data.inputWidth/inputHeight）。
            裁剪进行中隐藏：就地裁剪按钮栏用 top-full 浮在节点正下方，与面板(同处节点下方)抢同一区域，
            隐藏面板可让按钮栏有干净空间落在节点下方，不再与面板重叠（见 InlineImageCropper）。 */}
        {!cropping && (
          <ExpandablePanel expanded={expanded} minWidth={500}>
            <div className="space-y-3">
              {/* 素材缩略图区（通用组件 ResourceStrip，以生图节点为标准：缩略图 + 底部@插入 + 右上×断线） */}
              <ResourceStrip
                images={refImages}
                texts={refTexts}
                onInsert={insertMention}
                onDisconnect={disconnectSource}
              />

              {/* 提示词输入（基座 PromptInput，contentEditable 富文本，含 @素材弹层与芯片插入） */}
              <PromptInput
                ref={promptInputRef}
                value={prompt}
                onChange={setPrompt}
                placeholder="描述你想要的画面 (输入 @ 调出素材)..."
                refImages={refImages}
                refTexts={refTexts}
                onInsert={insertMention}
                onReady={(fn) => {
                  insertAssetRef.current = fn;
                }}
                richText
                inputWidth={data.inputWidth}
                inputHeight={data.inputHeight}
              />

              {/* 底部参数区 */}
              <div className="flex items-center justify-between mt-2 pt-2 border-t border-edge-faint nodrag">
                <div className="flex items-center gap-1.5 overflow-visible">
                  {/* 画质 / 比例 / 渲染质量 */}
                  <div ref={imgMenuRef} className="relative nodrag">
                    <button
                      type="button"
                      className="flex items-center gap-1.5 h-6 px-2 bg-transparent hover:bg-surface-hover border border-transparent hover:border-edge rounded text-caption-sm text-body transition-colors cursor-pointer"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowImgMenu((v) => !v);
                      }}
                    >
                      <span className="w-2.5 h-3 border border-current rounded-[2px]" />
                      <span>
                        {aspectRatio} · {imageSize} ·{' '}
                        {qualityOptions.find((q) => q.value === quality)?.label}
                      </span>
                    </button>
                    {showImgMenu && (
                      <div
                        className="absolute bottom-full left-0 mb-1 w-56 bg-surface-1 border border-edge rounded-lg shadow-popover p-3 z-dropdown flex flex-col gap-3"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div>
                          <div className="text-caption text-muted mb-2">画质</div>
                          <div className="flex gap-1.5">
                            {sizeOptions.map((s) => (
                              <button
                                key={s}
                                type="button"
                                className={`flex-1 py-1.5 text-caption-sm rounded-md border transition-colors ${imageSize === s ? 'bg-surface-hover-strong border-edge-strong text-white' : 'bg-surface border-transparent text-secondary hover:bg-surface-hover'}`}
                                onClick={() => {
                                  setShowImgMenu(false);
                                  setImageSize(s);
                                  setImgPrefs({ imageSize: s });
                                  requestAnimationFrame(() => patchData({ imageSize: s }));
                                }}
                              >
                                {s}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div>
                          <div className="text-caption text-muted mb-2">比例</div>
                          <div className="flex flex-wrap gap-1.5">
                            {ratioOptions.map((r) => (
                              <button
                                key={r}
                                type="button"
                                className={`px-3 py-1.5 text-caption-sm rounded-md border transition-colors ${aspectRatio === r ? 'bg-surface-hover-strong border-edge-strong text-white' : 'bg-surface border-transparent text-secondary hover:bg-surface-hover'}`}
                                onClick={() => {
                                  setShowImgMenu(false);
                                  setAspectRatio(r);
                                  setImgPrefs({ aspectRatio: r });
                                  requestAnimationFrame(() => patchData({ aspectRatio: r }));
                                }}
                              >
                                {r}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div>
                          <div className="text-caption text-muted mb-2">渲染质量</div>
                          <div className="flex gap-1.5">
                            {qualityOptions.map((q) => (
                              <button
                                key={q.value}
                                type="button"
                                className={`flex-1 py-1.5 text-caption-sm rounded-md border transition-colors ${quality === q.value ? 'bg-surface-hover-strong border-edge-strong text-white' : 'bg-surface border-transparent text-secondary hover:bg-surface-hover'}`}
                                onClick={() => {
                                  setShowImgMenu(false);
                                  setQuality(q.value);
                                  setImgPrefs({ quality: q.value });
                                  requestAnimationFrame(() => patchData({ quality: q.value }));
                                }}
                              >
                                {q.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 模型选择（基座 ModelSelect；选择即记住，跨节点复用） */}
                  <ModelSelect
                    value={selectedModel}
                    onChange={(m) => {
                      setSelectedModel(m);
                      setImgPrefs({ model: m });
                      patchData({ selectedModel: m });
                    }}
                    models={models}
                    costMap={costMap}
                    placeholder="选择模型"
                  />

                  {/* 预设：打开提示词库弹窗 → 可追加到当前提示词或新建文本节点 */}
                  <PromptLibraryButton
                    category="image"
                    onAppend={(p) => setPrompt((prev) => (prev ? `${prev}\n${p}` : p))}
                  />

                  {/* 摄影参数：焦距/快门效果/光圈/曝光时间 → 生成时拼进提示词。
                      仅收集参数，界面不回显拼接后的片段；有参数时按钮变蓝并显示角标数量。 */}
                  <CameraSettingsSelector
                    value={cameraSettings}
                    onChange={(v) => {
                      setCameraSettings(v);
                      patchData({ cameraSettings: v });
                    }}
                  />
                </div>

                {/* 批量 xN + 生成/停止 */}
                <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                  {!loading && (
                    <div ref={countMenuRef} className="relative nodrag flex items-center">
                      <button
                        className="flex items-center gap-1 h-6 px-2 bg-transparent hover:bg-surface-hover border border-transparent hover:border-edge rounded text-caption-sm text-body transition-colors cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowCountMenu((v) => !v);
                        }}
                        title="批量生成数量"
                      >
                        <span>x{count}</span>
                      </button>
                      {showCountMenu && (
                        <div
                          className="absolute bottom-full right-0 mb-1 w-16 bg-surface-1 border border-edge rounded-lg shadow-popover p-1 z-dropdown flex flex-col gap-0.5"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {[1, 2, 3, 4, 5].map((n) => (
                            <button
                              key={n}
                              className={`w-full text-center py-1.5 text-caption-sm rounded-md transition-colors ${count === n ? 'bg-surface-hover-strong text-white' : 'text-secondary hover:bg-surface-hover hover:text-primary'}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                setCount(n);
                                setShowCountMenu(false);
                              }}
                            >
                              x{n}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  <GenerateButton loading={loading} onGenerate={handleGenerate} onStop={onStop} />
                </div>
              </div>
            </div>

            {/* 面板右下角手柄：拖拽改输入框尺寸（复刻 bo.jsx:1676 _Component23）。
            targetRef=textarea（promptInputRef），onResizeEnd → onInputResize 写回
            node.data.inputWidth/inputHeight，PromptInput 的 textarea 读这个 data 渲染。
            输入框是面板里的部件，不参与端口定位，所以只写 data，不改 node.width/height。 */}
            <ResizeFullscreenHandle
              targetRef={promptInputRef}
              minWidth={200}
              maxWidth={900}
              minHeight={60}
              maxHeight={400}
              onRequestFullscreen={() => setFullscreenPrompt(true)}
              onResizeEnd={onInputResize}
            />
          </ExpandablePanel>
        )}

        {/* 全屏弹层：提示词输入框双击 → 全屏编辑提示词（统一组件） */}
        <FullscreenEditor
          open={fullscreenPrompt}
          onClose={() => setFullscreenPrompt(false)}
          variant="prompt"
          value={prompt}
          onChange={setPrompt}
          placeholder="描述你想要的画面 (输入 @ 调出素材)..."
          refImages={refImages}
          refTexts={refTexts}
          onInsert={insertMention}
          onDisconnect={disconnectSource}
          richText
        />

        {/* 双击大图：共享 ImageZoomDialog */}
        <ImageZoomDialog ref={zoomRef} url={zoomUrl} />

        {/* 图片编辑器（裁剪/标记/压缩）：统一机制渲染，editor 关闭时返回 null */}
        {renderEditor()}
      </NodeShell>

      {/* 摄影棚面板 */}
      <CameraStudioPanel
        isOpen={isCameraStudioOpen}
        assetUrl={assetUrl || undefined}
        onClose={() => setIsCameraStudioOpen(false)}
        onGenerate={handleCameraStudioGenerate}
      />
    </>
  );
}
export default React.memo(ImageGenerate);
