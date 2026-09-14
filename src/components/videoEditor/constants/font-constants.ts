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
}

export const FONT_OPTIONS: FontOption[] = [
  { value: 'Arial', label: 'Arial', fallback: ['Helvetica', 'sans-serif'] },
  { value: 'Helvetica', label: 'Helvetica', fallback: ['Arial', 'sans-serif'] },
  { value: 'Times New Roman', label: 'Times New Roman', fallback: ['Times', 'serif'] },
  { value: 'Georgia', label: 'Georgia', fallback: ['Times New Roman', 'serif'] },
] as const;

/**
 * 可选字体名的联合类型。
 * ⚠️ 用 `string & {}` 兜住"**旧工程里已存的字体名**"（如上一版清单里的 Inter）——
 * 数据里可能已经有它，类型不该因此报错；渲染侧对未知名字会走通用回落链。
 */
export type FontFamily = string;

/** 默认字体（新建文字元素用）。也用于"数据里的字体不认识时"回退。 */
export const DEFAULT_FONT_FAMILY = 'Arial';

/**
 * 取某字体的回落链 —— **唯一定义处**。
 * 未知字体（如旧数据里的幽灵字体名）返回通用无衬线链，
 * 于是"渲染一个不存在的字体"不会变成"渲染不出来"，只会变成"渲染成默认无衬线"。
 */
export function getFontFallbackChain({ fontFamily }: { fontFamily: string }): string[] {
  return (
    FONT_OPTIONS.find((font) => font.value === fontFamily)?.fallback ?? ['Arial', 'sans-serif']
  );
}
