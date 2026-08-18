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
    // 并发优化：forks 池默认懒启动、minForks 偏低导致整包跑得慢。
    // 注意：Windows 下 fork 进程各自独立占内存，并发过高 + 系统可用内存不足时，
    // worker 会被 OOM 杀掉（"Worker exited unexpectedly"）。这里把并发压到 3 并给
    // 每个 worker 显式堆上限，平衡速度与内存峰值；内存紧张时可进一步降到 2/1。
    pool: 'forks',
    maxWorkers: 3,
    minWorkers: 1,
    poolOptions: {
      forks: {
        // 单 worker Node 堆上限，防止组件测试（jsdom+React）单个进程内存失控
        execArgv: ['--max-old-space-size=1024'],
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
