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
    '@typescript-eslint/ban-ts-comment': 'off',
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
  ignorePatterns: ['node_modules', 'dist', 'dev', 'build', 'coverage', '*.min.js'],
};
