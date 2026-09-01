import { useMemo } from 'react'
import { useStore, type Node } from '@xyflow/react'
import { collectAssets } from '../components/scriptbox/scriptBoxPrompts.ts'
import { toAbsoluteFileUrl } from '../components/base/api/index.ts'
import { resolveMediaType } from '../components/base/resultUrlExtractor.ts'
import { NODE_TYPES, parseShotHandle } from '../components/base/contracts.ts'

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
 * 【核心规则（复刻官方 H_.jsx onGenerate 里遍历 incoming edges + Ra/Ia）】
 *  1. 上游「只接一层」：只取 edge.target === 本节点 的边，不递归无限上游。
 *     · 为什么只接一层：下游只需直接依赖它的上游产出；隔了多层的间接数据
 *       不应自动混入（否则依赖关系不可控、数据爆炸）。
 *  2. 每个上游节点产出它的「生成物」或「外部传入的素材」（见 getNodeOutput）：
 *       textNode        → 文本（data.text）
 *       imageNode       → 图片/视频/音频（data.imageUrl，按 mime/扩展名分类）
 *       promptNode      → 图片（data.imageUrl）
 *       discountVideoNode → 视频（data.videoUrl）
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

/** 产出类型判定（P1-B φ2 收口）委托 resultUrlExtractor.resolveMediaType：
 *  mediaType 优先（产出方自带），否则按 URL 分类。唯一实现，勿在此另起一套（见下方 import）。
 *  · 为什么 mediaType 优先：如 VideoProcessNode extractAudio spawn 的 imageNode 带
 *    data.mediaType:'audio'（blob: URL 无扩展名），按扩展名判会误判为 image。
 *  · 产出方自带类型是「协议判断」与「节点渲染判断」一致的唯一来源。 */

/**
 * ════════════════════════════════════════════════════════════════
 * 节点产出声明表（管线契约入口，治根）
 * ════════════════════════════════════════════════════════════════
 * 每个「有产出的上游节点」在此声明如何解析它的产出。getNodeOutput 统一查表调度。
 *  · 新增节点只需在此加一行声明，产出即对下游开放，天然接入管线。
 *  · 各声明返回 { images:[{id,url,label}], texts:[{id,label,text}], videos:[{id,url}], audios:[{id,url}] }。
 *  · 数组型产出（images[]/extractedImages[]）在此集中归一，避免各节点手写上游解析导致不一致。
 *  · 声明返回 undefined = 「不适用，弃权」，getNodeOutput 继续走后续兜底。
 *    多端口节点（剧本盒按 shot- 端口区分）靠此机制表达「类型命中但端口不匹配」，
 *    切勿改成返回空对象 —— 那会屏蔽通用兜底。
 */
function arrayImages(list, prefix = 'img', labelFn) {
  return (list || [])
    .map((url, i) => ({ id: `${prefix}-${i}`, url, label: labelFn ? labelFn(i) : '' }))
    .filter((x) => x.url)
}

export const NODE_OUTPUTS = {
  // 剧本盒子：多端口产出（每个分镜一个 `shot-${id}` 端口，见 contracts.SHOT_HANDLE_PREFIX）。
  // 按 sourceHandle 反查对应分镜，再用 @资产名 匹配收集「该镜头引用且有图」的资产为参考图。
  // 为什么只给连的那个镜头：下游连哪个镜头就该只拿那个镜头的资产，不能把所有镜头的图都塞下去。
  // 这是全表唯一需要 import 业务纯函数（collectAssets）的声明 —— 反向依赖收敛在此一处，
  // 调度函数 getNodeOutput 内不再出现任何业务模块符号。
  // 返回 undefined = 「本声明不适用」，交回 getNodeOutput 继续走后续兜底（见下方调用处注释）。
  // 为什么必须如此：剧本盒是「类型 + 端口」双条件产出，而查表只按类型命中。
  // 若非分镜端口也返回 { images: [] }，会屏蔽掉通用兜底（genericOutput 读 data.imageUrl），
  // 改变既有行为（回归点，见 tests/unit/useConnectedInputs.test.js「非 shot- 端口走通用兜底」）。
  scriptBoxNode: (d, sourceHandle) => {
    const shotId = parseShotHandle(sourceHandle)
    if (!shotId) return undefined
    const shot = (d.shots || []).find((s) => String(s.id) === String(shotId))
    return { images: shot ? collectAssets(shot, d.assets) : [] }
  },
  // 图片盒子：多图（对象数组 {id,url,label}），产出全部图；mediaType 由 URL 判定
  imageBoxNode: (d) => ({
    images: (d.images || [])
      .map((im) => ({ id: im.id, url: im.url, label: im.label || '' }))
      .filter((x) => x.url),
  }),
  // 视频抽帧 / 网格切图 / 网格合并：data.extractedImages[]（dataURL 字符串数组）
  videoExtractNode: (d) => ({ images: arrayImages(d.extractedImages, 'frame', (i) => `帧 ${i + 1}`) }),
  gridSplitNode: (d) => ({ images: arrayImages(d.extractedImages, 'split', (i) => `切片 ${i + 1}`) }),
  gridMergeNode: (d) => ({ images: arrayImages(d.extractedImages, 'merge', (i) => `图 ${i + 1}`) }),
}

/** 通用单产出兜底：imageUrl > videoUrl > resultUrl，且尊重 data.mediaType */
function genericOutput(d, id) {
  const empty = { images: [], texts: [], videos: [], audios: [] }
  const candidates = [
    { url: d.imageUrl, mediaType: d.mediaType },
    { url: d.videoUrl, mediaType: d.mediaType },
    { url: d.resultUrl, mediaType: d.mediaType },
  ].filter((c) => c.url && typeof c.url === 'string')
  for (const { url, mediaType } of candidates) {
    const kind = resolveMediaType(url, mediaType)
    // label 统一带上 d.label（图片/视频/音频都带，供下游候选列表显示 / 未来 @名 匹配视频）。
    // 单图/单视频节点（imageNode/promptNode/panorama/discountVideo/...）双击标题改的名即 d.label。
    const item = { id, url, label: d.label }
    if (kind === 'video') return { ...empty, videos: [item] }
    if (kind === 'audio') return { ...empty, audios: [item] }
    return { ...empty, images: [item] }
  }
  return empty
}

/** 提取「单个」源节点的产出资源（复刻官方 Ra + Ia）。
 *  统一调度：特殊类型（剧本盒子/文本节点）→ 节点产出声明表 → 通用字段兜底。
 *  · 为什么统一返回 { id, url, label, text } 对象：下游渲染缩略图/文本都需要 id 作 key、label 作显示名。
 *  · 无产出返回空对象，不返回 undefined：调用方可直接 push，无需判空。 */
/** 节点产出资源项（id 作 key、label 作显示名、url/text 二选一） */
export interface NodeOutputItem {
  id: unknown
  url?: unknown
  label?: unknown
  text?: unknown
}

/** 聚合产出的四个媒体通道 */
export interface NodeOutputGroup {
  images: NodeOutputItem[]
  texts: NodeOutputItem[]
  videos: NodeOutputItem[]
  audios: NodeOutputItem[]
}

export function getNodeOutput(node: Record<string, unknown>, sourceHandle?: string): NodeOutputGroup {
  const empty: NodeOutputGroup = { images: [], texts: [], videos: [], audios: [] }
  if (!node || !node.data) return empty
  const d = node.data as Record<string, unknown>
  const type = String(node.type || '')
  const id = String(node.id || '')

  // 1. 节点产出声明表（管线契约）：声明过的节点类型走这里（含剧本盒多端口 / 数组型产出 / 自带 mediaType）。
  // 声明可返回 undefined 表示「本声明不适用」（如剧本盒接到非分镜端口），此时继续往下走兜底，
  // 而非当成空产出直接返回 —— 否则会屏蔽通用兜底、改变既有行为。
  const declared = NODE_OUTPUTS[type]
  if (declared) {
    const out = declared(d, sourceHandle)
    if (out) return { ...empty, ...out }
  }

  // 2. 文本节点：输出 data.text（统一为 {id,label,text} 对象，供 PromptInput/@弹层显示）。
  // 保留特判而非入表：它读的是 node.id（节点身份）而非纯 data 派生，与 NODE_OUTPUTS
  // 「data → 产出」的声明语义不符；且它不引入任何业务模块依赖，无架构债。
  if (type === 'textNode' && d.text && typeof d.text === 'string') {
    return { ...empty, texts: [{ id, label: d.label || '参考文本', text: d.text }] }
  }

  // 2. 通用单产出兜底（imageUrl/videoUrl/resultUrl + 尊重 mediaType）。
  return genericOutput(d, id)
}

/** 聚合「直接上游」节点的产出（下游生成时读取）。
 *  用 useStore 订阅 nodes/edges 数组，连线或节点数据变化时自动重算。 */
export function useConnectedInputs(nodeId) {
  const nodes = useStore((s) => s.nodes)
  const edges = useStore((s) => s.edges)
  return useMemo(() => {
    const out = { images: [], texts: [], videos: [], audios: [] }
    if (!nodeId) return out
    // P7：双层遍历改 Map——edges×nodes 的 find 每次 O(n)，建一次 nodeById 索引后按 id O(1) 查。
    // Map 在 useMemo 内随 nodes 引用变化重建，不会缓存过期。
    const nodeById = new Map(nodes.map((n) => [n.id, n]))
    edges
      .filter((e) => e.target === nodeId)
      .forEach((e) => {
        const src = nodeById.get(e.source)
        if (!src) return
        // 编组作为出口：聚合组内所有子节点（非隐藏）的产出，统一接到下游。
        // 这样把文本/图片等拖进 group 范围内（成为子节点），下游连到 group 的 source 口即可收到全部。
        if (src.type === 'group') {
          nodes
            .filter((n) => n.parentId === src.id && !n.hidden)
            .forEach((child) => {
              const r = getNodeOutput(child)
              out.images.push(...r.images)
              out.texts.push(...r.texts)
              out.videos.push(...r.videos)
              out.audios.push(...r.audios)
            })
          return
        }
        const r = getNodeOutput(src, e.sourceHandle)
        // 给每个上游产出补 sourceNodeId = 来源节点 id，供下游「断连线/溯源」用
        // （getNodeOutput 返回的 item.id 可能是子项 id / 数组索引前缀，不可靠）。
        out.images.push(...r.images.map((it) => ({ ...it, sourceNodeId: src.id })))
        out.texts.push(...r.texts.map((it) => ({ ...it, sourceNodeId: src.id })))
        out.videos.push(...r.videos.map((it) => ({ ...it, sourceNodeId: src.id })))
        out.audios.push(...r.audios.map((it) => ({ ...it, sourceNodeId: src.id })))
      })
    // 读取端兜底：上游图片 URL 统一补全相对 /files/ 路径为绝对 URL，
    // 下游所有引用 connected.images[].url 的 <img> 自动拿到可访问地址（刷新不破图）。
    out.images = out.images.map((im) => (im && im.url ? { ...im, url: toAbsoluteFileUrl(im.url) } : im))
    return out
  }, [nodeId, nodes, edges])
}

// ════════════════════════════════════════════════════════════════
// G2（P2-G）dev 期产出 schema 校验 —— 治「NODE_OUTPUTS 无校验 + schema 静默缺失」
// ════════════════════════════════════════════════════════════════
// 对比节点类型清单（contracts.NODE_TYPES），凡「产出节点」既未在 NODE_OUTPUTS 声明、也未列入
// 通用单输出兜底或无产出集合 → dev 加载期给可读 warning，避免新增产出节点漏声明被静默 genericOutput
// 吞掉（进而被下游当错类型/漏传给上游，甚至外部硬编码 t.data[0].url）。仅 DEV 触发，生产零开销。
if (import.meta.env.DEV) {
  const specialHandled = new Set(['textNode'])                           // getNodeOutput 保留特判（读 node.id，非 data 派生）
  const declaredOutputs = new Set(Object.keys(NODE_OUTPUTS))             // 显式产出声明（剧本盒多端口 / 多图 / 数组 / 自带 mediaType）
  const genericOutputOk = new Set([                                      // 单输出由 genericOutput 兜底（imageUrl/videoUrl/resultUrl）
    'imageNode', 'promptNode', 'discountVideoNode', 'panoramaNode',
    'templateNode', 'faceMosaicNode', 'loopNode', 'videoProcessNode', 'director3dNode',
  ])
  const noOutput = new Set(['group', 'ghostTarget'])                     // 无管线产出（容器 / 连线占位）
  const covered = new Set([...specialHandled, ...declaredOutputs, ...genericOutputOk, ...noOutput])
  for (const t of Object.keys(NODE_TYPES)) {
    if (!covered.has(t)) {
      // eslint-disable-next-line no-console
      console.warn(
        `[P2-G] 节点类型 "${t}" 未在 NODE_OUTPUTS 声明产出，且未列入 genericOutputOk / noOutput：` +
        `管线对它的上游产出可能静默缺失（schema 缺口）。请在 NODE_OUTPUTS 声明或补入对应集合。`
      )
    }
  }
}
