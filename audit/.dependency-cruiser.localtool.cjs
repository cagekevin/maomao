/** @type {import('dependency-cruiser').IConfiguration} */
/**
 * localTool 专用架构规则（复用 download/ 工具箱）。
 * 仅保留与 localTool 相关的规则：循环依赖红线 + 禁止引用主工程/参考库。
 */
module.exports = {
  forbidden: [
    {
      name: 'no-circular',
      severity: 'error',
      comment: '禁止循环依赖。',
      from: {},
      to: { circular: true },
    },
    {
      name: 'no-reference-import',
      severity: 'error',
      comment: '禁止引用主工程 src / reference-1mao 等外部目录。',
      from: { path: '^localTool/src/' },
      to: { path: '^(src/|reference-1mao/)' },
    },
  ],

  options: {
    doNotFollow: { path: 'node_modules' },
    exclude: {
      path: '(^|/)(dist|dev|coverage|node_modules)(/|$)',
    },
    tsPreCompilationDeps: false,
    enhancedResolveOptions: {
      extensions: ['.js', '.jsx', '.ts', '.tsx'],
      exportsFields: ['exports'],
      mainFields: ['module', 'main'],
    },
  },
}
