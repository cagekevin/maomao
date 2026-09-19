/**
 * videoEditor 域门面（**唯一对外出口**）· 2026-09-19 建（域模块化 Step A 第一批）。
 *
 * 【为什么存在】域外只准经本文件引用本域 ⇒ 域内 258 个文件的位置与名字可自由重构，不再波及域外。
 *   建面前的实况：本域**没有门面**，`src/App.tsx` 直指深路径 `components/videoEditor/EditorShell.tsx`
 *   （实测域外消费点仅此 1 处）。
 *
 * 【露什么（🔴 窄接口红线）】只露**稳定的对外面**：域入口组件 + 它的 props 类型。
 *   ⚠️ **别往这里加"顺手能露"的东西** —— 宽门面 = 假收口（把内部结构换个地方暴露，等价于没建）。
 *   判据：加一个导出前先问「域外真的需要它吗」，答不出就别加。
 *
 * 【🔵 两个合法例外（不走门面，判据见 docs/DOMAIN-MODULES.md §5.2.2）】
 *   1. `tailwind.config.ts` 直引 `./src/components/videoEditor/ve-tailwind-colors`
 *      —— **构建期**消费（Node/tsx 加载）：走门面会把本域整张依赖图拉进构建配置；
 *      且该文件**必须保持零依赖**（它就是纯色值表）。
 *   2. `src/main.tsx` 直引 `./components/videoEditor/ve-theme.css`
 *      —— CSS 副作用导入：CSS 不在 TS 模块图内，无环风险，也无需经门面。
 */
export { EditorShell } from './EditorShell.tsx';
export type { EditorShellProps } from './EditorShell.tsx';
