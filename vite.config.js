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
  },
  server: {
    port: 5180,
    open: true,
  },
})
