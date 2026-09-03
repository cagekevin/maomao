import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'node:url'

// 重测试专用配置：默认 vitest.config.ts 已把 imageUpscale.test.ts 排除（真实 canvas
// 缩放，单次 7.4s，日常用不到）。本配置只跑它，供 `npm run test:unit:heavy` 按需回归，
// 不改变默认门禁的排除行为。
const rootDir = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [react()],
  test: {
    watch: false,
    environment: 'node',
    environmentMatchGlobs: [['tests/unit/**/*.test.tsx', 'jsdom']],
    include: ['tests/unit/imageUpscale.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**'],
    globals: true,
    setupFiles: ['tests/setup.mjs'],
    pool: 'forks',
    maxWorkers: 8,
    minWorkers: 1,
    poolOptions: {
      forks: {
        execArgv: ['--max-old-space-size=1024'],
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(rootDir, './src'),
    },
  },
})
