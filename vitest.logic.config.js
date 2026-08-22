import base from './vitest.config.js'

// 逻辑层专用运行面（快速定向）：只跑 *.test.js（纯逻辑 / API / 状态 / hooks），
// 把 60+ 个 .jsx 组件测试（需 jsdom 环境，最耗时）挡在门外面。
// 用法：`npm run test:unit:logic`，或 `npx vitest run <文件> --config vitest.logic.config.js`。
// 说明：
//  - 复用了 vitest.config.js 的路由/池/mock 基建（setup.mjs、forks 池、alias 等），保证行为一致。
//  - include 仅 *.test.js；少数 .js 文件顶部自带 `@vitest-environment jsdom`（如 hooks 测试），
//    vitest 仍按其文件内注释走 jsdom，属预期，不被本配置强行改回 node。
//  - 全量回归仍是 `test:unit`（走 vitest.config.js，含 .jsx 组件）。本配置只服务开发期快速定向。
export default {
  ...base,
  test: {
    ...base.test,
    include: ['tests/unit/**/*.test.js'],
    environment: 'node',
    environmentMatchGlobs: [],
  },
}