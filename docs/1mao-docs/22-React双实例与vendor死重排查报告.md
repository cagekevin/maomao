# 22 - React 双实例与 vendor 死重排查报告（现象记录 + 待复核假设）

> ## ⚠️ 真机实测事实补充（2026-08-02 晚，仅记录现象，不含方案结论）
>
> 以下为**可证实的客观现象**，来自真机运行报错栈 + 构建产物静态分析。本补充**不提出任何修复方案、不给出可采信的结论**——原报告及其后续所有"方案"均**未经真机验证闭环**，包括：
> - 原报告 §七 主修/次修方案；
> - "方向 A 已排除 / 双 vendor 非崩溃原因"的审计结论；
> - 后续探索中"删 HTML vendor preload 行（S1）即唯一正确解法"的推断（该推断仅基于产物静态分析 + 对照构建，真机复跑后仍报同样的 `useMemo` 崩溃，**已证伪**）。
>
> **真机报错栈（原始，未删节）：**
> ```
> vendor-Z-adA07W2.js:33
>  THREE.WARNING: Multiple instances of Three.js being imported.
> main-CYvt_zul.js:1
>  TypeError: Cannot read properties of null (reading 'useMemo')
>     at e.useMemo (vendor-Z-adA07W2.js:1:7323)
>     at lg (App-BX6o9fW5.js:31:54230)
>     at fi (vendor-Z-adA07W.js:8:48278)
>     at mm (vendor-Z-adA07W.js:8:71001)
>     at P2 (vendor-Z-adA07W.js:8:81407)
>     at _m (vendor-Z-adA07W.js:8:117196)
>     at co (vendor-Z-adA07W.js:8:116230)
>     at rn (vendor-Z-adA07W.js:8:116060)
>     at L2 (vendor-Z-adA07W.js:8:112851)
>     at ie (vendor-Z-adA07W.js:8:124659)
>  [RootErrorBoundary] 捕获到未处理异常: TypeError: Cannot read properties of null (reading 'useMemo')
>  {componentStack: '...lg (.../assets/App-BX6o9fW5.js) ... main-CYvt_zul.js:1:1767)'}
> ```
>
> **从报错栈可确认的客观事实（无需推断）：**
> 1. **两份 vendor 在运行时都被加载执行**：`useMemo` 调用帧落在 `vendor-Z-adA07W2.js`，而调用它的组件渲染链 `fi → mm → ... → ie` 全部位于 `vendor-Z-adA07W.js`（无2版）。即**无2版在运行时确实在执行**（推翻原报告"无2版零 import、从不执行、纯死重"的静态分析结论）。
> 2. **两份 vendor 各自持有独立的 React 实例 / `ReactCurrentDispatcher`**：业务组件 `lg (App-BX6o9fW5.js)` 的 `useMemo` 落在 dispatcher 槽为 `null` 的 `adA07W2` 上 → `Cannot read properties of null (reading 'useMemo')`。这是经典"多 React 实例 / Invalid hook call"崩溃。
> 3. **Three.js 也被打包进两份 vendor**：`Multiple instances of Three.js` 警告与 `useMemo` 崩溃同源，均为双 vendor 双实例导致。
>
> **从构建产物静态分析可确认的客观事实（无需推断）：**
> 4. 未改动的原始工作区 `npm run build` 后，`dist/assets/` 同时产出 `vendor-Z-adA07W.js` 与 `vendor-Z-adA07W2.js` 两个完整 React chunk（各约 1.7MB）。
> 5. 产物中所有业务模块（`App` / `ShareAppPage` / `_react_shim` / `_jsx_runtime` / `main` / `share` / `httpClient` 等）的 React 符号 import 均指向 `vendor-Z-adA07W2.js`（静态改写结果），无2版在 `dist/assets/` 内零 `import`——**注意**：此静态"零 import"与事实 1（运行时无2版被执行）矛盾，说明产物静态分析不足以反映运行时模块实例化行为。
>
> **待真机验证的开放问题（未决，勿臆断结论）：**
> - Q1：为何 HTML 里仅以 `<link modulepreload>` 声明的无2版，运行时仍被实例化执行（与 `modulepreload` 不执行模块作用域的常理相悖）？可能与 `vite.config.ts` 的 `modulePreload:false` 降级行为、或 `manualChunks` 命名冲突导致无2版被当作 entry 注入有关，需真机/断点确认。
> - Q2：删除源 HTML vendor preload 行后，对照构建显示 `adA07W2` 消失、全局只剩无2版一份 React（静态），但**真机复跑仍报同样的 `useMemo` 崩溃**——说明"双 vendor 命名冲突"与"运行时双 React 实例"可能并非同一问题，或 S1 未触及真正的运行时加载路径。根因仍未定位。
> - Q3：Three.js 双实例与 React 双实例是否同一加载路径触发，未确认。
>
> **结论（严格限定）**：当前**仅确认现象**（运行时双 React 实例导致 `useMemo` 崩溃 + 双 Three.js），**根因与修复方案均未定位、均未经真机验证闭环**。后续任何方案须以真机报错消失为唯一验收标准，产物质检 PASS / 静态分析一致均不足为凭。

---

> ## ✅ 修复已真机验证闭环（2026-08-03）
>
> **方案 S1（删除源 HTML 的 vendor `modulepreload` 行）已实施，真机测试通过，报错消失。**
>
> - **改动**：删 `index.html` / `share/index.html` / `public/share/index.html` 三处 `<link rel="modulepreload" ... vendor-Z-adA07W.js>`（各删 1 行）。
> - **静态验证（已通过）**：重建后 `dist/assets/` 只剩 1 个 `vendor-Z-adA07W.js`，`adA07W2` 消失；全部 8 个业务模块（`main`/`share`/`App`/`ShareAppPage`/`_react_shim`/`_jsx_runtime`/`httpClient`/`mediabunny`）的 React 符号 100% 指向同一份 vendor；`npm run test:smoke` **ALL PASS**（含 `dist 重复 chunk  PASS`）。
> - **真机结果（验收通过）**：打开带 Three.js 的画布页，`useMemo` 崩溃消失、`Multiple instances of Three.js` 警告消失。**以真机报错消失为唯一验收标准——本次闭环达成。**
> - **对旧记录的重要修正**：§九「试错 #1」曾记录 S1 真机仍崩（报错栈含 `adA07W2`）。经本次在干净重建产物 + 真机复测，S1 **成功**。旧记录的真机失败疑因测试时的产物陈旧 / 未随最新源码重建（`adA07W2` 只在该陈旧产物中存在），并非 S1 本身无效。详见 §九「试错 #3」。
> - **遗留跟踪更新（2026-08-03）：Bug B 也已修复并真机验证通过**。见下方「Bug B 修复已真机验证闭环」。

> ## ✅ Bug B（分享页双 createRoot）修复已真机验证闭环（2026-08-03）
>
> **方案（产物层兜底，`vite.config.ts` 的 `post-build-fixups` 插件新增 ④ 步骤）已实施，真机测试通过，分享页正常。**
>
> - **改动**：`vite.config.ts` 的 `closeBundle` 中，构建后：
>   1. 从 `dist/share/index.html` 剔除 `main-CYvt_zul.js` 的 `<script>` 注入；
>   2. 从 `dist/assets/share-CyPsaet6.js` 剥离对 `main` 的 `import`，并将内层空依赖的 `__vitePreload` 包裹（`[]` 无预载）退化为直接调用。
> - **成因（§2.6 Bug B）**：main/share 共享 `__vitePreload` 辅助，Rollup 把它归到 main 并让 share 反向 import main → 分享页同时加载两个入口、跑两次 `createRoot` 挂同一 `#root`。
> - **先尝试但放弃**：源码给 `share-CyPsaet6.js` 的 `__vite__mapDeps` 改名（方案 2）——实测 Vite 仍让 share import main（共享的是 `__vitePreload` 而非 mapDeps，Vite 自动注入、源码改名无效），已回退，改走产物层兜底。
> - **静态验证（已通过）**：`dist/share/index.html` 只加载 `share-CyPsaet6.js`、不再注入 main；`share-CyPsaet6.js` 不再 import main、含 1 个 `createRoot`；`dist/index.html` 正常含 main 的 1 个 `createRoot`；`npm run test:smoke` **ALL PASS**。
> - **真机结果（验收通过）**：分享页正常显示、不再双挂载。闭环达成。

---

> 状态：**已定位根因并给出修复方案，可作为修复立项依据**。早期版本断言"结构性双实例、不可修、硬删失败"与原稿"chunk 内部双份 React"均与源码/配置/产物实测冲突，已修订。
> 排查日期：2026-08-02
> **末次审计：2026-08-02（全文逐条实测复核）**——本轮对报告内每一条"待核实/待验证"断言重跑了实测，共更正 5 处事实错误，其中 1 处为结论级：
> 1. **§2.6 Bug A 漏记 `dist/index.html:12` 的 `<script src=".../vendor-Z-adA07W2.js">`**，原稿据此误述"无2版是被执行的一方"的可能性 → 已更正；
> 2. **§四.1 方向 A（双 dispatcher 致崩）已排除**：无2版零 import 且仅 `modulepreload`，模块作用域从不执行 → **双 vendor 不是 `useMemo` 崩溃原因**，仅是质量门 FAIL + 1.71MB 体积浪费；
> 3. **§2.6 Bug B 归因更正**：`share → main` 的 import **仅存在于产物，源码中没有**，故原修复方案（改 share 的 import）不可执行 → 已改为构建层方案；
> 4. §2.1 文件大小单位错误（B 误作 KB）→ 已更正；
> 5. §2.5 `CLAUDE.md` 铁律 #4 行号、`dist/share/index.html` 行号 → 已核对更正。
>
> 数据均基于当前工作区实测（`npm run build` 产物 `dist/assets/` + `npm run test:smoke`）。

---

## 〇、修订说明（重要）

本报告的早期版本把 import 归属说反、把崩溃根因臆测为"chunk 内部双份 React"、并错误声称质量门无碍。经逐条复核，上述结论与实测事实冲突，已修订。

**双 vendor 的成因已确认为事实**：源 HTML 的 `modulepreload` 把 `vendor-Z-adA07W.js` 变成 entry 身份，与 `manualChunks` 强制命名的同名 chunk 冲突，Rollup 去重时追加 `2` 后缀（§2.2）。原稿"不可修"结论错误，§七 给出可实施方案。

**⚠️ 末次审计（2026-08-02）推翻了上一版的一个关键推论**：上一版称"`modulePreload:false` 把 preload 降级为真实执行的 `<script>`，**使两份 React 都运行**"。实测证明后半句不成立——被降级注入 `<script>` 的是 `adA07W2`（第 12 行，原稿漏记）等模块，而无2版 `vendor-Z-adA07W.js` **始终只是 `<link rel="modulepreload">`、零 import、从不执行**。ESM 同 URL 单例，故**运行时只有一份 React 真正运行，不存在"两份 React 都运行"**。据此，双 vendor 被重新定性为「质量门 FAIL + 1.71MB 体积浪费」，而**非** `useMemo` 崩溃的原因；崩溃另有其源（§2.6 Bug B 分享页双 `createRoot`）。

---

## 一、现象（真实，保留）

- 真机打开带 Three.js 画布/特定功能页时崩溃：
  ```
  THREE.WARNING: Multiple instances of Three.js being imported.
  TypeError: Cannot read properties of null (reading 'useMemo')
      at e.useMemo (vendor-Z-adA07W2.js:1:7323)
      at sg (App-BX6o9fW5.js:31:54230)
      at fi (main-CYvt_zul.js:8:48278)
      ...
  ```
- 首页（不进该页面）"前端不报错"，故此前误判为"无双实例"。
- 报错栈中的 `vendor-Z-adA07W2.js` 是**双 vendor 原始产物**的文件名。

---

## 二、已实测确认的事实（基于当前 dist）

> 所有数据来自本机 `npm run build` 后读取 `dist/assets/`。

### 2.1 两个 vendor chunk 并存，且 html 双加载

| 文件 | 大小 | `react.transitional.element` | `createRoot` | 被 `import` 次数 |
|---|---|---|---|---|
| `vendor-Z-adA07W.js`（无2） | 1,750,491 B ≈ 1,709 KB | 4 | 3 | **0（零 import）** |
| `vendor-Z-adA07W2.js` | 1,741,777 B ≈ 1,700 KB | 4 | 3 | 8（全部业务模块，见下） |

> 更正：原表"1,750 KB / 1,741 KB"实为**字节数**（1,750,491 B / 1,741,777 B），换算 KB 应为 ≈1,709 KB / ≈1,700 KB。合计约 3.33 MB，而非原文"~3.5MB"。

- `dist/index.html` 与 `dist/share/index.html` **都同时引用** `vendor-Z-adA07W.js` 和 `vendor-Z-adA07W2.js`（共 ~3.4MB），但两者**角色不同**：
  - `vendor-Z-adA07W.js`（无2）= html 里的 **`<link rel="modulepreload">`**（静态预下载件，零 import）；
  - `vendor-Z-adA07W2.js` = html 里的 **`<script type="module">`**（被全量业务模块 import 的实际消费方、真机入口）。
  > 注（2026-08-02 实测更正）：`dist/index.html:9` 为无2版的 `<link rel="modulepreload">`，`dist/index.html:12` 为 **`<script type="module" src="./assets/vendor-Z-adA07W2.js">`**。`dist/share/index.html` 同理（第 9 行 preload、第 12 行 script）。即无2版仅被预下载、不被 import，是死重；`adA07W2` 既被 html 以 `<script>` 直接执行、又被全量业务模块 import。
- 所有业务模块（实测 **8 个**：`_react_shim` / `_jsx_runtime` / `App` / `ShareAppPage` / `main` / `share` / `httpClient` / `mediabunny`）的 React 符号 **100% 来自 `adA07W2`**；`adA07W`（无2）**在 dist 内零 `import`**，仅被 html 静态预加载 → 当前是**死重**。
  > 注意：这是**构建后**的事实。源码层所有模块（含 share entry）引用的都是无2版（见 §2.2），是构建工具把它们改写为 `adA07W2`，才导致无2版在 dist 内变成零 import 死重。两层不要混为一谈。

### 2.2 源码引用名与 dist 文件名不一致（关键）

- 源码 `src/bundle/_react_shim.js:1`：`import { Rr as __Rr } from './vendor-Z-adA07W.js';`（**无2**）
- 源码 `src/bundle/main-CYvt_zul.js:4`：`import { Fr as t, Ir as n, Pr as r, Rr as i } from "./vendor-Z-adA07W.js";`（**无2**）
- 但 **dist 产物**中，这两者均被构建工具改写为 `from "./vendor-Z-adA07W2.js"`。

即：源码里逻辑名 `vendor-Z-adA07W.js`（无2）的 React 实现，在构建后实际落在了 `vendor-Z-adA07W2.js`；而 `vendor-Z-adA07W.js`（无2）成为零 import 的死重文件（构建后视角）。

**`adA07W2` 后缀的成因（已定位机制，替代原"chunk 内部双份 React"）：**

> ⚠️ 早期"两个 entry 各自引用同一 chunk、Vite 复制追加 `2`"的假设**与源码事实矛盾**：`src/bundle/` 下**所有**模块（含 `share` entry 的 `share-CyPsaet6.js:4`）引用的都是 `./vendor-Z-adA07W.js`（无2），**没有任何源码引用 `adA07W2`**。因此 `adA07W2` 不是"两个 entry 各持一份复制件"。

**已定位的触发点（2026-08-02 复核，实测确认）：** `vendor-Z-adA07W.js` 同时具备两个身份，导致 Rollup 命名冲突追加 `2` 后缀：
1. **HTML 声明的 entry**：源 `index.html:12` 与 `share/index.html:12` 各有一行 `<link rel="modulepreload" crossorigin href="./src/bundle/vendor-Z-adA07W.js">`。Vite 在构建期扫描 HTML 内的 `modulepreload` 并把它当作一个独立入口处理，于是该文件被产出为 `assets/vendor-Z-adA07W.js`（无2版，entry 身份）。
2. **被业务模块 import 的 manualChunk**：`vite.config.ts:79` 的 `manualChunks` 正则 `src/bundle/([^/]+\.js)$` 把被业务模块 import 的 `vendor-Z-adA07W.js` 强制命名为 `vendor-Z-adA07W`。

由于"entry 身份"已占用 `vendor-Z-adA07W` 这个名字，被 import 的那个同名 chunk 在 Rollup 去重时被迫追加 `2` 后缀 → 产出 `assets/vendor-Z-adA07W2.js`（被全量业务模块消费）。无2版（entry 身份）在 dist 内零 import，成为死重。

> 即：**HTML 里的 `modulepreload` 是该 bug 的触发点**，`manualChunks` 强制命名是配合条件。删掉源 HTML 中的 vendor preload 行即可让 `vendor-Z-adA07W` 只剩"被 import 的 manualChunk"一个身份，名字不再冲突，`2` 后缀消失。原报告"chunk 内部把 React 打包两份、dispatcher 不互通"的说法**在现有代码中找不到依据**，已撤销。

> **审计附注（证据强度说明）**：以下均为已核实的**直接证据**——`index.html:12` / `share/index.html:12` 确有 vendor preload 行；`vite.config.ts:79` 的 `manualChunks` 正则确为 `[\\/]src[\\/]bundle[\\/]([^\\/]+\.js)$`；`vite.config.ts:74` 确设 `modulePreload:false`；源码全域 grep **无任何 `adA07W2` 引用**；产物中两文件并存且 import 归属为 8:0。
>
> 但"**Vite 把 HTML 的 `modulepreload` 当独立入口处理 → 占用名字 → Rollup 追加 `2`**"这一**因果链本身属机制推断**，本轮审计**未通过实验证伪/证实**（未执行"删掉 preload 行后重新构建"的对照实验，因该操作属修改代码，超出"核实报告"范围）。因果链与全部已知证据自洽、且是最合理解释，但**严格意义上仍应标注为"高置信度推断"而非"已证实事实"**。§七 主修方案的有效性需在实施时由对照构建验收（验证命令见 §七）。

### 2.3 项目已刻意设计单实例（与"结构性双实例"论断冲突）

`vite.config.ts` 已配置：
```js
resolve: {
  dedupe: ['react', 'react-dom'],
  alias: {
    'react/jsx-runtime': jsxRuntimeShim,
    'react/jsx-dev-runtime': jsxRuntimeShim,
    'react': reactShim,   // _react_shim.js
  },
}
```
注释明确：「单 React 实例：所有 react 导入统一指向 vendor-Z 内联 React(Rr)，与入口 react-dom(Ir) 同一实例，杜绝 Invalid hook call / 多实例」。

`_react_shim.js` 实现：
```js
import { Rr as __Rr } from './vendor-Z-adA07W.js';   // Rr=React
import { i as __e } from './rolldown-runtime-aKtaBQYM.js';
const React = __e(__Rr(), 1);
export const useMemo = React.useMemo; /* ... 其余 hooks */
```
即 hooks（`useMemo` 等）与 `createRoot`（`Ir`，react-dom）在源码层面**同源**（都来自 `vendor-Z-adA07W.js` 的 `Rr`/`Ir`）。原报告称"adA07W2 内部双份 React、dispatcher 不互通"**无源码依据**，已撤销。

### 2.4 质量门当前真实状态

```
● dist 重复 chunk  FAIL
   [FAIL] 疑似重复 chunk: vendor-Z-adA07W.js + vendor-Z-adA07W2.js
```

`scripts/_smoke_checks.cjs` 的 `checkDistDuplicateChunks` 当前 **FAIL**（base 去 `2$` 后缀后两文件判重）。原报告曾错误声称"工作区干净、质量门无碍"——**与实测相反**，特此更正。

> ✅ 审计已重跑 `npm run test:smoke` 确认：其余全部检查项（dist 入口、MV3 manifest、dist HTML 资源引用、chunk import 图完整性、readable 副本保真、12 项契约漂移）**均 PASS**，**唯一 FAIL 项就是"dist 重复 chunk"**，总结果 `=== 结果: FAILED ===`。即质量门失败面收敛于本报告所述单一问题。

### 2.5 既有约束（原报告未引用，已补）

- `src/bundle/BUNDLE_MAP.md:11`：`vendor-Z-adA07W.js` 标注为「运行时 / **勿改**（React 单实例/外链垫片）」。✅ 行号已核实。
- `CLAUDE.md:139`（铁律 #4「React 单实例不可破」）✅ 行号已核实，原文：「`_react_shim.js` / `_jsx_runtime.js` 经 `vite.config.ts` 的 `resolve.alias` + `dedupe` 绑定到 vendor 工厂，✗ 不可删除/改写/新增独立 react 实例。」
- `scripts/_smoke_checks.cjs:177-195` 的 `checkDistDuplicateChunks` 已将"React 双实例"列为门禁。✅ 已核实其判重逻辑确为 `f.replace(/\.js$/,'').replace(/2$/,'')` 去尾随 `2` 后比对（第 184 行），故 `vendor-Z-adA07W.js` 与 `vendor-Z-adA07W2.js` 必然判重。
- 即：双 vendor 在质量门视角是 **FAIL（待修）**，而非"已知现状、可长期接受"。原报告结论方向错误。

### 2.6 报告早期版本漏掉的两个更严重的 Bug（2026-08-02 复核补充）

对比源 HTML 与产物 HTML 后发现，除"双 vendor 命名冲突"外，还存在两个原稿未记载的事实：

**Bug A：`modulePreload: false` 使源 HTML 的 preload 行被降级为真实执行的 `<script>`，其中包括 `vendor-Z-adA07W2.js`。**

`vite.config.ts:74` 设了 `build.modulePreload: false`。在此配置下，源 HTML 里声明的 `<link rel="modulepreload">` 所对应的模块被 Vite 作为入口注入为 `<script type="module">` 直接执行。**实测 `dist/index.html:9-14`（2026-08-02 重新核实，原稿此处记录有误）**：

```html
 9  <link rel="modulepreload" crossorigin href="./assets/vendor-Z-adA07W.js">
10  <script type="module" crossorigin src="./assets/rolldown-runtime-aKtaBQYM.js"></script>
11  <script type="module" crossorigin src="./assets/src-kC58-PF2.js"></script>
12  <script type="module" crossorigin src="./assets/vendor-Z-adA07W2.js"></script>
13  <script type="module" crossorigin src="./assets/endpointConfig-Bt85xi8d.js"></script>
14  <script type="module" crossorigin src="./assets/main-CYvt_zul.js"></script>
```

`dist/share/index.html` 结构相同（第 9 行 preload、第 12 行 `vendor-Z-adA07W2.js` 的 `<script>`）。

**原稿在此处漏记了第 12 行 `vendor-Z-adA07W2.js` 的 `<script>` 标签**，据此得出"被降级为 `<script>` 的只有 rolldown-runtime / src-kC58-PF2 / endpointConfig 三行、无2版仅是 preload"的描述并不完整。更正后的准确形态是：

- **无2版 `vendor-Z-adA07W.js`**（第 9 行）：产物里确实**仅保留为 `<link rel="modulepreload">`**，且在 dist 内零 import → **确认为纯死重**（仅浪费约 1.71MB 下载，不参与执行）。
- **`adA07W2`**（第 12 行）：**既被 html 以 `<script type="module">` 直接执行，又被全部 8 个业务模块 import**。由于 ESM 对同一 URL 只实例化一次，`<script>` 与 import 共享同一模块实例，因此**这一条本身不产生双 React 实例**。
- `rolldown-runtime` / `src-kC58-PF2` / `endpointConfig`（第 10、11、13 行）同理，属被降级注入的 `<script>`，同为 ESM 单例，不造成重复实例。

**结论修正**：`modulePreload:false` 的降级行为本身**并未**造成双 React 实例；真正的死重只有第 9 行那个零 import 的无2版 vendor。原稿 §四.1 方向 A 所依赖的前提——"无2版被真实执行且其 dispatcher 被业务调用"——**已可判定为不成立**：无2版既未被任何模块 import，也未以 `<script>` 形态注入，`modulepreload` 只做预下载、不执行模块作用域。故**方向 A 应予排除**（详见 §四.1 更新）。

**Bug B：`dist/share/index.html` 错误加载了主应用入口 `main-CYvt_zul.js`。**

实测 `dist/share/index.html:14-15`（行号已按实际产物更正）：

```html
14  <script type="module" crossorigin src="../assets/main-CYvt_zul.js"></script>
15  <script type="module" crossorigin src="../assets/share-CyPsaet6.js"></script>
```

分享页把 `main`（主画布应用）和 `share` 两个入口**同时**挂载到同一个 `#root`。已实测确认 `main-CYvt_zul.js` 与 `share-CyPsaet6.js` 各含 1 处 `createRoot`，故分享页确实会跑两次 `createRoot`。

**成因（已核实到源码层，原稿归因不完整）**：
- **产物** `dist/assets/share-CyPsaet6.js:1` 开头确为 `import{_ as i}from"./main-CYvt_zul.js";`，且 `dist/assets/main-CYvt_zul.js` 确实导出 `export{k as _}`。
- 但**源码** `src/bundle/share-CyPsaet6.js` 中**并不存在**对 `main-CYvt_zul.js` 的任何 import——源码里 `__vite__mapDeps` 是 share 自己定义的本地常量。

即：`share → main` 的依赖是**构建期产生的**（Rollup 把两个 entry 里重复的 `__vite__mapDeps` 辅助函数提取共享，将其归到 `main` 并让 `share` 反向 import），而非源码写死。这一点很关键——它意味着修复不能只"改 share 的 import 语句"（源码里没有这条语句），需从构建产物共享策略入手（见 §七 次修的更正）。

这是**独立于 React 双实例的第二个崩溃源**。

> 两个 Bug 与 §2.2 的双 vendor 命名冲突同源（都源于 HTML 对 `src/bundle/` 文件的不当引用），但修复面不同：Bug A 靠删 HTML 中 vendor preload 行即可消除双 vendor；Bug B 需断开 `share` 对 `main` 的导出依赖（将其抽取到独立小模块）。详见 §七 修复方案。

---

## 三、原尝试与失败（保留事实，修正归因）

| 尝试 | 做法 | 结果 | 原归因（已撤销） | 修正后的可能归因 |
|---|---|---|---|---|
| A | `manualChunks` 排除 `_react_shim`/`_jsx_runtime` | 双 vendor 依旧 | "这两个文件是元凶" | 这两个文件仅 0.1/0.8KB，非元凶；无效 |
| B | `manualChunks` 排除 `vendor-Z-adA07W` 源文件 | `adA07W2` 消失、仅剩一个 vendor；`checkDistDuplicateChunks` 转 PASS；体积减 ~1.75MB | "破坏内部双份 React 绑定导致白屏" | 排除**真源**（`adA07W` 无2 虽零 import，但 shim 相对路径 `./vendor-Z-adA07W.js` 依赖它）后，复制件 `adA07W2` 里 shim 的相对引用失效/未被重新解析，导致白屏（审计归因方向，待验证） |

**结论**：在 `manualChunks` 里硬删/排除 vendor 文件均不可取——既触发质量门 FAIL、又曾导致真机白屏，且 `BUNDLE_MAP.md:11` 已明示该文件"勿改（React 单实例/外链垫片）"（行号已核实）。**但需注意**：这≠"双 vendor 不可修"。§2.2 已定位触发点在 **源 HTML 的 `modulepreload` 声明**，而非 `manualChunks` 本身。正确修法是**删掉源 HTML 里的 vendor preload 行**（不动 `manualChunks`、不动 `src/bundle/`，不违反 BUNDLE_MAP"勿改文件内容"约束），与尝试 B 的"动 manualChunks 排除真源"有本质区别，详见 §七。

> 注（审计）：上表尝试 B 的"修正后归因"（shim 相对路径引用失效致白屏）**仍是推断，未经复现验证**。本轮审计未重跑尝试 B（涉及改配置 + 真机验证，超出报告核实范围），故该单元格保持"待验证"定性，不应作为结论引用。

---

## 四、待复核假设（不再断言为结论）

> 本节原假设 2（`adA07W2` 后缀成因）已在 §2.2 实测定位为"HTML `modulepreload` 触发 entry 身份 + `manualChunks` 强制命名导致命名冲突"，故从假设中移除、升级为已定位事实。

1. **`useMemo` 崩溃根因（方向 A 已排除，B/C 待验证）**：
   - **方向 A（2026-08-02 复核后：已排除）**：原假设为"两份 vendor 各持独立 `ReactCurrentDispatcher`，业务调用到 dispatcher 为 null 的那一份"。该方向依赖"无2版被真实执行且其 dispatcher 被业务调用"，现已实测否定：无2版 `vendor-Z-adA07W.js` 在 dist 内**零 import**（§2.1），在 `dist/index.html` / `dist/share/index.html` 中**仅为第 9 行 `<link rel="modulepreload">`、未被注入为 `<script>`**（§2.6 已更正）。`modulepreload` 只做预下载、不执行模块作用域，故其内部 React 从未初始化、其 dispatcher 不可能被业务调用。**无2版是纯下载浪费（≈1.71MB），不是崩溃源**。
   - **方向 B（当前最可能，仍待真机验证）**：崩溃点落在被全量消费的 `adA07W2` 内部。已实测确认两份 vendor 都存在 hooks 桥接层，形如：
     - `vendor-Z-adA07W.js`：`e.useMemo=function(e,t){return w.H.useMemo(e,t);}`
     - `vendor-Z-adA07W2.js`：`e.useMemo=function(U,ye){return I.H.useMemo(U,ye)}`

     即 hooks 全部转发到 `I.H`（React 内部 dispatcher 槽，对应 `ReactSharedInternals.H`）。**`I.H` 在 React 未处于渲染阶段时本就为 `null`**，此时调用 `useMemo` 正是报错 `Cannot read properties of null (reading 'useMemo')`。这与报错栈 `at e.useMemo (vendor-Z-adA07W2.js:1:7323)` 完全吻合。
     需注意：该桥接结构是 React 19 的**正常产物形态**，并非"复制导致桥接断裂"。因此真正要查的是**为何在非渲染上下文调用了 hook**——最可能是组件树被两个不同的 `createRoot` 渲染循环干扰（见方向 C），而非 chunk 复制本身。原稿"`manualChunks` 复制出 adA07W2 后桥接断裂"的表述**无证据支持，应撤销**。
   - **方向 C（§2.6 Bug B，已定位事实；崩溃相关性最高）**：`dist/share/index.html` 同时加载 `main` 与 `share` 两个 entry，且已实测两者各含 1 处 `createRoot`，分享页确实跑两次 `createRoot` 挂载同一 `#root`。两个 root 并发渲染会互相打断渲染阶段，正是方向 B 中 `I.H` 为 null 的合理诱因。**方向 B 与 C 很可能是同一问题的两面**（C 是因，B 是表现）。
   - 综上（更正后）：双 vendor 是**质量门 FAIL 与体积浪费**问题，但**已可判定不是 `useMemo` 崩溃的直接原因**（方向 A 排除）。崩溃最可能由 **Bug B 的双 `createRoot`（方向 C）** 引发、表现为 **`I.H` 为 null（方向 B）**，仍需真机验证闭环。
   - 原报告"chunk 内部双份 React"**已排除为无据臆测**。
3. **`dedupe` 是否对 `src/bundle/` 内联 React 生效**：因 alias 已将全局 `react` 指向 `_react_shim`（内联 React 的再导出），源码层单实例成立；`dedupe` 在此场景实际不起决定作用（它只对 `node_modules` 内的 `react`/`react-dom` 解析去重，而本项目 React 是 `src/bundle/` 内联实现，由 alias 接管）。产物分裂成双 vendor 的原因是 HTML `modulepreload` 把 `vendor-Z-adA07W` 额外拉成一个 entry 身份（§2.2），与 alias/dedupe 无关——alias/dedupe 作用于**模块解析**层，而命名冲突发生在**产物命名**层，两者不在同一阶段，故 alias/dedupe 无法阻止该冲突。此缺口已由 §2.2 闭合。

---

## 五、可复现命令（已实测）

```bash
npm run build

# 各 dist js 对两个 vendor 的真实 import 归属（结果：全 import adA07W2，无2份=0）
node -e 'const fs=require("fs");const files=fs.readdirSync("dist/assets").filter(f=>f.endsWith(".js"));for(const f of files){const s=fs.readFileSync("dist/assets/"+f,"utf8");const a=(s.match(/from"\.\/vendor-Z-adA07W\.js"/g)||[]).length;const a2=(s.match(/from"\.\/vendor-Z-adA07W2\.js"/g)||[]).length;if(a>0||a2>0)console.log(f.padEnd(34),"adA07W="+a,"adA07W2="+a2);}'

# 各文件内含 React 实现特征（结果：两个 vendor 各含完整 React）
node -e 'const fs=require("fs");const files=fs.readdirSync("dist/assets").filter(f=>f.endsWith(".js"));for(const f of files){const s=fs.readFileSync("dist/assets/"+f,"utf8");const te=(s.match(/react\.transitional\.element/g)||[]).length;const cr=(s.match(/createRoot/g)||[]).length;if(te>0||cr>0)console.log(f.padEnd(34),"transitional.element="+te,"createRoot="+cr);}'

# 质量门真实状态（结果：FAIL）
npm run test:smoke
```

---

## 六、结论（已定位根因，给出修复方向）

1. 当前仓库存在双 `vendor-Z-adA07W` chunk，且 `checkDistDuplicateChunks` **FAIL**，属质量门待修项，非"可长期接受的现状"。
2. 两个 chunk 各含一份完整 React 实现；产物中 `adA07W2` 被全量业务模块消费、**且在 html 中以 `<script type="module">` 注入**（`dist/index.html:12`）；`adA07W`（无2）在 dist 内零 import，且**仅为 `<link rel="modulepreload">`（第 9 行）**，从不执行 → **纯死重，约 1.71MB 无效下载**。源码引用名（无2版）与 dist 实际文件名（`adA07W2`）不一致，成因已定位：源 HTML 的 `modulepreload` 把 `vendor-Z-adA07W.js` 变成 entry 身份、与 `manualChunks` 强制命名的同名 chunk 冲突 → 追加 `2` 后缀（§2.2）。
3. 项目已用 `alias`（+ `dedupe`）刻意设计单实例，源码层面 hooks 与 react-dom 同源；原报告"chunk 内部双份 React"无据，已撤销。HTML `modulepreload` 造成的分裂发生在**产物命名层**，而 alias/dedupe 作用于**模块解析层**，两者不同阶段，故 alias/dedupe 无法阻止（§四.3）。
4. **`useMemo` 崩溃归因已实质性更正**：方向 A（"无2版 dispatcher 被调用"）**已排除**——无2版零 import 且仅被 preload、模块作用域从不执行。因此**双 vendor 并非崩溃直接原因，它是质量门 FAIL + 体积浪费问题**。崩溃最可能源于 **§2.6 Bug B 的分享页双 `createRoot`（方向 C，已实测确认 main/share 各含 1 处 createRoot）**，表现为 hooks 桥接 `I.H` 在非渲染阶段为 null（方向 B，与报错栈吻合），仍需真机验证闭环。
5. 双 vendor 命名冲突根因已定位、主修方案明确（§七 主修：删 HTML preload 行），质量门 FAIL 项可直接据此立项修复。但**需修正预期**：主修解决的是质量门 FAIL 与 1.71MB 体积，**不应预期它能消除 `useMemo` 崩溃**；崩溃修复需落在次修（消除 share 页重复注入 `main`）。两项应分别立项、分别验收。

---

## 七、修复方案（2026-08-02 复核补充，待实施）

> 本方案方向已据源码/产物实测确认，但**实际改动代码不在本报告范围内**（本报告仅记录）。下列步骤供后续修复任务直接采用。

### 主修：删掉源 HTML 的 vendor preload 行（解决双 vendor + React 双实例）

源 `index.html:12` 与 `share/index.html:12` 各删除：

```html
<link rel="modulepreload" crossorigin href="./src/bundle/vendor-Z-adA07W.js">
<!-- share 版路径为 ../src/bundle/vendor-Z-adA07W.js -->
```

删后，`vendor-Z-adA07W` 只剩"被 import 的 manualChunk"一个身份，名字不再冲突，`2` 后缀消失，`checkDistDuplicateChunks` 转 PASS，产物减约 1.75MB。该文件本就会被 `main`/`share` 通过 import 图正常拉取，preload 纯属多余且是 bug 触发点。

**与 §三尝试 B 的本质区别**：尝试 B 在 `manualChunks` 排除真源、破坏了 shim 相对路径引用才白屏；本方案不动 `manualChunks`、不动 `src/bundle/` 任何文件，不违反 `BUNDLE_MAP.md` 的"勿改文件内容"约束（那条约束管 `vendor-Z-adA07W.js` 文件本身，不管 HTML 里的 preload 声明）。

**关于其余三行 preload（更正）**：`rolldown-runtime` / `src-kC58-PF2` / `endpointConfig` 被降级注入为 `<script>`（dist/index.html:10、11、13）。但由于 ESM 对同一 URL 只实例化一次，这些 `<script>` 与业务 import 共享同一模块实例，**不产生重复实例、不属于隐患**，原稿"同类风险"的定性偏重。它们至多是"提前执行顺序"的行为差异，**无需强行删除**；若要清理可一并处理，但不是修复双 vendor 的必要条件。

### 次修：消除 share 页重复注入 main（解决 Bug B 双 createRoot）

⚠️ **原稿此处方案基于误判，已更正**：源码 `src/bundle/share-CyPsaet6.js` 中**并不存在** `import{_ as i}from"./main-CYvt_zul.js"` 这条语句（该 import 只出现在**构建产物**里）。因此"把 share 里那条 import 改掉"是无法执行的——源码里没有可改的目标。

真实成因：`main` 与 `share` 两个 entry 各自源码中都定义了同名的 `__vite__mapDeps` 辅助函数，Rollup 在构建期将其**提取为共享代码**、归属到 `main`，再让 `share` 反向 `import`，从而把 `main` 提升为 share 页的共享 entry 一并注入。

可选修复方向（需实测选定，本报告不指定唯一解）：
1. 在 `manualChunks` 中把 `main-CYvt_zul.js` 显式排除出共享提升，或将 mapDeps 辅助函数强制归入一个公共 chunk（如 `rolldown-runtime`），使 `share` 只依赖公共 chunk 而非 `main`。
2. 令两个 entry 的 `__vite__mapDeps` 不再等价（例如各自内联），避免 Rollup 判定为可共享代码。
3. 在 `post-build-fixups` 插件中直接剔除 `dist/share/index.html` 里的 `main-CYvt_zul.js` `<script>` 行——**代价最小、最贴合本项目既有做法**（该插件已在做 HTML 修正），但属产物层兜底而非根治。

无论采用哪种，验收标准一致：`dist/share/index.html` 不再注入 `main-CYvt_zul.js`，分享页只跑一次 `createRoot`。

### 验证步骤（待实施时执行）

```bash
npm run build
ls dist/assets/vendor-Z-adA07W*.js        # 期望只剩 1 个（无 2 后缀）
grep -n 'script\|modulepreload' dist/share/index.html    # 期望无 main-CYvt_zul.js
npm run test:smoke                        # 期望 dist 重复 chunk PASS
```

再真机打开带 Three.js 的画布页与分享页，分别确认 `Multiple instances of Three.js` 与 `useMemo` 崩溃是否消失。

> **预期需分开看待（审计更正）**：
> - **主修（删 vendor preload）** → 预期解决：质量门 FAIL、约 1.71MB 体积。**不预期解决 `useMemo` 崩溃**（方向 A 已排除）。
> - **次修（消除 share 页重复注入 main）** → 预期解决：分享页双 `createRoot` 及由此引发的 `useMemo` 崩溃。
> - `Multiple instances of Three.js`：审计已实测其分布——`Multiple instances of Three` 警告串与 `REVISION` 标记**各出现 1 次，且只存在于两个 vendor chunk 中**（其余 chunk 均为 0）。即 Three.js 确实随 vendor 被打了两份。但结合方向 A 的排除结论（无2版从不执行），**运行时实际只有 `adA07W2` 一份 Three.js 被实例化**，该警告理论上不应由双 vendor 触发。故其真实成因**仍未定位**，原稿"大概率源于同一双 vendor，会一并解决"属推测，应降级为待查项；若主修后警告仍在，需单独排查（例如分享页双 entry 导致 vendor 被执行两轮）。

---

## 八、修复方案候选集（5 选，仅陈述方案与机制，不含优劣评价）

> 以下 5 个方案均基于 §2.1–§2.6 已核实的源码/产物事实。每个方案附「源码核实」标注其依据与可行性前提，不作主观排序。实际采用哪一个需另行决策。

### 方案 S1：删除源 HTML 中 vendor 的 `modulepreload` 行

- **做法**：删除 `index.html:12`、`share/index.html:12`、`public/share/index.html:12` 三处 `<link rel="modulepreload" ... href=".../vendor-Z-adA07W.js">`。
- **机制**：源 HTML 的 `modulepreload` 被 Vite 当 entry（§2.2 已定位），占用输出名 `vendor-Z-adA07W`；`manualChunks`（`vite.config.ts:79`）又对同名源文件强制命名 `vendor-Z-adA07W`，冲突 → 追加 `2` 后缀。删掉该行后，`vendor-Z-adA07W` 只剩"被 import 的 manualChunk"一个身份，名字不再冲突，`2` 后缀消失。
- **源码核实**：三处 modulepreload 行已实测存在（grep `*.html` 命中 3 处，分别位于 `index.html:12` / `share/index.html:12` / `public/share/index.html:12`）。`vendor-Z-adA07W.js` 本就被 `main-CYvt_zul.js:4` 与 `share-CyPsaet6.js:4` 经 `import` 拉取（已读两文件确认），preload 声明确属冗余。该方案不动 `src/bundle/` 任何文件、`_react_shim.js:1` 的相对路径 `./vendor-Z-adA07W.js` 不受影响。

### 方案 S2：S1 + 消除 share 页重复注入 `main`

- **做法**：先执行 S1；另需消除 `dist/share/index.html` 中 `main-CYvt_zul.js` 的 `<script>` 注入（§2.6 Bug B）。因**源码 `share-CyPsaet6.js` 并不 `import` `main-CYvt_zul.js`**（已 grep 源码 0 命中，仅在 BUNDLE_MAP.md 文档出现），`main` 是被 Rollup 因两个 entry 同名 `__vite__mapDeps` 辅助函数提取为共享代码后反向提升注入的（见 §七 次修说明）。可选落点：
  1. `manualChunks` 中显式排除 `main-CYvt_zul.js` 的共享提升，或将 `__vite__mapDeps` 强制归入公共 chunk（如 `rolldown-runtime`）；
  2. 令两个 entry 的 `__vite__mapDeps` 不再等价（各自内联），避免被判定为可共享代码；
  3. 在 `post-build-fixups` 插件（`vite.config.ts:37-71`）中剔除 `dist/share/index.html` 的 `main-CYvt_zul.js` `<script>` 行。
- **机制**：S1 解决双 vendor 命名冲突；消除 share 页的 `main` 注入使分享页只跑一次 `createRoot`（两个 entry 的 `createRoot` 已读 `main-CYvt_zul.js:91` 与 `share-CyPsaet6.js:21` 确认各一处）。
- **源码核实**：`main-CYvt_zul.js` 与 `share-CyPsaet6.js` 各自的 `__vite__mapDeps` 已读（两文件第 1 行），均为同名 mapDeps 函数、各自 import vendor、各自动态 `import()` 懒加载（`App-BX6o9fW5.js` / `ShareAppPage-C4RerI9i.js`）。`post-build-fixups` 插件确存在于 `vite.config.ts` 且已对 HTML 做修正（补 css、剥 data: modulepreload），具备加一条正则剔除 main script 的工程基础。

### 方案 S4：修改 `manualChunks` 正则，为 vendor 加命名前缀避免冲突

- **做法**：将 `vite.config.ts:79` 的 `manualChunks` 改为对 `vendor-Z-adA07W.js` 返回带前缀的名字（如 `chunk-vendor-Z-adA07W`），使其与 HTML entry 占用的 `vendor-Z-adA07W` 不再同名。
- **机制**：命名冲突的根源是"HTML entry 名"与"manualChunks 名"相同。改 manualChunks 命名后，被 import 的 chunk 名为 `chunk-vendor-Z-adA07W`，HTML entry 仍占 `vendor-Z-adA07W`，两者不再冲突，`2` 后缀消失。
- **源码核实**：`manualChunks` 正则 `src/bundle/([^/]+\.js)$` 已读（第 79 行），对 `vendor-Z-adA07W.js` 返回 `vendor-Z-adA07W`（去 `.js`）。`_react_shim.js:1` 用相对路径 `./vendor-Z-adA07W.js` import，manualChunks 仅决定产物 chunk 文件名、不改变模块 import specifier，故改命名不影响 shim 解析。需注意：`BUNDLE_MAP.md:11` 记载的 chunk 名为 `vendor-Z-adA07W.js`，改名后该文档与任何按名引用的位置需同步更新。

### 方案 S9：在 `post-build-fixups` 插件中剥离 HTML 的 vendor modulepreload

- **做法**：在 `vite.config.ts` 的 `post-build-fixups` 插件 `closeBundle` 阶段（已有 HTML 修正循环，第 56-68 行），对 `dist/index.html` 与 `dist/share/index.html` 增加一条正则，删除 `<link rel="modulepreload" ... vendor-Z-adA07W.js>`。
- **机制**：与 S1 等效——从源头消除 vendor 被当 entry 的触发点；区别在 S1 改源 HTML、S9 改构建期插件，源 HTML 保留手写 preload（开发期可能仍想预加载）。
- **源码核实**：`post-build-fixups` 插件已读（第 37-71 行），其 `closeBundle` 已有遍历 `dist/index.html` / `dist/share/index.html` 并做字符串替换的逻辑（第 56-68 行补 css、剥 data: modulepreload），加一条正则删除 vendor modulepreload 在结构上可行，且不触碰 `src/bundle/` 文件。

### 方案 S10：删除源 HTML 全部 4 行手写 preload

- **做法**：删除 `index.html:10-13` 与 `share/index.html:10-12` / `public/share/index.html:10-12` 中全部手写 `modulepreload`（`rolldown-runtime` / `src-kC58-PF2` / `vendor-Z-adA07W` / `endpointConfig`）。
- **机制**：这 4 行均为开发者手写声明，而 `vite.config.ts:74` 已设 `modulePreload: false`（表明不依赖自动 preload）。手写行与配置意图冲突，且是 HTML 把 `src/bundle/` 文件额外拉入构建图的来源。全删后所有依赖经 import 图自然产出，无 entry 身份冲突。
- **源码核实**：4 行 preload 已 grep 实测（`index.html:10-13` 含 rolldown-runtime/src-kC58-PF2/vendor-Z-adA07W/endpointConfig 四行；`share/index.html:10-12` 与 `public/share/index.html:10-12` 含前三行，无 endpointConfig）。`modulePreload:false` 已读（第 74 行）。注意：`src-DoQUrSOl.css` 由 `post-build-fixups` 补回（第 59-64 行），不在手写 preload 之列，不受本方案影响；`vite.config.ts` 注释 ③ 表明 data: modulepreload 已被该插件剥离，与 S10 手写行无重叠。

---

### 方案核实汇总（事实锚点）

| 方案 | 依据事实（已核实） | 可行性前提 |
|---|---|---|
| S1 | 3 处 vendor modulepreload 实测存在；vendor 已被两 entry import | 删冗余声明，不动 src/bundle |
| S2 | share 源码无 import main（0 命中）；main/share 各 1 处 createRoot | 需另定"消除 share 注入 main"的具体落点 |
| S4 | manualChunks 正则返回 `vendor-Z-adA07W`；shim 用相对路径不受影响 | 改名后需同步 BUNDLE_MAP 按名引用 |
| S9 | post-build-fixups 已有 HTML 字符串替换循环 | 源 HTML 保留 preload、产物层剥离 |
| S10 | 4 行手写 preload 实测存在；modulePreload:false 已设 | css 补回逻辑不受牵连 |

---

## 九、试错日志（AI 避坑清单 · 每次失败必记录）

> **本章节为错误记录区**：仅记录真机实测失败的方法与现象，供后续 AI 避坑参考。后续 AI 自行判断如何排查，**本记录不预设方向、不给方案建议**。登记内容：方法 / 做法 / 真机结果 / 失败现象。验收以真机报错栈消失为准。
>
> ✅ **2026-08-03 更正**：下方「试错 #1」记录的 S1 失败，经本次**干净重建产物 + 真机复测**已证伪——S1 确证成功（见文末「试错 #3 · 成功」）。旧记录真机失败疑因测试时产物陈旧（`adA07W2` 仅存在于陈旧产物），并非 S1 无效。

### 试错 #1 — 方法 S1：删除源 HTML 中 vendor 的 `modulepreload` 行（主修）

- **做法**：删 `index.html` / `share/index.html` / `public/share/index.html` 三处 `<link modulepreload ... vendor-Z-adA07W.js>`。
- **对照构建结果（静态）**：`adA07W2` 消失，`dist/assets/` 只剩 `vendor-Z-adA07W.js`（无2版一份）；`__vite__mapDeps` 依赖数组引用的 vendor 名也是 `vendor-Z-adA07W.js`（与唯一 React 副本同名）；质量门 `dist 重复 chunk` PASS；`npm run test:smoke` ALL PASS；全产物含 `react.transitional.element` 的文件数 = **1**（即确证只有一份 React 实例）。
- **真机结果**：⚠️ 此条已被「试错 #3」推翻。旧记录"仍报同样的 `useMemo` 崩溃 + `Multiple instances of Three.js`，报错栈含 `adA07W2`"——疑为测试时产物陈旧（未随最新源码重建，`adA07W2` 只存在于陈旧产物），并非 S1 本身无效。
- **失败根因（未定位，已被成功复测推翻）**：S1 后产物静态层确证单实例（只剩 1 个 React 文件、mapDeps 指向它、质量门 PASS），但真机仍崩。说明 S1 未触及真正的运行时双实例路径，双实例另有成因，待新方法排查。——经 2026-08-03 干净重建 + 真机复测，S1 已修复，此归因作废。
- **避坑记录（供参考，非指导）**：S1 静态层确证单实例（只剩 1 个 React 文件、质量门 PASS），但真机仍报 `useMemo` 崩溃。即"产物质检 PASS / 静态单实例"与"真机修复"在本项目中不一致，后续 AI 可注意此现象。

### 试错 #2 — 方法 S2：S1 + 在 `post-build-fixups` 剔除 share 页 `main-CYvt_zul.js` 的 `<script>`

- **做法**：先执行 S1，并在 `vite.config.ts` 的 `post-build-fixups` 插件 `closeBundle` 中加正则剔除 `dist/share/index.html` 里 `../assets/main-CYvt_zul.js` 的 `<script>`（意图消除分享页双 `createRoot`）。
- **真机结果**：❌ 未单独真机验证即被撤销（因发现 S1 本身真机已崩，叠加此改动风险更高）；且逻辑上剔除 main script 会破坏 `main`/`share` 共享的 `__vite__mapDeps` 链路，可能导致分享页白屏或功能缺失。
- **失败根因**：基于原报告"方向 A 已排除、崩溃源于 share 双 createRoot（方向 C）"的**错误前提**。真机已证伪方向 A 排除（无2版确实执行），故"消除 share 双 createRoot"并非崩溃根因，此改动属无的放矢且引入新风险。
- **避坑记录（供参考，非指导）**：S2 基于原报告"方向 A 已排除、崩溃源于 share 双 createRoot"的前提，但真机已证伪该前提（无2版 vendor 确实在运行时执行），故 S2 的出发点不成立。后续 AI 可注意此前提已被推翻。

### 当前未决根因（待新方法验证）

- **已实证（静态层，强证据）**：未改动的原始工作区 `npm run build` 后，`dist/assets/` 同时产出 `vendor-Z-adA07W.js` 与 `vendor-Z-adA07W2.js` 两个完整 React 副本（各 ~1.7MB）；所有业务模块静态 `import` 指向 `adA07W2`；HTML 第 9 行 `<link modulepreload>` 声明无2版、第 12 行 `<script>` 加载 `adA07W2`；`main`/`share`/`httpClient` 的 `__vite__mapDeps` 依赖数组含 `./vendor-Z-adA07W.js`。真机栈 `useMemo@adA07W2` + `fi@(无2版)` 证明运行时两份都被实例化、dispatcher 不互通 → 崩溃。
- **S1 的静态验证**：删三处 vendor preload 后重新 build，产物仅 1 个 React 文件、mapDeps 也指向它、质量门 PASS。但真机复跑仍报同样的 `useMemo` 崩溃，故 S1 未解决运行时双实例问题，根因仍未定位（后续 AI 自行排查）。——⚠️ 此段"S1 真机仍崩"结论已被 2026-08-03 复测推翻，见下方「试错 #3 · 成功」。

### 试错 #3 — 方法 S1（干净重建产物 + 真机复测）【✅ 成功 · 验收通过】

- **做法**：删除 `index.html` / `share/index.html` / `public/share/index.html` 三处 `<link rel="modulepreload" ... vendor-Z-adA07W.js>`（各删 1 行），随后用最新源码 `npm run build` **干净重建** `dist/` 再真机测试。
- **静态验证（已通过）**：重建后 `dist/assets/` 只剩 1 个 `vendor-Z-adA07W.js`，`adA07W2` 彻底消失；全部 8 个业务模块（`main`/`share`/`App`/`ShareAppPage`/`_react_shim`/`_jsx_runtime`/`httpClient`/`mediabunny`）的 React 符号 100% 指向同一份 vendor；`dist/index.html` 只剩单 vendor 的 `<script>`；`npm run test:smoke` **ALL PASS**（含 `dist 重复 chunk  PASS`）。
- **真机结果（✅ 验收通过）**：打开带 Three.js 的画布页，`useMemo` 崩溃**消失**、`Multiple instances of Three.js` 警告**消失**。真机报错栈消失，闭环达成。
- **成功归因（高置信度，与 §2.2 机制一致）**：源 HTML 的 vendor `modulepreload` 把 `vendor-Z-adA07W.js` 变成 entry 身份，与 `manualChunks` 强制命名的同名 chunk 冲突 → Rollup 追加 `2` 后缀产出 `adA07W2`。于是 `main` 用无2版 vendor 的 react-dom 渲染 App，而 App 的 hooks 经静态改写解析到 `adA07W2` 的 React → dispatcher 为 null → `useMemo` 崩溃。删掉 preload 后 vendor 只剩"被 import 的 manualChunk"一个身份，双 vendor / 双 React 实例消除，崩溃根除。
- **避坑记录（供参考，非指导）**：**真机测试前务必用最新源码 `npm run build` 干净重建 `dist/`，并确认 `dist/assets/` 无陈旧 `adA07W2.js` 残留**。此前「试错 #1」误判 S1 失败，极可能正是测试时产物陈旧所致——陈旧产物里仍有 `adA07W2`，导致真机复现了旧崩溃。

### 遗留跟踪（已闭环）

- **Bug B（§2.6 / 方向 C）**：`dist/share/index.html` 同时注入 `main-CYvt_zul.js` 与 `share-CyPsaet6.js`，分享页跑双 `createRoot` 挂载同一 `#root`。✅ **已于 2026-08-03 修复并真机验证通过**（`post-build-fixups` ④ 剔除 share 页 main 注入 + 剥离 share 对 main 的 import），见报告顶部「Bug B 修复已真机验证闭环」。验收标准达成：`dist/share/index.html` 不再注入 `main-CYvt_zul.js`。
