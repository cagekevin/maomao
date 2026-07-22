# Handoff — 2026-07-22 双 React 实例修复（第五轮）

> **给下一位 AI**：先读 `CLAUDE.md` 和 `docs/PROJECT_LOG.md`，再看本文档。

---

## 当前状态

| 项目 | 值 |
|------|-----|
| 分支 | `decouple/exec` |
| 工作区 | `vite.config.ts`、`src/main.tsx`、`src/ErrorBoundary.tsx`、`src/react-bridge.ts` 已修改 |
| 运行状态 | `npx vite build` 成功，产物完整 |
| P0 双 React 实例 | **未解决** — 方向 A 第一版（直接 import vendor.js 但不解包 CJS）运行时报错 `Class extends value undefined`，第二版（加 unwrapModule 解包）又回到大量双实例错误 |
| 构建产物 | main.js ~3KB，无 node_modules React 代码，但多次 `i(a(),1)` 调用可能导致问题 |

---

## 架构关键信息（不可变事实）

### vendor.js 结构

vendor.js（1744KB 单行混淆代码）通过 **rolldown-runtime CJS wrapper** 导出：

```js
// vendor.js 开头
import { i as e, n as t, r as n, t as r } from "./rolldown-runtime.js";
var i = r((e) => { /* React 19.2.7 完整代码 */ });  // React = 变量 i

// vendor.js 末尾
export { a as Nr, ... jr ... }  // a = React CJS wrapper, jr = ReactDOM CJS wrapper
```

- `r` = rolldown-runtime 的 `t`（即 `o()` CJS lazy singleton wrapper）
- `a`（即 `i`）是 CJS wrapper 函数，需要 **调用 `a()` 获得 `{ exports: React }`，再用 `unwrapModule()` 提取 exports**
- vendor.js **不 import 外部 react**，React 完全自包含

### rolldown-runtime 关键函数

```js
// rolldown-runtime.js
export { l as i, s as n, u as r, o as t };
// i = CJS module unwrapper: unwrapModule(factoryResult, moduleId) → 返回 module exports
// t = CJS lazy singleton factory: he(fn) → 返回 () => fn第一次调用后缓存的 exports
```

### 正确的 React 获取方式（参考 entry.js）

```js
// entry.js 的做法 — 这是正确的模式
import { i as e } from "./vendor/rolldown-runtime.js";  // e = unwrapModule
import { Nr as n, jr as r } from "./vendor/vendor.js";   // n = React CJS wrapper, r = ReactDOM CJS wrapper

var React = e(n(), 1);      // 调用 wrapper + unwrap → 真正的 React 对象
var ReactDOM = e(r(), 1);   // 同上
```

---

## 双实例的精确根因

**不是 vendor-legacy 内部有两个 React，而是 main.js 中额外内联了 node_modules 的 React**。

根本原因：`react-dom/client` 是 node_modules 中的预编译 CJS 模块。即使 alias 指向 react-bridge，Rollup 的 `@rollup/plugin-commonjs` 在处理 react-dom 内部的 `require('react')` 时，**绕过了 alias**，直接解析为 node_modules/react 的 ESM 入口。导致 main.js 中出现第二份完整的 React + react-dom 代码。

---

## 已尝试方案及结果

### 方案 A-1：直接 import vendor.js 但不解包 CJS

- `main.tsx`: `import { Nr as React } from './vendor/vendor.js'`
- `ErrorBoundary.tsx`: 同上
- **结果**：构建产物干净（main.js 3KB），但运行时 `Class extends value undefined` — 因为 `React` 是 CJS wrapper 函数，不是 React 对象，没有 `.Component`

### 方案 A-2：import + unwrapModule 解包（当前代码状态）

- 三个文件都 `import { i as unwrapModule }` + 调用 `unwrapModule(factory(), 1)` 解包
- **结果**：构建产物中 `i(a(),1)` 被调用了 3 次（main.tsx、ErrorBoundary.tsx、react-bridge.ts 各一次），运行时又回到大量双实例错误

**推测**：多次 `unwrapModule` 调用虽然在源代码中是同一个函数，但 Rollup 可能把它们内联/复制，导致多次初始化 vendor 模块产生多个 React 实例。

---

## 关键约束

| 能改 | 不能改 |
|------|--------|
| `src/App.js` | `dist/` |
| `src/config.js` | `*.css`（预编译产物） |
| `localTool/src/**` | `src/entry.js`（入口壳，极少改动） |
| `apimart-gateway/**` | `src/vendor/vendor.js`（预编译混淆产物，极高风险） |
| `vite.config.ts` | `src/vendor/rolldown-runtime.js` |
| `src/react-bridge.ts`（新增） |  |
| `src/main.tsx` |  |
| `src/ErrorBoundary.tsx` |  |
| `index.html` |  |

---

## 下一步建议

1. **统一解包入口**：只在 `main.tsx` 中解包一次 React/ReactDOM，挂到 `window`，ErrorBoundary 和 react-bridge 从 `window.React` 获取，避免多次 `unwrapModule` 调用
2. 或者：让 ErrorBoundary 和 react-bridge 从 `main.tsx` 重新 export 的 React 导入（但需要解决循环依赖）
3. 或者回退到**方向 B（external + 全局变量）**，彻底绕过 Rollup 模块去重问题



