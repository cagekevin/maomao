/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      /**
       * 统一 z-index 语义令牌（避免散落魔法数字导致层级冲突）。
       *
       * 排序（从低到高）：
       *   base 0 < node-inner 10/20 < dropdown 50 < float 100 < topnav 200
       *   < canvas-tools 700 < sidebar 800 < popover 1000 < modal 9999
       *   < modal-raise 10000 < modal-action 10001 < overlay-error 99999
       *   < suggest 999999 < ceiling 2147483647（全屏编辑器 / Toast / 错误全屏）
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
        suggest: '999999',
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
        canvas: '#0d0c0c',
        surface: '#1a1a1a',
        'surface-1': '#222222',
        'surface-2': '#1f1f1f',
        'surface-3': '#444444',
        'surface-raised': '#1c1c1c',
        'surface-menu': '#1c1c1e',
        'surface-deep': '#151414',
        'surface-hover': '#2a2a2a',
        'surface-hover-strong': '#333333',
        'surface-hover-2': '#2c2c2c',
        'surface-active': '#252525',
        'surface-subtle': '#242424',
        'surface-faint': '#1e1e1e',
        'surface-strong': '#161616',
        'surface-muted': '#151515',
        'surface-black': '#111111',
        input: '#141414',
        inverse: '#ededed',
        'inverse-strong': '#161616',
        // 文字层级（text-*）
        strong: '#ffffff',
        primary: '#dddddd',
        body: '#cccccc',
        secondary: '#aaaaaa',
        muted: '#888888',
        faint: '#666666',
        subtle: '#555555',
        // 边框层级（border-*）
        edge: '#333333',
        'edge-strong': '#555555',
        'edge-faint': '#2a2a2a',
        'edge-muted': '#444444',
        'edge-subtle': '#222222',
        'edge-raised': '#3a3a3a',
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
}
