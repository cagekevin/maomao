/** @type {import('dependency-cruiser').IConfiguration} */
/**
 * dependency-cruiser 架构规则（download/ 工具箱，不在主工程 package.json 依赖）。
 * 用法：cd .. && ./download/node_modules/.bin/depcruise src --config download/.dependency-cruiser.cjs ...
 *
 * 覆盖两类规则：
 *  1. no-circular —— 拦截循环依赖（P0，madge 交叉验证一致）
 *  2. forbidden 分层边界 —— 防止 base⇄业务域反向 / nodes 横向互引 / 引用 reference
 */
module.exports = {
  forbidden: [
    // ── P0 · 循环依赖（全库）──────────────────────────────
    {
      name: 'no-circular',
      severity: 'error',
      comment: '禁止循环依赖（CLAUDE.md §5.4.2 TDZ 红线）。检测到请先解环再提交。',
      from: {},
      to: { circular: true },
    },

    // ── 分层边界 · base 通用地基禁止反向依赖业务域 ────────────
    {
      name: 'no-base-to-business',
      severity: 'error',
      comment: 'base/ 是通用地基，禁止依赖业务域（nodes/scriptbox/agent/panels）。业务依赖 base 才是正确方向。\n'
        + '例外（pathNot）：base/canvas/NodePalette.ts 节点注册表（单源派生 nodeTypes，刻意引用全部节点）；base/canvas/lazyNode.tsx 重节点懒加载包装。',
      from: {
        path: '^src/components/base/',
        pathNot: '^src/components/base/canvas/(NodePalette\\.ts|lazyNode\\.tsx)$',
      },
      to: { path: '^src/components/(nodes|scriptbox|agent|panels)/' },
    },

    // ── 分层边界 · 业务域禁止互相横向依赖（仅同域内部） ──────
    {
      name: 'no-nodes-cross',
      severity: 'error',
      comment: 'nodes/* 是叶子节点，禁止节点之间互相 import（横向互引）。公共逻辑抽到 base/ 或 hooks/。\n'
        + '例外（to.pathNot）：nodes/useImageHoverActions.tsx 是跨图片节点共享 hook（base/README 2026-09-04 '
        + '决策收于 nodes/ 的业务域专属件，被 ImageNode/PromptNode 共用，有专属单测 useImageHoverActions.test.tsx）。',
      from: { path: '^src/components/nodes/' },
      to: {
        path: '^src/components/nodes/',
        pathNot: '^src/components/nodes/useImageHoverActions\\.tsx$',
      },
    },

    // ── 边界 · 禁止引用只读参考库 ──────────────────────────
    {
      name: 'no-reference-import',
      severity: 'error',
      comment: 'reference-1mao/ 是混淆还原只读参考（CLAUDE.md §5.3），禁止被 src 业务代码 import。',
      from: { path: '^src/' },
      to: { path: '^reference-1mao/' },
    },
  ],

  options: {
    doNotFollow: {
      path: 'node_modules',
    },
    exclude: {
      // 更新(2026-09-09)：director3d 已解除豁免（spec/CONTEXT.md §五·五：可改、可收口），
      //   原 `^src/components/director3d/` 排除项已移除，纳入全量架构校验。
      path: '(^|/)(dist|dev|coverage|node_modules)(/|$)',
    },

    tsConfig: {
      fileName: 'tsconfig.json',
    },
    tsPreCompilationDeps: true,

    // 扩展名无关解析（js/jsx/ts/tsx）
    enhancedResolveOptions: {
      extensions: ['.js', '.jsx', '.ts', '.tsx'],
      exportsFields: ['exports'],
      mainFields: ['module', 'main'],
    },

    reporterOptions: {
      dot: {
        collapsePattern: '^(src/components/[^/]+)/.*',
      },
    },
  },
}
