/* ============================================================================
 * tailwind.mockup.config.js —— 用于 Tailwind Play CDN 的镜像配置
 *
 * 逐字对应 src/tailwind.config.ts（颜色 / 字号 / z-index / 阴影），
 * 让 mockup HTML 使用 <script src="https://cdn.tailwindcss.com"></script> 后，
 * 直接写 bg-surface / text-primary / border-edge / pk-* 配套工具类，与产品零差别。
 *
 * 用法（放在 mockup HTML 的 <head>）：
 *   <link rel="stylesheet" href="maomao-kit.css">
 *   <script src="https://cdn.tailwindcss.com"></script>
 *   <script src="tailwind.mockup.config.js"></script>
 *
 * 颜色值用 rgb(var(--mao-*) / <alpha-value>)，透明度修饰符（如 bg-surface/60）生效；
 * 必须与 maomao-kit.css 的 :root --mao-* 配合。
 * cutia 视频编辑器色名（background/foreground/card/…/chart-5）在 .ve-scope 内由
 * ve-theme.css 的 --ve-* 覆盖；mockup 视频编辑器需另 <link> ve-theme.css 并加
 * <div class="ve-scope dark"> 容器。
 * ========================================================================== */
tailwind.config = {
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // 背景层级
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
        // 阶段3 中间灰阶
        'surface-panel': 'rgb(var(--mao-surface-panel) / <alpha-value>)',
        'surface-panel-2': 'rgb(var(--mao-surface-panel-2) / <alpha-value>)',
        'surface-well': 'rgb(var(--mao-surface-well) / <alpha-value>)',
        'surface-raised-2': 'rgb(var(--mao-surface-raised-2) / <alpha-value>)',
        'surface-active-2': 'rgb(var(--mao-surface-active-2) / <alpha-value>)',
        'surface-hover-2b': 'rgb(var(--mao-surface-hover-2b) / <alpha-value>)',
        // 语义强调色（与真实 tailwind.config.ts 完全一致）
        accent: 'rgb(var(--mao-accent) / <alpha-value>)',
        'accent-strong': 'rgb(var(--mao-accent-strong) / <alpha-value>)',
        danger: 'rgb(var(--mao-danger) / <alpha-value>)',
        live: 'rgb(var(--mao-live) / <alpha-value>)',

        // ── cutia 视频编辑器主题色（来自 ve-tailwind-colors.ts；
        //    .ve-scope 内由 ve-theme.css 的 --ve-* 覆盖，此处为 .ve-scope 外回落值）──
        background: 'rgb(var(--ve-bg, var(--mao-canvas)) / <alpha-value>)',
        foreground: 'rgb(var(--ve-fg, var(--mao-text-primary)) / <alpha-value>)',
        card: 'rgb(var(--ve-bg, var(--mao-surface-1)) / <alpha-value>)',
        'card-foreground': 'rgb(var(--ve-fg, var(--mao-text-primary)) / <alpha-value>)',
        popover: 'rgb(var(--ve-popover, var(--mao-surface-raised)) / <alpha-value>)',
        'popover-hover': 'rgb(var(--ve-popover-hover, var(--mao-surface-hover)) / <alpha-value>)',
        'popover-foreground': 'rgb(var(--ve-popover-fg, var(--mao-text-strong)) / <alpha-value>)',
        'primary-foreground': 'rgb(var(--ve-on-primary, 255 255 255) / <alpha-value>)',
        'secondary-foreground': 'rgb(var(--ve-fg))',
        'secondary-border': 'rgb(var(--ve-border, var(--mao-edge)) / <alpha-value>)',
        'muted-foreground': 'rgb(var(--ve-fg) / 0.55)',
        destructive: 'rgb(var(--ve-danger, var(--mao-danger)) / <alpha-value>)',
        'destructive-foreground': 'rgb(var(--ve-on-danger, 255 255 255) / <alpha-value>)',
        constructive: 'rgb(var(--ve-ok, 34 197 94) / <alpha-value>)',
        'constructive-foreground': 'rgb(var(--ve-on-ok, 255 255 255) / <alpha-value>)',
        'sidebar-background': 'rgb(var(--ve-bg, var(--mao-surface)) / <alpha-value>)',
        'sidebar-foreground': 'rgb(var(--ve-fg, var(--mao-text-primary)) / <alpha-value>)',
        'sidebar-primary': 'rgb(var(--ve-primary, var(--mao-accent)) / <alpha-value>)',
        'sidebar-primary-foreground': 'rgb(var(--ve-on-primary, 255 255 255) / <alpha-value>)',
        'sidebar-accent': 'rgb(var(--ve-accent, var(--mao-surface-hover)) / <alpha-value>)',
        'sidebar-accent-foreground': 'rgb(var(--ve-fg, var(--mao-text-primary)) / <alpha-value>)',
        'sidebar-border': 'rgb(var(--ve-border, var(--mao-edge)) / <alpha-value>)',
        'sidebar-ring': 'rgb(var(--ve-ring, var(--mao-accent)) / <alpha-value>)',
        'chart-1': 'rgb(var(--ve-chart-1, 59 130 246) / <alpha-value>)',
        'chart-2': 'rgb(var(--ve-chart-2, 34 197 94) / <alpha-value>)',
        'chart-3': 'rgb(var(--ve-chart-3, 245 158 11) / <alpha-value>)',
        'chart-4': 'rgb(var(--ve-chart-4, 168 85 247) / <alpha-value>)',
        'chart-5': 'rgb(var(--ve-chart-5, 239 68 68) / <alpha-value>)',
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
};
