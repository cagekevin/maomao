# 后处理 `fix_esm.cjs`（主线 5，逆向还原的核心一步）

> webcrack 拆出的代码天然带 ESM 非法结构，**必须后处理才可读可跑**。
> 对工程根**递归**处理（自动跳过 `node_modules`/`dist`/`.vite`/`.git`）。

```powershell
node scripts/pipeline/fix_esm.cjs <工程根目录>
# 输出：导出同步 shared.js: N 个 / import 赋值改写: M 个文件 / 悬空引用补全: K 处
```

---

## 1. 五类问题与处理函数

> **主流程顺序（务必按此，否则互相干扰）**：
> `cleanArtifacts(C)` → `fixConstructorArtifact(D)` → [shared.js 走 `exportSync(A)`；其他文件走 `fixExtractedComponentRefs(E2)` + `fixDanglingImports(E)`] → `fixImportAssignments(B)`

| 类别 | 现象 | 处理函数 | 做法 |
|---|---|---|---|
| **C 伪迹清理** | `function NAME() { [native code] }` | `cleanArtifacts` | 正则删 webcrack 伪迹 → `NAME`（兼容 `new Date(x).toLocaleString()` 内嵌形式） |
| **D constructor 还原** | `Object(...){super(...)}` | `fixConstructorArtifact` | babel `errorRecovery` 解析，把含 `super` 的 `Object` 方法还原成 `constructor` |
| **A 导出同步** | `X is not exported` | `exportSync`（仅 `shared.js`） | 把 shared.js 所有顶层 `var/let/const/function/class` 名 + import 本地名，同步进 `export {}` |
| **E 悬空引用补全** | 引用了 shared.js 导出但未 import | `fixDanglingImports` | 自动补 `import { X } from './shared.js'`；**额外收集 JSX 成员表达式对象位置**（`<_r.Provider>` 的 `_r`）；跳过 `component_map` 原始名 |
| **E2 抽出组件引用改写** | `X is not defined`（X 是抽到独立文件的组件） | `fixExtractedComponentRefs` | 读 `component_map.json`，把父文件里原始名 `X` 改写为 `_cmp_<FILE>` 并补 `import _cmp_<FILE> from './<FILE>.jsx'`；剔除 dangling 误加的 `import { X } from './shared.js'` |
| **B import 赋值改写** | `X is an import`（对 import 绑定赋值/自增） | `fixImportAssignments` | 被赋值的共享名从具名 import 抽出 → `import * as _shared` + 引用改写 `_shared.X` |

---

## 2. 三个真实 bug 案例（排错范式）

**每修一类 → 重跑 `fix_esm.cjs` → `npm run build` → `verify_ext.cjs` → 看 `report.json`。**

### 案例一：`Qn is not defined`（App 块）
- **报错**：`ReferenceError: Qn is not defined`（App `mr.jsx`，`<Qn/>`）
- **根因**：`Qn` 被抽到 `Qn.jsx`（默认导出 `_cmp_Qn`），父文件仍写 `<Qn/>`
- **修复**：`fixExtractedComponentRefs` 读 `component_map.json` 发现 `"Qn":"Qn"`，把 `<Qn/>` 改写为 `<_cmp_Qn/>`，并补 `import _cmp_Qn from './Qn.jsx'`

### 案例二：`I_ is not defined`（httpClient 块，**最大坑**）
- **报错**：`ReferenceError: I_ is not defined`（httpClient `R_.jsx`，`<I_ />`）
- **定位**：查 `component_map.json` → `"I_": "I__1"`，**原始名 `I_`，文件是 `I__1.jsx`**，导入名应是 `_cmp_I__1`
- **根因**：早期修复版本**按文件名匹配**（`I__1` 不在引用里），抓不到 `I_`。**必须用 `component_map.json` 做「原始名 → 文件名」映射**
- **修复**：`fixExtractedComponentRefs` 改用映射表：`origToTarget["I_"] = { file:"I__1", local:"_cmp_I__1" }`，改写 `<_cmp_I__1 />` + 补 `import _cmp_I__1 from "./I__1.jsx"`，同时剔除 dangling 误加的 `import { I_ } from './shared.js'`

### 案例三：`_r is not defined`（httpClient 块，JSX 成员表达式对象）
- **报错**：`ReferenceError: _r is not defined`（`_Component133.jsx`，`<_r.Provider>`）
- **定位**：`shared.js` 定义了 `var _r = Z.createContext(...)` 且已导出；但 `_Component133.jsx` 用了 `<_r.Provider>` 却**没 import**
- **根因**：`_r` 是 `<_r.Provider>` 里的 JSX **成员表达式对象**，早期 `fixDanglingImports` 只收集 `<X/>` 直接标签名，漏掉了成员表达式的**对象**位置
- **修复**：`fixDanglingImports` 增加分支——`p.parentPath.isJSXMemberExpression() && p.parentPath.node.object === p.node` 时按引用收集，补 `import { _r } from './shared.js'`

---

## 3. 关键陷阱

- **`component_map.json` 是真相表**：原始名 ≠ 文件名（`I_`→`I__1`）。**任何按文件名猜映射的逻辑都会漏接**。
- **scope 绑定陷阱（最隐蔽）**：若 dangling 误把 `X` 加进 `import { X } from './shared.js'`，scope 认为 `X` 已绑定，后续 E2 补 `_cmp_X` 时会**跳过**它——**构建放行但真机仍 `X is not defined`**。
  解法：E2 先剔除误加的 shared 导入，再补 `_cmp_X`；dangling 跳过 `component_map` 原始名。
- **JSX 成员表达式对象位置要单独收集**：`<_r.Provider>` 的 `_r` 是 `JSXMemberExpression.object`，只收集 `openingElement`/`closingElement` 会漏。
- **babel visitor 合法性**：组件方法改写用 `ClassMethod`，`MethodDefinition` **不是**合法 visitor；walk 必须跳过 `node_modules`/`dist`。
- **别手动改源码打地鼠**：修完一类重跑脚本即可，通常一两次迭代收敛。
