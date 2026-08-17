# 收口缺口核实终稿（TASK-053 ~ TASK-060）— 权威裁决与优先级

> 作者：人工核实（对照代码）
> 日期：2026-08-17
> 范围：TASK-053 ~ TASK-060 共 8 份"只读探索·收口缺口"报告
> 方法：对每份报告的关键论断打开所指文件:行核实，判定「真缺口 / AI 误判 / 架构建议 / 已修复」
> 对比上一批（045-052）：**这批报告质量明显更高**——每份都带"自审修订记录"删除了虚构/虚高断言，核心论断基本站得住。**未发现典型 AI 误判**，仅个别点因代码已演进而滞后（见 TASK-054 G1）。

---

## 一、总览裁决表（按优先级排序）

| 优先级 | 任务 | 核心真实度 | 主要缺口 | 用户可见影响 | 修复成本 |
|---|---|---|---|---|---|
| **P0** | TASK-053 存储与持久化 | ✅ 确认真 | ①directorStore 裸写 localStorage（②版本号/③双键经复核降级，非确凿） | 高（数据孤立/跨端丢失） | 中 |
| **P0** | TASK-059 多端兼容 | ✅ 确认真 | ①directorStore 裸写 localStorage(同上)；②KV 云同步为设计边界(非缺口) | 高（跨端丢失） | 中 |
| **P0** | TASK-058 AI引擎与脚本盒 | ✅ 确认真 | G6 前端未注册 webhook 收口 | 高（遗漏核心功能） | 中 |
| **P1** | TASK-057 节点体系与管线 | ✅ 确认真 | B nodeTypes 平行维护 D 程序化建边绕过 onConnect | 中（易回归） | 中 |
| **P1** | TASK-060 性能与画布引擎 | ✅ 确认真 | G1 viewportMoving 硬编码 false（G2 卸载待实测） | 中（切换失效） | 低 |
| **P1** | TASK-055 状态机与会话并发 | ✅ 确认真 | Gap A 全局单飞锁 executingPlan | 中（拒绝并发） | 中 |
| **P2** | TASK-054 异步任务与生成 | ⚠️ 部分滞后 | G6 webhook 未接线(真) G1 stop 已修(滞后) G8 引擎层持久化(架构) | 中 | 中 |
| **P2** | TASK-056 错误处理与降级 | ✅ 确认真 | 节点级降级孤立/无收敛 | 中 | 中 |

**结论一句话**：8 份全部含真实缺口或有效架构建议，**无任何一份是虚构/误判型**。最高优先级集中在"directorStore 绕过统一存储层"（053/059 重合，应合并修一次）与"前端 webhook 未收口"（058）。TASK-054 的 G1（stop 无效）因代码已演进为 AbortController 实现，**疑似已修复，标注滞后**。

---

## 二、逐条权威核实

### P0-1 · TASK-053 存储与持久化 —— 【确认真，含多处】

**核实证据**：
- 缺口①：`src/components/director3d/editor/store/directorStore.ts:177-179` 定义 `storyai-3d-director-local-model-library` / `storyai-3d-director-desk-demo` / 前缀键；`:258` `getLocalStorageSafe()` 直接返回裸 `localStorage`（非 storageAdapter）；`:273` `storage.getItem(...)`、`:292` `writePersistedLocalModelAssets`、`:378` `writePersistedDirectorState` 直写。**确凿绕过统一层**，与桌面/CANVAS 双端兼容加固无关，跨端不通、易撞键（同浏览器 localStorage 命名空间，多模块共存时键冲突风险）。
- 缺口②（版本号碰撞，**降级为设计边界**）：`projectStore.js:155` 用 `Date.now()` 作版本号，但 `:158-161` **已实现冲突检测**（remoteVer > version 则拒绝覆盖）。同毫秒双写概率极低，且相等时不拒绝（后者兜底覆盖）——属理论风险，**非确凿 bug**。报告"并发保存必然碰撞"表述过度，判定为设计边界。
- 缺口③（两套存储键，**证据不足，待确认**）：报告称"快照 `canvas-state-v1-` vs 事件流 `canvas-events-v1-` 并存"。二次核实：全代码搜索 `canvas-events|events-v1|recordEvent` 仅命中 CSS `pointer-events`（无关），**未发现 `canvas-events-v1-` 的真实写入点**——事件流可能已废弃或未落地。此条**撤销**，不作为缺口。

**裁决**：✅ **缺口①确认真缺口（P0）**；缺口②/③ 降级（非确凿）。directorStore 裸写是最高优先——它是最新引入的 3D 导演模块，完全没走 `storageAdapter`/`kvStore` 的统一双端兼容路径。

**优先级理由**：数据孤立 + 跨端丢失 + 新版模块埋雷 → P0。

---

### P0-2 · TASK-059 多端兼容与云同步 —— 【确认真，与 053 重合】

**核实证据**：
- 缺口①（directorStore 裸写 localStorage）：同 TASK-053 缺口①，已核实。两份报告独立得出同一结论，互证可信。
- 缺口②（KV 无远程云同步兜底，**降级为架构边界**）：`src/components/base/kvStore.js:62` `storageSet` 对非 localStorage key 走 `kvSet`（本地 localTool KV）；且 `cloudSync.js:15` **明确注释「画布快照 canvas-state-v1-* 仅留本机 localTool，不同步」**——画布内容有意不上云（隐私/体积）。故"KV 无远程同步"是**设计取舍，非缺口**。

**裁决**：✅ **缺口①确认真缺口（P0，与 053 同源合并修）**；缺口②为已知架构边界（画布有意不同步），降级，不作为缺口。

**优先级理由**：与 053 同源，跨端丢失高影响 → P0。

---

### P0-3 · TASK-058 AI引擎与脚本盒 —— 【确认真，G6 最高】

**核实证据**：
- 缺口 G6（前端 webhook 未收口）：全代码库搜索 `webhook` → **0 匹配**。**确凿**。网关侧（DOCS-CORE 提及 gateway 已收口 webhook 注册）已支持，但前端 `useNodeGeneration`/`scriptBoxEngine` 系列从未注册 webhook，异步完成通知仍依赖轮询/回调，错过网关 webhook 能力。
- 缺口 G8（脚本盒持久化归属）：`scriptLibrary.ts` 搜索 persist/localStorage/kvSet/sSet/storageSet → **0 匹配**，引擎层 `saveScriptToNode` 不持久化。**但**报告自审已标注"node 层持久化已在 046 流程收口"，即脚本盒结果实际由节点数据层落盘，G8 属架构澄清而非未实现 → 降级为"已部分收口"。

**裁决**：✅ **G6 确认真缺口（P0 级）**；G8 已部分收口（标注，不单列）。修复方向：在 `useNodeGeneration` 启动生成时向 gateway 注册 webhook（携带完成回调地址），对齐 DOCS-CORE 网关能力。

**优先级理由**：遗漏网关核心能力、异步链路不完整 → P0。

---

### P1-1 · TASK-057 节点体系与管线 —— 【确认真】

**核实证据**：
- 缺口 B（nodeTypes 平行维护）：`src/App.jsx:74-86` `const nodeTypes = { textNode, imageNode, ..., videoProcessNode, faceMosaicNode }` 注释"新增节点时在此登记"——手写字面量，与 NodePalette 平行。报告成立。
- 缺口 D（程序化建边绕过 onConnect）：`src/components/VideoProcessNode.jsx:709/732/755` 三次 `setEdges((es) => es.concat([{ id: 'e-${id}-${nid}', source: id, target: nid, sourceHandle: 'main-output' }]))` 直接改 edges，**不经过 onConnect 的校验/派生逻辑**。报告成立。

**裁决**：✅ **确认真缺口**。B 是回归陷阱（新增节点忘登记 nodeTypes 就白加）；D 导致程序化建边不触发 onConnect 的副作用（如自动补全 handle、连线合法性校验）。修复：B 用 palette 派生或建单源注册表；D 抽 `connectNodes(from,to)` 统一入口复用 onConnect。

**优先级理由**：易回归、连线语义不一致 → P1。

---

### P1-2 · TASK-060 性能与画布引擎 —— 【确认真，G1】

**核实证据**：
- 缺口 G1（viewportMoving 硬编码 false）：`src/App.jsx:1336` `<LodProvider value={{ lodLevel, viewportMoving: false, nodeCount: nodes.length, handleFollowLimit: 60, edgeFxLimit: 50 }}>` —— `viewportMoving` 写死 `false`，LOD 的"视口移动时降级"分支永不触发。报告成立。
- 缺口 G2（3D/视频卸载，**标注需实测**）：`PanoramaNode.jsx` 搜索 `useEffect 清理 / dispose / revokeObjectURL` → **0 命中**，无显式卸载清理。但 react-three-fiber 通常自动释放 WebGL 上下文，是否真实泄漏需 DevTools 实测。报告观察有效但影响待量化。

**裁决**：✅ **G1 确认真缺口（P1）**。后果：平移/缩放画布时本应降级的特效（handle 跟随、edge 特效）不降级，大图平移卡顿。修复：把 `viewportMoving` 接 `useViewportState` 的 `isMoving`（`useReactFlow` `onMoveStart/End` 驱动）。G2 标注待实测，不单列优先。

**优先级理由**：G1 明确硬编码、影响性能体验、修复极低 → P1。

---

### P1-3 · TASK-055 状态机与会话并发 —— 【确认真，Gap A】

**核实证据**：
- 缺口 Gap A（全局单飞锁）：`src/components/base/canvasPlanExecutor.js:21` `let executingPlan = false`（模块级全局）；`:210` `if (executingPlan) return { workflow: { status: 'failed', error: '已有计划正在执行，请稍后再试' } }`；`:212` 进锁，`:453` finally 释放。**确凿**。
- 报告正确指出：模块级锁跨会话/跨用户互斥，且无 owner 标识，无超时兜底（若执行中异常未走 finally 则永久死锁——虽有 finally 但仍无 owner/超时）。

**裁决**：✅ **确认真缺口**。影响：同一浏览器多画布标签并发跑计划会被互相拒绝。修复：锁绑定会话/用户维度 + 加 owner + 超时自动释放。

**优先级理由**：并发正确性 + 潜在死锁 → P1。

---

### P2-1 · TASK-054 异步任务与生成 —— 【部分滞后，G6 真 / G1 已修】

**核实证据**：
- 缺口 G6（webhook）：同 TASK-058 G6，搜索 0 匹配 → **确认真缺口**（与 058 合并修）。
- 缺口 G1（stop 形同虚设）：**与代码矛盾**。核实 `src/components/base/useNodeGeneration.js:44-50` 已实现 `AbortController`，`stop()` 调 `abortRef.current?.abort()` 真中断请求。**报告 G1 疑似基于旧代码，已滞后**——标注"可能已修复"。
- 缺口 G8（引擎层持久化）：同 TASK-058 G8，已部分收口。

**裁决**：⚠️ **G6 确认真（合并 058 修）；G1 疑似已修复（标注滞后）；G8 已部分收口**。报告整体仍有价值（webhook 主线），但 G1/G8 已非缺口。

**优先级理由**：核心 webhook 缺口已归 P0（058），其余已收口 → 本报告降 P2。

---

### P2-2 · TASK-056 错误处理与降级 —— 【确认真】

**核实证据**：
- 报告论证：节点级错误降级（如视频抽帧失败、图片生成失败）目前各自 `setError`/`catch` 孤立处理，未形成"节点降级 → 画布级收敛/重试/用户提示"的统一策略；与 TASK-046（保存静默吞错，已修）同源问题在不同链路重现。
- 该论断属于系统性观察，未在报告中给出唯一可视化崩溃点，但符合代码现状（`storageAdapter.localStorageSet` 已有报错上报，但节点生成链路的 catch 大多只 setState 不收敛）。

**裁决**：✅ **确认真缺口（架构级）**。建议抽统一的 `nodeErrorBoundary`/重试策略，对齐已修的 TASK-046 上报模式。

**优先级理由**：系统性、修复中等、非单点崩溃 → P2。

---

## 三、行动建议（按优先级立项，去重后）

| 顺序 | 合并任务 | 动作 | 状态 |
|---|---|---|---|
| 1 | 053+059 缺口① | `directorStore.ts` 改用 `storageAdapter`/`kvStore`（替换 `getLocalStorageSafe` 直写） | 待修 |
| 2 | 058+054 G6 | 前端生成链路注册 gateway webhook（携带完成回调） | 待修 |
| 3 | 060 G1 | `App.jsx:1336` 接 `viewportMoving` 真实状态 | 待修 |
| 4 | 057 B | nodeTypes 由单源注册表/palette 派生 | 待修 |
| 5 | 057 D | 抽 `connectNodes()` 复用 onConnect 校验 | 待修 |
| 6 | 055 Gap A | executingPlan 锁加 owner/超时/会话绑定 | 待修 |
| 7 | 053 ② | canvasVersions 改用单调版本号（理论碰撞风险，低优先） | 待评估 |
| 8 | 056 | 抽统一节点错误降级/重试收敛策略 | 待修 |
| — | 059 ② / 053 ③ / 054 G1 / 058 G8 | 设计边界 / 证据不足 / 已收口 / 滞后 | 不单列 |

---

## 四、给 AI 探索报告的总体评价

这批 8 份（053-060）质量显著高于上一批（045-052）：
- **全部带"自审修订记录"**，主动删除了虚构断言（如 TASK-054 删掉了"前端引擎伪实现"等虚高项）。
- **核心论断全部经代码核实成立**，无典型 AI 误判。
- **唯一滞后点**：TASK-054 G1（stop 无效）因代码已演进为 AbortController 实现而失效——说明 AI 报告基于快照时点，需标注"可能已修复"。
- **建议**：后续探索类报告统一在文首标注"代码快照日期"，并区分"已核实 / 疑似滞后 / 架构建议"，可减少人工复核成本。

---

## 五、执行记录（已落代码 · 0 lint 错误）

| 任务 | 文件:行 | 改动 | 核验 |
|---|---|---|---|
| P0 053/059 | `directorStore.ts:258/273/292/378/396` | 删除 `getLocalStorageSafe` 裸写，改用 `sGet/sSet` 统一层（跨端兼容 + 配额保护） | ✅ 0 lint |
| P1 060 G1 | `App.jsx:185/1403/1336` | 加 `viewportMoving` 真实状态，ReactFlow `onMoveStart/onMoveEnd` 驱动，`LodProvider` 接入 | ✅ 0 lint |
| P1 055 Gap A | `canvasPlanExecutor.js:21/210/453` | 单飞锁加 `executingPlanSince` + 120s 超时兜底，防永久死锁 | ✅ 0 lint |

### 经核实未执行（避免误改 / 回归）

- **TASK-058 G6 / TASK-054 webhook**：二次核实发现系统异步结果靠 `pollTask.js` 周期轮询 `gateway/task/{id}` 已可靠获取（含刷新恢复），且本地画布（127.0.0.1）网关 webhook 回调不可达。**轮询是本地优先产品的正确架构，webhook 仅为可选优化，非缺口** → 不执行，原 P0 降级为架构可选。
- **TASK-057 D（VideoProcessNode 程序化建边绕过 onConnect）**：确认真缺口（边不入撤销栈 + id 不规范），但彻底修复需把整个 spawn（加节点 + 加边）原子化进撤销栈，属配套改造、改动面大风险高 → **不在本次最小修复范围**，标注待办。

### 待办（未执行，需单独立项）

| 任务 | 内容 | 优先级 |
|---|---|---|
| TASK-057 B | nodeTypes 由单源注册表 / palette 派生（中风险重构） | 中 |
| TASK-057 D | spawn 操作整体接入 `history.record` 撤销栈 | 中 |
| TASK-053 ② | canvasVersions 改用单调版本号（理论碰撞风险） | 低 |
| TASK-056 | 抽统一节点错误降级 / 重试收敛策略（架构级） | 中 |
