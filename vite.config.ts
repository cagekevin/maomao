import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './', // Chrome 扩展需要相对路径
  resolve: {
    dedupe: ['react', 'react-dom'],
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    // OOM 防护：使用 esbuild 压缩（比 terser 更省内存）
    target: 'esnext',
    rollupOptions: {
      input: {
        main: 'index.html',
        background: 'src/background.ts',
      },
      output: {
        // 保持 background 文件名稳定，供 manifest.service_worker 引用
        entryFileNames: (chunkInfo) =>
          chunkInfo.name === 'background' ? 'background.js' : 'assets/[name]-[hash].js',
        // _engine/* 归入独立 chunk，不与项目代码混合
        manualChunks(id) {
          if (id.includes('/_engine/')) {
            return 'engine';
          }
          // vendor React 独立 chunk（后续 1.2 统一 React 实例后可移除）
          if (id.includes('node_modules/react/') || id.includes('node_modules/react-dom/')) {
            return 'vendor-react';
          }
          // @xyflow/react 独立 chunk
          if (id.includes('node_modules/@xyflow/')) {
            return 'vendor-xyflow';
          }
        },
      },
    },
    // chunk 大小警告阈值（engine chunk 预期较大）
    chunkSizeWarningLimit: 2000,
  },
  // 开发服务器配置
  server: {
    port: 5173,
  },
});
