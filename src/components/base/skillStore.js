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
import { sGet, sSet } from './storageAdapter.js'

const SKILLS_KEY = 'agent_skills'

/* ── 内置 Skill（改写自大雄 universal-detail-pages.json，适配我们的 generations 执行契约）── */
const BUILTIN_SKILLS = [
  {
    id: 'skill_ecommerce_detail',
    name: '电商详情页套图',
    description: '根据产品信息与产品图，生成电商主图 + 详情页套图（数量靠你说：如「5主图+8详情」）',
    builtin: true,
    content: `你是一位电商视觉设计大师。根据用户提供的【产品信息】【产品图】和本 Skill，规划一套电商主图+详情页视觉方案。

【执行方式】不要自己直接建节点。你必须输出一个可执行的 generations 计划（每张图一个步骤），交给 execute_plan 工具执行。

【规划规则】
- 每张图 = 一个 generation 步骤：{ id, title, prompt, ratio, resolution, depends_on_previous, dependency_mode }。
- prompt 必须是完整、纯净、可直接生图的中文视觉描述，包含：产品外观一致性（严格参考产品图）、构图、光线、材质、配色、短文案和版式位置。
- 用户指定张数/页数就按用户来（如 5 主图+8 详情=13 张）；没指定就默认 3 主图。
- 主图比例用 1:1 或 3:4；详情页用宽长图（9:16 或 16:9 依产品定）。
- 需要保持产品一致性时，后续步骤 depends_on_previous=true、dependency_mode=product_reference（执行器会用前序成功图当参考图）。

【主图结构】首屏主视觉（产品高级光影）→ 核心卖点 → 品质/材质细节 → 使用场景。
【详情页结构】视觉首屏 → 卖点速览 → 痛点解决 → 材质工艺 → 参数说明。
【合规】不编造参数、不用极限词（绝对第一/100%有效）、不夸大功效。

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
    const raw = sGet(SKILLS_KEY)
    const arr = raw ? JSON.parse(raw) : []
    return Array.isArray(arr) ? arr : []
  } catch {
    return []
  }
}

/** 保存用户自定义 skill 列表 */
export function saveCustomSkills(list) {
  try {
    sSet(SKILLS_KEY, JSON.stringify(Array.isArray(list) ? list : []))
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
    name: skill.name,
    description: skill.description || '',
    content: skill.content,
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
    const raw = sGet(USAGE_KEY)
    const m = raw ? JSON.parse(raw) : {}
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
  try { sSet(USAGE_KEY, JSON.stringify(m)) } catch { /* 忽略 */ }
  return next
}
/** 读某 Skill 使用次数 */
export function getSkillUsage(id) {
  return Number(getUsageMap()[id]) || 0
}
