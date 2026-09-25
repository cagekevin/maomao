/**
 * 阶段五节点组件测试共享 mock 实现（纯 stub，不依赖 vitest）。
 * 各 *.test.jsx 通过 vi.mock 把源码依赖映射到本模块导出的 mocks 命名空间。
 * 注意：本文件只导出 `mocks` 一个标识符，避免把 OverlayEditor / useStore 等名
 * 提升到测试模块作用域，与组件源码的具名 import 冲突（Identifier already declared）。
 */
import React from 'react';

// ── @xyflow/react ──
const xyflowCalls = { setNodes: 0, setEdges: 0, addNodes: 0, addEdges: 0 };
/**
 * 【2026-09-16 修复 · mock 伪造了触发条件，把真实脆弱点放大成挂死】
 *
 * 原实现把这坨方法**写在 `useReactFlow()` 内部** ⇒ 每次调用返回**新对象 + 新函数**。
 * 而 `@xyflow/react` 真实实现返回的是**引用稳定**的（zustand 层 useMemo）—— mock 与真实语义不符。
 *
 * 实测后果（TD-21-2 补抽帧消费方用例时**挂死**，CPU 空转、vitest 永不返回）：
 *   新函数引用 ⇒ 依赖 `getNodes`/`setNodes` 的 `useMemo`（VideoProcessNode 的 `sources`）**每次渲染都重算**
 *   ⇒ 下游 `tracks` 每次重算 ⇒ 视频轨自动补的 clip 用 `makeId()` 生成**新 id**
 *   ⇒ `VideoProcessNode:628` 的「选中片段」effect 发现 `selectedClipId` 已不在 tracks 里
 *   ⇒ `setSelectedClipId(新id)` ⇒ 渲染 ⇒ `sources` 又变 ⇒ **无限循环**。
 *
 * ⇒ 提到模块级单例：mock 与真实实现对齐（引用稳定），不再无中生有地触发下游重算。
 */
const xyflowMethods = {
  setNodes: (/** @type {any[]} */ ...a) => {
    xyflowCalls.setNodes++;
    return a[0];
  },
  setEdges: (/** @type {any[]} */ ...a) => {
    xyflowCalls.setEdges++;
    return a[0];
  },
  getNodes: () => [],
  getEdges: () => [],
  addNodes: (/** @type {any[]} */ ...a) => {
    xyflowCalls.addNodes++;
    return a[0];
  },
  addEdges: (/** @type {any[]} */ ...a) => {
    xyflowCalls.addEdges++;
    return a[0];
  },
  getNode: () => null, // NodeShell/useSizeSync 依赖；jsdom 下无实际节点，返回 null 安全跳过
};

/** 造一份**全新**的方法对象（新函数引用），**共享** `xyflowCalls` 计数 —— 供抖动开关用。
 *  ⚠️ 必须新函数：组件是 `const { setNodes, getNodes } = useReactFlow()` 解构后进 useMemo 依赖，
 *  只换外层对象（`{...xyflowMethods}`）**解构出的函数引用不变** ⇒ 组件侧毫无感知（一度造成假绿）。 */
const createUnstableMethods = () => ({
  setNodes: (/** @type {any[]} */ ...a) => {
    xyflowCalls.setNodes++;
    return a[0];
  },
  setEdges: (/** @type {any[]} */ ...a) => {
    xyflowCalls.setEdges++;
    return a[0];
  },
  getNodes: () => [],
  getEdges: () => [],
  addNodes: (/** @type {any[]} */ ...a) => {
    xyflowCalls.addNodes++;
    return a[0];
  },
  addEdges: (/** @type {any[]} */ ...a) => {
    xyflowCalls.addEdges++;
    return a[0];
  },
  getNode: () => null,
});
/**
 * 引用抖动开关（默认**关**）。
 * 打开后 `useReactFlow()` 每次返回**新对象** —— 用来模拟"上游 hook 每渲染返回新引用"。
 * 仅服务于 TD-21-23 的不变量用例（抖动下不得进入渲染循环）；
 * 默认必须关：真实 `@xyflow/react` 返回的是引用稳定的对象（见上方注释）。
 */
let unstableReactFlow = false;
const setUnstableReactFlow = (/** @type {boolean} */ v) => {
  unstableReactFlow = v;
};
const xyflow = {
  useReactFlow: () => (unstableReactFlow ? createUnstableMethods() : xyflowMethods),
  Handle: () => null,
  Position: { Left: 'left', Right: 'right', Top: 'top', Bottom: 'bottom' },
  NodeResizer: () => null,
  useStore: () => () => {},
  useUpdateNodeInternals: () => () => {}, // NodeShell/useSizeSync 依赖；jsdom 下 no-op
  ReactFlowProvider: (/** @type {any} */ { children }) => children,
};

// ── 通用 UI 基座（透传 children，便于断言渲染内容）──
const Passthrough = (/** @type {any} */ { children, label, titleRight, title, testId }) => {
  const attrs = {};
  if (label !== undefined) attrs['data-label'] = label;
  if (title !== undefined) attrs['data-title'] = title;
  if (testId !== undefined) attrs['data-testid'] = testId;
  return React.createElement('div', attrs, children, titleRight);
};
Passthrough.displayName = 'Passthrough';

// NodeShell 专属：始终暴露 data-testid="shell" 与 data-label（便于测试查询外壳标题）
const ShellPassthrough = (
  /** @type {any} */ { children, label, titleRight, defaultTitle, title },
) => {
  const attrs = /** @type {Record<string, any>} */ ({ 'data-testid': 'shell' });
  attrs['data-label'] = label ?? defaultTitle ?? title ?? '';
  return React.createElement('div', attrs, children, titleRight);
};
ShellPassthrough.displayName = 'ShellPassthrough';

const NullComp = () => null;
NullComp.displayName = 'NullComp';

const NodeShell = ShellPassthrough;
/**
 * HoverToolbar 忠实桩（不是 Passthrough）：真实实现按 `buttons` 数组渲染按钮，
 * 只 `filter(b => b.show !== false)` + 绑 `title` / `onClick`（见 HoverToolbar.tsx:32-46）。
 * ⚠️ 原先用 Passthrough ⇒ `buttons` prop 被丢弃、**一个按钮都不渲染** ⇒ 任何"点工具栏按钮"
 * 的用例都够不着入口（不忠实桩会让用例要么假红、要么被迫退化成自证式断言）。
 */
const HoverToolbar = (/** @type {any} */ { buttons = [] }) =>
  React.createElement(
    'div',
    { 'data-testid': 'hover-toolbar' },
    buttons
      .filter((/** @type {any} */ b) => b.show !== false)
      .map((/** @type {any} */ b) =>
        React.createElement(
          'button',
          { key: b.key, type: 'button', title: b.title, onClick: b.onClick },
          b.title,
        ),
      ),
  );
const ExpandablePanel = Passthrough;
const ResourceStrip = Passthrough;
const ResizeFullscreenHandle = NullComp;
const FullscreenModal = Passthrough;
const GeneratingOverlay = NullComp;
const PromptLibraryButton = NullComp;
const PromptInput = NullComp;
const ModelSelect = NullComp;
const ImageEditor = Passthrough;
// 【抠图】暴露一个「保存」按钮触发 onSave —— 让测试能走完「编辑器产出 → 落盘 → 写回」的真实链路
// （断言的是产物落盘这一外部事实，不是"组件渲染出来了"）。
const MattingEditor = (/** @type {any} */ { onSave }) =>
  React.createElement(
    'button',
    {
      type: 'button',
      onClick: () => onSave?.({ dataUrl: 'data:image/png;base64,AAAA', width: 10, height: 10 }),
    },
    '抠图保存',
  );
const OverlayEditor = NullComp;
const LazyImage = NullComp;
const CustomHandle = NullComp;
const NodeTitle = Passthrough;
const GenerateButton = (/** @type {any} */ { onGenerate, children }) =>
  React.createElement('button', { type: 'button', onClick: onGenerate }, children || '生成');
const renderOverlayCanvas = () => ({});

// ── hooks ──
let connectedInputsState = { images: [], texts: [] };
const useConnectedInputs = () => connectedInputsState;
const setConnectedInputs = (/** @type {any} */ v) => {
  connectedInputsState = v;
};
// AssetNode 用 useAssetDegrade().hideMedia 直接做 includes 判断（'' / [] 等"不隐藏"空值）；
// GridSplit/GridMerge 等用 isHidden()。两者都 stub，掩盖两种调用形态。
const useAssetDegrade = () => ({ hideMedia: [], isHidden: () => false });
const useNodeResize = () => ({ onInputResize: () => {} });
const useContentHeightSync = () => {}; // 内容高度自适应 hook（jsdom 无 ResizeObserver 反馈，测试用 no-op）
const useOutsideClick = () => {};
const useFitNodeRatio = () => ({});
const useVideoPoster = () => ({ poster: null });
/**
 * 【2026-09-20 修复 · 与真实实现对齐 —— 同文件头 12-24 行给 `useReactFlow` 记的那条，只是漏了横推】
 *
 * 原实现 `() => ({ prefs: {}, set: () => {} })` 每次调用返回**新对象 + 新箭头**
 * ⇒ 消费方 `useCallback(…, [setPrefs])` 的引用每次渲染都变 ⇒ **喂给 memo 组件的 prop 恒不稳定**。
 * 后果不是"多跑一次"，而是**任何「prop 引用是否稳定」的断言都会因桩不忠实而假红**（本轮 TD-04-53 实测撞到）。
 * 真实实现 `nodePrefs.ts:157`：`set` 是 `useCallback(…, [type])` ⇒ **引用稳定**。
 * ⇒ 提到模块级单例，语义与生产一致。
 */
const NODE_PREFS_STUB = { prefs: {}, set: () => {} };
const useNodePrefs = () => NODE_PREFS_STUB;
const useSyncNodeData = () => {};

// useNodeGeneration：记录最近一次 config 供测试断言/触发 onSuccess/onRecover
let /** @type {any} */ lastGenConfig = null;
const useNodeGeneration = (/** @type {any} */ config) => {
  lastGenConfig = config;
  return {
    loading: false,
    error: null,
    stop: () => {},
    start: async () => {
      const r = await config?.run?.({ progress: () => {}, signal: { aborted: false } });
      config?.onSuccess?.(r);
      return r;
    },
  };
};
// 测试可经 mocks.genConfig 取到最近 config，手动触发 onSuccess/onRecover 断言节点回填行为
const getGenConfig = () => lastGenConfig;

// ── 网络 / 存储 stub ──
const toastCalls = { show: 0, warn: 0, error: 0 };
const showToast = () => {
  toastCalls.show++;
};
const toastWarning = () => {
  toastCalls.warn++;
};
const toastError = () => {
  toastCalls.error++;
};

const toAbsoluteFileUrl = (/** @type {any} */ x) => x;
const saveResultToTasks = async () => ({ ok: true, url: 'http://x/y.png', skipped: true });
const saveTextToTasks = async () => undefined;
// 【2026-09-17】以下三个已改**判别联合**（成功＝`ok:true` + url）—— 原来分别是 string / null。
/** 落盘调用记录（断言"编辑器产物真的落了盘"这一外部事实用；只记字节，不改行为） */
const saveInlineCalls = { n: 0, lastDataUrl: '' };
const saveInlineToLocal = async (/** @type {string} */ dataUrl) => {
  saveInlineCalls.n++;
  saveInlineCalls.lastDataUrl = dataUrl;
  return { ok: true, url: 'local://x' };
};
/**
 * 「图像入节点·统一落盘策略」忠实桩（与 filesApi.showThenPersistInline 同契约）：
 *   ① 立即 `show(dataUrl)`；② 落盘；③ 成功才 `show(持久 url)`。
 * ⚠️ 必须保留三步语义（不是 `show(持久) 就完`）——用例正是靠它断言"落盘被走过了"。
 */
const showThenPersistInline = async (
  /** @type {string} */ dataUrl,
  /** @type {(u: string) => void} */ show,
) => {
  if (!dataUrl) return;
  show(dataUrl); // ① 立即上屏
  const saved = await saveInlineToLocal(dataUrl);
  if (saved.ok && saved.url) show(saved.url); // ③ 成功才换持久
};
const uploadFileToLocal = async () => ({ ok: true, url: 'local://up' });
// 落盘收口：File → /files/ URL（失败回退内联），与 filesApi.resolveNodeAssetUrl 同签名
const resolveNodeAssetUrl = async () => ({ ok: true, url: 'local://up' });

/**
 * 【2026-09-20 修复 · 与真实实现对齐 —— 同文件头 12-24 行给 `useReactFlow` 记的那条，只是漏了横推】
 *
 * 原实现 `() => ({ providers: [] })` 每次调用返回**新对象 + 新数组** ⇒
 * `useGenerateNode` 的 `useMemo(() => buildAllModels(providers, type), [providers, type])` 每次都重算
 * ⇒ `models` 引用不稳 ⇒ 喂给 `memo(ModelSelect)` 必失败（**桩造成的假红**，非实现问题）。
 * 真实实现 `providerStore.ts:117`：`useSyncExternalStore(subscribe, getSnapshot)` ⇒ 未变更时快照引用稳定。
 * ⇒ 提到模块级单例，语义与生产一致。
 */
/** @type {any[]} */
const EMPTY_PROVIDERS = [];
const PROVIDERS_STUB = { providers: EMPTY_PROVIDERS };
const useProviders = () => PROVIDERS_STUB;
const loadProviders = async () => {};
const buildAllModels = () => [];
const resolveProviderModel = () => ({ provider: {}, modelId: 'm' });

const generateImageCalls = { n: 0, last: null };
const generateImage = async (/** @type {any[]} */ ...a) => {
  generateImageCalls.n++;
  generateImageCalls.last = a[0];
  return { url: 'http://gen.local/i.png' };
};

const chatCompletionsCalls = { n: 0, last: null };
const chatCompletions = async (/** @type {any[]} */ ...a) => {
  chatCompletionsCalls.n++;
  chatCompletionsCalls.last = a[0];
  return { choices: [{ message: { content: '{"ok":true}' } }] };
};

const detectAssetType = () => ({ type: 'image' });
const compressImage = async (/** @type {any} */ url) => url;

const publish = () => {};
const withTimeout = (/** @type {any} */ fn) => fn;
const isTimeoutError = () => false;

const readVideoMetadata = async () => ({ duration: 1, width: 100, height: 100 });
const processVideo = async () => ({ url: 'http://v/x.mp4' });
const concatVideos = async () => ({ url: 'http://v/c.mp4' });
const videoToGif = async () => ({ url: 'http://v/g.gif' });
const formatBytes = (/** @type {any} */ b) => `${b}B`;
// 【2026-09-17】契约改判别联合（成功＝`ok:true` + url）。
const uploadResult = async () => ({ ok: true, url: 'http://v/r' });
class ProgressController {
  constructor() {}
  update() {}
  done() {}
  fail() {}
  cancel() {}
}
const ConversionCanceled = class extends Error {};

// 节点专属依赖 stub
const PanoViewer = NullComp;
const FaceMosaicEditor = NullComp;
const Director3DOverlay = NullComp;
const applyMosaic = async (/** @type {any[]} */ ..._a) => ({ url: 'http://mosaic.local/x.png' });
const MOSAIC_MODES = ['mosaic', 'blur', 'grid', 'bar'];
const /** @type {any} */ MOSAIC_PALETTE = [];
const sSet = () => {};
const StorageKeys = { DONE_TASKS: 'done_tasks', IMAGE_TASKS: 'image_tasks' };
const Canvas = () => null;

function resetNodeMockState() {
  xyflowCalls.setNodes = 0;
  xyflowCalls.setEdges = 0;
  xyflowCalls.addNodes = 0;
  xyflowCalls.addEdges = 0;
  saveInlineCalls.n = 0;
  saveInlineCalls.lastDataUrl = '';
  connectedInputsState = { images: [], texts: [] };
  unstableReactFlow = false;
  lastGenConfig = null;
  toastCalls.show = 0;
  toastCalls.warn = 0;
  toastCalls.error = 0;
  generateImageCalls.n = 0;
  generateImageCalls.last = null;
  chatCompletionsCalls.n = 0;
  chatCompletionsCalls.last = null;
}

export const mocks = {
  xyflow,
  NodeShell,
  HoverToolbar,
  ExpandablePanel,
  ResourceStrip,
  ResizeFullscreenHandle,
  FullscreenModal,
  GeneratingOverlay,
  PromptLibraryButton,
  PromptInput,
  ModelSelect,
  ImageEditor,
  MattingEditor,
  OverlayEditor,
  LazyImage,
  CustomHandle,
  NodeTitle,
  GenerateButton,
  renderOverlayCanvas,
  useConnectedInputs,
  setConnectedInputs,
  setUnstableReactFlow,
  useAssetDegrade,
  useNodeResize,
  useContentHeightSync,
  useOutsideClick,
  useFitNodeRatio,
  useVideoPoster,
  useNodePrefs,
  useSyncNodeData,
  useNodeGeneration,
  getGenConfig,
  toastCalls,
  showToast,
  toastWarning,
  toastError,
  toAbsoluteFileUrl,
  saveResultToTasks,
  saveTextToTasks,
  saveInlineToLocal,
  uploadFileToLocal,
  resolveNodeAssetUrl,
  useProviders,
  loadProviders,
  buildAllModels,
  resolveProviderModel,
  generateImageCalls,
  generateImage,
  chatCompletionsCalls,
  chatCompletions,
  detectAssetType,
  compressImage,
  publish,
  withTimeout,
  isTimeoutError,
  readVideoMetadata,
  processVideo,
  concatVideos,
  videoToGif,
  formatBytes,
  uploadResult,
  ProgressController,
  ConversionCanceled,
  PanoViewer,
  FaceMosaicEditor,
  Director3DOverlay,
  applyMosaic,
  MOSAIC_MODES,
  MOSAIC_PALETTE,
  sSet,
  StorageKeys,
  Canvas,
  useStore: () => () => ({}),
  xyflowCalls,
  saveInlineCalls,
  showThenPersistInline,
  resetNodeMockState,
};
