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
    // no-non-null-assertion 仍 off：实测存量 **792 处 / 122 文件**（2026-10-20 eslint 实跑）。
    // 直接开 error 会一夜红；按 docs/plan/150 §3 P7 的判据先建「新增即红」基线，再逐批清。
    '@typescript-eslint/no-non-null-assertion': 'off',
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
