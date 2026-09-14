/**
 * cutia 编辑器主题色（Tailwind v3 颜色表扩展）—— v3 扁平映射版
 *
 * 【架构】tailwind 颜色名 → `rgb(var(--ve-*) / <alpha-value>)` → ve-theme.css 定义终值。
 *   · 无桥接中转：每个名字在此**显式**映射，缺一个就是 bug（bg-secondary 白底白字事故的教训）；
 *   · token 是 RGB 三元组 → `<alpha-value>` 有效，`bg-primary/15` 这类透明度修饰可用；
 *   · 回落值 = 宿主原定义（`.ve-scope` 外渲染零变化，隔离不破坏）。
 * 【对照表】token 定义见 ve-theme.css §1（亮）/ §2（暗）/ 面板层覆盖。
 */
export const videoEditorThemeColors: Record<string, string> = {
  /* ── 面 ── */
  background: 'rgb(var(--ve-bg, var(--mao-canvas)) / <alpha-value>)',
  foreground: 'rgb(var(--ve-fg, var(--mao-text-primary)) / <alpha-value>)',
  card: 'rgb(var(--ve-bg, var(--mao-surface-1)) / <alpha-value>)',
  'card-foreground': 'rgb(var(--ve-fg, var(--mao-text-primary)) / <alpha-value>)',
  popover: 'rgb(var(--ve-popover, var(--mao-surface-raised)) / <alpha-value>)',
  'popover-hover': 'rgb(var(--ve-popover-hover, var(--mao-surface-hover)) / <alpha-value>)',
  'popover-foreground': 'rgb(var(--ve-popover-fg, var(--mao-text-strong)) / <alpha-value>)',

  /* ── 主操作（编辑器内 = 苹果白/近黑；宿主回落 = 文字灰）── */
  primary: 'rgb(var(--ve-primary, var(--mao-text-primary)) / <alpha-value>)',
  'primary-foreground': 'rgb(var(--ve-on-primary, 255 255 255) / <alpha-value>)',

  /* ── 次级/悬停面：v4 无独立背景 token，= 前景薄纱（静态色，不支持 /alpha 修饰）── */
  secondary: 'rgb(var(--ve-fg) / 0.1)',
  'secondary-foreground': 'rgb(var(--ve-fg))',
  'secondary-border': 'rgb(var(--ve-border, var(--mao-edge)) / <alpha-value>)',

  /* ── 静默/悬停 ── */
  muted: 'rgb(var(--ve-fg) / 0.08)',
  'muted-foreground': 'rgb(var(--ve-fg) / 0.55)',
  accent: 'rgb(var(--ve-fg) / 0.06)',
  'accent-foreground': 'rgb(var(--ve-fg))',

  /* ── 状态 ── */
  destructive: 'rgb(var(--ve-danger, var(--mao-danger)) / <alpha-value>)',
  'destructive-foreground': 'rgb(var(--ve-on-danger, 255 255 255) / <alpha-value>)',
  constructive: 'rgb(var(--ve-ok, 34 197 94) / <alpha-value>)',
  'constructive-foreground': 'rgb(var(--ve-on-ok, 255 255 255) / <alpha-value>)',

  /* ── 线/输入/环 ── */
  border: 'rgb(var(--ve-border, var(--mao-edge)) / <alpha-value>)',
  input: 'rgb(var(--ve-input, var(--mao-input)) / <alpha-value>)',
  ring: 'rgb(var(--ve-ring, var(--mao-accent)) / <alpha-value>)',

  /* ── 侧栏族（编辑器内等同主面）── */
  'sidebar-background': 'rgb(var(--ve-bg, var(--mao-surface)) / <alpha-value>)',
  'sidebar-foreground': 'rgb(var(--ve-fg, var(--mao-text-primary)) / <alpha-value>)',
  'sidebar-primary': 'rgb(var(--ve-primary, var(--mao-accent)) / <alpha-value>)',
  'sidebar-primary-foreground': 'rgb(var(--ve-on-primary, 255 255 255) / <alpha-value>)',
  'sidebar-accent': 'rgb(var(--ve-accent, var(--mao-surface-hover)) / <alpha-value>)',
  'sidebar-accent-foreground': 'rgb(var(--ve-fg, var(--mao-text-primary)) / <alpha-value>)',
  'sidebar-border': 'rgb(var(--ve-border, var(--mao-edge)) / <alpha-value>)',
  'sidebar-ring': 'rgb(var(--ve-ring, var(--mao-accent)) / <alpha-value>)',

  /* ── 图表/数据色 ── */
  'chart-1': 'rgb(var(--ve-chart-1, 59 130 246) / <alpha-value>)',
  'chart-2': 'rgb(var(--ve-chart-2, 34 197 94) / <alpha-value>)',
  'chart-3': 'rgb(var(--ve-chart-3, 245 158 11) / <alpha-value>)',
  'chart-4': 'rgb(var(--ve-chart-4, 168 85 247) / <alpha-value>)',
  'chart-5': 'rgb(var(--ve-chart-5, 239 68 68) / <alpha-value>)',
};
