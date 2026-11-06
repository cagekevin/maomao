/**
 * 节点结构默认值单源表 + 补齐函数。
 *
 * 【职责】各节点类型「结构默认」单源：addNode 新建、快照加载还原都复用，避免
 * 「右键/菜单新建」与「历史快照还原」两套路径字段不一致（如 group 缺 style/className）。
 *
 * 仅放与视觉/结构相关、缺失会出问题的字段：width/height/style/initialWidth/initialHeight/className/data.label。
 * 内容对齐原 App.jsx 的 NODE_TYPE_DEFAULTS。
 *
 * 【2026-11-05 职责升级：几何是「框选命中」的必要条件，不只是视觉】
 * 画布开 `onlyRenderVisibleElements` ⇒ 视口外节点不渲染、无 `measured`；React Flow `getNodesInside`
 * 对缺 `handleBounds` 的节点**无条件判进框选**，`App.tsx` 的守卫只能靠 `measured ?? width ?? initialWidth`
 * 二次校验 —— **字段缺失就只能放行 ⇒ 该节点每次框选都被误选**。故本表从「补视觉默认」升级为
 * 「**每个可框选类型在创建那一刻就有几何**」：新建（`App.addNode`）/ 派生（`commitNewNodes`）/
 * 克隆（`duplicateSelectedWithEdges`）/ 粘贴（`App.pasteNodeGroup`）/ AI 建节点（`buildCreateNode`）
 * 全部走 `applyNodeTypeDefaults`。`assetNode` 因 TD-16-48 不进表，走 `resolveAssetNodeSize` 分档。
 * 取值 = 该节点 `<NodeShell>` 的渲染期兜底值 ⇒ **零布局变化**；存量「只有 style 没有 width 字段」
 * 的节点沿用 style 值，不缩回表默认（见函数体内注释）。
 *
 * 【与 nodeDataSchema 的分工（2026-09-12 起，别混用 —— 这是真分缝）】
 *  - 本表 = **结构默认**：新建与**快照还原**都补（缺了尺寸塌陷/父子关系丢）。
 *  - `nodeDataSchema.NODE_DATA_DEFAULTS` = **data 初值**：**只在新建那一刻注入**。
 *    ⚠️ 绝不能在快照还原时注入 data 默认值 —— 那会覆盖存量节点的真实 data（用户内容）。
 *    两者合并成一张表看似更收敛，实则会诱导后人用同一函数处理两种时机 → 静默覆盖用户数据，故刻意分开。
 */

import type { NodeTypeKey } from '@/components/base/core/contracts';

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
] as const satisfies readonly NodeTypeKey[];
// 注：原含 templateNode，已于 2026-09-11 摘除（TD-04-5）——它是参考蓝本非活节点，不在画布上。

/**
 * 各节点类型结构默认值（对齐官方 + 历史修复；键受 `NodeTypeKey` 约束 · TD-04-66）
 *
 * 【为什么每个可框选类型都必须有 width/height（2026-11-05 · 框选误选治本）】
 * 画布开了 `onlyRenderVisibleElements`：视口外节点**不渲染 ⇒ 不测量**，`measured` 永远是 undefined。
 * 而 React Flow `getNodesInside()` 把「无 handleBounds」的节点**无条件判进框选**（`forceInitialRender`），
 * 上一轮加的守卫（`selectionGuard`）只能靠 `measured ?? width ?? initialWidth` 做二次几何校验 ——
 * **节点上没有这几个字段时守卫只能放行** ⇒ 该节点每次框选都被误选。
 * 真实快照取证：807 个落盘节点里 66 个「几何全无」，100% 是 `textGenerateNode`（无 aspectRatio
 * ⇒ `useSizeSync` 直接 return、从不写回尺寸）；其余类型"碰巧"有几何，靠的是渲染副作用
 * （`useSizeSync` 写回 / `NodeResizer` 拖拽写回），**不是**创建时就写。
 *
 * 故本表的职责升级为：**每个可框选类型在创建那一刻就有几何**（新建/派生/快照还原/粘贴全走本表）。
 * 取值 = 该节点 `<NodeShell>` 的渲染期兜底（`width ?? 420` / `height ?? defaultHeight`），
 * **与不填时的实际渲染尺寸一致 ⇒ 零布局变化**；一旦真实渲染测得更大尺寸，`useSizeSync` 会覆盖它。
 */
export const NODE_TYPE_DEFAULTS: Partial<Record<NodeTypeKey, NodeTypeDefault>> = {
  imageGenerateNode: { width: 420, height: 420, style: { width: 420, height: 420 } },
  textGenerateNode: { width: 420, height: 320, style: { width: 420, height: 320 } },
  // 【area-fixed 类节点取「稳态渲染值」而非首帧兜底值】`VideoGenerate` 是 `sizeMode="area-fixed"` +
  // `aspectRatio`（默认 16:9），`useSizeSync` 会把它覆盖成 `computeSizeSync` 的结果
  // = `round(sqrt(16/9)*380) × round(380/sqrt(16/9))` ≈ 507×285（`NODE_AREA_FIXED_BASE_SIZE=380`）。
  // 填这个值 ⇒ 首帧即为稳态尺寸（不填反而先渲染 380×420 再跳），且框选几何与真实渲染一致。
  videoGenerateNode: { width: 507, height: 285, style: { width: 507, height: 285 } },
  imageBoxNode: { width: 420, height: 420, style: { width: 420, height: 420 } },
  gridSplitNode: { width: 280, height: 420, style: { width: 280, height: 420 } },
  gridMergeNode: { width: 420, height: 420, style: { width: 420, height: 420 } },
  panoramaNode: { width: 420, height: 360, style: { width: 420, height: 360 } },
  loopNode: { width: 420, height: 280, style: { width: 420, height: 280 } },
  videoExtractNode: { width: 420, height: 420, style: { width: 420, height: 420 } },
  faceMosaicNode: { width: 420, height: 420, style: { width: 420, height: 420 } },
  scriptBoxNode: { width: 900, height: 600, style: { width: 900, height: 600 } },
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

/* `withNodeSize` / `NodeSizePatch` 已于 2026-09-19（S2-1b-pre）**下沉横切层**：
 *   → `src/components/base/core/nodeSizePatch.ts`
 * 原因：它是纯数据形态原语、零画布语义，而消费方横跨横切（`base/core/uiHooks` · `hooks/useArrangeCanvas`）
 *      与域（`canvas/groupNodes`）⇒ 留在画布域会让 `base/core` 反向依赖业务域（违反规则 2）。
 * 依「依赖只能指向更稳定的方向」，原语下沉；域消费横切是正确单向。详见新文件头注。 */

/**
 * `assetNode` 的几何兜底（**不进 `NODE_TYPE_DEFAULTS`**，见上面 TD-16-48 的说明）。
 *
 * 【为什么需要它（2026-11-05 框选误选治本）】`assetNode` 是用户画布的绝对主体（真实快照 96 节点里 69 个），
 * 但它此前只在「造节点点」带 `style`（`ASSET_NODE_SIZE` 分档），**`NodePalette` 新建 / 粘贴 / 克隆**
 * 都不保证带尺寸 ⇒ 落盘后无几何 ⇒ 框选守卫 `geometryOf` 返回 null ⇒ 每次框选被误选。
 *
 * 【取值优先级（避免与既有 style 打架）】`node.width/height` → `node.style.width/height` →
 * `data.assetType` 对应 `ASSET_NODE_SIZE` 档位 → 缺省 `image` 档。
 * 前两者已存在时**原样沿用**（造节点点写的那一档优先，本函数不覆盖）。
 */
export function resolveAssetNodeSize(node: Record<string, unknown>): {
  width: number;
  height: number;
} {
  const style = (node['style'] as Record<string, unknown>) || {};
  const data = (node['data'] as Record<string, unknown>) || {};
  const tier = ASSET_NODE_SIZE[String(data['assetType'] || '') as keyof typeof ASSET_NODE_SIZE];
  const fallback = tier ?? ASSET_NODE_SIZE.image;
  // 逐维取值（不是整对取）：真实快照里存在「style 只有 width 没有 height」的半残形态，
  // 整对回退会把已有 width 换成档位值 ⇒ 与 style 打架（正是三写不变量要防的事）。
  const pick = (a: unknown, b: unknown, fb: number): number => {
    const x = Number(a);
    if (Number.isFinite(x) && x > 0) return x;
    const y = Number(b);
    if (Number.isFinite(y) && y > 0) return y;
    return fb;
  };
  return {
    width: pick(node['width'], style['width'], fallback.width),
    height: pick(node['height'], style['height'], fallback.height),
  };
}

/**
 * `applyNodeTypeDefaults` 会**按需补**的结构字段（**全可选**：仅在原缺时填，已有值不覆盖）。
 * 声明为可选 = 如实反映"补或不补取决于原对象与类型表"，不做假承诺（一诚实）。
 */
export interface NodeStructuralDefaults {
  width?: number;
  height?: number;
  initialWidth?: number;
  initialHeight?: number;
  className?: string;
  style?: Record<string, unknown>;
}

/**
 * 对已有 node 补缺失的结构默认（不覆盖已存在的字段），返回新 node 对象。
 * 纯函数，由 App.addNode 新建与快照加载还原复用。
 *
 * 【泛型 T（2026-09-19 · TD-24-5 母体收口）】原签名 `(Record<string, unknown>) => Record<string, unknown>`
 * 把入参的具体形状**擦除**了 ⇒ 3 个调用点只能 `applyNodeTypeDefaults(n) as unknown as Node`
 * 硬转回来（双重断言，绕过类型系统）。改泛型后**入参类型原样保留**：
 *   - 传 `Node` → 返回 `Node & NodeStructuralDefaults`（`deriveNodes.ts` 的 `as unknown as` 直接消失）；
 *   - 传 `Record<string, unknown>` → 返回同类型（**不谎称是 `Node`**，转换责任仍归调用方）。
 * 返回 `T & NodeStructuralDefaults` 是**生产者的诚实契约**：它确实会补这些字段（见 §决议），
 * 声明出来调用方/测试即可直接访问，不必各自再断言（此前测试靠"类型被擦除"才写得出）。
 * 运行时行为**零变化**（实现体本就是浅拷贝 + 按需补字段，与本改动无关）。
 * @param node 待补齐的节点对象
 * @returns 补齐默认后的新节点（形状 = T + 可补字段；未补任何字段时也返回浅拷贝新对象）
 */
export function applyNodeTypeDefaults<T extends Record<string, unknown>>(
  node: T,
): T & NodeStructuralDefaults {
  const type = String(node['type'] || '');
  // assetNode：**不进表**（TD-16-48），但同样要在创建/还原时带上几何（2026-11-05 框选治本）。
  // 走 `resolveAssetNodeSize` 逐维取值 ⇒ 造节点点已写的 style 档位优先、只补缺失维，不会与既有 style 打架。
  if (type === 'assetNode') {
    const size = resolveAssetNodeSize(node as Record<string, unknown>);
    const next: Record<string, unknown> = { ...node };
    if (next['width'] === undefined || next['width'] === null) next['width'] = size.width;
    if (next['height'] === undefined || next['height'] === null) next['height'] = size.height;
    const style = (next['style'] as Record<string, unknown>) || {};
    next['style'] = {
      ...style,
      width: (style['width'] as number | undefined) ?? size.width,
      height: (style['height'] as number | undefined) ?? size.height,
    };
    return next as T;
  }
  const d = NODE_TYPE_DEFAULTS[type as NodeTypeKey];
  if (!d) return node;
  const next: Record<string, unknown> = { ...node };
  const data = (node['data'] as Record<string, unknown>) || {};
  // 折叠态已整体下线，expandedWidth/expandedHeight 为死字段，不再特判兜底（见 GroupNode.tsx 头注释）。
  // 【存量「只有 style 没有 width 字段」的节点必须沿用 style 的值】NodeShell 与 React Flow 的
  // `getNodeInlineStyleDimensions` 都按 `width ?? style.width`（**字段优先**）—— 若这里填表默认，
  // 那个原本靠 style 撑到 600 的旧节点会当场缩到 420（布局回归）。故取值口径与
  // `resolveAssetNodeSize` 一致：已存在字段 → 已存在 style → 表默认。
  const styleNum = (v: unknown): number | undefined => {
    const x = Number(v);
    return Number.isFinite(x) && x > 0 ? x : undefined;
  };
  const existingStyle = (next['style'] as Record<string, unknown>) || {};
  const fallbackW = styleNum(existingStyle['width']) ?? d.width;
  const fallbackH = styleNum(existingStyle['height']) ?? d.height;
  // 尺寸/style/initial 只在缺失时补（存量快照若已有正确值则不覆盖）
  for (const k of ['width', 'height', 'initialWidth', 'initialHeight', 'className']) {
    if (next[k] === undefined || next[k] === null) {
      next[k] =
        k === 'width' ? fallbackW : k === 'height' ? fallbackH : (d as Record<string, unknown>)[k];
    }
  }
  next['style'] = next['style']
    ? { ...d['style'], ...(next['style'] as Record<string, unknown>) }
    : d['style'] || next['style'];
  // group 显示名源头收敛（2026-09-12 九轮）：唯一字段 = data.label。
  // 旧快照/旧建组路径可能只有 data.name（TD-04-14 前）——这里是迁移点：把 name 收敛进 label
  // 并**删除遗留 name**，让「名字双字段」在数据模型层消亡（此前保留 name 属末端兼容，非源头收敛）。
  if (type === 'group') {
    const legacyName = data['name'] as string | undefined;
    const { name: _dropLegacyName, ...restData } = data;
    next['data'] = {
      ...restData,
      label: (data['label'] as string | undefined) ?? legacyName ?? '编组',
    };
  }
  // 出口回 `T`：函数体内部一律按宽 `Record<string,unknown>` 操作（要按 key 动态补字段），
  // 但**入参形状未变、只在缺失时补字段** ⇒ 返回对象仍是 T 的形状。
  // 这里只需**单次**断言（`as T`），不再是调用点那种 `as unknown as Node` 的**双重**断言
  // —— 后者连"它是不是 Node"都绕过了（TD-24-5 治的就是它）。
  return next as T;
}
