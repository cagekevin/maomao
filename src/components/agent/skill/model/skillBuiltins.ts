/**
 * 内置 Skill（**代码常量**）—— 它的**唯一家**在这里。
 *
 * 【为什么必须住本模块】"当前全部可用 Skill" 的真相 = 缓存里的用户 skill ∪ 这里的常量。
 * 内置常量此前住在 `runtime/skillStore.ts`（legacy 层），于是"skill 是什么"有两个家：
 * 冻结（`freezeSkillTurn`）要按 id 找正文时，模块自己**看不到内置 skill**，
 * 只能由 UI 把正文镜像着传进来 —— 那正是 P4 装配断裂的根（TD-11-16）。
 * 【内置 skill 没有磁盘包】⇒ `category`/`slug` 天然缺失（不是"漏传"）：
 * `skill_read_file` 读它的附属文件必然失败，且话术说的是同一件事（"没有磁盘落点"）。
 * 【id 是稳定手写常量】内置 skill 没有 frontmatter 可写，id 由本文件钉死；改 id = 断启用态与留痕。
 */

/** 内置 Skill 的形状（不依赖 legacy `Skill`：本模块的类型真源在 `skillTypes.ts`） */
export interface BuiltinSkillDef {
  id: string;
  name: string;
  description: string;
  content: string;
  version?: string;
  /**
   * 字面量 `true`：内置身份标记 —— **UI 靠它分「官方」组**（`AgentPanel` 的 Skill 下拉）。
   * 冻结层的 `origin` 不读它（`freezeSkillTurn` 在缓存里查不到、在这里查到 ⇒ 就是内置），
   * 那张标记是"给界面认的"，别让它再兼任第二个判据。
   */
  builtin: true;
}

/* ── 内置 Skill（改写自大雄 universal-detail-pages.json，适配我们的 generations 执行契约）── */
const BUILTIN_SKILLS: BuiltinSkillDef[] = [
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

/** 内置 Skill（返回副本：调用方不被共享引用影响，避免 React 判"无变化"） */
export function getBuiltinSkills(): BuiltinSkillDef[] {
  return BUILTIN_SKILLS.map((s) => ({ ...s }));
}
