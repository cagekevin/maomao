# Handoff — 2026-07-22 双 React 实例修复（第九轮：合并 main.tsx → entry.js）

> **给下一位 AI**：先读 `CLAUDE.md`，再看本文档。

---

## 当前状态

| 项目 | 值 |
|------|-----|
| 分支 | `decouple/exec`（detached HEAD @ `b5c712d`） |
| 工作区 | `index.html`、`src/entry.js` 已完成入口合并；`src/main.tsx` 已删除 |
| 构建 | `npx vite build` 成功 |
| 运行时 | **待验证**（上轮报 `Cannot read properties of undefined (reading 'Component')`） |

---

## 核心矛盾

Rollup 无法对 vendor.js 的 CJS wrapper 导出做**跨 chunk 模块去重**。不同 chunk 各自 `import { Nr } from vendor.js` → 各自解包 → 多个 React 实例。

---

## 架构关键信息

### vendor.js

```js
// 开头
import { i as e, n as t, r as n, t as r } from "./rolldown-runtime.js";
var i = r((e) => { /* React 19.2.7 完整代码 */ });

// 末尾
export { a as Nr, ... jr ... }
// a = i = r(...) = CJS lazy singleton wrapper 函数
// jr = ReactDOM CJS wrapper
```

### rolldown-runtime.js

```js
export { l as i, s as n, u as r, o as t };
// i = unwrapModule(factoryResult, moduleId)
// t = CJS lazy singleton: () => 缓存 exports
```

### 正确的解包方式（参考原始 entry.js）

```js
import { i as e } from "./vendor/rolldown-runtime.js";
import { Nr as n, jr as r } from "./vendor/vendor.js";
var React = e(n(), 1);      // 调用 wrapper + unwrap
var ReactDOM = e(r(), 1);
```

---

## 产物 chunk 结构（第九轮）

| Chunk | 大小 | 来源 |
|-------|------|------|
| `main-*.js` | 776 字节 | Vite 自动生成的 HTML 入口 wrapper（仅 modulepreload polyfill + import engine + import vendor-legacy），**不再包含任何业务代码** |
| `engine-*.js` | 1.1 MB | `src/App.js`（manualChunks） + entry.js（唯一解包点 + 渲染启动） |
| `vendor-legacy-*.js` | 1.7 MB | `src/vendor/` + `@xyflow/` |

**加载顺序**：`index.html` → main chunk（polyfill）→ engine chunk + vendor-legacy chunk 并行加载。由于 engine import vendor-legacy，vendor-legacy 先于 engine 执行。

---

## 历轮方案

### 第五轮（原始状态）
- 三个文件各自 `import { Nr } from vendor.js` 并直接当 React 对象用
- 结果：`Class extends value undefined`（Nr 是 wrapper 函数，没有 .Component）

### 第六轮：各自解包
- 三个文件各自 `import unwrapModule` + `unwrapModule(VendorReact(), 1)` 解包
- 结果：大量双实例错误

### 第七轮：统一解包 + window（main.tsx 做解包）
- main.tsx 解包 → 挂 `window.__React`，entry.js / ErrorBoundary / react-bridge 从 window 取
- 结果：**时序错误** — engine chunk 先执行，entry.js 读 `window.__React` 时为 `undefined`

### 第八轮：解包移到 engine chunk（entry.js）
- entry.js 作为唯一解包点，挂 window
- main.tsx 从 window 取 React
- 结果：构建成功但运行时仍报 `Cannot read properties of undefined (reading 'Component')`，怀疑 main chunk 中 `import vendor-legacy` 干扰

### 第九轮（当前）：合并 main.tsx → entry.js

**改动**：

| 文件 | 改动 |
|------|------|
| `index.html` | `<script src="/src/main.tsx">` → `<script src="/src/entry.js">` |
| `src/entry.js` | 注释更新，逻辑不变（已经是完整入口：解包 React → 挂 window → 动态 import App → createRoot → render） |
| `src/main.tsx` | **已删除**（清空注释 + 删除文件，不再被任何地方引用） |
| `src/react-bridge.ts` | 注释更新：明确 React 由 `entry.js` 解包（原注释误写 `main.tsx`） |
| `vite.config.ts` | 未改动 |

**效果**：
- `main.tsx` 中的重复逻辑（ResizeObserver 抑制、App lazy import、createRoot）已随文件删除而移除
- `entry.js` 作为唯一入口，包含完整的解包→渲染流程
- 消除了 main chunk 中可能的 React 引用来源（实际产物已不含 main.tsx 业务代码，仅 `index.html` → entry/engine/vendor-legacy 三 chunk 并行）

---

## 待验证

运行时是否仍有 `Cannot read properties of undefined (reading 'Component')` 错误。

## 下一步方向（如仍有问题）

1. **终极方案**：vendor.js 在 `index.html` 通过 `<script>` 标签提前加载，所有代码从 `window.__React` 取，彻底绕过 Rollup 模块系统。
2. 检查 vendor-legacy 模块是否有副作用覆盖 `window.__React`。
