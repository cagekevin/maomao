/**
 * 节点结构默认值单源表 + 补齐函数。
 *
 * 【职责】各节点类型「结构默认」单源：addNode 新建、快照加载还原都复用，避免
 * 「右键/菜单新建」与「历史快照还原」两套路径字段不一致（如 group 缺 style/className）。
 *
 * 仅放与视觉/结构相关、缺失会出问题的字段：width/height/style/initialWidth/initialHeight/className/data.label。
 * 内容对齐原 App.jsx 的 NODE_TYPE_DEFAULTS。
 *
 * 【与 nodeDataSchema 的分工（2026-09-12 起，别混用 —— 这是真分缝）】
 *  - 本表 = **结构默认**：新建与**快照还原**都补（缺了尺寸塌陷/父子关系丢）。
 *  - `nodeDataSchema.NODE_DATA_DEFAULTS` = **data 初值**：**只在新建那一刻注入**。
 *    ⚠️ 绝不能在快照还原时注入 data 默认值 —— 那会覆盖存量节点的真实 data（用户内容）。
 *    两者合并成一张表看似更收敛，实则会诱导后人用同一函数处理两种时机 → 静默覆盖用户数据，故刻意分开。
 */

/** 节点类型「结构默认」形状（缺字段缺失时才补，见 applyNodeTypeDefaults） */
interface NodeTypeDefault {
  width?: number;
  height?: number;
  style?: Record<string, unknown>;
  initialWidth?: number;
  initialHeight?: number;
  className?: string;
}

/**
 * 有输入面板（ExpandablePanel）的节点类型：Tab 折叠 / Ctrl+L 整理共用同一范围。
 * 收口「哪些节点有可收起的配置面板」为单一真源，杜绝 Tab 与 arrange 范围不对称。
 */
export const INPUT_PANEL_NODE_TYPES = [
  'textGenerateNode',
  'imageGenerateNode',
  'videoGenerateNode',
] as const;
// 注：原含 templateNode，已于 2026-09-11 摘除（TD-04-5）——它是参考蓝本非活节点，不在画布上。

/** 各节点类型结构默认值（对齐官方 + 历史修复） */
export const NODE_TYPE_DEFAULTS: Record<string, NodeTypeDefault> = {
  imageGenerateNode: { width: 420, height: 420, style: { width: 420, height: 420 } },
  gridSplitNode: { width: 280, style: { width: 280 } },
  videoProcessNode: { width: 520, height: 620, style: { width: 520, height: 620 } },
  director3dNode: { width: 420, height: 300, style: { width: 420, height: 300 } },
  group: {
    width: 300,
    height: 200,
    style: { width: 300, height: 200 },
    initialWidth: 300,
    initialHeight: 200,
    className: 'yimao-group-node',
  },
};

/**
 * `assetNode` 造节点尺寸（**按媒体形态分档**）—— 造资产节点者的**唯一尺寸来源**。
 *
 * 【为什么它不放进 `NODE_TYPE_DEFAULTS`（TD-16-48 · 2026-09-18 取证）】后者是 `applyNodeTypeDefaults`
 * 用的表，而那个函数**快照还原也走**、且只认**单一档位**（缺字段就补表里的值）。`assetNode` 的造节点
 * 尺寸**随媒体形态变**（视频/音频/图片/宫格单元各不相同）—— 强行登记一档会让 `applyNodeTypeDefaults`
 * 用表里的 `width/height` 去配调用方 `style` 里的**另一档** ⇒ **字段与 style 互相打架**，
 * 正是「三写不变量」（见本文件 `withNodeSize`）要防的事。故这里只做**单源常量**。
 *
 * 【值从哪来】逐字取自既有的 8 处造节点点（**零布局变化**是硬约束）：视频 420×380（`expanded:true`）、
 * 音频 320×200、图片 360×260、宫格单元 320×320。**改这里 = 改所有造节点点的默认尺寸（有布局影响）**。
 */
export const ASSET_NODE_SIZE = {
  /** 视频资产（`VideoProcessNode` 抽帧 / `depthVideo` 转深度，均 `expanded:true`） */
  video: { width: 420, height: 380 },
  /** 音频资产（`VideoProcessNode` 抽音轨，`expanded:false`） */
  audio: { width: 320, height: 200 },
  /** 图片资产（`VideoProcessNode` 转 GIF / `FaceMosaic` 打码结果） */
  image: { width: 360, height: 260 },
  /** 宫格单元（`GridSplit` 拆图 / `GridMerge` 合并，与 330 的宫格间距配套） */
  gridCell: { width: 320, height: 320 },
} as const;

/** `imageBoxNode` 造节点尺寸（图盒：导演台「转图盒」/ 全景「转图盒」共用同一档） */
export const IMAGE_BOX_NODE_SIZE = { width: 420, height: 420 } as const;

/** `withNodeSize` 产出的尺寸补丁（三写不变量：字段 width/height + style.width/height，可选 initial*） */ export interface NodeSizePatch {
  width: number;
  height: number;
  style: Record<string, unknown>;
  initialWidth?: number;
  initialHeight?: number;
}

/**
 * 节点尺寸「三写不变量」的唯一实现（TD-04-28 收口 · 母体 M7）。
 *
 * 【不变量】节点尺寸必须同时写 `width` / `height` **字段** 与 `style.width` / `style.height`。
 * 理由：`NodeShell` 根 div 读尺寸是 `n.width ?? n.style?.width`（**width 优先**）；只写 style 会让
 * root 尺寸与 React Flow wrapper（读 style）错位 → 端口/环绕错位，且落盘快照 width 与 style 不一致，
 * 刷新后尺寸塌成默认。
 *
 * 【为什么必须抽共享纯函数】该不变量此前被 3 处**各自手抄 + 注释自证**（`uiHooks.onMainBoxResize` /
 * `useArrangeCanvas` 排版写回 / `groupNodes` 建组），靠"约定"同步 = 典型 SSOT 第二份。批量写点
 * （排版 / 建组）无法走 per-node hook，故收敛为纯函数由各处委托。
 *
 * **返回尺寸补丁（不是整个 node）**，三种消费形态都自然：
 *  - `patchNodeById(setNodes, id, withNodeSize(node, w, h))` —— 合并式写回；
 *  - `{ ...node, ...withNodeSize(node, w, h) }` —— 展开式写回（只覆盖尺寸键，不动 position/data）；
 *  - `withNodeSize({ id, type }, w, h, { includeInitial: true })` —— 新建节点全量构造。
 *
 * @param node     目标节点（读其既有 `style` 以保留其余键）
 * @param w        宽度
 * @param h        高度
 * @param opts.includeInitial 是否一并产出 `initialWidth/initialHeight`（**仅新建节点**需要，
 *        官方推荐「父节点有 style 尺寸时同时设 initial，保证首次测量前尺寸确定」；已有节点不需要）
 */
export function withNodeSize(
  node: Record<string, unknown>,
  w: number,
  h: number,
  opts: { includeInitial?: boolean } = {},
): NodeSizePatch {
  const patch: NodeSizePatch = {
    width: w,
    height: h,
    style: { ...((node.style as Record<string, unknown>) || {}), width: w, height: h },
  };
  if (opts.includeInitial) {
    patch.initialWidth = w;
    patch.initialHeight = h;
  }
  return patch;
}

/**
 * 对已有 node 补缺失的结构默认（不覆盖已存在的字段），返回新 node 对象。
 * 纯函数，由 App.addNode 新建与快照加载还原复用。
 * @param {object} node
 * @returns {object} 补齐默认后的新 node（未补任何字段时也返回浅拷贝新对象）
 */
export function applyNodeTypeDefaults(node: Record<string, unknown>): Record<string, unknown> {
  const type = String(node.type || '');
  const d = NODE_TYPE_DEFAULTS[type];
  if (!d) return node;
  const next: Record<string, unknown> = { ...node };
  const data = (node.data as Record<string, unknown>) || {};
  // 折叠态已整体下线，expandedWidth/expandedHeight 为死字段，不再特判兜底（见 GroupNode.tsx 头注释）。
  const fallbackW = d.width;
  const fallbackH = d.height;
  // 尺寸/style/initial 只在缺失时补（存量快照若已有正确值则不覆盖）
  for (const k of ['width', 'height', 'initialWidth', 'initialHeight', 'className']) {
    if (next[k] === undefined || next[k] === null) {
      next[k] =
        k === 'width' ? fallbackW : k === 'height' ? fallbackH : (d as Record<string, unknown>)[k];
    }
  }
  next.style = next.style
    ? { ...d.style, ...(next.style as Record<string, unknown>) }
    : d.style || next.style;
  // group 显示名源头收敛（2026-09-12 九轮）：唯一字段 = data.label。
  // 旧快照/旧建组路径可能只有 data.name（TD-04-14 前）——这里是迁移点：把 name 收敛进 label
  // 并**删除遗留 name**，让「名字双字段」在数据模型层消亡（此前保留 name 属末端兼容，非源头收敛）。
  if (type === 'group') {
    const legacyName = data.name as string | undefined;
    const { name: _dropLegacyName, ...restData } = data;
    next.data = {
      ...restData,
      label: (data.label as string | undefined) ?? legacyName ?? '编组',
    };
  }
  return next;
}
