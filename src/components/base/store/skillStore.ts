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
import { contentGet, contentSet, contentReadThrough } from '../core/contentStore.ts';
import { logger } from '../core/logger.ts';

/** Skill 结构（对齐大雄 builtin_skills：name/description 供 UI，content 无损注入 LLM） */
export interface Skill {
  id: string;
  name: string;
  description: string;
  content: string;
  createdAt?: number;
  updatedAt?: number;
  builtin?: boolean;
}

/** 自定义 Skill 读取的结果封装（list 恒为 array，error 携带底层真实原因） */
export interface SkillResult {
  ok: boolean;
  list: Skill[];
  error: string;
}

const SKILLS_KEY: string = 'agent_skills';

/* ════════════════════════════════════════════════════════════════
 * mojibake 乱码修复（对齐大雄 backend.py `_repair_mojibake_text`）
 * ────────────────────────────────────────────────────────────────
 * 检测「UTF-8 被误当 Latin-1/CP1252 解码」的中文乱码（外部 .md 导入时高发），
 * 把误解码字符按字节反解回 UTF-8。只在像乱码且反解后含 CJK 时才替换，否则保留原文。
 */
export function repairMojibakeText(text: string): string {
  if (!text) return text;
  const s = String(text);
  const CP1252 = [
    0x20ac, 0x201a, 0x0192, 0x201e, 0x2026, 0x2020, 0x2021, 0x02c6, 0x2030, 0x0160, 0x2039, 0x0152,
    0x017d, 0x2018, 0x2019, 0x201c, 0x201d, 0x2022, 0x2013, 0x2014, 0x02dc, 0x2122, 0x0161, 0x203a,
    0x0153, 0x017e, 0x0178,
  ];
  let cjk = 0;
  let latinHigh = 0;
  let cp1252 = 0;
  for (const ch of s) {
    const c = ch.codePointAt(0);
    if (c >= 0x4e00 && c <= 0x9fff) cjk++;
    else if ((c >= 0xc0 && c <= 0x024f) || (c >= 0x1e00 && c <= 0x1eff)) latinHigh++;
    else if (CP1252.includes(c)) cp1252++;
  }
  const score = latinHigh + cp1252;
  const looksLike = (score >= 2 && cjk === 0) || (score >= 3 && score > cjk);
  if (!looksLike) return s;
  // 反解：每个字符视为一个 Latin-1 字节，再按 UTF-8 重新解码
  try {
    const bytes = new Uint8Array([...s].map((ch) => ch.charCodeAt(0) & 0xff));
    const decoded = new TextDecoder('utf-8').decode(bytes);
    // 【误改防护·唯一闸门】反解后必须含 CJK，否则视为误判并保留原文。
    // 纯英文内容（含 ™ € é 等字符、cjk=0）会被上方 looksLike 判定为乱码，
    // 但其反解结果是「无中文的乱码串」——本闸门据此拦住，避免内容被静默改写后
    // 写回存储、原内容不可恢复。宁可不修，不可错改。
    //
    // ⚠️ 勿再加「长度塌陷」类阈值：UTF-8 中文是 3 字节→1 字符，真实乱码修复后
    //    长度比恒为 ≈0.33（如「çµå」→「电商」6→2）。任何 <0.5 的阈值都会把
    //    真实修复全部误杀，令本功能彻底失效（实测已验证）。
    if (!/[\u4e00-\u9fff]/.test(decoded)) return s;
    return decoded;
  } catch (e) {
    logger.warn('skillStore', '乱码反解失败，保留原文', e?.message || e);
    return s;
  }
}

/* ── 内置 Skill（改写自大雄 universal-detail-pages.json，适配我们的 generations 执行契约）── */
const BUILTIN_SKILLS: Skill[] = [
  {
    id: 'skill_ecommerce_detail',
    name: '电商详情页套图',
    description: '根据产品信息与产品图，生成电商主图 + 详情页套图（数量靠你说：如「5主图+8详情」）',
    builtin: true,
    content: `你是一位顶级的电商视觉设计大师。你的任务是根据用户提供的产品信息、产品图和参考图，策划一套电商主图+详情页视觉方案，并严格以 JSON 格式输出。

【工作流铁律】
直接输出最终的规划 JSON。绝对不要附加任何解释说明，用户明确说“确认“前绝对禁止直接生成图片，绝对不要调用任何画布工具。

【设计法则】
1. 视觉基准：产品图是外观的唯一基准，参考图只控风格（色调/光影/构图/材质）。
2. 文案极简：AI 生图易乱码，强制只用「短标题 / 短标签 / 模块化短句」，并在提示词中指明版式位置。
3. 比例规范：主图默认 1:1 或 3:4；详情页按产品特性使用 9:16 或 16:9。
4. 数量默认：若用户未指定，默认规划 3 张主图 + 5 张详情页。
5. 结构编排：
   - 主图：重在首屏吸睛、核心卖点速览、真实场景代入、材质工艺特写。
   - 详情页：重在情绪共鸣、痛点解决、结构拆解、参数与信任状展示。

【提示词（AI提示词）撰写铁律】
必须是完整、纯净、可直接生图的中文描述。包含：产品外观特征（强调保持原貌）、构图、光线氛围、材质质感、配色基调，以及画面中的短文案内容与排版位置。

【JSON 输出规范】
严格输出单个纯 JSON 对象（禁止 Markdown 代码块包裹，直接输出 \`{...}\`）：
{
  "globalStyle": "全局视觉定位（总结产品调性、核心色彩、光影风格，作为整套图的统一基调）",
  "rows": [
    {
      "页码": "主图1",
      "页面类型": "主图 / 详情页",
      "页面作用": "首屏主视觉 / 核心卖点 / ...",
      "画面内容": "画面场景与元素描述",
      "版式与文案": "排版结构及短文案内容",
      "AI提示词": "完整、纯净的中文生图提示词",
      "比例": "9:16",
      "分辨率": "1K"
    }
  ]
}`,
  },
];

/** 内置 skill */
export function getBuiltinSkills(): Skill[] {
  return BUILTIN_SKILLS.map((s) => ({ ...s }));
}

/**
 * 读用户自定义 skill 的「结果封装」——供 UI 层判断成败，错误原样透传。
 *
 * 【为什么需要它】getCustomSkills 把「确无数据」与「读取失败/数据损坏」都收敛成 []，
 * 调用方无法区分：损坏时 UI 显示空列表，用户一保存就把残缺列表覆盖写回 → 真删数据。
 * 本函数把二者拆开，list 恒为 array（永不 null，避免消费方 .filter 崩溃）。
 *
 * 【透传原则】error 原样携带底层原因（含实际类型），禁止泛化成「读取失败」抹掉真相。
 * @returns {{ ok: boolean, list: Array, error: string }}
 */
export function readCustomSkills(): SkillResult {
  let raw: unknown;
  try {
    raw = contentGet(SKILLS_KEY);
  } catch (e) {
    return { ok: false, list: [], error: e?.message || String(e) };
  }
  if (Array.isArray(raw)) return { ok: true, list: raw, error: '' };
  // 未存过（undefined/null）属于「确无数据」，不是错误
  if (raw === undefined || raw === null) return { ok: true, list: [], error: '' };
  // 非数组：多为 JSON.parse 失败回退的坏字符串（写一半被打断 / 跨版本结构变更 / 人工改过存储）。
  // 这是真实会发生的路径，必须可见——否则伪装成空列表，一保存即真删。
  const actual = Array.isArray(raw) ? 'array' : raw === null ? 'null' : typeof raw;
  return {
    ok: false,
    list: [],
    error: `自定义 Skill 数据损坏（期望 array，实际 ${actual}），未加载以免覆盖写入`,
  };
}

/** 读用户自定义 skill（内部消费方用；语义：无数据或损坏均返回 []，不抛错） */
export function getCustomSkills(): Skill[] {
  return readCustomSkills().list;
}

/**
 * 保存用户自定义 skill 列表。
 *
 * 【为什么 try/catch 抓不到失败】sSet 内部把 localStorage 异常吞掉并转 publish
 * 'persist:failed'（storageAdapter.js:76），本身不抛出 —— 故 contentSet 对 local
 * 后端几乎永不 reject，光靠 try/catch 会永远返回 ok:true 而静默丢数据。
 *
 * 【落盘确认】写完用 sGet 直读底层（绕过 contentStore 的 cache）比对：
 * contentSet 会先写 cache，若用 contentGet 回读将恒等于新值（实测：写失败时
 * 回读仍返回新值，清缓存后才读到旧值）——缓存会掩盖失败，必须用 sGet。
 *
 * 【错误透传】失败时返回 { ok:false, error }，由调用方决定呈现方式；
 * 禁止在无失败信号时向上谎报成功（原 SkillSettings 无条件弹「已保存」即此坑）。
 * @returns {{ ok: boolean, error?: string }}
 */
export function saveCustomSkills(list: Skill[]): { ok: boolean; error?: string } {
  const payload: Skill[] = Array.isArray(list) ? list : [];
  try {
    contentSet(SKILLS_KEY, payload);
  } catch (e) {
    return { ok: false, error: e?.message || String(e) };
  }
  // 落盘确认：比对持久化后的真值，防止「以为存上了其实没存上」
  // 2026-09-04 折叠治理：裸调 sGet 改走 contentReadThrough（同一「跳过缓存直读底层」语义，收口裸调点）
  const raw = contentReadThrough(SKILLS_KEY);
  if (raw === null) {
    // 空列表且未存过时属于正常（无数据可存）
    if (payload.length === 0) return { ok: true };
    return { ok: false, error: '写入后未能读回数据，可能未真正保存（检查存储空间/权限）' };
  }
  // 比对【内容】而非仅长度：删除/新增都可能产生长度相同的不同列表，
  // 只比长度会把「写入未生效」误判为成功（已实测踩到）。
  const expected = JSON.stringify(payload);
  if (raw === expected) return { ok: true };
  let persisted;
  try {
    persisted = JSON.parse(raw);
  } catch (e) {
    return { ok: false, error: `写入后回读数据损坏：${e?.message || String(e)}` };
  }
  if (!Array.isArray(persisted)) {
    return { ok: false, error: `写入未生效（回读非数组，实际 ${typeof persisted}）` };
  }
  // 内容归一化后再比（键顺序可能不同）
  if (JSON.stringify(persisted) === expected) return { ok: true };
  return {
    ok: false,
    error: `写入未生效：期望 ${payload.length} 项，落盘回读为 ${persisted.length} 项（数据可能未保存，请检查存储空间/权限）`,
  };
}

/** 全部 skill（内置 + 自定义） */
export function getAllSkills(): Skill[] {
  return [...getBuiltinSkills(), ...getCustomSkills()];
}

/** 按 id 找 skill */
export function findSkill(id: string): Skill | null {
  return getAllSkills().find((s) => s.id === id) || null;
}

/** 新增/更新用户自定义 skill */
export function upsertCustomSkill(skill: Partial<Skill>): Skill | null {
  if (!skill || !skill.name || !skill.content) return null;
  const list = getCustomSkills();
  const idx = list.findIndex((s) => s.id === skill.id);
  const now = Date.now();
  const clean: Skill = {
    id: skill.id || `skill_${now}`,
    name: repairMojibakeText(skill.name),
    description: repairMojibakeText(skill.description || ''),
    content: repairMojibakeText(skill.content),
    createdAt: skill.createdAt || now,
    updatedAt: now,
  };
  if (idx >= 0) list[idx] = clean;
  else list.push(clean);
  const res = saveCustomSkills(list);
  // 写失败 → 返回 null（既有契约：缺 name/content 也返回 null），
  // 调用方据此不得谎报「已保存」。错误已由 saveCustomSkills 透传，此处只做信号转发。
  if (!res.ok) {
    logger.warn('skillStore', '保存自定义 Skill 失败', res.error);
    return null;
  }
  return clean;
}

/**
 * 删除用户自定义 skill。
 * @returns {{ ok: boolean, error?: string }} 转发 saveCustomSkills 的写结果
 */
export function deleteCustomSkill(id: string): { ok: boolean; error?: string } {
  return saveCustomSkills(getCustomSkills().filter((s) => s.id !== id));
}

/* ── Skill 使用次数（对齐大雄 usage_count，localStorage 记录）── */
const USAGE_KEY: string = 'agent_skill_usage'; // { [skillId]: count }
function getUsageMap(): Record<string, number> {
  try {
    const m = contentGet(USAGE_KEY);
    return m && typeof m === 'object' ? (m as Record<string, number>) : {};
  } catch (e) {
    logger.warn('skillStore', '读取 Skill 使用次数失败', e?.message || String(e));
    return {};
  }
}
/** 记录一次 Skill 使用（+1），返回最新次数 */
export function markSkillUsed(id: string): number {
  const m = getUsageMap();
  const next = (Number(m[id]) || 0) + 1;
  m[id] = next;
  try {
    contentSet(USAGE_KEY, m);
  } catch (e) {
    // 统计类数据可降级，但禁止静默——透传原始原因便于排查 Key/配额问题
    logger.warn('skillStore', '写入 Skill 使用次数失败', e?.message || String(e));
  }
  return next;
}
/** 读某 Skill 使用次数 */
export function getSkillUsage(id: string): number {
  return Number(getUsageMap()[id]) || 0;
}

/* ── Skill 启用状态（localStorage 记录，内置 skill 默认启用，自定义默认启用）── */
const ENABLED_KEY: string = 'agent_skill_enabled'; // { [skillId]: boolean }
function getEnabledMap(): Record<string, boolean> {
  try {
    const m = contentGet(ENABLED_KEY);
    return m && typeof m === 'object' ? (m as Record<string, boolean>) : {};
  } catch (e) {
    logger.warn('skillStore', '读取 Skill 启用状态失败', e?.message || String(e));
    return {};
  }
}
function saveEnabledMap(map: Record<string, boolean>): void {
  try {
    contentSet(ENABLED_KEY, map);
  } catch (e) {
    logger.warn('skillStore', '写入 Skill 启用状态失败', e?.message || String(e));
  }
}

/** 判断某 skill 是否启用（默认启用） */
export function isSkillEnabled(id: string): boolean {
  const m = getEnabledMap();
  if (id in m) return !!m[id];
  return true; // 默认启用
}

/** 设置某 skill 启用/关闭
 * 注意：写入新对象，避免与缓存/其他调用方共享同一引用（引用共享会导致 React 不重渲染）。
 */
export function setSkillEnabled(id: string, enabled: boolean): void {
  const m = { ...getEnabledMap() };
  m[id] = !!enabled;
  saveEnabledMap(m);
}

/** 获取所有启用状态 map（供列表批量使用）
 * 注意：返回新对象（断开引用共享），否则组件用 setEnabledMap 设置后
 * 因引用未变被 React 判为「无变化」而不重渲染（表现为点了开关 UI 不立即刷新）。
 */
export function getAllEnabledMap(): Record<string, boolean> {
  return { ...getEnabledMap() };
}
