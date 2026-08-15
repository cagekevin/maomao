import React from 'react'
import {
  Type, Image as ImageIcon, Clapperboard, Combine, AudioLines, Box,
  Grid3X3, Globe, Film, FileArchive, Shuffle,
  Contrast, Link as LinkIcon, ImageDown, Wand2, StickyNote,
  FileUp, Grid2X2, Puzzle, FolderTree
} from 'lucide-react'

/**
 * 节点目录（复刻 H_.jsx:9423-9554 的 _i / vi）。
 *
 * 这是批量复刻 20+ 节点的「数据地基」：每个节点一行 { type, label, icon, cat, data, badge }，
 * 新增节点时只需在此登记，右键菜单 / 节点面板即可自动接入。
 *
 * icon 存组件引用（渲染时由调用方实例化并加 size/className）。
 * builtin 标记 = 已在 components/ 下复刻出对应 .jsx 的节点。
 */

// 四个工具分类 tab（复刻 H_.jsx vi）
export const paletteCategories = [
  { key: 'text', label: '文本工具' },
  { key: 'image', label: '图片工具' },
  { key: 'video', label: '视频工具' },
  { key: 'other', label: '其他工具' }
]

// 完整节点目录（复刻 H_.jsx _i，图标用 lucide 等价）
export const paletteNodes = [
  // --- 文本工具 ---
  { type: 'textNode', label: '文本', icon: Type, cat: 'text', data: { text: '' }, builtin: true },
  { type: 'textConcatNode', label: '文本拼接', icon: Combine, cat: 'text' },
  { type: 'audioNode', label: '听音断句', icon: AudioLines, cat: 'text' },

  // --- 图片工具 ---
  { type: 'promptNode', label: '图片', icon: ImageIcon, cat: 'image', data: { prompt: '' }, builtin: true },
  { type: 'imageNode', label: '图片节点', icon: ImageIcon, cat: 'image', data: { images: [] }, builtin: true },
  { type: 'imageBoxNode', label: '图片盒子', icon: Box, cat: 'image', data: { images: [], activeIndex: 0, expanded: false }, builtin: true },
  { type: 'gridSplitNode', label: '图片切分', icon: Grid3X3, cat: 'image', data: { imageUrl: '', extractedImages: [], rows: 3, cols: 3, splitMode: 'grid', hLines: [0.5], vLines: [0.5], lassoShapes: [], titlePattern: '#{num}', sendToImageBox: false }, builtin: true },
  { type: 'gridMergeNode', label: '图片拼图', icon: Grid2X2, cat: 'image', data: { mergeMode: 'grid', rows: 3, cols: 3, cellSize: 512, aspectRatio: '1:1', autoSize: true, titlePattern: '', longDirection: 'vertical', longGap: 0, longTargetSize: 1024, longAutoSize: true, bgColor: 'transparent', overlayState: { layers: [], canvasWidth: 1024, canvasHeight: 1024, bgColor: 'transparent' } }, builtin: true },
  { type: 'panoramaNode', label: '全景图', icon: Globe, cat: 'image' },
  { type: 'director3dNode', label: '3D导演台', icon: Film, cat: 'image' },
  { type: 'imageCompressNode', label: '图片压缩', icon: FileArchive, cat: 'image' },
  { type: 'faceMosaicNode', label: '人脸打码', icon: Shuffle, cat: 'image' },
  { type: 'compareNode', label: '对比工具', icon: Contrast, cat: 'image' },
  { type: 'urlToImageNode', label: '网址转图片', icon: LinkIcon, cat: 'image' },

  // --- 视频工具 ---
  { type: 'discountVideoNode', label: '视频', icon: Clapperboard, cat: 'video', data: { prompt: '' }, builtin: true },
  { type: 'videoNode', label: '其他视频', icon: Film, cat: 'video', data: { prompt: '' } },
  { type: 'videoExtractNode', label: '视频抽帧', icon: ImageDown, cat: 'video' },
  { type: 'videoProcessNode', label: '视频处理', icon: Wand2, cat: 'video', badge: { text: 'NEW', tone: 'new' }, builtin: true, data: { mode: 'trim', sourceOrder: [], timelineTracks: [], audioFormat: 'm4a', trimStart: 0, trimEnd: 4, resizeWidth: 1280, resizeHeight: 720, targetFps: 30 } },

  // --- 其他工具 ---
  { type: 'group', label: '编组', icon: FolderTree, cat: 'other', builtin: true },
  { type: 'scriptBoxNode', label: '剧本盒子', icon: Clapperboard, cat: 'other', builtin: true, data: { step: 1, story: '', globalStyle: '', shots: [], assets: [] } },
  { type: 'customNode', label: '万能节点', icon: Puzzle, cat: 'other' },
  { type: 'stickyNoteNode', label: '便签', icon: StickyNote, cat: 'other', data: { text: '', fontSize: 24, bgColor: 'rgba(180,160,60,0.25)', textColor: 'rgba(255,255,255,0.92)' } },
  { type: 'fileToUrlNode', label: '文件转链接', icon: FileUp, cat: 'other' }
]

// 便捷：按 type 查目录项
export const getPaletteNode = (type) => paletteNodes.find((n) => n.type === type)

// 便捷：按分类取节点
export const getNodesByCategory = (cat) => paletteNodes.filter((n) => n.cat === cat)

// 便捷：默认节点 data（用于右键菜单 / 面板快速添加）
// 统一兜底 expanded:false → 新建节点输入框默认收起（子项可在 palette 的 data 里显式传 expanded:true 覆盖）
export const defaultNodeData = (type) => ({
  expanded: false,
  ...(getPaletteNode(type)?.data || {})
})

// 已复刻节点的类型集合
export const builtinNodeTypes = paletteNodes.filter((n) => n.builtin).map((n) => n.type)
