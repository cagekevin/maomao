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

import { SCRIPT_BOX_WORKFLOWS } from '../scriptbox/scriptBoxWorkflows.ts'

/**
 * 【边界】scriptBoxWorkflows 仍是 .js（真相源，暂不转），其结构按下游实际消费的字段
 * 定义最小视图，避免 any 扩散到本层全部导出。待其转 .ts 后改为直接引用其类型。
 */
interface WorkflowLike {
  script?: string
  shot?: string
  audit?: string
  assetTemplates?: Record<string, string>
  imageGenTemplates?: Record<string, ImageGenTemplate>
}

/** 生图类型定义：label=UI 显示名，sys=该类型专用的系统提示词片段 */
export interface ImageGenTemplate {
  label: string
  sys: string
}

const WF = SCRIPT_BOX_WORKFLOWS as Record<string, WorkflowLike>
const MANGA = WF.manga as WorkflowLike

/** 资产类别：character=角色 / scene=场景 / prop=道具（消费方可能传任意字符串，转字符串处理） */
export type AssetCategory = string

/** 单条对白（kind 存任意字符串，运行时按 '台词'/'旁白' 展示；如实标注避免过度收窄） */
export interface Dialogue {
  kind: string
  role: string
  text: string
}

/** 分镜对象（本层只消费以下字段；引擎侧另有新字段，故保留索引签名） */
export interface Shot {
  id?: number | string
  index?: number
  duration?: string
  description?: string
  shotType?: string
  lighting?: string
  dialogue?: Dialogue[]
  sound?: string
  motion?: string
  grid?: number
  prompt?: string
  videoPrompt?: string
  [key: string]: unknown
}

/** 剧本资产（本层读 name / imageUrl / picked / id） */
export interface ScriptAsset {
  id?: string | number
  name?: string
  category?: AssetCategory
  description?: string
  imageUrl?: string
  thumbnailUrl?: string
  picked?: boolean
  [key: string]: unknown
}

/** 角色 / 场景 / 道具 参考图模板（默认来自工作流「漫剧」，逐字对应 c_.jsx 设置弹窗默认值）。 */
export const ASSET_TEMPLATES: Record<string, string> = MANGA.assetTemplates || {}

/** 剧本生成——用户可编辑的创作部分（角色定位/创作哲学/创作流程）。
 *  只负责"怎么写故事"，不含输出 JSON 结构（结构在 SCRIPT_WRITER_FORMAT，固定不可改）。
 *  默认来自工作流「漫剧」。 */
export const SCRIPT_WRITER_SYSTEM: string = MANGA.script || ''

/** 剧本生成——固定输出格式（运行时契约，引擎按此解析 shots/assets，用户不可改）。
 *  无论用户怎么改 SCRIPT_WRITER_SYSTEM，此格式都强制追加，保证 LLM 返回可解析的 JSON。 */
export const SCRIPT_WRITER_FORMAT = `

【输出格式】严格输出一个 JSON 对象（只返回纯 JSON，不要解释、不要 Markdown 代码块）：
{"projectName":"根据故事生成的简洁项目名称，2至8个中文字符，例如：小红帽","globalStyle":"整部片子的统一视觉风格，例如：中世纪童话·皮克斯3D","logline":"一句话故事核心（用于自检，可选）","shots":[{"index":1,"duration":"5s","description":"画面描述：聚焦这一镜要呈现的画面与动作，只对已注册资产用 @名称 引用，例如 @小红帽 走进 @幽暗森林；场景内的普通陈设（家具/门窗/阳台等）与光线/天气/氛围用普通文字描述，不 @","shotType":"景别","lighting":"光影氛围","dialogue":"该镜对白或旁白（如有）","sound":"音效（如有）","motion":"运镜"}],"assets":[{"category":"character|scene|prop","name":"名称","description":"主体外观描述，详细具体。注册 scene/prop 的唯一标准：能单独生成一张有效参考图。角色身上穿戴的饰品（项圈/铃铛/项链）属角色属性，不单独注册；场景内部家具/门窗/阳台等陈设与光线/天气/氛围不能单独成图，不注册、不 @，归入所属场景的 description；scene=角色站进去的完整空间（如 @客厅、@森林），描述空间结构/主要陈设/氛围光线；prop=全片反复出镜、场景图里看不清、需单独成图强调的关键道具（如 @烤鱼）；只描述主体本身，不写构图/视角/布光/负面词，这些由系统自动补全"}]}
【硬性要求】故事中出现的所有场景必须全部注册为 scene 资产，每个分镜的 description 必须 @ 引用其发生的场景；assets 的 name 必须与 shots 的 description 中 @ 引用的名称完全一致；分镜数量与时长要与剧情体量匹配，叙事连贯、有头有尾。`

/** 分镜导演系统提示词（默认来自工作流「漫剧」，只返回 JSON prompt/videoPrompt） */
export const SHOT_DIRECTOR_SYSTEM: string = MANGA.shot || ''

/**
 * 提示词审计改写系统提示词（聊天式"按意见改"专用通道；默认来自工作流「漫剧」）。
 * 与 SHOT_DIRECTOR_SYSTEM（一次生成 prompt/videoPrompt）不同，本提示词用于：
 * 用户已有一条现成提示词，提出修改意见，AI 以「导演 / 表演 / 美术」三岗位框架
 * 做静默审计式改写——只改该改的，保持其余不变，输出**单条改写后的提示词文本**
 * （不再返回 JSON，因为只针对一个字段）。
 */
export const SHOT_AUDIT_SYSTEM: string = MANGA.audit || ''

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
/** 可被审计改写的提示词字段 */
export type AuditField = 'prompt' | 'videoPrompt'

export function buildAuditUser(
  shot?: Shot | null,
  field: AuditField = 'prompt',
  feedback?: string,
  assetNames: string[] = []
): string {
  const current = String(shot?.[field] || '').trim()
  const desc = String(shot?.description || '').trim()
  const dia = dialogueText(shot?.dialogue)
  const names = Array.isArray(assetNames) ? assetNames.filter(Boolean) : []
  // 用户修改意见放最前：它是本次审计改写的最高指令，优先强调要改什么，再给镜头资料供改写参考，
  // 避免在长上下文中被稀释（对应 MANGA_AUDIT「意见与三框架冲突时以用户意见为准」）。
  const parts = [`【用户修改意见（必须严格遵循）】\n${String(feedback || '').trim()}`]
  if (desc) parts.push(`【本镜画面描述】\n${desc}`)
  if (dia) parts.push(`【对白/旁白】\n${dia}`)
  if (names.length) parts.push(`【可用 @资产】\n${names.map((n) => `@${n}`).join('、')}`)
  if (field === 'videoPrompt' && shot?.duration) parts.push(`【时长】\n${shot.duration}`)
  parts.push(`【当前${field === 'prompt' ? '生图' : '生视频'}提示词（待改写）】\n${current || '（空）'}`)
  return parts.join('\n\n')
}

/** 资产生图提示词拼装（对应 shared.js Zg）：`[视觉风格：xx] + desc + 句号 + 模板` */
export function ZgPrompt(
  category?: string,
  desc?: string,
  style?: string,
  customTemplates?: Record<string, string> | null
): string {
  const cat = ['character', 'scene', 'prop'].includes(category) ? category : 'character'
  const d = (desc || '').trim()
  const tpl = (customTemplates && customTemplates[cat]) || ASSET_TEMPLATES[cat]
  const body = `${d}${d && !/[。.!!？?]$/.test(d) ? '。' : ''}${tpl}`
  return (style ? `[视觉风格：${style}]` : '') + body
}

/** 单分镜对白数组 → 可读文本（"台词/旁白: text" 用 / 连接） */
export function dialogueText(arr?: Dialogue[] | null): string {
  const list = Array.isArray(arr) ? arr : []
  if (!list.length) return ''
  return list
    .map((d) => (d.kind === '旁白' ? `[旁白] ${d.text}` : `${d.role || '台词'}: ${d.text}`))
    .join(' / ')
}

/**
 * 文本（逐行）→ 对白数组 [{kind, role, text}]。
 * 系统内 dialogue 的标准结构是数组（dialogueText 只认数组、StepShots 对白编辑弹窗用数组），
 * 而编剧模型按 SCRIPT_WRITER_FORMAT 返回的是字符串。此函数统一把字符串转成标准数组。
 *  - 每行 `角色：台词` → { kind:'台词'|'旁白', role, text }
 *  - 无冒号的行 → { kind:'台词', role:'', text }
 */
export function textToDlg(text?: string | null): Dialogue[] {
  return String(text || '')
    .split('\n')
    .filter((l) => l.trim())
    .map((l: string) => {
      const m = l.match(/^([^：:]+)[：:](.+)$/)
      if (m) {
        const role = m[1].trim()
        return { kind: role === '旁白' ? '旁白' : '台词', role, text: m[2].trim() }
      }
      return { kind: '台词', role: '', text: l.trim() }
    })
}

/** 归一化 dialogue 字段：已是数组直接用；字符串（编剧模型返回）转成标准数组；否则空数组。 */
export function normalizeDialogue(d?: unknown): Dialogue[] {
  if (Array.isArray(d)) return d
  if (d && typeof d === 'string' && d.trim()) return textToDlg(d)
  return []
}

/** 对白数组 → 可编辑文本（每行 `角色：文本`，与 textToDlg 互为逆；StepShots 对白编辑弹窗用）。
 *  roundtrip：textToDlg(dlgToText(arr)) 保持数据不丢（旁白/台词均可还原）。 */
export function dlgToText(arr?: Dialogue[] | null): string {
  const list = Array.isArray(arr) ? arr : []
  return list.map((x) => `${x.role || '台词'}：${x.text}`).join('\n')
}

/** 长段提示词一键排版：每个句号类标点（。！？；）后补换行，标点留在行尾，合并多余空行。
 *  纯字符串处理，不破坏 @资产名 引用。供 StepPrompt 编辑弹窗打开时预格式化。 */
export function formatLineBreaks(text?: string | null): string {
  if (!text) return text
  return String(text)
    .replace(/([。！？；])(?!\s*\n)/g, '$1\n') // 句号后补换行（若后面不是已有换行）
    .replace(/\n{3,}/g, '\n\n') // 合并多余空行
    .trim()
}

/** 分镜时长数值解析（表格输入）：parseInt 兜底，非法/0/空 → fallback（默认 3）。
 *  对齐 StepShots 时长输入 `parseInt(x) || 3` 的既有语义。 */
export function parseShotSeconds(value?: unknown, fallback = 3): number {
  const n = Number.parseInt(String(value ?? ''), 10)
  return n || fallback
}

/** P6：@资产名高亮正则缓存——按「排序后名字列表」缓存编译结果，避免 hlAt 每次渲染重排 new RegExp。
 *  资产名集合有限（每个剧本盒子的资产数几十量级），带 size 上限防无限膨胀。 */
const HIGHLIGHT_RE_CACHE = new Map<string, RegExp>()
const HIGHLIGHT_RE_CACHE_MAX = 200
function getHighlightPattern(sorted: string[]): RegExp {
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
 * 以「注册资产名词典」从文本中取被 `@` 引用的资产名集合（垫图/参考图收集核心）。
 *
 * 【为什么不用 matchAsset 的「单名 + 后一位非中英数」边界】
 * 场景名词在中文剧本书写常紧贴方位词/名词（如 `@卧室内`），matchAsset 会把后一位中文
 * 当"更长词"误杀 → 场景永远收不进参考图（缺陷②根因）。而角色/道具之所以"碰巧正常"，
 * 只是它们恰好有一处 `@名` 后是逗号/引号。
 *
 * 【本方案：以注册名为词典，最长匹配】对齐 hlAt（高亮）的同一套匹配，使「高亮的 = 垫图的」。
 *  - `@卧室内` → 命中注册资产 `卧室`（不再看后一位）→ 场景可垫图；
 *  - `@小马妈妈` → 最长优先命中 `小马妈妈`，绝不误配 `小马`（保留防子串）。
 * 复用 getHighlightPattern 的排序/转义/缓存，保证与高亮口径完全一致。
 *
 * @param {string} text 待扫描文本
 * @param {string[]} [assetNames] 已注册资产名列表
 * @returns {Set<string>} 被 `@` 引用且确为注册名的资产名集合（可判空 / forEach）
 */
export function matchAssetNames(text?: string | null, assetNames?: string[] | null): Set<string> {
  const names = Array.isArray(assetNames) ? assetNames.map((n) => String(n ?? '')).filter(Boolean) : []
  const hit = new Set<string>()
  if (!text || names.length === 0) return hit
  const sorted = [...names].sort((a, b) => b.length - a.length)
  const pattern = getHighlightPattern(sorted)
  pattern.lastIndex = 0 // 复用缓存正则前重置游标（hlAt 走 split，不走 exec，互不影响）
  let m
  while ((m = pattern.exec(text)) !== null) {
    const nm = m[1] && m[1].startsWith('@') ? m[1].slice(1) : ''
    if (nm && names.includes(nm)) hit.add(nm)
  }
  return hit
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
export function hlAt(text?: string | null, assetNames?: string[] | null): string {
  const esc = (s: unknown) => (s == null ? '' : String(s)).replace(/[&<>]/g, (c) => (c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : c))
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
export function patchShots(
  shots: Shot[] | null | undefined,
  idx: number,
  field: string | Record<string, unknown>,
  val?: unknown
): Shot[] {
  return (shots || []).map((s, i) => {
    if (i !== idx) return s
    // 正向分支收窄 field 联合（string | object），各自独立 return，避免在 else 侧取键时类型含糊
    if (typeof field === 'string') return { ...s, [field]: val }
    if (field && typeof field === 'object') return { ...s, ...field }
    return s
  })
}

/** 新增分镜（StepShots addShot 纯函数化）：id/index 按当前数组末尾自增，缺省字段用默认值。 */
export function createNewShot(shots?: Shot[] | null): Shot {
  const list = Array.isArray(shots) ? shots : []
  const last = list[list.length - 1]
  // Number() 归一：last.id 可能来自旧数据（字符串），统一数值化自增
  return {
    id: Number(last?.id || 0) + 1,
    index: list.length + 1,
    duration: '3s',
    description: '双击编辑画面描述（@引用资产）',
    shotType: '中景',
    lighting: '自然光',
    dialogue: [],
    sound: '环境音',
    motion: '固定',
    grid: 0,
    prompt: '',
    videoPrompt: '',
    promptLoading: false,
    connImg: false,
    connVid: false,
    usePrevShotVideoTail: false,
    prevShotImageRefUrls: [],
    prevTailFrameVariants: [],
    selectedTailFrameVariantId: 'original',
    tailFrameVariantsLoading: false,
    tailFrameVariantsError: undefined,
  }
}

/** 删除分镜（StepShots delShot 纯函数化）：移除第 idx 个并重排 index 连续。 */
export function removeShot(shots: Shot[] | null | undefined, idx: number): Shot[] {
  return (shots || []).filter((_, i) => i !== idx).map((s, i) => ({ ...s, index: i + 1 }))
}

/** 尾帧选帧写回（StepShots selectTailFrame 纯函数化）：
 *  选帧 → usePrevShotVideoTail=true + 参考 URL 数组；不使用 → 清空开关与参考 URL。
 *  @param shots   分镜数组
 *  @param shotId  目标分镜 id
 *  @param variant 尾帧变体 { id, imageUrl }（useTail=false 时可空）
 *  @param useTail 是否使用尾帧
 *  @returns 新 shots 数组；找不到 shotId 返回 null（调用方据此直接 return，不写回） */
/** 尾帧变体（选帧弹窗的候选项） */
export interface TailFrameVariant {
  id?: string
  imageUrl?: string
  [key: string]: unknown
}

export function applyTailFrameSelection(
  shots: Shot[] | null | undefined,
  shotId: number | string,
  variant?: TailFrameVariant | null,
  useTail?: boolean
): Shot[] | null {
  const list = Array.isArray(shots) ? shots : []
  const idx = list.findIndex((x) => x.id === shotId)
  if (idx < 0) return null
  const url = useTail && variant?.imageUrl ? [variant.imageUrl] : []
  return list.map((x, i) =>
    i === idx
      ? { ...x, usePrevShotVideoTail: useTail, selectedTailFrameVariantId: useTail ? (variant?.id || 'original') : 'original', prevShotImageRefUrls: url }
      : x
  )
}

/** 判断文本 e 中是否存在合法的 `@资产名` 引用（复刻官方 shared.js Fa）。
 *  规则：`@名` 后一位必须是结尾或非中英数，防止 `@小马` 误匹配 `@小马妈妈`。 */
export function matchAsset(text?: string | null, name?: string | null): boolean {
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
export function stripAtRef(text?: string | null, name?: string | null): string | null {
  // 空 text / 空 name → 原样返回（null 保持 null，测试契约断言 `toBe(null)`）
  if (!text || !name) return text
  const re = new RegExp(`@${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\u4e00-\\u9fa5A-Za-z0-9])`, 'g')
  return text.replace(re, () => name)
}

/** 删除资产联动清理（StepAssets delAsset 纯函数化）：移除资产后，把各镜头文本里的 `@名`
 *  标记去掉（复用 stripAtRef，只去 @ 保留名字文字）。返回 updateData 的 patch 对象。
 *  @returns {{ assets:Array, pickedCount:number, shots?:Array }} */
/** 删除资产后的 data patch：shots 仅在资产有 name（需清理引用）时出现 */
export interface RemoveAssetPatch {
  assets: ScriptAsset[]
  pickedCount: number
  shots?: Shot[]
}

export function removeAsset(
  assets: ScriptAsset[] | null | undefined,
  id: string | number,
  shots?: Shot[] | null
): RemoveAssetPatch {
  const list = Array.isArray(assets) ? assets : []
  const target = list.find((a) => a.id === id)
  const next = list.filter((a) => a.id !== id)
  const patch: RemoveAssetPatch = { assets: next, pickedCount: next.filter((a) => a.picked).length }
  if (target?.name) {
    const shotList = Array.isArray(shots) ? shots : []
    patch.shots = shotList.map((s) => {
      const nextShot = { ...s } as Record<string, unknown>
      ;['description', 'prompt', 'videoPrompt'].forEach((f) => {
        // 存储值不可信，取字符串子集交给 stripAtRef（纯字符串处理，数值/对象原样跳过）
        const val = nextShot[f]
        if (typeof val === 'string' && val) nextShot[f] = stripAtRef(val, target.name)
      })
      return nextShot as Shot
    })
  }
  return patch
}

/** 资产改名联动（StepAssets AssetPanel.save 纯函数化）：把全部镜头 description 里 `@旧名` 引用
 *  改写成 `@新名`。与既有实现一致：split('@') 后按「片段以旧名开头」判断（会同时命中 `@旧名xx` 等
 *  以旧名开头的更长词），抽取时不改变原有行为。 */
export function renameAssetRefs(
  shots: Shot[] | null | undefined,
  oldName: string,
  newName: string
): Shot[] {
  return (shots || []).map((s) => {
    const desc = String(s.description || '')
    const next = desc
      .split('@')
      .map((seg, k) => (k ? (seg.startsWith(oldName) ? '@' + newName + seg.slice(oldName.length) : '@' + seg) : seg))
      .join('')
    return { ...s, description: next }
  })
}

/** 收集某个分镜引用的「有图资产」作为参考图（复刻官方 shared.js Ra 的 scriptBoxNode 分支）。
 *  @param shot   分镜对象（读 description/prompt/videoPrompt/dialogue）
 *  @param assets 资产数组（读 name/imageUrl）
 *  @returns { id, url, label }[]  该镜头 @名 匹配到且有图（imageUrl）的资产，供下游生图/生视频作参考图；label=资产名
 *
 * 匹配口径（2026-08-28 修复缺陷②）：用「注册资产名词典 + 最长匹配」`matchAssetNames` 替代原
 * `matchAsset` 的「单名 + 后一位非中英数」边界。原因见 matchAssetNames 注释——场景 `@卧室内`
 * 原被边界误杀导致永远垫不上；现与 hlAt 高亮口径一致，高亮的即垫图的。 */
/** 收集到的参考图条目 */
export interface CollectedAsset {
  id: string
  url: string
  label: string
}

export function collectAssets(shot?: Shot | null, assets?: ScriptAsset[] | null): CollectedAsset[] {
  const list = Array.isArray(assets) ? assets : []
  if (!shot || list.length === 0) return []
  const text = `${shot.description || ''} ${shot.prompt || ''} ${shot.videoPrompt || ''} ${shot.dialogue || ''}`
  const refNames = matchAssetNames(text, list.map((a) => a.name))
  const out: CollectedAsset[] = []
  list.forEach((a) => {
    if (a?.name && a.imageUrl && refNames.has(a.name)) {
      // label = 资产名，让下游候选列表显示真实名（配合 PromptInput @名 自动匹配）
      out.push({ id: `script-asset-${a.id}`, url: a.imageUrl, label: a.name })
    }
  })
  return out
}

/**
 * 多个分镜合并 → 一次视频生成的入参（P0：合并生成视频）。
 *
 * 【单一数据来源铁律】剧本的镜号/时长等已在第一步（StepShots 表格）定好，本函数只做「累加/拼装」，
 * 不新增任何字段、不修改剧本数据、不在 prompt 里写"请生成约N秒"之类的时长提示（时长由视频节点选项决定）。
 *
 * @param {object[]} shots  选中的多个分镜（按剧本顺序，读 duration/videoPrompt）
 * @param {object[]} assets 剧本资产列表（供 collectAssets 逐镜收集 @资产图）
 * @returns {{ prompt:string, images:Array<{id,url}>, seconds:number }}
 *   - prompt  = 各镜 videoPrompt 拼接（空段跳过，用换行分隔）
 *   - images  = 各镜引用的有图资产合并去重（复用 collectAssets 口径）
 *   - seconds = 各镜 duration 秒数累加（parseInt，缺省 5）
 */
/** 合并生成视频的入参 */
export interface MergedVideoInput {
  /** 各镜 videoPrompt 拼接（空段跳过，用换行分隔） */
  prompt: string
  /** 各镜引用的有图资产合并去重 */
  images: Array<{ id: string; url: string }>
  /** 各镜 duration 秒数累加 */
  seconds: number
}

export function mergeShotsForVideo(shots?: Shot[] | null, assets?: ScriptAsset[] | null): MergedVideoInput {
  const list = Array.isArray(shots) ? shots : []
  const prompt = list
    .map((s) => String(s?.videoPrompt || '').trim())
    .filter(Boolean)
    .join('\n\n')
  // 各镜 @资产图合并去重（url 为键，保留首个）
  const seen = new Set<string>()
  const images: Array<{ id: string; url: string }> = []
  for (const s of list) {
    for (const im of collectAssets(s, assets)) {
      if (!im?.url || seen.has(im.url)) continue
      seen.add(im.url)
      images.push({ id: im.id || `script-asset-${images.length}`, url: im.url })
    }
  }
  const seconds = list.reduce(
    (sum, s) => sum + Math.max(1, Number.parseInt(String(s?.duration || '5'), 10) || 5),
    0
  )
  return { prompt, images, seconds }
}

/** 单个分镜的生图/生视频提示词（buildShots 模板生成用；约束已收敛到 playbook 经引擎注入，故无入参）。
 *  注：就地写回 shot.prompt / shot.videoPrompt 并返回同一对象（历史行为，勿改成不可变）。 */
export function buildShotPrompts(shot: Shot): Shot {
  const dlg = dialogueText(shot.dialogue)
  const base = `电影感画面，${shot.description}${shot.shotType ? `，景别：${shot.shotType}` : ''}${shot.lighting ? `，光影：${shot.lighting}` : ''}，运镜：${shot.motion || '固定'}`
  shot.prompt = base
  shot.videoPrompt = `镜头时长 ${shot.duration || '5s'}，${base}${dlg ? `，对白/旁白：${dlg}` : ''}，音效：${shot.sound || ''}`.trim()
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
export function buildShots(n: number): Shot[] {
  const shots: Shot[] = []
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
export function buildAssets(style?: string, customTemplates?: Record<string, string> | null): ScriptAsset[] {
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
    imageStatus: ''
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
export const IMAGE_GEN_TYPES: Record<string, ImageGenTemplate> = MANGA.imageGenTemplates || {}

/** 默认选中类型 */
export const IMAGE_GEN_DEFAULT = 'keyframe'

/** 把单个分镜某类型的「用户内容」拼成一次 LLM 调用的 user message（纯函数，无副作用） */
export function buildShotImageUser(
  shot?: Shot | null,
  type?: string,
  { globalStyle = '', assets = [] }: { globalStyle?: string; assets?: ScriptAsset[] } = {}
): string {
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

/**
 * 合并生成视频 · system 提示词（思路A：合并时让 AI 重新生成一条序号连贯的合并提示词）。
 *
 * 【为什么需要】若直接拼装各镜 videoPrompt，每个镜头的"第一个画面/第二个画面"会重复出现
 * （第一个画面…，第一个画面…），模型分不清顺序。故合并时改为把各镜资料喂给 AI，
 * 让它按镜头顺序用"第一个画面…第N个画面"一路编号到底，生成一条连续、连贯的视频提示词。
 *
 * 【规则】输出单条中文视频提示词文本（供视频生成节点生成视频），不返回 JSON。
 */
export const MERGE_VIDEO_SYSTEM = `你是资深 AI 视频提示词工程师。下面会给出多个连续镜头，每个镜头单独成一块，标题形如"【第N个镜头】"，块内依次是画面描述、景别、光影、运镜、对白、音效。请把这些镜头按顺序合并成一条连贯的中文视频提示词。

要求：
1. 把镜头按照时间逻辑顺序连起来。
2. 不要用"0~3秒/第X秒"这类时间区间描述镜头。
3. 资料里标"（未指定）/（无）"的字段，照实保留，不要自行编造。
4. 只输出中文提示词，不要解释、不要 Markdown、不要 JSON。`

/**
 * 合并生成视频 · user content 拼装（思路A）：把选中镜头资料按顺序列出，喂给 AI 生成合并提示词。
 * @param {object[]} shots 选中的多个镜头（按剧本顺序）
 * @param {object[]} [assets] 剧本资产（可选，仅用于列出可用 @资产，不强约束）
 * @returns {string}
 */
export function buildMergedVideoUser(shots?: Shot[] | null, assets: ScriptAsset[] = []): string {
  const list = Array.isArray(shots) ? shots : []
  const assetNames = (assets || []).map((a) => a.name).filter(Boolean).join('、')
  const parts = [
    `下面共 ${list.length} 个连续镜头，它们按顺序构成一段连续视频。每个镜头单独成一块，标题"【镜头N】"对应剧本里的镜号，请你把这些镜头按顺序连成一个长视频：`,
  ]
  list.forEach((s, i) => {
    const rows = [`【镜头${s?.index ?? i + 1}】`]
    // 每个字段始终输出；缺省明确写「（未指定）」，禁止留空让 AI 自行脑补（防瞎编）。
    rows.push(`画面描述：${String(s?.description || '').trim() || '（未指定）'}`)
    rows.push(`景别：${String(s?.shotType || '').trim() || '（未指定）'}`)
    rows.push(`光影：${String(s?.lighting || '').trim() || '（未指定）'}`)
    rows.push(`运镜：${String(s?.motion || '').trim() || '（未指定）'}`)
    const dlg = dialogueText(s?.dialogue)
    rows.push(`对白/旁白：${dlg || '（无）'}`)
    rows.push(`音效：${String(s?.sound || '').trim() || '（无）'}`)
    parts.push(rows.join('\n'))
  })
  if (assetNames) parts.push(`可用 @资产：${assetNames}（在对应画面里按需出现，保留 @名称）`)
  return parts.join('\n\n')
}
