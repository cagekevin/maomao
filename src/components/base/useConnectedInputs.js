import { useMemo } from 'react'
import { useStore } from '@xyflow/react'
import { collectAssets } from './scriptBoxPrompts.js'

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
 *       scriptBoxNode   → 按 sourceHandle=shot-${id} 的镜头，用 @资产名 匹配有图资产（images）
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

/** 按 mime / 扩展名把 url 分成 图片/视频/音频。
 *  · 判断依据：data:video/ 前缀或常见视频扩展名 → video；audio → audio；否则当图片。
 *  · 为什么这样分：下游可能需要分别处理图片参考、视频、音频，不能全当图片。 */
function classifyUrl(url) {
  if (url.startsWith('data:video/') || /\.(mp4|webm|mov|mkv|avi|m4v|ogg)($|\?)/i.test(url)) return 'video'
  if (url.startsWith('data:audio/') || /\.(mp3|wav|ogg|m4a|flac|aac)($|\?)/i.test(url)) return 'audio'
  return 'image'
}

/** 产出类型判定：data.mediaType 优先（产出方自带），否则按 URL 分类。
 *  · 为什么 mediaType 优先：如 VideoProcessNode extractAudio spawn 的 imageNode 带
 *    data.mediaType:'audio'（blob: URL 无扩展名），classifyUrl 会误判为 image。
 *    产出方自带类型是「协议判断」与「节点渲染判断」一致的唯一来源。 */
function resolveKind(url, mediaType) {
  if (mediaType === 'image' || mediaType === 'video' || mediaType === 'audio') return mediaType
  return classifyUrl(url || '')
}

/**
 * ════════════════════════════════════════════════════════════════
 * 节点产出声明表（管线契约入口，治根）
 * ════════════════════════════════════════════════════════════════
 * 每个「有产出的上游节点」在此声明如何解析它的产出。getNodeOutput 统一查表调度。
 *  · 新增节点只需在此加一行声明，产出即对下游开放，天然接入管线。
 *  · 各声明返回 { images:[{id,url,label}], texts:[{id,label,text}], videos:[{id,url}], audios:[{id,url}] }。
 *  · 数组型产出（images[]/extractedImages[]）在此集中归一，避免各节点手写上游解析导致不一致。
 */
function arrayImages(list, prefix = 'img', labelFn) {
  return (list || [])
    .map((url, i) => ({ id: `${prefix}-${i}`, url, label: labelFn ? labelFn(i) : '' }))
    .filter((x) => x.url)
}

const NODE_OUTPUTS = {
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
    const kind = resolveKind(url, mediaType)
    const item = { id, url }
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
export function getNodeOutput(node, sourceHandle) {
  const empty = { images: [], texts: [], videos: [], audios: [] }
  if (!node || !node.data) return empty
  const d = node.data

  // 剧本盒子：按 shot-${id} 镜头的 @资产名 匹配收集有图资产为 images（复刻官方 Ra 的 scriptBoxNode 分支）。
  // 为什么：剧本盒子每个镜头一个端口（sourceHandle=shot-${id}），下游连哪个镜头，就该只拿到那个镜头的资产参考图，
  // 不能把所有镜头的资产图都塞给下游。
  if (node.type === 'scriptBoxNode' && sourceHandle && sourceHandle.startsWith('shot-')) {
    const shotId = sourceHandle.replace('shot-', '')
    const shot = (d.shots || []).find((s) => String(s.id) === String(shotId))
    return { ...empty, images: shot ? collectAssets(shot, d.assets) : [] }
  }

  // 文本节点：输出 data.text（统一为 {id,label,text} 对象，供 PromptInput/@弹层显示）。
  if (node.type === 'textNode' && d.text && typeof d.text === 'string') {
    return { ...empty, texts: [{ id: node.id, label: d.label || '参考文本', text: d.text }] }
  }

  // 1. 节点产出声明表（管线契约）：声明过的节点类型走这里（含数组型产出 + 自带 mediaType）。
  const declared = NODE_OUTPUTS[node.type]
  if (declared) {
    const out = declared(d, sourceHandle) || {}
    return { ...empty, ...out }
  }

  // 2. 通用单产出兜底（imageUrl/videoUrl/resultUrl + 尊重 mediaType）。
  return genericOutput(d, node.id)
}

/** 聚合「直接上游」节点的产出（下游生成时读取）。
 *  用 useStore 订阅 nodes/edges 数组，连线或节点数据变化时自动重算。 */
export function useConnectedInputs(nodeId) {
  const nodes = useStore((s) => s.nodes)
  const edges = useStore((s) => s.edges)
  return useMemo(() => {
    const out = { images: [], texts: [], videos: [], audios: [] }
    if (!nodeId) return out
    edges
      .filter((e) => e.target === nodeId)
      .forEach((e) => {
        const src = nodes.find((n) => n.id === e.source)
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
        out.images.push(...r.images)
        out.texts.push(...r.texts)
        out.videos.push(...r.videos)
        out.audios.push(...r.audios)
      })
    return out
  }, [nodeId, nodes, edges])
}
