# 40 · 剧本盒子（scriptBoxNode）SOP 重构方案

> 目标：按 SOP「代码拆解标准流程」把剧本盒子从混淆产物 `H_.jsx` 里**尽量拆成独立文件**。
> 风格要求：**所有对外输入/输出端点写在文件顶部，下面像正常代码一样写完整逻辑**，方便日后增改（如关键帧生图、专属提示词）。
> 若因项目铁律（跨 chunk 引用钉死 / 不能反向 import 宿主）确实拆不动，再退而求其次「原地重写」——逻辑不变，只是结构收口。

> **行号权威注记（审计 2026-08-12 补）**：本文所有行号以 `H_.jsx` / `shared.js` **当前版本 grep 实测为准**（已逐一核对）。⚠️ `docs/33-剧本盒子探索.md` 中 `Pr`(写 5580)/`Fr`(写 5731)/`Ir`(写 5749)/`Nr`(写 5556) 行号**已过期偏移**，实际为 `Pr`=L5635 / `Fr`=L5786 / `Ir`=L5804 / `Nr`=L5611。改代码以本文行号查 `H_.jsx` 为准；`docs/33` 仅作流程理解，勿按它的行号定位。

---

## 0. 探索结论（一句话）

**能拆成独立文件，且风险可控。** 剧本盒子的引擎当前都在 `H_.jsx` 内定义，分两类（行号均为当前版本 grep 实测）：

- **「import 同名覆盖」组（共 11 个，全部在 `H_.jsx` 顶部 L22 的 import 列表里被声明从 `shared.js` 解构导入，但文件内用同名 `let` 重新定义覆盖）**：
  - `Z.useCallback` 型（6 个）：`Ar`(L5164) / `Pr`(L5635) / `Fr`(L5786) / `Ir`(L5804) / `Mr`(L5414) / `Nr`(L5611)
  - 普通 `let` 函数型（5 个）：`ai`(L8365) / `oi`(L8400) / `li`(L8450) / `ui`(L8531) / `ii`(L8192) / `di`(L8659) —— ⚠️ 注意 `ii`/`di` 也在此列（见下方陷阱）。
  - ⚠️ **关键陷阱**：`shared.js` 中的同名符号 `Mr`(L768)/`Nr`(L771)/`Pr`(L772)/`Ir`(L831)/`di`(L1799)/`ii`(无定义) 大多是**全局状态 `new Map()`**（缓存/存储），与剧本盒子引擎函数**同名不同物**；`ai`/`oi`/`li`/`ui` 在 shared.js 中也无对应函数实现。故这 11 个符号的**真源一律是 `H_.jsx` 本地 `let`**，**绝不能**当 `shared.js` 导出直接 import。
- **纯本地 `let` 函数（唯一一个不在 import 列表的引擎符号）**：
  - `Un`(L628) —— import 列表（L22）**不含 `Un`**，它是纯本地 `let useCallback`，**不存在「覆盖」情形**。内部用 `zt`(abort Map, `Z.useRef` 引用稳定，不进依赖数组)，依赖数组实测为 `[K]`。

> 小结：**引擎符号共 12 个，11 个属「import 覆盖」型（shared.js 同名是 Map 或无实现），仅 `Un` 是纯本地型（无 import 冲突）**。其中 `Nr` 抽为 `scriptBoxPrompts.assembleShotUser` 经 import 用；其余 11 个（`Ar/Pr/Fr/Ir/Mr/Un/oi/ai/li/ui/di/ii`）一律**不能**从 shared.js import 到正确实现，重构经 deps 参数化传入（`di/ii` 也走 deps，见 §3.3）。

依赖的真实来源（已逐一核对 `H_.jsx` / `shared.js`）：

- **来自 `shared.js` 导出、可直接 import**（顶层 `function`/`var`/`async function`，在 L22 解构导入并在 shared.js export）：`ca`(L2593) / `Hi`(L2273) / `Bl`(见 BUNDLE_MAP) / `Yg`(L11207) / `Zg`(L11228) / `Qg`(L11233，常量模板) / `Xg`(L11223，常量模板) / `Fa`(L2882) / `Ia`(L2902) / `La`(L2971) / `Ra`(L2989) / `ka`(L2830) / `xa`(L2729) / `Aa`(L2837) / `ci` / `hi` / `mi`。
- **`H_.jsx` 本地 `let` 定义、必须参数化传入**（shared.js 同名是 `new Map()`，非函数）：`Mr`(L5414) / `Pr`(L5635) / `Ir`(L5804) / `di`(L8659) / `ii`(L8192)。（`di` 是 H_.jsx 局部建节点函数；`ii` 是视频上传函数；shared.js 的 `di` 是 `new Map()`，同名不同物。）`Nr`(L5611) 虽同属本地 `let`，但方案把它抽为 `scriptBoxPrompts.assembleShotUser`，引擎内直接 `import` 用（不经 deps 传，区别于 Mr/di/ii）。
- **宿主 `H_.jsx` 组件级状态/props，必须参数化传入**：`K`(setNodes) / `J`(getNodes) / `Tn.current`(getNodes ref) / `k`(toast) / `zt`(abort Map) / `S`(drawingModel) / `T`(discountVideoModel) / `C`(videoModel) / `x`(textModel) / `Ce`(localTool 状态) / **API 地址类 props**（来自 `H_` 组件 props 解构，L26-43）：`t`=textApiUrl / `r`=textApiKey / `i`=imageApiUrl / `a`=imageApiKey / **`l`=builtinApiUrl / `u`=builtinApiKey**（注意：`l/u` 是**内置/内置** API，不是文本 API；`Ar` 用 `o?l:t`、`Mr` 用 `o?l:i` 优先取 builtin）。`Ar` 实际用到 `l/u/t/r`（及 `a` 做模型判断），`Mr` 实际用到 `l/u/i/a`。全部进 deps 即覆盖。

> **已验证**：`c_.jsx`（UI 组件）除通过 `d.onXxx?.(...)` 调用引擎外，**不引用任何引擎内部符号**（grep `Ar/Pr/Fr/Ir/Mr/Nr/Un/oi/ai/li/ui` 在 c_.jsx 中仅有 Tailwind 类名子串误匹配，无真实引用），故改引擎文件对 `c_.jsx` **零改动**。

---

## 1. 剧本盒子在系统中的位置

| 维度 | 现状 |
|---|---|
| UI 组件 | `src/bundle/httpClient-BknZwXjG_components/c_.jsx`（只通过 `d.onXxx?.(...)` 调引擎，**零内部耦合**） |
| 引擎 + 注入 + 连线 | `src/bundle/httpClient-BknZwXjG_components/H_.jsx`（巨型 1 万行聚合） |
| 纯函数/常量 | `shared.js` 导出（`ca/Hi/Bl/Yg/Zg/Qg/Fa/Ra/Ia/La/ka/xa/Aa/ci/hi/mi/Xg`）；`H_.jsx` 本地定义（`Mr` L5414 / `Nr` L5611 / `di` L8659 / `ii` L8192 / `oi` L8400 / `ai` L8365 / `li` L8450 / `ui` L8531，均非 bo.jsx 导入，且 `Ar/Pr/Fr/Ir/Mr/Nr/oi/ai/ii/di/li/ui` 共 11 个在 L22 import 列表被同名覆盖，仅 `Un` L628 纯本地） |
| 节点类型 | `scriptBoxNode` |
| 对外端点登记处 | **两套独立机制**（审计实测，非文档原写的「两处/三处」含糊说法）：<br>**[A] 7 个生成类回调的三路同步**（`onGenerateScript/AssetImage/AllAssetImages/ShotPrompts/StopScriptItem/RetryVideoAssetUpload/UploadAllVideoAssets`）：① `H_.jsx` L6000 赋值 `Jn.current = {7 回调}`；② L5999 `useEffect` 遍历所有 `scriptBoxNode` 把 7 回调写进 `data`（依赖 `[Ar,Pr,Fr,Ir,Un,K,x,S]`）；③ L1140-1174 的检查循环再比对 `Jn.current` 把 7 回调同步进 `scriptBoxNode.data`。<br>**[B] 2 个连线回调的独立 ref 同步**（`onConnectShot`/`onConnectShots` = `li`/`ui`）：① `H_.jsx` L8740-8741 `di()` 建节点时直接注入 `data`；② L8827-8848 用 `Z.useRef(li/ui)` + `useEffect`（依赖 `[K]`）把最新 `li`/`ui` 同步到所有 `scriptBoxNode.data`。**注意 `Jn.current` 与 L5999 的 useEffect 都不含连线回调**，连线回调走机制 B，不经过引擎 return 对象。 |

**关键事实**：`c_.jsx` 不引用任何引擎内部符号，改引擎文件对它**零改动**；连线时 `di()` 内部对 `scriptBoxNode` 的 `shot-` 句柄做特殊展开（L8667-8687），这部分逻辑目前和 `di()`（全局建节点函数）耦合，重构时需决定是「整体带走」还是「引擎只暴露回调、连线逻辑留在原处」。

---

## 2. 完整实现梳理（逐引擎逻辑流）

> 约定：`e` = 剧本盒子节点 id；`K` = setNodes；`J`/`Tn.current` = getNodes；`k` = toast；`zt` = AbortController Map；`Ce` = localTool 连接状态。

### 2.1 `Ar` — 步骤1 生成剧本（L5164）
- **输入**：`(e, n, i)` → `n` = 剧情文本，`i` = 指定文本模型（可选）
- **读 `data`**：`customScriptPrompt`、`shotCount`、`globalStyle`、`customAssetTemplates`
- **依赖**：`x`(默认文本模型)、`ca`(模型判定)、`Hi`(权益校验)、`l/t`(url)、`u/r`(key)、`Bl`(发请求)、`Zg`(资产 prompt 拼装)、`Ce`
- **流程**：
  1. 空剧情 → toast 返回
  2. 选定模型 `a = i || x.split('\n')[0]`；`ca(a)` 判定是否内置模型；`Hi(a)` 权益拦截
  3. url/key 选择：内置 `o? l : t` / `o? u : r`；无 key → toast
  4. `K` 置 `loading:true`；取节点 `d = J().find(id)`
  5. 拼 system（L5204 那段 200 行默认编剧模板 + `shotCount` 数量要求 + `globalStyle` 最高优先级约束）；自定义 `customScriptPrompt` 优先
  6. 流式 POST `/v1/chat/completions`（SSE 解析，节流 200ms 更新 `scriptProgressChars`）；`zt.current.set(e)` 存 abort
  7. 清洗 JSON（去 ```json / 截取首末 `{` `}`）→ `JSON.parse`
  8. 映射 `shots[]`（字段 id/index/duration/description/shotType/lighting/dialogue/sound/motion/prompt/videoPrompt）+ `assets[]`（经 `Zg(category,desc,globalStyle,customAssetTemplates)` 算 prompt）
  9. `K` 写回 `story/label/projectName/shots/assets/globalStyle` + `loading:false`
  10. catch：abort 静默，否则 toast + 写 `errorMsg`

### 2.2 `Mr` — 通用资产生图（L5414，被 `Pr` 调用）
- **输入**：`(e, t)` → `e` = prompt，`t` = `{apiFormat, aspectRatio, imageSize, model, noProxy, signal}`
- **依赖**：`S`(默认绘图模型)、`ca`、`Hi`、`l/i`(url)、`u/a`(key)、`Bl`、`Ce`；实测 `Z.useCallback` 依赖数组为 `[a, i, l, u, S, Ce.status.isConnected, Ce.status.port]`（非 `[]`，含 url/key 与本地化端口，故 url/key 切换时 Mr 会随宿主重建；搬入引擎后须保证 `l/t/u/r/i/a` 等进引擎重建时机）
- **流程**：选模型 → 判定 `banana/gemini` 走 Gemini 分支（`/v1beta/models/:model:generateContent`）还是 OpenAI 分支（`/v1/images/generations`）→ 双响应兼容（SSE `data:` 事件取 `results[0].url` / 纯 JSON 取 `b64_json` 或 `url` 或 `inlineData`）→ 返回图片 URL

### 2.3 `Nr` — 分镜 user 拼装（L5611，被 `Ir` 调用）
- **输入**：`(shot, assets, globalStyle)` → 返回拼接好的 user 文本
- 含：镜头编号/时长/景别/光影/运镜/画面描述/对白原样带入（含 `[旁白|角色]` 格式解析）/音效/统一风格/`@名称` 资源引用说明/「prompt 只描述可见画面…」指令
- **注意**：`Nr` 定义在 `H_.jsx` L5611（`let Nr = Z.useCallback(...)`，依赖数组 `[]`），**不是** shared.js 导出（shared.js 的 `Nr` 是 `new Map()`，同名不同物）。抽去 `scriptBoxPrompts.js` 后作为 `assembleShotUser` 导出，引擎文件内 `import { assembleShotUser }` 用（依赖数组空，无需经 deps 传，区别于 Mr/di/ii）。

### 2.4 `Pr` — 步骤2 单资产生图（L5635）
- **输入**：`(e, t, n)` → `t` = assetId，`n` = noProxy 布尔
- **读 `data`**：`assets[].imageUrl/loading/prompt`、`globalStyle`、`customAssetTemplates`、`assetModelSettings`(globalModel/globalAspectRatio/globalSize)
- **依赖**：`J`、`K`、`ka/xa/Aa`(调度模型解析)、`Mr`、`Zg/Yg`、`ci/hi/mi`(本地化+缩略图)、`zt`、`k`
- **流程**：取节点+asset → 解析 `assetModelSettings.globalModel`（经 `ka→xa→Aa` 展开调度）→ `K` 置 asset `loading` → 调用 `Mr`（prompt 取资产自身 `prompt` 经 `Yg` 包装，否则 `Zg` 拼装）→ 本地化 `ci/hi` + 缩略图 `mi` → `K` 写回 `imageUrl/thumbnailUrl`；catch 解除 loading

### 2.5 `Fr` — 步骤2 批量生图（L5786）
- **输入**：`(e, t)` → `t` = 指定 assetId 数组（空=未生成全部）
- 依赖 `J/Pr/k`；`Promise.all` 并发调 `Pr`

### 2.6 `Ir` — 步骤3 分镜提示词（L5804）
- **输入**：`(e, n, i)` → `n` = 单 shotId，`i` = shotId 数组（空=全部）
- **读 `data`**：`shots`、`assets`、`globalStyle`、`globalConstraints`、`customGlobalConstraint`、`imageGlobalConstraint`、`videoGlobalConstraint`、`selectedModel`、`customShotPrompt`
- **依赖**：`x/ca/Hi/l/t/u/r/Bl/Ce/K/J/Nr/Zg?`(实际用 `Nr`)+`Qg`(不可覆盖规则)
- **流程**：筛选目标 shots → 选模型+权益 → 拼 system（`customShotPrompt` 或默认导演模板 L5843 + `Qg` 不可覆盖规则）→ `K` 置 `promptLoading:true` → 每 shot：`Fa` 匹配 `@资产` → `Nr` 拼 user + `imageGlobalConstraint`/`videoGlobalConstraint` 约束 + 「videoPrompt 以【时长 N秒】开头」→ 流式 POST → 解析 `{prompt, videoPrompt}` → `K` 写回；catch 解除 loading

### 2.7 `Un` — 中止单项（L628，纯逻辑）
- **输入**：`(e, t, n)` → `t` = `'asset'|'shot'`，`n` = 项 id
- 取 `zt.current.get(\`${e}_${t}_${n}\`)` → `abort()` + delete → `K` 解 loading

### 2.8 `oi` — 重试单资产视频上传（L8400）
- **输入**：`(e, t)` → `t` = assetId
- 读 `assets[].imageUrl` → 置 `videoAssetUploadStatus[imageUrl]='uploading'` → `Fa` 匹配引用该资产的 shots → 调 `ii(node, shotIds)`

### 2.9 `ai` — 全部资产视频上传（L8365）
- **输入**：`(e)` → 取所有已生成 `imageUrl` 的资产 → 把 `@名称` 拼进各 shot description → `ii(node, allShotIds)`

### 2.10 `li` — 连线单个分镜到生图/视频节点（L8450）
- **输入**：`(e, t, n)` → `t` = shotId，`n` = `'image'|'video'`
- 计算新节点位置 → `ii`（video 时先上传素材）→ `di(n==='image'?'promptNode':'discountVideoNode', pos, {aspectRatio/size/selectedSeconds/drawingModel/selectedModel/uploadedAssets...}, {source:e, sourceHandle:\`shot-${t}\`})`
- 依赖：`Tn/K/S/T/di/ii`

### 2.11 `ui` — 连线多个分镜（批量，建 group + 多节点）（L8531）
- **输入**：`(e, t, n)` → `t` = shotId 数组，`n` = `'image'|'video'`
- 计算 grid 布局 → 建 `group` 节点 → 每 shot 调 `di` 建 `promptNode/discountVideoNode` 并挂 `sourceHandle:\`shot-${t}\``，video 时 `ii` 上传素材；依赖同 `li`

---

## 3. 端点契约（顶部收口 —— 这是重构后的文件头部）

> 重构后，独立文件顶部用注释锁死以下契约。任何增改功能（关键帧/专属提示词）都只在此处登记 + 下面加实现。

### 3.1 输入：`node.data` 字段清单
| 字段 | 类型 | 用途 | 被谁读 |
|---|---|---|---|
| `story` | string | 原始剧情文本 | `Ar` 写、`c_.jsx` 编辑框 |
| `shotCount` | number | 分镜数量建议 | `Ar` |
| `globalStyle` | string | 统一视觉风格（最高优先级） | `Ar`/`Pr`/`Ir` |
| `projectName` / `label` | string | 项目名 | `Ar` 写、`ui` 读 |
| `shots[]` | array | 分镜列表（id/index/duration/description/shotType/lighting/dialogue/sound/motion/prompt/videoPrompt/promptLoading/gridMode） | `Ar`写/`Ir`/`Fr`?/`li`/`ui`/`oi`/`ai` |
| `assets[]` | array | 资产列表（id/category/name/description/prompt/imageUrl/thumbnailUrl/loading） | `Ar`写/`Pr`/`Fr`/`oi`/`ai` |
| `customScriptPrompt` | string | 自定义编剧 system | `Ar` |
| `customShotPrompt` | string | 自定义导演 system | `Ir` |
| `customAssetTemplates` | {character,scene,prop} | 资产 prompt 后缀模板 | `Ar`/`Pr` via `Zg` |
| `customGlobalConstraint` | string | 全局强制约束 | `Ir` |
| `imageGlobalConstraint` | string | 仅作用于 prompt 的约束 | `Ir` |
| `videoGlobalConstraint` | string | 仅作用于 videoPrompt 的约束 | `Ir` |
| `globalConstraints[]` | string[] | 全局约束集合 | `Ir` |
| `assetModelSettings` | {globalModel,globalAspectRatio,globalSize} | 资产生图模型/尺寸 | `Pr` |
| `aspectRatio` / `customAspectRatio` | string | 连线时透传给下游节点 | `li`/`ui`/`di` |
| `selectedModel` | string | 分镜提示词所用文本模型 | `Ir` |
| `videoUploadedAssets` / `videoAssetUploadStatus` / `videoAssetUploadErrors` | object | 视频化上传状态 | `oi`/`ai`/`ii` |
| `drawingModelForScript` | string | 绘图模型（注入） | `c_.jsx` |
| `textModel` | string | 文本模型（注入） | `c_.jsx` |
| `transitResources` | array | 中转资源（注入） | `c_.jsx` |

### 3.2 输出：`node.data` 回调清单（端点）

> **重要澄清（审计修正）**：共 9 个回调，但分两类、**注入机制不同**（见 §1）：
> - **① 7 个生成类回调**走「`Jn.current` + useEffect + 检查循环」三路同步（机制 A），**应进 `createScriptBoxEngine` 的 return 对象**，由宿主注入 `Jn.current` 与 `data`。
> - **② 2 个连线回调**（`onConnectShot`/`onConnectShots`）走 `di()` + `useRef` 同步（机制 B），**不进 `createScriptBoxEngine` 的 return 对象**——它们强依赖全局 `di`/`ii`，按 §5 决策 1 留在 `H_.jsx` 薄封装。
> 原 §4.2 的 return 只列 7 个是正确的，但原 §3.2 标题「注入 node.data 的回调」易让人误以为 9 个都由引擎返回。下表「归属」列标明机制。

| 回调 | 实现 | 触发（c_.jsx 行） | 参数 | 归属 |
|---|---|---|---|---|
| `onGenerateScript` | `Ar` | L333 | `(e, story, model?)` | ① 进引擎 return |
| `onGenerateAssetImage` | `Pr` | L1224/L1393 | `(e, assetId, noProxy?)` | ① 进引擎 return |
| `onGenerateAllAssetImages` | `Fr` | L1143 | `(e, assetIds?)` | ① 进引擎 return |
| `onGenerateShotPrompts` | `Ir` | L1825/L2144/L2255 | `(e, shotId?, shotIds?)` | ① 进引擎 return |
| `onStopScriptItem` | `Un` | L1210/L1821/L2253 | `(e, 'asset'\|'shot', itemId)` | ① 进引擎 return |
| `onRetryVideoAssetUpload` | `oi` | L1205 | `(e, assetId)` | ① 进引擎 return |
| `onUploadAllVideoAssets` | `ai` | L1131 | `(e)` | ① 进引擎 return |
| `onConnectShot` | `li` | 连线时 | `(e, shotId, 'image'\|'video')` | ② 留 H_.jsx（di/ref 同步） |
| `onConnectShots` | `ui` | 连线时 | `(e, shotIds[], 'image'\|'video')` | ② 留 H_.jsx（di/ref 同步） |

### 3.3 对外依赖（拆文件后需参数化传入的部分）
| 依赖 | 来源 | 是否需参数化 |
|---|---|---|
| `K`(setNodes) / `J`(getNodes) / `Tn.current`(getNodes ref) | 宿主闭包 | ✅ 参数化 |
| `k`(toast) / `zt`(abort Map) | 宿主闭包 | ✅ 参数化 |
| `S`(drawingModel) / `T`(discountVideoModel) / `C`(videoModel) / `x`(textModel) | 宿主 props 解构 | ✅ 参数化 |
| `Ce`(localTool 状态) | 宿主闭包 | ✅ 参数化 |
| `t/r`(textApiUrl/textApiKey) / `i/a`(imageApiUrl/imageApiKey) / **`l/u`(builtinApiUrl/builtinApiKey)** | 宿主 props 解构（L26-43：`l`/`u` 是**内置** API，非文本；`Ar` 用 `o?l:t`+`o?u:r`，`Mr` 用 `o?l:i`+`o?u:a`） | ✅ 参数化（⚠️ 原 §4.2 deps 漏列，必须补；`t/r/i/a/l/u` 全传即可覆盖两个引擎） |
| `di`(建节点) / `ii`(视频上传) | **`H_.jsx` 本地 `let`**（di L8659 / ii L8192；非 bo.jsx，shared.js 无此定义） | ✅ 参数化传入（见 §5 决策） |
| `Mr`(图生图引擎) | **`H_.jsx` 本地 `let useCallback`**（L5414；shared.js 同名 `Mr` 是 `new Map()`，无对应实现） | ✅ 参数化传入（经 deps.imageGenerate，非 import shared.js） |
| `Nr`(分镜拼装) | **`H_.jsx` 本地 `let useCallback`**（L5611；shared.js 同名 `Nr` 是 `new Map()`），但已抽为 `scriptBoxPrompts.assembleShotUser` | ✅ 引擎内 `import` `scriptBoxPrompts.assembleShotUser`（不经 deps 传，避免与 Mr/di/ii 混为一谈） |
| `ca/Hi/Bl/Yg/Zg/Qg/Fa/Ra/Ia/La/ka/xa/Aa/ci/hi/mi` | `shared.js` 导出（`function`/`var`/`async function` 顶层定义） | ❌ 直接 import |

---

## 4. 独立文件拆分设计

### 4.1 文件结构
```
src/bundle/httpClient-BknZwXjG_components/
├── scriptBox/
│   ├── scriptBoxPrompts.js   ← 纯模块：4 类 system 模板 + Zg(shared.js)/Nr(H_.jsx L5611) 拼装函数
│   ├── scriptBoxEngine.js    ← 顶部端点契约 + createScriptBoxEngine(deps) 返回 7 个生成类回调（连线 2 回调见 §3.2 机制 B，留 H_.jsx）
│   └── scriptBoxConnect.js   ← li/ui 连线逻辑（依赖 di/ii，若决定带走）
└── H_.jsx                    ← 宿主：只负责 import + 注入
```

### 4.2 `scriptBoxEngine.js` 头部形态（SOP 风格）
```js
// ============================================================
// 剧本盒子 scriptBoxNode — 端点契约（对外 I/O 收口，改这里 = 改接口）
// ============================================================
// 【输入】 node.data 字段见 docs/40 §3.1（story/shots/assets/globalStyle/...）
// 【输出】 注入 node.data 的回调见 docs/40 §3.2
//          （onGenerateScript/onGenerateAssetImage/onGenerateAllAssetImages/
//           onGenerateShotPrompts/onStopScriptItem/
//           onRetryVideoAssetUpload/onUploadAllVideoAssets/
//           onConnectShot/onConnectShots）
// 【外部依赖 deps】{ setNodes, getNodes, getNodesRef, toast, abortMap,
//                   textModel, drawingModel, videoModel, discountVideoModel,
//                   textApiUrl, textApiKey, imageApiUrl, imageApiKey,
//                   builtinApiUrl, builtinApiKey,
//                   localToolStatus, createNode, uploadVideoAssets,
//                   imageGenerate, shotAssemble,
//                   ca, Hi, Bl, Yg, Zg, Qg, Fa, Ra, Ia, La, ka, xa, Aa,
//                   ci, hi, mi, prompts }
//   ⚠️ t/r/i/a/l/u（API url+key）是 H_ 组件 props 解构，必须一并传入，否则 Ar/Mr 内引用会 undefined
//      t=textApiUrl r=textApiKey i=imageApiUrl a=imageApiKey l=builtinApiUrl u=builtinApiKey
//      （注意：l/u 是「内置」API，不是文本 API；Ar 优先用 l/u，Mr 优先用 l/u 否则 i/a）
//   ⚠️ Mr/di/ii 是 H_.jsx 本地 useCallback/函数（shared.js 同名是 Map，无对应实现），必须随 deps 参数化传入
//      （createNode:di / uploadVideoAssets:ii / imageGenerate:Mr）
//      Nr 已抽为 scriptBoxPrompts.assembleShotUser，引擎内直接 import 用，无需经 deps 传
// ============================================================
import * as scriptBoxPrompts from './scriptBoxPrompts.js';
export function createScriptBoxEngine(deps) {
  const { setNodes: K, getNodes: J, getNodesRef: Tn, toast: k, abortMap: zt,
          textModel: x, drawingModel: S, discountVideoModel: T, videoModel: C,
          textApiUrl: t, textApiKey: r, imageApiUrl: i, imageApiKey: a,
          builtinApiUrl: l, builtinApiKey: u,
          localToolStatus: Ce, createNode: di, uploadVideoAssets: ii,
          imageGenerate: Mr,
          ca, Hi, Bl, Yg, Zg, Qg, Fa, Ra, Ia, La, ka, xa, Aa,
          ci, hi, mi, prompts } = deps;
  const Nr = scriptBoxPrompts.assembleShotUser;  // 从 scriptBoxPrompts 引入，等价于原 H_.jsx 本地 Nr

  // —— 下面像正常代码写完整逻辑（原 Ar/Pr/Fr/Ir/Un/oi/ai 直接搬，闭包变量换成 deps 解构名）——
  // Mr 原是 H_.jsx 本地 useCallback（依赖数组 [a,i,l,u,S,Ce.status.*]），经 deps.imageGenerate 传入即可；Nr 已 import scriptBoxPrompts.assembleShotUser（依赖数组 []，无需重建）
  // 宿主改用 §4.4 的 useRef 每次渲染重建引擎，故 url/key/model 切换本应自动拿到新值（见 §5.3 实测依赖数组并集）
  const Ar = async (e, n, i) => { /* ... 原 L5164 逻辑，x/l/u/r/... 全部来自 deps ... */ };
  const Pr = async (e, t, n) => { /* ... */ };
  const Fr = async (e, t) => { /* ... */ };
  const Ir = async (e, n, i) => { /* ... */ };
  const Un = (e, t, n) => { /* ... */ };
  const oi = (e, t) => { /* ... */ };
  const ai = e => { /* ... */ };
  // li/ui 若带走，放 scriptBoxConnect.js，否则留在 H_.jsx 并参数化 di/ii

  return { onGenerateScript: Ar, onGenerateAssetImage: Pr, onGenerateAllAssetImages: Fr,
           onGenerateShotPrompts: Ir, onStopScriptItem: Un,
           onRetryVideoAssetUpload: oi, onUploadAllVideoAssets: ai };
}
```

### 4.3 `scriptBoxPrompts.js`（收口易变契约）
> 这些模板/常量真实来源：`SCRIPT_WRITER_SYSTEM` 内联在 `Ar` 体内（H_.jsx L5204-5216）；`SHOT_DIRECTOR_SYSTEM` 内联在 `Ir` 体内（H_.jsx L5788-5803）；`UNOVERRIDE_RULE`=`Qg`（shared.js L11233）；`ASSET_TEMPLATE`=`Xg`（shared.js L11223）；`Zg` 拼装函数（shared.js 导出）；`Nr` 拼装函数（H_.jsx L5611 本地 useCallback，非 shared.js）。Step 1 抽这些时：`Qg/Xg/Zg` 直接 `import` shared.js 复用，`SCRIPT_WRITER_SYSTEM/SHOT_DIRECTOR_SYSTEM` 从 Ar/Ir 体内搬出，`Nr` 从 H_.jsx 搬出（视作本地纯函数传入引擎或随 deps 传 `shotAssemble`）。

- 导出 `SCRIPT_WRITER_SYSTEM`（从 `Ar` 内联模板 H_.jsx L5204 抽出）
- 导出 `SHOT_DIRECTOR_SYSTEM`（从 `Ir` 内联模板 H_.jsx L5843 抽出）
- 导出 `UNOVERRIDE_RULE`（= `Qg` shared.js L11233）
- 导出 `ASSET_TEMPLATE`（= `Xg` shared.js L11223，character/scene/prop 设定图模板）
- 导出 `buildScriptSystem({shotCount, globalStyle, customScriptPrompt})`
- 导出 `buildShotSystem({customShotPrompt})` = 导演模板 + `Qg`
- 导出 `assembleShotUser(shot, assets, globalStyle)`（= `Nr` 逻辑，H_.jsx L5611）
- 导出 `assembleAssetPrompt(category, desc, globalStyle, templates)`（= `Zg` 逻辑，shared.js）

> 收益：日后加「关键帧专属提示词」「分镜风格化模板」只在此文件加一个导出 + 在 `createScriptBoxEngine` 端点登记处挂一个回调，不动引擎主体。

### 4.4 宿主 `H_.jsx` 改造（零行为变化）

> ⚠️ **不用 `useMemo`**：原 7 个 useCallback 各自的依赖数组并不一致（如 `Ar` 是 `[r,t,l,u,x,k,K,J,Ce.status.isConnected,Ce.status.port]`，`Ir` 是 `[r,t,l,u,x,J,K,k,Nr,Ce.status.isConnected,Ce.status.port]`）。合并成单个 `useMemo` 后，只要任一 deps 变化（尤其 `di`/`ii` 是 H_.jsx 本地 `let`，若生命周期内被重赋值）就会重建，且 `Ce.status` 嵌套属性每次渲染可能是新对象 → 与原逐回调失效时机不一致，易引入 stale closure / 意外重建回归。改用 **`useRef` 每次渲染重建**更稳（见下）。

```js
import { createScriptBoxEngine } from './scriptBox/scriptBoxEngine.js';
import * as scriptBoxPrompts from './scriptBox/scriptBoxPrompts.js';

// 原 L5164-6036 的 7 个 useCallback（Ar/Pr/Fr/Ir/Mr/Nr/Un）+ 注入，替换为：
// 每次渲染用最新闭包重建（规避 useMemo 的 stale closure / 依赖误判）
const scriptBoxEngineRef = Z.useRef(null);
scriptBoxEngineRef.current = createScriptBoxEngine({
  setNodes: K, getNodes: J, getNodesRef: Tn, toast: k, abortMap: zt,
  textModel: x, drawingModel: S, discountVideoModel: T, videoModel: C,
  textApiUrl: t, textApiKey: r, imageApiUrl: i, imageApiKey: a,
  builtinApiUrl: l, builtinApiKey: u,   // ⚠️ 必须传入；l/u 是「内置」API（非文本），Ar/Mr 优先用
  localToolStatus: Ce, createNode: di, uploadVideoAssets: ii,
  imageGenerate: Mr,                                        // ⚠️ H_.jsx 本地 useCallback，参数化传入；Nr 已 import scriptBoxPrompts
  ca, Hi, Bl, Yg, Zg, Qg, Fa, Ra, Ia, La, ka, xa, Aa, ci, hi, mi,
  prompts: scriptBoxPrompts,
});
const scriptBoxEngine = scriptBoxEngineRef.current;

// di() 注入处（L8734-8742）改为读 scriptBoxEngine.*：
onGenerateScript: e === 'scriptBoxNode' ? scriptBoxEngine.onGenerateScript : undefined,
// ...
// li/ui 若未带走，则保留在原处（它们依赖 di/ii 的闭包，参数化成本更高）
```

### 4.5 ROI 论证（为什么拆独立文件，而非直接走退路 C）

> 审计补：SOP（docs/SOP-代码拆解标准流程.md）要求拆文件前先算 ROI = 减少 AI 散点/隐式依赖的程度 ÷ 风险。下面把本方案摆到 SOP 尺子上量，明确「拆」相对「退路 C（原地重写 + 顶部端点契约注释）」的边际收益，避免为拆而拆（奥卡姆剃刀 / 原则五）。

**拆独立文件相对退路 C 的额外收益：**
1. **`scriptBoxPrompts.js` 单独成文件** —— 这是 ROI 最高的一块。4 类 system 模板 + `Zg`/`Nr` 拼装原本散在 `Ar`/`Ir` 体内与 `shared.js`，改提示词要跳 3 个文件。抽成单文件后，未来加「关键帧提示词 / 专属提示词」（§8）只动 1 处。**这一点无论拆不拆引擎都做**，收益确定、风险极低（Step 1 🟢）。
2. **`scriptBoxEngine.js` 把 7 个生成回调聚到一个文件** —— 相对退路 C（留在 H_.jsx 但顶部收口），AI 改生成逻辑时 context 从「在 1 万行 H_.jsx 里找」变成「打开 1 个小文件」，且 `c_.jsx` 零耦合（已验证）不受影响。代价是引入 30+ 参数的 `deps` 长列表——**这是新风险点**：参数顺序错/漏传即静默 bug（§4.2 已用注释 + 解构名锁死，且 §6 Step 2 验证项强制「确认 `Ar` 内能拿到 `l/t/u/r`」兜底）。

**拆文件引入的额外风险（退路 C 没有的）：**
- 跨 chunk 引用钉死（docs/36 方向 C 🟠 中高风险）：新文件虽只 import shared.js 纯函数、不反向 import H_.jsx（翻车 #6 已规避），但仍属「拆聚合」动作，`npm run contracts` 的 `checkImportGraph` 必须过（§6 每步已加 contracts）。
- `deps` 长列表的维护负担：未来在引擎加字段，要同时改 `deps` 解构、调用处、宿主传入处 3 处，反而是新散点。缓解：端点契约注释（§4.2 头部）集中登记，新增即改一处注释 + 解构。

**结论**：`scriptBoxPrompts.js` 必抽（高 ROI）。`scriptBoxEngine.js` 抽取**可接受**，前提是严格守住「不反向 import H_.jsx + 每步跑 contracts + Chrome 验模型切换」。若执行时 `contracts` 持续报 import graph 错误或出现 stale closure 回归，立即回退到退路 C——`scriptBoxPrompts.js` 仍保留（不受退回影响），可维护性目标仍达 ~80%。**不强行追求 100% 拆干净**。

---

## 5. 关键决策点（影响拆分边界）

1. **`li`/`ui`（连线逻辑）是否带走？**
   - 它们强依赖 `di`(建节点，H_.jsx L8659 本地 `let`) + `ii`(视频上传，H_.jsx L8192 本地 `let`)。`di` 是**`H_.jsx` 组件内的局部函数**（非全局、非 bo.jsx 导入；shared.js 的 `di` 是 `new Map()`，同名不同物），内含 30+ 节点类型的注入逻辑，不能轻易搬。
   - **建议**：`li/ui` 留在 `H_.jsx`，但把「计算新节点位置 / grid 布局 / 透传 aspectRatio 等」的纯计算抽成 `scriptBoxConnect.js` 的导出函数，`H_.jsx` 内的 `li/ui` 薄封装调用。这样引擎主体拆干净，连线逻辑因耦合本地 `di/ii` 闭包留原地。

2. **`di` 内部对 `scriptBoxNode` 的 `shot-` 句柄展开（L8667-8687）去留？**
   - 这段是「连线时自动给下游 promptNode/discountVideoNode 填 aspectRatio/duration」的逻辑，属于 `di` 内部连线行为，**留在 `di` 不动**，不影响引擎拆分。

3. **`useMemo` 依赖数组是否会触发 stale closure / 意外重建？**
   - 原 7 个 useCallback 依赖数组并不一致（如 `Ar`=`[r,t,l,u,x,k,K,J,Ce.status.isConnected,Ce.status.port]`，`Ir`=`[...,Nr,...]`，`Mr`=`[a,i,l,u,S,Ce.status.isConnected,Ce.status.port]`）。合并成单个 `useMemo` 后，只要任一 deps 变化即整体重建，且 `Ce.status` 嵌套属性每次渲染可能是新引用 → 与原逐回调失效时机不一致。`di`/`ii`/`Mr`/`Nr` 是 H_.jsx 本地 `let`，若生命周期内重赋值，`useMemo` 可能捕获旧引用。
   - **结论**：Step 2 直接采用 §4.4 的 **`useRef` 每次渲染重建**方案，不赌 `useMemo`。代价是每次渲染重建一次引擎对象（纯函数 + 闭包，开销可忽略），收益是彻底规避 stale closure 与依赖误判。

---

## 6. 落地步骤（小步、每步可回退）

| 步 | 动作 | 风险 | 验证 |
|---|---|---|---|
| **Step 1** | 新建 `scriptBoxPrompts.js`，把 `Ar` 的默认编剧模板（L5204）、`Ir` 的导演模板（L5843）、`Qg`(L11233)、`Xg`(L11223)、`Zg`(L11228)、`Nr`(L5611) 抽成导出；`shared.js`/`H_.jsx` 改为 import 复用 | 🟢 极低（纯搬移） | `npm run build` + `npm run test:smoke` + Chrome 跑通 3 步生成 |
| **Step 2** | 新建 `scriptBoxEngine.js`，`createScriptBoxEngine(deps)` 收口 `Ar/Pr/Fr/Ir/Mr/Nr/Un/oi/ai`（不含 li/ui）；`H_.jsx` 用 `useRef` 每次渲染重建引擎（§4.4，不赌 `useMemo`），替换原 7 个 useCallback + 注入 `Jn.current` 与 `data`（机制 A），并补传 `l/t/u/r/i/a` 等 url/key props 与 `Mr/Nr/di/ii` | 🟡 中（依赖数组/引用传递/漏传 props） | build + **`npm run contracts`** + smoke + Chrome 全流程；**额外检查**：① abort/权益/本地化路径正常；② **切换文本模型 `x` / 绘图模型 `S` 后，新生成是否用上新模型**（useRef 每次渲染重建，本应自动拿到新值，需 Chrome 确认）；③ `Jn.current`(L6000) 与 `data`(L5999/L1149) 两路回调一致，连线回调(机制 B)不在此对象内 |
| **Step 3** | `li/ui` 的纯计算部分抽 `scriptBoxConnect.js`；`H_.jsx` 内薄封装，保留 `di()` 注入（L8740-8741）+ `useRef` 同步（L8827-8848）机制 B。端点契约注释锁定在 `scriptBoxEngine.js` 顶部 | 🟢 低 | build + **`npm run contracts`** + smoke + 连线生图/视频验证；确认连线后下游节点 `uploadedAssets`/`aspectRatio` 预填正确 |
| **Step 4** | 沉淀到 `docs/01`（SOP 要求）；删除 `H_.jsx` 内残余剧本盒子注释噪音（用 `scripts/extract-*.cjs` 大段删，勿用 replace_in_file，避免上半截换了下半截留着） | 🟢 | `npm run map` 复核符号索引无悬空 |

> 每步单独 commit，任一步 Chrome 验证失败立即回退该步（git revert），不影响其他节点。

> ⚠️ **铁律衔接（CLAUDE.md §5.4 铁律3 + §5.6 最小差异）**：本重构新建的 `scriptBox/` 独立文件属「§三 3.1 场景②（自研模块）」，不强制最小差异；但 **`H_.jsx` 宿主侧的删除/改写仍属「场景①（改官方混淆码）」，受 `diff ≤ 30 行/commit` 约束**。因此 Step 2 不可真的"一次替换 7 个 useCallback"——须拆成：① 先独立 commit 落 `scriptBoxEngine.js` 新文件；② 再在 `H_.jsx` 逐回调删除 + 薄封装接入，**每删 1 个 `useCallback` 单 commit（或分批控制在 ≤30 行）**，共 7 个独立 commit 或分批提交。官方更新重打补丁时，`H_.jsx` 的逐行改动需能对照，整块删除会使重打失据。

---

## 7. 风险与回退预案

| 风险 | 触发信号 | 回退 |
|---|---|---|
| `useMemo` 依赖引发 TDZ / stale closure / 跨 chunk 悬空（docs/36 §四 方向 C 慎做；`contracts` 曾报 `checkImportGraph`） | 构建报 import graph 错误 / 运行时白屏 / `scriptBoxEngine` 为 undefined / 引擎拿到旧 `di/ii/Mr/Nr` 引用 | **已规避**：Step 2 直接采用 `Z.useRef` 每次渲染重建（§4.4），不依赖 `useMemo`。如需进一步保险，可改为 `useRef` + `useEffect` 仅在 deps 变化时重建 |
| 独立文件反向 import 宿主（`H_.jsx`）→ 违反 SOP 翻车 #6 | 构建循环依赖告警 | **退路 B**：引擎只 `import` `shared.js` 的纯函数（`ca/Hi/Bl/Yg/Zg/Qg/Fa/Ra/Ia/La/ka/xa/Aa/ci/hi/mi`）+ `scriptBoxPrompts.js` 的 `assembleShotUser`；`H_.jsx` 本地符号（`Mr`/`di`/`ii`）一律经 deps 参数化传入，绝不 import `H_.jsx` |
| 若上述均不可行（极端情况） | — | **退路 C（原地重写）**：引擎留在 `H_.jsx`，但按 §4.2 同样的「顶部端点契约注释 + 下面完整逻辑」组织，`scriptBoxPrompts.js` 仍抽走。可维护性目标达成 ~80% |

---

## 8. 日后增改入口（你提的关键帧/专属提示词，未来怎么做）

1. **指定关键帧生成图片**：在 `scriptBoxPrompts.js` 加 `KEYFRAME_IMAGE_SYSTEM`；在 `scriptBoxEngine.js` 端点登记处加 `onGenerateKeyframeImage` 回调（复用 `Mr` + 新模板）；`c_.jsx` 加 UI 入口调 `d.onGenerateKeyframeImage?.(...)`。引擎主体零改动。
2. **生成专属图片 + 配套专属提示词**：同理加 `onGenerateDedicatedImage` + `DEDICATED_PROMPT_SYSTEM`，复用 `Mr`/`Bl`。
3. 所有「提示词类」易变契约集中在 `scriptBoxPrompts.js`，改模板只动一处，符合 SOP 原则三（易变契约收敛）。

---

## 9. 关联文档
- `docs/SOP-代码拆解标准流程.md` — 拆解铁律 / 翻车 #6 / 原则三
- `docs/36-AI可读性架构优化探索.md` — 跨 chunk 引用钉死 / 方向 C 慎做
- `docs/33-剧本盒子探索.md` — 剧本盒子原始探索
