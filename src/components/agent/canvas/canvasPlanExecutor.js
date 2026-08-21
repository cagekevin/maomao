/**
 * 多步编排执行器（canvasPlanExecutor）—— 对标大雄 canvas-agent 的 plan-executor。
 *
 * 【它解决什么】把「generations」计划（多张图/多步骤，含前序依赖）转成画布节点流程并执行：
 *   1. 按 depends_on_previous 分「独立批(Wave1) + 依赖批(Wave2)」（对齐大雄 plan-executor）
 *   2. Wave1：并行建 promptNode + 触发 + await 拿 resultUrl，写回 data.imageUrl
 *   3. Wave2：依赖批仅当独立批全部成功才执行，用「前序节点连线」让下游自动拿到前序图当参考图
 *   4. autoRun=false 时只建节点不触发生成（ready 态，供用户确认后手动跑）
 *
 * 【为什么用「连线」而非「运行时注入 data.images」做前序依赖】
 *  useConnectedInputs 靠「连线」把上游产出传给下游（getNodeOutput 读上游 data.imageUrl）。
 *  建 A→B 连线后，B 生成时自动读到 A 的图当参考图，无需手动注入、无需改下游节点代码。
 *
 * 【依赖第 1 步异步执行器】触发用 taskStore.runNodeGeneration（await 拿已落盘 resultUrl）。
 */
import { runNodeGeneration, isNodeRegistered } from '../../base/taskStore.js'
import { generateId } from '../../base/idGen.js'
import { logger } from '../../base/logger.js'
import { toAbsoluteFileUrl } from '../../base/imageUrl.js'

/* ── 全局单飞锁（对齐大雄 __canvasAgentGenRunning）──
 * 同一时刻只允许一套 executePlan 批量生成在跑。防止「用户手动点节点生成 + AI 触发」
 * 或「两个入口同时调 execute_plan」时，并行跑两套生成 → 重复建节点 / 重复计费。
 * 带启动时间戳 + 超时兜底：若执行异常未走 finally 释放（理论不会发生），超过
 * EXECUTING_PLAN_TIMEOUT 后下一次进入自动释放，避免全局锁永久死锁（TASK-055 Gap A）。 */
let executingPlan = false
let executingPlanSince = 0
const EXECUTING_PLAN_TIMEOUT = 120000

/* ════════════════════════════════════════════════════════════════
 * 依赖批 prompt 改写工程（对齐大雄 agentBuildFusionPrompt /
 * agentBuildProductReferencePrompt 等，纯函数、无副作用、可独立单测）
 * ────────────────────────────────────────────────────────────────
 * 大雄在依赖批不是「只连线」，而是把下游 prompt 重建为「挂前序成功图 + 改写后的提示词」，
 * 保证产品一致性 / 融合的画面约束强于「仅连线读 data.imageUrl」。这 6 个函数是纯函数，
 * 直接平移自大雄 canvas-agent.js L10055-10172（同名简化去前缀）。
 */
/** 剥离「【统一设定·不可变更】」前缀 */
function stripSharedStylePrefix(text = '') {
  return String(text || '')
    .replace(/【统一设定[·・]?不可变更】[^\n]*/g, ' ')
    .replace(/统一设定[·・]?不可变更[：:][^\n]*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}
/** 是否像「融合」指令 */
function looksLikeFusionPrompt(text = '') {
  return /组合|结合|合成|融合|拼在一起|合并|合在一起|放在一起|拼合|合成为|合成一张|合成一图|把这[两三三四五六七八九十\d]+张|将这[两三三四五六七八九十\d]+张/.test(String(text || ''))
}
/** 是否像「系列套图」指令（对齐大雄 agentLooksLikeSeriesPrompt L10058）：详情页/主图/系列产品图等，同品牌多张需产品一致性 */
function looksLikeSeriesPrompt(text = '') {
  const t = String(text || '')
  // ① 套图/系列/批量等直接触发词（如「详情页套图」「系列产品图」「一组产品图」）
  if (/(套图|系列|批量|一组|若干|多张).{0,20}(详情|主图|产品图|详情页)|(详情页|主图|产品图|海报|banner|宣传图|首页图).{0,20}(套图|系列|多张|几张|若干|一组|批量)/.test(t)) return true
  // ② 数量表达的主图/详情页套图（如「5主图+8详情页」「生成4张详情页」「3张主图」）——最常见电商表达
  if (/(\d+|[一二三四五六七八九十两])张?(主图|详情页|详情图|产品图|海报|banner|宣传图)/.test(t)) return true
  // ③ 「主图+详情」组合表达（如「5主图+8详情」「主图和详情页」）
  if (/(主图|详情页|详情图).{0,8}[+＋和与、,，](详情页|详情图|详情|主图)/.test(t)) return true
  return false
}
/** 从融合 prompt 抽动作（打架/互动/融合等） */
function cleanFusionActionText(basePrompt = '', userText = '') {
  let base = stripSharedStylePrefix(basePrompt)
  const user = String(userText || '').trim()
  base = base
    .replace(/请严格参考[\s\S]*?(?=(?:将|把|生成|创作|描绘|一只|一个|场景|画面|$))/g, '')
    .replace(/将(?:图\s*\d+|它们|以上|前面)[^\n。]*融合[^\n。]*/g, '')
    .replace(/保持各主体外形与关键特征一致[^\n。]*/g, '')
    .replace(/统一光影[、,，]?透视与色彩[^\n。]*/g, '')
    .replace(/构图自然协调[^\n。]*/g, '')
    .replace(/高质量成像[^\n。]*/g, '')
    .replace(/用户原意[：:]\s*/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  const actionPatterns = [
    /(?:再|然后)?(?:生成|创作|制作)?(?:一张)?(?:这只|该|这些)?[^\n，。]{0,20}?(?:猫[^，。]{0,12}狗|狗[^，。]{0,12}猫)[^，。]{0,20}?(?:打架|互动|对峙|追逐|奔跑|拥抱|同框|一起)[^，。]{0,20}/,
    /(?:再|然后)?(?:生成|创作|制作)?(?:一张)?[^\n，。]{0,30}?(?:打架|互动|对峙|追逐|奔跑|拥抱|同框|融合|组合)[^，。]{0,30}/
  ]
  for (const re of actionPatterns) {
    const um = user.match(re)
    if (um) {
      return um[0]
        .replace(/^(?:先|再|然后)/, '')
        .replace(/^(?:生成|创作|制作)(?:一张|一幅)?/, '')
        .trim() || um[0].trim()
    }
  }
  if (base && base.length < 80 && /打架|互动|融合|组合|场景|同框|一起/.test(base)) return base
  const parts = user.split(/[，。；;\n]/).map((s) => s.trim()).filter(Boolean)
  const last = parts.reverse().find((s) => /打架|互动|融合|组合|场景|同框|一起|对峙/.test(s))
  if (last) return last.replace(/^(?:再|然后)?(?:生成|创作|制作)(?:一张|一幅)?/, '').trim() || last
  return base || user || '将参考图中的主体自然融合到同一完整画面中，动作与场景协调，构图清晰。'
}
/** 从 prompt 抽主体短标签（如"黑猫"） */
function extractSubjectLabel(text = '', index = 0) {
  let t = stripSharedStylePrefix(text)
  t = t
    .replace(/请严格参考[^。\n]*/g, ' ')
    .replace(/用户原意[：:][^。\n]*/g, ' ')
    .replace(/将它们融合为同一张完整画面[^。\n]*/g, ' ')
    .replace(/保持各主体外形与关键特征一致[^。\n]*/g, ' ')
    .replace(/【统一设定[·・]?不可变更】/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (!t) return `素材${index + 1}`
  const relative = t.match(/与[^，。；\n]{1,20}?的([\u4e00-\u9fffA-Za-z0-9]{1,12}?(?:猫猫|猫咪|黑猫|橘猫|白猫|猫|狗狗|小狗|犬|狗|包装|产品|场景))/)
  if (relative && relative[1]) return relative[1].slice(0, 12)
  const animal = t.match(/(?:一只|一个|一位)(?!与)([\u4e00-\u9fffA-Za-z0-9]{1,12}?(?:猫猫|猫咪|黑猫|橘猫|白猫|猫|狗狗|小狗|犬|狗|老虎|狮子|小熊|兔子|小鸟|金鱼|女孩|男孩|男人|女人|人物|包装|产品))/)
  if (animal && animal[1]) return animal[1].slice(0, 12)
  const patterns = [
    /([\u4e00-\u9fffA-Za-z0-9]{0,8}?(?:狗狗|小狗|犬|狗|猫猫|猫咪|黑猫|橘猫|白猫|猫|老虎|狮子|小熊|兔子|小鸟|金鱼|女孩|男孩|男人|女人|人物|包装|产品|场景|背景))/,
    /([\u4e00-\u9fff]{1,8}(?:包装|产品|三视图|主图|详情页))/
  ]
  for (const re of patterns) {
    const m = t.match(re)
    if (m && m[1] && !/^与/.test(m[1])) return m[1].slice(0, 12)
  }
  const first = (t.split(/[，。；;\n]/)[0] || t).replace(/^(?:与|和|的|及)\s*/, '')
  return first.slice(0, 12) || `素材${index + 1}`
}
/** 融合批：挂全部前序成功图 + 改写为融合提示词 */
export function buildFusionPrompt(prevGens, userText = '') {
  const labels = prevGens.map((g, i) => {
    const short = extractSubjectLabel(g.prompt || g.professionalPrompt || '', i)
    return `图${i + 1}（${short || '素材'}）`
  }).join('、')
  const action = cleanFusionActionText(prevGens[prevGens.length - 1]?.prompt || '', userText)
  let prompt = `请严格参考${labels}（按参考图数组顺序），将参考图中的主体自然融合到同一完整画面：${action}`
  prompt = prompt.replace(/：请严格参考/g, '：').replace(/\s+/g, ' ').trim()
  if (!/保持各主体外形|外形与关键特征/.test(prompt)) {
    prompt += '。保持各主体外形与关键特征与参考图一致，统一光影与透视，构图自然协调。'
  }
  return prompt
}
/** 产品参考批：只挂产品定稿 + 改写为产品一致性提示词 */
export function buildProductReferencePrompt(productGen, pagePrompt = '', userText = '') {
  const product = extractSubjectLabel(productGen?.prompt || '产品定稿', 0)
  const page = stripSharedStylePrefix(pagePrompt || '').trim()
  const user = String(userText || '').trim()
  const head = `严格参考图1（产品定稿：${product}）作为唯一产品一致性参考。后续画面必须保持同一包装外形、材质、Logo、标签版式与品牌识别完全一致，只更换页面构图与文案层级，不要把多张页面融合成一张。`
  return `${head}${page ? `\n${page}` : ''}${user && !page.includes(user) ? `\n用户原意：${user}` : ''}`
}

/** 是否带前序依赖（对齐大雄 stepDependsOnPrevious） */
function dependsOnPrevious(step) {
  if (!step) return false
  if (step.depends_on_previous === true || step.use_previous_results === true) return true
  if (Array.isArray(step.depends_on_steps) && step.depends_on_steps.length) return true
  return false
}

/** 比例归一：square/1:1 → '1:1'，story/9:16 → '9:16'，landscape/16:9 → '16:9'。
 *  TASK-007 2.4：补中文写法（9比16/竖图/横图/方图/九比十六等）。 */
function normalizeRatio(ratio) {
  const r = String(ratio || '').trim().toLowerCase().replace(/\s+/g, '')
  if (r === 'square' || r === '1:1' || r === '方图' || r === '方形' || r === '一比一') return '1:1'
  if (r === 'story' || r === '9:16' || r === '9比16' || r === '九比十六' || r === '竖图' || r === '竖屏' || r === '竖版') return '9:16'
  if (r === 'landscape' || r === '16:9' || r === '16比9' || r === '十六比九' || r === '横图' || r === '横屏' || r === '横版') return '16:9'
  if (r === 'portrait' || r === '3:4' || r === '3比4' || r === '三比四' || r === '竖版三比四') return '3:4'
  if (r === '4:3' || r === '4比3' || r === '四比三') return '4:3'
  if (r === '3:2' || r === '3比2' || r === '三比二') return '3:2'
  if (r === '2:3' || r === '2比3' || r === '二比三') return '2:3'
  if (r === '1:3' || r === '1比3' || r === '一比三') return '1:3'
  if (r === '3:1' || r === '3比1' || r === '三比一') return '3:1'
  if (r === '21:9' || r === '21比9') return '21:9'
  if (r === '9:21' || r === '9比21') return '9:21'
  if (r) return ratio
  return 'Auto'
}

/** 档位归一：1k/1K → '1K'，2k/4k 同理 */
function normalizeResolution(res) {
  const r = String(res || '').trim().toLowerCase().replace(/\s+/g, '')
  if (r === '1k' || r === '1k' || r === '1080' || r === '高清') return '1K'
  if (r === '2k' || r === '2k' || r === '超清') return '2K'
  if (r === '4k' || r === '4k') return '4K'
  return '1K'
}

/** 画质归一：high/高画质 → 'high'，medium/中画质 → 'medium'，low/低画质 → 'low' */
function normalizeQuality(q) {
  const v = String(q || '').trim().toLowerCase().replace(/\s+/g, '')
  if (!v) return 'auto'
  if (v === 'high' || v === '高' || v === '高画质' || v === '最高' || v === '超高') return 'high'
  if (v === 'medium' || v === '中' || v === '中画质' || v === '标准' || v === '一般') return 'medium'
  if (v === 'low' || v === '低' || v === '低画质' || v === '节能') return 'low'
  if (v === 'auto' || v === '自动') return 'auto'
  return q
}

/** 放置新节点的锚点：就近放到已有节点右侧（简单实现；复杂可对齐大雄 getViewportAnchor） */
function nextAnchor(ctx, base, index, perRow = 3) {
  const col = index % perRow
  const row = Math.floor(index / perRow)
  // 纵向间距 750，与 Ctrl+D 复制偏移对齐（图片节点高 + 抽屉高，避免重叠）
  return { x: base.x + col * 480, y: base.y + row * 750 }
}

/**
 * 执行一个 generations 计划。
 * @param {object} opts
 *  - ctx             useReactFlow() 能力（getNodes/addNodes/addEdges/...）
 *  - generations     计划步骤数组
 *  - autoRun         默认 true；false 时只建节点不触发
 *  - model           生图默认模型（可选；未传时用 defaults.model）
 *  - defaults        { model, ratio, resolution } 面板生图默认参数（对齐大雄 resolveFinalGenParams）
 *  - referenceImages 参考图 url 数组（可选；写进每个生图节点 data.images，实现"参考图+提示词直连生图"，
 *                    对齐大雄图像模式的 attachment_indices → 图生图）
 *  - onLog            可选 ({ level:'info'|'ok'|'warn'|'error', message }) 逐步进度日志回调
 *                     （对齐大雄 executor onLog → workflowLogs → 折叠执行摘要）
 * @returns {Promise<{workflow, entries}>} entries: [{id,status,resultUrl,nodeId,error}]
 */
export async function executePlan({ ctx, generations = [], autoRun = true, model = '', defaults = {}, referenceImages = [], globalContract = null, artifacts = null, onLog = null, userText = '' }) {
  const log = (level, message) => { try { onLog?.({ level, message }) } catch { /* 日志失败不阻断执行 */ } }
  const steps = (generations || []).filter((s) => s && (s.prompt || s.title))
  // 全局单飞锁：同一时刻只允许一套批量生成在跑，防重复计费/重复建节点
  if (executingPlan) {
    // 超时兜底：异常未释放时自动解锁（防御性，正常路径由 finally 释放）
    if (Date.now() - executingPlanSince < EXECUTING_PLAN_TIMEOUT) {
      return { workflow: { status: 'failed', error: '已有计划正在执行，请稍后再试' }, entries: [] }
    }
    executingPlan = false
  }
  if (steps.length === 0) return { workflow: { status: 'failed', error: '计划为空' }, entries: [] }
  executingPlan = true
  executingPlanSince = Date.now()
  // 【A层】执行计划入口：总步数 + 是否自动执行（高价值：定位 AI 批量出图的发起与规模）
  logger.info('AI助手', '执行计划', { steps: steps.length, autoRun, model: model || defaults.model || '', hasGlobalContract: !!globalContract })
  // P8：独立批/依赖批分区一次，日志计数复用同一结果（消除重复全量 filter）
  const independent = steps.filter((s) => !dependsOnPrevious(s))
  let dependent = steps.filter((s) => dependsOnPrevious(s))
  log('info', `开始执行计划：共 ${steps.length} 步（独立批 ${independent.length} + 依赖批 ${dependent.length}）`)
  logger.debug('AI助手', '[执行计划] 分批', { independent: independent.map((s) => s.id), dependent: dependent.map((s) => s.id) }, { module: 'agent' })
  try {

  const entries = []
  const byId = new Map() // step.id -> { nodeId, resultUrl, status }

  // 基础锚点：当前画布最右节点右侧，或固定 40,40
  const nodes = ctx.getNodes()
  const maxX = nodes.length ? Math.max(...nodes.map((n) => (n.position?.x || 0) + (n.width || 400))) : 0
  const base = { x: maxX + 120, y: 40 }

  // 取某步自己的参考图（execute_plan 按 attachment_indices 解析后写入 step.referenceImages，URL 数组）。
  const stepRefImages = (step) => (Array.isArray(step?.referenceImages) ? step.referenceImages.filter(Boolean) : [])

  // 【模型二次锁定】建节点/跑节点后强制写回 selectedModel/比例/分辨率，防 React 重渲染把模型回落默认
  // （对齐大雄 lockAgentNodeSettings）。合并而非覆盖，避免清掉 images 等字段。model 为空时不写 selectedModel（不污染）。
  const lockNodeSettings = (nodeId, { m = model, ratio, resolution, quality } = {}) => {
    ctx.setNodes((ns) => ns.map((n) => (n.id === nodeId
      ? { ...n, data: { ...n.data, ...(m ? { selectedModel: m } : {}), aspectRatio: ratio, imageSize: resolution, quality } }
      : n)))
  }

  // 建一个 promptNode 并设参数。
  // 参数优先级对齐大雄 resolveFinalGenParams：generations 每步显式字段 > 面板 defaults（model/ratio/resolution）。
  const createGenNode = async (step, index, anchor) => {
    const nodeId = `plan-${step.id || `step_${index + 1}`}-${generateId('p')}`
    const ratio = normalizeRatio(step.ratio || defaults.ratio)
    const resolution = normalizeResolution(step.resolution || defaults.resolution)
    const finalModel = model || defaults.model || ''
    const quality = normalizeQuality(step.quality || defaults.quality || 'auto')
    // 【global_contract 逐字锁】执行层兜底锁定统一风格契约到 prompt 头部（对齐大雄，双保险：即使规划层漏带，执行层也补）
    const gcText = [globalContract?.visual_positioning, globalContract?.unified_style_prompt, globalContract?.unified_negative_prompt]
      .filter(Boolean)
      .map((t, i) => ['视觉整体定位：', '统一风格提示词：', '统一负面提示词：'][i] + t)
      .join('\n')
    const lockedPrompt = gcText ? `[统一风格锁定]\n${gcText}\n\n${step.prompt || ''}` : (step.prompt || '')
    const data = {
      label: step.title || `步骤 ${index + 1}`,
      prompt: lockedPrompt,
      aspectRatio: ratio,
      imageSize: resolution,
      quality,
      ...(finalModel ? { selectedModel: finalModel } : {}),
      // 参考图（对齐大雄图像模式 attachment_indices → 图生图）：写进节点 data.images，PromptNode 生图时自动作参考。
      // 优先用该步自己的 referenceImages（execute_plan 按 attachment_indices 解析后的），否则用整批共享的。
      // 【TASK-012 缺口 1】use_attachments === false（product_reference 步）时：不写任何用户参考图到 data.images，
      // 只靠 Wave2 连线读产品定稿，避免"用户上传图 + 产品定稿"两张混喂（对齐大雄 L10213）。
      ...(step.use_attachments === false
        ? {}
        : (stepRefImages(step).length
          ? { images: stepRefImages(step).map((u) => (typeof u === 'string' ? { url: toAbsoluteFileUrl(u), name: 'reference' } : u)) }
          : (referenceImages && referenceImages.length ? { images: referenceImages.map((u) => (typeof u === 'string' ? { url: toAbsoluteFileUrl(u), name: 'reference' } : u)) } : {}))),
    }
    ctx.addNodes([{ id: nodeId, type: 'promptNode', position: anchor, data, width: 420, height: 420 }])
    // 【B层】每步建节点：参考图来源（该步自己的 / 整批共享 / 无）——定位图生图参考挂载
    logger.debug('AI助手', '[执行计划] 建节点', { nodeId, stepId: step.id || step.title, refCount: stepRefImages(step).length || (referenceImages ? referenceImages.length : 0), useAttachments: step.use_attachments }, { module: 'agent' })
    // 建节点即锁：强制写回锁定值，防后续 React 渲染覆盖（对齐大雄 L152-153）
    lockNodeSettings(nodeId, { m: finalModel, ratio, resolution, quality })
    return nodeId
  }

  // 等待节点渲染 + useNodeGeneration effect 注册 start（最多 5s）。直接 addNodes 后 React 异步渲染，
  // PromptNode 挂载时才 registerTaskRetry；不等就直接 runNodeGeneration 会因找不到回调返回 false。
  const waitForNodeReady = (nodeId, timeout = 5000) => new Promise((resolve) => {
    const start = Date.now()
    const tick = () => {
      if (isNodeRegistered(nodeId)) return resolve(true)
      if (Date.now() - start > timeout) return resolve(false)
      setTimeout(tick, 60)
    }
    tick()
  })

  // 触发并 await 结果，写回 data.imageUrl
  const runNode = async (nodeId, step) => {
    const ready = await waitForNodeReady(nodeId)
    if (!ready) return { status: 'failed', error: `节点 ${nodeId} 未注册生成契约（渲染超时）` }
    const res = await runNodeGeneration(nodeId)
    // 【未触发（false）】：节点未注册 / 或并发已达上限被跳过——都视为「待生成」，不报失败，
    // 节点保持 ready（画布上就是「还没生成」的自然样子，用户可手动点触发）。
    if (!res) return { status: 'ready', error: '' }
    if (res.ok === false) return { status: 'failed', error: res.error || '生成失败' }
    const resultUrl = res.resultUrl || ''
    // 【live 节点防悬空（对齐大雄 liveNodeById）】await 完成后重新查节点，
    // 防节点在生成期间被删除/合并（409）导致对悬空对象写回。节点已消失则跳过写回。
    const live = ctx.getNode?.(nodeId)
    if (live) {
      ctx.setNodes((ns) => ns.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, imageUrl: resultUrl } } : n)))
      // 完成时再锁一次参数（对齐大雄 L248 finishAgentNodeImages 末尾 lock），防 update_node/重渲染回落
      lockNodeSettings(nodeId, { m: model || defaults.model, ratio: normalizeRatio(step.ratio || defaults.ratio), resolution: normalizeResolution(step.resolution || defaults.resolution), quality: normalizeQuality(step.quality || defaults.quality || 'auto') })
    }
    return { status: resultUrl ? 'completed' : 'failed', resultUrl }
  }

  // ── Wave 1：独立批（Step E 并行化：先串行建节点避免 addNodes 竞态，再并行跑图提升效率）──
  const wave1 = []
  for (let i = 0; i < independent.length; i++) {
    const step = independent[i]
    const anchor = nextAnchor(ctx, base, entries.length)
    const nodeId = await createGenNode(step, step.index ?? i, anchor) // 建节点串行
    const entry = { id: step.id || `step_${i + 1}`, stepId: step.id, nodeId, phase: 'independent', status: 'ready', resultUrl: '', error: '' }
    byId.set(entry.id, entry)
    entries.push(entry)
    wave1.push({ nodeId, step, entry })
    // 【进度日志】每步开始：挂载参考图数（该步自己的 referenceImages > 整批 referenceImages）
    log('info', `第 ${i + 1} 步「${step.title || entry.id}」开始生成，挂载参考图 ${stepRefImages(step).length || referenceImages.length} 张`)
  }
  // 并行跑图（独立批之间无依赖，Promise.all 并发；不同 nodeId 的 setNodes 写回不冲突）
  if (autoRun && wave1.length > 0) {
    const results = await Promise.all(wave1.map(({ nodeId, step }) => runNode(nodeId, step)))
    wave1.forEach(({ entry }, i) => {
      const r = results[i]
      entry.status = r.status
      entry.resultUrl = r.resultUrl || ''
      entry.error = r.error || ''
      // 【进度日志】每步结果
      log(r.status === 'completed' ? 'ok' : 'error', `第 ${i + 1} 步「${entry.id}」${r.status === 'completed' ? '完成' : `失败：${r.error || '未知错误'}`}`)
    })
  }

  // ── Wave 2：依赖批（仅当独立批全部成功）──
  if (dependent.length || (userText && looksLikeFusionPrompt(userText))) {
    // 【TASK-012 缺口 3】融合兜底（对齐大雄 L10250）：用户要融合但模型没给任何 fusion 步 → 自动追加融合步。
    // 仅在「多步 + 用户原文含融合意图 + 无显式 fusion 依赖步」时触发，避免干扰显式规划。
    const fusionIntent = typeof userText === 'string' && looksLikeFusionPrompt(userText)
    const hasFusion = dependent.some((s) => String(s.dependency_mode || '').toLowerCase() === 'fusion')
    if (fusionIntent && !hasFusion && steps.length >= 2) {
      const fusionStep = {
        id: `__auto_fusion_${Date.now()}`,
        title: '融合成品',
        prompt: buildFusionPrompt(steps, userText || ''),
        dependency_mode: 'fusion',
        depends_on_previous: true,
        use_attachments: false,
      }
      dependent = [...dependent, fusionStep]
      log('info', '检测到融合意图但无 fusion 步，自动追加融合成品步')
    }

    const prevFailed = entries.filter((e) => e.status !== 'completed').length
    for (let i = 0; i < dependent.length; i++) {
      let step = dependent[i]
      // 【TASK-012 缺口 2】套图自动识别（对齐大雄 L10058/L10209）：对话含"详情页套图/系列"等但 LLM 漏标
      // dependency_mode 时，把未标模式的依赖步强制为 product_reference（第1步当产品定稿，后续步保持一致）。
      const seriesHint = typeof userText === 'string' && looksLikeSeriesPrompt(userText)
      const depMode = String(step?.dependency_mode || '').toLowerCase()
      if (seriesHint && depMode !== 'fusion' && !depMode) {
        step = {
          ...step,
          dependency_mode: 'product_reference',
          use_attachments: false,
          prompt: buildProductReferencePrompt(steps[0], step.prompt || '', ''),
        }
      } else if (depMode === 'fusion') {
        // 【依赖批 prompt 改写】（对齐大雄 L10218/L10277/L10284）：依赖步不是只连线，而是按 dependency_mode 重建下游 prompt，
        // 保证产品一致性(fusion/product_reference)的画面约束强于「仅连线读 data.imageUrl」。
        const prevSteps = steps.filter((s) => s !== step && (s.prompt || s.title))
        step = { ...step, prompt: prevSteps.length ? buildFusionPrompt(prevSteps, step.prompt || '') : cleanFusionActionText(step.prompt || '', '') }
      } else if (depMode === 'product_reference') {
        const productStep = steps[0]
        step = {
          ...step,
          // 【TASK-012 缺口 1】对齐大雄 L10213：product_reference 步只挂产品定稿，禁止再叠用户上传参考图
          use_attachments: false,
          prompt: buildProductReferencePrompt(productStep, step.prompt || '', ''),
        }
      }
      // 【artifact 跨步资产注入】（对齐大雄 input_artifact_ids）：依赖步声明要消费哪些前序成果资产时，
      // 从 artifacts 表取对应 url 显式写进 data.images（与连线并存，双保险）。硬校验：声明了但资产表无 url → 失败。
      const inIds = Array.isArray(step.input_artifact_ids) ? step.input_artifact_ids.map(String) : []
      if (inIds.length && Array.isArray(artifacts)) {
        const matched = artifacts.filter((a) => inIds.includes(String(a.id)) && a.url).map((a) => a.url)
        if (matched.length && !stepRefImages(step).length) {
          step = { ...step, referenceImages: matched }
        } else if (matched.length === 0) {
          // 依赖步声明了 artifact 但资产表无对应 url → 明确报错（防 prompt 口头猜依赖）
          entry.status = 'failed'
          entry.error = `步骤 ${step.id} 声明 input_artifact_ids=${inIds.join(',')} 但资产表无对应 url`
          byId.set(entry.id, entry)
          entries.push(entry)
          continue
        }
      }
      const anchor = nextAnchor(ctx, base, entries.length)
      const nodeId = await createGenNode(step, step.index ?? i, anchor)
      const entry = { id: step.id || `dep_${i + 1}`, stepId: step.id, nodeId, phase: 'dependent' }

      // 前序依赖：把「已成功的独立批节点」连到本步节点（下游 useConnectedInputs 自动读其 imageUrl 当参考图）
      const prevOkAll = entries.filter((e) => e.status === 'completed' && e.nodeId)
      // 精确取前序：若 step 显式声明 depends_on_steps，只取这些 id 的成功结果；否则用全部成功前序
      const depSteps = Array.isArray(step.depends_on_steps) && step.depends_on_steps.length ? step.depends_on_steps.map(String) : []
      const prevOk = depSteps.length
        ? prevOkAll.filter((e) => depSteps.includes(String(e.stepId)) || depSteps.includes(String(e.id)))
        : prevOkAll
      // 跳过文案带成功/总数（对齐大雄「前置步骤未完成，已跳过融合」+ 重试引导，我们补充成功计数）
      const indepTotal = independent.length
      const indepOk = entries.filter((e) => e.phase === 'independent' && e.status === 'completed').length
      log('info', `依赖步 ${i + 1}「${entry.id}」开始，连接前序成功节点 ${prevOk.length} 个`)
      if (prevFailed > 0 || prevOk.length === 0) {
        entry.status = 'failed'
        entry.error = prevFailed > 0
          ? `前置步骤未全部成功（成功 ${indepOk} / 共 ${indepTotal}），依赖步骤已跳过，请在画布节点中重试前序`
          : '无前序成功结果，已跳过'
        log('warn', entry.error)
      } else {
        // 建连线：每个命中的前序结果节点 → 本步节点
        const edges = prevOk.map((e) => ({ id: `e-plan-${nodeId}-${e.nodeId}`, source: e.nodeId, target: nodeId }))
        ctx.addEdges(edges)
        if (autoRun) {
          const r = await runNode(nodeId, step)
          entry.status = r.status
          entry.resultUrl = r.resultUrl || ''
          entry.error = r.error || ''
          log(r.status === 'completed' ? 'ok' : 'error', `依赖步 ${i + 1}「${entry.id}」${r.status === 'completed' ? '完成' : `失败：${r.error || '未知错误'}`}`)
        } else {
          entry.status = 'ready'
          entry.resultUrl = ''
          log('info', `依赖步 ${i + 1}「${entry.id}」已就绪，等待确认`)
        }
      }
      byId.set(entry.id, entry)
      entries.push(entry)
    }
  }

  const anyFailed = entries.some((e) => e.status === 'failed')
  const anyDone = entries.some((e) => e.status === 'completed')
  const status = autoRun ? (anyFailed && anyDone ? 'completed_with_errors' : anyFailed ? 'failed' : 'completed') : 'ready'
  const doneCount = entries.filter((e) => e.status === 'completed').length
  const failCount = entries.filter((e) => e.status === 'failed').length
  if (autoRun) {
    log(anyFailed ? (anyDone ? 'warn' : 'error') : 'ok',
      anyFailed ? `执行结束：完成 ${doneCount} 步，失败 ${failCount} 步${anyDone ? '（可重试失败项）' : ''}` : `执行完成：共 ${doneCount} 步全部成功`)
  } else {
    log('info', `已建 ${entries.length} 个节点，等待确认后执行`)
  }
  // 【A层】执行计划终态：总完成/失败步数 + 状态——定位 AI 批量出图的最终成败（高价值）
  logger.info('AI助手', '执行计划完成', { status, done: entries.filter((e) => e.status === 'completed').length, failed: entries.filter((e) => e.status === 'failed').length, total: entries.length })
  return { workflow: { status, steps: steps.length }, entries }
  } finally {
    executingPlan = false // 无论成功/失败/异常都释放单飞锁
    executingPlanSince = 0
  }
}
