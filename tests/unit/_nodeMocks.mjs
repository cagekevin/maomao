/**
 * 阶段五节点组件测试共享 mock 实现（纯 stub，不依赖 vitest）。
 * 各 *.test.jsx 通过 vi.mock 把源码依赖映射到本模块导出的 mocks 命名空间。
 * 注意：本文件只导出 `mocks` 一个标识符，避免把 OverlayEditor / useStore 等名
 * 提升到测试模块作用域，与组件源码的具名 import 冲突（Identifier already declared）。
 */
import React from 'react'

// ── @xyflow/react ──
const xyflowCalls = { setNodes: 0, setEdges: 0, addNodes: 0, addEdges: 0 }
const xyflow = {
  useReactFlow: () => ({
    setNodes: (...a) => { xyflowCalls.setNodes++; return a[0] },
    setEdges: (...a) => { xyflowCalls.setEdges++; return a[0] },
    getNodes: () => [],
    getEdges: () => [],
    addNodes: (...a) => { xyflowCalls.addNodes++; return a[0] },
    addEdges: (...a) => { xyflowCalls.addEdges++; return a[0] },
  }),
  Handle: () => null,
  Position: { Left: 'left', Right: 'right', Top: 'top', Bottom: 'bottom' },
  NodeResizer: () => null,
  useStore: () => () => {},
  ReactFlowProvider: ({ children }) => children,
}

// ── 通用 UI 基座（透传 children，便于断言渲染内容）──
const Passthrough = ({ children, label, titleRight, title, testId, ...rest }) => {
  const attrs = {}
  if (label !== undefined) attrs['data-label'] = label
  if (title !== undefined) attrs['data-title'] = title
  if (testId !== undefined) attrs['data-testid'] = testId
  return React.createElement('div', attrs, children, titleRight)
}
Passthrough.displayName = 'Passthrough'

// NodeShell 专属：始终暴露 data-testid="shell" 与 data-label（便于测试查询外壳标题）
const ShellPassthrough = ({ children, label, titleRight, defaultTitle, title, ...rest }) => {
  const attrs = { 'data-testid': 'shell' }
  attrs['data-label'] = label ?? defaultTitle ?? title ?? ''
  return React.createElement('div', attrs, children, titleRight)
}
ShellPassthrough.displayName = 'ShellPassthrough'

const NullComp = () => null
NullComp.displayName = 'NullComp'

const NodeShell = ShellPassthrough
const HoverToolbar = Passthrough
const ExpandablePanel = Passthrough
const MaterialStrip = Passthrough
const ResizeFullscreenHandle = NullComp
const FullscreenModal = Passthrough
const GeneratingOverlay = NullComp
const PromptLibraryButton = NullComp
const PromptInput = NullComp
const ModelSelect = NullComp
const ImageEditor = Passthrough
const OverlayEditor = NullComp
const LazyImage = NullComp
const CustomHandle = NullComp
const NodeTitle = Passthrough
const GenerateButton = ({ onGenerate, children }) => React.createElement('button', { type: 'button', onClick: onGenerate }, children || '生成')
const renderOverlayCanvas = () => ({})

// ── hooks ──
let connectedInputsState = { images: [], texts: [] }
const useConnectedInputs = () => connectedInputsState
const setConnectedInputs = (v) => { connectedInputsState = v }
const useMediaDegrade = () => ({ isHidden: () => false })
const useNodeResize = () => ({ onInputResize: () => {} })
const useContentHeightSync = () => {} // 内容高度自适应 hook（jsdom 无 ResizeObserver 反馈，测试用 no-op）
const useOutsideClick = () => {}
const useFitNodeRatio = () => ({})
const useVideoPoster = () => ({ poster: null })
const useNodePrefs = () => ({ prefs: {}, set: () => {} })
const useSyncNodeData = () => {}

// useNodeGeneration：记录最近一次 config 供测试断言/触发 onSuccess/onRecover
let lastGenConfig = null
const useNodeGeneration = (config) => {
  lastGenConfig = config
  return {
    loading: false,
    error: null,
    stop: () => {},
    start: async () => {
      const r = await config?.run?.({ progress: () => {}, signal: { aborted: false } })
      config?.onSuccess?.(r)
      return r
    },
  }
}
// 测试可经 mocks.genConfig 取到最近 config，手动触发 onSuccess/onRecover 断言节点回填行为
const getGenConfig = () => lastGenConfig

// ── 网络 / 存储 stub ──
const toastCalls = { show: 0, warn: 0, error: 0 }
const showToast = () => { toastCalls.show++ }
const toastWarning = () => { toastCalls.warn++ }
const toastError = () => { toastCalls.error++ }

const toAbsoluteFileUrl = (x) => x
const saveResultToTasks = async () => undefined
const saveTextToTasks = async () => undefined
const saveInlineToLocal = async () => 'local://x'
const uploadFileToLocal = async () => 'local://up'

const useProviders = () => ({ providers: [] })
const loadProviders = async () => {}
const buildAllModels = () => []
const resolveProviderModel = () => ({ provider: {}, modelId: 'm' })

const generateImageCalls = { n: 0, last: null }
const generateImage = async (...a) => { generateImageCalls.n++; generateImageCalls.last = a[0]; return { url: 'http://gen.local/i.png' } }

const chatCompletionsCalls = { n: 0, last: null }
const chatCompletions = async (...a) => { chatCompletionsCalls.n++; chatCompletionsCalls.last = a[0]; return { choices: [{ message: { content: '{"ok":true}' } }] } }

const detectMediaType = () => ({ type: 'image' })
const compressImage = async (url) => url

const publish = () => {}
const withTimeout = (fn) => fn
const isTimeoutError = () => false

const readVideoMetadata = async () => ({ duration: 1, width: 100, height: 100 })
const processVideo = async () => ({ url: 'http://v/x.mp4' })
const concatVideos = async () => ({ url: 'http://v/c.mp4' })
const videoToGif = async () => ({ url: 'http://v/g.gif' })
const formatBytes = (b) => `${b}B`
const uploadResult = async () => 'http://v/r'
class ProgressController { constructor() {} update() {} done() {} fail() {} cancel() {} }
const ConversionCanceled = class extends Error {}

// 节点专属依赖 stub
const PanoViewer = NullComp
const FaceMosaicEditor = NullComp
const Director3DOverlay = NullComp
const applyMosaic = async (...a) => ({ url: 'http://mosaic.local/x.png' })
const MOSAIC_MODES = ['mosaic', 'blur', 'grid', 'bar']
const MOSAIC_PALETTE = []
const sSet = () => {}
const StorageKeys = { DONE_TASKS: 'done_tasks', IMAGE_TASKS: 'image_tasks' }
const Canvas = () => null

function resetNodeMockState() {
  xyflowCalls.setNodes = 0
  xyflowCalls.setEdges = 0
  xyflowCalls.addNodes = 0
  xyflowCalls.addEdges = 0
  connectedInputsState = { images: [], texts: [] }
  lastGenConfig = null
  toastCalls.show = 0; toastCalls.warn = 0; toastCalls.error = 0
  generateImageCalls.n = 0; generateImageCalls.last = null
  chatCompletionsCalls.n = 0; chatCompletionsCalls.last = null
}

export const mocks = {
  xyflow, NodeShell, HoverToolbar, ExpandablePanel, MaterialStrip, ResizeFullscreenHandle,
  FullscreenModal, GeneratingOverlay, PromptLibraryButton, PromptInput, ModelSelect,
  ImageEditor, OverlayEditor, LazyImage, CustomHandle, NodeTitle, GenerateButton,
  renderOverlayCanvas, useConnectedInputs, setConnectedInputs, useMediaDegrade,
  useNodeResize, useContentHeightSync, useOutsideClick, useFitNodeRatio, useVideoPoster, useNodePrefs,
  useSyncNodeData, useNodeGeneration, getGenConfig, toastCalls, showToast, toastWarning, toastError,
  toAbsoluteFileUrl, saveResultToTasks, saveTextToTasks, saveInlineToLocal,
  uploadFileToLocal, useProviders, loadProviders, buildAllModels, resolveProviderModel,
  generateImageCalls, generateImage, chatCompletionsCalls, chatCompletions,
  detectMediaType, compressImage, publish, withTimeout, isTimeoutError,
  readVideoMetadata, processVideo, concatVideos, videoToGif, formatBytes, uploadResult,
  ProgressController, ConversionCanceled, PanoViewer, FaceMosaicEditor, Director3DOverlay,
  applyMosaic, MOSAIC_MODES, MOSAIC_PALETTE, sSet, StorageKeys, Canvas, useStore: () => () => ({}),
  xyflowCalls, resetNodeMockState,
}
