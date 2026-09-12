import 'react';
import type React from 'react';
import {
  Image as ImageIcon,
  Clapperboard,
  Box,
  Repeat,
  Grid3X3,
  Globe,
  Film,
  Shuffle,
  ImageDown,
  Wand2,
  Grid2X2,
  FolderTree,
} from 'lucide-react';
// 画布渲染组件引用（component 字段用于 App.jsx 派生 nodeTypes，避免双维护平行表）。
// 注意：节点组件均不反向 import 本文件，故无循环依赖（已验证）。
import TextGenerate from '../../nodes/TextGenerate.tsx';
import AssetNode from '../../nodes/AssetNode.tsx';
import LoopNode from '../../nodes/LoopNode.tsx';
import ImageGenerate from '../../nodes/ImageGenerate.tsx';
import VideoGenerate from '../../nodes/VideoGenerate.tsx';
import VideoExtractNode from '../../nodes/VideoExtractNode.tsx';
import ImageBoxNode from '../../nodes/ImageBoxNode.tsx';
import GridSplitNode from '../../nodes/GridSplitNode.tsx';
import GridMergeNode from '../../nodes/GridMergeNode.tsx';
import FaceMosaicNode from '../../nodes/FaceMosaicNode.tsx';
import GroupNode from '../../nodes/GroupNode.tsx';
import ScriptBoxNode from '../../nodes/ScriptBoxNode.tsx';
// 重依赖节点（3D / 视频处理）**不在此静态 import**：静态 import 会让 vendor-3d(1.06MB) 与
// vendor-media(705KB) 在首屏被强制下载（manualChunks 只拆文件、不改变加载时机）。
// 统一走 lazyNode 动态 import，仅在对应节点首次渲染时才拉 chunk。见 ./lazyNode.jsx。
// 【勿加回静态 import】加回即首屏 +1.7MB，且 tests/unit/lazyNode.test.jsx 会红。
import { lazyNode, HEAVY_NODE_LOADERS } from './lazyNode.tsx';
// 「有输入面板」节点类型集合（Tab 折叠 / Ctrl+L 整理 / defaultNodeData 的 expanded 注入共用同一范围）
import { INPUT_PANEL_NODE_TYPES } from './nodeDefaults.ts';

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
 * 重依赖节点（3D 引擎 / 视频处理）在此登记的 component 由 lazyNode() 包装：仍是单源派生，
 * 但组件本体走动态 import，仅在该类型节点首次渲染时才下载对应 chunk（见 ./lazyNode.jsx）。
 * 仅 ghostTarget（连线占位，非真实节点）不在此登记，由 App.jsx 派生后显式补充。
 */

/**
 * 工具栏/右键菜单分类 tab（type → 显示名）。UI 图标由各项自带，分类只作分组键。
 */
export interface PaletteCategoryDef {
  key: string;
  label: string;
}

/**
 * 节点目录项（palette 注册表元素）—— 全 17 节点注册表的**类型真源**。
 *
 * 【为什么补此接口（TD-04-6）】此前 paletteNodes 无类型标注（裸数组推断），
 * 致消费方（canvasContextMenu）拿不到稳定形状、被迫 `n as unknown as PaletteNodeRef`
 * 假收窄。定型后 getPaletteNode 返回真类型，下游按字段读即可。
 *
 * 字段可选性依据实际登记形态：
 *  - icon/data/badge/builtin 可选（HIDDEN 顶部快捷项无 icon/badge/builtin；多数节点无 badge）；
 *  - component 可选（ghostTarget 类连线占位不登记 component，由 App 派生后显式补）。
 */
export interface PaletteNodeDef {
  /** 画布 node.type / contracts.NODE_TYPES 键 */
  type: string;
  /** 菜单/面板显示名 */
  label: string;
  /** 工具栏小图标（lucide 组件引用，渲染时由调用方实例化） */
  icon?: React.ComponentType<{ size?: number; className?: string }>;
  /** 分类键（paletteCategories.key） */
  cat: string;
  /** 画布渲染组件（buildNodeTypeComponents 的单源派生源；连占位类节点可省略=由 App 补）。
   *  类型用 `ComponentType<any>`：各节点组件的 props 是各自的 `XxxNodeProps`（id/data/selected），
   *  同构但 data 具体类型不同，无法收敛为单一精确类型；此处与 `lazyNode` 的 loader 契约一致放宽
   *  （属「异构组件注册表」的诚实放宽，非假收窄——字段形状本身（有/无 component）仍是精确的）。 */
  component?: React.ComponentType<any>;
  /** 新建节点默认 data（defaultNodeData 合并源） */
  data?: Record<string, unknown>;
  /** 角标（如 NEW/Beta） */
  badge?: { text: string; tone: 'new' | 'hot' };
  /** =已在 components/nodes 下复刻出对应组件的节点 */
  builtin?: boolean;
}

// 四个工具分类 tab（复刻 H_.jsx vi）
export const paletteCategories: PaletteCategoryDef[] = [
  { key: 'text', label: '文本工具' },
  { key: 'image', label: '图片工具' },
  { key: 'video', label: '视频工具' },
  { key: 'other', label: '其他工具' },
];

// 完整节点目录（复刻 H_.jsx _i，图标用 lucide 等价）
export const paletteNodes: PaletteNodeDef[] = [
  // --- 文本工具 ---
  // textGenerateNode（文本）与顶部 Q 快捷重复，子分类不再列出（由顶部快捷 + 节点面板添加）

  // --- 图片工具 ---
  // imageGenerateNode（图片/生图）与顶部 W 快捷重复，子分类不再列出
  {
    type: 'assetNode',
    label: '图片视频素材节点',
    icon: ImageIcon,
    cat: 'image',
    component: AssetNode,
    // 注：曾在此声明 data:{ images: [] }，但 AssetNode 既不读也不写 images
    // （其字段为 assetUrl/url/assetType/text/poster…）→ 幽灵默认值，每个新建素材节点
    // 白背一个空数组并随快照落盘。2026-09-11 数据体检删除（见 scripts/check-node-data.mjs）。
    builtin: true,
  },
  {
    type: 'imageBoxNode',
    label: '图片盒子',
    icon: Box,
    cat: 'image',
    component: ImageBoxNode,
    data: { images: [], activeIndex: 0, expanded: false },
    builtin: true,
  },
  {
    type: 'gridSplitNode',
    label: '图片切分',
    icon: Grid3X3,
    cat: 'image',
    component: GridSplitNode,
    data: {
      assetUrl: '',
      extractedImages: [],
      rows: 3,
      cols: 3,
      splitMode: 'grid',
      hLines: [0.5],
      vLines: [0.5],
      lassoShapes: [],
      titlePattern: '#{num}',
      sendToImageBox: false,
    },
    builtin: true,
  },
  {
    type: 'gridMergeNode',
    label: '图片拼图',
    icon: Grid2X2,
    cat: 'image',
    component: GridMergeNode,
    data: {
      mergeMode: 'grid',
      rows: 3,
      cols: 3,
      cellSize: 512,
      aspectRatio: '1:1',
      autoSize: true,
      titlePattern: '',
      longDirection: 'vertical',
      longGap: 0,
      longTargetSize: 1024,
      longAutoSize: true,
      bgColor: 'transparent',
      overlayState: { layers: [], canvasWidth: 1024, canvasHeight: 1024, bgColor: 'transparent' },
    },
    builtin: true,
  },
  // 以下三项为重依赖（three / mediabunny），component 用 lazyNode 包动态 import：
  // palette 仍持 component（保持「单源派生」），但组件本体按需加载，不进首屏。
  {
    type: 'panoramaNode',
    label: '全景图',
    icon: Globe,
    cat: 'image',
    component: lazyNode(HEAVY_NODE_LOADERS.panoramaNode, { label: '全景图', type: 'panoramaNode' }),
    builtin: true,
    data: { aspectRatio: '16:9', assetUrl: '' },
  },
  {
    type: 'director3dNode',
    label: '3D导演台',
    icon: Film,
    cat: 'image',
    component: lazyNode(HEAVY_NODE_LOADERS.director3dNode, {
      label: '3D导演台',
      type: 'director3dNode',
    }),
  },
  {
    type: 'faceMosaicNode',
    label: '人脸打码',
    icon: Shuffle,
    cat: 'image',
    component: FaceMosaicNode,
    builtin: true,
    data: { mode: 'mosaic', strength: 0.5, color: '#000000', assetUrls: [] },
  },
  {
    type: 'loopNode',
    label: '循环生成',
    icon: Repeat,
    cat: 'image',
    component: LoopNode,
    builtin: true,
    data: { splitMethod: 'newline' },
  },

  // --- 视频工具 ---
  // videoGenerateNode（视频生成）与顶部 E 快捷重复，子分类不再列出
  {
    type: 'videoExtractNode',
    label: '视频抽帧',
    icon: ImageDown,
    cat: 'video',
    component: VideoExtractNode,
    builtin: true,
    // videoUrl/videoName 是**输入类字段的外部注入通道**（可被 Agent update_node_any_field /
    // 快照 / 测试预置），本节点自己不写回（上传走 blob 预览 / 上游实时读 connected）。
    // 保留空默认值同时起「向 AI 声明该字段存在」的作用（get_node_details 能看到）。
    // 2026-09-11 数据体检：曾判定为幽灵字段并删除 → 误伤 6 个测试的预置入口，已回退（见 TD-9 附件）。
    data: { videoUrl: '', videoName: '' },
  },
  {
    type: 'videoProcessNode',
    label: '视频处理',
    icon: Wand2,
    cat: 'video',
    component: lazyNode(HEAVY_NODE_LOADERS.videoProcessNode, {
      label: '视频处理',
      type: 'videoProcessNode',
    }),
    badge: { text: 'NEW', tone: 'new' },
    builtin: true,
    data: {
      mode: 'trim',
      sourceOrder: [],
      timelineTracks: [],
      audioFormat: 'm4a',
      // 注：trimStart/trimEnd 已删（2026-09-11 数据体检）——VideoProcessNode 全文无
      // data.trimStart/data.trimEnd 读取，属死默认值，白进每个新建节点的快照。
      resizeWidth: 1280,
      resizeHeight: 720,
      targetFps: 30,
    },
  },

  // --- 其他工具 ---
  {
    type: 'group',
    label: '编组',
    icon: FolderTree,
    cat: 'other',
    component: GroupNode,
    builtin: true,
  },
  {
    type: 'scriptBoxNode',
    label: '剧本盒子',
    icon: Clapperboard,
    cat: 'other',
    component: ScriptBoxNode,
    builtin: true,
    data: { step: 1, story: '', globalStyle: '', shots: [], assets: [] },
  },
];

/** 顶部快捷（Q/W/E）专属、不进入子分类展示、但仍可创建的内置节点 */
const HIDDEN_TOP_LEVEL_NODES: PaletteNodeDef[] = [
  {
    type: 'textGenerateNode',
    label: '文本',
    cat: 'text',
    component: TextGenerate,
    data: { text: '' },
  },
  {
    type: 'imageGenerateNode',
    label: '图片',
    cat: 'image',
    component: ImageGenerate,
    data: { prompt: '' },
  },
  {
    type: 'videoGenerateNode',
    label: '视频生成',
    cat: 'video',
    component: VideoGenerate,
    data: { prompt: '' },
  },
];

// 便捷：按 type 查目录项
// 注意：顶部 QWE 快捷创建的 textGenerateNode/imageGenerateNode/videoGenerateNode 已从子分类展示移出，
// 但仍是合法可创建节点（AI 工具 create_node 校验、defaultNodeData 兜底依赖这里），故单独补一份。
export const getPaletteNode = (type: string): PaletteNodeDef | undefined =>
  paletteNodes.find((n) => n.type === type) || HIDDEN_TOP_LEVEL_NODES.find((n) => n.type === type);

// 便捷：按分类取节点
export const getNodesByCategory = (cat: string): PaletteNodeDef[] =>
  paletteNodes.filter((n) => n.cat === cat);

// 便捷：默认节点 data（用于右键菜单 / 面板快速添加 / Agent create_node）
// expanded 只注入「有输入面板」的节点（INPUT_PANEL_NODE_TYPES）→ 新建节点输入框默认收起。
// 2026-09-11 数据体检：此前无条件注入 expanded:false，但只有这 4 类节点会读它
// （useNodeExpanded 的调用方），其余 13 种节点白背一个永不读的 UI 偏好字段并随快照落盘。
// 范围与 Ctrl+L 整理（useArrangeCanvas）/ Tab 折叠（App.toggleInputPanels）同源，避免三处不对称。
// 子项仍可在 palette 的 data 里显式传 expanded 覆盖（如 imageBoxNode 自带展开态）。
export const defaultNodeData = (type: string): Record<string, unknown> => ({
  ...(INPUT_PANEL_NODE_TYPES.includes(type as (typeof INPUT_PANEL_NODE_TYPES)[number])
    ? { expanded: false }
    : {}),
  ...getPaletteNode(type)?.data,
});

// 已复刻节点的类型集合
export const builtinNodeTypes = paletteNodes.filter((n) => n.builtin).map((n) => n.type);

/**
 * 由 palette 目录单源派生 { type → 画布渲染组件 }，供 App.jsx 注册 React Flow nodeTypes。
 * 消除了 App.jsx 手写平行表（新增节点只需在 palette 登记 component，不再双维护）。
 *
 * 注意：
 *  - 遍历「全部」palette 项（含无 builtin 标记的项），不能只取 builtin；
 *  - 顶部快捷 HIDDEN（textGenerateNode/imageGenerateNode/videoGenerateNode）必须并入，否则画布渲染崩；
 *  - 无 component 字段的项会被跳过（目前仅 ghostTarget：连线占位，非真实节点）；
 *  - 重依赖节点的 component 是 lazyNode 包装的懒加载组件，派生进 nodeTypes 后自动按需加载；
 *  - ghostTarget 由 App.jsx 在派生结果后补充。
 */
export function buildNodeTypeComponents(): Record<string, React.ComponentType<any>> {
  const map: Record<string, React.ComponentType<any>> = {};
  const all = [...paletteNodes, ...HIDDEN_TOP_LEVEL_NODES];
  for (const n of all) {
    if (n.component) map[n.type] = n.component;
  }
  return map;
}
