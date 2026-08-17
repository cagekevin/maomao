# TASK-051 — 探索：多端兼容"该走某路线却没走"缺口

> 你只能写这个文件，碰任何其他文件视为失败。本任务只探索 + 产出本文档，禁止改代码、禁止写脚本。

## ⚠️ 铁律
1. 只读不改，禁止写脚本。
2. 自包含，不查看其他 TASK-*。
3. 一切结论必须有代码证据（文件 + 行号 + 片段），行号由你亲自打开核实。

## 一、背景
项目既作 Chrome 扩展（chrome.storage），又作普通网页（localStorage），还在 mac/win 两端跑（启动方式不同、端口不同、浏览器不同）。实际出现过 Windows 打开报"保存失败"、mac 正常的问题。你的任务：**自己去 src/ 探索多端/多环境兼容相关代码，找出所有"该走某条路线却没走、或判定错误导致走了错误路线"的缺口**。

## 二、判断标准（你按此自己找）
- 本应判定 Chrome 扩展环境走 chrome.storage，却误判为普通网页走 localStorage（或反之）→ 数据不一致。
- 本应本地兜底（localStorage）却只走后端、后端断了就丢；或本应走后端却只走本地 → 跨端不同步。
- 硬编码路径/端口/API 地址，导致某端不可用。
- 某浏览器/某平台特有的 API（clipboard、broadcastChannel、URL 处理）没做兼容兜底。
- 扩展环境与网页环境行为不一致的隐式假设。

## 三、怎么做
1. 通读 `src/components/base/storageAdapter.js`（环境判定）、`apiBase.js`、`main.jsx`（initStorage）。
2. 找所有 `typeof chrome`、环境分支、硬编码 URL/端口、平台特有 API 的用法。
3. 判断每处"该走哪条路线、是否走对、是否做兜底"。

## 四、输出规范
表格：`| # | 环节 | 文件:行 | 本应走 | 实际走 | 风险 | 是否缺陷 |`

## 五、验收标准
1. ≥3 个多端兼容缺口/风险，每条带文件:行 + 证据。
2. 覆盖扩展/网页判定、本地/后端双写、硬编码地址、平台特有 API 兜底。
3. 只写本文件，不改代码、不写脚本。

---

## 六、探索范围与证据来源（亲自打开核实）

| 文件 | 核实内容 | 关键行号 |
|---|---|---|
| `src/components/base/storageAdapter.js` | `isExt` 判定、initStorage 防重、sGet/sSet/sRemove 分支与兜底 | 24-34, 73-97, 99-136 |
| `src/components/base/kvStore.js` | 统一存储分流 `storageGet/Set/Delete`、`isKvKey` | 48-73 |
| `src/components/base/projectStore.js` | 项目双写、画布快照 `saveCanvasState/loadCanvasState` | 4-9, 53-61, 146-170 |
| `src/components/base/apiBase.js` | 后端地址 `API_BASE` 硬编码 | 16 |
| `src/components/base/useLocalToolStatus.js` | 连接检测、`DEFAULT_PORT` 独立常量 | 19, 21, 29 |
| `src/components/base/faceMosaic.js` | 扩展资源解析 `resolveAsset`（正面样本） | 23-27 |
| `src/components/base/useAgentChat.js` | LLM 端点读取方式（修正 #5）、agent 历史键 | 48, 77-79, 187-195 |
| `src/App.jsx` | `BroadcastChannel` 监听/广播、`navigator.clipboard` | 160-177, 256-268, 595 |
| `src/components/TextNode.jsx` | `navigator.clipboard?.writeText` 无兜底 | 208 |
| `src/components/ImageBoxNode.jsx` | `ClipboardItem` 图片复制，两级 catch | 366-374 |
| `src/components/StepPrompt.jsx` | `writeText().catch(()=>{})` 静默吞错 | 114 |
| `src/components/VideoExtractNode.jsx` | clipboard 有 `sSet` 兜底（对照样本） | 304-305 |
| `src/main.jsx` | `initStorage` 启动调用、StrictMode 渲染 | 10, 12-18 |

---

## 七、发现的缺口/风险（按严重度排序）

| # | 环节 | 文件:行 | 本应走 | 实际走 | 风险 | 是否缺陷 | 严重度 |
|---|---|---|---|---|---|---|---|
| 1 | 画布快照写入本地兜底 | `kvStore.js:62-66` + `projectStore.js:146-169` | 断网/后端未起时双写 localStorage 兜底（对齐 `projectStore.persist()` 对 projects 的双写做法） | 对 `canvas-state-` 前缀只走 `kvSet`（`API_BASE/api/kv/set`，即 `http://127.0.0.1:18080`），**无任何本地兜底**；`App.jsx:258` 的 `saveCanvasState(...).catch(()=>{})` 静默吞错 | localTool 断开（Windows 未起/端口被占）时画布保存失败、用户无感知、下次打开丢画布——高度疑似"Windows 报保存失败"根因 | **是（设计缺口）** | 🔴 高 |
| 2 | 扩展环境 sGet 回退 localStorage 脏读 | `storageAdapter.js:89-97`（读取兜底）+ `100-119`（写入兜底） | 扩展环境只读 `chrome.storage.local` 的 `cache`；`localStorage` 仅作**写入**兜底，不应被**读取** | `sGet` 在扩展环境 cache miss 时 `return localStorage.getItem(...)`（96 行）。而 `sSet`（106-118）扩展环境优先写 chrome.storage、异步/同步失败才写 localStorage。一旦某次写失败落入 localStorage，当 cache 再次 miss（加载异常/刚启动）即被 96 行读到"脏 localStorage 数据"，与 chrome.storage 内容不一致 | 扩展环境读到陈旧/脏的 localStorage 值，造成数据不一致；扩展与网页行为隐式假设不同 | **是（缺陷）** | 🔴 高 |
| 3 | 后端地址硬编码（两处独立源） | `apiBase.js:16` 写死 `http://127.0.0.1:18080`；`useLocalToolStatus.js:21` 另写 `DEFAULT_PORT = 18080` | 支持 mac/win 端口可配，扩展环境按 `chrome.runtime.getURL('/')`/同源推断，避免 CORS/跨域 | 两处独立硬编码 18080，所有 API 层（kvStore、imageApi/videoApi/settingsApi、useLocalToolStatus）统一依赖；扩展打包后页面 origin 与 127.0.0.1 跨域，`fetch` 被 CORS 拦截 | 改端口/打包扩展时某端完全不可用；硬编码与"多端跑"冲突；两处不同步更易漏改 | **是（已知技术债）** | 🟠 中 |
| 4 | 扩展资源解析已正确、API 地址未对齐 | 对照：`faceMosaic.js:23-27` 已 `chrome.runtime.getURL` 兜底 | `apiBase.js` 应像 `faceMosaic.resolveAsset` 一样做环境自适应 | `faceMosaic.resolveAsset` 正确处理扩展资源路径，但 `API_BASE` 没有采用同样的"扩展环境走 getURL/同源"策略——同一项目里存在**正反两种处理范式不一致** | 证明能力具备而 `API_BASE` 遗漏，属"该对齐却没对齐"的隐性缺口 | **是（一致性缺口）** | 🟠 中 |
| 5 | clipboard 平台兼容兜底缺失/不一致 | `TextNode.jsx:208` 无 catch；`StepPrompt.jsx:114` 的 `.catch(()=>{})` 静默吞错；`ImageBoxNode.jsx:368` 依赖 `ClipboardItem`（扩展 popup/非 https 不可用） | 非 https/非聚焦/扩展环境 `navigator.clipboard` 不可用时，降级到 `sSet('mutiwindow-clipboard')` 或至少 toast（参考 `VideoExtractNode.jsx:304-305` 已有兜底） | `TextNode.jsx:208` 直接用 `?.writeText(text)` 连失败提示都没有；`StepPrompt.jsx:114` catch 后无提示；`ImageBoxNode.jsx:368-374` 虽有两级 catch，但仍先假设 clipboard 可用 | 扩展弹出页/隐私模式/非激活页复制静默失败；各组件兜底策略不统一（扩展与网页行为不一致） | **是（缺陷，对照样本未对齐）** | 🟠 中 |
| 6 | BroadcastChannel 跨端无降级 | `App.jsx:163`（监听）、`App.jsx:260`（广播） | 不可用时降级（如轮询 KV `_version`，已由 `saveCanvasState` 写入） | 两者均 `try/catch` 兜底，但**捕获后仅 `console.warn`**，无降级机制。Chrome 扩展 popup/background 或隐私模式下 `BroadcastChannel` 可能不可用 → 多窗口"画布在其他窗口被修改"红色警告静默失效 | 用户以为无冲突，实际另一窗口已改；扩展与网页隐式假设"BroadcastChannel 总可用"不成立 | **是（缺陷，缺降级）** | 🟡 低 |
| 7 | LLM 端点读取方式（修正说明） | `useAgentChat.js:77` `import.meta.env?.VITE_LLM_CHAT_BASE_URL || ''` | 已支持 env 覆盖（**非硬编码**，默认空串→走同源/相对路径） | 与 `apiBase.js` 不同，**此处已正确**；仅注释 49-50 行描述"默认走 18080"与代码（77 行空兜底）**不一致**——文档与实现脱节 | 不是运行期缺陷，但注释误导维护者；不计入兼容性缺口，仅作勘误 | **否（注释勘误）** | ⚪ 无 |

---

## 八、已正确防护 / 非缺陷项（审计严谨性，避免误报）

| 项 | 文件:行 | 说明 |
|---|---|---|
| StrictMode 下 initStorage 防重 | `storageAdapter.js:74` `if (loaded) return` | 模块级 `loaded` 标志，React 18 StrictMode 双调用安全，不会重复加载或竞态 |
| 扩展环境判定已严格 | `storageAdapter.js:24-34` | 已用 `chrome.runtime?.id && typeof chrome.storage?.local?.get === 'function'` 严格判定，修复了"假 chrome 对象误判"；方向正确 |
| 扩展资源路径自适应 | `faceMosaic.js:23-27` | `resolveAsset` 优先 `chrome.runtime.getURL`、失败回退本地——正面样本（反衬 #3/#4 的 API 地址遗漏） |
| clipboard 已有正确范本 | `VideoExtractNode.jsx:304-305` | `try { navigator.clipboard.writeText } catch { sSet('mutiwindow-clipboard') }`——证明项目已知兜底范式，#5 是被遗漏处 |

---

## 九、审计结论

共发现 **7 项记录**（6 项缺口 + 1 项注释勘误），覆盖验收标准要求的四类，并额外补充了"已防护项"以体现审计完整性：

- **扩展/网页判定**：#2（sGet 脏读兜底，🔴）、#7 勘误（注释与实现不符）。
- **本地/后端双写**：#1（画布快照 KV 无本地兜底，🔴，最可能产生"Windows 报保存失败"）、#6（冲突版本写 KV 但窗口同步广播无降级）。
- **硬编码地址**：#3（API_BASE 与 DEFAULT_PORT 两处独立硬编码 18080）、#4（faceMosaic 已自适应而 API_BASE 未对齐）。
- **平台特有 API 兜底**：#5（clipboard 在 TextNode/StepPrompt/ImageBoxNode 兜底缺失或不一致，对照 VideoExtractNode 未对齐）、#6（BroadcastChannel 不可用无降级）。

**与原始草稿相比的修订**：
1. 修正原 #5 中关于"LLM 端点硬编码"的误判——`useAgentChat.js:77` 实为 env 可配，仅注释误导；真正的硬编码在 `apiBase.js:16` 与 `useLocalToolStatus.js:21` 两处独立源。
2. 新增 #4（faceMosaic 正面样本反衬 API_BASE 遗漏），证明"能力具备却没用"，增强缺口说服力。
3. 细化 #5（原 clipboard 缺口）：拆出 TextNode 无 catch、StepPrompt 静默吞错、ImageBoxNode 依赖 ClipboardItem 三种不同缺失形态。
4. 新增"已防护项"一节，明确 initStorage 防重、环境判定严格、faceMosaic/VideoExtractNode 正面样本，避免把正确代码误报为缺陷。
5. 按严重度排序（🔴/🟠/🟡/⚪），便于后续修复排期。

**最高优先级修复建议（仅记录，不改代码）**：
1. `saveCanvasState`（`projectStore.js:146-169`）对画布快照增加 localStorage 双写兜底（对齐 `persist()` 项目双写），并让 `App.persistCanvas`（`App.jsx:258`）在失败时 toast，而非 `.catch(()=>{})` 静默吞掉。
2. `storageAdapter.sGet`（`storageAdapter.js:89-97`）扩展环境下移除"cache miss 回退 localStorage"的**读取**兜底（写入兜底 112/117/131/135 可保留），根除脏读。
3. `apiBase.js:16` 在扩展环境从 `chrome.runtime.getURL('/')` 推断同源、或读取可配置端口，消除与 `useLocalToolStatus.js:21` 重复硬编码；同步更新 `useAgentChat.js:49-50` 注释以匹配 `77` 行实现。
4. clipboard / BroadcastChannel 缺失兜底处对齐已有样本（VideoExtractNode 的 `sSet` 兜底、KV `_version` 轮询降级）。
