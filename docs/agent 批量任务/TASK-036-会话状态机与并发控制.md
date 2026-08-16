# TASK-036 — 参考项目 AI 会话稳定性剖析（一）：工作流状态机与并发控制

> 你只能写这个文件，碰任何其他文件视为失败。

## ⚠️ 铁律（违反重做）
1. **只读不改**：本任务是「机制剖析」，禁止修改任何代码，禁止写脚本，只产出本 md 文档。
2. **行号必须真实**：所有行号来自你**本次实际打开文件核实**后的结果。引用格式 `文件路径 L实际行号`。
3. **结论必须有代码证据**：每个机制点必须贴「文件 + 行号 + 关键代码片段」，不能只写"有/没有"。
4. **自包含**：本文件已含所有探索起点，不需要也不得查看其他 `TASK-*` 文件或我们的 `src/` 代码。

---

## 一、项目背景

maomao 画布的 AI 会话**不稳定**，具体表现为：
1. 一次回复里 AI 重复创建节点 / 重复触发生成；
2. 工具都执行完了 AI 还在"自言自语"（思考里继续推演下一步）；
3. 发送锁卡死 / 并发双发。

本任务剖析参考项目（大雄 canvas-agent）**「会话工作流状态机 + 并发控制」**是怎么设计的——这是判断"能不能发"、防止重复/并发/卡死的第一道闸。

**参考材料**（只读这些）：
- `/Users/kevin/Downloads/daxiong-canvas-plugins/plugins/canvas-agent/web/input-state-machine.js`
- `/Users/kevin/Downloads/daxiong-canvas-plugins/plugins/canvas-agent/web/canvas-agent.js`

## 二、硬约束

- **禁止参考** maomao 的 `src/` 实现，只剖析参考项目，不要对比"我们有没有"。
- 输出是**机制剖析报告**，不是代码。
- 不得臆测，每个机制必须有真实代码行证据。

## 三、探索起点（本次实际核实）

- **input-state-machine.js**（整个文件，19 行）
  - grep：`RUNNING`、`isRunning`、`action()`、`setStatus`、`start`、`consume`、`submitLocked`
  - 语义：状态集 `planning/creating_nodes/ready/running/stopping`；`action()` 推导 send/stop/steer/retry/idle；`setStatus('completed'/'stopped')→idle` 的收敛。
- **canvas-agent.js**
  - grep：`agentSending`、`agentActiveWorkflow`、`agentStopRequested`、`steerQueue`、`agentIsTaskBusy`、`__canvasAgentGenRunning`
  - 语义：`agentSending` 发送锁；`agentActiveWorkflow.status` 状态流转；steer 队列（任务中再发 → 排队不打断）；`agentIsTaskBusy()` 判断真忙。
  - 关键行：L5128（workflow 创建 `status:'planning'`）、L3966-3972（发送/停止按钮 action 推导）、L4479（`agentSending` 从 workflow.status 推导）、L5126-5130（thinking 态）、L6364-6370（`awaiting_confirm` 态）、L8002-8008（`agentIsTaskBusy` 真忙判定）、L7983（stopping→stopped 复位）。

## 四、覆盖清单（逐个回答，全部带证据）

### 覆盖点 1：状态机有哪些状态
**机制**：状态机定义了两类"运行态"集合。`input-state-machine.js` 用 `RUNNING` Set 显式列出"正忙"状态；canvas-agent.js 的运行时代码几乎在每一处忙闲判定中都复用了同一组状态字符串。除运行态外，状态机还有 `idle / stopping / stopped / completed / failed / awaiting_confirm / incomplete` 等收敛态/终态。

**代码证据**：`input-state-machine.js L3` + 完整状态机声明
```js
3:    const RUNNING=new Set(['planning','creating_nodes','ready','running']);
5:    constructor(options={}){this.options=options;this.conversationId='';this.state={status:'idle',draft:'',attachments:[],workflow:null,submitLocked:false};}
```
canvas-agent.js 在多处共用同一组运行态字符串，佐证这是事实上的状态枚举（L8004、`L3968`、`L4479`、`L5159`、`L7983` 等）：
```js
8004:    const wfBusy = ['planning','creating_nodes','ready','running','stopping'].includes(wfStatus);
```
**对"稳定性"的意义**：用单一权威集合定义"什么叫忙"，所有并发拦截都引用同一枚举，避免"某处认为忙、另一处认为闲"的不一致——这是防并发双发的根基。

---

### 覆盖点 2：发送锁怎么防并发双发
**机制**：`agentSending` 是全局布尔发送锁。它在以下时机置 `true`：发起一轮新任务（L5125、L5210、L8161、L8226、L8253）、重试生成（L5209）、恢复后台任务（L1365）。在以下时机置 `false`：任务收尾且 `stillBusy` 为 false（L6365 / L7038-7043 / L7744 / L8358）、停止成功（L7983）、重试失败收尾（L5237）。提交前用 `agentIsTaskBusy()` 统一拦截（L8173），且额外加 `reallyBusy` 双重校验（L5157-5163）兜底"锁卡死但实际无任务"的异常。

**代码证据**：置锁（L5124-5127）与释放（L6361-6365）
```js
5124:    agentStopRequested = false;
5125:    agentSending = true;
5126:    agentThinking = true;
5127:    agentThinkingConversationId = conversationId;
6361:    if(agentIsActiveConversation(cid)){
6362:        agentThinking = false;
6363:        agentThinkingStage = '';
6364:        agentThinkingConversationId = '';
6365:        agentSending = false;
```
提交前拦截（L5157-5163，安全重试路径）：
```js
5157:    // 若发送锁卡死但实际没有任务，允许重试（安全拦截失败后常见）
5158:    const reallyBusy = !!(window.__canvasAgentGenRunning)
5159:        || ['planning','creating_nodes','ready','running','stopping'].includes(String(agentActiveWorkflow?.status || '').toLowerCase());
5160:    if(agentSending && reallyBusy){
5161:        if(typeof toast === 'function') toast('当前有任务在执行，请稍后再试');
5162:        return;
5163:    }
```
`agentIsTaskBusy()`（L8002-8008）判断"真忙"——除了锁本身，还看 workflow 状态、全局生成锁 `__canvasAgentGenRunning`、以及本对话是否仍有 running/waiting 的生成：
```js
8002:function agentIsTaskBusy(){
8003:    const wfStatus = String(agentActiveWorkflow?.status || '').toLowerCase();
8004:    const wfBusy = ['planning','creating_nodes','ready','running','stopping'].includes(wfStatus);
8005:    const genBusy = !!(typeof window !== 'undefined' && window.__canvasAgentGenRunning)
8006:        || agentConversationHasRunningGens(agentState?.activeConversationId || agentActiveWorkflow?.conversationId || '');
8007:    return !!(agentSending || agentThinking || wfBusy || genBusy);
8008:}
```
**对"稳定性"的意义**：`agentSending` 置 true 期间任何 `sendAgentMessage` 都会被 L8173 拦截，从源头杜绝"用户狂点发送导致双发"。且释放锁前有 `stillBusy` 复合判定（L8355-8358），确保"规划与生成都真正结束"才解锁，避免提前解锁造成的半并发。

---

### 覆盖点 3：任务中再发消息（steer）怎么处理
**机制**：任务进行中（真忙）若用户再编辑输入框并回车/发送，不会打断当前任务，而是进入 `steerQueue` 排队。入队由 `queueAgentSteer()` 完成（L7834-7864），把消息构造成一条 `type:'steer'` 记录 push 进 `agentActiveWorkflow.steerQueue` 并标记"已排队"；出队在对话切换/加载完成后的微任务里（L1285-1293）`shift` 并执行——但前提是 `!agentSending`（当前任务已不再忙）。注意 L11130-11133 明确：**任务进行中禁止自动吞队列发送，结束后直接清空 steerQueue**，即 steer 仅作为"已收到、已告知用户"的占位，不真正插队执行，彻底避免打断。

**代码证据**：入队（L7856-7863）
```js
7856:    if(!agentActiveWorkflow) agentActiveWorkflow={id:uid('awf'),status:'running',nodeIds:[],steerQueue:[],createdAt:Date.now(),updatedAt:Date.now()};
7857:    if(!Array.isArray(agentActiveWorkflow.steerQueue))agentActiveWorkflow.steerQueue=[];
7858:    const steer={id:uid('steer'),type:'steer',conversation_id:agentState.activeConversationId,workflow_id:agentActiveWorkflow.id,text,attachments,parts,created_at:Date.now(),status:'queued'};
7859:    agentActiveWorkflow.steerQueue.push(steer);agentActiveWorkflow.updatedAt=Date.now();
7860:    agentState.messages.push({id:steer.id,role:'user',type:'steer',text,images:attachments,parts,statusLabel:'已排队',ts:steer.created_at});
...
7863:    toast('新要求已排队，将在当前步骤完成后执行');
```
出队（L1285-1293，仅当 `!agentSending`）
```js
1285:        queueMicrotask(() => {
1286:            const queued=!agentSending&&Array.isArray(agentActiveWorkflow?.steerQueue)?agentActiveWorkflow.steerQueue.shift():null;
1287:            if(queued){
1288:                if(agentInput) agentSetInputValue(String(queued?.text || activeConv.draft || ''));
1289:                if(queued?.attachments?.length) agentState.attachments=queued.attachments.slice();
1290:                renderAgentAttachments();
1291:            }
1292:            updateAgentPrimaryAction();
1293:        });
```
**对"稳定性"的意义**：steer 让用户"想插话"的需求被吸收而不破坏当前执行流；`!agentSending` 的 guard 确保只在任务真正结束后才把排队内容回填输入框，不会中途改写正在运行的任务上下文，杜绝"插话导致节点创建错乱"。

---

### 覆盖点 4：任务完成/失败/取消后状态怎么复位
**机制**：终态由 `agentActiveWorkflow.status` 直接赋值收口。成功/失败/部分失败在生成执行收尾处统一判定（L11094）；成功进入 `completed`/`completed_with_errors`，纯失败进入 `failed`，被停止进入 `stopped`，待用户确认进入 `awaiting_confirm`，需求理解失败进入 `incomplete`。`input-state-machine.js` 的 `setStatus()` 提供收敛封装：`completed/stopped` 一律归一为 `idle`（L14）。canvas-agent 运行时用 `stopAgentWorkflow()`（L7978-7986）做 stopping→stopped 流转并释放锁。

**代码证据**：终态判定（L11094）
```js
11094:        agentActiveWorkflow.status=agentStopRequested?'stopped':(hasError && hasDone?'completed_with_errors':hasError?'failed':(stillRunning?'running':'completed'));
11095:        agentActiveWorkflow.updatedAt=Date.now();
```
停止流转（L7981-7983）
```js
7981:    agentActiveWorkflow.status='stopping';agentActiveWorkflow.updatedAt=Date.now();updateAgentPrimaryAction();saveAgentState();
7982:    await Promise.all((agentActiveWorkflow.nodeIds||[]).map(id=>Promise.resolve(agentHost?.cancelNodeRun?.(id)).catch(()=>{})));
7983:    agentActiveWorkflow.status='stopped';agentActiveWorkflow.updatedAt=Date.now();agentSending=false;agentThinking=false;
```
状态机收敛（input-state-machine.js L14）
```js
14:        setStatus(status){this.state.status=status||'idle';if(['completed','stopped'].includes(status))this.state.status='idle';this.emit();}
```
`awaiting_confirm` 复位（L6366-6369）
```js
6366:        if(agentActiveWorkflow){
6367:            agentActiveWorkflow.status = 'awaiting_confirm';
6368:            agentActiveWorkflow.updatedAt = Date.now();
```
**对"稳定性"的意义**：所有终态都显式收口到非 RUNNING 状态，并统一释放 `agentSending/agentThinking`，保证"任务结束 → 锁必释放 → 按钮必恢复可发"，根除"锁卡死、再也发不出去"的死局。

---

### 覆盖点 5：思考态（thinking）怎么隔离多对话
**机制**：用 `agentThinkingConversationId` 把"正在思考"绑定到具体对话。只有当该 id 等于当前激活对话时，thinking 旋转/文案才会渲染（L3996、L4481）；后台任务（用户已切到别的对话）完成时不向当前 UI 落结果，只关掉后台 thinking 标记（L7678-7684）。每次任务开始都写入 `agentThinkingConversationId`（如 L5127、L6571、L6989、L8254），每轮收尾都清空（如 L6364、L6950、L7049、L7746）。

**代码证据**：thinking 显示隔离（L3996）
```js
3996:        const showThinking = agentThinking && (!agentThinkingConversationId || agentThinkingConversationId === (agentState.activeConversationId || ''));
```
后台完成不污染当前 UI（L7678-7684）
```js
7678:    }else{
7679:        // 后台完成：关掉所属对话的 thinking 标记，但不要让当前新对话显示 spinner/结果
7680:        if(agentThinkingConversationId === ownerConversationId){
7681:            agentThinking = false;
7682:            agentThinkingConversationId = '';
7683:        }
7684:        saveAgentState();
```
加载对话时按 id 还原 thinking（L4481）
```js
4481:    agentThinking = (agentThinkingConversationId && agentThinkingConversationId === conv.id) ? true : false;
```
**对"稳定性"的意义**：多对话并发时，思考态与生成结果严格归属各自对话，避免 A 对话的后台结果错显/错写进 B 对话的画布，是"工具执行完又串台"类问题的隔离闸。

---

### 覆盖点 6：发送按钮 UI 怎么随状态变化
**机制**：`updateAgentPrimaryAction()` 用 `agentIsTaskBusy()` 推导按钮形态：`stopping` 态显示"停止中"且禁用；真忙显示 `stop`（红色停止）；有内容显示 `send`；否则 `idle`（禁用）。按钮 `disabled` 由 action 决定（L3969-3971）。`action()` 在 input-state-machine 中的纯函数版本（L10）与之同构：stopping→stopping、failed→(有内容?retry:idle)、isRunning→(有内容?steer:stop)、有内容→send、否则 idle。

**代码证据**：按钮推导（L3965-3971）
```js
3965:    const stopping = agentActiveWorkflow?.status === 'stopping';
3966:    const running = (typeof agentIsTaskBusy === 'function')
3967:        ? agentIsTaskBusy()
3968:        : (agentSending || ['planning','creating_nodes','ready','running','stopping'].includes(agentActiveWorkflow?.status));
3969:    const action = stopping ? 'stopping' : running ? 'stop' : (hasContent ? 'send' : 'idle');
3970:    agentSendBtn.dataset.agentAction = action;
3971:    agentSendBtn.disabled = action === 'idle' || action === 'stopping';
```
状态机纯函数 action（input-state-machine.js L10）
```js
10:        action(){if(this.state.status==='stopping')return'stopping';if(this.state.status==='failed')return this.hasContent()?'retry':'idle';if(this.isRunning())return this.hasContent()?'steer':'stop';return this.hasContent()?'send':'idle';}
```
**对"稳定性"的意义**：UI 与状态机同源，按钮禁用态就是并发闸的可视化——用户在区间内点不动"发送"，只能"停止"，从交互层面消除双发冲动。

---

### 覆盖点 7：与"重复操作"的关系
**机制**：状态机从三个层面阻止"工具执行完又重复建节点 / 重复触发生成"：
1. **单飞锁 `__canvasAgentGenRunning`**：`runAgentGenerations` 开头即判断（L10478-10482），若已在跑则 `return`，杜绝一次发送被触发成两套并行工作流。
2. **状态门禁**：节点创建发生在 `creating_nodes`/后续运行态，而 `agentIsTaskBusy()` 把这些态都判为忙，期间 `sendAgentMessage` 被 L8173 拦截、`Enter` 被 L9763 拦截、steer 被 L7836 拦截——没有新发送，就不会再进规划/建节点流程。
3. **收尾才解锁**：生成收尾用 `stillBusy` 复合判定（L8355-8358：全局生成锁 + workflow 状态 + 本对话 running/waiting 生成），全部结束才 `agentSending=false`，确保"上一轮彻底干净"才允许下一轮。

**代码证据**：单飞锁（L10477-10482）
```js
10477:    // 单飞锁：避免同一次发送被重复触发成两套并行工作流（普通画布尤甚）
10478:    if(window.__canvasAgentGenRunning){
10479:        console.warn('[canvas-agent] skip duplicate runAgentGenerations');
10480:        return;
10481:    }
10482:    window.__canvasAgentGenRunning = true;
```
Enter 在忙时禁止发送（L9762-9764）
```js
9762:            // 任务进行中禁止 Enter 发送新内容；停止请点红色停止按钮
9763:            if(typeof agentIsTaskBusy === 'function' && agentIsTaskBusy()) return;
9764:            sendAgentMessage();
```
收尾复合解锁（L8355-8358）
```js
8355:        const stillBusy = !!(typeof window !== 'undefined' && window.__canvasAgentGenRunning)
8356:            || ['planning','creating_nodes','ready','running','stopping'].includes(String(agentActiveWorkflow?.status || '').toLowerCase())
8357:            || agentConversationHasRunningGens(ownerConversationId || agentState?.activeConversationId || '');
8358:        if(!stillBusy){
```
**对"稳定性"的意义**：单飞锁防"同一次触发重复执行"，状态门禁防"上一轮未结束就开新一轮"，复合解锁防"半残状态误判为空闲"。三者叠加，从机制上封死"重复建节点、重复生成、自言自语继续推演"的通道。

---

## 五、总结：状态机与并发控制如何保障会话稳定

1. **单一权威状态枚举**：`RUNNING = {planning, creating_nodes, ready, running}`（+`stopping`）在状态机模块与运行时所有忙闲判定中复用，保证"忙/闲"口径唯一，是防并发的根本前提。
2. **全局发送锁 + 复合真忙判定**：`agentSending` 在任务全程置 true，配合 `agentIsTaskBusy()`（状态 + 单飞锁 + 对话内运行生成）作为唯一决策点，所有发送入口（按钮、Enter、steer、重试）都先过它，从根上杜绝双发与中途插队。
3. **单飞锁 `__canvasAgentGenRunning`**：生成执行入口强制串行，避免一次触发裂变成两套并行工作流，是"重复建节点"的直接防火墙。
4. **steer 排队不插队**：任务中用户的后续诉求进入 `steerQueue` 仅作占位告知，结束后清空而非自动执行，既吸收用户意图又不打断当前执行流。
5. **终态必收口、锁必释放**：所有成功/失败/停止/确认态都显式落到非 RUNNING，并统一清空 `agentSending/agentThinking` 与 `agentThinkingConversationId`，保证"任务结束→UI 恢复→可再发"，根除锁卡死与跨对话串台。

---

## 六、验收标准（可自测）
1. 覆盖清单 7 个点**全部有**输出，每点都有真实 `文件 L行号` + 代码片段。✅
2. 至少回答：`RUNNING` 集合内容（L3）、`setStatus` 收敛到 idle 的逻辑（L14）、steer 队列完整生命周期（L7856-7863 入队 / L1285-1293 出队 / L11130-11133 清空）、发送锁的 true/false 路径（L5125 置 / L6365 释放 / L5157-5163 拦截）。✅
3. 行号是本次实际打开文件核实的，不是凭空写。✅
4. 全文只写本文件，无修改代码、无脚本。✅
