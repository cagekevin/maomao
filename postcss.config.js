// PostCSS 配置（唯一作用：串起 tailwindcss + autoprefixer）。
//
// ⚠️ 为什么本文件【不转 .ts】（其余 5 个根配置 vite/vitest/vitest.logic/playwright/tailwind
//    均已 TS 化，2026-09-02）：
//    postcss-load-config@6 加载 `.ts` 配置时硬要求 `ts-node`（不是 jiti，实测报错
//    "'ts-node' is required for the TypeScript configuration files"）。为一个 6 行的插件
//    列表引入新 devDependency 纯属成本——本文件没有值得类型检查的逻辑，写错插件名 tailwind
//    会立刻不生效、构建当场可见。故维持 .js。
//    （同理：若日后 postcss-load-config 换成 jiti/bundle-require 加载，再考虑跟随 TS 化。）
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
