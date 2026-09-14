/**
 * cutia 编辑器主题色（Tailwind v3 颜色表扩展）
 *
 * 【定位】本文件是**编辑器区（改造区之外的引擎区资产）**，与 `src/index.css` 的
 * `--mao-*` 令牌体系**分离**——本仓令牌唯一真相源仍是 `tailwind.config.ts` 正文
 * （`CLAUDE.md` §七.1），cutia 令牌独立于此，由 `tailwind.config.ts` spread 引入。
 *
 * 【为什么这样写】cutia 用 Tailwind v4 的 shadcn 颜色名（`primary`/`muted`/`accent`/
 * `border`/`foreground`…），与本仓语义 token **同名但含义不同**
 * （本仓 `text-primary` = 灰色正文；cutia `text-primary` = 蓝色主色调）。
 *
 * 【隔离手法】值写成 `var(--ve-x, <本仓默认>)`：
 *   · 编辑器容器 `.ve-scope` 内定义了 `--ve-x` → 取 cutia 值；
 *   · 容器外（画布/节点/面板）→ 回落本仓默认值，**观感零变化**。
 * 因此 cutia 组件**无需改类名**（零 JSX 改动），本仓也不受影响。
 *
 * 【变量来源】`ve-theme.css` 的 `.ve-scope` / `.ve-scope.dark`。
 *
 * ⚠️ 注意：`primary` / `muted` / `body` / `secondary` / `accent` 等**本仓已占用**的名字
 * **不在此重定义**（由 `ve-theme.css` 在 `.ve-scope` 内覆盖其 `--mao-*` 上游变量
 * —— 见该文件 §6「上游变量覆盖」）。此处只补 cutia 独有、本仓没有的名字。
 */
export const videoEditorThemeColors: Record<string, string> = {
  // ── 本仓原本没有、cutia 需要的新名字（直接可用 var 回落）──
  background: 'var(--ve-background, rgb(var(--mao-canvas)))',
  foreground: 'var(--ve-foreground, rgb(var(--mao-text-primary)))',
  border: 'var(--ve-border, rgb(var(--mao-edge)))',
  input: 'var(--ve-input, rgb(var(--mao-input)))',
  ring: 'var(--ve-ring, rgb(var(--mao-accent)))',
  'primary-foreground': 'var(--ve-primary-foreground, #ffffff)',
  'secondary-foreground': 'var(--ve-secondary-foreground, #38bdf8)',
  'secondary-border': 'var(--ve-secondary-border, rgb(var(--mao-edge)))',
  'accent-foreground': 'var(--ve-accent-foreground, rgb(var(--mao-text-primary)))',
  'muted-foreground': 'var(--ve-muted-foreground, rgb(var(--mao-text-muted)))',
  destructive: 'var(--ve-destructive, rgb(var(--mao-danger)))',
  'destructive-foreground': 'var(--ve-destructive-foreground, #ffffff)',
  constructive: 'var(--ve-constructive, #22c55e)',
  'constructive-foreground': 'var(--ve-constructive-foreground, #ffffff)',
  card: 'var(--ve-card, rgb(var(--mao-surface-1)))',
  'card-foreground': 'var(--ve-card-foreground, rgb(var(--mao-text-primary)))',
  popover: 'var(--ve-popover, rgb(var(--mao-surface-raised)))',
  'popover-hover': 'var(--ve-popover-hover, rgb(var(--mao-surface-hover)))',
  'popover-foreground': 'var(--ve-popover-foreground, rgb(var(--mao-text-strong)))',
  'sidebar-background': 'var(--ve-sidebar-background, rgb(var(--mao-surface)))',
  'sidebar-foreground': 'var(--ve-sidebar-foreground, rgb(var(--mao-text-primary)))',
  'sidebar-primary': 'var(--ve-sidebar-primary, rgb(var(--mao-accent)))',
  'sidebar-primary-foreground': 'var(--ve-sidebar-primary-foreground, #ffffff)',
  'sidebar-accent': 'var(--ve-sidebar-accent, rgb(var(--mao-surface-hover)))',
  'sidebar-accent-foreground': 'var(--ve-sidebar-accent-foreground, rgb(var(--mao-text-primary)))',
  'sidebar-border': 'var(--ve-sidebar-border, rgb(var(--mao-edge)))',
  'sidebar-ring': 'var(--ve-sidebar-ring, rgb(var(--mao-accent)))',
  'chart-1': 'var(--ve-chart-1, #3b82f6)',
  'chart-2': 'var(--ve-chart-2, #22c55e)',
  'chart-3': 'var(--ve-chart-3, #f59e0b)',
  'chart-4': 'var(--ve-chart-4, #a855f7)',
  'chart-5': 'var(--ve-chart-5, #ef4444)',
};
