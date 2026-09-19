/**
 * 可用字体清单 —— **收敛为「已安装的系统字体」**（2026-09-15 重写）
 *
 * ══════════════════════════════════════════════════════════════
 * 【为什么整份重写】（用户："字体不能选择 / 下拉面板还是没有显示"）
 *
 * 旧实现在清单里混了 5 个「Google 字体」（Inter / Roboto / Open Sans /
 * Playfair Display / Comic Neue），注释写着 `loaded in layout.tsx` ——
 * 那是**从 Next.js 项目抄来的化石**，本仓**没有**那个 layout，
 * 全库 **0 处** `@font-face` / `fonts.googleapis` / `document.fonts`。
 *
 * 后果是双重的，所以"怎么点都没反应"：
 *   ① **画布**：`ctx.font = '… Inter'` → 浏览器查不到已注册的 `Inter`
 *      → **静默回落到默认字体**（画布无任何错误、也不报错）；
 *   ② **下拉列表**：条目 `style={{ fontFamily }}` 预览同样的幽灵字体
 *      → 5 项和默认字体长得一模一样，整个列表看起来像坏的。
 *
 * 【为什么不"补上加载"而是删掉】
 * 加载 Web 字体需要下载资源（离线 / 打包 / 首屏字体闪烁 / 渲染竞态），
 * 属**新增业务能力**（心法 Step 5：业务决策交用户）。
 * 而清单里本来就有 Arial / Helvetica / Times New Roman / Georgia 四个
 * **系统自带**字体 —— "能选、且选了立刻生效"这个能力，不靠下载就已经成立。
 * 故本轮只做**把清单做正确**（删幽灵项），不擅自引入字体下载。
 *
 * 【纪律】往这里加任何字体前，先回答：**它在用户机器上存在吗？**
 *   · 系统字体 → 直接列（value 就是 CSS 里那个名字）；
 *   · 需下载的字体 → **不是加一行的事**：先加载 + 等 `document.fonts.ready`
 *     + 并在画布重绘前完成，否则又会得到"选了不生效"。
 *     那条链路是独立的一件事，不许在这里"先写上名字"，见上文的教训。
 *
 * ⚠️ 字体的**回落栈**不在这里 —— 它在 `engine/services/renderer/font-stack.ts`，
 * 因为那是"渲染时怎么解析这个名字"，属于渲染层的事（谁拥有真相，契约就定义在谁那）。
 * ══════════════════════════════════════════════════════════════
 */

/**
 * 字体族 → 该字体在用户机器不存在时的**回落链**（CSS `font-family` 值，逗号分隔）。
 * 【为什么要有它】清单只允许系统字体，但这些字体在别的平台未必齐全：
 *   · Helvetica 是 macOS 的（Windows 无）→ 回落 Arial；
 *   · Times New Roman / Georgia 在多数 Linux 桌面默认没有 → 回落通用族。
 * 有了回落链，"选了 Arial 却显示成 Helvetica" 这类**字体替换**就不会发生 ——
 * value 是什么就渲染成什么（同一排版，跨平台一致）。
 */
export interface FontOption {
  /** 写入元素数据的值，也是 CSS 里用的字体名（**必须真实存在**，见文件头纪律）。 */
  value: string;
  label: string;
  /**
   * 该字体不存在时的回落字体名列表（**不带引号，需要在 CSS 里带引号的自己带**）。
   * 渲染侧拼成 `"value", fallback1, fallback2` 交给浏览器。
   */
  fallback: string[];
  /**
   * 该字体**实际可用**的字重档位（UI 只列这些）。
   *
   * 【为什么字重必须挂在本结构上，而不是"全局 5 档"】
   * 字重能力**随字体而异**，而 `ctx.font` 对字体没有的字重是**静默取最近档**：
   *   · 苹方 / 思源 ≈ 6~7 档；· Arial / Helvetica / 微软雅黑 / 宋体 = **只有 400 / 700**。
   * 若给"全局 5 档"下拉，用户在微软雅黑上选 500 → 该字体无此档 → Canvas 回落 400
   * → 用户："我选了粗细，画布没变化"（= 幽灵项回潮，同文件头记录的那次翻车同形）。
   * ⇒ **只列"本字体的 fallback 链上各平台都保证存在"的档位**：宁可少列，不可让用户选到不存在的档。
   */
  weights: FontWeightOption[];
}

/** 一个可选字重档位。 */
export interface FontWeightOption {
  /** 写入 `TextElement.fontWeight` 的数字（CSS/Canvas 的 `font-weight` 值）。 */
  value: number;
  label: string;
}

/** 只保证 `400 / 700` 的字体（绝大多数非可变字体：Arial / 微软雅黑 / 宋体…）共用此档位表。 */
const WEIGHTS_REGULAR_BOLD: FontWeightOption[] = [
  { value: 400, label: '常规' },
  { value: 700, label: '加粗' },
];

/**
 * 可用字体清单。
 *
 * ══════════════════════════════════════════════════════════════
 * 【本次新增中文字体（2026-09-19）】用户："默认有 5 种，没有中文"。
 *
 * 为什么**不新增字体文件**（即"为什么这不是加一行下载"）：
 *   中文（尤其中文字体）在**用户机器上必然存在** —— 操作系统要显示中文。
 *   故按本文件头纪律，它们属「**系统字体 → 直接列**」那一类，**零下载**。
 *
 * 为什么 `value` 是「中文黑体 / 中文宋体」这样的**语义名**，而非某个具体字体名：
 *   **不存在一款跨平台都有、且名字相同的中文字体**（这正是 `fallback` 链存在的意义）：
 *     macOS  = 苹方 PingFang SC ／ 宋体 Songti SC
 *     Windows= 微软雅黑 Microsoft YaHei ／ 宋体 SimSun
 *     Linux  = 思源黑体（Source Han Sans ／ Noto Sans CJK，「思源」是 Adobe 名、
 *             「Noto」是 Google 发行名，两个名字都要列 —— 不同发行版装的不同）
 *   用户选的是「我要**黑体中文**」这个**排版意图**，具体由链解析成该机器上真实存在的字体。
 *   ⇒ 同一份工程在 macOS / Windows 上都能正常显示中文（各取本机那款）。
 *
 * ⚠️ 纪律不变：**这里只允许出现"用户机器上可能存在"的名字**。思源/Noto 只进
 *   `fallback`（"若有则用"），**不单独作为可选项** —— 否则在没装它们的机器上就是一个幽灵项。
 * ══════════════════════════════════════════════════════════════
 */
export const FONT_OPTIONS: FontOption[] = [
  // ── 中文（通用族，跨平台由 fallback 链解析） ──
  {
    value: '中文黑体',
    label: '中文黑体',
    fallback: [
      'PingFang SC', // macOS 苹方
      'Microsoft YaHei', // Windows 微软雅黑
      'Source Han Sans SC', // Linux 思源黑体（Adobe 名）
      'Noto Sans CJK SC', // Linux 思源黑体（Google 发行名）
      'Heiti SC', // macOS 旧版黑体
      'SimHei', // Windows 中易黑体
      'sans-serif',
    ],
    // 链上"最弱"的平台（微软雅黑 / 宋体体系）只有 400/700 ⇒ 全平台一致只列这两档
    weights: WEIGHTS_REGULAR_BOLD,
  },
  {
    value: '中文宋体',
    label: '中文宋体',
    fallback: [
      'Songti SC', // macOS 宋体
      'SimSun', // Windows 宋体
      'Source Han Serif SC', // Linux 思源宋体（Adobe 名）
      'Noto Serif CJK SC', // Linux 思源宋体（Google 发行名）
      'STSong', // macOS 华文宋体
      'serif',
    ],
    weights: WEIGHTS_REGULAR_BOLD,
  },
  // ── 西文（系统自带） ──
  {
    value: 'Arial',
    label: 'Arial',
    fallback: ['Helvetica', 'sans-serif'],
    weights: WEIGHTS_REGULAR_BOLD,
  },
  {
    value: 'Helvetica',
    label: 'Helvetica',
    fallback: ['Arial', 'sans-serif'],
    weights: WEIGHTS_REGULAR_BOLD,
  },
  {
    value: 'Times New Roman',
    label: 'Times New Roman',
    fallback: ['Times', 'serif'],
    weights: WEIGHTS_REGULAR_BOLD,
  },
  {
    value: 'Georgia',
    label: 'Georgia',
    fallback: ['Times New Roman', 'serif'],
    weights: WEIGHTS_REGULAR_BOLD,
  },
] as const;

/**
 * 可选字体名的联合类型。
 * ⚠️ 用 `string & {}` 兜住"**旧工程里已存的字体名**"（如上一版清单里的 Inter）——
 * 数据里可能已经有它，类型不该因此报错；渲染侧对未知名字会走通用回落链。
 */
export type FontFamily = string;

/**
 * 取某字体的**完整族栈**（栈首 = 该字体自己，其后是回落链）—— **唯一定义处**。
 *
 * ⚠️ **栈首必须包含 `fontFamily` 自身**（2026-09-19 修复）。
 * 原实现只返回 `fallback`（**不含自己**），于是 `buildFontFamilyStack` 的产出丢了栈首：
 *   · `Arial`      → `"Helvetica", "sans-serif"`  ← **Arial 丢了**（靠 Helvetica 长得像才没被发现，
 *                     而本文件的 `@example` 一直写着正确的 `"Arial", "Helvetica", sans-serif`
 *                     —— **文档与实现不一致**，是这条缺陷长期潜伏的原因）；
 *   · 新增的中文语义名（`中文黑体`）→ 连它自己都不在栈里，完全靠 `fallback` 链碰巧命中。
 * ⇒ 现在**统一把 `value` 放栈首**：真实字体名（Arial）与语义名（中文黑体）**同一形态**，
 *    `ctx.font` 与 CSS 预览共用这一份输出（不再各自拼、不再一含一不含）。
 *
 * 未知字体（如旧数据里的幽灵字体名）→ 原样保留在栈首，后接通用无衬线链，
 * 于是"渲染一个不存在的字体"不会变成"渲染不出来"，只会变成"渲染成默认无衬线"。
 */
export function getFontFallbackChain({ fontFamily }: { fontFamily: string }): string[] {
  const fallback = FONT_OPTIONS.find((font) => font.value === fontFamily)?.fallback ?? [
    'Arial',
    'sans-serif',
  ];
  // 去重：清单里若有字体把自己也写进 fallback，不重复出现（防将来手滑写重）
  return [fontFamily, ...fallback.filter((name) => name !== fontFamily)];
}

/**
 * 取某字体**实际可用**的字重档位 —— **唯一定义处**（UI 与渲染层共用，防两处各列一份）。
 *
 * 未知字体（含旧数据里的幽灵字体名）→ 回落 `400 / 700`（最保守：几乎所有字体都有这两档）。
 * 判据与理由见 `FontOption.weights` 注释。
 */
export function getFontWeights({ fontFamily }: { fontFamily: string }): FontWeightOption[] {
  return FONT_OPTIONS.find((font) => font.value === fontFamily)?.weights ?? WEIGHTS_REGULAR_BOLD;
}

/**
 * 该字体的 **CSS `font-family` 预览值**（带引号的完整回落链）—— 供 UI 预览（下拉项 / 触发器）。
 *
 * 【为什么不复用 `engine/…/font-stack.ts` 的 `buildFontFamilyStack`】
 * 那个函数产出的是给 **`ctx.font`** 吃的字符串，属**渲染层**（engine）；本函数给 **CSS** 用，
 * 属**展示层**。UI 去 import engine 会构成跨层依赖（层的方向：UI → constants，不反着来）。
 * 两者唯一的重叠只是"给每个名字加引号"—— 属同一 `getFontFallbackChain` 真源的**两种输出**，
 * 各在自己那层拼（判据层差异，不硬合并；见 ADR-0031）。
 *
 * 【为什么预览**必须**走链而不能裸用 `value`】
 * 本清单的中文字体 `value` 是**语义名**（「中文黑体」），不是真实字体名。
 * 裸用 → 浏览器静默回落 → 下拉里所有中文项长得一模一样（= 文件头记录的那次翻车形态）。
 *
 * @param fontFamily 字体名（清单内 value，或未知名）
 * @returns 形如 `"中文黑体", "PingFang SC", "Microsoft YaHei", sans-serif`
 */
export function previewFontFamily(fontFamily: string): string {
  // 栈首已由 `getFontFallbackChain` 保证是 fontFamily 自身（见其注释）——
  // 此处**不再自己拼一次** value，否则会重复（这正是 2026-09-19 修掉的那种"两份拼法"）。
  return getFontFallbackChain({ fontFamily })
    .map((f) => `"${f}"`)
    .join(', ');
}

/**
 * 字体的**显示名**（下拉与触发器显示用）。
 *
 * 清单内 → 用它的 `label`；未知（含旧工程数据里的字体名）→ 原样显示该名字，
 * 让用户能看出"这个元素现在挂着一个清单里没有的字体"，而不是显示空白。
 */
export function labelOfFont(fontFamily: string): string {
  return FONT_OPTIONS.find((font) => font.value === fontFamily)?.label ?? fontFamily;
}
