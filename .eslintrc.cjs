module.exports = {
  root: true,
  env: {
    browser: true,
    es2022: true,
    node: true,
  },
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    ecmaFeatures: { jsx: true },
  },
  settings: {
    react: { version: 'detect' },
  },
  plugins: ['@typescript-eslint', 'react', 'react-hooks'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
    'prettier',
  ],
  rules: {
    // 适配本项目非严格 TS 设置，避免过度报错
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/no-unused-vars': [
      'warn',
      { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
    ],
    '@typescript-eslint/no-empty-function': 'off',
    // 【P7 · 2026-10-20】ts-comment 存量已清零（2 处 `@ts-ignore` 改成 `vi.stubGlobal`），开 error。
    // 允许「带说明的 @ts-expect-error」（默认 allow-with-description）——那是**有意**的类型级断言。
    '@typescript-eslint/ban-ts-comment': 'error',
    // 【2026-10-20 · P7 收尾】非空断言存量已清零（792 → 0，13 批），直接开 error。
    // 原「永不复涨」基线闸（check-nonnull.mjs + nonnull-baseline.json）随之退役：
    // 存量一旦为 0，闸要守的「禁新增」由本规则无条件接管，多留一道闸就是第二份真相。
    '@typescript-eslint/no-non-null-assertion': 'error',
    '@typescript-eslint/no-var-requires': 'off',
    'react/react-in-jsx-scope': 'off',
    'react/prop-types': 'off',
    'react/display-name': 'off',
    // react-three-fiber 的合法属性（position/rotation/args/map/side 等）被误报，关闭
    'react/no-unknown-property': 'off',
    // 允许 `while (true)` 这类故意的无限循环，仍检查 `if (true)` 等常量条件
    'no-constant-condition': ['error', { checkLoops: false }],
    'no-empty': 'off',
    'no-console': 'off',
    'no-debugger': 'warn',
    'no-undef': 'off',
  },
  ignorePatterns: [
    'node_modules',
    'dist',
    'dev',
    'build',
    'coverage',
    '*.min.js',
    'scripts/1mao-scripts/scriptbox-split-snapshot/**',
    'tmp/**',
  ],
};
