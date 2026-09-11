/**
 * 节点结构默认值单源表 + 补齐函数。
 *
 * 【职责】各节点类型「结构默认」单源：addNode 新建、快照加载还原都复用，避免
 * 「右键/菜单新建」与「历史快照还原」两套路径字段不一致（如 group 缺 style/className）。
 *
 * 仅放与视觉/结构相关、缺失会出问题的字段：width/height/style/initialWidth/initialHeight/className/data.name。
 * 内容对齐原 App.jsx 的 NODE_TYPE_DEFAULTS。
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
  // group 兼容：旧快照用 data.name，统一收敛到全画布通用的 data.label（label ?? name 兜底）
  if (type === 'group') {
    next.data = {
      ...data,
      label: (data.label as string | undefined) ?? (data.name as string | undefined) ?? '编组',
    };
  }
  return next;
}
