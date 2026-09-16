# Mockup 样式指南（基于真实产品 CSS）

> 旧 `mockup/_lagency/mockup-kit.css` 与真实产品不符，**已弃用**，请勿再引用。
> 本指南 + 同目录两个文件（`maomao-kit.css`、`tailwind.mockup.config.js`）是从
> `src/` 真实样式**逐字提取**的 mockup 基础，写新 mockup 直接复用即可。

## 1. 三个文件

| 文件 | 作用 | 来源（真实） |
|---|---|---|
| `maomao-kit.css` | 自包含样式基础：设计令牌 + 基础层 + 节点/面板级可复用组件类 + **@import 并入全部业务模块 CSS**（director3d / agent-panel / ve-theme / assistant-table / creative-library / cameraParams），一个文件即含全站真实样式，且与源码零漂移 | `src/index.css`、`panel-kit.css` + 5 个业务组件 CSS |
| `tailwind.mockup.config.js` | Tailwind Play CDN 镜像配置（颜色/字号/z-index/阴影） | `src/tailwind.config.ts`、`src/components/videoEditor/ve-tailwind-colors.ts` |
| `MOCKUP-STYLE-GUIDE.md` | 本文件：索引 + 用法 | — |

## 2. 新 mockup 模板

```html
<!doctype html>
<html lang="zh" class="dark">
<head>
  <meta charset="utf-8" />
  <link rel="stylesheet" href="maomao-kit.css" />
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="tailwind.mockup.config.js"></script>
  <style>
    /* 仅写本 mockup 特有的局部样式；通用件用 kit 的类 */
  </style>
</head>
<body class="bg-app text-primary">
  <!-- 例：主操作按钮 -->
  <button class="node-btn-primary">生成 <span class="node-btn-primary-icon">●</span></button>
  <!-- 例：面板顶栏 + 分段 tab -->
  <div class="pk-head"><span class="pk-head-spacer"></span>
    <div class="pk-seg">
      <button class="pk-seg-item" aria-selected="true"><svg></svg><span class="pk-seg-label">任务</span></button>
    </div>
  </div>
</body>
</html>
```

离线无法加载 CDN 时，仍可只用 `maomao-kit.css` 的组件类（`.node-btn-*`、`.pk-*`、`.prompt-chip` 等），
布局用内联 style 或 `<style>` 手写；但**不要**引入裸色值，一律用 `rgb(var(--mao-*))`。

## 3. 颜色令牌（真实值，改色只改 `maomao-kit.css` 顶部 `:root`）

### 背景层级（极淡暖，R 比 B 多 1）
| token | hex | 用途 |
|---|---|---|
| `--mao-canvas` | #0d0d0c | 画布底 |
| `--mao-surface` | #1b1b1a | 基础面 |
| `--mao-surface-1` | #232322 | 浮层/弹窗底 |
| `--mao-surface-2` | #20201f | 次级面 |
| `--mao-surface-3` | #454543 | 深灰 |
| `--mao-surface-raised` | #1d1d1c | 抬起控件 |
| `--mao-surface-menu` | #1d1d1c | 菜单底 |
| `--mao-surface-deep` | #161615 | 深底 |
| `--mao-surface-hover` | #2b2b29 | hover 面 |
| `--mao-surface-hover-strong` | #343432 | 选中/激活面 |
| `--mao-surface-hover-2` | #2d2d2b | 副条 hover |
| `--mao-surface-active` | #262625 | 按下态 |
| `--mao-surface-subtle` | #252524 | 弱面 |
| `--mao-surface-faint` | #1f1f1e | 更弱面 |
| `--mao-surface-strong` | #171716 | 强面 |
| `--mao-surface-muted` | #161615 | 静默面 |
| `--mao-surface-black` | #121211 | 近黑 |
| `--mao-surface-panel` | #1a1a19 | 侧栏/任务中心底 |
| `--mao-surface-panel-2` | #1c1c1b | 节点容器底 |
| `--mao-surface-well` | #212120 | 内嵌槽底 |
| `--mao-surface-raised-2` | #2a2a28 | 控件/按钮底 |
| `--mao-surface-active-2` | #31312f | hover/进度底 |
| `--mao-surface-hover-2b` | #333331 | 按钮 hover 底 |
| `--mao-input` | #151514 | 输入框底 |
| `--mao-surface-sunken` | #0b0b0a | 代码块/深嵌入底 |
| `--mao-surface-sunken-2` | #0e0e0d | 编辑器深底 |
| `--mao-code-bg` | #141413 | 提示词/代码块底 |
| `--mao-inverse` | #eeeeec | 反色高亮底 |
| `--mao-surface-shell` | #1b1b1a | 顶栏/外壳底 |

### 文字层级（纯中性灰，去暖）
| token | hex |
|---|---|
| `--mao-text-strong` | #ffffff |
| `--mao-text-primary` | #e6e6e6 |
| `--mao-text-body` | #cecece |
| `--mao-text-secondary` | #aaaaaa |
| `--mao-text-muted` | #767676 |
| `--mao-text-faint` | #676767 |
| `--mao-text-subtle` | #565656 |
| `--mao-text-muted-2` | #747474（占位符/空态） |

### 边框层级（暖灰·克制）
| token | hex |
|---|---|
| `--mao-edge` | #343433 |
| `--mao-edge-strong` | #565553 |
| `--mao-edge-faint` | #2b2b29 |
| `--mao-edge-muted` | #454543 |
| `--mao-edge-subtle` | #232322 |
| `--mao-edge-raised` | #3b3b39 |

### 语义强调色
| token | hex | 用途 |
|---|---|---|
| `--mao-accent` | #3b82f6 | 蓝·主强调 |
| `--mao-accent-strong` | #60a5fa | 蓝·浅 |
| `--mao-live` | #34d399 | 绿·进行/成功 |
| `--mao-danger` | #ef4444 | 红·危险/失败 |

### html/body 专属
`--mao-app-bg` #0f0f0e ｜ `--mao-app-text` #e6e6e6

## 4. Tailwind 颜色别名（CDN 配置中可用，等价 `rgb(var(--mao-*))`）

背景：`bg-canvas` `bg-surface` `bg-surface-1..3` `bg-surface-raised/menu/deep/hover/hover-strong/hover-2/active/subtle/faint/strong/muted/black/panel/panel-2/well/raised-2/active-2/hover-2b` `bg-input` `bg-inverse` `bg-surface-sunken` `bg-surface-sunken-2` `bg-code-bg`
文字：`text-strong` `text-primary` `text-body` `text-secondary` `text-muted` `text-faint` `text-subtle` `text-muted-2`
边框：`border-edge` `border-edge-strong` `border-edge-faint` `border-edge-muted` `border-edge-subtle` `border-edge-raised`
强调：`bg-accent` `text-accent` `text-accent-strong` `bg-danger` `text-danger` `bg-live` `text-live`
> 透明度修饰符生效：`bg-surface/60`、`border-edge/40` 等。

## 5. 字号（`text-*`）
`2xs` 8px · `meta` 9px · `caption` 10px · `caption-sm` 11px · `body-xs` 12px · `body-sm` 13px · `base-sm` 15px

## 6. z-index（`z-*`）
`base`0 · `canvas-tools`5 · `node-inner`10 · `node-inner-2`20 · `dropdown`50 · `float`100 · `topnav`200 · `sidebar`800 · `popover`1000 · `modal`9999 · `modal-raise`10000 · `modal-action`10001 · `overlay-error`99999 · `ceiling`2147483647

## 7. box-shadow（`shadow-*`）
`popover` `glow-blue` `glow-success` `glow-error` `glow-warning` `glow-info`

## 8. 本 kit 提供的组件类（直接加 class）

- **节点按钮**：`.node-btn-primary`（灰底胶囊+白圆，主操作）、`.node-btn-primary-icon`（内白圆）、`.node-btn-settings`（设置/模式按钮，`.is-active` 蓝态）、`.settings-page-title`（分区标题 14px 中性）
- **面板通用件（panel-kit）**：`.pk-head` `.pk-head-spacer` `.pk-seg` `.pk-seg-item[aria-selected]` `.pk-seg-label` `.pk-badge(.is-ok)` `.pk-sub` `.pk-stat` `.pk-pills` `.pk-pill[aria-pressed]` `.pk-icon-btn(.is-sm/.is-xs/.is-on/.is-ok)` `.pk-pop(.is-more)` `.pk-pop-row(.is-danger)` `.pk-pop-div` `.pk-list-foot`
- **富文本/引用**：`.prompt-chip`（@素材芯片）、`.prompt-chip-icon(.has-thumbnail)` `.prompt-chip-thumb` `.prompt-chip-label`、`.at`（青色 @引用高亮）
- **控件**：`.mao-color-input`（统一取色器，只此一个类）、`.camera-studio-viewport/-range/-toggle(.is-on)`、`.cp-bk`/`.cp-subj-body`/`.cp-ghost`（摄影参数 SVG 缩放图元，变量驱动）
- **画布**：`.cust-handle-wrap/.dot/.ring/.plus`（连接端口）、`.cust-edge-base/-glow/-hit/-comet`（连线）、`.react-flow` 暗色覆盖、`.drag-handle` `.nodrag`
- **动画**：`.animate-slide-up` `.animate-panel-in` `.animate-fade-in`

## 9. 各业务组件 CSS 索引（写对应 mockup 时，从真实源码 copy 具体类）

| 模块 | 真实文件 | 关键 class（节选） |
|---|---|---|
| 全局/令牌/节点按钮 | `src/index.css` | `:root --mao-*`、`node-btn-*`、`cust-*`、`prompt-chip`、动画 |
| 面板通用件 | `src/components/base/panels/panel-kit.css` | `pk-*`（全套） |
| AI 助手面板 | `src/components/panels/agent-panel.css` | `agent-panel` `agent-header` `agent-icon-btn` `agent-pop` `agent-msg-wrap` `agent-user-bubble` `agent-ai-text` `agent-trace` `agent-composer` `agent-textarea` `agent-send` |
| 表格助手 | `src/components/agent/assistantTable/assistant-table.css` | `atw` `atw-head` `atw-grid` `atw-icobtn` `atw-cell` `atw-empty` |
| 视频编辑器 | `src/components/videoEditor/ve-theme.css`（`.ve-scope.dark` 驱动） | 编辑器主题色，需 `<link>` 本文件 + `ve-tailwind-colors` 色名 |
| 导演 3D | `src/components/director3d/styles.css` | `app-shell` `topbar` `panel` `left-sidebar` `viewport-shell` `timeline` `asset-card` `scene-row` `shot-card` `inspector` |
| 创作库 | `src/components/base/creative/creative-library.css` | `cl-card` `cl-tabs` `cl-grid` `cl-card-item` `cl-btn` `cl-icon-btn` `cl-search` `cl-menu` `cl-toast` `cl-nav` `cl-mj-detail` |
| 相机参数 | `src/components/base/editors/cameraParams/cameraParams.css` | `.cp-bk` `.cp-subj-body` `.cp-ghost`（已并入 kit） |

> **以上 5 个业务模块 CSS 已全部通过 `maomao-kit.css` 的 `@import` 并入**，写对应模块 mockup 时本 kit 已含其全部类，无需再 copy。
> 视频编辑器模块需把内容包在 `<div class="ve-scope dark">` 容器内（ve-theme.css 以 `.ve-scope` 作用域隔离）。

### 第三方库样式（非本仓产品样式，按需单独引入）
| 库 | 文件 | 用途 |
|---|---|---|
| react-image-crop（图片裁剪） | 仓库根 `.regression-entry.css`（= `node_modules/react-image-crop/dist/ReactCrop.css` 的副本） | 仅图片编辑器「裁剪」交互的 mockup 需要；`<link>` 该文件即可，不属于本仓设计系统 |

## 10. 同类控件配色纪律（必读，来自 `src/index.css` 注释）

- 编辑型大输入框/textarea：`bg-surface-strong` + `border border-edge` + `text-primary`
- 紧凑数字框（w-8~w-20）：`bg-surface-hover` + `border border-edge`
- 文字小按钮（h-6）：`bg-transparent hover:bg-surface-hover` + `border border-transparent hover:border-edge`（初始无底无框，hover 才出现）
- 只读徽标/序号：`bg-surface-hover` + `text-body`
- 行内小图标按钮（p-1/p-1.5）：`text-secondary` + `hover:bg-surface-hover`
- 面板/弹窗/全屏容器底：`bg-input`（非输入框，勿当输入框改）
- 输入框占位符：统一中性灰 `rgb(var(--mao-text-muted-2))`，勿用浏览器默认（偏蓝）
- 输入框文字用 `text-primary`，**禁止** `text-blue/accent`
- 语义：中性高亮=当前选中/当前 tab；蓝=某开关已启用；绿=确认/保护闸已开
