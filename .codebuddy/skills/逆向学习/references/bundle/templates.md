# 模板（照抄；若 vendor 导出名 / 目录结构不同只改对应处）

---

## 1. `src/bundle/_react_shim.js`

```js
import { Rr as __Rr } from './vendor-<hash>.js';
import { i as __e } from './rolldown-runtime-<hash>.js';
const React = __e(__Rr(), 1);   // rolldown 互操作：工厂返回需经 interop 包装
if (typeof React.useState !== 'function' || typeof React.createElement !== 'function') {
  throw new Error('[react-shim] 单实例失败');
}
export default React;
export const useState = React.useState;
export const useEffect = React.useEffect;
export const useMemo = React.useMemo;
export const useCallback = React.useCallback;
export const useRef = React.useRef;
export const useImperativeHandle = React.useImperativeHandle;
export const useContext = React.useContext;
export const useReducer = React.useReducer;
export const useLayoutEffect = React.useLayoutEffect;
export const useDebugValue = React.useDebugValue;
export const useDeferredValue = React.useDeferredValue;
export const useTransition = React.useTransition;
export const useId = React.useId;
export const useSyncExternalStore = React.useSyncExternalStore;
export const useInsertionEffect = React.useInsertionEffect;
export const useOptimistic = React.useOptimistic;
export const useActionState = React.useActionState;
export const useFormStatus = React.useFormStatus;
export const use = React.use;
export const forwardRef = React.forwardRef;
export const memo = React.memo;
export const lazy = React.lazy;
export const Suspense = React.Suspense;
export const StrictMode = React.StrictMode;
export const Fragment = React.Fragment;
export const createElement = React.createElement;
export const createContext = React.createContext;
export const createFactory = React.createFactory;
export const createRef = React.createRef;
export const cloneElement = React.cloneElement;
export const isValidElement = React.isValidElement;
export const Children = React.Children;
export const Component = React.Component;
export const PureComponent = React.PureComponent;
export const Profiler = React.Profiler;
export const startTransition = React.startTransition;
export const flushSync = React.flushSync;
export const unstable_batchedUpdates = React.unstable_batchedUpdates;
export const version = React.version;
```

> 若 vendor 里 React 是**直接对象**而非工厂：第一行改 `import { Rr as React } from './vendor-<hash>.js';`，并删掉 `rolldown-runtime` 那行与 interop 包装。

---

## 2. `src/bundle/_jsx_runtime.js`

```js
import { Fr as __Fr } from './vendor-<hash>.js';
const __rt = __Fr();
export const jsx = __rt.jsx;
export const jsxs = __rt.jsxs;
export const Fragment = __rt.Fragment;
```

---

## 3. `vite.config.ts`

```ts
import { defineConfig, transformWithEsbuild } from 'vite';
import { resolve } from 'path';
import path from 'path';

// 单 React 实例：所有 'react' / 'react/jsx-runtime' 导入统一指向 vendor 内联 React，
// 与入口 react-dom 同一实例，杜绝 Invalid hook call / 多实例。
const reactShim = resolve(__dirname, 'src', 'bundle', '_react_shim.js');
const jsxRuntimeShim = resolve(__dirname, 'src', 'bundle', '_jsx_runtime.js');

export default defineConfig({
  esbuild: { jsx: 'automatic' },
  base: './',
  resolve: {
    dedupe: ['react', 'react-dom'],
    alias: {
      'react/jsx-runtime': jsxRuntimeShim,
      'react/jsx-dev-runtime': jsxRuntimeShim,
      'react': reactShim,
    },
  },
  plugins: [
    {
      name: 'force-jsx-for-js',
      enforce: 'pre',
      async transform(code, id) {
        if (id.endsWith('.js') && !id.includes('node_modules')) {
          return await transformWithEsbuild(code, id, { loader: 'jsx', jsx: 'automatic' });
        }
        return null;
      },
    },
  ],
  build: {
    outDir: 'dist', emptyOutDir: true, target: 'esnext', modulePreload: false, minify: false,
    rollupOptions: {
      input: { index: resolve(__dirname, 'index.html'), share: resolve(__dirname, 'share', 'index.html') },
      output: {
        entryFileNames: 'assets/[name].js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: 'assets/[name][extname]',
        // 关键：react/vendor/runtime 合并进单一 chunk，避免 dispatcher 被拆成多份
        manualChunks(id) {
          if (id.includes('src' + path.sep + 'bundle' + path.sep)) {
            if (/(vendor|_react_shim|_jsx_runtime|rolldown-runtime)/.test(id)) return 'react-vendor';
            return undefined;
          }
          return undefined;
        },
      },
    },
  },
});
```

**关键四项**：
1. `alias` 把 `react` / `react/jsx-runtime` 指到 shim
2. `dedupe: ['react','react-dom']`
3. `force-jsx-for-js` 插件让 `.js` 文件也按 JSX 解析（混淆产物常把 jsx 写在 `.js` 里）
4. `manualChunks` 合并 react/vendor（防双实例）；`minify: false`（防压缩重命名碰撞）

> ⚠️ **补丁必须放 build 之后（post-build）**：`closeBundle` 钩子里做的收尾（剥离 `data:text/javascript` 的 modulepreload、补 CSS 引用、拷图标）才不会被 Vite 重写 `index.html` 冲掉。

---

## 4. `package.json`

```json
{
  "name": "<项目名>",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "scripts": { "dev": "vite", "build": "vite build" },
  "dependencies": { "react": "^19.0.0", "react-dom": "^19.0.0" },
  "devDependencies": {
    "@types/chrome": "^0.0.279",
    "@types/react": "^19.0.0",
    "typescript": "^5.6.3",
    "vite": "^5.4.11"
  }
}
```

> **React 版本要对齐 vendor 内版本**（本项目 vendor 内是 React 19）。
