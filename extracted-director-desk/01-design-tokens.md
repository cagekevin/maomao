# 3D 导演台 · 设计 Token 体系（提取）

> 来源：Nomi 项目 `tailwind.config.ts`（workbenchBasePlugin 的 addBase CSS 变量 + Tailwind theme 映射）
> 用途：导演台外观的地基。重构重设计时，先落地这一套 token，再谈组件。

---

## 1. 核心概念

- **双层 token**：`--nomi-*` 是全局基础 token（Portal 到 body 也能用）；`--workbench-*` 是工作台作用域 token（`addBase` 里直接定义，继承自 `--nomi-*`）。
- **色值用 `oklch()`**，通过 `color-mix(in srgb, ...)` 注入 alpha 修饰符（`/85`、`/[0.78]`）。裸 `var()` 色无法被 Tailwind JIT 加透明度，会被静默丢弃（关键坑）。
- **主题切换**：`[data-mantine-color-scheme="dark"]` 选择器。明暗两套 token，翻 `:root` 组即翻全局。3D 轴色（`--nomi-axis-*`）刻意明暗同色。

---

## 2. 颜色 Token（浅色 `:root`）

### 中性灰阶（暖灰，色相 ~80）
| Token | oklch | 用途 |
|---|---|---|
| `--nomi-bg` | `oklch(0.985 0.003 90)` | 全局背景 |
| `--nomi-paper` | `oklch(1 0 0)` | 面板/浮层表面 |
| `--nomi-ink` | `oklch(0.22 0.01 80)` | 主文字（最重） |
| `--nomi-ink-80` | `oklch(0.32 0.01 80)` | 次级文字 |
| `--nomi-ink-60` | `oklch(0.50 0.01 80)` | 次级/图标 |
| `--nomi-ink-40` | `oklch(0.68 0.01 80)` | 占位/弱文字 |
| `--nomi-ink-30` | `oklch(0.78 0.01 80)` | 更弱 |
| `--nomi-ink-20` | `oklch(0.88 0.005 80)` | 禁用/分隔 |
| `--nomi-ink-10` | `oklch(0.94 0.003 80)` | hover 底色 |
| `--nomi-ink-05` | `oklch(0.97 0.003 80)` | 最浅 hover/底色 |
| `--nomi-line` | `oklch(0.91 0.004 80)` | 分割线 |
| `--nomi-line-soft` | `oklch(0.95 0.003 80)` | 更浅分割线 |

### 强调色
| Token | oklch | 用途 |
|---|---|---|
| `--nomi-accent` | `oklch(0.55 0.13 250)` | 品牌强调（蓝，h=250） |
| `--nomi-accent-soft` | `color-mix(in srgb, accent 12%, paper)` | 选中态/软高亮 |
| `--nomi-danger` | `oklch(0.55 0.20 27)` | 错误红 |
| `--nomi-warning` | `oklch(0.62 0.14 75)` | 警告 |
| `--nomi-focus` | `color-mix(in srgb, accent 42%, transparent)` | 全局焦点环 |
| `--nomi-snap` | `oklch(0.72 0.18 30)` | 吸附 |
| `--nomi-snap-tag` | `oklch(0.45 0.18 30)` | 吸附标签 |

### 3D 轴色（明暗同色）
| Token | 值 | 轴 |
|---|---|---|
| `--nomi-axis-x` | `#ef4444` | 红 X |
| `--nomi-axis-y` | `#16a34a` | 绿 Y |
| `--nomi-axis-z` | `#3b82f6` | 蓝 Z |

### 媒体浮层
| Token | 值 |
|---|---|
| `--nomi-scrim` | `oklch(0.2 0.01 80 / 0.42)` |
| `--nomi-overlay-chip` | `oklch(0.2 0.01 80 / 0.55)` |
| `--nomi-overlay-chip-strong` | `oklch(0.2 0.01 80 / 0.7)` |
| `--nomi-media-veil` | `oklch(0.15 0.01 80 / 0.62)` |

---

## 3. 深色主题（`:root[data-mantine-color-scheme="dark"]`）

暖灰反转，同色相（h~80/85）、低明度。40 及以下的 `--nomi-ink-*` 相对浅色整体抬一档（暗底对比不足）。

| Token | oklch |
|---|---|
| `--nomi-bg` | `oklch(0.18 0.006 80)` |
| `--nomi-paper` | `oklch(0.235 0.007 80)` |
| `--nomi-ink` | `oklch(0.93 0.006 85)` |
| `--nomi-ink-60` | `oklch(0.70 0.006 85)` |
| `--nomi-ink-40` | `oklch(0.62 0.006 85)` |
| `--nomi-ink-05` | `oklch(0.30 0.006 85)` |
| `--nomi-line` | `oklch(0.36 0.007 80)` |
| `--nomi-accent` | `oklch(0.70 0.13 250)`（提亮） |
| `--nomi-accent-soft` | `color-mix(in srgb, accent 26%, paper)`（比浅色更高） |
| `--nomi-focus` | `color-mix(in srgb, accent 50%, transparent)` |

阴影（暗色加重）：
| Token | 值 |
|---|---|
| `--nomi-shadow-sm` | `0 1px 2px oklch(0 0 0 / 0.32), 0 1px 1px oklch(0 0 0 / 0.22)` |
| `--nomi-shadow-md` | `0 2px 5px oklch(0 0 0 / 0.30), 0 14px 34px oklch(0 0 0 / 0.32)` |
| `--nomi-shadow-lg` | `0 4px 10px oklch(0 0 0 / 0.30), 0 24px 64px oklch(0 0 0 / 0.40)` |

---

## 4. 工作台作用域 Token（`.workbench-shell`）

导演台外壳根部挂 `workbench-shell` 类，以下 token 只在壳内生效（Portal 到 body 的浮层够不到，需用 `--nomi-*`）。

| Token | 值 | 用途 |
|---|---|---|
| `--workbench-topbar-height` | `56px` | 顶栏高 |
| `--workbench-bg` | `var(--nomi-bg)` | 壳背景 |
| `--workbench-surface` | `var(--nomi-paper)` | 面板表面 |
| `--workbench-surface-solid` | `var(--nomi-paper)` | 不透明表面（顶栏/左右栏） |
| `--workbench-surface-soft` | `var(--nomi-ink-05)` | 软表面 |
| `--workbench-border` | `var(--nomi-line)` | 分割线 |
| `--workbench-border-soft` | `var(--nomi-line-soft)` | 软分割线 |
| `--workbench-border-strong` | `var(--nomi-ink-30)` | 强分割线 |
| `--workbench-muted` | `var(--nomi-ink-60)` | 弱文字 |
| `--workbench-muted-soft` | `var(--nomi-ink-40)` | 更弱文字 |
| `--workbench-ink` | `var(--nomi-ink)` | 主文字 |
| `--workbench-accent` | `var(--nomi-accent)` | 强调 |
| `--workbench-accent-soft` | `var(--nomi-accent-soft)` | 软强调 |
| `--workbench-success` | `#34c759` | 成功 |
| `--workbench-success-soft` | `rgba(52,199,89,0.12)` | 软成功 |
| `--workbench-danger` | `#ff3b30` | 危险（REC 键） |
| `--workbench-danger-soft` | `rgba(255,59,48,0.1)` | 软危险 |
| `--workbench-hover` | `rgba(60,60,67,0.06)` | hover |
| `--workbench-pressed` | `rgba(60,60,67,0.09)` | pressed |
| `--workbench-overlay` | `rgba(255,255,255,0.82)` | 浮层 |
| `--workbench-overlay-strong` | `rgba(255,255,255,0.94)` | 强浮层 |
| `--workbench-backdrop` | `rgba(29,29,31,0.16)` | 背板 |
| `--workbench-radius` | `var(--nomi-radius)` | 圆角 |
| `--workbench-shadow-sm/md/pop` | `var(--nomi-shadow-sm/md/lg)` | 阴影 |
| `--workbench-control-size` | `32px` | 控件高 |
| `--workbench-control-size-sm` | `26px` | 小控件 |
| `--workbench-control-radius` | `7px` | 控件圆角 |
| `--workbench-icon-size` | `16px` | 图标 |
| `--workbench-icon-stroke` | `2` | 图标描边 |

---

## 5. 圆角 / 字号 / 字体 / 阴影 / 间距 / 动画

### 圆角
| Token | 值 |
|---|---|
| `--nomi-radius-sm` | `6px` |
| `--nomi-radius` | `10px` |
| `--nomi-radius-lg` | `16px` |
| `--tc-radius-sharp` | `0px` |
| `--tc-radius-field` | `6px` |
| `--tc-radius-panel` | `10px` |
| `--tc-radius-modal` | `14px` |
| `--tc-radius-pill` | `999px` |

Tailwind 映射：`rounded-nomi-sm` / `rounded-nomi` / `rounded-nomi-lg` / `rounded-pill` / `rounded-workbench-control`（=7px）等。

### 字号（仅 font-size，无 line-height）
| Token | px | Tailwind |
|---|---|---|
| micro | `11px` | `text-micro` |
| body-sm | `13px` | `text-body-sm` |
| body | `14px` | `text-body` |
| caption | `12px` | `text-caption` |
| title | `16px` | `text-title` |
| h2 | `20px` | `text-h2` |
| h1 | `24px` | `text-h1` |
| display | `28px` | `text-display` |

### 字体
| Token | 值 |
|---|---|
| `--nomi-font-sans` | `Inter, -apple-system, BlinkMacSystemFont, "PingFang SC", "Hiragino Sans GB", system-ui, sans-serif` |
| `--nomi-font-display` | `Fraunces, Inter, serif` |
| `--nomi-font-mono` | `ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace` |

### 阴影（浅色）
| Token | 值 |
|---|---|
| `--nomi-shadow-sm` | `0 1px 2px oklch(0 0 0 / 0.04), 0 1px 1px oklch(0 0 0 / 0.03)` |
| `--nomi-shadow-md` | `0 2px 4px oklch(0 0 0 / 0.04), 0 8px 24px oklch(0 0 0 / 0.06)` |
| `--nomi-shadow-lg` | `0 4px 8px oklch(0 0 0 / 0.05), 0 20px 50px oklch(0 0 0 / 0.08)` |

### 间距（`--tc-space-*`）
`--tc-space-1:4px` · `2:8px` · `3:12px` · `4:16px` · `5:20px` · `6:24px`

### 过渡
| Token | 值 |
|---|---|
| `--nomi-transition-fast` | `140ms cubic-bezier(.2, .7, .3, 1)` |

### 关键帧动画
- `generation-focus-pulse`：drop-shadow 呼吸 + `scale(1 → 1.018 → 1)`，`1.35s ease-out`。类名 `animate-generation-focus-pulse`。

---

## 6. 全局基础样式（addBase 关键项）

```css
/* 滚动条（全局） */
* { scrollbar-width: thin; scrollbar-color: color-mix(in srgb, var(--nomi-ink) 24%, transparent) transparent; }
*::-webkit-scrollbar { width: 6px; height: 6px; }
*::-webkit-scrollbar-thumb { background: color-mix(in srgb, var(--nomi-ink) 24%, transparent); border-radius: 999px; }
*::-webkit-scrollbar-thumb:hover { background: color-mix(in srgb, var(--nomi-ink) 38%, transparent); }

/* 焦点环统一用 accent（杀掉 macOS 系统橙色 outline:auto） */
:focus-visible { outline: none; }
button:focus-visible, a:focus-visible, input:focus-visible, ... {
  outline: 2px solid var(--nomi-focus); outline-offset: 2px;
}

/* body 背景渐变 + 网格线（#root::before 60px 网格） */
body {
  background-image: radial-gradient(...) ...; color: var(--mantine-color-text, var(--tc-color-text-primary));
}
```

**导演台视口常见层叠类（直接照抄）**：
```css
.workbench-shell {
  position: fixed; inset: 0; width: 100vw; height: 100dvh; z-index: <FULLSCREEN_Z_INDEX>;
  background: var(--workbench-bg); color: var(--workbench-ink);
  font-family: var(--nomi-font-sans); overflow: hidden; pointer-events: auto;
}
```

---

## 7. `cn()` 工具（必须，否则自定义 token 类会被 tailwind-merge 误吞）

`src/utils/cn.ts` 用 `extendTailwindMerge` 注册自定义组：
- `font-size`：`text-micro/caption/body/body-sm/title/h2/h1/display`
- `rounded`：`rounded-sharp/field/panel/modal/pill/nomi/nomi-sm/nomi-lg/workbench/workbench-control`
- `outline-color`：`outline-nomi-accent/nomi-line/nomi-ink/workbench-danger`

> 不注册的话 `cn('text-micro ... text-nomi-ink-60')` 会因字号/颜色同组冲突丢其一（字号回退 16px）、圆角/描边失效。**重构必须保留这个 `cn()`。**
