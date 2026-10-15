# 踩坑清单（全程对照）

> 整合自实战记录。按主题分类：**现象 / 根因 / 修法**。

---

## 一、基础设施坑（与代码无关，最容易卡住）

| 坑 | 现象 | 修法 |
|---|---|---|
| **webcrack 伪迹** | `function X() { [native code] }` 破坏语法，babel 解析失败 | `00_sanitize.cjs` 通用正则清理 + `clean_project.cjs` 终检；验证：grep 应为 0 |
| **esbuild loader 报错** | `config.esbuild: "loader" must be a string` | 删掉 loader 对象，改 `esbuild: { jsx: 'automatic' }` + `force-jsx-for-js` 插件 |
| **`.js` 里的 JSX 不编译** | import-analysis 拒绝尖括号 | `force-jsx-for-js` 插件强制 jsx loader |
| **`Could not resolve entry "index.html"`** | npm 用了父目录 package.json | 所有 npm/node 命令用 `cwd` 指定目录，**不 `cd`** |
| **Babel 克隆节点作用域错乱** | `getBlockParent` 崩溃 | 先 `generate` 成代码字符串，再重新 `parse` 成干净 AST，别直接克隆后 traverse |
| **中文路径乱码** | 参数被 GBK/UTF-8 错解，报 "Cannot find module" | 用 ASCII 探测脚本，或整个工作区拷到 ASCII 路径 |
| **300s 超时 + 杀后台进程** | 流水线被杀，日志停在"某 chunk 拆分中" | 给 webcrack 加结果缓存 `.wc_cache`，或后台 detached + 轮询 |
| **PowerShell 缓冲区污染** | `Select-String` 混入历史输出 | 用直读文件工具，或把结果写 `C:\tmp\*.txt` 再读 |
| **cmd 包裹跑 node** | PowerShell 把 webcrack stderr 当 `RemoteException` 中断 | `cmd /d /c "node ... > log 2>&1"` 包裹 |

---

## 二、悬空引用类（核心翻车点）

| 坑 | 现象 | 根因 / 修法 |
|---|---|---|
| **`scope.hasBinding` 误杀模块级绑定** | 真机 `Z.forwardRef is not a function` / `Oi is not defined`；生成 N 个 `.jsx` 零 import | 用完整 free-variable 分析：沿作用域链走到 `programScope` 判断是否本地绑定，非本地才入依赖 |
| **别名 import 被吞** | `"We" is not exported by vendor` | `importMap` 同时存 `imported`（真实导出名）与 `local`，生成 `import { REALNAME as We }` |
| **import 来源被 webcrack 改写** | `rolldown-runtime` 被改成 `vendor-Z`，符号不存在 | `run.cjs` 把**原始 chunk** 传给 `02_split.cjs`，原始必须覆盖 webcracked |
| **保留字当变量名** | `Unexpected keyword 'in'` | `RESERVED` 集合 + `sanitizeName()` 加 `_` 前缀，并重写组件内所有引用 |
| **JSX 标签名不被 `Identifier` visitor 遍历** | 真机 `Oi is not defined` | 加 `JSXOpeningElement` visitor 收集标签名与 `JSXMemberExpression` 根名；维护 `INTRINSICS` 集合 |
| **反向悬空引用 + 扫描循环漏 shared.js** | `ReferenceError: Oi is not defined` | 读 `component_map.json` 补兄弟 `.jsx` import；**去掉** `f!=='shared.js'` 排除 |
| **默认导出组件写成具名 import** | 真机 `Qn is not defined` | 导出表区分 `named`/`default`，默认导出生成 `import Qn from './Qn.jsx'` |
| **跨 chunk 同名别名串味** | `Z.forwardRef is not a function` | `findDefiner(name, fromFile)` 优先在同 chunk 内解析 |
| **shared.js 顶层声明没导出** | `X is not exported` | 把 shared.js 的 `topLevelDeclared` 全部 `export` |
| **GLOBALS 漏内置全局** | `AudioBuffer`/`Request`/`WeakRef` 被当悬空引用 | 扩 `GLOBALS` 集合 |
| **具名导出收集误收函数参数** | `Export 'e2' is not defined` | 按语句类型只收顶层声明名；`export const X` 不再补 `export { X }` |
| **import 只读绑定被赋值/自增** | `this._workerTrackId = Wf++` 运行期报错 | 在 shared.js 暴露 `__nextXxx()` mutator，调用方改为函数调用 |
| **门面按本地名取用但 shared 导出别名** | `L_ is not exported` | `02_split` 生成 shared 时丢弃导出别名，门面自己重新 `as ALIAS` |
| **同一本地名被多个别名复用** | `Identifier 'L_' has already been declared` | 跨导出语句全局去重 |
| **内置全局被当模块引用** | `decodeURIComponent is not exported` | `GLOBALS` 补全 decode/encode/escape/unescape/setImmediate 等 |
| **小写 JSX 标签被当组件** | `div is not exported` | JSX 标签名首字母小写直接 return |
| **`renameInAst` 误改 import 标识符** | `"_cmp_Fn" is not exported by vendor` | 遍历时跳过所有 import/export 声明里的标识符 |
| **babel `errorRecovery` 误报** | `e19`/`t4` 等局部变量未绑定 | 属 false positive，真机不会报，别被吓到 |

---

## 三、React 实例类

> 详见 `react-single-instance.md`。

- **多 React 实例 / dispatcher 为 null** → shim + `dedupe` + `manualChunks` 合并 + 删 vendor 子目录副本
- **`document.createElement` 被误抓** → `REACT_APIS` 配合 `GLOBALS` 白名单跳过
- **esbuild 压缩重命名碰撞**（`n.getElementById is not a function`）→ `minify: false`
- **React 19 对齐** → `package.json` 锁 `react/react-dom ^19` + `@types/react ^19`，`vite.config` 用 `jsx:'automatic'`

---

## 四、验证类（唯一真相是真机）

- **静态脚本假绿**：`verify-split.mjs`/`verify-dist.mjs`/任何"数文件数/grep import"的脚本都会假绿，9 个产物绿了真机全挂。**唯一真相 = 真机 Chromium 加载 + 捕获 console/pageerror/service-worker 异常**。
- **光打开 index.html 不够**：动态 chunk 没被 import 时页面也能"绿"。要对每个 chunk 逐一 `await import()` 确认顶层执行零报错。
- **`ERR_CONNECTION_REFUSED` ≠ `ReferenceError`**：前者是资源/网络/CORS 问题，后者才是拆分漏 import。
- **分析器 `unresolved` 列表 90% 是误报**：只有确实出现在真机调用栈里的符号才需要修。
- **Playwright 要点**：
  - `--headless=new --allow-extensions-in-headless-mode`（默认 headless 扩展不加载）
  - `--load-extension` 路径必须**正斜杠 + ASCII**（中文路径 Chrome 静默忽略）→ 用 junction 到 `C:\ym_ext`
  - `context.serviceWorkers()` 的 `sw.url` 要用 `String(sw.url)` 再正则取扩展 id
  - 用 `await new Promise(r=>setTimeout(r,ms))` 代替 `context.waitForTimeout`
  - 加 watchdog 防挂死
- **网络噪声过滤**：`isNoise()` 过滤 `/Failed to load resource|net::ERR|127\.0\.0\.1|localhost|favicon|status of 4\d\d|5\d\d/`，但**别把 `X is not defined` 真错也滤掉**。
- **抓错要打 pageerror stack**：`e.message + '\n' + (e.stack||'')`，否则定位不到文件。

---

## 五、约束 / 口径类

- **500KB 阈值看 SOURCE 不是 BUNDLE**：指 `src/bundle/**` 的单个源码文件；`dist/` 里 vendor chunk（~1.6MB）超 500KB 只是体积警告，**别为消警告合并源码**。
- **不要为了快而回退成单文件大模块**：保持拆分是硬约束。
- **mutable 本地副本的副作用**：把被重赋值的 import 名 localize 成 `let X=null` 后，跨模块共享可变状态会失去同步；若出现"改了状态读不到"，优先怀疑这里。
- **fixer 幂等纪律**：后处理 fixer 幂等，重跑会先剥离自己上一轮注入的注释块；别手动在注入块里加东西。改坏用备份一键还原重放。
- **真机判分口径别误杀真错**：改过滤逻辑时务必别把 `X is not defined` 这类真错滤掉。
