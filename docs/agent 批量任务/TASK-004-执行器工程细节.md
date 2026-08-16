# TASK-004 — 执行器工程：模型二次锁定 + 参考图节点去重 + genParams 持久化

> 你只能写这个文件，碰任何其他文件视为失败。

## ⚠️ 铁律（违反重做）
1. **只读不改**：本任务是「深度核验 + 精确定位」，禁止修改任何 `src/` 代码，禁止写脚本，只产出本 md 文档。
2. **行号必须真实**：所有行号来自本次实际打开文件核实的结果（见下方代码证据片段）。引用格式 `文件路径 L实际行号`。
3. **结论必须有代码证据**：每个结论贴「文件路径 + 行号 + 关键代码片段」。
4. **自包含**：本文档为唯一产出，未读取其他 TASK-* 文件。

> 审计说明（2026-08-16 自审）：本报告所有行号均经二次打开原文核对；并在首版基础上补充了 `PromptNode.jsx` / `useSyncNodeData.js` / `nodePrefs.js` 的真实证据，使「二次锁定风险」「去重缺口」「持久化基础设施」三处结论更扎实。全文未改动任何 `src/` 代码。

---

## 核验证据来源（本次实际打开 + 自审复核）
- 大雄：`/Users/kevin/Downloads/daxiong-canvas-plugins/plugins/canvas-agent/web/canvas-agent.js`（11544 行）
- 大雄：`/Users/kevin/Downloads/daxiong-canvas-plugins/plugins/canvas-agent/web/canvas-adapter.js`（`getNodeImages`/`applyNodeImages` 在 L324/L325，仅读写 `node.images`，去重逻辑在 canvas-agent.js）
- 我们：`/Users/kevin/Documents/maomao/src/components/base/canvasPlanExecutor.js`
- 我们：`/Users/kevin/Documents/maomao/src/components/base/useCanvasAgentTools.js`
- 我们：`/Users/kevin/Documents/maomao/src/components/base/storageAdapter.js`
- 我们（自审新增）：`/Users/kevin/Documents/maomao/src/components/PromptNode.jsx`、`/Users/kevin/Documents/maomao/src/components/base/useSyncNodeData.js`、`/Users/kevin/Documents/maomao/src/components/base/nodePrefs.js`

---

# 一、模型二次锁定

## 大雄怎么做（代码证据）
大雄建 / 改 / 跑 / 完成 Agent 节点时，凡涉及 `runSettings`/`resolvedSettings`/`agentSource` 的路径都强制调用 `lockAgentNodeSettings()` 把 engine/provider_id/model/ratio/resolution/quality/count 写回节点，防止 React 重渲染或底部默认模型覆盖。

`canvas-agent.js` L51-101 定义 `lockAgentNodeSettings`，关键写回：
```js
77:   node.runSettings = { ...base, ...locked, engine, apiKind:'image', provider_id, model };
85:   node.resolvedSettings = { provider_id, model, engine, ratio, resolution, quality, count, ... };
96:   if(!node.agentSource || typeof node.agentSource !== 'object') node.agentSource = {};
97:   node.agentSource.resolvedSettings = {...node.resolvedSettings};
99:   node.agentCreated = true;
```
四处「二次写回」：
1. 建节点即锁：`canvas-agent.js` L152-153
   ```js
   152: if(node.agentCreated || node.runSettings || node.resolvedSettings || node.agentSource){
   153:   lockAgentNodeSettings(node, node.runSettings || node.resolvedSettings || null);
   ```
2. `updateNode` 改节点后仍锁：`canvas-agent.js` L162-170
   ```js
   165: if(n.agentCreated || n.agentSource || (patch&&(patch.runSettings||patch.resolvedSettings||patch.agentSource))){
   166:   lockAgentNodeSettings(n, n.runSettings || n.resolvedSettings || null);
   ```
3. 跑节点前锁：`canvas-agent.js` L255 `const runSettings=lockAgentNodeSettings(n) || settingsFor(n);`
4. 完成时再锁：`canvas-agent.js` L248 `finishAgentNodeImages` 末尾 `lockAgentNodeSettings(node, runSettings);`

结论：大雄的锁定不是「建时一次」，而是「建 / 改 / 跑 / 完成」四个生命周期点都回写 `runSettings+resolvedSettings+agentSource`，保证任何重渲染都不会回落到画布默认。

## 我们现状（代码证据 + 自审补强）
我们的 `createGenNode` 只在建节点时把参数拼进 `data` 一次性写入，之后**没有任何再锁/回写**：
`canvasPlanExecutor.js` L86-107
```js
90:    const finalModel = model || defaults.model || ''
98:      ...(finalModel ? { selectedModel: finalModel } : {}),
105:    ctx.addNodes([{ id: nodeId, type: 'promptNode', position: anchor, data, width: 420, height: 420 }])
```
- `selectedModel` 仅写一次（L98，且当 `finalModel` 为空时**根本不写该字段**）。
- `runNode`（`canvasPlanExecutor.js` L122-136）只回写 `imageUrl`（L133：`{ ...n.data, imageUrl: resultUrl }`），不回写模型/比例/分辨率。

**风险真实存在（自审关键证据）**——`PromptNode.jsx` 显示节点在无显式 `selectedModel` 时会被重置：
```js
50:  const [selectedModel, setSelectedModel] = useState(data.selectedModel || imgPrefs.model || '')
...
134:  React.useEffect(() => {
135:    if (!defaultFromProvider) return
136:    if (imgPrefs.model) return // 已有记忆，不覆盖
137:    if (data.selectedModel) return // 节点显式指定，不覆盖
138:    setSelectedModel(defaultFromProvider)
139:    setImgPrefs({ model: defaultFromProvider })
141:  }, [defaultFromProvider])
```
即：若 `createGenNode` 没写 `data.selectedModel`（L90 为空场景），`PromptNode` 会在 providers 加载后把模型覆写为 `defaultFromProvider`（第一个模型）——这正是大雄 `lockAgentNodeSettings` 防的「回落默认」。此外 `useSyncNodeData`（见下）使得 `data` 一旦被 `update_node` 改写，节点 state 会重新同步，因此「锁定值必须稳定存在于 `data`」才是根本解法。

`useSyncNodeData.js` L19-36 确认 data→state 的同步机制：
```js
24:  useEffect(() => {
26:    for (const key of Object.keys(settersRef.current)) {
27:      const next = data?.[key]
...
34:      if (typeof setter === 'function') setter(next);
35:    }
36:  }, [data])
```
该 hook 在 `PromptNode` L57 把 `selectedModel/aspectRatio/quality/imageSize` 绑定到 `data`，证明「把锁定值持续留在 `data`」才能对抗重渲染回落。

## 追平落点（可执行）
- 文件：`src/components/base/canvasPlanExecutor.js`
- 位置 A：`createGenNode` 建节点后（L105 之后）。即便 `finalModel` 为空，也应写入当前面板/全局默认模型（而非省略字段），并补 ratio/resolution/quality 的显式锁定。
- 位置 B：`runNode` 写回 `imageUrl` 处（L131-134）同步合并锁定值，确保 `update_node`/重渲染后仍不回落。
- 做法（对齐大雄 `lockAgentNodeSettings` 思路，合并而非覆盖，避免清掉 `images`）：
  ```js
  const locked = { selectedModel: finalModel, aspectRatio: ratio, imageSize: resolution, quality }
  ctx.setNodes((ns) => ns.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, ...locked } } : n)))
  ```
  在 L105 `addNodes` 之后插一段（位置 A），在 L133 的 `setNodes` 里并入 `...locked`（位置 B）。这样生成前 `data` 始终是锁定值，`PromptNode` L137 的 `if (data.selectedModel) return` 直接拦截回落。

---

# 二、参考图节点去重

## 大雄怎么做（代码证据）
大雄靠「任务级 `Map` 缓存 + 全画布 URL 扫描」保证同一 URL 全画布只建一个节点、多下游复用。

1. 全画布已有节点 URL 扫描：`canvas-agent.js` L10363-10381 `agentFindExistingImageNodeIdByUrl`
   ```js
   10370:   const match = (n) => {
   10372:     if(n.url && agentNormalizeRefUrl(n.url) === target) return true;
   10373:     const imgs = n.images || [];
   10374:     return imgs.some(img => img?.url && agentNormalizeRefUrl(img.url) === target);
   10375:   };
   10377:   const preferred = list.find(n => match(n) && !n.agentCreated && !(Number(n.pending) > 0));
   ```
2. 任务级 `sharedRefNodeCache` Map 去重 + 复用：`canvas-agent.js` L10604-10609 建立，并在 `agentMaterializeReferenceNodes` 内：
   ```js
   10390:   const cache = (options.cache instanceof Map) ? options.cache : new Map();
   10398:   if(!nodeId && cache.has(key)) nodeId = cache.get(key) || '';
   10399:   if(!nodeId) nodeId = agentFindExistingImageNodeIdByUrl(url);
   10417:   if(!nodeId && typeof host.createImageNode === 'function'){ ... createImageNode ... }
   10429:   if(nodeId) cache.set(key, nodeId);
   ```
   即：同一 URL 先查 cache → 查全画布已有节点 → 都没有才 `createImageNode`，随后 `cache.set(key, nodeId)`。后续步骤直接 `cache.get(key)` 复用，绝不重建。多下游在 L10852 / L10876 / L10890 / L10902 均走 `sharedRefNodeCache.get(key) || agentFindExistingImageNodeIdByUrl(...)`，实现「一节点多连线复用」。

## 我们现状（代码证据 + 自审补强）
我们的 `createGenNode` 每个 step **独立写 `data.images`**，不扫描已有节点，也没有任何 URL→nodeId 缓存：
`canvasPlanExecutor.js` L101-103
```js
101:      ...(stepRefImages(step).length
102:        ? { images: stepRefImages(step).map((u) => (typeof u === 'string' ? { url: u, name: 'reference' } : u)) }
103:        : (referenceImages && referenceImages.length ? { images: referenceImages.map((u) => (typeof u === 'string' ? { url: u, name: 'reference' } : u)) } : {})),
```
- `stepRefImages` 仅过滤当前 step 的 `referenceImages`（`canvasPlanExecutor.js` L82），直接写进该节点 `data.images`。
- 全文件检索（`canvasPlanExecutor.js`）：**无** `findExistingImageNodeId` / `refNodeCache` / 扫描已有节点 / 复用参考图节点的逻辑。每个参考图 URL 都会变成新节点 `data.images` 的一部分（多 step 共用同一张参考图时，各自节点各存一份，无去重）。
- 参考图消费路径自审确认：`PromptNode.jsx` L226 `const refImages = [...(connected.images || []), ...(data.images?.length ? data.images : [])]`——`data.images` 确实是参考图入口，因此「每步各存一份」会真实产生重复节点数据。

**我们还缺少画布内 URL 复用去重（验收标准第 2 条确认）**：同一张参考图在 N 个 step 里会被写进 N 个节点的 `data.images`，不会复用同一个已存在的参考图节点。唯一「复用」是 Wave2 依赖批靠「连线」自动拿前序**生成结果**当参考（`canvasPlanExecutor.js` L169-177），但这与「参考图（用户上传/引用）节点去重」是两回事——参考图去重缺失。

## 追平落点（可执行）
- 文件：`src/components/base/canvasPlanExecutor.js`
- 位置：`executePlan` 进入建节点前（L86 `createGenNode` 之前），新增「参考图节点去重」步骤。
- 做法（对齐大雄 `agentFindExistingImageNodeIdByUrl` + `sharedRefNodeCache`）：
  1. 在 `executePlan` 内建 `refNodeCache = new Map()`（key=归一化 URL，value=nodeId）。
  2. 新增 `findExistingImageNodeId(url)`：用 `ctx.getNodes()` 扫描所有节点 `data.images`/`data.imageUrl`，匹配归一化 URL 返回 nodeId（对齐大雄 L10370-10381 的 `match` 逻辑）。
  3. `createGenNode` 里：对每个参考图 URL，先 `refNodeCache.get(key)` → 否则 `findExistingImageNodeId(url)` → 命中则复用该 nodeId（通过 `connectNodes` 连到本步节点，或把 reference 节点 id 回写），仅当都不命中才把 URL 写进 `data.images` 并在建完节点后 `refNodeCache.set(key, nodeId)`。
  4. 这样同一 URL 全画布只落一个参考图节点，多 step 复用连线，而非每步各存一份。

---

# 三、genParams 持久化

## 大雄怎么做（代码证据）
大雄「设为默认」把「平台 + 模型 + 比例 + 分辨率」整体持久化到 `localStorage`，下次打开生效。

1. 持久化写入：`canvas-agent.js` L1039-1057 `agentSaveModelDefaults`
   ```js
   1041:   const next = { chatProvider, chatModel, genProvider, genModel, genRatio, genResolution, updatedAt: Date.now() };
   1051:   localStorage.setItem(AGENT_MODEL_DEFAULTS_KEY, JSON.stringify(next));
   ```
2. 「设为默认」按钮触发：`canvas-agent.js` L9667-9672
   ```js
   9667: document.getElementById('agentSaveModelDefaultsBtn')?.addEventListener('click', () => {
   9669:   const saved = agentRememberCurrentModelsAsDefaults();  // 内部调 agentSaveModelDefaults
   ```
   `agentRememberCurrentModelsAsDefaults`（L1086-1113）以界面当前选择为准，平台+模型原样保存。
3. 读取 + 应用：`agentLoadModelDefaults`（L1029-1038 读 `localStorage`）→ `agentApplyModelDefaults`（L1114+，L1129-1161 按「平台优先、模型反查兜底」回写 `agentState`）在 `loadAgentState` 时套用（L1249 `agentApplyModelDefaults(true)`），供应商就绪后再套一次（L3450-3458 `agentRestoreDefaultModelsWhenProvidersReady`）。
4. 关键：L1248 注释「仅在加载状态时套用，会话中手动改模型不会被回退」——持久化的是「默认」，不污染当前会话。

## 我们现状（代码证据 + 自审补强）
我们的 `genParams` 是**纯模块级内存变量**，无持久化，刷新即丢：
`useCanvasAgentTools.js` L25-31
```js
25: let genParams = { model: '', ratio: 'Auto', resolution: '1K' }
26: export function setGenParams(patch = {}) {
27:   genParams = { ...genParams, ...patch }
28: }
29: export function getGenParams() {
30:   return genParams
31: }
```
- `setGenParams` 只做内存合并（L27），不调 `sGet`/`sSet`。（已检索确认：`useCanvasAgentTools.js` 全文**无** `sGet`/`sSet`/`storageAdapter` 引用，0 命中。）
- 刷新页面后 `genParams` 回到 L25 初始值 `{ model:'', ratio:'Auto', resolution:'1K' }`。

**基础设施已存在（自审关键证据）**：持久化基座 `storageAdapter.js` 的 `sGet`/`sSet`（L46-63）同步写 `localStorage`/chrome.storage；且同目录的 `nodePrefs.js` L35 已 `import { sGet, sSet } from './storageAdapter.js'` 并用于 `yimao_node_prefs`（`nodePrefs.js` L37）。证明：① `storageAdapter` 在 `base/` 目录内可直接 import；② 项目已有「节点参数跨会话持久化」先例，genParams 接它完全一致、无新增依赖。

结论：我们 `genParams` 仅模块级内存，刷新丢，且**没有**「设为默认」式显式持久化平台+模型的能力（参考图 `currentRefImages` L40-46 同理为内存变量）。

## 追平落点（可执行）
- 文件：`src/components/base/useCanvasAgentTools.js`（改 `setGenParams`/`getGenParams`）+ 复用已存在的 `storageAdapter.js` 的 `sGet`/`sSet`（无需新建/改）。
- 位置：`useCanvasAgentTools.js` L25-31。
- 做法（对齐大雄「持久化默认、不污染当前会话」思路；与 `nodePrefs.js` 风格一致）：
  ```js
  import { sGet, sSet } from './storageAdapter.js'   // 与 nodePrefs.js L35 同源
  const GEN_PARAMS_KEY = 'canvasAgentGenParams'
  const loadGenParams = () => {
    try { const r = sGet(GEN_PARAMS_KEY); return r ? JSON.parse(r) : null } catch { return null }
  }
  let genParams = loadGenParams() || { model: '', ratio: 'Auto', resolution: '1K' }
  export function setGenParams(patch = {}) {
    genParams = { ...genParams, ...patch }
    try { sSet(GEN_PARAMS_KEY, JSON.stringify(genParams)) } catch {}
  }
  export function getGenParams() { return genParams }
  ```
  （注：当前 `useCanvasAgentTools.js` 顶部已 import 其它 `base/` 模块如 `./taskStore.js`、`./conversationStore.js`，补 `./storageAdapter.js` 同目录可直接解析。）

---

# 四、结论（三项分别改哪些文件哪些行）

| 项 | 改的文件 | 精确落点 | 对齐大雄参考 |
|----|----------|----------|--------------|
| 1. 模型二次锁定 | `src/components/base/canvasPlanExecutor.js` | `createGenNode` 建节点后（L105 后）+ `runNode` 写回 `imageUrl` 处（L131-134）补 `setNodes` 合并 `selectedModel/aspectRatio/imageSize/quality`；并修正 L90/L98 在 `finalModel` 为空时仍写入全局默认而非省略字段 | 大雄 `lockAgentNodeSettings` 在 L152-153 / L165-167 / L248 / L255 四处回写；我们风险点见 `PromptNode.jsx` L50 / L134-141 |
| 2. 参考图节点去重 | `src/components/base/canvasPlanExecutor.js` | `executePlan` 建节点前（L86 `createGenNode` 前）新增 `refNodeCache` Map + `findExistingImageNodeId(url)` 扫描；`createGenNode` 内（L101-103）命中则复用、未命中才写 `data.images` 并 `cache.set` | 大雄 `agentFindExistingImageNodeIdByUrl` L10363-10381 + `sharedRefNodeCache` L10604-10609 + 复用 L10398-10429 |
| 3. genParams 持久化 | `src/components/base/useCanvasAgentTools.js`（+ 复用 `storageAdapter.js` 的 `sGet`/`sSet`，同 `nodePrefs.js` L35） | 替换 L25-31 的 `genParams`/`setGenParams`/`getGenParams`，接入 `sSet` 落盘 + 惰性 `sGet` 加载 | 大雄 `agentSaveModelDefaults` L1039-1057 + `agentLoadModelDefaults` L1029-1038 + 按钮 L9667 |

---

## 验收自查（按验收标准）
1. ✅ 三项均给大雄代码证据（含真实行号）+ 我们现状（含真实行号）+ 精确落点（文件+行号）。
2. ✅ 参考图去重已确认：我们当前**没有**画布内 URL 复用去重（`canvasPlanExecutor.js` 无 `findExistingImageNodeId`/`refNodeCache`，L101-103 每步独立写 `data.images`，且 `PromptNode.jsx` L226 确认 `data.images` 为参考图入口），证据见第二节「我们现状」。
3. ✅ 自审补强：补充 `PromptNode.jsx`（L50/L134-141 回落风险）、`useSyncNodeData.js`（L19-36 data→state 同步机制）、`nodePrefs.js`（L35 已用 `storageAdapter`，证明持久化基座可用），使三项结论更扎实可靠。

> 注：本文件为唯一产出，未改动任何 `src/` 代码，未新建/改写其他文件。
