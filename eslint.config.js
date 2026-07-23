import tseslint from 'typescript-eslint';
import globals from 'globals';

export default tseslint.config(
  {
    // 红线禁区与构建产物，绝不校验（CLAUDE.md §3）
    ignores: [
      'dist/**',
      'node_modules/**',
      'src/App.js',
      'src/vendor/**',
      'src/entry.js',
      '*.css',
      'reference/**',
      'captureVideoFrame-*.js',
      'docs/**',
      'apimart-gateway/vendor/**',
      'apimart-gateway/venv/**',
      'localTool/dist/**',
    ],
  },
  {
    files: ['**/*.{js,jsx,cjs,mjs}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.webextensions,
        // 项目运行时全局（见 CLAUDE.md）：StorageManager
        Q: 'readonly',
        StorageManager: 'readonly',
      },
    },
    rules: {
      // 仅开「报错级」规则，不强制风格，避免对存量代码产生噪音
      'no-undef': 'error',
      'no-dupe-keys': 'error',
      'no-dupe-args': 'error',
      'no-unreachable': 'error',
      'no-redeclare': 'error',
      'no-func-assign': 'error',
      'no-const-assign': 'error',
      'no-import-assign': 'error',
      'no-sparse-arrays': 'error',
      'no-irregular-whitespace': 'error',
      'constructor-super': 'error',
      'use-isnan': 'error',
      'valid-typeof': 'error',
      'no-unsafe-finally': 'error',
      'no-cond-assign': 'error',
    },
  },
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.webextensions,
        Q: 'readonly',
        StorageManager: 'readonly',
      },
    },
    rules: {
      // TS 由编译器管类型/声明，这里只加「非类型」的报错级规则
      'no-dupe-keys': 'error',
      'no-dupe-args': 'error',
      'no-unreachable': 'error',
      'no-redeclare': 'error',
      'no-func-assign': 'error',
      'no-const-assign': 'error',
      'no-sparse-arrays': 'error',
      'no-irregular-whitespace': 'error',
      'constructor-super': 'error',
      'use-isnan': 'error',
      'valid-typeof': 'error',
      'no-unsafe-finally': 'error',
      'no-cond-assign': 'error',
    },
  },
);
