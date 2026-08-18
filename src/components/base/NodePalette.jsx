import React from 'react'
import {
  Type, Image as ImageIcon, Clapperboard, Box, Repeat,
  Grid3X3, Globe, Film, Shuffle,
  ImageDown, Wand2, Grid2X2, FolderTree
} from 'lucide-react'
// 画布渲染组件引用（component 字段用于 App.jsx 派生 nodeTypes，避免双维护平行表）。
// 注意：节点组件均不反向 import 本文件，故无循环依赖（已验证）。
import TextNode from '../TextNode.jsx'
import ImageNode from '../ImageNode.jsx'
import LoopNode from '../LoopNode.jsx'
import PromptNode from '../PromptNode.jsx'
import DiscountVideoNode from '../DiscountVideoNode.jsx'
import VideoExtractNode from '../VideoExtractNode.jsx'
import ImageBoxNode from '../ImageBoxNode.jsx'
import GridSplitNode from '../GridSplitNode.jsx'
import GridMergeNode from '../GridMergeNode.jsx'
import VideoProcessNode from '../VideoProcessNode.jsx'
import FaceMosaicNode from '../FaceMosaicNode.jsx'
import PanoramaNode from '../PanoramaNode.jsx'
import GroupNode from '../GroupNode.jsx'
import ScriptBoxNode from '../ScriptBoxNode.jsx'
// 注：director3dNode 依赖 WebGL + import.meta.glob，无法 SSR，故不在此持有 component，
// 由 App.jsx 派生后单独补充（见 buildNodeTypeComponents 注释）。

/**
 * 节点目录（复刻 H_.jsx:9423-9554 的 _i / vi）。
 *
 * 这是批量复刻 20+ 节点的「数据地基」：每个节点一行 { type, label, icon, cat, component, data, badge }，
 * 新增节点时只需在此登记，右键菜单 / 节点面板即可自动接入。
 *
 * 字段说明：
 *  - icon：工具栏小图标（lucide 组件引用，渲染时由调用方实例化）；
 *  - component：画布渲染组件（.jsx 组件引用），是 App.jsx nodeTypes 的**唯一派生源**
 *    （buildNodeTypeComponents() 单源，新增常规节点只需在此登记 component，勿再在 App.jsx 手写平行表）；
 *  - builtin：标记 = 已在 components/ 下复刻出对应 .jsx 的节点。
 *
 * 例外：director3dNode（依赖 WebGL + import.meta.glob，无法 SSR）与 ghostTarget（连线占位）不在此登记
 * component，由 App.jsx 派生后显式补充（新增此类「不可 SSR / 占位」节点才改 App.jsx）。
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
  // textNode（文本）与顶部 Q 快捷重复，子分类不再列出（由顶部快捷 + 节点面板添加）

  // --- 图片工具 ---
  // promptNode（图片/生图）与顶部 W 快捷重复，子分类不再列出
  { type: 'imageNode', label: '图片视频素材节点', icon: ImageIcon, cat: 'image', component: ImageNode, data: { images: [] }, builtin: true },
  { type: 'imageBoxNode', label: '图片盒子', icon: Box, cat: 'image', component: ImageBoxNode, data: { images: [], activeIndex: 0, expanded: false }, builtin: true },
  { type: 'gridSplitNode', label: '图片切分', icon: Grid3X3, cat: 'image', component: GridSplitNode, data: { imageUrl: '', extractedImages: [], rows: 3, cols: 3, splitMode: 'grid', hLines: [0.5], vLines: [0.5], lassoShapes: [], titlePattern: '#{num}', sendToImageBox: false }, builtin: true },
  { type: 'gridMergeNode', label: '图片拼图', icon: Grid2X2, cat: 'image', component: GridMergeNode, data: { mergeMode: 'grid', rows: 3, cols: 3, cellSize: 512, aspectRatio: '1:1', autoSize: true, titlePattern: '', longDirection: 'vertical', longGap: 0, longTargetSize: 1024, longAutoSize: true, bgColor: 'transparent', overlayState: { layers: [], canvasWidth: 1024, canvasHeight: 1024, bgColor: 'transparent' } }, builtin: true },
  { type: 'panoramaNode', label: '全景图', icon: Globe, cat: 'image', component: PanoramaNode, builtin: true, data: { panoType: 'sphere', highQuality: false, aspectRatio: '16:9', imageUrl: '' } },
  { type: 'director3dNode', label: '3D导演台', icon: Film, cat: 'image' },
  { type: 'faceMosaicNode', label: '人脸打码', icon: Shuffle, cat: 'image', component: FaceMosaicNode, builtin: true, data: { mode: 'mosaic', strength: 0.5, color: '#000000', imageUrls: [] } },
  { type: 'loopNode', label: '循环生成', icon: Repeat, cat: 'image', component: LoopNode, builtin: true, data: { splitMethod: 'newline' } },

  // --- 视频工具 ---
  // discountVideoNode（特惠视频）与顶部 E 快捷重复，子分类不再列出
  { type: 'videoExtractNode', label: '视频抽帧', icon: ImageDown, cat: 'video', component: VideoExtractNode, builtin: true, data: { videoUrl: '', videoName: '' } },
  { type: 'videoProcessNode', label: '视频处理', icon: Wand2, cat: 'video', component: VideoProcessNode, badge: { text: 'NEW', tone: 'new' }, builtin: true, data: { mode: 'trim', sourceOrder: [], timelineTracks: [], audioFormat: 'm4a', trimStart: 0, trimEnd: 4, resizeWidth: 1280, resizeHeight: 720, targetFps: 30 } },

  // --- 其他工具 ---
  { type: 'group', label: '编组', icon: FolderTree, cat: 'other', component: GroupNode, builtin: true },
  { type: 'scriptBoxNode', label: '剧本盒子', icon: Clapperboard, cat: 'other', component: ScriptBoxNode, builtin: true, data: { step: 1, story: '', globalStyle: '', shots: [], assets: [] } }
]

/** 顶部快捷（Q/W/E）专属、不进入子分类展示、但仍可创建的内置节点 */
const HIDDEN_TOP_LEVEL_NODES = [
  { type: 'textNode', label: '文本', cat: 'text', component: TextNode, data: { text: '' } },
  { type: 'promptNode', label: '图片', cat: 'image', component: PromptNode, data: { prompt: '' } },
  { type: 'discountVideoNode', label: '特惠视频', cat: 'video', component: DiscountVideoNode, data: { prompt: '' } }
]

// 便捷：按 type 查目录项
// 注意：顶部 QWE 快捷创建的 textNode/promptNode/discountVideoNode 已从子分类展示移出，
// 但仍是合法可创建节点（AI 工具 create_node 校验、defaultNodeData 兜底依赖这里），故单独补一份。
export const getPaletteNode = (type) =>
  paletteNodes.find((n) => n.type === type) ||
  HIDDEN_TOP_LEVEL_NODES.find((n) => n.type === type)

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

/**
 * 由 palette 目录单源派生 { type → 画布渲染组件 }，供 App.jsx 注册 React Flow nodeTypes。
 * 消除了 App.jsx 手写平行表（新增节点只需在 palette 登记 component，不再双维护）。
 *
 * 注意：
 *  - 遍历「全部」palette 项（含无 builtin 标记的项），不能只取 builtin；
 *  - 顶部快捷 HIDDEN（textNode/promptNode/discountVideoNode）必须并入，否则画布渲染崩；
 *  - 无 component 字段的项会被跳过（目前仅 director3dNode：依赖 WebGL 无法 SSR，重依赖不进 palette）；
 *  - ghostTarget 是连线占位节点、director3dNode 是 WebGL 重节点，均由 App.jsx 在派生结果后补充。
 */
export function buildNodeTypeComponents() {
  const map = {}
  const all = [...paletteNodes, ...HIDDEN_TOP_LEVEL_NODES]
  for (const n of all) {
    if (n.component) map[n.type] = n.component
  }
  return map
}
