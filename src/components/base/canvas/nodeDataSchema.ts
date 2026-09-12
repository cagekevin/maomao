/**
 * 节点 data 契约 · **默认值单一真源**（TD-02-7 主体，2026-09-12）。
 *
 * ════════════════════════════════════════════════════════════════
 * 【为什么单独立此模块】
 * 「新增一个节点类型时，它的 data 有哪些字段、初值是什么」这份知识此前住在
 * `NodePalette.ts` 的 `paletteNodes[].data` / `HIDDEN_TOP_LEVEL_NODES[].data` ——
 * 而 `NodePalette` 的职责是**UI 目录**（label/icon/分类/组件引用）。数据契约寄居在 UI 目录里，
 * 导致两类消费者被混在一起（菜单只想知道 label/icon，却要连带维护数据字段表），
 * 且与其余 4 处表述（节点 interface / NODE_OUTPUTS / nodeDefaults / 快照白名单）互不对账。
 * 现把**数据默认值**提到本模块；`NodePalette` 回归纯 UI 目录（不再持 `data`）。
 *
 * 【本模块 vs nodeDefaults.ts —— 别混用（lifecycle 不同，这是真分缝）】
 *   - 本模块（data 默认值）：**只在「新建节点那一刻」注入**（`defaultNodeData`）。
 *     ✗ 绝不在快照加载还原时注入 —— 否则会用默认值覆盖存量节点的真实 data。
 *   - `nodeDefaults.ts`（结构默认 width/height/style/initialWidth/className）：**新建与快照还原都补**
 *     （恢复渲染必需的结构字段，缺失即尺寸塌陷）。
 *   两者合并成一张表看似"更收敛"，实则会诱导后人用同一个函数处理两种时机 → 覆盖用户数据。
 *   故**刻意分开**，并在此互指。
 *
 * 【与「快照保留字段」的关系】`canvasSnapshotSchema.ts` 的 `NODE_KEEP` 里 `data` 是**整包透传**
 * （不做字段级裁剪）→ 本模块的字段集**不参与落盘裁剪**，只决定「新建时的初值」。
 * ════════════════════════════════════════════════════════════════
 */
import { INPUT_PANEL_NODE_TYPES } from './nodeDefaults.ts';

/**
 * 各节点类型的 data 默认值（**新建节点唯一真源**）。
 *
 * 规则：
 *  - 只登记「新建时确实需要初值」的字段。列表/字符串类给空值，枚举/数值给可用默认；
 *  - 不在本表出现的字段 = 新建时 undefined，由节点组件自身 `useState(data.x ?? 常量)` 兜底；
 *  - 幽灵默认值（节点既不读也不写、白背进快照）**禁止登记**——历史上 assetNode 的 `images: []`
 *    就属此类，2026-09-11 数据体检已删（见 `scripts/check-node-data.mjs`）；
 *  - 字段名必须与该节点文件的本地 `interface XxxData` 对齐（`check:node-data` 对账，--strict 门禁）。
 */
export const NODE_DATA_DEFAULTS: Record<string, Record<string, unknown>> = {
  // ── 图片工具 ──
  imageBoxNode: { images: [], activeIndex: 0, expanded: false },
  gridSplitNode: {
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
  gridMergeNode: {
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
  panoramaNode: { aspectRatio: '16:9', assetUrl: '' },
  // director3dNode / assetNode / group：无新建 data 字段（组名 data.label 由建组路径写，非新建默认）
  faceMosaicNode: { mode: 'mosaic', strength: 0.5, color: '#000000', assetUrls: [] },
  loopNode: { splitMethod: 'newline' },

  // ── 视频工具 ──
  // videoUrl/videoName 是**输入类字段的外部注入通道**（可被 Agent update_node_any_field / 快照 / 测试预置），
  // 本节点自己不写回（上传走 blob 预览 / 上游实时读 connected）。保留空默认值同时起「向 AI 声明该字段存在」的作用。
  // 2026-09-11 数据体检：曾判定为幽灵字段并删除 → 误伤 6 个测试的预置入口，已回退（见 TD-09 附件）。
  videoExtractNode: { videoUrl: '', videoName: '' },
  videoProcessNode: {
    mode: 'trim',
    sourceOrder: [],
    timelineTracks: [],
    audioFormat: 'm4a',
    // 注：trimStart/trimEnd 已删（2026-09-11 数据体检）——VideoProcessNode 全文无读取，属死默认值。
    resizeWidth: 1280,
    resizeHeight: 720,
    targetFps: 30,
  },

  // ── 其他工具 ──
  scriptBoxNode: { step: 1, story: '', globalStyle: '', shots: [], assets: [] },

  // ── 顶部快捷（Q/W/E）──
  textGenerateNode: { text: '' },
  imageGenerateNode: { prompt: '' },
  videoGenerateNode: { prompt: '' },
};

/**
 * 新建节点的 data 初值（唯一入口，替代原 `NodePalette.defaultNodeData`）。
 *
 * 合并顺序（后者覆盖前者）：
 *   1. `expanded:false` —— 仅「有输入面板」的节点（`INPUT_PANEL_NODE_TYPES`，与 Tab 折叠 /
 *      Ctrl+L 整理共用同一范围，避免三处不对称）；
 *   2. 该类型在 `NODE_DATA_DEFAULTS` 的登记项（可显式覆盖 expanded，如 imageBoxNode）。
 *
 * ⚠️ 只在**新建**路径调用（App.addNode / 右键菜单 / Agent create_node / 面板添加）。
 * 快照加载还原走 `nodeDefaults.applyNodeTypeDefaults`（结构默认），两者不可互换。
 *
 * @param type 画布 node.type
 * @returns 新对象（**嵌套数组/对象已深拷贝**，调用方可自由就地修改）
 */
export function defaultNodeData(type: string): Record<string, unknown> {
  const injected = INPUT_PANEL_NODE_TYPES.includes(type as (typeof INPUT_PANEL_NODE_TYPES)[number])
    ? { expanded: false }
    : {};
  const defaults = NODE_DATA_DEFAULTS[type];
  if (!defaults) return { ...injected };
  // 【必须深拷贝】NODE_DATA_DEFAULTS 的数组/对象字面量是**共享实例**：浅合并（{...defaults}）会让
  // 所有新建节点共用同一个 `images: []` / `timelineTracks: []` 数组——任一节点就地 push 即污染
  // 其它节点与后续新建节点（历史 palette.data 同样存在此隐患，2026-09-12 收口时一并修）。
  return { ...injected, ...structuredClone(defaults) };
}
