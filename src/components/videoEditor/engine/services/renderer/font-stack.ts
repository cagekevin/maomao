import { getFontFallbackChain } from '@/components/videoEditor/constants/font-constants';

/**
 * 字体族 → **可交给 `ctx.font` 的完整回落栈**。
 *
 * ══════════════════════════════════════════════════════════════
 * 【为什么需要它】（2026-09-15 用户："字体不能选择"）
 *
 * 病灶不是"下拉坏了"，而是**字体名解析**这一步从来没有被定义过：
 * 渲染侧直接写
 *     `ctx.font = \`… 24px ${element.fontFamily}\``
 * 把用户选的字符串原样丢给浏览器。浏览器对**不认识的字体名是静默回落**的 ——
 * 不报错、不告警，于是"选了没反应"在画布上查不出任何痕迹。
 * （上一版清单里 5 个 "Google 字体"本仓一个都没加载，正是这样变成幽灵项的。）
 *
 * 【正确形态：谁拥有真相，契约就定义在谁那】
 * 字体名有两个读者 —— **UI 下拉**（列出可选项）和 **canvas 渲染**（把名字解析成字面）。
 * 两者必须对同一份清单达成一致，所以：
 *   · 清单（有哪些字体 + 各自的回落链）…… 定义在 `constants/font-constants.ts`；
 *   · 拼成 `ctx.font` 能吃的字符串 …… 定义在**这里**（渲染层的职责）。
 *
 * 【带引号规则】字体名里有空格（`Times New Roman`）时 CSS 必须加引号，
 * 否则 `px Times New Roman` 会被解析成"字号 px Times" + 三个独立族名 ——
 * 这是个安静的语法错误（结果仍是回落，看起来像"字体没生效"）。
 * 故：含空格的加双引号，不含的裸写（与 CSS 惯例一致）。
 *
 * ⚠️ 所有字体名都会**带引号**输出（统一走 quote） —— 不加引号的名字（如 Arial）
 * 在 CSS 里合法，但混在一串里容易读错，统一加引号最不容易出错。
 */
function quoteFamily({ family }: { family: string }): string {
  return `"${family}"`;
}

/**
 * 拼出 `ctx.font` 的字体族部分（不含字号/字重/斜体 —— 那些由调用方拼在前面）。
 *
 * @example
 * buildFontFamilyStack({ fontFamily: 'Arial' })
 * // => '"Arial", "Helvetica", sans-serif'
 * buildFontFamilyStack({ fontFamily: 'Times New Roman' })
 * // => '"Times New Roman", "Times", serif'
 * buildFontFamilyStack({ fontFamily: '旧数据里的幽灵字体' })
 * // => '"Arial", "sans-serif"'   ← 不认识就落到通用链，而不是"渲染不出来"
 */
export function buildFontFamilyStack({ fontFamily }: { fontFamily: string }): string {
  // 清单里认得的字体 → 它自己的回落链；不认得（旧工程数据里的字体名）→ 通用无衬线链。
  return getFontFallbackChain({ fontFamily })
    .map((family) => quoteFamily({ family }))
    .join(', ');
}
