# 一毛 AI 画布 · 逆向还原方法包（最小版）

## 🎯 我们的核心目标：逆向还原（不是只求 build 通过）

> **我们是在做逆向工程**：把一个官方编译混淆压缩后的扩展 `dist`，**还原成可读、可维护、可二次开发的工程源码**。
> 具体说，目标是把一行几 MB 的 `function(e,t){...}` 混淆 chunk，还原成：
> - **有结构的工程**：React 19 单实例 + 按组件拆分的文件树（`*_components/`）
> - **可读的源码**：语义化命名（`05_rename.cjs` 把 `Ln`/`H_` 改回业务含义）、剥离 `_cmp_` 前缀、Unicode 中文还原
> - **能跑的工程**：`npm run build` 能构建、`Chrome --load-extension` 能加载运行（真机零应用级报错）
>
> **build 通过 / 验收通过只是「还原质量够好」的验证手段，不是目的本身。**
> 如果产物能 build 但源码仍是一团不可读混淆代码，那逆向就没完成。
> 本目录是已验证可跑通主线的精简版：**先 `run.cjs` 生成 → `npm run build` 过构建关卡 → `fix_esm.cjs` 后处理 → `05_rename.cjs` 可读化 → `fix_cmp_imported.cjs` 规范化 → 再构建 → 真机验收**。伪迹清理、可读化改名等是后期逐步补的，不要求一次流水线就完美。

---

## 0. 四步主线（先跑通，再回头看细节）

> **起点只有一个官方编译好的扩展 `dist`**（如 `C:\Users\xinye\Downloads\11\dist`），
> 没有任何其它输入。`step0_raw/` 是从这个 `dist` 里**提取**出来的，不是凭空存在的。

```
第0步 提取输入   node extract_input.cjs <最初的dist路径>
                → glob 自适应从 dist/assets/ 提取「业务 chunk」到 step0_raw/chunks/（剔除 vendor/rolldown-runtime 等第三方）
                → 从 dist/ 根提取 index.html、从 dist/share/ 提取 share.html
                → 从 dist/public/ 提取 manifest.json / background.js / 图标（含 dist 根 icon16/48/128.png）/ mediapipe / models / assets/*.css 等到 step0_raw/static/public/
01 生成工程     node pipeline/run.cjs
                → 自动识别 chunks（DEEP=核心业务走 webcrack→拆分；OTHER=其余只拷贝），产出 output/project
                → 注：拆分后的 *_components/ 里可能残留 webcrack 伪迹，这是已知的后期清理项，不阻断主线
02 先构建验证   cd output/project && npm install && npm run build
                → 【关卡】能构建通过，才说明拆包产物基本可用，方可进入后处理
                → 若报伪迹类静态错误（如 function X(){[native code]}），先手动对对应文件跑 00_sanitize.cjs 再继续（后期会固化进流水线）
03 可读化(可选) node pipeline/05_rename.cjs output/project/src/bundle
                → 作用域安全语义改名；改前建议先 snapshot output/project/src 以便回退
04 构建冒烟门   node verifiers/verify_build.cjs
                → 秒级静态断言（manifest 合法 / 入口 HTML 引用 / 无悬空 chunk 引用），不通过则回修
05 后处理根治   node pipeline/fix_esm.cjs output/project
                → 修 ESM 五类错误（A~E）
06 再构建       cd output/project && npm run build
                → 后处理通常能消除大部分 ESM 错误；退出码 0 即达标（告警见 §0.5 允许遗留项）
07 真机验收     cd verifiers/AI01_ext && node verify_ext.cjs
                → 先确认扩展能被 Chrome 正常加载（不报 Couldn't load icon / 界面错乱）；否则回 §3.3 修产物
                → 看 report.json：以 §0.5「达成线」为准（真机仅剩噪声即达成，无需 errorCount=0）
```

> 若 05~06 后还冒 `ReferenceError: X is not defined`，回到 §4 按 component_map.json 定位补修，再重跑 06~07。

---

## 0.5 流水线完成标准（到达这条线就停手，别打地鼠）

**核心原则：不要在「构建零 warning / 验收零 error」上无限打地鼠。** 逆向还原的目标是有结构、可读、能跑，不是工业级干净产物。以下三条全满足即视为**流水线达成，停止继续修**：

### ✅ 达成线（三条必须同时满足）
1. **能构建**：`npm run build` 退出码为 0，产出 `dist/`（含 index.html + 所有 chunk + 两个 CSS）。
2. **能加载**：Chrome 加载 `dist/` 不报「加载即崩」类致命错误（§3.3：图标齐全、`index.html` 同时引用真实业务样式与 `vendor-Qkhkn02K.css` 且非空。注意业务样式文件名**随官方版本变化**：1.4.2=`src-DoQUrSOl.css`、1.4.3=`src-DQ-1CVtg.css`，勿写死，`run.cjs` 已动态识别 + `verify_build.cjs` 动态读 `public/assets`）。→ 用 `verify_build.cjs` 静态门卡。
3. **真机零应用级报错**：`verify_ext.cjs` 的 `report.json` 里 `errorCount` 可以 ≠ 0，但剩下的**全是噪声**（§3.4：仅 `sw.createCDPSession` + 单个 404 + 本地工具未连接），**无任何 `ReferenceError` / `TypeError` / `NotFoundError:removeChild`**。
   - ⚠️ 原「CSP 拦截 `data:text/javascript` 脚本」的报错**已从流水线根治**（见 §4 案例 D），不再算噪声遗留。

### 🟡 允许遗留（不算没完成，是"后期补"范畴，别为它们反复跑流水线）
- **构建告警**：如 `Illegal reassignment of import "_shared"`（rollup 对 `import * as _shared` 重赋值的非致命告警）、chunk >500kB 体积告警。不影响产物运行。
- **CSP 拦截已修复（不再遗留）**：`data:text/javascript` 的 modulepreload 由 `vite.config.ts` 的 `post-build-fixups` 钩子（`closeBundle`）在**每次 `npm run build` 后自动剥离**（§4 案例 D）。此前只在 `run.cjs` 里做、或手动补，都会被 Vite 重写 `index.html` 冲掉——现已固化进 build 流程，重跑必生效。
- **webcrack 伪迹偶发残留**：个别 `_components/*.jsx` 终检未清干净的，手动跑一次 `00_sanitize.cjs` 即可，不必重跑整条 `run.cjs`。
- **可读化已交付**：`05_rename.cjs`（语义改名 `Ln`/`H_`→业务名）+ `fix_cmp_imported.cjs`（去 `_cmp_` 前缀）已跑过，源码 `output/project/src/bundle/*.js` 已带可读命名；重跑 build 后 `dist/` 同步带可读命名。改名未破坏作用域（build 退出码 0 已证明）。

### 🔴 什么情况才需要继续修（没到达成线）
- 构建退出码非 0（真有语法/解析错误，不是告警）。
- `verify_build.cjs` 不通过（图标缺 / 样式缺 → Chrome 拒绝加载）。
- `report.json` 里出现**应用级** `ReferenceError: X is not defined` / `TypeError` / `NotFoundError:removeChild` → 按 §4 的 component_map 方法定位，跑一次 `fix_esm.cjs` 后重新 06~07。这类修完通常一两次迭代就收敛，**不要逐条手动改源码打地鼠**。

> ⚠️ **不要做的事**：为了消灭一条构建告警或一个 CSP 噪声，去重排 `run.cjs` 整条流水线或逐文件手改 —— 那是本末倒置。流水线产出「能构建 + 能加载 + 真机零应用级报错」就达标，剩余项留给后期按需补。

---

## 1. 目录结构与文件职责（本最小版）

```
minimal/
├─ extract_input.cjs        ← 第0步：从最初 dist 提取 step0_raw/（chunks + static，glob 自适应）
├─ pipeline/                ← 生成 + 后处理脚本（run.cjs 调用链完整）
│  ├─ run.cjs               ← 总入口：自动识别 chunks → webcrack → 00~04 → 组装 + shim + vite.config + css占位 + 终检
│  ├─ 00_sanitize.cjs       ← 00 伪迹清理（Object/constructor 文本还原；02 构建前手动兜底跑它）
│  ├─ 01_expand.cjs         ← 01 AI 结构展开
│  ├─ 02_split.cjs          ← 02 智能组件拆分（生成 *_components/）
│  ├─ 03_facade.cjs         ← 03 门面替换（原 JS → re-export）
│  ├─ 04_unicode.cjs        ← 04 Unicode 中文还原
│  ├─ 05_rename.cjs         ← 05 可读化层（可选）：作用域安全语义改名，glob 自适应所有 bundle js
│  ├─ clean_project.cjs     ← 终检：递归清理 webcrack [native code] 伪迹
│  ├─ fix_esm.cjs           ← 后处理 A 五类 ESM 修复（A~E）
│  └─ fix_cmp_imported.cjs  ← 后处理 B 剥离 _cmp_ 前缀（干净态常可跳过，但保留方法论完整性）
├─ step0_raw/               ← 第0步从 dist 提取的原始素材（run.cjs 只读这里）
│  ├─ chunks/               ← 业务混淆 chunk（glob 自适应提取，见 §2）
│  └─ static/               ← 入口 html / tsconfig / tailwind / public 资源
│     ├─ index.html  share.html  tsconfig.json  tailwind.config.js
│     └─ public/            ← manifest.json / 图标 / mediapipe / models / assets/*.css 占位
├─ verifiers/
│  ├─ AI01_ext/verify_ext.cjs   ← 真机验收（Playwright 加载 dist 为 MV3 扩展，生成 report.json）
│  └─ verify_build.cjs          ← 04 构建后静态冒烟门（秒级，exit-code 质量门）
├─ docs/
│  └─ 成功复盘SOP.md         ← 完整 SOP 细节（shim 模板、五类修复源码、三个真实 bug 案例）
└─ README.md                ← 本文件（总表）
```

### 1.1 文件清单对照表

| 文件 | 类型 | 是否必需 | 说明 |
|------|------|----------|------|
| `extract_input.cjs` | 脚本 | ✅ 必需 | 第0步：从最初 dist 提取 step0_raw/（chunks+static） |
| `pipeline/run.cjs` | 脚本 | ✅ 必需 | 生成流水线总入口 |
| `pipeline/00_sanitize.cjs` | 脚本 | ✅ 必需 | run.cjs 第116行调用 |
| `pipeline/01_expand.cjs` | 脚本 | ✅ 必需 | run.cjs 第107行调用 |
| `pipeline/02_split.cjs` | 脚本 | ✅ 必需 | run.cjs 第126行调用 |
| `pipeline/03_facade.cjs` | 脚本 | ✅ 必需 | run.cjs 第136行调用 |
| `pipeline/04_unicode.cjs` | 脚本 | ✅ 必需 | run.cjs 第154行调用 |
| `pipeline/clean_project.cjs` | 脚本 | ✅ 必需 | run.cjs 第292行终检调用 |
| `pipeline/fix_esm.cjs` | 脚本 | ✅ 必需 | 后处理 A（SOP §5） |
| `pipeline/fix_cmp_imported.cjs` | 脚本 | ✅ 保留 | 后处理 B（SOP 剥离前缀） |
| `pipeline/05_rename.cjs` | 脚本 | ◯ 可选 | 05 可读化层（语义改名，移植自 AI08） |
| `step0_raw/chunks/*.js` | 数据 | ✅ 必需 | 业务 chunk（glob 自适应提取，非写死 12 个） |
| `step0_raw/static/*` | 数据 | ✅ 必需 | 入口/配置/public 资源 |
| `verifiers/AI01_ext/verify_ext.cjs` | 脚本 | ✅ 必需 | 真机验收 |
| `verifiers/verify_build.cjs` | 脚本 | ✅ 必需 | 01d 构建后静态冒烟门 |
| `docs/成功复盘SOP.md` | 文档 | ✅ 必需 | 完整细节与避坑 |
| `*.log` / `debug.cjs` / `analyze_shared.cjs` / `reconstruct_shared.cjs` / `05_split_shared.cjs` / `build_project.cjs` / `check_project.cjs` / `verify_state.cjs` | 历史 | ❌ 已删 | 不在 run.cjs 调用链，调试残留 |
| `step0_raw/chunks/` 多余 9 个旧版 chunk | 数据 | ❌ 已删 | run.cjs 不处理（App-D5SRQxl_.js 等） |
| `fixers/` `diagnostics/` `probes/` `logs/` `output/` | 历史 | ❌ 已删 | AI02~AI10 归档与旧产物 |

---

## 2. 输入数据约定（step0_raw 从哪来）

**我们最初只有一个官方编译好的扩展 `dist`**（如 `C:\Users\xinye\Downloads\11\dist`），没有任何其它输入。
`step0_raw/` 是**第 0 步 `extract_input.cjs` 从这个 dist 提取出来的**，不是凭空准备的：

- `step0_raw/chunks/` ← 从 `dist/assets/` **glob 自适应提取「业务 chunk」**（剔除 `vendor-*` / `rolldown-runtime-*` / `__vite-browser-external-*`，其余一律收齐），**不再写死白名单**，换源/换版本无需改代码
- `step0_raw/static/` ← 从 `dist/` 根提 `index.html`、从 `dist/share/` 提 `share.html`、从 `dist/public/` 提 `manifest.json`/`background.js`/图标/`mediapipe`/`models`/`assets/*.css` 等到 `static/public/`

提取命令：
```powershell
node extract_input.cjs C:\Users\xinye\Downloads\11\dist
```

提取的业务 chunk 由脚本自动识别（DEEP=核心业务走完整 webcrack→拆分，OTHER=其余只拷贝）：
- **DEEP 模式**：文件名匹配 `^(App|httpClient|src)-`（`App-*` `httpClient-*` `src-*` 等核心业务文件）
- **OTHER**：其余业务 chunk（`__vite-browser-external-*` / `endpointConfig-*` / `main-*` / `mediabunny-*` / `share-*` / `ShareAppPage-*` / `vendor-*` 等）

> 文件名不再写死：提取用 glob 过滤、生成用正则判定 DEEP。换源只要重新 `node extract_input.cjs` 即可。

---

## 3. 四个关键决策点（为什么这么做）

### 3.1 React 单实例 shim（杜绝多实例 / Invalid hook call）
拆出的代码 `import React from 'react'`，但运行时只能有一份 React（vendor 里的 `Rr`）。`run.cjs` 自动生成：
- `src/bundle/_react_shim.js`：把 `react` 指向 vendor `Rr` 工厂（经 rolldown interop 包装）
- `src/bundle/_jsx_runtime.js`：把 `react/jsx-runtime` 指向 vendor `Fr` 工厂
- `vite.config.ts`：`alias` + `dedupe:['react','react-dom']` + `force-jsx-for-js` 插件

> 细节与模板见 `docs/成功复盘SOP.md` §2。

### 3.2 后处理五类修复（fix_esm.cjs）

> **这是逆向还原的核心一步（对应主线 05 后处理 A）**：webcrack 拆出的代码天然带 ESM 非法结构，必须后处理才可读可跑。脚本对工程根**递归**处理（自动跳过 `node_modules`/`dist`/`.vite`），依赖 `@babel/*`（在 `pipeline/node_modules`，从工程根调用也能解析到）。
> 主流程顺序（务必按此，否则会互相干扰）：`cleanArtifacts(C)` → `fixConstructorArtifact(D)` → [shared.js 用 `exportSync(A)`；其他文件用 `fixExtractedComponentRefs(E2)` + `fixDanglingImports(E)`] → `fixImportAssignments(B)`。

| 类别 | 现象 | 处理函数 | 做法 |
|------|------|----------|------|
| **C 伪迹清理** | `function NAME() { [native code] }` | `cleanArtifacts` | 正则删 webcrack 伪迹 → `NAME`（兼容 `new Date(x).toLocaleString()` 内嵌形式） |
| **D constructor 还原** | `Object(...){super(...)}` | `fixConstructorArtifact` | babel `errorRecovery` 解析，把含 `super` 的 `Object` 方法还原成 `constructor` |
| **A 导出同步** | `X is not exported` | `exportSync`（仅对 `shared.js`） | 把 shared.js 所有顶层 `var/let/const/function/class` 名 + import 本地名，同步进 `export {}` |
| **E 悬空引用补全** | 引用了 shared.js 导出但未 import | `fixDanglingImports` | 自动补 `import { X } from './shared.js'`；**额外收集 JSX 成员表达式对象位置**（`<_r.Provider>` 的 `_r`）；跳过 `component_map` 原始名 |
| **E2 抽出组件引用改写** | `X is not defined`（X 是抽到独立文件的组件） | `fixExtractedComponentRefs` | 读 `component_map.json`，把父文件里原始名 `X` 改写为 `_cmp_<FILE>` 并补 `import _cmp_<FILE> from './<FILE>.jsx'`；剔除 dangling 误加的 `import { X } from './shared.js'` |
| **B import 赋值改写** | `X is an import`（对 import 绑定赋值/自增） | `fixImportAssignments` | 把被赋值的共享名从具名 import 抽出 → `import * as _shared` + 引用改写 `_shared.X` |

> **`component_map.json` 是真相表（逆向最大坑）**：每个 `*_components/` 目录各一份，结构是 **`原始组件名 → 文件名`**，且**两者可以不同**（如 `"I_": "I__1"`）。
> - 子组件被抽到 `./<文件名>.jsx`，**默认导出**，导入名约定为 `_cmp_<文件名>`。
> - 父文件里仍用**原始名**引用它（`<原始名/>` 或 `原始名()`）。
> - 因为「原始名 ≠ 文件名」，**所有引用修复都必须以该表为真相，不能按文件名猜**——按文件名猜会漏接（见 §4 的 `I_` 案例）。
> 细节见 `docs/成功复盘SOP.md` §1.3 / §5。

### 3.3 扩展「加载即崩」类致命错误（必须修，不是噪声）
以下错误会让 Chrome **直接拒绝加载整个扩展**（而非运行时报错），优先级高于一切拆分问题，**必须先解决才能谈验收**：

| 现象 | 根因 | 修复 |
|------|------|------|
| `Couldn't load icon icon16.png specified in action` | `extract_input.cjs` 的 `PUBLIC_ROOT_FILES` 漏提 `icon16/48/128.png`，构建后 `dist/` 没有图标，但 `manifest.json` 引用了 | 已把三个图标加入 `PUBLIC_ROOT_FILES`；`run.cjs` 构建后也会从 `static/public` 带出图标 |
| 界面错乱（本该在下方的内容跑到上方） | a. `run.cjs` 的 CSS 占位逻辑用空内容**覆盖了真实 `vendor-Qkhkn02K.css`**；b. 逆向 JS 用 `mapDeps` 懒加载 CSS（非静态 `import`），**Vite 构建未把 `src-DoQUrSOl.css` 注入 HTML**，页面只剩 0 字节样式 | 占位逻辑已改为「文件已存在则保留真实内容」；`run.cjs` 构建后强制把 `static/index.html` 的真实 `<link rel=stylesheet>` 回写产物 `dist/index.html` |
| `Failed to load resource: net::ERR_*` 指向某个 css | 上述样式丢失的延伸 | 同上，确认 `dist/index.html` 同时引用 `src-DoQUrSOl.css` 与 `vendor-Qkhkn02K.css` 且文件非空 |

> ⚠️ **历史误判纠正**：曾把「扩展无法加载」误判为「Playwright / macOS 不支持扩展验收」。实际 Playwright（或系统 Chrome `--load-extension`）**可以**加载验收，加载失败**一律是构建产物有误**（缺图标 / 缺样式 / manifest 非法），先查产物再查工具。
> 真机验收前，务必先用 §3.4 的静态门确认「图标存在 + HTML 样式引用完整」，否则 Chrome 会直接拒绝加载，连报错栈都看不到。

### 3.4 真机验收判分（verify_ext.cjs）
读 `report.json`，**只修**真机调用栈里的 `ReferenceError`/`TypeError`/`NotFoundError:removeChild`。以下一律**不修**（噪声）：
- `sw.createCDPSession is not a function` —— Playwright 1.62 的 SW API 兼容问题，非应用错误
- `Failed to load resource: 404` ×1 —— 资源缺失噪声

**达成标准**：`errorCount` 可以不是 0，但只要剩下的全是上述噪声，即视为「真机零应用级报错」。

> 验收工具说明：Playwright（或系统 Chrome `--load-extension`）**都可以**用于 macOS 真机验收。
> 若加载阶段就报 `Couldn't load icon` / 界面全乱，那不是验收工具的问题，是 §3.3 的「加载即崩」产物错误，**先按 §3.3 修产物**，再跑验收。

### 3.5 验收前产物自检清单（防止「加载即崩」）
`verify_ext.cjs` 跑起来之前，先对 `output/project/dist/` 做 3 秒人工/脚本核对，任一不满足 Chrome 会**拒绝加载整个扩展**：
1. **图标齐全**：`manifest.json` 中 `action.default_icon` 与 `icons` 引用的 `icon16/48/128.png` 必须存在于 `dist/` 根且非空（缺失 → `Couldn't load icon`）。
2. **HTML 样式引用完整**：`dist/index.html`（及 `share/index.html`）必须同时含真实业务样式 `<link rel=stylesheet href=./assets/<真实CSS名>>` 与 `vendor-Qkhkn02K.css`，且对应文件非空（缺失/空 → 界面错乱）。真实业务样式名随官方版本变（1.4.2=`src-DoQUrSOl.css`、1.4.3=`src-DQ-1CVtg.css`），`run.cjs` 的 post-build 钩子会自动从 `public/assets` 拷真实 CSS 并修正 `src/bundle/assets` 悬空路径、补齐引用别名，`verify_build.cjs` 会自动读 `public/assets` 校验——**不要手动写死 CSS 名**。
3. **manifest 合法**：`verify_build.cjs` 已覆盖；但若手动改过 manifest，注意 `background.service_worker` 路径、`web_accessible_resources` 写法。

> 建议把上述 1、2 项加进 `verifiers/verify_build.cjs`，作为「加载即崩」的静态门（比真机早一步拦住错误）。

### 3.6 CSS 兜底原理 + 手动补兜底 SOP（换版本必读）

**为什么 CSS 会出问题（原理）**：官方 `dist/assets/*.css` 的文件名**随版本变化**（1.4.2=`src-DoQUrSOl.css`、1.4.3=`src-DQ-1CVtg.css`，`vendor-Qkhkn02K.css` 稳定）。逆向还原时：
- `run.cjs` 在 `src/bundle/assets/` 生成 CSS **空占位**，并在构建后用 post-build 钩子从 `public/assets/` 拷**真实 CSS** 覆盖 `dist/assets/`；
- 但逆向 JS 用 `mapDeps` **懒加载**业务 CSS（非静态 import），Vite 静态分析抓不到 → `index.html` 里可能：a. 出现 `./src/bundle/assets/*.css` 的**悬空路径**；b. 引用一个 `dist/assets/` 里**不存在的 CSS 名**；c. `vendor-*.css` 被空占位顶成 0 字节。三者都会导致**界面错乱/加载即崩**。

**工具已自动做的事（vite.config.ts post-build 钩子 + verify_build.cjs）**：
1. 从 `public/assets/*.css` 拷贝真实 CSS 覆盖 `dist/assets/`（保证非空）；
2. 修正 `index.html`/`share/index.html` 里 `src/bundle/assets/` 悬空路径 → `assets/`；
3. 对 index.html 引用的 CSS，若 `dist/assets/` 无同名文件，用真实 CSS 内容兜底生成别名；
4. `verify_build.cjs` 从 `public/assets/` **动态**读真实 CSS 名来校验（至少命中一个业务样式），不写死旧名。

**假设脚本某步没做好，手动补兜底（三选一，按需）**：
1. **`dist/assets/vendor-Qkhkn02K.css` 是 0 字节 / 空**（界面错乱）：
   ```bash
   cp public/assets/vendor-Qkhkn02K.css dist/assets/vendor-Qkhkn02K.css
   ```
2. **index.html 引用了 `dist/assets/` 里不存在的 CSS（如 `src-DoQUrSOl.css`）**：用真实业务样式内容兜底生成同名文件：
   ```bash
   # 找到 dist/assets 里真实的业务 CSS（src-DQ-1CVtg.css 之类），复制为被引用的名字
   cp dist/assets/src-DQ-1CVtg.css dist/assets/src-DoQUrSOl.css
   ```
3. **index.html 里有 `./src/bundle/assets/*.css` 悬空路径**：手动把前缀改成真实路径：
   - 主入口 `dist/index.html`：`./src/bundle/assets/` → `./assets/`
   - `dist/share/index.html`：`../src/bundle/assets/` → `../assets/`

改完执行：`node verifiers/verify_build.cjs output/project`，看到「可进入真机验收」即通过。若仍有"必要业务样式"报错，多半是**写死了旧版 CSS 名**——检查 `vite.config.ts` 钩子与 `verify_build.cjs` 的 `EXPECTED_CSS` 是否还残留 `src-DoQUrSOl.css` 这类硬编码（应为动态从 `public/assets` 读）。

---



## 4. 排错闭环（三个真实 bug 范式）

每修一类 → 重跑 `fix_esm.cjs` → `npm run build` → `verify_ext.cjs` → 看 `report.json`，直到 `ReferenceError` 全消。

| 案例 | 报错 | 根因 | 修复点 |
|------|------|------|--------|
| Qn is not defined | App `mr.jsx` `<Qn/>` | Qn 抽到 Qn.jsx，父文件仍写原名 | E2 改写 `_cmp_Qn` |
| I_ is not defined | httpClient `R_.jsx` `<I_ />` | 原始名 `I_`≠文件 `I__1`，按文件名猜漏接 | E2 用 component_map 映射 |
| _r is not defined | httpClient `_Component133.jsx` `<_r.Provider>` | `_r` 是 JSX 成员表达式对象，早期只收标签名漏了 | E 补 `import {_r} from './shared.js'` |
| `data:text/javascript` CSP 报错 | 浏览器 console `Loading the script 'data:text/javascript...' violates Content Security Policy` | Rolldown 即便 `modulePreload:false` 仍把小模块内联成 data: URL 的 `<link rel=modulepreload>`；MV3 CSP `script-src 'self' 'wasm-unsafe-eval'` 禁止 data: 脚本 | `run.cjs` 新增 `stripDataUrlPreload` 剥离产物 HTML 中的 data: modulepreload |

### 4.1 案例一：`Qn is not defined`（App 块）
- **报错**：`ReferenceError: Qn is not defined`（App `mr.jsx`，`<Qn/>`）。
- **根因**：`Qn` 被抽到 `Qn.jsx`（默认导出 `_cmp_Qn`），父文件仍写 `<Qn/>`。
- **修复**：`fixExtractedComponentRefs` 读 `component_map.json` 发现 `"Qn":"Qn"`，把 `<Qn/>` 改写为 `<_cmp_Qn/>`（同目录若漏 import 则补 `import _cmp_Qn from './Qn.jsx'`）。

### 4.2 案例二：`I_ is not defined`（httpClient 块，最大坑）
- **报错**：`ReferenceError: I_ is not defined`（httpClient `R_.jsx`，`<I_ />`）。
- **定位**：查 `component_map.json`，输出 `"I_": "I__1"` —— **原始名 `I_`，文件是 `I__1.jsx`**，导入名应是 `_cmp_I__1`。
- **根因**：早期修复版本**按文件名匹配**（`I__1` 不在引用里），所以抓不到 `I_`。必须用 `component_map.json` 做「原始名 → 文件名」映射。
- **修复**：`fixExtractedComponentRefs` 改用 `component_map.json`：`origToTarget["I_"] = { file:"I__1", local:"_cmp_I__1" }`，把 `<I_ />` 改写为 `<_cmp_I__1 />`，并补 `import _cmp_I__1 from "./I__1.jsx"`。同时剔除 dangling 误加的 `import { I_ } from './shared.js'`。

### 4.3 案例三：`_r is not defined`（httpClient 块，JSX 成员表达式对象）
- **报错**：`ReferenceError: _r is not defined`（`_Component133.jsx`，`<_r.Provider>`）。
- **定位**：`shared.js` 定义了 `var _r = Z.createContext(...)` 且已导出；但 `_Component133.jsx` 用了 `<_r.Provider>` 却**没 import**。
- **根因**：`_r` 是 `<_r.Provider>` 里的 JSX **成员表达式对象**，早期 `fixDanglingImports` 只收集 `<X/>` 直接标签名，漏掉了成员表达式的**对象**位置。
- **修复**：`fixDanglingImports` 增加分支——`p.parentPath.isJSXMemberExpression() && p.parentPath.node.object === p.node` 时按引用收集，补 `import { _r } from './shared.js'`（合并进已有 shared import）。

### 4.4 案例四：`data:text/javascript` CSP 报错（MV3 加载告警，已根治）
- **报错**：浏览器 console 出现 `Loading the script 'data:text/javascript;base64,...' violates the following Content Security Policy directive: "script-src 'self' 'wasm-unsafe-eval'"`。
- **根因**：构建用 Vite 7 内置 Rolldown。尽管 `vite.config.ts` 已设 `modulePreload:false`，**Rolldown 仍把体积小的 chunk 内联成 `data:text/javascript` 的 `<link rel="modulepreload">`**。这些内联脚本来源是 `data:`，而 MV3 扩展的 CSP 只允许 `'self'`（静态文件）和 `'wasm-unsafe-eval'`，**禁止 `data:` 脚本**，故加载即报。官方发行版把这些模块打进静态文件，所以无此告警。
- **为什么删了不影响功能**：`modulePreload:false` 本就是要关掉 preload；且真正的入口是 `<script type="module" src="./assets/*.js">`（同源 `'self'`，完全合法）。那些 data: modulepreload 纯属冗余预加载，剥离后加载顺序与功能不变。
- **修复（已固化进 build 流程）**：在 `vite.config.ts` 增加 `post-build-fixups` 插件（`apply:'build'` + `closeBundle` 钩子），**每次 `npm run build` 后自动**对 `dist/index.html` 与 `dist/share/index.html` 删除所有 `href="data:text/javascript..."` 的 `<link rel="modulepreload">`，并补回 `src-DoQUrSOl.css` 引用、拷贝图标。三个收尾动作一起固化，重跑 build 必生效。
- **⚠️ 关键坑：补丁必须放在 build 之后（post-build），不能放在 build 之前**：`run.cjs` 早期曾在组装阶段改 `dist/index.html` 的 css 引用，但那是 build **之前**操作的旧/空 dist；`npm run build` 会由 Vite 重新生成 `dist/index.html`，把构建前的补丁整体覆盖——这就是"之前补过但不生效"的真凶。同理图标不在 `public/` 内，Vite 不会自动带进 dist，必须在 `closeBundle` 里显式拷贝。
- **手动兜底（旧产物）**：若不想重跑流水线，直接删掉产物 HTML 里那几行 `data:text/javascript` 的 modulepreload link 即可（入口 `<script type="module" src="./assets/...">` 务必保留）。

---

## 5. 避坑清单（给下一位）

1. **不要重跑整条生成流水线**：`run.cjs` 常在收尾清理阶段挂死；产物完整时直接后处理兜底（`fix_esm.cjs` 十几秒一次，可无限迭代），比重跑（5~8 分钟且易挂死）划算得多。只有换源/换 dist 版本才重跑 `extract_input.cjs` + `run.cjs`。注意：PowerShell 下跑 `run.cjs` 时，webcrack/clean 的 stderr 会被当成 `RemoteException` 误报"挂死/中断"——这**不是脚本 bug**，用 `cmd /d /c` 包裹即可完整跑完。
2. **文件名保持原样**：`run.cjs` 内部按 `00_sanitize.cjs` 等原名互相调用，改名会破坏调用链（已踩过坑）。
3. **component_map.json 是真相表**：原始名 ≠ 文件名（`I_`→`I__1`）。任何按文件名猜映射的逻辑都会漏接。
4. **scope 绑定陷阱（最隐蔽）**：若 dangling 误把 `X` 加进 `import { X } from './shared.js'`，scope 认为 `X` 已绑定，后续 E2 补 `_cmp_X` 时会跳过它——**构建放行但真机仍 `X is not defined`**。解法：E2 先剔除误加的 shared 导入，再补 `_cmp_X`；dangling 跳过 `component_map` 原始名（脚本已内置此逻辑）。
5. **JSX 成员表达式对象位置要单独收集**：`<_r.Provider>` 的 `_r` 是 `JSXMemberExpression.object`，只收集 `openingElement`/`closingElement` 会漏。必须加 `parentPath.node.object === p.node` 分支。
6. **babel visitor 合法性**：组件方法改写用 `ClassMethod`，`MethodDefinition` 不是合法 visitor；walk 必须跳过 `node_modules`/`dist`。
7. **Playwright 跨版本**：验收装包务必 `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1`；`sw.createCDPSession` 报错是脚本兼容，非应用 bug。**但扩展「加载失败」（缺图标/缺样式/manifest 非法）绝不是 Playwright 的问题，是构建产物有误，先按 §3.3 修产物。**
8. **PowerShell 缓冲区污染**：用 `search_content`/直读文件，避免 `Select-String` 混历史输出。
9. **cmd 包裹跑 node**：PowerShell 会把 webcrack 的 stderr 当 `RemoteException` 中断 node，用 `cmd /d /c "node ... > log 2>&1"` 包裹可完整跑完。
10. **图标/样式「加载即崩」是头号坑**：扩展加载失败 99% 是 `dist/` 缺 `icon*.png` 或 `index.html` 漏样式 `<link>`（见 §3.3）。验收前先按 §3.5 清单核对，别急着怀疑工具。
11. **换官方版本后，业务 CSS 文件名会变，必须用 run.cjs 的** `src/bundle/assets` **占位 + post-build 钩子动态识别，别写死旧版 CSS 名**（1.4.2=`src-DoQUrSOl.css`、1.4.3=`src-DQ-1CVtg.css`）。若某步没做好（`vendor-*.css` 0 字节 / index.html 引用不存在的 CSS / `src/bundle/assets` 悬空路径），按 **§3.6** 手动补兜底，改完跑 `verify_build.cjs` 确认「可进入真机验收」。

---

## 6. 一键复现（PowerShell）

```powershell
# 第0步 提取输入（从最初的 dist → step0_raw/）
cd minimal
node extract_input.cjs C:\Users\xinye\Downloads\11\dist

# 01 生成工程（用 cmd 包裹，避免 PowerShell 把 webcrack 的 stderr 当错误中断）
cmd /d /c "node pipeline/run.cjs > run_gen.log 2>&1"
# 跑完看 run_gen.log 末尾确认 ✅ 完成 / 产物文件数

# 02 先构建验证（关卡：能构建才算拆包可用）
cd output/project
npm install
npm run build
# 若报错（静态解析/门面路径错）→ 先修，通过后再继续

# 03 可读化（可选）：作用域安全语义改名，让交付物源码/产物命名可读
#     改前建议先 snapshot output/project/src 以便回退
cd ../..
node pipeline/05_rename.cjs output/project/src/bundle

# 04 构建后静态冒烟门（秒级，不通过则回修，exit 1 阻断）
node verifiers/verify_build.cjs output/project
# 通过才继续

# 05 后处理根治
node pipeline/fix_esm.cjs output/project

# 06 再构建（后处理后应干净通过）
cd output/project
npm run build

# 07 真机验收（Playwright 装在 verifiers 目录，非工程根）
cd ../verifiers/AI01_ext
$env:PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
npm install playwright@1.62.0
$env:EXT_PATH = (Resolve-Path ../output/project/dist)
node verify_ext.cjs
# 看 report.json：errorCount=2 且全是噪声即达成
```

---

## 7. 产物形态（达成后）

- `output/project/dist/` —— 可加载运行的扩展产物
- `output/project/src/bundle/` —— 已后处理干净的源码（约 170 jsx + 17 js，含 `*_components/component_map.json`，以实际生成为准）
- `pipeline/fix_esm.cjs` —— 可复用后处理脚本
- `verifiers/AI01_ext/verify_ext.cjs` + `report.json` —— 验收 harness 与报告
