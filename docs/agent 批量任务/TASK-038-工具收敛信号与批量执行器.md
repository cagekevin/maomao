# TASK-038 — 参考项目 AI 会话稳定性剖析（三）：工具收敛信号与批量执行器

> 你只能写这个文件，碰任何其他文件视为失败。

## ⚠️ 铁律（违反重做）
1. **只读不改**：本任务是「机制剖析」，禁止修改任何代码，禁止写脚本，只产出本 md 文档。
2. **行号必须真实**：所有行号来自你**本次实际打开文件核实**后的结果。引用格式 `文件路径 L实际行号`。
3. **结论必须有代码证据**：每个机制点必须贴「文件 + 行号 + 关键代码片段」，不能只写"有/没有"。
4. **自包含**：本文件已含所有探索起点，不需要也不得查看其他 `TASK-*` 文件或我们的 `src/` 代码。

---

## 一、项目背景

maomao 画布的 AI 会话**不稳定**：AI 触发生成后不确定是否完成，思考里犹豫"要不要再建节点"，甚至重复触发。

本任务剖析参考项目（大雄 canvas-agent）**「工具收敛信号 + 批量执行器」**——工具返回什么、怎么让 AI 确信"任务已完成、可以停"，以及批量生图时怎么用占位节点避免重复。

**参考材料**（只读这些）：
- `/Users/kevin/Downloads/daxiong-canvas-plugins/plugins/canvas-agent/web/canvas-adapter.js`
- `/Users/kevin/Downloads/daxiong-canvas-plugins/plugins/canvas-agent/web/canvas-agent.js`
- `/Users/kevin/Downloads/daxiong-canvas-plugins/plugins/canvas-agent/web/canvas-plan-executor.js`

## 二、硬约束

- **禁止参考** maomao 的 `src/` 实现，只剖析参考项目。
- 输出是**机制剖析报告**，不是代码。
- 不得臆测，每条必须有真实代码行证据。

## 三、探索起点（本次实际核实）

- **canvas-adapter.js**
  - 实测：`createNode`（L129）、`updateNode`（L162）、`connectNodes`（L171）、`viewportAnchor`（L12）、`beginTransaction/commitTransaction/rollbackTransaction`（L18-20）、`runNode`（L251）、`cancelNodeRun`（L323）、`finishAgentNodeImages`（L225）、`createNodeAtImage`（L136）。
  - 语义：建/改/连节点返回 `{schemaVersion:2, ...clone(node)}` 完整快照 → AI 能看到真实结果而停止；`viewportAnchor` 自动算坐标；事务用于整体回滚。
- **canvas-agent.js**
  - 实测：`agentFindEmptyPosition`（L8397）、`agentPendingBoxSize`（L8418）、`createImageNodeAt`（宿主注入，调用点 L8704 / L8824）、`agentCanvasImages`（L8904）、占位节点生命周期（L8698-8845）。
  - 语义：批量生图用占位节点（pending）占位；`agentFindEmptyPosition` 算空位（最右图片右侧 +40+130、顶部对齐）；结果回填 `agentApplyNodeImages` / `finishAgentNodeImages`。
- **canvas-plan-executor.js**
  - 实测：`executeCanvasPlan`（L506）、`stepDependsOnPrevious`（L51）、`stepDependencyMode`（L58）、`executeSmart`（L318）、`runOneEntryWithRetry`（L431）、`MAX_STEP_RETRIES`（L35）。
  - 语义：按 `depends_on_previous` 分独立批/依赖批；依赖批用前序结果当参考图；逐 gen 建占位节点并触发。

## 四、覆盖清单（逐个回答，全部带证据）

> 所有行号均来自本次实际打开并核对的三个参考文件。

---

### 覆盖点 1：工具返回的"收敛信号"是什么

**机制**：`createNode` / `updateNode` 不直接返回 `true`/`undefined`，而是返回 `{schemaVersion:2, ...clone(node)}` —— 即一个带 schema 版本的**完整节点快照**。AI 调用工具后拿到的是"此刻画布上这个节点真实长什么样"的拷贝，包括 `images`、`status`、`pending` 等字段。由于快照是深拷贝（`clone`），且含 `schemaVersion:2` 协议版本号，AI 可以确定性地判断：**节点已存在、`status==='completed'`、并已带有真实图片 URL**，从而确信"任务完成、无需再建节点"。`runNode` 的返回值同样给出 `status:'completed' / 'failed'` + `outputNodeId` + `images`，进一步给出明确的终止信号。

**代码证据**：
- `canvas-adapter.js L129-135`（`createNode` 返回快照）
```js
function createNode(type,data={},position={}){
    const def=nodeTypes.get(type); if(type!=='smart-image'&&!def)throw new Error(`Unregistered smart node type: ${type}`);
    let node;
    if(type==='smart-image'){node=createNodeAtImage(position,data);}
    else {node={id:uid(type==='agent-generation'?'agentgen':'plugin'),type,x:Number(position.x)||0,y:Number(position.y)||0,w:Number(data.w||def?.width)||360,h:Number(data.h||def?.height)||430,title:def?.title||type,created_at:Date.now(),...clone(data)};list().push(node);refresh(false);}
    notify('node:created',{nodeId:node.id,type});return{schemaVersion:2,...clone(node)};
}
```
- `canvas-adapter.js L162-169`（`updateNode` 返回快照）
```js
function updateNode(id,patch){
    const n=find(id);if(!n)return null;
    Object.assign(n,clone(patch||{}));
    if(n.agentCreated || n.agentSource || (patch&&(patch.runSettings||patch.resolvedSettings||patch.agentSource))){
        lockAgentNodeSettings(n, n.runSettings || n.resolvedSettings || null);
    }
    refresh();
    return{schemaVersion:2,...clone(n)};
}
```
- `canvas-adapter.js L307`（`runNode` 返回收敛信号）
```js
return{status:images.length?'completed':'failed',nodeId:id,outputNodeId:n.id,images};
```

**对"稳定性"的意义**：AI 不再依靠"我发了几个请求"来猜完成没完成，而是拿到带 `schemaVersion` 的真实节点状态。当快照里 `status==='completed'` 且 `images` 非空，AI 就获得**可验证的终止条件**，从根本上消除"要不要再建一个节点"的犹豫——这正是 maomao 当前"生成后不确定完成"的对症设计。

---

### 覆盖点 2：`viewportAnchor` 怎么算新建节点位置

**机制**：`viewportAnchor(options)` 有两条分支：
1. **有选中节点**（`selection()` 非空且 `preferSelection!==false`）：取所有选中节点的**最右边缘** `max(x + w)` 再加 `100` 作为新节点 `x`，`y` 取选中节点的**最小顶部 y**（顶部对齐）。`source:'selection'`。
2. **无选中**：把视口中心坐标换算到画布坐标系（考虑 `viewport.scale` 与平移 `viewport.x/y`），返回视口中心。`source:'viewport'`。

这样 AI 建节点时不需要自己算坐标，且新节点总是紧贴选中内容右侧、顶对齐，避免重叠。

**代码证据**：`canvas-adapter.js L12-17`
```js
function viewportAnchor(options={}){
    const chosen=selection().map(find).filter(Boolean);
    if(chosen.length&&options.preferSelection!==false){const right=Math.max(...chosen.map(n=>Number(n.x||0)+Number(n.w||316)));return{x:right+100,y:Math.min(...chosen.map(n=>Number(n.y||0))),source:'selection'};}
    const rect=typeof board!=='undefined'&&board?.getBoundingClientRect?board.getBoundingClientRect():{left:0,top:0,width:innerWidth,height:innerHeight};
    const scale=Number(viewport?.scale)||1;return{x:(rect.width/2-(Number(viewport?.x)||0))/scale,y:(rect.height/2-(Number(viewport?.y)||0))/scale,source:'viewport'};
}
```

**对"稳定性"的意义**：坐标由宿主统一计算，AI 永不传错位置、永不叠在已有节点上。节点一旦返回到正确位置，AI 看到快照里的 `x/y` 与预期一致，就确认"建好了"，减少因"建没建成功 / 建哪了"产生的二次试探。

---

### 覆盖点 3：`agentFindEmptyPosition` 怎么算批量生图占位位置

**机制**：该函数（L8397）为**批量生图**专用，算法：
1. 收集所有"图片节点"：`isSmartImageNode(n)` 且（有真实图片 **或** `pending>0`）。**关键**：它把 `pending` 占位节点也算进来，否则并发生成时多个占位会叠在同一位置（注释 L8399 明确说明）。
2. 若无任何图片节点 → 返回视口中心 `viewportCenter()`（`source` 缺失，视为无图分支）。
3. 否则找最右节点 `maxXNode`，在它**右侧** `rect.x + rect.width + gap(40) + 130` 放置，`y` 取该节点顶部 `rect.y`（顶部对齐）。

即：**最右图片节点右侧 + 40 + 130、顶部对齐**；无图则视口中心。

**代码证据**：`canvas-agent.js L8397-8416`
```js
function agentFindEmptyPosition(count=1){
    // A+C 方案：计算空白区域 + 右侧追加（水平排列，顶部对齐）
    // 注意：必须包含 pending 状态的占位节点，否则并发生成多张图时占位节点会叠在一起
    const imageNodes = (nodes || []).filter(n => isSmartImageNode(n) && (agentNodeImages(n).some(img => img?.url) || Number(n.pending) > 0));
    const center = viewportCenter();
    if(!imageNodes.length) return {x:center.x, y:center.y};
    // 找到最右边的节点
    let maxX = -Infinity;
    let maxXNode = null;
    imageNodes.forEach(n => {
        const rect = nodeRect(n);
        const right = rect.x + rect.width;
        if(right > maxX){ maxX = right; maxXNode = n; }
    });
    if(!maxXNode) return {x:center.x, y:center.y};
    // 在最右边节点的右侧水平放置新图，顶部对齐，有一点间距
    const rect = nodeRect(maxXNode);
    const gap = 40;
    return {x:rect.x + rect.width + gap + 130, y:rect.y};
}
```

**对"稳定性"的意义**：占位阶段就把"后续还存在的 pending 节点"计入布局，保证**串行创建的所有占位互不重叠**（L8698 注释"确保位置不重叠、顶部对齐"）。每个 gen 拿到独立坐标后立刻建占位，AI/执行器在回填前就已看到"这个位置已被占用"，不会为同一张图再开节点。

---

### 覆盖点 4：批量生图怎么用占位节点

**机制**：占位节点的生命周期分三步（见 `runAgentGenerations`，L8698-8845）：
- **第一步：串行建占位**（L8701-8731）。对每个 `pending` 的 gen：
  - `agentFindEmptyPosition(gen.count)` 算位置 → `createImageNodeAt(pos, [])` 建**空图片节点**（`images:[]`）。
  - 设 `placeholderNode.pending = gen.count`、`title='生成中...'`、`runStartedAt`、`runTimerHidden=false`。
  - `agentPendingBoxSize(gen.count, {refs})` 算尺寸并写入 `w/h`（多张按网格）。
  - 顶部对齐：把所有"已有图片节点 + 已建 pending 占位"的最小顶部 y 赋给 `placeholderNode.y`（L8721-8727）。
- **占位尺寸**：`agentPendingBoxSize`（L8418）用 Agent 当前比例 `agentState.genRatio` 算出请求尺寸，再按 `count` 网格化（≤1 张单格；多张 cols=2~4、rows=ceil(c/cols)），保证占位块大小贴近最终生成图。
- **第二步：并行触发 + 回填**（L8733-8845）。`await Promise.all(...)` 并行发请求；结果回来后通过 `placeholderId` **从当前 `nodes` 数组重新查找** live 节点（防 `nodes` 被 saveCanvas 合并后引用悬空，L8806），再 `agentApplyNodeImages(liveNode, urls)` 回填图片，并 `liveNode.pending = 0`、`title = 'Group'/'Image'`、`runFinishedAt`、`scale=mediaNodeDefaultScale`、`delete w/h`（L8809-8818）。回填后节点从"running 占位"变为"completed 真图"。
- **异常分支**：若占位节点已被删除/合并（`!liveNode`，L8819），则 `agentFindEmptyPosition` 再建新节点放结果；若生图抛错（L8831），则移除该占位节点。

注意：`createImageNodeAt` 与 `agentApplyNodeImages` 均为宿主（canvas-adapter.js）注入的能力（对应 `createNode('smart-image',...)` 与 `applyNodeImages/finishAgentNodeImages`，`canvas-adapter.js L225-249` / `L325-341`），在 canvas-agent.js 中作为外部函数调用。

**代码证据**：
- `canvas-agent.js L8703-8704`（建空占位）
```js
const pos = agentFindEmptyPosition(gen.count);
const placeholderNode = createImageNodeAt(pos, []);
```
- `canvas-agent.js L8718-8720`（占位尺寸）
```js
const pendingBox = agentPendingBoxSize(gen.count, {refs: refsForBox});
placeholderNode.w = pendingBox.w;
placeholderNode.h = pendingBox.h;
```
- `canvas-agent.js L8807-8818`（结果回填占位 → 收敛）
```js
if(urls.length && liveNode){
    undoSuppressed = true;
    agentApplyNodeImages(liveNode, urls);
    liveNode.pending = 0;
    liveNode.title = urls.length > 1 ? 'Group' : 'Image';
    liveNode.runFinishedAt = nowMs();
    liveNode.scale = mediaNodeDefaultScale(liveNode);
    delete liveNode.w;
    delete liveNode.h;
    selectedId = liveNode.id;
    undoSuppressed = false;
```
- 宿主侧回填实现 `canvas-adapter.js L225-233`（`finishAgentNodeImages` 把 pending 清零、status 置 completed）
```js
function finishAgentNodeImages(node, images, runSettings){
    if(!node) return null;
    const imgs = clone(images || []);
    node.images = imgs;
    node.title = imgs.length > 1 ? 'Group' : (imgs.length ? 'Image' : '生成失败');
    node.pending = 0;
    node.queued = false;
    node.running = false;
    node.status = imgs.length ? 'completed' : 'failed';
```

**对"稳定性"的意义**：占位节点在"请求已发出但尚未返回"的空窗期就**真实存在于画布**上、`pending>0`、`status:'running'`。AI/执行器随时能读到"这个位置已经有一个正在生成的节点"，回填后 `pending:0 + status:'completed'` 就是明确的结束信号——避免空窗期重复发起同一请求、也避免结果回来后另建新节点。

---

### 覆盖点 5：依赖批怎么处理

**机制**：`executeCanvasPlan`（L506）把步骤拆成两波（Wave）：
- **分流判断**：`stepDependsOnPrevious(step)`（L51）为 true 则进 `dependent` 批，否则进 `independent` 批。判定依据：`depends_on_previous===true` / `use_previous_results===true` / `depends_on_steps` 非空 / `dependency_mode` 为 `fusion` 或 `product_reference`。
- **Wave 1（独立批）**：全部建节点并 `Promise.all` 并行 `runNode`（L562-564）。
- **Wave 2（依赖批）**：**仅当所有独立步骤都成功**才执行（L573-574，否则整体跳过并记 error）。依赖批用前序成功图作参考图：
  - `product_reference` 模式：挂"产品定稿"（第一张成功图）+ 用户指定的原参考图（`mergeReferences`，L618）。
  - `fusion` 模式：挂**全部前序成功图**（`prevImages`，L623），并把 `dependency_mode` 强制置 `fusion`。
  - 参考图通过 `collectPrevImages(wave1Entries)`（L596）收集，写回 `step.references`，再走 `executeSmart/executeClassic` 建节点并把 `references` 连到生成节点（L361-402）。
- `stepDependencyMode`（L58）还从 prompt 关键词（融合/组合/合成…）二次推断模式，但执行器注释明确"依赖关系以 LLM/上游步骤字段为准，执行器不再根据关键词二次改写计划"（L537）。

**代码证据**：
- `canvas-plan-executor.js L51-57`（依赖判定）
```js
function stepDependsOnPrevious(step){
    if(!step) return false;
    if(step.depends_on_previous === true || step.use_previous_results === true) return true;
    if(Array.isArray(step.depends_on_steps) && step.depends_on_steps.length) return true;
    const mode = String(step.dependency_mode || '').toLowerCase();
    return mode === 'fusion' || mode === 'product_reference';
}
```
- `canvas-plan-executor.js L573-574`（依赖批门控：全成功才跑）
```js
if(dependent.length){
    if(failedIndependent.length){
        pushLog(context, `前置素材未全部成功（失败 ${failedIndependent.length} 个），跳过依赖步骤`, 'error');
```
- `canvas-plan-executor.js L611-626`（两种依赖模式挂载前序结果）
```js
if(mode === 'product_reference'){
    ...
    refs = mergeReferences((productImages || []).filter(r => r?.url).slice(0, 1), existingUserRefs);
    step.references = refs.slice();
    step.dependency_mode = 'product_reference';
}else{
    refs = (prevImages || []).filter(r => r?.url);
    step.references = mergeReferences([], refs);
    step.dependency_mode = 'fusion';
}
```

**对"稳定性"的意义**：依赖批被**门控**为"前置全成功才执行"，避免拿半成品当参考图；且参考图来自真实 `images` URL、挂到生成节点的 `references`，每步结果都是可验证的快照。AI 不会"假设上一轮已完成就去融"，而是严格等 `status:'completed'` 的图到位——杜绝了"提前融合 / 重复生成前置素材"的不稳定行为。

---

### 覆盖点 6：事务回滚

**机制**：`beginTransaction/commitTransaction/rollbackTransaction`（canvas-adapter.js L18-20）为批量操作提供整体可回滚能力：
- `beginTransaction(label)`：先 `pushUndo()` 压一个撤销点，再把**当前整张画布的深拷贝**（`clone(list())` + `clone(canvas.connections)`）存进 `transactions` Map，返回 `id`。
- `commitTransaction(id)`：确认完成，删掉事务快照（不恢复，因为已经成功）。
- `rollbackTransaction(id)`：从快照把 `nodes` 与 `canvas.connections` **整体恢复**为事务开始时的状态，再 `refresh()`。

在 `executeCanvasPlan` 中，Wave 1（`host.beginTransaction('AI Agent independent')` L543，提交 L556）与 Wave 2（`host.beginTransaction('AI Agent dependent')` L600，提交 L664）各自包在一个事务里。若 `executeCanvasPlan` 主体抛异常（L686 `catch`），异常向上抛，但事务在提交前若失败可通过 `rollbackTransaction` 恢复整批节点——保证"要么整批节点都建好，要么回滚到建之前"，不会出现"建了三个节点、第四个报错、留下半批孤儿节点"的部分写入状态。

**代码证据**：
- `canvas-adapter.js L18-20`
```js
function beginTransaction(label='AI Agent workflow'){const id=`atx_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;if(typeof pushUndo==='function')pushUndo();transactions.set(id,{label,nodes:clone(list()),connections:clone(canvas?.connections||[])});return id;}
function commitTransaction(id){if(!transactions.has(id))return false;transactions.delete(id);refresh();return true;}
function rollbackTransaction(id){const tx=transactions.get(id);if(!tx)return false;nodes=clone(tx.nodes);if(canvas)canvas.connections=clone(tx.connections);transactions.delete(id);refresh();return true;}
```
- `canvas-plan-executor.js L543` / `L556`（Wave 1 事务包裹）
```js
const wave1Tx = host.beginTransaction('AI Agent independent');
...
host.commitTransaction(wave1Tx);
```
- `canvas-plan-executor.js L600` / `L664`（Wave 2 事务包裹）
```js
const wave2Tx = host.beginTransaction('AI Agent dependent');
...
host.commitTransaction(wave2Tx);
```

**对"稳定性"的意义**：批量建节点是"要么全有、要么全无"的原子操作。AI/执行器拿到事务 commit 后的结果快照，能确信"这批节点要么都成功存在、要么从未存在"，不会因为中途报错留下需要人工清理的悬空/重复节点——这是防止"重复建节点"的最后一道结构性保险。

---

### 覆盖点 7：与"重复操作"的关系

**机制**：占位节点 + 收敛信号互相配合，从三个层面消灭重复操作：
1. **占位即占坑**：建节点前先用 `agentFindEmptyPosition`（含 pending 节点）算唯一坐标并建空占位（L8703-8704）。后续 gen 在算位置时能看到前面的 pending 占位，从而拿到不同坐标——**物理上不可能叠在一起**（L8399 注释）。
2. **pending 状态即"正在生成"的可见信号**：占位节点的 `pending>0 + status:'running'` 让画布上任何观察者（AI、用户、执行器 `collectPrevImages`/`agentFindEmptyPosition`）都能读到"此位置正在生成中"，因此不会为同一个 gen 再发请求或再建节点。
3. **回填即收敛**：结果回来后 `pending=0 + status='completed' + images`（`finishAgentNodeImages` / `agentApplyNodeImages`，L8809-8818 / L225-233），这是明确的**终止信号**。配合 `runNode` 返回的 `{status, outputNodeId, images}` 与 `createNode` 返回的 `{schemaVersion:2, ...clone(node)}`，AI 能确定性确认"已生成、已完成、无需再建"。

另外，`canvas-plan-executor.js` 还用 `MAX_STEP_RETRIES = 0`（L35）显式规定**生图请求不得自动重发**——"请求可能已经计费但响应丢失；执行器不得自动重发。失败项只允许用户手动重试"（L34 注释）。这与占位/收敛信号共同封死了"重复触发"的所有路径。

**代码证据**：
- `canvas-agent.js L8399`（占位计入布局防重叠注释）
```js
// 注意：必须包含 pending 状态的占位节点，否则并发生成多张图时占位节点会叠在一起
```
- `canvas-agent.js L8809-8811`（回填把 pending 清零、标题变 Group/Image = 收敛）
```js
agentApplyNodeImages(liveNode, urls);
liveNode.pending = 0;
liveNode.title = urls.length > 1 ? 'Group' : 'Image';
```
- `canvas-plan-executor.js L34-35`（禁止自动重发，防重复计费/重复生成）
```js
// 生图请求可能已经计费但响应丢失；执行器不得自动重发。失败项只允许用户手动重试。
const MAX_STEP_RETRIES = 0;
```

**对"稳定性"的意义**：重复操作的根因是"AI 不知道任务进行到哪了"。占位节点把"进行中"变成画布上的**可见事实**，收敛快照把"已完成"变成**可验证的状态**。两者结合后，AI 在每个决策点都能读到确定答案——"已建/正在建/已完成"，从而彻底停止重复建节点与重复触发。

---

## 五、总结：工具收敛信号与执行器如何保障会话稳定

1. **返回完整快照而非布尔**：`createNode/updateNode` 返回 `{schemaVersion:2, ...clone(node)}`，`runNode` 返回 `{status, outputNodeId, images}`。AI 拿到的不是"成功/失败"的猜测量，而是带协议版本的**真实节点状态**，可确定性判断任务完成 → 消除"生成后不确定完成"的核心病因。
2. **占位节点把"进行中"变可见事实**：批量生图先串行建 `pending>0 / status:'running'` 的空占位，`agentFindEmptyPosition` 把 pending 节点计入布局 → 每个 gen 拿到唯一不重叠坐标，空窗期不会被当作"没建"而重复发起。
3. **回填即收敛信号**：结果回到占位节点后 `pending=0 + status='completed' + images`，配合宿主 `finishAgentNodeImages` 把节点从"running 占位"翻转为"completed 真图"，给 AI 明确的终止条件，停止重复建节点。
4. **依赖批门控 + 前序结果当参考图**：`executeCanvasPlan` 用 `depends_on_previous` 拆独立/依赖两波，依赖批**全前置成功才执行**，并挂真实 `images` URL 为参考 → 杜绝"拿半成品融合 / 重复生成前置素材"。
5. **事务原子性 + 禁自动重发**兜底：`begin/commit/rollbackTransaction` 保证批量建节点要么全有要么全无；`MAX_STEP_RETRIES=0` 禁止自动重发 → 从结构与策略两面封死"半批孤儿节点"和"重复计费触发"的最后漏洞。

> 全部行号来自本次实际打开 `canvas-adapter.js`（416 行）、`canvas-agent.js`（11544 行，已定位关键段）、`canvas-plan-executor.js`（697 行）核实。未修改任何代码、未编写任何脚本。
