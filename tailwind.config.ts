import type { Config } from 'tailwindcss';
// cutia 编辑器主题色（独立文件，避免污染本仓令牌表；见 docs/130-cutia搬迁计划书）。
import { videoEditorThemeColors } from './src/components/videoEditor/ve-tailwind-colors';

/**
 * 样式令牌唯一真相源（CLAUDE.md §七.1 指定；禁裸色值，勿再引用已删的 tailwind-tokens.md）。
 *
 * 更新(2026-09-02)：随全仓 TS 化 .js→.ts，JSDoc 的 `@type` 换成真 `Config` 类型标注
 * （等价于原约束，但可被 `npm run type-check` 真正校验：写错 theme 结构/插件名会被拦住）。
 * src 已全 TS 化，content glob 里的 .js/.jsx 保留作兜底（万一有人新建，样式仍能被提取）。
 */
const config: Config = {
  // 更新(2026-09-14)：新增 `class` 模式 —— cutia 编辑器主题用 `.ve-scope.dark` 驱动。
  // 实测全库 `dark:` 前缀仅 18 处且**全在 videoEditor 内**（本仓自身不用该前缀），
  // 故本项对本仓现有观感零影响。见 docs/130-cutia搬迁计划书。
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      /**
       * 统一 z-index 语义令牌（避免散落魔法数字导致层级冲突）。
       *
       * 排序（从低到高）：
       *   base 0 < canvas-tools 5 < node-inner 10/20 < dropdown 50 < float 100 < topnav 200
       *   < sidebar 800 < popover 1000 < modal 9999
       *   < modal-raise 10000 < modal-action 10001 < overlay-error 99999
       *   < ceiling 2147483647（Toast / 错误全屏 —— 最后手段，不给"全屏视图"用）
       *
       * 关键约定：
       *   - 侧边栏(sidebar 800) 必须盖过左下角小地图与工具栏(canvas-tools 5)，
       *     这样侧边栏展开时能盖住画布左下角的那一排工具/小地图。
       *   - canvas-tools 只需比普通画布内容高一点点即可（工具栏/小地图是画布 HUD，
       *     被节点盖住无妨），真正要压过它的仍是 sidebar(800)。
       *   - 全屏弹窗一律用 modal(9999) 及以上，禁止低于 modal 的浮层压过弹窗。
       *   - 新增浮层时优先复用现有令牌，不要直接写数字。
       */
      zIndex: {
        base: '0',
        'node-inner': '10',
        'node-inner-2': '20',
        dropdown: '50',
        float: '100',
        topnav: '200',
        'canvas-tools': '5',
        sidebar: '800',
        popover: '1000',
        modal: '9999',
        'modal-raise': '10000',
        'modal-action': '10001',
        'overlay-error': '99999',
        'ceiling-1': '2147483645',
        'ceiling-2': '2147483646',
        ceiling: '2147483647',
      },
      /**
       * 统一颜色语义令牌（值 = 原硬编码 hex，仅命名语义化，视觉零变化）。
       *
       * 背景层级（由浅到深）：
       *   surface(1a1a1a) < surface-1(222) < surface-2(1f1f1f) < surface-3(444)
       *   面板/浮层：surface-raised(1c1c1c) / surface-menu(1c1c1e) / surface-deep(151414)
       *   交互态：surface-hover(2a2a2a) / surface-active(252525) / surface-subtle(242424)
       *   canvas(0d0c0c) 画布底；input(141414) 输入框；inverse(ededed) 反色高亮底
       *
       * 文本层级（由强到弱）：strong(fff) < primary(ddd) < body(ccc) < secondary(aaa)
       *   < muted(888) < faint(666) < subtle(555)
       *
       * 边框层级：surface(333) < strong(555) < faint(2a2a2a) < muted(444)
       *   < subtle(222) < raised(3a3a3a)
       */
      colors: {
        // 背景层级（值经 :root --mao-* 驱动，支持 /<alpha> 透明度修饰符）
        canvas: 'rgb(var(--mao-canvas) / <alpha-value>)',
        surface: 'rgb(var(--mao-surface) / <alpha-value>)',
        'surface-1': 'rgb(var(--mao-surface-1) / <alpha-value>)',
        'surface-2': 'rgb(var(--mao-surface-2) / <alpha-value>)',
        'surface-3': 'rgb(var(--mao-surface-3) / <alpha-value>)',
        'surface-raised': 'rgb(var(--mao-surface-raised) / <alpha-value>)',
        'surface-menu': 'rgb(var(--mao-surface-menu) / <alpha-value>)',
        'surface-deep': 'rgb(var(--mao-surface-deep) / <alpha-value>)',
        'surface-hover': 'rgb(var(--mao-surface-hover) / <alpha-value>)',
        'surface-hover-strong': 'rgb(var(--mao-surface-hover-strong) / <alpha-value>)',
        'surface-hover-2': 'rgb(var(--mao-surface-hover-2) / <alpha-value>)',
        'surface-active': 'rgb(var(--mao-surface-active) / <alpha-value>)',
        'surface-subtle': 'rgb(var(--mao-surface-subtle) / <alpha-value>)',
        'surface-faint': 'rgb(var(--mao-surface-faint) / <alpha-value>)',
        'surface-strong': 'rgb(var(--mao-surface-strong) / <alpha-value>)',
        'surface-muted': 'rgb(var(--mao-surface-muted) / <alpha-value>)',
        'surface-black': 'rgb(var(--mao-surface-black) / <alpha-value>)',
        input: 'rgb(var(--mao-input) / <alpha-value>)',
        inverse: 'rgb(var(--mao-inverse) / <alpha-value>)',
        'inverse-strong': 'rgb(var(--mao-inverse-strong) / <alpha-value>)',
        // 文字层级（text-*）
        strong: 'rgb(var(--mao-text-strong) / <alpha-value>)',
        // 更新(2026-09-14)：`primary`/`secondary`/`accent`/`muted` 四个名字 cutia 也用，
        // 语义不同（本仓=文字/强调色；cutia=主题色/悬浮底色）。
        // 值改为 `var(--ve-x, <本仓默认>)` —— 编辑器容器 `.ve-scope` 内取 cutia 值，
        // 容器外回落本仓默认（行为等价，观感零变化）。见 docs/130-cutia搬迁计划书。
        primary: 'var(--ve-text-primary, rgb(var(--mao-text-primary) / <alpha-value>))',
        body: 'rgb(var(--mao-text-body) / <alpha-value>)',
        secondary: 'var(--ve-text-secondary, rgb(var(--mao-text-secondary) / <alpha-value>))',
        muted: 'var(--ve-muted, rgb(var(--mao-text-muted) / <alpha-value>))',
        faint: 'rgb(var(--mao-text-faint) / <alpha-value>)',
        subtle: 'rgb(var(--mao-text-subtle) / <alpha-value>)',
        'muted-2': 'rgb(var(--mao-text-muted-2) / <alpha-value>)',
        // 边框层级（border-*）
        edge: 'rgb(var(--mao-edge) / <alpha-value>)',
        'edge-strong': 'rgb(var(--mao-edge-strong) / <alpha-value>)',
        'edge-faint': 'rgb(var(--mao-edge-faint) / <alpha-value>)',
        'edge-muted': 'rgb(var(--mao-edge-muted) / <alpha-value>)',
        'edge-subtle': 'rgb(var(--mao-edge-subtle) / <alpha-value>)',
        'edge-raised': 'rgb(var(--mao-edge-raised) / <alpha-value>)',
        // 阶段3 收编缺口（深嵌入底/代码块底）
        'surface-sunken': 'rgb(var(--mao-surface-sunken) / <alpha-value>)',
        'surface-sunken-2': 'rgb(var(--mao-surface-sunken-2) / <alpha-value>)',
        'code-bg': 'rgb(var(--mao-code-bg) / <alpha-value>)',
        // 阶段3 精确收编缺口（中间灰阶）
        'surface-panel': 'rgb(var(--mao-surface-panel) / <alpha-value>)',
        'surface-panel-2': 'rgb(var(--mao-surface-panel-2) / <alpha-value>)',
        'surface-well': 'rgb(var(--mao-surface-well) / <alpha-value>)',
        'surface-raised-2': 'rgb(var(--mao-surface-raised-2) / <alpha-value>)',
        'surface-active-2': 'rgb(var(--mao-surface-active-2) / <alpha-value>)',
        'surface-hover-2b': 'rgb(var(--mao-surface-hover-2b) / <alpha-value>)',
        // 语义强调色（状态/交互，值取自 :root 的 --mao-accent / --mao-danger / --mao-live）。
        // 此前 :root 定义了三者，但 config 未暴露成 Tailwind 类 → `bg-danger`/`text-accent` 等类
        // 一直不生成样式（红线、选中框、断链红标全是透明的）。此处补齐映射，集中一处。
        accent: 'rgb(var(--mao-accent) / <alpha-value>)',
        'accent-strong': 'rgb(var(--mao-accent-strong) / <alpha-value>)',
        danger: 'rgb(var(--mao-danger) / <alpha-value>)',
        live: 'rgb(var(--mao-live) / <alpha-value>)',

        // cutia 编辑器主题色 —— 独立文件（见 docs/130-cutia搬迁计划书 · 作用域隔离）。
        // 本文件是「本仓样式令牌唯一真相源」（CLAUDE.md §七.1），故 cutia 令牌**不写在这里**。
        ...videoEditorThemeColors,
      },
      fontSize: {
        '2xs': ['8px', { lineHeight: '1.2' }],
        meta: ['9px', { lineHeight: '1.2' }],
        caption: ['10px', { lineHeight: '1.2' }],
        'caption-sm': ['11px', { lineHeight: '1.2' }],
        'body-xs': ['12px', { lineHeight: '1.4' }],
        'body-sm': ['13px', { lineHeight: '1.4' }],
        'base-sm': ['15px', { lineHeight: '1.5' }],
      },
      boxShadow: {
        popover: '0 20px 60px -10px rgba(0,0,0,0.85)',
        'glow-blue': '0 0 4px rgba(59,130,246,0.8)',
        'glow-success': '0 0 20px rgba(34,197,94,0.15)',
        'glow-error': '0 0 20px rgba(239,68,68,0.15)',
        'glow-warning': '0 0 20px rgba(234,179,8,0.15)',
        'glow-info': '0 0 20px rgba(59,130,246,0.15)',
      },
    },
  },
  plugins: [],
};

export default config;
