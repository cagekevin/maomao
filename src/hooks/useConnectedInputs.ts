import { useCallback, useMemo } from 'react';
import { useStore, type Node, type Edge } from '@xyflow/react';
import {
  collectAssets,
  type Shot,
  type ScriptAsset,
} from '../components/scriptbox/scriptBoxPrompts.ts';
import { toAbsoluteFileUrl } from '../components/base/api/index.ts';
import { resolveAssetType } from '../components/base/utils/assetType.ts';
import { NODE_TYPES, parseShotHandle } from '../components/base/core/contracts.ts';

/**
 * ════════════════════════════════════════════════════════════════
 * 通用连线数据传递机制（上游 → 下游自动传递）
 * ════════════════════════════════════════════════════════════════
 *
 * 【它解决什么问题】
 * 画布节点靠「连线」表达数据依赖。下游节点（生图/生视频/文本…）生成时，
 * 需要自动拿到「直接连到自己」的上游节点产出的东西（文本/图片/视频/音频），
 * 作为参考输入。本模块就是这套通用机制的实现。
 *

 *  1. 上游「只接一层」：只取 edge.target === 本节点 的边，不递归无限上游。
 *     · 为什么只接一层：下游只需直接依赖它的上游产出；隔了多层的间接数据
 *       不应自动混入（否则依赖关系不可控、数据爆炸）。
 *  2. 每个上游节点产出它的「生成物」或「外部传入的素材」（见 getNodeOutput + 下方**产出契约三张表**）：
 *       textGenerateNode        → 文本（data.text）
 *       assetNode       → 图片/视频/音频（data.assetUrl，按 mime/扩展名分类）
 *       imageGenerateNode      → 图片（data.assetUrl）
 *       videoGenerateNode → 视频（data.videoUrl）
 *       scriptBoxNode   → 按 sourceHandle=`shot-${id}` 的镜头，用 @资产名 匹配有图资产（images）
 *                          （端口前缀走 contracts.SHOT_HANDLE_PREFIX，禁止裸拼字符串）
 *  3. 下游在「生成时」读取本 hook 结果，作为参考图/参考文本。
 *
 * 【为什么这样实现】
 *  - 数据不在连线时一次性「复制」下去，而是「下游生成时实时从上游读取」：
 *    这样上游更新（重新生成图片/文本）后，下游拿到的一定是最新的，不会用旧副本。
 *  - 用 useStore 订阅 nodes/edges 数组，而不是 useMemo 依赖 getNodes()/getEdges()：
 *    getNodes/getEdges 是函数引用，不随数据变化稳定触发重算，会导致「连了线但界面不更新」。
 *    useStore 订阅的是数据本身，任何节点/边的增删改都会触发本 hook 重算 → UI 实时反映上游。
 *
 * @param nodeId 下游节点 id
 * @returns { images, texts, videos, audios } 聚合的所有「直接上游」产出
 */

/** 产出类型判定（P1-B φ2 收口）委托 assetType.resolveAssetType：
 *  assetType 优先（产出方自带），否则按 URL 分类。唯一实现，勿在此另起一套（见下方 import）。
 *  · 为什么 assetType 优先：如 VideoProcessNode extractAudio spawn 的 assetNode 带
 *    data.assetType:'audio'（blob: URL 无扩展名），按扩展名判会误判为 image。
 *  · 产出方自带类型是「协议判断」与「节点渲染判断」一致的唯一来源。 */

/**
 * ════════════════════════════════════════════════════════════════
 * 产出契约三张表 + 特判集（TD-02-11，2026-09-12 收口）
 * ════════════════════════════════════════════════════════════════
 * 【治什么】此前「读侧认识什么产出」靠 `genericOutput` 的三个魔法字段名
 * （assetUrl > videoUrl > resultUrl）**猜**：节点若把结果写到别的字段（如 `myResult`），
 * 读侧静默返回空产出（无报错、无日志）；新增节点也无从知道该登记什么。
 * 现改为**写侧显式声明**，`getNodeOutput` 按表调度，**不再对已登记类型做任何猜测**：
 *   ① `SINGLE_OUTPUT_FIELDS`  单 URL 产出：字段名显式列出（按序取第一个非空）；
 *   ② `NODE_OUTPUTS`          复合产出：多端口 / 多图 / 数组归一 / 需按 handle 解析；
 *   ③ `NO_OUTPUT_NODE_TYPES`  **无自有产出**：容器 / 占位 / 结果只经 spawn 子节点交付；
 *   ④ `SPECIAL_OUTPUT_TYPES`  特判：读 node.id（节点身份）而非纯 data 派生，不适合入表。
 * 覆盖性由 `uncoveredOutputNodeTypes()` 保证（可单测：新增类型漏登记即红）；
 * `genericOutput`（三字段猜测）降级为**未登记类型的最后安全网**，只服务存量退役节点快照。
 */

/**
 * ① 单 URL 产出节点：**产出字段名在此显式声明**（按序取第一个非空 URL）。
 * 字段真源 = 各节点**实际写回**的 data 字段（2026-09-12 逐一核对代码写点）：
 *   - `assetNode`         → assetUrl（`replaceNodeImage` 唯一写入口；assetType 可为 image/video/audio）
 *   - `imageGenerateNode` → assetUrl（生成成功 / 任务恢复回写）
 *   - `videoGenerateNode` → videoUrl（useGenerateNode 声明 `resultField:'videoUrl'`）
 *   - `panoramaNode`      → assetUrl（单角度截图写回；多角度走 spawn 图片盒子）
 *   - `director3dNode`    → assetUrl（退出导演台写落盘缩略图）
 * ⚠️ 新增 / 改名产出字段 = 改此表一行；漏改即下游静默拿不到数据（`check:node-data` 对账）。
 */
export const SINGLE_OUTPUT_FIELDS: Record<string, readonly string[]> = {
  assetNode: ['assetUrl'],
  imageGenerateNode: ['assetUrl'],
  videoGenerateNode: ['videoUrl'],
  panoramaNode: ['assetUrl'],
  director3dNode: ['assetUrl'],
};

/**
 * ③ 无自有产出的节点类型：`getNodeOutput` 直接返回空，**不进安全网**
 * （否则「三字段猜测」会在已知类型上复活，正是本次要消灭的隐式语义）。
 *   - `group` / `ghostTarget`：容器 / 连线占位；
 *   - `faceMosaicNode`：只写输入 `assetUrls`，结果经 spawn `assetNode` 子节点交付；
 *   - `loopNode`：只写 `splitMethod`，结果经 spawn 生图节点交付；
 *   - `videoProcessNode`：只写 `sourceVideoUrl`/`errorMessage`，结果经 spawn `assetNode` 子节点交付。
 */
export const NO_OUTPUT_NODE_TYPES: ReadonlySet<string> = new Set([
  'group',
  'ghostTarget',
  'faceMosaicNode',
  'loopNode',
  'videoProcessNode',
]);

/** ④ 特判集：`textGenerateNode` 产出读 `node.id`（节点身份）而非纯 data 派生，保留在 getNodeOutput 内特判。 */
export const SPECIAL_OUTPUT_TYPES: ReadonlySet<string> = new Set(['textGenerateNode']);
/** 把未知值归为可选 string（防假收窄：诚实标注缺省为 undefined，不谎报类型） */
function str(v: unknown): string | undefined {
  return v == null ? undefined : String(v);
}

/** 从「运行时确实是对象」的未知值里取字段并归为可选 string（对象校验后按 Record 视为键值映射，诚实） */
function objField(obj: unknown, key: string): string | undefined {
  return obj && typeof obj === 'object' ? str((obj as Record<string, unknown>)[key]) : undefined;
}

function arrayImages(
  list: unknown,
  prefix = 'img',
  labelFn?: (i: number) => string,
): NodeOutputItem[] {
  // 数组型产出（extractedImages 等 dataURL 列表）：统一归一为 {id,url,label}。
  // url 用 typeof 控制流收窄才算诚实——只有真是非空 string 才 push，编译期据此拿到 string 形态。
  const out: NodeOutputItem[] = [];
  const arr = Array.isArray(list) ? list : [];
  arr.forEach((url: unknown, i: number) => {
    if (typeof url === 'string' && url)
      out.push({ id: `${prefix}-${i}`, url, label: labelFn ? labelFn(i) : '' });
  });
  return out;
}

/**
 * ② 复合产出解析函数签名：d 为节点 data（动态字段，统一以 Record 约束），
 * 返回聚合产出（可缺省字段）；返回 `undefined` = 「本声明不适用，弃权」→ 交回 getNodeOutput 继续往下走。
 */
type NodeOutputResolver = (
  d: Record<string, unknown>,
  sourceHandle?: string,
) => Partial<NodeOutputGroup> | undefined;

export const NODE_OUTPUTS: Record<string, NodeOutputResolver> = {
  // 剧本盒子：多端口产出（每个分镜一个 `shot-${id}` 端口，见 contracts.SHOT_HANDLE_PREFIX）。
  // 按 sourceHandle 反查对应分镜，再用 @资产名 匹配收集「该镜头引用且有图」的资产为参考图。
  // 为什么只给连的那个镜头：下游连哪个镜头就该只拿那个镜头的资产，不能把所有镜头的图都塞下去。
  // 这是全表唯一需要 import 业务纯函数（collectAssets）的声明 —— 反向依赖收敛在此一处，
  // 调度函数 getNodeOutput 内不再出现任何业务模块符号。
  // 返回 undefined = 「本声明不适用」，交回 getNodeOutput 继续走后续兜底（见下方调用处注释）。
  // 为什么必须如此：剧本盒是「类型 + 端口」双条件产出，而查表只按类型命中。
  // 若非分镜端口也返回 { images: [] }，会屏蔽掉通用兜底（genericOutput 读 data.assetUrl），
  // 改变既有行为（回归点，见 tests/unit/useConnectedInputs.test.js「非 shot- 端口走通用兜底」）。
  scriptBoxNode: (d, sourceHandle) => {
    const shotId = parseShotHandle(sourceHandle);
    if (!shotId) return undefined;
    const shots = Array.isArray(d.shots) ? d.shots : [];
    const shot = shots.find((s: Record<string, unknown>) => String(s.id) === String(shotId));
    const assets = Array.isArray(d.assets) ? (d.assets as ScriptAsset[]) : null;
    // d 来自节点 data（运行时对象），收窄为具体契约类型交给 collectAssets
    return { images: shot ? collectAssets(shot as Shot, assets) : [] };
  },
  // 图片盒子：多图（对象数组 {id,url,label}），产出全部图；assetType 由 URL 判定
  imageBoxNode: (d) => {
    const images: NodeOutputItem[] = [];
    const list: unknown[] = Array.isArray(d.images) ? (d.images as unknown[]) : [];
    for (const im of list) {
      const url = objField(im, 'url');
      if (url) images.push({ id: objField(im, 'id'), url, label: objField(im, 'label') || '' });
    }
    return { images };
  },
  // 视频抽帧 / 网格切图 / 网格合并：data.extractedImages[]（dataURL 字符串数组）
  videoExtractNode: (d) => ({
    images: arrayImages(d.extractedImages, 'frame', (i) => `帧 ${i + 1}`),
  }),
  gridSplitNode: (d) => ({
    images: arrayImages(d.extractedImages, 'split', (i) => `切片 ${i + 1}`),
  }),
  gridMergeNode: (d) => ({ images: arrayImages(d.extractedImages, 'merge', (i) => `图 ${i + 1}`) }),
};

/**
 * 单产出解析（**唯一实现**）：按 `fields` 顺序取第一个非空 URL，并按 `data.assetType` / URL 判型。
 * 字段名由调用方**显式传入**（`SINGLE_OUTPUT_FIELDS[type]` 或安全网常量）——
 * 这正是 TD-02-11 的落点：产出字段名是「写侧声明」的，不再由读侧猜。
 * `label` 统一带 `d.label`（供下游候选列表显示 / @名 匹配）。
 */
function singleOutput(
  d: Record<string, unknown>,
  fields: readonly string[],
  id: string,
): NodeOutputGroup {
  const empty: NodeOutputGroup = { images: [], texts: [], videos: [], audios: [] };
  for (const field of fields) {
    const url = d[field];
    // 控制流收窄（非 as）：只有真是非空 string 才生效。
    if (typeof url !== 'string' || !url) continue;
    // assetType 只认白名单枚举：非已知值视为未声明（undefined），交 resolveAssetType 按 URL 判。
    const at = d.assetType;
    const assetType = at === 'image' || at === 'video' || at === 'audio' ? at : undefined;
    const kind = resolveAssetType(url, assetType);
    const item: NodeOutputItem = { id, url, label: str(d.label) };
    if (kind === 'video') return { ...empty, videos: [item] };
    if (kind === 'audio') return { ...empty, audios: [item] };
    return { ...empty, images: [item] };
  }
  return empty;
}

/** 安全网字段（**仅未登记类型**使用，见 getNodeOutput 第 5 步）：服务存量退役节点快照。 */
const SAFETY_NET_FIELDS: readonly string[] = ['assetUrl', 'videoUrl', 'resultUrl'];

/** 安全网：三字段猜测。**已登记类型一律不走这里**（走三张表）—— 它不再承担任何契约。 */
function genericOutput(d: Record<string, unknown>, id: string): NodeOutputGroup {
  return singleOutput(d, SAFETY_NET_FIELDS, id);
}

/** 提取「单个」源节点的产出资源。
 *  统一调度顺序（见 getNodeOutput）：无自有产出 → 单 URL 产出 → 复合产出声明 → 文本特判 → 安全网。
 *  · 为什么统一返回 { id, url, label, text } 对象：下游渲染缩略图/文本都需要 id 作 key、label 作显示名。
 *  · 无产出返回空对象，不返回 undefined：调用方可直接 push，无需判空。 */
/** 节点产出资源项（id 作 key、label 作显示名、url/text 二选一）。
 *  字段定型为【真实运行时形态】——全部 string 可选，供下游 ResourceStrip / PromptInput /
 *  mergeRefImages 等消费方直接使用，不再需要调侧再 `as` 收窄。unknown 源值在上游
 *  (arrayImages/genericOutput/imageBox) 用 typeof 控制流归一，此处不谎报类型。 */
export interface NodeOutputItem {
  id?: string;
  url?: string;
  label?: string;
  text?: string;
  sourceNodeId?: string;
  kind?: string;
}

/** 聚合产出的四个媒体通道（useConnectedInputs 的返回类型真相源） */
export interface NodeOutputGroup {
  images: NodeOutputItem[];
  texts: NodeOutputItem[];
  videos: NodeOutputItem[];
  audios: NodeOutputItem[];
}

export function getNodeOutput(
  node: Record<string, unknown>,
  sourceHandle?: string,
): NodeOutputGroup {
  const empty: NodeOutputGroup = { images: [], texts: [], videos: [], audios: [] };
  if (!node || !node.data) return empty;
  const d = node.data as Record<string, unknown>;
  const type = String(node.type || '');
  const id = String(node.id || '');

  // 1. 显式「无自有产出」：容器 / 占位 / 仅经 spawn 子节点交付结果的类型。
  //    直接返回空、**不进安全网** —— 否则三字段猜测会在这类已知类型上复活（本次要消灭的隐式语义）。
  if (NO_OUTPUT_NODE_TYPES.has(type)) return empty;

  // 2. 单 URL 产出：字段名由 `SINGLE_OUTPUT_FIELDS` 显式声明（TD-02-11：不再由读侧猜字段名）。
  const fields = SINGLE_OUTPUT_FIELDS[type];
  if (fields) return singleOutput(d, fields, id);

  // 3. 复合产出声明表（多端口 / 多图 / 数组归一）。
  //    声明可返回 undefined 表示「本声明不适用」（如剧本盒接到非分镜端口），此时继续往下走安全网，
  //    而非当成空产出直接返回 —— 否则会屏蔽安全网、改变既有行为。
  const declared = NODE_OUTPUTS[type];
  if (declared) {
    const out = declared(d, sourceHandle);
    if (out) return { ...empty, ...out };
  }

  // 4. 文本节点：输出 data.text（统一为 {id,label,text} 对象，供 PromptInput/@弹层显示）。
  // 保留特判而非入表：它读的是 node.id（节点身份）而非纯 data 派生，与「data → 产出」的声明语义不符。
  if (SPECIAL_OUTPUT_TYPES.has(type) && d.text && typeof d.text === 'string') {
    return { ...empty, texts: [{ id, label: str(d.label) || '参考文本', text: d.text }] };
  }

  // 5. 安全网（三字段猜测）：**只服务未登记类型**（存量退役节点快照，如旧版 discountVideoNode）。
  //    已登记类型的产出契约全在 ①②③④ —— 漏登记由 uncoveredOutputNodeTypes() 兜住（dev 告警 + 单测）。
  return genericOutput(d, id);
}

/**
 * ════════════════════════════════════════════════════════════════
 * 聚合「直接上游」节点的产出（下游生成时读取）。
 * ════════════════════════════════════════════════════════════════
 *
 * 【P0-B（docs/106 画布重渲放大器根治）窄订阅改造——语义等价，重渲染面收窄】
 * 旧实现：`useStore(s => s.nodes)` + `useStore(s => s.edges)` 订阅整个数组引用。
 * 拖拽时 `useNodesState` 每帧 `applyNodeChanges` 产生**新 nodes 数组引用** →
 * 14 类消费节点每帧全量重渲染 + useMemo O(N×(N+E)) 重算（比 useNodeSize 更重的放大器）。
 *
 * 新实现三段式（数据流）：
 *   ① 入边：只订阅 `s.edges` 数组引用。拖拽只改 position、不调 setEdges → edges 引用稳定
 *      → 拖拽期间本 hook 不重渲。入边索引以 edges 引用为 key 做 WeakMap 缓存，引用变才重建 O(E)。
 *   ② 上游：`useStore(selector, upstreamEqual)` 窄订阅——selector 每帧照跑（收集上游引用），
 *      equalityFn 相等（上游 id/type/data 引用 + handle 都没变）→ zustand 保留旧引用、不重渲染。
 *      参照库内 `useNodesData`/`shallowNodeData` 的「按 data 引用判等」范式（system/index.mjs:1961-1976）；
 *      比「裸 node 引用判等」更稳：上游被拖拽只改 position（data 引用不变）时下游不重渲。
 *   ③ 聚合：`useMemo(aggregateUpstream, [upstream])`——upstream 引用稳定 → 不重算。
 *
 * 【F1 架构约束（P0-B 落地后生效，写 node.data 必须不可变更新！）】
 * 现在下游只对「上游 data **引用**变化」敏感。任何写 node.data 的代码若用**原地 mutation**
 * （`node.data.x = ...`），data 引用不变 → 下游**静默不更新**（比旧实现"性能差"更难查）。
 * 全项目已核查 0 处原地 mutation（统一不可变写回：`setNodes(ns => ns.map(n => ...{...n, data:{...n.data,...patch}}))`）。
 *
 * @param nodeId 下游节点 id
 * @returns { images, texts, videos, audios } 聚合的所有「直接上游」产出（签名与旧实现完全一致）
 */

/** 入边（只保留聚合需要的字段：source + sourceHandle） */
interface IncomingEdge {
  source: string;
  sourceHandle?: string | null;
}

/** 上游引用项：node 为 nodeLookup 里的 internalNode（含 id/type/data/hidden），
 *  fromGroup=true 表示来自「编组出口展开」的子节点（聚合时不补 sourceNodeId，保持既有行为）。 */
interface UpstreamRef {
  node: Node;
  sourceHandle?: string | null;
  fromGroup?: boolean;
}

const EMPTY_IN: IncomingEdge[] = [];
const EMPTY_UPSTREAM: UpstreamRef[] = [];

/** ① 入边索引：以 edges 数组引用为 key 的 WeakMap 缓存（引用变才重建；旧 edges 被 GC 后缓存自动释放，不泄漏）。
 *  多 ReactFlow 实例天然隔离（WeakMap 而非模块单例，见 docs/106 复核 F4）。 */
const incomingCache = new WeakMap<readonly Edge[], Map<string, IncomingEdge[]>>();

/** P0-B 纯函数（导出供单测锁定契约）：按 target 建「入边索引」。 */
export function buildIncomingIndex(edges: readonly Edge[]): Map<string, IncomingEdge[]> {
  const idx = new Map<string, IncomingEdge[]>();
  for (const e of edges) {
    const list = idx.get(e.target);
    if (list) list.push({ source: e.source, sourceHandle: e.sourceHandle });
    else idx.set(e.target, [{ source: e.source, sourceHandle: e.sourceHandle }]);
  }
  return idx;
}

/** P0-B 纯函数（导出供单测锁定契约）：取某节点的入边（引用缓存，同 edges 引用返回同数组对象）。 */
export function incomingOf(edges: readonly Edge[] | undefined, nodeId?: string): IncomingEdge[] {
  if (!nodeId || !edges || edges.length === 0) return EMPTY_IN;
  let idx = incomingCache.get(edges);
  if (!idx) {
    idx = buildIncomingIndex(edges);
    incomingCache.set(edges, idx);
  }
  return idx.get(nodeId) ?? EMPTY_IN;
}

/** ② 收集直接上游引用（含编组出口展开为「非 hidden 子节点」）。
 *  组内子节点用 s.parentLookup（React Flow 维护的父子索引）展开——比旧实现 `nodes.filter(n => n.parentId===...)`
 *  扫全量数组省 O(N)；parentLookup 的 Map 引用每帧重建，但**值**（internalNode）引用稳定，
 *  故返回元素引用数组后按引用比较（不直接返回 Map，见 docs/106 复核 E 的 parentLookup 坑）。
 *  P0-B 纯函数（导出供单测锁定契约）。 */
export function collectUpstream(
  s: { nodeLookup?: Map<string, Node>; parentLookup?: Map<string, Map<string, Node>> },
  incoming: IncomingEdge[],
): UpstreamRef[] {
  const lookup = s?.nodeLookup;
  if (!lookup) return EMPTY_UPSTREAM;
  let out: UpstreamRef[] | null = null;
  for (const e of incoming) {
    const src = lookup.get(e.source);
    if (!src) continue;
    if (src.type === 'group') {
      const children = s.parentLookup?.get(src.id);
      if (children) {
        children.forEach((child) => {
          if (child.hidden) return;
          if (!out) out = [];
          out.push({ node: child, sourceHandle: undefined, fromGroup: true });
        });
      }
    } else {
      if (!out) out = [];
      out.push({ node: src, sourceHandle: e.sourceHandle });
    }
  }
  return out ?? EMPTY_UPSTREAM;
}

/** ② equalityFn：长度相等 && 逐项「fromGroup/sourceHandle 相等 + node id/type/data 引用相等」。
 *  参照库内 shallowNodeData（system/index.mjs:1961-1976）逐项比 data 引用——库官方范式，不算 hack。
 *  比裸 node 引用更稳：上游被拖拽只改 position（data 引用不变）时，下游不重渲染。
 *  P0-B 纯函数（导出供单测锁定契约）。 */
export function upstreamEqual(a: UpstreamRef[] | undefined, b: UpstreamRef[] | undefined): boolean {
  if (a === b) return true;
  if (!a || !b || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const x = a[i];
    const y = b[i];
    if (x.fromGroup !== y.fromGroup || x.sourceHandle !== y.sourceHandle) return false;
    const xn = x.node;
    const yn = y.node;
    if (xn === yn) continue;
    if (xn.id !== yn.id || xn.type !== yn.type || !Object.is(xn.data, yn.data)) return false;
  }
  return true;
}

/** ③ 聚合上游产出（复用 getNodeOutput；签名与旧 useMemo 体完全一致，含编组不补 sourceNodeId 与 /files/ 兜底）。
 *  P0-B 纯函数（导出供单测锁定契约）。 */
export function aggregateUpstream(upstream: UpstreamRef[]): NodeOutputGroup {
  const out: NodeOutputGroup = { images: [], texts: [], videos: [], audios: [] };
  for (const item of upstream) {
    const src = item.node;
    const r = getNodeOutput(src, item.sourceHandle);
    if (item.fromGroup) {
      // 编组出口子节点：保持既有行为——不补 sourceNodeId（下游断连线/溯源按非编组来源处理）
      out.images.push(...r.images);
      out.texts.push(...r.texts);
      out.videos.push(...r.videos);
      out.audios.push(...r.audios);
    } else {
      // 给每个上游产出补 sourceNodeId = 来源节点 id，供下游「断连线/溯源」用
      out.images.push(...r.images.map((it) => ({ ...it, sourceNodeId: src.id })));
      out.texts.push(...r.texts.map((it) => ({ ...it, sourceNodeId: src.id })));
      out.videos.push(...r.videos.map((it) => ({ ...it, sourceNodeId: src.id })));
      out.audios.push(...r.audios.map((it) => ({ ...it, sourceNodeId: src.id })));
    }
  }
  // 读取端兜底：上游图片 URL 统一补全相对 /files/ 路径为绝对 URL，
  // 下游所有引用 connected.images[].url 的 <img> 自动拿到可访问地址（刷新不破图）。
  out.images = out.images.map((im) =>
    im && im.url ? { ...im, url: toAbsoluteFileUrl(im.url) } : im,
  );
  return out;
}

export function useConnectedInputs(nodeId?: string): NodeOutputGroup {
  // ① 入边：只订阅 edges 数组引用（拖拽期间引用稳定 → 不触发每帧重渲）
  const edges = useStore((s) => s.edges);
  const incoming = incomingOf(edges, nodeId);
  // ② 上游：窄订阅。selector 用 useCallback 保持稳定（incoming 只在 edges 引用变化时是新对象）；
  //    每次 store 变化仍会执行 selector 收集上游引用，但 upstreamEqual 相等时不重渲染。
  const upstream = useStore(
    useCallback((s) => collectUpstream(s, incoming), [incoming]),
    upstreamEqual,
  );
  // ③ 聚合：upstream 引用稳定 → 不重算（签名与返回值与旧实现完全一致）
  return useMemo(() => aggregateUpstream(upstream), [upstream]);
}

// ════════════════════════════════════════════════════════════════
// G2（P2-G）产出 schema 覆盖校验 —— 治「新增节点漏登记产出 → 下游静默拿不到数据」
// ════════════════════════════════════════════════════════════════
/**
 * 产出覆盖缺口：`NODE_TYPES` 中既未声明产出、也不属「无自有产出」/ 特判的类型（空数组 = 全覆盖）。
 *
 * 导出成纯函数（2026-09-12 / TD-02-11）而非只做 dev console 告警 —— **护栏必须可测**：
 * `tests/unit/useConnectedInputs.test.ts` 断言其为空，新增节点漏登记即红（旧实现把
 * `genericOutputOk` 写成第二份手动白名单，删了它才真正实现"漏登记必被发现"）。
 */
export function uncoveredOutputNodeTypes(): string[] {
  const covered = new Set<string>([
    ...Object.keys(SINGLE_OUTPUT_FIELDS),
    ...Object.keys(NODE_OUTPUTS),
    ...NO_OUTPUT_NODE_TYPES,
    ...SPECIAL_OUTPUT_TYPES,
  ]);
  return Object.keys(NODE_TYPES).filter((t) => !covered.has(t));
}

// dev 加载期给可读 warning（生产零开销）：覆盖缺口 = 该类型的上游产出可能静默缺失。
if (import.meta.env.DEV) {
  const missing = uncoveredOutputNodeTypes();
  if (missing.length) {
    // eslint-disable-next-line no-console
    console.warn(
      `[P2-G] 节点类型未登记产出声明：${missing.join(' / ')} —— ` +
        `单 URL 产出请在 SINGLE_OUTPUT_FIELDS 登记（字段名显式），复合产出请在 NODE_OUTPUTS 登记，` +
        `确无自有产出则加入 NO_OUTPUT_NODE_TYPES。否则下游再也拿不到它的数据且无人报错。`,
    );
  }
}
