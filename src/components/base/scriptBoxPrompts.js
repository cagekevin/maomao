/**
 * 剧本盒子 —— 纯函数层（无副作用，对应真实系统的 scriptBoxPrompts.js / shared.js）。
 *
 * 职责：
 *  - 默认提示词模板（与 c_.jsx 设置弹窗默认值逐字一致）
 *  - ZgPrompt：资产生图提示词拼装
 *  - buildShotPrompts：单个分镜的生图/生视频提示词拼装
 *  - buildShots / buildAssets：按剧情/风格生成初始分镜与资产（假引擎用）
 *
 * 铁律：本文件 100% 纯函数，无 React、无 state、无副作用。
 * UI 与引擎都从这里取函数，保证「依赖单向：UI→引擎→纯函数」。
 */

import { SCRIPT_BOX_WORKFLOWS } from '../scriptbox/scriptBoxWorkflows.js'
// 转发工作流工具，供 base/ 侧（engine）统一入口，避免 base→scriptbox 直接依赖。
export { SCRIPT_BOX_WORKFLOWS, getWorkflow, DEFAULT_WORKFLOW } from '../scriptbox/scriptBoxWorkflows.js'

/** 角色 / 场景 / 道具 参考图模板（默认来自工作流「漫剧」，逐字对应 c_.jsx 设置弹窗默认值）。 */
export const ASSET_TEMPLATES = SCRIPT_BOX_WORKFLOWS.manga.assetTemplates

/** 剧本生成——用户可编辑的创作部分（角色定位/创作哲学/创作流程）。
 *  只负责"怎么写故事"，不含输出 JSON 结构（结构在 SCRIPT_WRITER_FORMAT，固定不可改）。
 *  默认来自工作流「漫剧」。 */
export const SCRIPT_WRITER_SYSTEM = SCRIPT_BOX_WORKFLOWS.manga.script

/** 剧本生成——固定输出格式（运行时契约，引擎按此解析 shots/assets，用户不可改）。
 *  无论用户怎么改 SCRIPT_WRITER_SYSTEM，此格式都强制追加，保证 LLM 返回可解析的 JSON。 */
export const SCRIPT_WRITER_FORMAT = `

【输出格式】严格输出一个 JSON 对象（只返回纯 JSON，不要解释、不要 Markdown 代码块）：
{"projectName":"根据故事生成的简洁项目名称，2至8个中文字符，例如：小红帽","globalStyle":"整部片子的统一视觉风格，例如：中世纪童话·皮克斯3D","logline":"一句话故事核心（用于自检，可选）","shots":[{"index":1,"duration":"5s","description":"画面描述：聚焦这一镜要呈现的画面与动作，凡出现 assets 中的角色/场景/道具，必须写成 @名称 形式，例如 @小红帽 走进 @幽暗森林","shotType":"景别","lighting":"光影氛围","dialogue":"该镜对白或旁白（如有）","sound":"音效（如有）","motion":"运镜"}],"assets":[{"category":"character|scene|prop","name":"名称","description":"主体外观描述，详细具体（角色：体型/发型/五官/瞳色/肤色/服装/配饰/神态；场景：环境/前景背景/氛围/光线；道具：形状/材质/颜色/细节），只描述主体本身，不要写构图/视角/布光/负面词，这些由系统自动补全"}]}
【硬性要求】assets 的 name 必须与 shots 的 description 中 @ 引用的名称完全一致；分镜数量与时长要与剧情体量匹配，叙事连贯、有头有尾。`

/** 分镜导演系统提示词（默认来自工作流「漫剧」，只返回 JSON prompt/videoPrompt） */
export const SHOT_DIRECTOR_SYSTEM = SCRIPT_BOX_WORKFLOWS.manga.shot

/**
 * 提示词审计改写系统提示词（聊天式"按意见改"专用通道；默认来自工作流「漫剧」）。
 * 与 SHOT_DIRECTOR_SYSTEM（一次生成 prompt/videoPrompt）不同，本提示词用于：
 * 用户已有一条现成提示词，提出修改意见，AI 以「导演 / 表演 / 美术」三岗位框架
 * 做静默审计式改写——只改该改的，保持其余不变，输出**单条改写后的提示词文本**
 * （不再返回 JSON，因为只针对一个字段）。
 */
export const SHOT_AUDIT_SYSTEM = SCRIPT_BOX_WORKFLOWS.manga.audit

/**
 * 审计改写 user content 拼装（聊天式「按意见改」专用）。
 * 与 assembleShotUser（生成提示词用，产出 JSON）不同：本函数只针对单个已有提示词字段，
 * 让 AI 看到「当前提示词 + 用户意见 + 本镜资料」，按 SHOT_AUDIT_SYSTEM 做最小必要改写。
 * 输出是单条文本（不要求 JSON）。
 *
 * @param {object} shot 分镜对象（读 description/dialogue/duration）
 * @param {'prompt'|'videoPrompt'} field 要改写的字段
 * @param {string} feedback 用户修改意见（必填）
 * @param {string[]} [assetNames] 资产名列表（仅作提示，不强约束）
 * @returns {string} user content
 */
export function buildAuditUser(shot, field, feedback, assetNames = []) {
  const current = String(shot?.[field] || '').trim()
  const desc = String(shot?.description || '').trim()
  const dia = dialogueText(shot?.dialogue)
  const names = Array.isArray(assetNames) ? assetNames.filter(Boolean) : []
  const parts = []
  if (desc) parts.push(`【本镜画面描述】\n${desc}`)
  if (dia) parts.push(`【对白/旁白】\n${dia}`)
  if (names.length) parts.push(`【可用 @资产】\n${names.map((n) => `@${n}`).join('、')}`)
  if (field === 'videoPrompt' && shot?.duration) parts.push(`【时长】\n${shot.duration}`)
  parts.push(`【当前${field === 'prompt' ? '生图' : '生视频'}提示词（待改写）】\n${current || '（空）'}`)
  parts.push(`【用户修改意见（必须严格遵循）】\n${String(feedback || '').trim()}`)
  return parts.join('\n\n')
}

/** 资产生图提示词拼装（对应 shared.js Zg）：`[视觉风格：xx] + desc + 句号 + 模板` */
export function ZgPrompt(category, desc, style, customTemplates) {
  const cat = ['character', 'scene', 'prop'].includes(category) ? category : 'character'
  const d = (desc || '').trim()
  const tpl = (customTemplates && customTemplates[cat]) || ASSET_TEMPLATES[cat]
  const body = `${d}${d && !/[。.!!？?]$/.test(d) ? '。' : ''}${tpl}`
  return (style ? `[视觉风格：${style}]` : '') + body
}

/** 单分镜对白数组 → 可读文本（"台词/旁白: text" 用 / 连接） */
export function dialogueText(arr) {
  const list = Array.isArray(arr) ? arr : []
  if (!list.length) return ''
  return list
    .map((d) => (d.kind === '旁白' ? `[旁白] ${d.text}` : `${d.role || '台词'}: ${d.text}`))
    .join(' / ')
}

/** P6：@资产名高亮正则缓存——按「排序后名字列表」缓存编译结果，避免 hlAt 每次渲染重排 new RegExp。
 *  资产名集合有限（每个剧本盒子的资产数几十量级），带 size 上限防无限膨胀。 */
const HIGHLIGHT_RE_CACHE = new Map()
const HIGHLIGHT_RE_CACHE_MAX = 200
function getHighlightPattern(sorted) {
  const key = sorted.join('\u0001')
  let re = HIGHLIGHT_RE_CACHE.get(key)
  if (!re) {
    // 名称按长度从长到短排序 + 正则转义，短名放后面避免先匹配吃掉长名
    re = new RegExp(`(@(?:${sorted.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')}))`, 'g')
    if (HIGHLIGHT_RE_CACHE.size >= HIGHLIGHT_RE_CACHE_MAX) HIGHLIGHT_RE_CACHE.clear()
    HIGHLIGHT_RE_CACHE.set(key, re)
  }
  return re
}

/**
 * @资产名 → 青色高亮 HTML（用于画面描述/提示词展示）。
 *
 * 对齐官方 a_.jsx `a_`：**只高亮「真实资产名」**（assetNames 里的名字），
 * 其它 `@xxx`（非资产）保持原样不高亮。官方逻辑：
 *  - 从资产列表取 name，按长度**从长到短**排序（避免短名先匹配吃掉长名，如「小马」vs「小马妈妈」）；
 *  - 构造 `(@(?:名1|名2|...))` 正则，split 后仅把命中真实资产名的 `@名` 包成高亮 span。
 *
 * @param {string} text 原始文本
 * @param {string[]} [assetNames] 已注册资产名列表；缺省/为空时不高亮任何 @（保持原样）
 * @returns {string} HTML 字符串（配合 dangerouslySetInnerHTML 使用）
 */
export function hlAt(text, assetNames) {
  const esc = (s) => (s == null ? '' : String(s)).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]))
  const s = esc(text)
  const names = Array.isArray(assetNames) ? assetNames.map((x) => String(x ?? '')).filter(Boolean) : []
  if (names.length === 0) return s
  // 名称按长度从长到短排序 + 正则转义，短名放后面避免先匹配吃掉长名
  const sorted = [...names].sort((a, b) => b.length - a.length)
  const pattern = getHighlightPattern(sorted)
  return s.split(pattern).map((part) => {
    if (part.startsWith('@') && sorted.includes(part.slice(1))) {
      return `<span class="at">${part}</span>`
    }
    return part
  }).join('')
}

/** 更新 shots 数组中第 idx 个分镜（不可变更新，单一数据源）。
 *  field 支持两种形态：字符串字段名（配合 val）或对象 patch（一次性合并多个字段）。
 *  收口 StepShots / StepPrompt 各自的 patchShot 重复实现。纯函数，无副作用。
 *  @returns 新 shots 数组 */
export function patchShots(shots, idx, field, val) {
  return (shots || []).map((s, i) => {
    if (i !== idx) return s
    return typeof field === 'object' && field !== null ? { ...s, ...field } : { ...s, [field]: val }
  })
}

/** 判断文本 e 中是否存在合法的 `@资产名` 引用（复刻官方 shared.js Fa）。
 *  规则：`@名` 后一位必须是结尾或非中英数，防止 `@小马` 误匹配 `@小马妈妈`。 */
export function matchAsset(text, name) {
  if (!text || !name) return false
  let n = 0
  while (true) {
    n = text.indexOf(`@${name}`, n)
    if (n < 0) return false
    const after = text[n + 1 + name.length]
    if (after === undefined || !/[\u4e00-\u9fa5A-Za-z0-9]/.test(after)) return true
    n += 1
  }
}

/** 去掉文本中指定资产 `@名` 的链接标记（用于删除资产时联动清理残留）。
 *  只去掉 `@` 前缀、保留名字文字本身（名字可能本就是描述内容，如「森林」不该消失），
 *  使其不再被高亮 / 不再被当作参考图引用。边界与 matchAsset 完全一致
 *  （@名 后一位结尾或非中英数），避免误伤 `@名` 更长词（如 @小马妈妈）。
 *  返回的 name 用函数返回值注入，规避 String.replace 对 `$` 的特殊转义。 */
export function stripAtRef(text, name) {
  if (!text || !name) return text
  const re = new RegExp(`@${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\u4e00-\\u9fa5A-Za-z0-9])`, 'g')
  return text.replace(re, () => name)
}

/** 收集某个分镜引用的「有图资产」作为参考图（复刻官方 shared.js Ra 的 scriptBoxNode 分支）。
 *  @param shot   分镜对象（读 description/prompt/videoPrompt/dialogue）
 *  @param assets 资产数组（读 name/imageUrl）
 *  @returns { id, url }[]  该镜头 @名 匹配到且有图（imageUrl）的资产，供下游生图/生视频作参考图 */
export function collectAssets(shot, assets) {
  const list = Array.isArray(assets) ? assets : []
  if (!shot || list.length === 0) return []
  const text = `${shot.description || ''} ${shot.prompt || ''} ${shot.videoPrompt || ''} ${shot.dialogue || ''}`
  const out = []
  list.forEach((a) => {
    if (a?.name && a.imageUrl && matchAsset(text, a.name)) {
      out.push({ id: `script-asset-${a.id}`, url: a.imageUrl })
    }
  })
  return out
}

/** 单个分镜的生图/生视频提示词（对应 buildShotPrompts，详实模板） */
export function buildShotPrompts(shot, { imageConstraint, videoConstraint } = {}) {
  const dlg = dialogueText(shot.dialogue)
  const base = `电影感画面，${shot.description}${shot.shotType ? `，景别：${shot.shotType}` : ''}${shot.lighting ? `，光影：${shot.lighting}` : ''}，运镜：${shot.motion || '固定'}`
  shot.prompt = `${base}${imageConstraint ? `，全局约束：${imageConstraint}` : ''}`
  shot.videoPrompt = `镜头时长 ${shot.duration || '5s'}，${base}${dlg ? `，对白/旁白：${dlg}` : ''}，音效：${shot.sound || ''}${videoConstraint ? `，全局约束：${videoConstraint}` : ''}`.trim()
  return shot
}

/** 候选下拉项（表格用） */
export const SHOT_TYPES = ['特写', '近景', '中景', '全景', '大远景']
export const LIGHTS = ['自然光', '暖光', '冷光', '逆光', '烛光', '夜光', '电影感']
export const SOUNDS = ['环境音', '动作音', '鸟鸣', '风声', '翻页声', '雨声', '水声']
export const MOTIONS = ['固定', '缓慢推进', '推', '拉', '横摇跟随', '跟随', '环绕']

/** 分镜模板（buildShots 循环取用） */
const SHOT_TPL = [
  { desc: '@小马 站在 @河岸边 眺望对岸，晨光洒在草地上。', shotType: '中景', lighting: '自然光', dialogue: [{ kind: '台词', role: '小马', text: '对岸会有更好的草地吗？' }], sound: '环境音', motion: '缓慢推进' },
  { desc: '@老牛 缓步走近 @小马，目光温和。', shotType: '全景', lighting: '暖光', dialogue: [{ kind: '旁白', role: '', text: '这头老牛，见过太多四季。' }], sound: '环境音', motion: '横摇跟随' },
  { desc: '@松鼠 从树梢跃下，落在 @小马 的背上。', shotType: '近景', lighting: '自然光', dialogue: [{ kind: '台词', role: '松鼠', text: '我带你去看最甜的野莓！' }], sound: '动作音', motion: '固定' },
  { desc: '他们一起走向 @森林 深处，@马妈妈 在身后目送。', shotType: '大远景', lighting: '逆光', dialogue: [], sound: '鸟鸣', motion: '拉' },
  { desc: '夜幕降临，@旧书店 的灯还亮着。', shotType: '特写', lighting: '烛光', dialogue: [{ kind: '旁白', role: '', text: '有些路，走过了才知道方向。' }], sound: '翻页声', motion: '推' }
]

/** 资产池（buildAssets 用） */
const ASSET_POOL = [
  { name: '小马', cat: 'character', desc: '矮脚小马，鬃毛卷曲，眼神明亮，四肢矫健' },
  { name: '老牛', cat: 'character', desc: '沉稳老牛，眼神温和，皮毛厚实，体格健壮' },
  { name: '松鼠', cat: 'character', desc: '毛茸茸松鼠，尾巴蓬松，机灵可爱，眼睛圆亮' },
  { name: '马妈妈', cat: 'character', desc: '成年母马，毛色温暖淡棕，姿态优雅，鬃毛顺滑' },
  { name: '河岸边', cat: 'scene', desc: '河岸青草地，波光粼粼，水草摇曳，晨雾缭绕' },
  { name: '森林', cat: 'scene', desc: '晨雾中的森林小径，光线穿过树梢，苔藓湿润' },
  { name: '旧书店', cat: 'scene', desc: '拥挤的二手书店，木架到顶，灯光昏黄，灰尘飞舞' },
  { name: '谷仓', cat: 'scene', desc: '木质谷仓，堆满干草，阳光斜照，木纹斑驳' },
  { name: '画册', cat: 'prop', desc: '皮质封面无字画册，边角磨损，封皮暗红' },
  { name: '怀表', cat: 'prop', desc: '银壳怀表，指针停摆，链坠精致，表盘泛黄' }
]

/** 按镜头数生成分镜数组（含提示词），无副作用 */
export function buildShots(n) {
  const shots = []
  for (let i = 0; i < n; i++) {
    const t = SHOT_TPL[i % SHOT_TPL.length]
    const dur = 3 + (i % 3)
    const shot = {
      id: i + 1,
      index: i + 1,
      duration: `${dur}s`,
      description: t.desc,
      shotType: t.shotType,
      lighting: t.lighting,
      dialogue: t.dialogue.map((d) => ({ ...d })),
      sound: t.sound,
      motion: t.motion,
      grid: 0,
      prompt: '',
      videoPrompt: '',
      promptLoading: false,
      connImg: false,
      connVid: false
    }
    buildShotPrompts(shot)
    shots.push(shot)
  }
  return shots
}

/** 生成资产数组（角色/场景/道具三栏，prompt 走 ZgPrompt），无副作用 */
export function buildAssets(style, customTemplates) {
  return ASSET_POOL.map((a) => ({
    id: a.name,
    category: a.cat,
    name: a.name,
    description: a.desc,
    prompt: ZgPrompt(a.cat, a.desc, style, customTemplates),
    imageUrl: '',
    thumbnailUrl: '',
    has: false,
    loading: false,
    videoStatus: ''
  }))
}

// ═══════════════════════════════════════════════════════════════════
// 步骤3「合成提示词」· AI 生成图提示词（关键帧 / 四宫格 / 九宫格 / 俯视调度图）
//
// 与官方 gridMode 死模板（shared.js 仅追加「严格等分无缝」约束）不同：
// 这里要求 AI 真正理解镜头内容（description / @资产 / 对白 / 运镜 / 时长 / 全局风格），
// 再按所选类型主动设计画面/分格/调度，产出可直接交给生图模型的提示词文本。
// 本文件为纯函数层，只提供定义与拼装；真实请求经引擎回调 onGenerateShotImage 发起。
// ═══════════════════════════════════════════════════════════════════

/** 生图类型定义：label=UI 显示名，sys=该类型专用的系统提示词片段（默认来自工作流「漫剧」） */
export const IMAGE_GEN_TYPES = SCRIPT_BOX_WORKFLOWS.manga.imageGenTemplates

/** 默认选中类型 */
export const IMAGE_GEN_DEFAULT = 'keyframe'

/** 取某生图类型生效的系统提示词：优先用用户自定义模板（customImageGenTemplates[type]），否则用内置默认。
 *  用户可在齿轮设置里覆盖；返回空串时引擎可回退内置默认。纯函数，无副作用。 */
export function getImageGenSys(type, customTemplates) {
  const custom = customTemplates && customTemplates[type]
  if (typeof custom === 'string' && custom.trim()) return custom.trim()
  const t = IMAGE_GEN_TYPES[type] || IMAGE_GEN_TYPES[IMAGE_GEN_DEFAULT]
  return t.sys
}

/** 把 4 类内置默认提示词导出为可编辑初始值（设置弹窗用） */
export function defaultImageGenTemplates() {
  return Object.fromEntries(
    Object.entries(IMAGE_GEN_TYPES).map(([k, t]) => [k, t.sys])
  )
}

/** 把单个分镜某类型的「用户内容」拼成一次 LLM 调用的 user message（纯函数，无副作用） */
export function buildShotImageUser(shot, type, { globalStyle = '', assets = [] } = {}) {
  const t = IMAGE_GEN_TYPES[type] || IMAGE_GEN_TYPES[IMAGE_GEN_DEFAULT]
  const dlg = dialogueText(shot.dialogue)
  const assetNames = (assets || []).map((a) => a.name).filter(Boolean).join('、')
  const parts = [
    `【你要生成的图类型】${t.label}`,
    `【全局视觉风格】${globalStyle || '（未设置）'}`,
    `【镜头画面描述】${shot.description || ''}`,
    shot.shotType ? `【景别】${shot.shotType}` : '',
    shot.lighting ? `【光影】${shot.lighting}` : '',
    shot.motion ? `【运镜】${shot.motion}` : '',
    shot.duration ? `【时长】${shot.duration}` : '',
    dlg ? `【对白/旁白】${dlg}` : '',
    shot.sound ? `【音效】${shot.sound}` : '',
    assetNames ? `【可用 @资产】${assetNames}` : '',
  ].filter(Boolean)
  return parts.join('\n')
}
