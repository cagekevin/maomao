/**
 * Skill 数据层 —— 对齐大雄 canvas-agent 的 Skill 系统。
 *
 * 【Skill 结构】{ id, name, description, content }（纯提示词，无 schema，靠 LLM 解析 content 执行）
 *  - content 是一大段结构化提示词，指导 LLM 如何「阶段1 策划 → 阶段2 规划 → 执行」。
 *  - 对齐大雄 builtin_skills/*.json：name/description 用于 UI 列表，content 无损注入 LLM。
 *
 * 【存储】内置 skill（代码常量）+ 用户自定义（localStorage，key=agent_skills）。
 *  - 内置 skill 始终存在；用户自定义可增删。
 */
import { contentGet, contentSet } from './contentStore.js'

const SKILLS_KEY = 'agent_skills'

/* ════════════════════════════════════════════════════════════════
 * mojibake 乱码修复（对齐大雄 backend.py `_repair_mojibake_text`）
 * ────────────────────────────────────────────────────────────────
 * 检测「UTF-8 被误当 Latin-1/CP1252 解码」的中文乱码（外部 .md 导入时高发），
 * 把误解码字符按字节反解回 UTF-8。只在像乱码且反解后含 CJK 时才替换，否则保留原文。
 */
export function repairMojibakeText(text) {
  if (!text) return text
  const s = String(text)
  const CP1252 = [0x20ac, 0x201a, 0x0192, 0x201e, 0x2026, 0x2020, 0x2021, 0x02c6, 0x2030, 0x0160, 0x2039, 0x0152, 0x017d, 0x2018, 0x2019, 0x201c, 0x201d, 0x2022, 0x2013, 0x2014, 0x02dc, 0x2122, 0x0161, 0x203a, 0x0153, 0x017e, 0x0178]
  let cjk = 0
  let latinHigh = 0
  let cp1252 = 0
  for (const ch of s) {
    const c = ch.codePointAt(0)
    if (c >= 0x4e00 && c <= 0x9fff) cjk++
    else if ((c >= 0xc0 && c <= 0x024f) || (c >= 0x1e00 && c <= 0x1eff)) latinHigh++
    else if (CP1252.includes(c)) cp1252++
  }
  const score = latinHigh + cp1252
  const looksLike = (score >= 2 && cjk === 0) || (score >= 3 && score > cjk)
  if (!looksLike) return s
  // 反解：每个字符视为一个 Latin-1 字节，再按 UTF-8 重新解码
  try {
    const bytes = new Uint8Array([...s].map((ch) => ch.charCodeAt(0) & 0xff))
    const decoded = new TextDecoder('utf-8').decode(bytes)
    if (/[\u4e00-\u9fff]/.test(decoded)) return decoded
  } catch { /* 反解失败保留原文 */ }
  return s
}

/* ── 内置 Skill（改写自大雄 universal-detail-pages.json，适配我们的 generations 执行契约）── */
const BUILTIN_SKILLS = [
  {
    id: 'skill_ecommerce_detail',
    name: '电商详情页套图',
    description: '根据产品信息与产品图，生成电商主图 + 详情页套图（数量靠你说：如「5主图+8详情」）',
    builtin: true,
    content: `你是一位电商视觉设计大师。根据用户提供的【产品信息】【产品图】和本 Skill，规划一套电商主图+详情页视觉方案。

【执行方式】不要自己直接建节点。你必须输出一个可执行的 generations 计划（每张图一个步骤），交给 execute_plan 工具执行。

【前端输入】
- 产品图：三视图/多角度图优先级最高，是产品一致性的唯一基准。
- 参考风格图（若有）：只控风格（色调/光影/构图/背景材质/留白/字体气质/版式关系），不控产品外观。
- 语言：默认中文。

【品类自动判断】按产品信息匹配视觉重点：
- 户外车载：强场景/强功能/强参数，突出耐用与场景适配。
- 居家母婴：温暖/安全/柔软，突出材质亲肤与安心细节。
- 消费电子：科技/精密/克制，突出工艺与参数排版。
- 美妆个护：高级/氛围/肤感，突出质地与使用场景。

【规划规则】
- 每张图 = 一个 generation 步骤：{ id, title, prompt, ratio, resolution, depends_on_previous, dependency_mode }。
- prompt 必须是完整、纯净、可直接生图的中文视觉描述，包含：产品外观一致性（严格参考产品图）、构图、光线、材质、配色、短文案和版式位置。
- 用户指定张数/页数就按用户来（如 5 主图+8 详情=13 张）；没指定就默认 3 主图。
- 主图比例用 1:1 或 3:4；详情页用宽长图（9:16 或 16:9 依产品定）。
- 需要保持产品一致性时，后续步骤 depends_on_previous=true、dependency_mode=product_reference（执行器会用前序成功图当参考图）。

【文案排版规则】AI 直接生成复杂长文案易乱码，强制「短标题/短标签/模块化短句 + 明确版式结构」；产品名、卖点词用短标签，不写长篇大论。

【主图结构（逐页模板，5 页通用）】
1. 首屏主视觉：产品高级光影 + 大标题，画面干净、产品占主体。
2. 核心卖点：图文结合，卖点短标签 + 产品局部特写。
3. 材质/工艺细节：微距特写，突出质感。
4. 真实使用场景：产品在真实场景中，带氛围光。
5. 参数/尺寸/包装：产品 + 参数排版 + 包装展示。

【详情页结构（逐页模板，8 页通用）】
1. 视觉首屏情绪共鸣：大画面 + 品牌情感文案。
2. 核心优势速览矩阵：多卖点并排 + 图标/标签。
3. 痛点痛击场景引入：用户痛点 + 产品解决。
4. 材质工艺深度解析：微距 + 工艺说明。
5. 核心结构功能拆解：爆炸图/结构标注。
6. 真实场景沉浸：多场景展示产品应用。
7. 贴心细节信任状：认证/细节/售后。
8. 参数全家福购买指南：完整参数 + 尺寸 + 购买引导。

【统一风格提示词规则】每页 prompt 前默认加入基调；若用户提供了参考风格图，强制继承其色调/光影/构图/背景材质/留白/字体气质/版式关系。

【统一负面提示词规则】禁止改变产品外观/结构/颜色；禁止虚构认证/参数；禁止过暗、促销牛皮癣、变形、透视错误、缺图文排版结构。

【合规】不编造参数、不用极限词（绝对第一/100%有效/纯天然）、不夸大功效；若与统一负面词冲突以负面词为准。

【统一输出格式】规划时给出：视觉整体定位（产品类型/调性/参考风格总结/比例/语言/色调/版式/表达重点）+ 每页的页面作用 + 画面内容 + 版式结构 + 主副标题 + 卖点标签 + AI 提示词 + 文案排版说明。

【输出】直接调用 execute_plan 工具，传 generations 数组（每步含完整 prompt/ratio/resolution/依赖），并说明「已规划 N 张，开始生成」。`,
  },
]

/** 内置 skill */
export function getBuiltinSkills() {
  return BUILTIN_SKILLS.map((s) => ({ ...s }))
}

/** 读用户自定义 skill（localStorage） */
export function getCustomSkills() {
  try {
    const arr = contentGet(SKILLS_KEY)
    return Array.isArray(arr) ? arr : []
  } catch {
    return []
  }
}

/** 保存用户自定义 skill 列表 */
export function saveCustomSkills(list) {
  try {
    contentSet(SKILLS_KEY, Array.isArray(list) ? list : [])
  } catch { /* 忽略写失败 */ }
}

/** 全部 skill（内置 + 自定义） */
export function getAllSkills() {
  return [...getBuiltinSkills(), ...getCustomSkills()]
}

/** 按 id 找 skill */
export function findSkill(id) {
  return getAllSkills().find((s) => s.id === id) || null
}

/** 新增/更新用户自定义 skill */
export function upsertCustomSkill(skill) {
  if (!skill || !skill.name || !skill.content) return null
  const list = getCustomSkills()
  const idx = list.findIndex((s) => s.id === skill.id)
  const now = Date.now()
  const clean = {
    id: skill.id || `skill_${now}`,
    name: repairMojibakeText(skill.name),
    description: repairMojibakeText(skill.description || ''),
    content: repairMojibakeText(skill.content),
    createdAt: skill.createdAt || now,
    updatedAt: now,
  }
  if (idx >= 0) list[idx] = clean
  else list.push(clean)
  saveCustomSkills(list)
  return clean
}

/** 删除用户自定义 skill */
export function deleteCustomSkill(id) {
  saveCustomSkills(getCustomSkills().filter((s) => s.id !== id))
}

/* ── Skill 使用次数（对齐大雄 usage_count，localStorage 记录）── */
const USAGE_KEY = 'agent_skill_usage' // { [skillId]: count }
function getUsageMap() {
  try {
    const m = contentGet(USAGE_KEY)
    return m && typeof m === 'object' ? m : {}
  } catch {
    return {}
  }
}
/** 记录一次 Skill 使用（+1），返回最新次数 */
export function markSkillUsed(id) {
  const m = getUsageMap()
  const next = (Number(m[id]) || 0) + 1
  m[id] = next
  try { contentSet(USAGE_KEY, m) } catch { /* 忽略 */ }
  return next
}
/** 读某 Skill 使用次数 */
export function getSkillUsage(id) {
  return Number(getUsageMap()[id]) || 0
}

/* ── Skill 启用状态（localStorage 记录，内置 skill 默认启用，自定义默认启用）── */
const ENABLED_KEY = 'agent_skill_enabled' // { [skillId]: boolean }
function getEnabledMap() {
  try {
    const m = contentGet(ENABLED_KEY)
    return m && typeof m === 'object' ? m : {}
  } catch {
    return {}
  }
}
function saveEnabledMap(map) {
  try { contentSet(ENABLED_KEY, map) } catch { /* 忽略 */ }
}

/** 判断某 skill 是否启用（默认启用） */
export function isSkillEnabled(id) {
  const m = getEnabledMap()
  if (id in m) return !!m[id]
  return true // 默认启用
}

/** 设置某 skill 启用/关闭
 * 注意：写入新对象，避免与缓存/其他调用方共享同一引用（引用共享会导致 React 不重渲染）。
 */
export function setSkillEnabled(id, enabled) {
  const m = { ...getEnabledMap() }
  m[id] = !!enabled
  saveEnabledMap(m)
}

/** 获取所有启用状态 map（供列表批量使用）
 * 注意：返回新对象（断开引用共享），否则组件用 setEnabledMap 设置后
 * 因引用未变被 React 判为「无变化」而不重渲染（表现为点了开关 UI 不立即刷新）。
 */
export function getAllEnabledMap() {
  return { ...getEnabledMap() }
}
