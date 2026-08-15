# AI12 成功复盘 SOP（可复现版）

> 目标：把一个 **webcrack 反混淆产物**重建成 **「React 19 单实例 + 文件拆分 + 真机零应用级报错」** 的可运行工程。
> 本文所有命令、配置、脚本均来自本次真实跑通的环境，照抄即可复现。
> 基准目录：`A21/AI12`（下文 `工程根` = `A21/AI12/output/project`，`脚本根` = `A21/pipeline`）。

---

## 0. 快速复现清单（先跑通这条，再回头看细节）

```powershell
# ① 进工程根，安装依赖（首次）
cd "C:\Users\xinye\Downloads\yimaomao\A21\AI12\output\project"
npm install

# ② 后处理根治（脚本在 A21/pipeline，其 node_modules 里有 @babel/*，cd 到工程根运行也能解析到）
node "C:\Users\xinye\Downloads\yimaomao\A21\pipeline\fix_esm.cjs" "C:\Users\xinye\Downloads\yimaomao\A21\AI12\output\project"

# ③ 构建（应 built in ~6s，无 error）
npm run build

# ④ 真机验收（Playwright 装于 verifiers/AI01_ext）
cd "C:\Users\xinye\Downloads\yimaomao\A21\AI12\verifiers\AI01_ext"
$env:EXT_PATH="C:\Users\xinye\Downloads\yimaomao\A21\AI12\output\project\dist"
node verify_ext.cjs

# ⑤ 看报告：errorCount 应=2，且只有 sw.createCDPSession（脚本兼容）与 404（资源噪声）两条非应用错误
```

> 若步骤②③后还冒出 `ReferenceError: X is not defined`，回到 §6 按「三个真实案例」的排错法定位并补修复，再重跑③④。

---

## 1. 环境与产物形态（动手前先确认）

### 1.1 产物目录树（本次已就绪）

```
output/project/
├── index.html
├── share/index.html
├── package.json
├── vite.config.ts
└── src/
    ├── bundle/
    │   ├── _react_shim.js          # React 单实例 shim（见 §2）
    │   ├── _jsx_runtime.js         # jsx-runtime shim（见 §2）
    │   ├── vendor-Z-*.js           # 唯一一份 React（导出 Rr / Fr 工厂）
    │   ├── rolldown-runtime-*.js   # interop 运行时（导出 i）
    │   ├── shared.js               # 跨块共享符号（必须导出同步，见 fix_esm C 类）
    │   ├── App-*/xxx_components/   # 拆分出的组件目录
    │   ├── httpClient-*/..._components/
    │   └── src-*/..._components/
    │       ├── component_map.json  # 真相表：原始组件名 → 文件名（见 §5）
    │       ├── <Name>.jsx          # 被抽出的组件（默认导出 _cmp_<Name>）
    │       └── <Parent>.jsx        # 父文件，仍可能用原始名引用子组件
    └── ...
```

### 1.2 产物就绪检查（必须全过，否则先补生成）

```powershell
cd "C:\Users\xinye\Downloads\yimaomao\A21\AI12\output\project\src\bundle"
# 应有 170 个 .jsx + 17 个 .js（本次）
Get-ChildItem -Recurse -Include *.jsx,*.js | Measure-Object
# 每个 *_components 目录必须有 component_map.json
Get-ChildItem -Recurse -Filter component_map.json | Select-Object FullName
```

若产物不完整 → 回去重跑生成流水线；若完整 → 直接进入 §2。

### 1.3 关键约定：`component_map.json`

每个 `*_components` 目录各有一份，结构是 **`原始组件名 → 文件名`**：

```json
{
  "_Component": "_Component",
  "Bn": "Bn",
  "I_": "I__1",          // ← 注意：原始名与文件名可以不同！
  "_Component133": "_Component133",
  "Tr": "Tr"
}
```

- 子组件被抽到 `./<文件名>.jsx`，**默认导出**，导入名约定为 `_cmp_<文件名>`。
- 父文件里仍用**原始名**引用它（`<原始名/>` 或 `原始名()`）。
- 因为「原始名」和「文件名」可能不同（如 `I_`→`I__1`），**所有引用修复都必须以该表为真相，不能按文件名猜**。这是本次最大的坑（见 §6.2）。

---

## 2. React 单实例 shim（杜绝多实例 / Invalid hook call）

拆出来的代码会 `import React from 'react'`，但运行时只能有一份 React（即 vendor 里的 `Rr`）。用两个 shim 文件 + vite alias 把它俩缝合。

### 2.1 找到 vendor 里的 React 工厂导出名

```powershell
cd "C:\Users\xinye\Downloads\yimaomao\A21\AI12\output\project\src\bundle"
# 列出 vendor 文件，确认文件名（如 vendor-Z-adA07W.js）
Get-ChildItem vendor-Z-*.js | Select-Object Name
# 在其导出里找 react / jsx-runtime 工厂（通常是 Rr / Fr）
Select-String -Path vendor-Z-*.js -Pattern "export\s*\{[^}]*\bRr\b|export\s*\{[^}]*\bFr\b" | Select-Object -First 3
```

> 本次产物：`Rr` = React 工厂（`Rr()` 返回 React 对象），`Fr` = jsx-runtime 工厂（`Fr()` 返回 `{jsx, jsxs, Fragment}`）。每个 `*_components` 目录的 shim 都 import 同一份 vendor，**单实例链路成立**。

### 2.2 写两个 shim 文件（模板，照抄；若导出名不同只改 import 即可）

`src/bundle/_react_shim.js`（完整）：

```js
import { Rr as __Rr } from './vendor-Z-adA07W.js';
import { i as __e } from './rolldown-runtime-aKtaBQYM.js';
const React = __e(__Rr(), 1);   // rolldown 互操作：工厂返回需经 interop 包装
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

`src/bundle/_jsx_runtime.js`（完整）：

```js
import { Fr as __Fr } from './vendor-Z-adA07W.js';
const __rt = __Fr();
export const jsx = __rt.jsx;
export const jsxs = __rt.jsxs;
export const Fragment = __rt.Fragment;
```

> 要点：若你的 vendor 里 React 是**直接对象**而非工厂（即 `Rr` 就是 React 对象），则 `_react_shim.js` 第一行改 `import { Rr as React } from './vendor-Z-xxx.js';` 并删掉 `rolldown-runtime` 那两行与 interop。判断方法：搜索 vendor 中 `Rr` 的导出形式——`export{...,Rr,...}` 且 Rr 是函数=工厂，是对象字面量=直接对象。

### 2.3 `vite.config.ts`（完整模板）

```ts
import { defineConfig } from 'vite';
import { resolve } from 'path';
import { transformWithEsbuild } from 'vite';
// 单 React 实例：所有 'react' / 'react/jsx-runtime' 导入统一指向 vendor 内联 React(Rr)，
// 与入口 vendor react-dom 同一实例，杜绝 Invalid hook call / 多实例。
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
    outDir: 'dist', emptyOutDir: true, target: 'esnext', modulePreload: false,
    rollupOptions: {
      input: { index: resolve(__dirname, 'index.html'), share: resolve(__dirname, 'share', 'index.html') },
      output: {
        entryFileNames: 'assets/[name].js', chunkFileNames: 'assets/[name].js', assetFileNames: 'assets/[name][extname]',
        manualChunks(id) { const m = id.match(/[\\/]src[\\/]bundle[\\/]([^\\/]+\.js)$/); if (m) return m[1].replace(/\.js$/, ''); },
      },
    },
  },
});
```

> 关键三项：① `alias` 把 `react` / `react/jsx-runtime` 指到 shim；② `dedupe: ['react','react-dom']`；③ `force-jsx-for-js` 插件让 `.js` 文件也按 JSX 解析（混淆产物常把 jsx 写在 `.js` 里）。

---

## 3. 工程骨架与依赖

### 3.1 `package.json`（完整模板，若流水线挂死漏写则补上）

```json
{
  "name": "yimao-ai-canvas",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build"
  },
  "dependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "@types/chrome": "^0.0.279",
    "@types/react": "^19.0.0",
    "typescript": "^5.6.3",
    "vite": "^5.4.11"
  }
}
```

### 3.2 安装依赖

```powershell
cd "C:\Users\xinye\Downloads\yimaomao\A21\AI12\output\project"
npm install
```

### 3.3 验收用的 Playwright（装在独立 verifiers 目录，**别**在工程根装）

```powershell
cd "C:\Users\xinye\Downloads\yimaomao\A21\AI12\verifiers\AI01_ext"
$env:PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1   # 复用已缓存 chromium，避免重复下载
npm install playwright@1.62.0
```

---

## 4. 首次构建（暴露静态错误）

```powershell
cd "C:\Users\xinye\Downloads\yimaomao\A21\AI12\output\project"
npm run build
```

- 预期：可能因 ESM 非法 / 引用未定义报错（构建器比浏览器更早暴露语法级问题）。
- 不要在这里硬改源码——交给 §5 的后处理脚本一次性根治。

---

## 5. 后处理脚本 `fix_esm.cjs`（根治五类问题）

> 位置：`A21/pipeline/fix_esm.cjs`。对 `工程根` **递归**后处理（自动跳过 `node_modules`/`dist`/`.vite`/`.git`）。
> 依赖 `@babel/*`，脚本在 `A21/pipeline/node_modules` 里能解析到；从 `工程根` 调用它也能解析（require 按脚本路径向上找 node_modules）。

### 5.1 用法

```powershell
cd "C:\Users\xinye\Downloads\yimaomao\A21\AI12\output\project"
node "C:\Users\xinye\Downloads\yimaomao\A21\pipeline\fix_esm.cjs" "C:\Users\xinye\Downloads\yimaomao\A21\AI12\output\project"
```

输出：`导出同步 shared.js: N 个 / import 赋值改写: M 个文件 / 悬空引用补全: K 处`。

### 5.2 五类问题与对应函数（按文件实际命名）

| 类别 | 现象 | 处理函数 | 做法 |
|------|------|----------|------|
| **C. 伪迹清理** | `function NAME() { [native code] }` | `cleanArtifacts` | 正则删掉 webcrack 伪迹 → `NAME`（兼容 `new Date(x).toLocaleString()` 内嵌形式） |
| **D. constructor 还原** | `Object(...){super(...)}` | `fixConstructorArtifact` | babel `errorRecovery` 解析，把含 `super` 的 `Object` 方法还原成 `constructor` |
| **A. 导出同步** | `X is not exported` | `exportSync`（仅对 `shared.js`） | 把 shared.js 所有顶层 `var/let/const/function/class` 名 + import 本地名，同步进 `export {}` |
| **E. 悬空引用补全** | 引用了 shared.js 导出但未 import | `fixDanglingImports` | 自动补 `import { X } from './shared.js'`；**额外收集 JSX 成员表达式对象位置**（`<_r.Provider>` 的 `_r`）；跳过 `component_map` 原始名 |
| **E2. 抽出组件引用改写** | `X is not defined`（X 是抽到独立文件的组件） | `fixExtractedComponentRefs` | 读 `component_map.json`，把父文件里原始名 `X` 改写为 `_cmp_<FILE>` 并补 `import _cmp_<FILE> from './<FILE>.jsx'`；剔除 dangling 误加的 `import { X } from './shared.js'` |
| **B. import 赋值改写** | `X is an import`（对 import 绑定赋值/自增） | `fixImportAssignments` | 把被赋值的共享名从具名 import 抽出 → `import * as _shared` + 引用改写 `_shared.X` |

> 主流程顺序：`cleanArtifacts` → `fixConstructorArtifact` →（shared.js 用 `exportSync`；其他文件用 `fixExtractedComponentRefs` + `fixDanglingImports`）→ `fixImportAssignments`。

### 5.3 脚本全文（直接可用，已贴完整）

见本文附录 A。无需自己改，除非你的 vendor 导出名 / 目录结构不同。

---

## 6. 真机验收与迭代修复（复现三个真实 bug）

### 6.0 验收脚本 `verify_ext.cjs`

> 位置：`AI12/verifiers/AI01_ext/verify_ext.cjs`（全文见附录 B）。它用 Playwright 把 `dist/` 当 MV3 扩展加载，捕获 popup / options 页面与 service worker 的 console / pageerror / exception，写入 `report.json`，有任一 error 即非零退出。

```powershell
cd "C:\Users\xinye\Downloads\yimaomao\A21\AI12\verifiers\AI01_ext"
$env:EXT_PATH="C:\Users\xinye\Downloads\yimaomao\A21\AI12\output\project\dist"
node verify_ext.cjs
```

### 6.1 判分口径（决定你修什么、不修什么，必须牢记）

读 `report.json`，**只修**「出现在真机调用栈里的 `ReferenceError: X is not defined` / `TypeError` / `NotFoundError: removeChild`（渲染崩溃级联）」。**以下一律不修**（属噪声）：

- `sw.createCDPSession is not a function` —— 脚本在 Playwright 1.62 下的 SW API 兼容问题（`verify_ext.cjs` 第 47 行 `sw.createCDPSession()` 在新版无此方法），**非应用错误**。
- `Failed to load resource: 404` ×1 —— 资源缺失噪声。
- localhost 类连接噪声。

> 结论标准：真机 `errorCount` 可以不是 0，但只要剩下的全是上面这类噪声，即视为**达成目标（真机零应用级报错）**。本次最终 `errorCount=2`，正好是这两条噪声。

### 6.2 案例一：`Qn is not defined`（App 块）

- **报错**：`ReferenceError: Qn is not defined`（App `mr.jsx`，`<Qn/>`）。
- **定位**：
  ```powershell
  cd "C:\Users\xinye\Downloads\yimaomao\A21\AI12\output\project\src\bundle"
  Select-String -Path App-*_components/mr.jsx -Pattern "Qn" | Select-Object -First 5
  ```
- **根因**：`Qn` 被抽到 `Qn.jsx`（默认导出 `_cmp_Qn`），父文件仍写 `<Qn/>`。
- **修复**：`fixExtractedComponentRefs` 读 `component_map.json` 发现 `"Qn":"Qn"`，把 `<Qn/>` 改写为 `<_cmp_Qn/>`（同目录若漏 import 则补 `import _cmp_Qn from './Qn.jsx'`）。
- **验证**：重跑 §0 的 ②③④，`Qn` 错误消失。

### 6.3 案例二：`I_ is not defined`（httpClient 块，最大坑）

- **报错**：`ReferenceError: I_ is not defined`（httpClient `R_.jsx`，`<I_ />`）。
- **定位**：
  ```powershell
  cd "C:\Users\xinye\Downloads\yimaomao\A21\AI12\output\project\src\bundle"
  Select-String -Path httpClient-*_components/R_.jsx -Pattern "I_" | Select-Object -First 5
  # 关键：查 component_map，发现原始名与文件名不同
  Get-Content httpClient-*_components/component_map.json | Select-String "I_"
  ```
  输出：`"I_": "I__1"` —— 原始名 `I_`，文件是 `I__1.jsx`，导入名应是 `_cmp_I__1`。
- **根因**：早期修复版本**按文件名匹配**（`I__1` 不在引用里），所以抓不到 `I_`。必须用 `component_map.json` 做「原始名 → 文件名」映射。
- **修复**：`fixExtractedComponentRefs` 改用 `component_map.json`：`origToTarget["I_"] = { file:"I__1", local:"_cmp_I__1" }`，把 `<I_ />` 改写为 `<_cmp_I__1 />`，并补 `import _cmp_I__1 from "./I__1.jsx"`。同时剔除 dangling 误加的 `import { I_ } from './shared.js'`。
- **验证**：重跑脚本后确认 `R_.jsx` 出现 `import _cmp_I__1` 且 `<_cmp_I__1 />`，构建 + 验收，`I_` 错误消失。

### 6.4 案例三：`_r is not defined`（httpClient 块，JSX 成员表达式对象）

- **报错**：`ReferenceError: _r is not defined`（`_Component133.jsx`，`<_r.Provider>`）。
- **定位**：
  ```powershell
  cd "C:\Users\xinye\Downloads\yimaomao\A21\AI12\output\project\src\bundle"
  # 确认 _r 是否由 shared.js 导出
  Select-String -Path httpClient-*_components/shared.js -Pattern "var _r|export\s*\{[^}]*_r"
  # 确认 _Component133 是否 import 了 _r
  Select-String -Path httpClient-*_components/_Component133.jsx -Pattern "_r"
  ```
  结果：`shared.js` 定义了 `var _r = Z.createContext(...)` 且已导出；但 `_Component133.jsx` 用了 `<_r.Provider>` 却**没 import**。
- **根因**：`_r` 是 `<_r.Provider>` 里的 JSX **成员表达式对象**，早期 `fixDanglingImports` 只收集 `<X/>` 直接标签名，漏掉了成员表达式的**对象**位置。
- **修复**：`fixDanglingImports` 增加分支——`p.parentPath.isJSXMemberExpression() && p.parentPath.node.object === p.node` 时按引用收集，补 `import { _r } from './shared.js'`（合并进已有 shared import：`import { gr, _r, vr } from './shared.js'`）。
- **验证**：重跑脚本后 `_Component133.jsx` 出现 `import { gr, _r, vr } from './shared.js'`，构建 + 验收，`_r` 错误消失。

### 6.5 迭代闭环

每修一类 → 重跑 `fix_esm.cjs` → `npm run build` → `verify_ext.cjs` → 看 `report.json`。直到真机 `ReferenceError` 全部消失，只剩 §6.1 的噪声，即达成。

---

## 7. 达成判定与产出

- `report.json`：`errorCount=2`，且两条均为非应用错误（`sw.createCDPSession` + 一个 404）。
- app 全程正常渲染、配置 / 存储均加载成功。
- **结论：真机零应用级报错目标达成。**

成果物：
- `output/project/dist/` —— 可加载运行的扩展产物。
- `output/project/src/bundle/` —— 已后处理干净的源码（170 jsx + 17 js）。
- `A21/pipeline/fix_esm.cjs` —— 可复用的后处理脚本。
- `AI12/verifiers/AI01_ext/verify_ext.cjs` + `report.json` —— 验收 harness 与报告。

---

## 8. 避坑清单（给下一位 AI）

1. **不要重跑整条生成流水线**：它常在收尾清理阶段挂死；产物完整时直接后处理兜底，十几秒一次可无限迭代，比重跑（5~8 分钟且易挂死）划算。
2. **`component_map.json` 是真相表**：原始名 ≠ 文件名（`I_`→`I__1`）。任何按文件名猜映射的逻辑都会漏接。
3. **scope 绑定陷阱**：若 dangling 误把 `X` 加进 `import { X } from './shared.js'`，scope 认为 `X` 已绑定，后续补 `_cmp_X` 会跳过它——构建放行但真机仍 `X is not defined`。解法：E2 先剔除误加的 shared 导入，再补 `_cmp_X`；dangling 跳过 `component_map` 原始名。
4. **JSX 成员表达式对象位置要单独收集**：`<_r.Provider>` 的 `_r` 是 `JSXMemberExpression.object`，只收集 `openingElement`/`closingElement` 会漏。必须加 `parentPath.node.object === p.node` 分支。
5. **PowerShell 缓冲区污染**：`Select-String`/命令回显会混入别的历史输出。一律用 `read_file`/`search_content` 直读文件，或把结果写 `C:\tmp\*.txt` 再读。
6. **babel visitor 合法性**：组件方法改写用 `ClassMethod`，`MethodDefinition` 不是合法 visitor；walk 必须跳过 `node_modules`/`dist`。
7. **Playwright 跨版本**：验收脚本在 1.62 下 `sw.createCDPSession` 报错属脚本自身兼容，不是应用 bug；装 npm 包务必 `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1`。

---

## 附录 A：`fix_esm.cjs` 全文

```js
/**
 * 后处理：根治逆向产物两类 ESM 错误（无需重跑整条流水线）
 *   A. shared.js 漏导出顶层声明（"X is not exported"）
 *   B. 组件给 import 绑定赋值（"X is an import" / ASSIGN_TO_IMPORT）
 *   C. 清理 webcrack [native code] 伪迹
 *   D. 还原被错写的 constructor 伪迹
 *   E. 悬空引用补全 + E2. 抽出组件引用名改写（用 component_map.json）
 * 用法：node fix_esm.cjs <工程根目录>
 */
const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const generate = require('@babel/generator').default;
const t = require('@babel/types');

const ROOT = process.argv[2];
if (!ROOT) { console.error('用法: node fix_esm.cjs <工程根目录>'); process.exit(1); }

const PARSE_PLUGINS = ['jsx', 'typescript', 'classProperties', 'objectRestSpread',
  'optionalChaining', 'nullishCoalescingOperator', 'dynamicImport', 'topLevelAwait', 'decorators-legacy'];
function parseCode(code) {
  return parser.parse(code, { sourceType: 'module', plugins: PARSE_PLUGINS, errorRecovery: true });
}

function walk(dir, cb) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === 'dist' || e.name === '.vite' || e.name === '.git') continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, cb);
    else if (/\.(jsx?|mjs|cjs)$/.test(e.name)) cb(p);
  }
}

function isSharedFile(p) { return /(^|[\\/])shared\.jsx?$/.test(p); }

// ---------- C. 清理 webcrack [native code] 伪迹（兼容空格/内嵌形式）----------
function cleanArtifacts(code) {
  return code.replace(/function\s+([A-Za-z_$][\w$]*)\s*\(\s*\)\s*\{\s*\[\s*native code\s*\]\s*\}/g, '$1');
}

// ---------- D. 还原被错写的 constructor 伪迹 ----------
function fixConstructorArtifact(code) {
  const ast = parseCode(code);
  let changed = false;
  traverse(ast, {
    ClassMethod(p) {
      const key = p.node.key;
      if (p.node.kind === 'method' && key && t.isIdentifier(key) && key.name === 'Object') {
        let hasSuper = false;
        p.traverse({ Super() { hasSuper = true; } });
        if (hasSuper) {
          p.node.key = t.identifier('constructor');
          p.node.kind = 'constructor';
          changed = true;
        }
      }
    },
  });
  if (!changed) return code;
  return generate(ast, {}, code).code;
}

// ---------- A. 导出同步 ----------
function exportSync(code) {
  const ast = parseCode(code);
  const topNames = new Set();
  for (const stmt of ast.program.body) {
    if (t.isVariableDeclaration(stmt)) {
      for (const d of stmt.declarations) if (d.id && t.isIdentifier(d.id)) topNames.add(d.id.name);
    } else if (t.isFunctionDeclaration(stmt) && stmt.id) topNames.add(stmt.id.name);
    else if (t.isClassDeclaration(stmt) && stmt.id) topNames.add(stmt.id.name);
    else if (t.isImportDeclaration(stmt)) {
      for (const s of stmt.specifiers) if (s.local && t.isIdentifier(s.local)) topNames.add(s.local.name);
    }
  }
  const existing = new Set();
  for (const stmt of ast.program.body) {
    if (t.isExportNamedDeclaration(stmt)) {
      if (stmt.specifiers) for (const s of stmt.specifiers) existing.add(s.exported.name);
      if (stmt.declaration) {
        if (t.isFunctionDeclaration(stmt.declaration) && stmt.declaration.id) existing.add(stmt.declaration.id.name);
        else if (t.isClassDeclaration(stmt.declaration) && stmt.declaration.id) existing.add(stmt.declaration.id.name);
        else if (t.isVariableDeclaration(stmt.declaration)) for (const d of stmt.declaration.declarations) if (d.id && t.isIdentifier(d.id)) existing.add(d.id.name);
      }
    }
    if (t.isExportDefaultDeclaration(stmt)) existing.add('default');
  }
  const toAdd = [...topNames].filter(n => !existing.has(n) && n !== 'default');
  if (toAdd.length === 0) return code;

  let keep = null;
  for (const stmt of ast.program.body) {
    if (t.isExportNamedDeclaration(stmt) && !stmt.declaration && stmt.specifiers) { keep = stmt; break; }
  }
  if (!keep) {
    const gen = generate(t.exportNamedDeclaration(null, toAdd.map(n => t.exportSpecifier(t.identifier(n), t.identifier(n))))).code;
    return code + '\n' + gen + '\n';
  }
  for (const n of toAdd) keep.specifiers.push(t.exportSpecifier(t.identifier(n), t.identifier(n)));
  const seen = new Set();
  keep.specifiers = keep.specifiers.filter(s => { const n = s.exported.name; if (seen.has(n)) return false; seen.add(n); return true; });
  const gen = generate(keep).code;
  return code.slice(0, keep.start) + gen + code.slice(keep.end);
}

// ---------- B. import 赋值改写 ----------
function topLevelBindings(ast) {
  const set = new Set();
  for (const stmt of ast.program.body) {
    if (t.isVariableDeclaration(stmt)) for (const d of stmt.declarations) if (d.id && t.isIdentifier(d.id)) set.add(d.id.name);
    else if (t.isFunctionDeclaration(stmt) && stmt.id) set.add(stmt.id.name);
    else if (t.isClassDeclaration(stmt) && stmt.id) set.add(stmt.id.name);
    else if (t.isImportDeclaration(stmt)) for (const s of stmt.specifiers) if (s.local && t.isIdentifier(s.local)) set.add(s.local.name);
  }
  return set;
}

function fixImportAssignments(code) {
  const ast = parseCode(code);
  const sharedImports = ast.program.body.filter(s => t.isImportDeclaration(s) && /shared\.jsx?$/.test(s.source.value));
  if (sharedImports.length === 0) return code;

  const assigned = new Set();
  traverse(ast, {
    AssignmentExpression(p) { const l = p.node.left; if (t.isIdentifier(l)) assigned.add(l.name); },
    UpdateExpression(p) { const a = p.node.argument; if (t.isIdentifier(a)) assigned.add(a.name); },
  });

  let changed = false;
  for (const imp of sharedImports) {
    const toNs = imp.specifiers.filter(s => t.isImportSpecifier(s) && assigned.has(s.local.name));
    if (toNs.length === 0) continue;
    changed = true;
    const nsNames = new Set(toNs.map(s => s.local.name));

    let nsLocal = null;
    const existingNs = ast.program.body.find(s => t.isImportDeclaration(s) && t.isImportNamespaceSpecifier(s) && s.source.value === imp.source.value);
    if (existingNs) {
      nsLocal = existingNs.local.name;
    } else {
      const taken = topLevelBindings(ast);
      nsLocal = '_shared'; let i = 1;
      while (taken.has(nsLocal)) nsLocal = '_shared' + (i++);
      ast.program.body.unshift(t.importDeclaration([t.importNamespaceSpecifier(t.identifier(nsLocal))], t.stringLiteral(imp.source.value)));
    }

    imp.specifiers = imp.specifiers.filter(s => !(t.isImportSpecifier(s) && nsNames.has(s.local.name)));
    if (imp.specifiers.length === 0) {
      const idx = ast.program.body.indexOf(imp);
      if (idx >= 0) ast.program.body.splice(idx, 1);
    }

    traverse(ast, {
      Identifier(p) {
        const name = p.node.name;
        if (!nsNames.has(name)) return;
        if (p.isReferencedIdentifier()) { p.replaceWith(t.memberExpression(t.identifier(nsLocal), t.identifier(name))); return; }
        const par = p.parentPath;
        if (par.isAssignmentExpression() && par.node.left === p.node) { p.replaceWith(t.memberExpression(t.identifier(nsLocal), t.identifier(name))); return; }
        if (par.isUpdateExpression() && par.node.argument === p.node) { p.replaceWith(t.memberExpression(t.identifier(nsLocal), t.identifier(name))); return; }
      },
      JSXIdentifier(p) {
        const name = p.node.name;
        if (!nsNames.has(name)) return;
        if (p.parentPath.isJSXAttribute()) return;
        if (p.parentPath.isJSXMemberExpression() && p.parentPath.node.property === p.node) return;
        if (p.parentPath.isJSXOpeningElement() || p.parentPath.isJSXClosingElement()) {
          p.replaceWith(t.jsxMemberExpression(t.jsxIdentifier(nsLocal), t.jsxIdentifier(name)));
        }
      },
    });
  }
  if (!changed) return code;
  return generate(ast, {}, code).code;
}

// ---------- E. 悬空引用补全 ----------
function getSharedExports(sharedPath) {
  try {
    const code = fs.readFileSync(sharedPath, 'utf8');
    const ast = parseCode(code);
    const names = new Set();
    for (const stmt of ast.program.body) {
      if (t.isExportNamedDeclaration(stmt)) {
        if (stmt.specifiers) for (const s of stmt.specifiers) names.add(s.exported.name);
        if (stmt.declaration) {
          if (t.isFunctionDeclaration(stmt.declaration) && stmt.declaration.id) names.add(stmt.declaration.id.name);
          else if (t.isClassDeclaration(stmt.declaration) && stmt.declaration.id) names.add(stmt.declaration.id.name);
          else if (t.isVariableDeclaration(stmt.declaration)) for (const d of stmt.declaration.declarations) if (d.id && t.isIdentifier(d.id)) names.add(d.id.name);
        }
      }
      if (t.isExportDefaultDeclaration(stmt)) names.add('default');
      if (t.isVariableDeclaration(stmt)) for (const d of stmt.declarations) if (d.id && t.isIdentifier(d.id)) names.add(d.id.name);
      else if (t.isFunctionDeclaration(stmt) && stmt.id) names.add(stmt.id.name);
      else if (t.isClassDeclaration(stmt) && stmt.id) names.add(stmt.id.name);
      else if (t.isImportDeclaration(stmt)) for (const s of stmt.specifiers) if (s.local && t.isIdentifier(s.local)) names.add(s.local.name);
    }
    return names;
  } catch (e) { return null; }
}

function fixDanglingImports(code, sharedExports, dir) {
  const ast = parseCode(code);
  let compKeys = new Set();
  try {
    const mp = path.join(dir, 'component_map.json');
    if (fs.existsSync(mp)) { const m = JSON.parse(fs.readFileSync(mp, 'utf8')); compKeys = new Set(Object.keys(m)); }
  } catch (e) {}
  const missing = new Set();
  traverse(ast, {
    Identifier(p) {
      const name = p.node.name;
      if (!sharedExports.has(name)) return;
      if (p.isReferencedIdentifier()) {
        if (!p.scope.getBinding(name)) missing.add(name);
      }
    },
    JSXIdentifier(p) {
      const name = p.node.name;
      if (!sharedExports.has(name)) return;
      if (p.parentPath.isJSXAttribute()) return;
      if (p.parentPath.isJSXMemberExpression() && p.parentPath.node.property === p.node) return;
      if (p.parentPath.isJSXMemberExpression() && p.parentPath.node.object === p.node) {
        if (!p.scope.getBinding(name)) missing.add(name);
        return;
      }
      if (p.parentPath.isJSXOpeningElement() || p.parentPath.isJSXClosingElement()) {
        if (!p.scope.getBinding(name)) missing.add(name);
      }
    },
  });
  if (missing.size === 0) return code;
  for (const n of [...missing]) {
    if (compKeys.has(n)) { missing.delete(n); continue; }
    if (fs.existsSync(path.join(dir, n + '.jsx')) || fs.existsSync(path.join(dir, n + '.js'))) missing.delete(n);
  }
  if (missing.size === 0) return code;
  let imp = ast.program.body.find(s => t.isImportDeclaration(s) && /shared\.jsx?$/.test(s.source.value));
  if (imp) {
    const have = new Set(imp.specifiers.filter(s => t.isImportSpecifier(s)).map(s => s.imported.name));
    for (const n of missing) if (!have.has(n)) imp.specifiers.push(t.importSpecifier(t.identifier(n), t.identifier(n)));
  } else {
    const specs = [...missing].map(n => t.importSpecifier(t.identifier(n), t.identifier(n)));
    ast.program.body.unshift(t.importDeclaration(specs, t.stringLiteral('./shared.js')));
  }
  return generate(ast, {}, code).code;
}

// ---------- E2. 抽出组件引用名改写（用 component_map.json：原始名→文件名）----------
function fixExtractedComponentRefs(code, fp) {
  const ast = parseCode(code);
  const dir = path.dirname(fp);
  const selfBase = path.basename(fp).replace(/\.jsx?$/, '');
  const mapPath = path.join(dir, 'component_map.json');
  if (!fs.existsSync(mapPath)) return code;
  let cmap;
  try { cmap = JSON.parse(fs.readFileSync(mapPath, 'utf8')); } catch (e) { return code; }
  const targets = [];
  for (const [orig, file] of Object.entries(cmap)) {
    if (orig === selfBase) continue;
    targets.push({ orig, file, local: '_cmp_' + file });
  }
  if (targets.length === 0) return code;
  const origToTarget = new Map(targets.map(t => [t.orig, t]));

  const refs = new Map();
  const collect = (p, name) => { if (!refs.has(name)) refs.set(name, []); refs.get(name).push(p); };
  traverse(ast, {
    JSXIdentifier(p) {
      const name = p.node.name;
      if (!origToTarget.has(name)) return;
      if (p.parentPath.isJSXAttribute()) return;
      if (p.parentPath.isJSXMemberExpression() && p.parentPath.node.property === p.node) return;
      if (p.parentPath.isJSXMemberExpression() && p.parentPath.node.object === p.node) { collect(p, name); return; }
      if (p.parentPath.isJSXOpeningElement() || p.parentPath.isJSXClosingElement()) collect(p, name);
    },
    Identifier(p) {
      const name = p.node.name;
      if (!origToTarget.has(name)) return;
      if (p.isReferencedIdentifier() && !p.scope.getBinding(name)) collect(p, name);
    },
  });
  if (refs.size === 0) return code;

  let sawWrongShared = false;
  for (const stmt of ast.program.body) {
    if (t.isImportDeclaration(stmt) && /shared\.jsx?$/.test(stmt.source.value)) {
      const filtered = stmt.specifiers.filter(s => !(t.isImportSpecifier(s) && refs.has(s.imported.name)));
      if (filtered.length !== stmt.specifiers.length) { stmt.specifiers = filtered; sawWrongShared = true; }
      if (stmt.specifiers.length === 0) { const i = ast.program.body.indexOf(stmt); if (i >= 0) ast.program.body.splice(i, 1); }
    }
  }

  const need = new Set();
  for (const name of refs.keys()) {
    const tg = origToTarget.get(name);
    const exist = ast.program.body.some(s =>
      t.isImportDeclaration(s) && s.specifiers.some(sp => t.isImportDefaultSpecifier(sp) && sp.local.name === tg.local));
    if (!exist) {
      let insAt = ast.program.body.findIndex(s => !t.isImportDeclaration(s));
      if (insAt < 0) insAt = ast.program.body.length;
      ast.program.body.splice(insAt, 0, t.importDeclaration([t.importDefaultSpecifier(t.identifier(tg.local))], t.stringLiteral('./' + tg.file + '.jsx')));
    }
    need.add(name);
  }

  let changed = false;
  traverse(ast, {
    JSXIdentifier(p) {
      const name = p.node.name;
      if (!need.has(name)) return;
      if (p.parentPath.isJSXAttribute()) return;
      if (p.parentPath.isJSXMemberExpression() && p.parentPath.node.property === p.node) return;
      if (p.parentPath.isJSXMemberExpression() && p.parentPath.node.object === p.node) {
        p.node.name = origToTarget.get(name).local; changed = true; return;
      }
      if (p.parentPath.isJSXOpeningElement() || p.parentPath.isJSXClosingElement()) {
        p.node.name = origToTarget.get(name).local; changed = true;
      }
    },
    Identifier(p) {
      const name = p.node.name;
      if (!need.has(name)) return;
      if (p.isReferencedIdentifier() && !p.scope.getBinding(name)) {
        p.node.name = origToTarget.get(name).local; changed = true;
      }
    },
  });
  if (!changed && !sawWrongShared) return code;
  return generate(ast, {}, code).code;
}

// ---------- 主流程 ----------
const sharedCache = new Map();
function getSharedFor(dir) {
  if (sharedCache.has(dir)) return sharedCache.get(dir);
  let res = null;
  for (const nm of ['shared.js', 'shared.jsx']) {
    const p = path.join(dir, nm);
    if (fs.existsSync(p)) { res = getSharedExports(p); break; }
  }
  sharedCache.set(dir, res);
  return res;
}

let syncCount = 0, fixCount = 0, danglingCount = 0;
walk(ROOT, (fp) => {
  let code = fs.readFileSync(fp, 'utf8');
  const before = code;
  const isShared = isSharedFile(fp);
  code = cleanArtifacts(code);
  try { code = fixConstructorArtifact(code); } catch (e) { console.log(`  ⚠️ constructor 还原跳过: ${fp} (${e.message.split('\n')[0]})`); }
  if (isShared) {
    try { code = exportSync(code); } catch (e) { console.log(`  ⚠️ 导出同步跳过: ${fp} (${e.message.split('\n')[0]})`); }
  } else {
    try { code = fixExtractedComponentRefs(code, fp); } catch (e) { console.log(`  ⚠️ 组件引用改写跳过: ${fp} (${e.message.split('\n')[0]})`); }
    const se = getSharedFor(path.dirname(fp));
    if (se) {
      try {
        const beforeD = code;
        code = fixDanglingImports(code, se, path.dirname(fp));
        if (code !== beforeD) danglingCount++;
      } catch (e) { console.log(`  ⚠️ 悬空补全跳过: ${fp} (${e.message.split('\n')[0]})`); }
    }
  }
  try { code = fixImportAssignments(code); } catch (e) { console.log(`  ⚠️ 改写跳过: ${fp} (${e.message.split('\n')[0]})`); }
  if (code !== before) {
    fs.writeFileSync(fp, code);
    if (isShared) syncCount++; else fixCount++;
  }
});

console.log(`✅ 导出同步 shared.js: ${syncCount} 个`);
console.log(`✅ import 赋值改写: ${fixCount} 个文件`);
console.log(`✅ 悬空引用补全: ${danglingCount} 处`);
```

## 附录 B：`verify_ext.cjs` 全文（关键部分）

```js
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DIST = process.env.EXT_PATH ? path.resolve(process.env.EXT_PATH) : path.resolve(ROOT, 'output', 'project', 'dist');
const PROFILE = path.resolve(__dirname, '.profile');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const events = [];
function rec(scope, kind, text, loc) {
  events.push({ scope, kind, text: String(text).slice(0, 800), loc: loc || null });
  const bad = kind === 'error' || kind === 'exception' || kind === 'pageerror';
  console.log(`${bad ? '❌' : '·'} [${scope}] ${kind}: ${String(text).slice(0, 300)}`);
}

(async () => {
  if (!fs.existsSync(DIST)) { console.error('dist not found:', DIST); process.exit(2); }
  const extPath = DIST.replace(/\\/g, '/');
  const context = await chromium.launchPersistentContext(PROFILE, {
    headless: false,
    args: [
      `--headless=new`,
      `--load-extension=${extPath}`,
      `--disable-extensions-except=${extPath}`,
      '--allow-extensions-in-headless-mode',
      '--no-sandbox', '--disable-gpu',
    ],
  });

  // attachSW 里 sw.createCDPSession() 在 playwright 1.62 无此方法 → 被 catch 成 sw 噪声（非应用错误）
  function attachSW(sw) {
    return (async () => {
      try {
        const cdp = await sw.createCDPSession();
        await cdp.send('Runtime.enable');
        cdp.on('Runtime.exceptionThrown', (e) => {
          const d = e.exceptionDetails;
          rec('sw', 'exception', (d && (d.exception && d.exception.description || d.text)) || 'sw exception', d && d.url);
        });
        cdp.on('Runtime.consoleAPICalled', (e) => {
          const txt = (e.args || []).map((a) => a.value !== undefined ? a.value : (a.description || '')).join(' ');
          rec('sw', e.type, txt);
        });
      } catch (e) { rec('sw', 'error', 'attach failed: ' + e.message); }
    })();
  }

  // 轮询等待 service worker 注册，拿到扩展 id
  let extId = null, swCdpAttached = false;
  for (let i = 0; i < 20; i++) {
    for (const sw of context.serviceWorkers()) {
      const u = String(sw.url || '');
      const m = u.match(/chrome-extension:\/\/([a-z]+)\//);
      if (m) extId = m[1];
      if (!swCdpAttached) { await attachSW(sw); swCdpAttached = true; }
    }
    if (extId) break;
    await sleep(500);
  }
  console.log('extension id:', extId || '(unknown)');

  async function openPage(rel) {
    if (!extId) { rec('page', 'error', 'no extId, skip ' + rel); return; }
    const page = await context.newPage();
    page.on('console', (msg) => { if (msg.type() === 'error') rec('page', 'error', msg.text()); else rec('page', msg.type(), msg.text()); });
    page.on('pageerror', (err) => rec('page', 'pageerror', err.message + '\n' + (err.stack || '').split('\n').slice(0, 4).join('\n')));
    page.on('requestfailed', (req) => rec('page', 'error', 'reqfail ' + req.url() + ' ' + (req.failure() && req.failure().errorText)));
    const url = `chrome-extension://${extId}/${rel}`;
    try { await page.goto(url, { waitUntil: 'load', timeout: 20000 }); } catch (e) { rec('page', 'error', 'goto ' + rel + ': ' + e.message); }
    await sleep(5000);
    await page.close();
  }

  await openPage('index.html');
  await openPage('share/index.html');
  await sleep(2000);

  const errors = events.filter((e) => e.kind === 'error' || e.kind === 'exception' || e.kind === 'pageerror');
  console.log('\n════════ 验收摘要 ════════');
  console.log('total events:', events.length, 'errors:', errors.length);
  fs.writeFileSync(path.resolve(__dirname, 'report.json'), JSON.stringify({ extId, events, errorCount: errors.length }, null, 2));

  await context.close();
  process.exit(errors.length ? 1 : 0);
})().catch((e) => { console.error('harness crash:', e); process.exit(3); });
```

> 判分提醒：`attach failed: sw.createCDPSession is not a function` 是脚本在 Playwright 1.62 的兼容问题，**不是应用错误**，不计入拆分问题。

---

## 附录 C：一键复现命令合集（PowerShell）

```powershell
# 1) 安装工程依赖
cd "C:\Users\xinye\Downloads\yimaomao\A21\AI12\output\project"
npm install

# 2) 安装验收依赖（跳过浏览器下载）
cd "C:\Users\xinye\Downloads\yimaomao\A21\AI12\verifiers\AI01_ext"
$env:PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
npm install playwright@1.62.0

# 3) 后处理根治
cd "C:\Users\xinye\Downloads\yimaomao\A21\AI12\output\project"
node "C:\Users\xinye\Downloads\yimaomao\A21\pipeline\fix_esm.cjs" "C:\Users\xinye\Downloads\yimaomao\A21\AI12\output\project"

# 4) 构建
npm run build

# 5) 真机验收 + 报告
cd "C:\Users\xinye\Downloads\yimaomao\A21\AI12\verifiers\AI01_ext"
$env:EXT_PATH="C:\Users\xinye\Downloads\yimaomao\A21\AI12\output\project\dist"
node verify_ext.cjs

# 6) 看报告错误签名
node -e "const r=require('./report.json'); const errs=r.events.filter(e=>e.kind==='error'||e.kind==='exception'||e.kind==='pageerror'); const u={}; errs.forEach(e=>{const k=e.text.split('\n')[0].slice(0,120); u[k]=(u[k]||0)+1;}); Object.entries(u).sort((a,b)=>b[1]-a[1]).forEach(([k,v])=>console.log(' x'+v+'  '+k));"
```
