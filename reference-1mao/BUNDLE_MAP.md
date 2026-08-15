# BUNDLE_MAP.md · src/bundle 逆向源码地图

> 自动生成（scripts/gen_bundle_map.cjs）。AI 改 `src/bundle/` 前先读本图，按特征反查落点，避免"找不到/改漏"。
> 文件名是混淆名（如 `H_.jsx` 12668 行），**不要凭文件名判断职责**，看「特征」列。
> 配套：CONTRACTS.md（契约分布）+ scripts/contract_scan.cjs（漏改检测）。

## 一、顶层 chunk 总表（14 个，均为 facade 或运行时垫片）

| chunk | 行数 | 类型 | 说明 |
|---|---|---|---|
| `vendor-Z-adA07W.js` | 4682 | 运行时 | 勿改（React 单实例/外链垫片） |
| `ShareAppPage-C4RerI9i.js` | 623 | facade | 映射至同名 _components |
| `mediabunny-mp3-encoder-CZeRAvEV.js` | 212 | 库 | MP3 编码器 |
| `src-_qSScO88.js` | 151 | facade | 映射至同名 _components |
| `endpointConfig-Bt85xi8d.js` | 123 | 逻辑 | 接入点/端口/18080 配置（契约 critical） |
| `main-CYvt_zul.js` | 97 | 入口 | 应用入口 |
| `httpClient-BknZwXjG.js` | 74 | facade | 映射至同名 _components |
| `_react_shim.js` | 44 | 运行时 | 勿改（React 单实例/外链垫片） |
| `rolldown-runtime-aKtaBQYM.js` | 37 | 运行时 | 勿改（React 单实例/外链垫片） |
| `share-CyPsaet6.js` | 23 | 入口 | 分享页入口 |
| `App-BX6o9fW5.js` | 6 | facade | 映射至同名 _components |
| `_jsx_runtime.js` | 6 | 运行时 | 勿改（React 单实例/外链垫片） |
| `src-kC58-PF2.js` | 5 | facade | 映射至同名 _components |
| `__vite-browser-external-CwrUGkgb.js` | 2 | 运行时 | 勿改（React 单实例/外链垫片） |

## 二、_components 目录规模

| 目录 | 文件数 | 角色 |
|---|---|---|
| `App-BX6o9fW5_components/` | 32 | 主应用（画布编辑器核心 UI/状态） |
| `httpClient-BknZwXjG_components/` | 141 | HTTP 客户端层（代理/请求/资源/转场，最大 141 文件） |
| `src-_qSScO88_components/` | 4 | 运行时模块 |
| `src-kC58-PF2_components/` | 1 | 入口胶水 |

## 三、大文件索引（>500 行，按特征反查）

> 这些文件 AI 最可能要进。特征列从代码自动抽取：用到哪些 API 路径、KV 键、React hooks、导出组件。

| 文件 | 行数 | API 路径 | KV 键 | Hooks | 导出组件 |
|---|---|---|---|---|---|
| `src-_qSScO88_components/shared.js` | 34659 | — | — | — | _cmp_xs e t n 📦聚合导出 |
| `httpClient-BknZwXjG_components/H_.jsx` | 12746 | /v1/chat/completions /v1/draw/completions /v1/images/edits /v1/images/generations /api/assets/upload | proxyMode local-tool transitResources | useState useEffect useRef useMemo | H_ H_ |
| `httpClient-BknZwXjG_components/shared.js` | 11727 | /api/jianying/send /v1/gateway/ai-app /api/tasks /api/tasks/save /api/tasks/batch-save | proxyMode local-tool canvas-state-v1 transitResources api_configs | useState useEffect useRef useCallback | _cmp_Bn _cmp_Er _cmp_Tr _cmp_Vn 📦聚合导出 |
| `vendor-Z-adA07W.js` | 4682 | /api/objects | — | useState useEffect useRef useMemo | $ $n $t A 📦聚合导出 |
| `App-BX6o9fW5_components/Vr.jsx` | 4527 | /v1/gateway/task/ /files/resources/ | local-tool canvas-state-v1 transitResources api_configs | useState useEffect useRef useMemo | Vr Vr |
| `App-BX6o9fW5_components/shared.js` | 3088 | /v1/video/generations/ /v1/videos/ /v1/gateway/task/ /api/resources /api/resources/save | — | useState useEffect useRef useCallback | _cmp_Ln _cmp_Lt _cmp_Qt _cmp_Sr 📦聚合导出 |
| `httpClient-BknZwXjG_components/c_.jsx` | 2806 | — | transitResources | useState useEffect useRef useMemo | — |
| `httpClient-BknZwXjG_components/As.jsx` | 2088 | — | — | useState useEffect useRef useMemo | — |
| `httpClient-BknZwXjG_components/bo.jsx` | 1694 | — | — | useState useEffect useRef useMemo | — |
| `httpClient-BknZwXjG_components/$s.jsx` | 1648 | — | — | useState useEffect useRef useMemo | — |
| `httpClient-BknZwXjG_components/es.jsx` | 1255 | — | — | useState useEffect useRef useMemo | — |
| `httpClient-BknZwXjG_components/Gc.jsx` | 1234 | — | — | useState useEffect useRef useMemo | — |
| `httpClient-BknZwXjG_components/Zo.jsx` | 1150 | /files/ | transitResources | useState useEffect useRef useMemo | — |
| `httpClient-BknZwXjG_components/Uo.jsx` | 1076 | — | — | useState useEffect useRef useMemo | Uo Uo |
| `httpClient-BknZwXjG_components/Lo.jsx` | 963 | — | — | useState useEffect useRef useMemo | — |
| `httpClient-BknZwXjG_components/Rs.jsx` | 905 | — | — | useState useEffect useRef | — |
| `src-_qSScO88_components/xs.jsx` | 875 | — | — | — | — |
| `httpClient-BknZwXjG_components/Yo.jsx` | 828 | — | — | useState useEffect useRef useMemo | — |
| `httpClient-BknZwXjG_components/Rg.jsx` | 826 | — | — | useState useEffect useRef useMemo | — |
| `httpClient-BknZwXjG_components/Lh.jsx` | 720 | — | — | useState useEffect useRef useLayoutEffect | Lh Lh |
| `httpClient-BknZwXjG_components/Co.jsx` | 703 | — | transitResources | useState useEffect useRef useMemo | — |
| `httpClient-BknZwXjG_components/_Component129.jsx` | 662 | — | — | useState useEffect useRef | _Component129 _Component129 |
| `httpClient-BknZwXjG_components/Un.jsx` | 658 | /api/files/open /files/ /api/files/open-dir | local-tool transitResources | — | Un Un |
| `httpClient-BknZwXjG_components/ec.jsx` | 635 | — | — | useState useEffect useRef useMemo | — |
| `ShareAppPage-C4RerI9i.js` | 623 | /api/workflow-apps/ /api/sync/default /api/upload/app-asset | proxyMode transitResources | — | default 📦聚合导出 |
| `httpClient-BknZwXjG_components/Zl.jsx` | 609 | — | — | useState useEffect useRef useMemo | — |
| `App-BX6o9fW5_components/_Component40.jsx` | 559 | — | — | useState useEffect useRef useMemo | _Component40 _Component40 |
| `httpClient-BknZwXjG_components/_Component72.jsx` | 547 | — | — | useState useEffect useRef useMemo | _Component72 _Component72 |
| `App-BX6o9fW5_components/jn.jsx` | 544 | — | — | useState useEffect useRef useMemo | — |
| `App-BX6o9fW5_components/Qn.jsx` | 528 | — | — | useState useEffect useMemo | Qn Qn |

## 四、反向索引（契约字符串 → 在哪改）

> 改某个契约前，先看右边列确认要动几个文件。完整分布见 CONTRACTS.md。

| 契约字符串 | 命中文件数 | 文件（按命中次数降序） |
|---|---|---|
| `/api/proxy` | 1 | httpClient-BknZwXjG_components/shared.js(4) |
| `18080` | 2 | endpointConfig-Bt85xi8d.js(5) · App-BX6o9fW5_components/Tr.jsx(1) |
| `9004` | 0 | ⚠ bundle 内无字面量（前端经变量拼接，见 contracts.json scope=localTool/apimart） |
| `/public/platform` | 1 | httpClient-BknZwXjG_components/shared.js(2) |
| `transitResources` | 9 | App-BX6o9fW5_components/Vr.jsx(7) · httpClient-BknZwXjG_components/H_.jsx(6) · httpClient-BknZwXjG_components/Un.jsx(2) · httpClient-BknZwXjG_components/_Component118.jsx(2) · httpClient-BknZwXjG_components/c_.jsx(2) · ShareAppPage-C4RerI9i.js(2) · httpClient-BknZwXjG_components/Co.jsx(1) · httpClient-BknZwXjG_components/Zo.jsx(1) · httpClient-BknZwXjG_components/shared.js(1) |
| `active_api_endpoint` | 1 | endpointConfig-Bt85xi8d.js(1) |
| `canvas-state-v1` | 2 | App-BX6o9fW5_components/Vr.jsx(2) · httpClient-BknZwXjG_components/shared.js(2) |
| `proxyMode` | 3 | httpClient-BknZwXjG_components/H_.jsx(14) · httpClient-BknZwXjG_components/shared.js(1) · ShareAppPage-C4RerI9i.js(1) |
| `local-tool` | 4 | httpClient-BknZwXjG_components/Un.jsx(4) · App-BX6o9fW5_components/Vr.jsx(3) · httpClient-BknZwXjG_components/H_.jsx(2) · httpClient-BknZwXjG_components/shared.js(2) |
| `x-proxy-url` | 0 | ⚠ bundle 内无字面量（上游头，见 contracts.json scope=localTool） |

## 五、高危文件（被大量 import，改它影响面最大）

> 这些文件是「改一处漏一处」重灾区。改前务必全文 grep 确认所有引用方，改后跑 `npm run contracts` + `npm run build`。

| 文件 | 被引用次数 |
|---|---|
| `httpClient-BknZwXjG_components/shared.js` | 203 |
| `src-_qSScO88_components/shared.js` | 146 |
| `App-BX6o9fW5_components/shared.js` | 31 |
| `httpClient-BknZwXjG_components/_Component8.jsx` | 26 |
| `httpClient-BknZwXjG_components/_Component12.jsx` | 24 |
| `httpClient-BknZwXjG_components/_Component9.jsx` | 16 |
| `httpClient-BknZwXjG_components/Bn.jsx` | 8 |
| `httpClient-BknZwXjG_components/Er.jsx` | 8 |
| `httpClient-BknZwXjG_components/Si.jsx` | 6 |
| `httpClient-BknZwXjG_components/_Component23.jsx` | 6 |
| `httpClient-BknZwXjG_components/Ai.jsx` | 6 |
| `httpClient-BknZwXjG_components/_Component76.jsx` | 6 |
| `httpClient-BknZwXjG_components/_Component21.jsx` | 5 |
| `httpClient-BknZwXjG_components/Oi.jsx` | 5 |
| `httpClient-BknZwXjG_components/Ti.jsx` | 4 |

## 六、同名影子文件警示（重要）

> ⚠ **`src/bundle/` 内部同名影子文件**：以下文件名在多个 `_components` 目录中重复出现，是「改一处漏一处」最高危陷阱。改其中之一前，必须逐个确认所有同名文件是否要同步改，改完跑 `npm run contracts` + `npm run build`。

| 同名文件 | 出现目录数 | 落点（按目录） |
|---|---|---|
| `shared.js` | 4 | App-BX6o9fW5_components · httpClient-BknZwXjG_components · src-_qSScO88_components · src-kC58-PF2_components |
| `Tr.jsx` | 2 | App-BX6o9fW5_components · httpClient-BknZwXjG_components |
| `_Component19.jsx` | 2 | App-BX6o9fW5_components · httpClient-BknZwXjG_components |
| `_Component24.jsx` | 2 | App-BX6o9fW5_components · httpClient-BknZwXjG_components |
| `_Component40.jsx` | 2 | App-BX6o9fW5_components · httpClient-BknZwXjG_components |

- `public/assets/*.js` 是 1.4.0 时期遗留的**死副本**（12 个 JS 已于 2026-08-02 删除），被 build 产物覆盖不生效。grep 该路径若再现，是缓存/未清理产物，勿改。
- `public/assets/*.css`（src-DoQUrSOl.css / httpClient-DFxwm5B3.css / vendor-Qkhkn02K.css）是**活文件**，Vite 不产出，由 post-build-fixups 补引用，保留勿删。
- `dist/` 是构建产物，运行时只读它；改前端一律改 `src/bundle/` 后 `npm run build` 回灌（见 CLAUDE.md §四.2/§四.5）。

## 七、功能域速查（改某功能先看哪）

> 基于文件特征（API 路径 / 契约字符串 / 目录）自动归类，供 AI 定位「我要改 X 功能该进哪个文件」。同一文件可能命中多域。

### 应用入口 / 启动

| 文件 | 行数 | 关键特征 |
|---|---|---|
| `main-CYvt_zul.js` | 97 | — |
| `src-kC58-PF2_components/shared.js` | 48 | — |
| `share-CyPsaet6.js` | 23 | — |
| `App-BX6o9fW5.js` | 6 | — |
| `src-kC58-PF2.js` | 5 | — |

### 接入点 / 端口 / 代理配置

| 文件 | 行数 | 关键特征 |
|---|---|---|
| `httpClient-BknZwXjG_components/H_.jsx` | 12746 | /v1/chat/completions /v1/draw/completions |
| `httpClient-BknZwXjG_components/shared.js` | 11727 | /api/jianying/send /v1/gateway/ai-app |
| `App-BX6o9fW5_components/Vr.jsx` | 4527 | /v1/gateway/task/ /files/resources/ |
| `App-BX6o9fW5_components/shared.js` | 3088 | /v1/video/generations/ /v1/videos/ |
| `httpClient-BknZwXjG_components/Un.jsx` | 658 | /api/files/open /files/ |
| `ShareAppPage-C4RerI9i.js` | 623 | /api/workflow-apps/ /api/sync/default |
| `endpointConfig-Bt85xi8d.js` | 123 | /api/kv/get /api/kv/set |
| `main-CYvt_zul.js` | 97 | — |

### HTTP 客户端 / 代理转发层

| 文件 | 行数 | 关键特征 |
|---|---|---|
| `httpClient-BknZwXjG_components/H_.jsx` | 12746 | /v1/chat/completions /v1/draw/completions |
| `httpClient-BknZwXjG_components/shared.js` | 11727 | /api/jianying/send /v1/gateway/ai-app |
| `httpClient-BknZwXjG_components/Un.jsx` | 658 | /api/files/open /files/ |

### 画布编辑器核心 UI / 状态

| 文件 | 行数 | 关键特征 |
|---|---|---|
| `App-BX6o9fW5_components/Vr.jsx` | 4527 | /v1/gateway/task/ /files/resources/ |
| `App-BX6o9fW5_components/shared.js` | 3088 | /v1/video/generations/ /v1/videos/ |
| `App-BX6o9fW5_components/_Component40.jsx` | 559 | — |
| `App-BX6o9fW5_components/jn.jsx` | 544 | — |
| `App-BX6o9fW5_components/Qn.jsx` | 528 | — |
| `App-BX6o9fW5_components/Ln.jsx` | 410 | — |
| `App-BX6o9fW5_components/_Component11.jsx` | 396 | — |
| `App-BX6o9fW5_components/Qt.jsx` | 314 | — |

### 资源 / 文件上传

| 文件 | 行数 | 关键特征 |
|---|---|---|
| `httpClient-BknZwXjG_components/H_.jsx` | 12746 | /v1/chat/completions /v1/draw/completions |
| `httpClient-BknZwXjG_components/shared.js` | 11727 | /api/jianying/send /v1/gateway/ai-app |
| `vendor-Z-adA07W.js` | 4682 | /api/objects |
| `App-BX6o9fW5_components/Vr.jsx` | 4527 | /v1/gateway/task/ /files/resources/ |
| `httpClient-BknZwXjG_components/c_.jsx` | 2806 | — |
| `httpClient-BknZwXjG_components/As.jsx` | 2088 | — |
| `httpClient-BknZwXjG_components/bo.jsx` | 1694 | — |
| `httpClient-BknZwXjG_components/$s.jsx` | 1648 | — |

### 任务 / 工作流管理

| 文件 | 行数 | 关键特征 |
|---|---|---|
| `httpClient-BknZwXjG_components/H_.jsx` | 12746 | /v1/chat/completions /v1/draw/completions |
| `httpClient-BknZwXjG_components/shared.js` | 11727 | /api/jianying/send /v1/gateway/ai-app |
| `App-BX6o9fW5_components/Vr.jsx` | 4527 | /v1/gateway/task/ /files/resources/ |
| `App-BX6o9fW5_components/shared.js` | 3088 | /v1/video/generations/ /v1/videos/ |
| `ShareAppPage-C4RerI9i.js` | 623 | /api/workflow-apps/ /api/sync/default |

### 分享页（ShareAppPage）

| 文件 | 行数 | 关键特征 |
|---|---|---|
| `ShareAppPage-C4RerI9i.js` | 623 | /api/workflow-apps/ /api/sync/default |
| `share-CyPsaet6.js` | 23 | — |

### AI 对话 / 绘图接口

| 文件 | 行数 | 关键特征 |
|---|---|---|
| `httpClient-BknZwXjG_components/H_.jsx` | 12746 | /v1/chat/completions /v1/draw/completions |

### 视频生成

| 文件 | 行数 | 关键特征 |
|---|---|---|
| `httpClient-BknZwXjG_components/H_.jsx` | 12746 | /v1/chat/completions /v1/draw/completions |
| `App-BX6o9fW5_components/shared.js` | 3088 | /v1/video/generations/ /v1/videos/ |

## 八、符号级索引（混淆名 → 用途 → 落点，AI 反查用）

> 自动生成。`src/bundle/symbol_map.json` 是**全量**符号表（所有顶层函数/变量 → 文件/行号/用途），本文只内嵌**最有用的前 40 个**（带用途、被引用多的，尤其聚合导出与同名影子）。
> **怎么用**：看到一个短名（`Bl`/`Vr`/`_Component128`）不知干嘛 → 查本表或 `symbol_map.json` → 直接得用途 + 落点 + 行号，不靠猜。
> ⚠️ 行号为**定义位置**；同名符号可能跨文件（同名影子），改前务必确认是哪个文件。

| 符号 | 用途/角色 | 落点（文件:行） |
|---|---|---|
| `ar` ⚠同名×3 | 字段:json,status · fetch | `App-BX6o9fW5_components/shared.js:1248` · `httpClient-BknZwXjG_components/shared.js:319` · `src-_qSScO88_components/shared.js:4240` |
| `m` ⚠同名×3 | 字段:fromEntries,entries | `src-_qSScO88_components/shared.js:81` · `mediabunny-mp3-encoder-CZeRAvEV.js:102` · `endpointConfig-Bt85xi8d.js:84` |
| `Rn` ⚠同名×3 | 字段:text,query,caption,style,resolution,videoDuration | `App-BX6o9fW5_components/shared.js:924` · `httpClient-BknZwXjG_components/shared.js:114` · `src-_qSScO88_components/shared.js:3223` |
| `dr` ⚠同名×3 | hooks:useState,useRef,useEffect,useCallback · 字段:push,tool,error,index,function,name · fetch | `App-BX6o9fW5_components/shared.js:2537` · `httpClient-BknZwXjG_components/shared.js:399` · `src-_qSScO88_components/shared.js:4573` |
| `Or` ⚠同名×3 | 字段:set,keys,toString | `App-BX6o9fW5_components/shared.js:2975` · `httpClient-BknZwXjG_components/shared.js:714` · `src-_qSScO88_components/shared.js:4916` |
| `Cn` ⚠同名×2 | hooks:useState,useEffect,useMemo · 字段:trim,displayCategory,name,description,items,value | `App-BX6o9fW5_components/Cn.jsx:5` · `src-_qSScO88_components/shared.js:2582` |
| `Vr` ⚠同名×3 | hooks:useMemo,useEffect,useState,useRef,useCallback · 字段:current,items,total,totalPages,page | `App-BX6o9fW5_components/Vr.jsx:30` · `httpClient-BknZwXjG_components/shared.js:840` · `src-_qSScO88_components/shared.js:7200` |
| `Bt` ⚠同名×2 | 字段:text,status · fetch | `App-BX6o9fW5_components/shared.js:434` · `src-_qSScO88_components/shared.js:1737` |
| `Fn` ⚠同名×3 | 短函数 | `App-BX6o9fW5_components/shared.js:902` · `httpClient-BknZwXjG_components/shared.js:52` · `src-_qSScO88_components/shared.js:3087` |
| `Jn` ⚠同名×2 | 字段:nodes,entries,has,videoDurations,discountVideoModel,sd2VideoModel | `App-BX6o9fW5_components/shared.js:1079` · `httpClient-BknZwXjG_components/shared.js:189` |
| `or` ⚠同名×3 | api:/api/tasks/delete · fetch | `App-BX6o9fW5_components/shared.js:1270` · `httpClient-BknZwXjG_components/shared.js:336` · `src-_qSScO88_components/shared.js:4381` |
| `sr` ⚠同名×3 | 短函数 | `App-BX6o9fW5_components/shared.js:1890` · `httpClient-BknZwXjG_components/shared.js:346` · `src-_qSScO88_components/shared.js:4534` |
| `cr` ⚠同名×3 | 短函数 | `App-BX6o9fW5_components/shared.js:1893` · `httpClient-BknZwXjG_components/shared.js:370` · `src-_qSScO88_components/shared.js:4535` |
| `ur` ⚠同名×3 | hooks:useState,useRef,useEffect,useCallback · 字段:push,tool,error,index,function,name · fetch | `App-BX6o9fW5_components/shared.js:2536` · `httpClient-BknZwXjG_components/shared.js:392` · `src-_qSScO88_components/shared.js:4572` |
| `fr` ⚠同名×3 | 短函数 | `App-BX6o9fW5_components/shared.js:2909` · `httpClient-BknZwXjG_components/shared.js:434` · `src-_qSScO88_components/shared.js:4574` |
| `pr` ⚠同名×3 | 短函数 | `App-BX6o9fW5_components/shared.js:2910` · `httpClient-BknZwXjG_components/shared.js:435` · `src-_qSScO88_components/shared.js:4575` |
| `mr` ⚠同名×3 | 短函数 | `App-BX6o9fW5_components/shared.js:2911` · `httpClient-BknZwXjG_components/shared.js:459` · `src-_qSScO88_components/shared.js:4576` |
| `hr` ⚠同名×3 | 短函数 | `App-BX6o9fW5_components/shared.js:2912` · `httpClient-BknZwXjG_components/shared.js:478` · `src-_qSScO88_components/shared.js:4624` |
| `br` ⚠同名×3 | hooks:useContext | `App-BX6o9fW5_components/shared.js:2929` · `httpClient-BknZwXjG_components/shared.js:505` · `src-_qSScO88_components/shared.js:4833` |
| `Nr` ⚠同名×3 | api:/api/resources/clear · 字段:json · fetch | `App-BX6o9fW5_components/shared.js:3046` · `httpClient-BknZwXjG_components/shared.js:771` · `src-_qSScO88_components/shared.js:4955` |
| `Pr` ⚠同名×3 | api:/api/resources/rescan · fetch | `App-BX6o9fW5_components/shared.js:3068` · `httpClient-BknZwXjG_components/shared.js:772` · `src-_qSScO88_components/shared.js:4956` |
| `Z` ⚠同名×2 | api:/api/jianying/send · 字段:json,status,message,error,includes · fetch | `httpClient-BknZwXjG_components/shared.js:51` · `src-_qSScO88_components/shared.js:24493` |
| `xr` ⚠同名×2 | hooks:useContext | `httpClient-BknZwXjG_components/shared.js:510` · `src-_qSScO88_components/shared.js:4841` |
| `$r` ⚠同名×2 | api:/files/resources/ · 字段:indexOf,slice | `httpClient-BknZwXjG_components/shared.js:1576` · `src-_qSScO88_components/shared.js:7867` |
| `ei` ⚠同名×2 | api:/api/status · 字段:clone · fetch | `httpClient-BknZwXjG_components/shared.js:1599` · `src-_qSScO88_components/shared.js:7917` |
| `ti` ⚠同名×2 | api:/api/status · 字段:clone · fetch | `httpClient-BknZwXjG_components/shared.js:1600` · `src-_qSScO88_components/shared.js:7961` |
| `Xi` ⚠同名×2 | api:/public/platform/models · fetch | `httpClient-BknZwXjG_components/shared.js:2458` · `src-_qSScO88_components/shared.js:11185` |
| `$a` ⚠同名×2 | 字段:success,data · fetch | `httpClient-BknZwXjG_components/shared.js:3268` · `src-_qSScO88_components/shared.js:15432` |
| `eo` ⚠同名×2 | 字段:success,data · fetch | `httpClient-BknZwXjG_components/shared.js:3287` · `src-_qSScO88_components/shared.js:15461` |
| `to` ⚠同名×2 | 字段:status,json · fetch | `httpClient-BknZwXjG_components/shared.js:3304` · `src-_qSScO88_components/shared.js:15464` |
| `io` ⚠同名×2 | 派发事件 | `httpClient-BknZwXjG_components/shared.js:3355` · `src-_qSScO88_components/shared.js:15610` |
| `ao` ⚠同名×2 | 派发事件 | `httpClient-BknZwXjG_components/shared.js:3356` · `src-_qSScO88_components/shared.js:15611` |
| `js` ⚠同名×2 | api:/v1/audio/transcriptions · 字段:trim,error,word,start,end · fetch | `httpClient-BknZwXjG_components/shared.js:4368` · `src-_qSScO88_components/shared.js:18901` |
| `zl` ⚠同名×2 | api:/api/proxy | `httpClient-BknZwXjG_components/shared.js:6089` · `src-_qSScO88_components/shared.js:24042` |
| `Bl` ⚠同名×2 | api:/api/files/read,/api/proxy · local-tool · proxyMode · 字段:body,proxyMode,localPort,localToolBaseUrl,method,headers · fetch | `httpClient-BknZwXjG_components/shared.js:6097` · `src-_qSScO88_components/shared.js:24043` |
| `Gl` ⚠同名×2 | hooks:useContext,useState,useCallback,useEffect · api:/api/status,/api/files/upload,/api/kv/set,/api/kv/get · 字段:status,version,message,isConnected,statusText,json · fetch | `httpClient-BknZwXjG_components/shared.js:6207` · `src-_qSScO88_components/shared.js:24243` |
| `_f` ⚠同名×2 | hooks:useRef,useCallback,useEffect · 字段:current | `httpClient-BknZwXjG_components/shared.js:9397` · `src-_qSScO88_components/shared.js:28794` |
| `p` ⚠同名×3 | 短函数 | `src-_qSScO88_components/shared.js:73` · `mediabunny-mp3-encoder-CZeRAvEV.js:73` · `endpointConfig-Bt85xi8d.js:65` |
| `h` ⚠同名×3 | 短函数 | `src-_qSScO88_components/shared.js:86` · `mediabunny-mp3-encoder-CZeRAvEV.js:105` · `endpointConfig-Bt85xi8d.js:92` |
| `_Component24` ⚠同名×2 | hooks:useState,useEffect,useMemo · 字段:name | `App-BX6o9fW5_components/_Component24.jsx:6` · `httpClient-BknZwXjG_components/_Component24.jsx:4` |

> 全量符号（含无用途推断的短函数）见 `src/bundle/symbol_map.json`。

## 九、重建命令

```bash
npm run map        # 重建本图 + symbol_map.json
npm run contracts  # 校验契约全端同步（漏改检测）
npm run contracts -- --resnap  # 混淆重排后重建基线
```
