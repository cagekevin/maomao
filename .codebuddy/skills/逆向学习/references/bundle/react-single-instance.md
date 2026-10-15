# React 单实例（杜绝多实例 / Invalid hook call）

> 拆出的代码会 `import React from 'react'`，但运行时只能有**一份** React（vendor 里的 `Rr`）。
> **shim 只是第一道关**：即使 shim 写对，若 webcrack 把 vendor 复制成多份（每份独立 dispatcher），仍会真机报 `Cannot read properties of null (reading 'useState')`。

---

## 1. 基础方案：shim + alias

1. 找到 vendor 里的 React 工厂导出名（通常是 `Rr` / `Fr`）
2. 写 `_react_shim.js`（把 `react` 指向 vendor `Rr`）+ `_jsx_runtime.js`（把 `react/jsx-runtime` 指向 vendor `Fr`）
3. `vite.config.ts`：`alias` + `dedupe:['react','react-dom']` + `force-jsx-for-js` 插件

模板见 `templates.md`。

> **判断 `Rr` 是工厂还是对象**：`export{...,Rr,...}` 且 `Rr` 是函数 = **工厂**（需 `Rr()` 调用）；是对象字面量 = 直接对象。

---

## 2. 更隐蔽的坑：vendor 多副本 → React 双实例

### 2.1 现象
真机报 `TypeError: Cannot read properties of null (reading 'useState')`，栈顶指向 `App-*.js` 里 `e.useState = function(O){ return $.H.useState(O) }`。
`$.H` 是 React 19 内部的 `ReactCurrentDispatcher.current`，初始为 `null`，本应由 react-dom 在 `createRoot().render()` 时填成真 dispatcher。它为 `null` = **渲染用的 react-dom 与组件用的 react 不是同一份实例**。

### 2.2 三层根因（逐层才看清）
1. **`Rr` 是工厂不是实例**：`Rr()` 才返回完整 React 主对象（含全部 hooks）。若误把 `Rr` 当主对象、去掉 `Rr()` 调用 → `React.useState` 为 undefined。
2. **vendor 被复制成多份**：webcrack 把 `vendor-*.js` 完整复制到每个 `*_components/` 子目录，每份独立 `var $={H:null}`。App 用子目录副本的 `Rr`，入口 main 用根 vendor 的 `Ir`（react-dom）——两套 `$.H` 互不相通。
3. **`manualChunks` 没拦住内联**：rolldown 把被 App 直接引用的 vendor react 子模块内联进 App chunk，进一步复制出第三份 `$.H`。

### 2.3 修复（三处，缺一不可）
1. **`_react_shim.js`**：保留 `Rr()` 调用（工厂取实例），并加断言早暴露：
   ```js
   if (typeof React.useState !== 'function' || typeof React.createElement !== 'function') {
     throw new Error('[react-shim] 单实例失败');
   }
   ```
2. **`vite.config.ts` 的 `manualChunks`**：把 react/vendor/runtime 强制合并进**同一个** chunk：
   ```ts
   manualChunks(id) {
     if (id.includes('src' + path.sep + 'bundle' + path.sep)) {
       if (/(vendor|_react_shim|_jsx_runtime|rolldown-runtime)/.test(id)) return 'react-vendor';
       return undefined; // 其余交给 rollup 默认拆包
     }
     return undefined;
   }
   ```
3. **合并 vendor 多副本（关键）**：删掉所有**非根**的 `vendor-*.js`，并把子目录里 `from './vendor-*.js'` 改成 `from '../vendor-*.js'`，让全工程只有**一个**物理 vendor 文件、一个 `$.H`。用 Node 脚本递归处理（删副本 + 改引用路径）比手改可靠。

### 2.4 验证信号
- 修复前：致命 `TypeError: ...useState` + `[RootErrorBoundary] 捕获到未处理异常` → 白屏
- 修复后：该错误消失，应用正常初始化/渲染/发起真实业务请求；App chunk 体积显著下降（React 不再重复内联）
- 剩下的 error 全是外部 **404**，属运行环境噪声

### 2.5 排查脚本（构建前确认）
```js
import * as v from './src/bundle/vendor-<hash>.js';
const Rr = v.Rr;
const React = (typeof Rr === 'function') ? Rr() : Rr;
console.log('Rr() 含 hooks:', ['useState','createElement','Fragment','createContext','forwardRef','memo']
  .filter(k => typeof React[k] === 'function'));
console.log('version:', React.version); // 应为 19.x
```
```bash
find src/bundle -name 'vendor-*.js'   # 不止一个 → 必出问题，先做 2.3 第 3 步
```

---

## 3. 相关坑（来自实战）

- **`X.forwardRef is not a function`**：react 命名空间别名没 import → 补 `import * as X from 'react'`。
- **`d.forwardRef is not a function` 但 `d` 来自 vendor 且是 number**：说明该模块把 vendor 的非 React 导出当成了 React。只有 `Rr` 是 React 工厂（需 interop 包装），`C`/`Fr`/`Ir`/`Dr` 都不是。
- **`document.createElement` 被误抓成 React API**：扫描 `MemberExpression` 时 `createElement` 命中 `REACT_APIS` → 生成了 `import * as document from 'react'` 覆盖真全局。解法：`REACT_APIS` 配合 `GLOBALS` 白名单（`document/window/self/globalThis` 等）跳过。
- **esbuild 压缩重命名碰撞**（`n.getElementById is not a function`）：全局 `document` 被压成 `n`，而 `n` 又恰好是某导出的别名 → 指向函数。解法：`vite.config.ts` 里 **`minify: false`** 彻底消除碰撞（代价是体积变大，但不违反拆分约束）。
