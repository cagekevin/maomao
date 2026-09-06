import type { Config } from 'tailwindcss';

/**
 * 样式令牌唯一真相源（CLAUDE.md §七.1 指定；禁裸色值，勿再引用已删的 tailwind-tokens.md）。
 *
 * 更新(2026-09-02)：随全仓 TS 化 .js→.ts，JSDoc 的 `@type` 换成真 `Config` 类型标注
 * （等价于原约束，但可被 `npm run type-check` 真正校验：写错 theme 结构/插件名会被拦住）。
 * src 已全 TS 化，content glob 里的 .js/.jsx 保留作兜底（万一有人新建，样式仍能被提取）。
 */
const config: Config = {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      /**
       * 统一 z-index 语义令牌（避免散落魔法数字导致层级冲突）。
       *
       * 排序（从低到高）：
       *   base 0 < node-inner 10/20 < dropdown 50 < float 100 < topnav 200
       *   < canvas-tools 700 < sidebar 800 < popover 1000 < modal 9999
       *   < modal-raise 10000 < modal-action 10001 < overlay-error 99999
       *   < ceiling 2147483647（全屏编辑器 / Toast / 错误全屏）
       *
       * 关键约定：
       *   - 侧边栏(sidebar 800) 必须盖过左下角小地图与工具栏(canvas-tools 700)，
       *     这样侧边栏展开时能盖住画布左下角的那一排工具/小地图。
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
        'canvas-tools': '700',
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
        primary: 'rgb(var(--mao-text-primary) / <alpha-value>)',
        body: 'rgb(var(--mao-text-body) / <alpha-value>)',
        secondary: 'rgb(var(--mao-text-secondary) / <alpha-value>)',
        muted: 'rgb(var(--mao-text-muted) / <alpha-value>)',
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
