import base from './vitest.config.ts';

// 逻辑层专用运行面（快速定向）：只跑 *.test.ts（纯逻辑 / API / 状态 / hooks），
// 把需要 jsdom 的 .test.tsx 组件测试（最耗时）挡在门外面。
// 用法：`npm run test:unit:logic`，或 `npx vitest run <文件> --config vitest.logic.config.ts`。
// 说明：
//  - 复用了 vitest.config.js 的路由/池/mock 基建（setup.mjs、forks 池、alias 等），保证行为一致。
//  - 测试已全部 TS 化（2026-09-01 收官）：纯逻辑统一 *.test.ts（node），组件 *.test.tsx（jsdom）。
//    include 仅 *.test.ts（不含 tsx），确保组件测试不进入本快速定向面。
//  - 少数 .test.ts 顶部自带 `@vitest-environment jsdom`（如 hooks 测试），
//    vitest 仍按其文件内注释走 jsdom，属预期，不被本配置强行改回 node。
//  - 全量回归仍是 `test:unit`（走 vitest.config.js，含 .test.tsx 组件）。本配置只服务开发期快速定向。
export default {
  ...base,
  test: {
    ...base.test,
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node',
    environmentMatchGlobs: [],
  },
};
