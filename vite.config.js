import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  base: './', // 相对路径：兼容 Chrome 插件（side panel 通过 chrome-extension:// 加载）
  build: {
    outDir: 'dist',
    // 插件 CSP（manifest content_security_policy: script-src 'self'）不允许内联，交给 vite 外部化
    cssCodeSplit: false,
    sourcemap: false,
    // 动态 import 预加载保持默认开启（modulepreload 预取对按需加载体验有益）。
    // 「__vitePreload helper 被塞进大 vendor、导致主 chunk 静态依赖它」的问题，
    // 由下方 manualChunks 的 `vite/preload-helper` 拦截解决（留在入口，见下）。
    // ⚠️ 认知纠正：manualChunks 只负责「拆文件」，不改变加载时机。
    // 只要对重依赖节点是静态 import，拆出来的 chunk 仍会在首屏被强制下载。
    // vendor-3d(1.06MB)/vendor-media(705KB) 此前就是这样白占首屏的，
    // 真正解决靠的是把静态 import 换成 React.lazy（见 src/components/base/lazyNode.jsx）。
    // 故阈值回调到 800：它是「新增重依赖」的报警器，此前为压警告调到 1500 反而掩盖了真问题。
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        manualChunks(id) {
          // ⚠️ Vite 动态 import 的预加载 helper（__vitePreload）必须留在入口 chunk。
          // 它被所有含动态 import 的 chunk 共享，若被下面的规则分进某个 vendor chunk，
          // 入口就会为拿这个几行的 helper 而静态 import 整个 vendor → 该大 chunk 首屏必载
          // （实测：vendor-3d 1MB 就是这么被拖进首屏的，白做 lazy 优化）。
          // Vite 的 __vitePreload helper（id 为 'vite/preload-helper'）必须留入口 chunk：
          // 它被所有含动态 import 的 chunk 共享，若被 Rollup 放进某个大 vendor（实测 vendor-3d），
          // 主 chunk 就为调用它而静态 import 整个 1MB vendor → 按需加载失效、首屏依旧全下。
          // 这是官方推荐的 manualChunks 处理（务必保持精确匹配 'vite/preload-helper'）。
          // Vite 的 __vitePreload helper（id 形如 '\u0000vite/preload-helper.js'，带空字符前缀）必须留入口：
          // 它被所有含动态 import 的 chunk 共享，若被 Rollup 放进大 vendor（实测 vendor-3d），
          // 主 chunk 就为调用它而静态 import 整个 1MB vendor → 按需加载失效。用 includes 匹配
          // （不能用 ===，id 带不可见的前缀）。commonjsHelpers 同理。
          if (id.includes('vite/preload-helper') || id.includes('commonjsHelpers')) return undefined
          // 按 node_modules 顶层包名归组，让各库独立成 chunk 并复用共享依赖
          // 顺序很重要：three/@react-three 必须在 react 判断之前匹配，否则含 'react' 的
          // @react-three/fiber 会被误吸进 vendor-react，且 three 体积巨大应独立成 vendor-3d。
          if (id.includes('node_modules')) {
            if (id.includes('@react-three') || id.includes('/three/') || id.includes('three/build')) return 'vendor-3d'
            // @xyflow 不再独立成 chunk：它强依赖 react（peerDeps react>=17，模块顶部大量
            // `import { useState } from 'react'`）。若拆成 vendor-flow 独立 chunk，会与
            // vendor-react 形成循环 chunk，导致 vendor-flow 在 vendor-react 初始化完成前执行
            // → 运行时 `reading 'useState'` 但 React 为 undefined 崩溃（2026-08-20 修复）。
            // 让它随 react 归入 vendor-react（同 chunk 保证 React 先定义），消除循环。
            if (id.includes('mediabunny')) return 'vendor-media'
            if (id.includes('gifenc')) return 'vendor-media'
            if (id.includes('lucide-react')) return 'vendor-ui'
            if (id.includes('dagre')) return 'vendor-layout'
            if (id.includes('react')) return 'vendor-react'
          }
        },
      },
    },
  },
  server: {
    port: 5180,
    open: true,
  },
})
