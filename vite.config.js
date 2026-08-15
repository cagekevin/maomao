import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: './', // 相对路径：兼容 Chrome 插件（side panel 通过 chrome-extension:// 加载）
  build: {
    outDir: 'dist',
    // 插件 CSP（manifest content_security_policy: script-src 'self'）不允许内联，交给 vite 外部化
    cssCodeSplit: false,
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          // 按 node_modules 顶层包名归组，让各库独立成 chunk 并复用共享依赖
          // 顺序很重要：three/@react-three 必须在 react 判断之前匹配，否则含 'react' 的
          // @react-three/fiber 会被误吸进 vendor-react，且 three 体积巨大应独立成 vendor-3d。
          if (id.includes('node_modules')) {
            if (id.includes('@react-three') || id.includes('/three/') || id.includes('three/build')) return 'vendor-3d'
            if (id.includes('@xyflow')) return 'vendor-flow'
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
