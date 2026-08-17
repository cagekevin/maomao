import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    // 默认环境：纯逻辑单测用轻量 node（快）。组件/涉及 DOM 的测试用 jsdom，
    // 通过 environmentMatchGlobs 集中声明（.jsx 自动 jsdom），无需在每个文件写注释。
    environment: 'node',
    environmentMatchGlobs: [
      // 组件测试（.jsx 一律 jsdom）
      ['tests/unit/**/*.test.jsx', 'jsdom'],
    ],
    include: ['tests/unit/**/*.test.{js,jsx}'],
    globals: true,
    setupFiles: ['tests/setup.mjs'],
    // 并发优化：forks 池默认懒启动、minForks 偏低导致整包跑得慢（约 11-17s）。
    // 显式调高 worker 并发后，本机（10 核）整包降至约 5s。maxWorkers 用数字避免
    // 低核 CI 机器超载；如需按核数自适应可改用 '50%'。
    pool: 'forks',
    maxWorkers: 8,
    minWorkers: 2,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
