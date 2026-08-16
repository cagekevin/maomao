import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.js'],
    globals: true,
    setupFiles: ['tests/setup.mjs'],
  },
  resolve: {
    alias: {
      // 让纯逻辑测试可解析相对 import 的源文件
    },
  },
})
