# 30-前端 chunk 动态加载 502 / MIME 报错排查记录

> 状态：**排障记录（已定位疑点，未定稿修复）**
> 日期：2026-08-06
> 优先级：中。影响画布「视频处理工具」（截取/提取音频/尺寸帧率/拼接）及任何触发 mp4box 动态加载的场景。
> 目的：给后续 agent 留档本次排查的证据链、已试方案与疑点，避免重复劳动。

---

## 一、现象

### ⚠️ 关键触发条件（2026-08-06 用户补充，核心信息）
**报错只在用户使用「视频处理节点 → 帧率/分辨率」功能、点「开始处理」那一刻才出现**，不是页面加载时就报。

即：
- 画布页面**正常加载/日常使用无此报错**（页面加载的 assets 路径都是对的）；
- 只有**触发帧率/分辨率处理**时才**懒加载** mp4box 库（`src-_qSScO88.js`）及其依赖（`rolldown-runtime-aKtaBQYM.js`、`mediabunny`、`vendor`），此刻才产生「根路径 chunk 请求」→ 502/HTML/MIME 错。

**排查含义**：根因在「按需动态加载 mp4box 的 chunk 路径解析」这一环，而非页面入口加载。复现时需在视频处理节点操作，不能只看页面加载日志。

浏览器 DevTools 报错（普通窗口 + 无痕窗口均复现）：

```
Failed to load module script: Expected a JavaScript-or-Wasm module script
but the server responded with a MIME type of "text/html".
Strict MIME type checking is enforced for module scripts per HTML spec.
rolldown-runtime-aKtaBQYM.js:1 ...
src-_qSScO88.js:1 ...
```

同时伴随：
```
A VideoFrame was garbage collected without being closed. ...
（来自 src-_qSScO88_components/ 的 mediabunny/mp4box 处理）
```

画布「视频处理」界面（`httpClient-BknZwXjG_components/Gc.jsx`）点「开始处理」出现 `Assertion failed.`（mp4box 内部断言，见 §三）。

> 注意：本问题与「视频去字幕」功能（`docs/29`）**无关**。这是画布内置视频处理工具（截取/尺寸帧率/拼接）的 chunk 加载问题；`docs/29` 的去字幕在 localTool 与前端均未实现。

---

## 二、已确认的证据链（只读排查，不改代码）

### 1. localTool 端 assets 托管正常
用 Node `fetch` 验证：
- `GET /assets/src-_qSScO88.js` → **200，`application/javascript`，634KB**（正确）
- `GET /assets/rolldown-runtime-aKtaBQYM.js` → **200，`application/javascript`，1082B**（正确）
- `GET /`（index.html）→ **200，引用 `./assets/...`**（正确，5 个 script 均带 `assets/` 前缀）

### 2. 根路径请求被 passthrough 转官方 → text/html
- `GET /src-_qSScO88.js`（根路径，无 `assets/`）→ **200，`text/html`（官方 1mao 兜底页）**
- `GET /rolldown-runtime-aKtaBQYM.js`（根路径）→ **200，`text/html`**

原因：localTool 的 `handleFrontendPage`（`localTool/src/index.ts`）只从 `dist/` 根找文件；根路径 chunk 不存在 → `return false` → 落入 catch-all `passthrough`（`localTool/src/routes/passthrough.ts`，只豁免 `/files/`、`/plugin/`）→ 转发官方 `1mao.cc` → 官方返回 HTML → 浏览器严格 MIME 检查拒绝执行。

### 3. localTool 日志确认浏览器同时请求了「根路径」与「assets 路径」
`localTool/logs/localtool_18080.log`（触发帧率/分辨率处理时的按需加载序列）：
```
[GET] /assets/main-CYvt_zul.js
[GET] /assets/App-BX6o9fW5.js
[GET] /assets/httpClient-BknZwXjG.js   ← 视频处理节点所在入口，此时才懒加载 mp4box
[GET] /src-_qSScO88.js            ← 根路径（错误）→ passthrough 转官方 → text/html
[GET] /rolldown-runtime-aKtaBQYM.js  ← 根路径（错误）
[GET] /assets/src-_qSScO88.js     ← assets 路径（正确）
[passthrough] GET /src-_qSScO88.js -> www.1mao.cc | 200
```
> 这段「根路径 + assets 路径」并存的请求，正是**点「开始处理」触发 mp4box 懒加载**时产生的；页面日常加载时没有这段。

**证明：浏览器确实发出了根路径请求**，且无痕（无缓存）也复现 → **不是浏览器缓存问题**，是产物层面的 URL 解析 bug。

---

## 三、定位到的疑点（最可能根因）

`src/bundle/httpClient-BknZwXjG_components/shared.js` 的 **`__vite__mapDeps` 数组**：

```js
const __vite__mapDeps = (i, m = __vite__mapDeps, d = m.f ||= [
  '../src-_qSScO88.js',              // ⚠️ 用了 ../，疑似应为 ./
  '../rolldown-runtime-aKtaBQYM.js', // ⚠️
  '../mediabunny-mp3-encoder-CZeRAvEV.js', // ⚠️
  '../vendor-Z-adA07W.js',           // ⚠️
  './vendor-Qkhkn02K.css'            // 这里是 ./
]) => { ... };
```

**为何错误**：
- 该源码文件位于 `src/bundle/httpClient-BknZwXjG_components/` **子目录**，逆向还原时用 `../` 指向上一层的 chunk（源码层面正确）。
- 但 Vite build 后**所有文件打进 `dist/assets/` 同层**。
  - 静态 `import '../xxx.js'` → rolldown 会自动重写为 `./xxx.js`（正确，已验证 dist 产物里静态 import 全是 `./`）。
  - **`__vite__mapDeps` 数组是运行时字符串，rolldown 不重写** → build 后保留 `../`。
- 运行时 `httpClient-BknZwXjG.js` 在 `assets/`，`new URL('../src-_qSScO88.js', <assets url>)` = **根路径 `/src-_qSScO88.js`** → 502/HTML/MIME 错。

**对照组**（这些是正确的，因为源码在 `src/bundle/` 根，用 `./`）：
- `src/bundle/main-CYvt_zul.js`：`__vite__mapDeps` 用 `./App-BX6o9fW5.js` 等 ✓
- `src/bundle/share-CyPsaet6.js`：用 `./...` ✓
- `src/bundle/mediabunny-mp3-encoder-CZeRAvEV.js`：用 `./...` ✓

---

## 四、已试方案与结果（勿重蹈）

### 试过：把 `../` 改成 `./` 重新 build
- 改动：`src/bundle/httpClient-BknZwXjG_components/shared.js` 的 mapDeps 数组 `../`→`./`。
- 结果：`npm run build` 成功，dist 的 `$d` 数组确认变成 `./`；chunk import 图 smoke PASS。
- **但用户反馈问题仍未解决**，且要求撤销 → 已全部还原 + 重新 build 恢复 `../`。
- **教训**：`../`→`./` 未必是完整根因，或存在**其它未覆盖的 mapDeps 数组 / 静态 import** 同样触发根路径请求。

### 待排查方向（给后续 agent）
> **复现步骤（必做）**：开 DevTools → Network（勾选保留日志）→ 进入画布「视频处理」节点 → 选「帧率/分辨率」→ 上传/选视频 → 点「开始处理」→ 观察此时冒出的根路径请求（`/src-_qSScO88.js`、`/rolldown-runtime-aKtaBQYM.js`）。页面加载阶段不会触发，别只看首页加载。

1. **grep `__vite__mapDeps` 全量**（`src/bundle/`），确认是否还有其它子目录文件（`*_components/`）的 mapDeps 数组用 `../`。本次只确认了 httpClient 一处，`App-BX6o9fW5_components/`、`src-_qSScO88_components/` 的 **静态 import** `../xxx.js` 理论上被 rolldown 重写，但需实证。
2. **grep `import('../xxx.js')` 动态 import**：确认所有动态 import 的路径前缀在 build 产物里是否正确。
3. **用浏览器 DevTools → Network → 点击根路径请求看 Initiator**，精确定位是静态 import、`__vite__mapDeps` 预加载、还是 `new URL()` 发的；同时看 **Size 列**确认是否命中缓存。
4. **对比 rolldown 产物**：确认 rolldown 对 `*_components/` 子目录文件的 chunk 相对路径处理是否有系统性 bug（可考虑 build 后在 `post-build-fixups`（`vite.config.ts` 的 `closeBundle`）里做**产物级修复**：把 `dist/assets/*.js` 中 `"../src-*.js"`、`"../rolldown-*.js"` 等指向同目录 chunk 的 `../` 批量替换为 `./`。**此法不动 `src/bundle/`，只改构建收尾**，风险更低，值得优先评估）。
5. 附带确认：`localTool` 的 `handleFrontendPage` 是否应把**未命中 `dist/` 的静态资源请求**直接返回 404（而非 passthrough 转官方）——这是防「根路径 chunk → 502/HTML」的最后一道闸，但属行为变更，需评估对现有透传的影响。

---

## 五、约束与红线（改动前必读）

- **禁止直接手改 `dist/`**：前端改动一律改 `src/bundle/` 后 `npm run build` 回灌（CLAUDE.md §5.4）；或改 `vite.config.ts` 的 `post-build-fixups`（产物级收尾）。
- 若走「产物级修复」（方案 4），改的是 `vite.config.ts` 的 `closeBundle`，属构建配置，不改源码，回灌安全；但需 `npm run test:smoke` 验证 chunk import 图。
- 改前跑 `npm run test:smoke` 记录基线，改后必重跑。
- 契约漂移（`port_18080` 在 `official.ts`/`passthrough.ts` 与基线不符）为**预存问题**（与本次无关），如需处理另走 `npm run contracts -- --resnap`。

---

## 六、相关文件索引

- 疑点源码：`src/bundle/httpClient-BknZwXjG_components/shared.js`（`__vite__mapDeps`，约 L43）
- 对照组：`src/bundle/main-CYvt_zul.js` / `share-CyPsaet6.js` / `mediabunny-mp3-encoder-CZeRAvEV.js`（mapDeps 用 `./`）
- 透传层：`localTool/src/routes/passthrough.ts`（只豁免 `/files/`、`/plugin/`）
- 静态托管：`localTool/src/index.ts` 的 `handleFrontendPage`
- 视频处理 UI：`src/bundle/httpClient-BknZwXjG_components/Gc.jsx`
- 报错来源库：`src/bundle/src-_qSScO88.js`（mp4box）+ `src/_qSScO88_components/shared.js`（断言函数 `n(e)` L3-7 抛 `Assertion failed.`）
- 无关文档：`docs/29-视频去字幕功能本地化方案.md`（另一独立功能）
