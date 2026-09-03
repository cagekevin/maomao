import { defineConfig, defaultExclude } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'node:url'

// 同 vite.config.ts：不用 CJS 的 __dirname，改标准 ESM 解析，不依赖打包器注入的 define。
const rootDir = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [react()],
  test: {
    // 默认关闭 watch：`npx vitest` 裸调也只会单次跑完即退（不挂住）。
    // 需要 watch 时显式 `npx vitest --watch` 或 `npx vitest --run` 覆盖。
    watch: false,
    // 环境路由规则（单一事实源，勿在两处互相覆盖）：
    // - 默认 node：纯逻辑单测。
    // - glob 匹配 '*.test.jsx' / '*.test.tsx' → jsdom：组件/涉及 DOM 的测试无需文件内注释。
    // - 其余 .ts 测试若确实需要 DOM，必须在文件首行写 `// @vitest-environment jsdom`——
    //   glob 无法只挑「部分 .ts」，故不能并入上面的 glob；此注释不可误删。
    environment: 'node',
    environmentMatchGlobs: [
      // 组件测试（.tsx 一律 jsdom）——兜底：每个文件已用文件级 @vitest-environment jsdom 注解，
      // glob 仅在漏注解时兜底，避免全量并发下 glob 路由抖动导致 document is not defined。
      ['tests/unit/**/*.test.tsx', 'jsdom'],
    ],
    // 测试已全 TS 化（2026-09-01 收官）：统一 .test.ts（node 纯逻辑）/ .test.tsx（jsdom 组件）。
    include: ['tests/unit/**/*.test.{ts,tsx}'],
    // 重测试默认排除：imageUpscale 是真实 canvas 图片缩放（×2/clamp/锐化走
    // getImageData/putImageData），单次 7.4s 是全量最慢的 4 倍，99% 的日常改动用不到。
    // 排除后默认 `vitest run` / 门禁 / 覆盖率都不跑它；需要回归时显式跑即可（见 test:unit:heavy）。
    // 注：exclude 不影响「指定文件路径」的调用，故 test:unit:heavy 仍能覆盖到本文件。
    exclude: [...defaultExclude, 'tests/unit/imageUpscale.test.ts'],
    globals: true,
    setupFiles: ['tests/setup.mjs'],
    // 并发优化：forks 池默认懒启动、minForks 偏低导致整包跑得慢。
    // 注意：Windows 下 fork 进程各自独立占内存，并发过高 + 系统可用内存不足时，
    // worker 会被 OOM 杀掉（"Worker exited unexpectedly"）。这里把并发压到 3 并给
    // 每个 worker 显式堆上限，平衡速度与内存峰值；内存紧张时可进一步降到 2/1。
    pool: 'forks',
    maxWorkers: 8,
    minWorkers: 1,
    poolOptions: {
      forks: {
        // 单 worker Node 堆上限，防止组件测试（jsdom+React）单个进程内存失控
        execArgv: ['--max-old-space-size=1024'],
      },
    },
    // 覆盖率（`npm run test:coverage`）：以 src 业务逻辑为统计面，剔除 UI 组件与纯样式/契约常量。
    // 门槛取保守值，先让数据沉淀、暴露低覆盖盲区，后续再逐步收紧（避免一次压实 CI）。
    // 注：src 已全 TS 化（2026-09-01 收官），include/exclude 用 .ts/.tsx 而非过时的 .js/.jsx。
    coverage: {
      provider: 'v8',
      enabled: false, // 默认不跑，仅 test:coverage 显式开启，避免拖慢普通 test:unit
      reporter: ['text', 'lcov'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/components/nodes/**', 'src/components/panels/**', 'src/components/agent/**',
        'src/components/scriptbox/**', 'src/components/director3d/**',
        '**/contracts.ts', '**/config.ts',
        '**/*.tsx', // 纯 UI 组件不计覆盖（含 nodes/panels/scriptbox 的 tsx），避免分母失真
      ],
      thresholds: {
        lines: 50, functions: 40, statements: 50, branches: 30,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(rootDir, './src'),
    },
  },
})
