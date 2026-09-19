/**
 * ── 唯一性/兄弟声明（2026-08-30）──
 * 本文件含两张自建监听/注册：① listeners（任务中心 store 订阅，initTasks/notify 用）；
 * ② retryRegistry（registerTaskRetry，按 nodeId 的键控回调注册表）。
 * ②与 toolRegistry.js 同为「运行时注册 + 查询」形态——兄弟，禁止再开第三种注册形态；
 * ①为 store 自带订阅（非广播通道），与 eventBus.js / promptHubStore.js 的同构订阅并列为兄弟。
 *
 * 任务中心 store —— 后端化（对齐官方，数据落 localTool /api/tasks → SQLite）。
 *
 * 职责：
 *  - 内存态 `tasks` 是唯一数据源（供 useTasks / 任务中心 UI 实时订阅）。
 *  - 启动时从 /api/tasks 加载历史任务（刷新/重启不丢）。
 *  - 增删改（reportGenerate / progress / done / fail / removeTask / clearTasksBy）
 *    同步调用后端持久化（fire-and-forget，不阻塞 UI；失败降级为仅内存）。
 *
 * 任务字段（对齐官方 Ln.jsx / jn.jsx）：
 *  { id(=taskId), nodeId, type, prompt, modelName, channelName,
 *    status:'pending'|'running'|'completed'|'failed', progress, errorMsg, resultUrl, createdAt }
 *
 * ════════════════════════════════════════════════════════════════
 * 【★ 我该用哪个？—— 按"我是谁"照表选（2026-09-20 深模块化）】
 *
 * **两条合法入口，各自封闭**（不是"一深一浅"，别把其中一条当绕过）：
 *  · **产结果**（写一条生成路径）→ 经 `useNodeGeneration` / `runGenerationOrchestration`
 *    （内部 `reportGenerate` → `TaskController.{progress,done,fail}`）；
 *  · **恢复已提交任务**（刷新后接管）→ `pollTask.ts` 用 `patchTask`(进度) + `completeTask`/`failTask`(终态)。
 *
 * | 我是谁 | 用哪条 | 为什么 |
 * | --- | --- | --- |
 * | **写一条新的生成路径**（节点 / 剧本盒 / 任何产图产文） | `useNodeGeneration` 或 `runGenerationOrchestration` | 已封装 report→progress→落盘→回填全序列；手写 `reportGenerate` 会漏掉落盘/回填 |
 * | 需要**手写**编排（极少数） | `reportGenerate(nodeId, type, prompt, meta)` → 用返回的 `TaskController` | 本模块的**深接口**：4 个成员，不暴露内部其余函数 |
 * | **刷新后恢复**已提交的异步任务 | `ensurePolling`/`stopPolling`/`isPolling` + 终态原语 `completeTask`/`failTask`（**`pollTask.ts` 是唯一调用方**） | 恢复路径与 live 路径**共用同一份终态原语**（TD-01-20 收口） |
 * | **任务中心 UI** 渲染 / 面板态 | `getTasks()` / `usePanel()` / `setPanel()` / `openTaskCenter()` | UI 专用查询与面板态 |
 * | **Agent 工具**驱动节点重跑 | `runNodeGeneration(nodeId)` + `registerTaskRetry`（含并发闸 `claimNodeRun`） | 供 `generate_node` 工具用 |
 * | 清理（测试 / 退出） | `clearTasksBy(predicate)` / `clearAllTasks()` | |
 *
 * **两条纪律**：
 * ① **终态只能经 `completeTask`/`failTask`**（它们是 TD-01-20 的**唯一原语**：含非字符串防御 +
 *    排障埋点 + 取消未落进度写）。**不要**自己 `patchTask(id, { status:'completed' })` ——
 *    会漏掉这三项（`TaskController.done/fail` 也只是委托这两个原语，不是另一条路）。
 * ② **`unknown` 终态不可自动重试**（见下方 `TaskStatus`）：它≠failed，自动重试 = 重复计费。
 *
 * **存量核对（2026-09-20 普查）**：src 侧调本模块状态机的**只有 2 处** ——
 * `generationOrchestration.ts`（经 `reportGenerate`）与 `pollTask.ts`（经终态原语），
 * **均为上表合法入口，零绕过**。新增调用方请照表选，勿自建第三条。
 * ════════════════════════════════════════════════════════════════
 */
import { useSyncExternalStore } from 'react';
import { logger } from '../core/log/logger.ts';
import { createDebouncedPersist } from '../core/contentStore.ts';
import { saveTask, deleteTask, batchDeleteTasks, clearAllTasksApi } from '../api/localToolApi.ts';
// 取全量任务（分页读取的唯一实现）：见 initTasks 注释（原「请求 500」实际只拿到 100）。
import { fetchAllTaskPages } from '../api/pagedList.ts';
import { publishTaskCompleted } from '@/components/task/taskCompletionBus';
import { generateId } from '../core/idGen.ts';
import { GEN_MAX_CONCURRENT } from '../core/config.ts';

/**
 * 任务状态机：pending(待跑) → running(进行中) → completed / failed / unknown。
 *
 * 【TD-08-24 · 2026-09-16】新增终态 `unknown` = **提交结果未知**（付费任务专属）：
 * 提交请求已发出但未收到确认（超时/断连/落库失败），**上游可能已创建任务并在跑**。
 * 【为何必须与 failed 分开】判 failed 会显示「失败」→ 用户直接重提 → **重复计费**（旧任务还在跑）。
 * 故 unknown 走琥珀色「结果未知」+ 文案引导用户到任务中心确认；**不得自动重试、不得自动回填节点结果**。
 * 与后端口径对齐：`localTool/src/relay-poll.ts` 的 `RelayTaskStatus`。
 */
export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'unknown';

/** 任务记录（对齐官方 Ln.jsx / jn.jsx 字段） */
export interface Task {
  /** 前端自造任务 id（= 贯穿链路主键，经 run ctx 透传给 generateImage opts.taskId） */
  id: string;
  /** 归属节点 id；空则视为网关占位垃圾行，不进任务中心展示 */
  nodeId: string;
  type: string;
  prompt?: string;
  modelName?: string;
  channelName?: string;
  status: TaskStatus;
  progress?: number;
  errorMsg?: string;
  resultUrl?: string;
  createdAt?: number;
  /** 当前进行到哪一步的文案（如「已转发到生成网关…」） */
  stageLabel?: string;
  [key: string]: unknown;
}

/**
 * reportGenerate 返回的任务控制器。
 * 这是权威定义：useNodeGeneration 等下游直接复用本类型，不再各写一份。
 */
export interface TaskController {
  /** 请求级贯穿主键，经 run ctx 透传给 generateImage/generateVideo 的 opts.taskId */
  taskId: string;
  progress: (percent: number, stage?: string) => void;
  done: (resultUrl: string) => void;
  fail: (errorMsg?: string) => void;
}

/** 左侧面板状态 */
export interface PanelState {
  expanded: boolean;
  /** 'tasks' = 任务中心 | 'assets' = 素材库 */
  activeTab: string;
  /** 钉住后点击面板外部不再自动收起 */
  pinned: boolean;
}

let tasks: Task[] = [];
const listeners = new Set<() => void>();

// ── 启动时从后端加载历史任务 ──
let loaded = false;
export function initTasks(): void {
  if (loaded) return;
  loaded = true;
  // 【取全量（2026-09-17 修）】原 `fetchTasks({ pageSize: 500 })`——后端把 pageSize **硬性 cap 到 100**
  // （`localTool/src/utils/helpers.ts::parsePagination`）⇒ 实际只拿到 100 条；而本处按"这是全量"使用
  // （任务中心列表 + 「清理全部」计数 + pollTask 查找），**任务数超 100 时历史静默缺失**。
  // 现走「取全量」的唯一实现（`api/pagedList` 按 totalPages 取齐，不抄上限）。
  fetchAllTaskPages()
    .then((items) => {
      if (items.length > 0) {
        tasks = items as Task[];
        notify();
      }
    })
    .catch((e) => logger.warn('taskStore', '加载历史任务失败（localTool 未连？）', e?.message));
}

// 后端保存（fire-and-forget，失败仅降级为内存态，前端流程不受影响）
function persist(task: Task): void {
  // 剥离纯运行时展示字段：stageLabel 是任务中心「进行到哪一步」的瞬时文案，
  // 只在内存中供 UI 展示，后端 tasks 表无此列（taskToRow 白名单会过滤并刷 warn），
  // 故落库前剥掉，避免每次进度持久化都携带无用载荷并触发 [taskToRow:dropped] 噪音。
  const { stageLabel: _dropStageLabel, ...persistable } = task;
  saveTask(persistable).catch((e) =>
    logger.warn('task', 'persist-fail', { taskId: task?.id, error: e?.message }),
  );
}

// 状态 → 圆点/文字 颜色（对齐官方 An）
export function statusDotClass(status?: string): string {
  if (status === 'completed') return 'bg-emerald-400';
  if (status === 'failed') return 'bg-red-400';
  // 【TD-08-24】unknown（提交结果未知·可能已在生成）用琥珀色：既非红（确定失败）也非蓝（进行中）
  if (status === 'unknown') return 'bg-amber-400';
  return 'bg-blue-400';
}

// 状态 → 文案（对齐官方 On）
export function statusLabel(status?: string, progress = 0): string {
  if (status === 'completed') return '已完成';
  if (status === 'failed') return '失败';
  // 【TD-08-24】提交结果未知：文案必须点明「可能已在生成」，否则用户会当成失败直接重提（重复计费）
  if (status === 'unknown') return '结果未知';
  if (status === 'pending') return '生成中';
  if (status === 'running') return progress > 0 ? `${Math.round(progress)}%` : '生成中';
  return status || '';
}

// 类型 → 文案（对齐官方 Tn 映射 + 补充）
export function typeLabel(type?: string): string {
  const MAP: Record<string, string> = {
    text: '文本',
    image: '生图',
    video: '视频',
    sd2Video: 'SD2视频',
    discountVideo: '视频生成',
    custom: '万能',
    rhWebapp: 'AI应用',
  };
  return (type && MAP[type]) || type || '任务';
}

/**
 * 任务结果的媒体形态（唯一判据 · 与 typeLabel/statusLabel 同层原语族）。
 *
 * 【为什么必须有它】`Task.type` 是开放字符串，而「这个任务的结果能不能当媒体渲染/下载」
 * 此前散落在渲染端 5 处，且默认值是 **fail-open**（「非 video 即图片」）：
 *   `TaskCenter` 缩略图 `type==='video' ? <VideoThumbnail> : <img>`、下载扩展名三连、
 *   预览分支 `type!=='video'`、可点预览 `type==='image'`、`TYPE_ICON.text = ImageIcon`。
 * 于是**文本任务**（存量行 `result_url` 存的是正文）被当图片地址请求，实测
 * `GET /<URL 编码的正文>` 打到 localTool 18080 → 未命中具名路由 → catch-all 转发外网
 * （每条白等 ~10.5s 后 fetch failed）。它每次作图都复发：开始生成会自动弹出任务中心。
 *
 * 【契约（fail-safe）】只有**显式登记为媒体**的 type 才返回媒体形态；其余（text/audio/未知）
 * 一律 `'none'` —— 宁可少一个缩略图，也不为未知 type 制造媒体请求。
 * 新增产出媒体的任务类型 → 只在本词表登记一处，全部渲染出口零改动。
 */
export type TaskMediaKind = 'image' | 'video' | 'none';

/** 视频类 type（同一媒体形态的多个别名，与 typeLabel 词表同源） */
const VIDEO_TASK_TYPES = new Set(['video', 'sd2Video', 'discountVideo']);

/** type → 结果媒体形态（唯一实现，禁止在任何渲染端再写第二份判据） */
export function taskMediaKind(type?: string): TaskMediaKind {
  if (type === 'image') return 'image';
  if (type && VIDEO_TASK_TYPES.has(type)) return 'video';
  return 'none';
}

function genId(): string {
  return generateId('task');
}

function notify(): void {
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

// 展示用快照（供 useTasks / 任务中心 UI）：过滤掉 nodeId 为空的无效任务。
// 这类任务是网关占位垃圾行（persistThreadId 旧逻辑为网关 task_id 单独建的空行），
// 没有归属节点，不应在任务中心展示。用快照缓存保证引用稳定，避免 useSyncExternalStore 无限重渲染。
// 注意：轮询用的 getTasks() 仍返回完整原始数组（含无 nodeId 的行），不影响异步任务恢复逻辑。
let snapshotCache: { source: Task[]; list: Task[] } | null = null;
function getSnapshot(): Task[] {
  if (!snapshotCache || snapshotCache.source !== tasks) {
    snapshotCache = { source: tasks, list: tasks.filter((t) => t.nodeId) };
  }
  return snapshotCache.list;
}

/** 非 React 环境读取当前任务列表（供轮询/脚本等模块级使用）。 */
export function getTasks(): Task[] {
  return tasks;
}

// ── 左侧面板全局状态（对齐官方 setShowTaskList：生成任务时自动弹出任务中心）──
// 官方 H_.jsx 在每次提交生成任务时调用 H?.(true)（即 setShowTaskList(true)）弹出任务中心。
// 我们统一契约里所有生成节点都走 reportGenerate，故在这里触发 openTaskCenter()，覆盖面最全
// （节点生成 / Agent generate_node / 任务中心重试 提交任务都会自动弹面板切到任务中心）。
let panel: PanelState = { expanded: false, activeTab: 'tasks', pinned: false };
const panelListeners = new Set<() => void>();
function notifyPanel(): void {
  panelListeners.forEach((l) => l());
}
function panelSubscribe(cb: () => void): () => void {
  panelListeners.add(cb);
  return () => {
    panelListeners.delete(cb);
  };
}
function getPanelSnapshot(): PanelState {
  return panel;
}
/** 读取当前面板状态（供非 React 环境/持久化使用） */
export function getPanel(): PanelState {
  return panel;
}
/** 设置面板状态（保留未指定字段） */
export function setPanel(next: Partial<PanelState>): void {
  panel = { ...panel, ...next };
  notifyPanel();
}
/** 自动弹出任务中心（展开面板 + 切到「任务中心」tab） */
export function openTaskCenter() {
  setPanel({ expanded: true, activeTab: 'tasks' });
}
/** 自动弹出素材库（展开面板 + 切到「素材」tab），供节点「发送到素材库」后联动 */
export function openResourceLibrary() {
  setPanel({ expanded: true, activeTab: 'assets' });
}
/** 切换面板钉住状态（钉住后点击面板外部不再自动收起） */
export function togglePin() {
  setPanel({ pinned: !panel.pinned });
}
/** 订阅面板状态（LeftPanel 使用） */
export function usePanel() {
  return useSyncExternalStore(panelSubscribe, getPanelSnapshot);
}

// 节点生成时上报任务（生成中 → 完成/失败）。返回更新函数。
export function reportGenerate(
  nodeId: string,
  type: string,
  prompt?: string,
  meta: { modelName?: string; channelName?: string } = {},
): TaskController {
  // 对齐官方：提交生成任务时自动弹出任务中心
  openTaskCenter();
  // 结束同 nodeId 之前未完成的任务
  const old = tasks.find(
    (t) => t.nodeId === nodeId && (t.status === 'running' || t.status === 'pending'),
  );
  tasks = tasks.filter((t) => t !== old);
  const task: Task = {
    id: genId(),
    nodeId,
    type,
    prompt,
    modelName: meta.modelName || '',
    channelName: meta.channelName || '',
    status: 'running',
    progress: 0,
    errorMsg: '',
    resultUrl: '',
    stageLabel: '',
    createdAt: Date.now(),
  };
  tasks = [task, ...tasks];
  notify();
  persist(task); // 后端持久化
  // P4 进度落库节流：progress 高频（流式/轮询/拖拽）触发，防抖合并成最终态一次落库。
  // write 是「读当前内存任务」的 thunk——flush 时若任务已被删除则跳过（避免误重建）。
  // 创建(done/fail) 保持即时落库，仅中间进度被合并；done/fail 先 cancel 防晚到的进度覆盖终态。
  const progressPersist = createDebouncedPersist(() => {
    const cur = tasks.find((t) => t.id === task.id);
    if (cur) persist(cur);
  }, 200);
  // 【TD-01-20】把"取消未落的进度写"登记进终态原语可用的表（原只有本闭包能取消 ⇒ 恢复路径取不到）
  progressCancels.set(task.id, () => progressPersist.cancel());
  return {
    // 前端自造任务 id（贯穿链路主键，P0-A 请求级上下文）：useNodeGeneration/scriptBox 由 run ctx 透传给 generateImage opts，
    // 经 payload.taskId 带给 localTool/网关（不再经全局 currentTaskId）。
    taskId: task.id,
    // 更新进度（可带阶段文案，如「已转发到生成网关…」，供任务中心展示当前进行到哪一步）
    progress: (p: number, stage?: string) => {
      const stageLabel = typeof stage === 'string' && stage ? stage : task.stageLabel || '';
      tasks = tasks.map((t) =>
        t.id === task.id ? { ...t, status: 'running', progress: p, stageLabel } : t,
      );
      notify();
      progressPersist.schedule(); // 合并高频进度落库（窗口内只写最终态）
    },
    // 标记完成（resultUrl 应为已持久 /files/ URL；调用方先落盘再 done，见 P0-C 单向落盘契约）
    // 【TD-01-20】委托终态原语（与恢复轮询同一份实现；本闭包不再自持第二份写法）
    done: (resultUrl: string) => completeTask(task.id, resultUrl),
    // 标记失败（同上：委托原语；是否弹提示由调用方决定）
    fail: (errorMsg?: string) => failTask(task.id, errorMsg),
  };
}

/**
 * 终态落地的「进度写取消」登记（TD-01-20）。
 *
 * 【为什么要这张表】终态时必须取消尚未落库的进度写（否则晚到的 running 快照会覆盖终态）。
 * 这条能力此前长在 `createTask` 的闭包里（`progressPersist.cancel()`）⇒ **只有 live 路径享受得到**；
 * 恢复轮询（`pollTask`）只能走 `patchTask`，于是「非字符串防御 / 排障埋点 / 取消进度写」三项里它缺两项。
 * 现把终态收口成下方两个原语，闭包只负责登记一个 cancel 句柄。
 */
const progressCancels = new Map<string, () => void>();

/**
 * 终态落地唯一原语：**完成**（TD-01-20）。
 *
 * 【谁调】① live：`createTask()` 返回的 `ctl.done(url)`；② 恢复：`pollTask` 的 attach 闭环。
 * 【为什么必须唯一】原先两路各写一份 ⇒ 同一件事两套行为（live 有防御+埋点+取消进度写，恢复没有）。
 * 【UI 提示不在此】live 由节点侧弹、恢复由轮询侧弹 —— 那是消费者按上下文决定的事，不属"写终态"。
 *
 * @param resultUrl 已持久化的 /files/ URL（调用方先落盘再调本函数，见 P0-C 单向落盘契约）
 */
export function completeTask(id: string, resultUrl: string): void {
  // 防御：resultUrl 必须是字符串（历史 bug：上游偶发返回对象/undefined，导致 .startsWith 崩）
  const safeUrl = typeof resultUrl === 'string' ? resultUrl : '';
  const cur = tasks.find((t) => t.id === id);
  if (!cur) {
    // 任务已被删除（清会话 / 用户删卡）→ 不凭空复活；留痕供排查"为什么结果没上屏"
    logger.warn('taskStore', '终态落地时任务已不在（可能已被删除），跳过写回', { taskId: id });
    return;
  }
  // 【排障埋点 · 2026-09-03 任务不结束排查】任何任务 done 时打印 id/type/resultUrl，断「卡进度 vs 卡 done 未触发」。
  logger.debug(
    '任务',
    '[任务] done',
    { taskId: id, nodeId: cur.nodeId, type: cur.type, hasUrl: !!safeUrl },
    { module: 'image' },
  );
  // 以**当前行**为基准（原实现用 createTask 时的闭包快照 persist，会把中途更新的字段写回旧值）
  const next: Task = { ...cur, status: 'completed', progress: 100, resultUrl: safeUrl };
  tasks = tasks.map((t) => (t.id === id ? next : t));
  notify();
  progressCancels.get(id)?.(); // 取消未落的进度写，避免晚于 completed 覆盖终态
  progressCancels.delete(id);
  persist(next);
  // 【画布同步】任务完成广播（统一入口 publishTaskCompleted，经 eventBus，解耦 window）：
  // 节点监听 agent:task-completed 回写结果，刷新场景靠任务中心的持久 resultUrl 恢复节点显示
  //（落盘由调用方完成，done 不再负责；空 resultUrl 的文本类任务不广播）。
  publishTaskCompleted({
    taskId: id,
    nodeId: cur.nodeId,
    resultUrl: safeUrl,
    type: cur.type,
    status: 'completed',
  });
}

/** 终态落地唯一原语：**失败**（口径与 `completeTask` 同源；是否弹提示由调用方按上下文决定）。 */
export function failTask(id: string, errorMsg?: string): void {
  const msg = errorMsg || '生成失败';
  const cur = tasks.find((t) => t.id === id);
  if (!cur) {
    logger.warn('taskStore', '终态落地时任务已不在（可能已被删除），跳过写回', { taskId: id });
    return;
  }
  logger.debug(
    '任务',
    '[任务] fail',
    { taskId: id, nodeId: cur.nodeId, type: cur.type, error: msg },
    { module: 'image' },
  );
  const next: Task = { ...cur, status: 'failed', errorMsg: msg };
  tasks = tasks.map((t) => (t.id === id ? next : t));
  notify();
  progressCancels.get(id)?.(); // 同 completeTask：取消未落的进度写
  progressCancels.delete(id);
  persist(next);
}

/**
 * 通用任务字段更新：按 id 合并 patch，同步内存 + 后端落库。
 * 用途：异步任务恢复轮询（见 pollTask.js）拿到新状态/结果后回写任务记录。
 * 【取舍】不新建 setter，统一走这里，避免散落多处改 tasks 的写法。
 * 【与终态原语的分工（TD-01-20）】**非终态**（running/进度/metadata）走这里；
 * **终态**（completed/failed）一律走 `completeTask` / `failTask` —— 否则又会散出第二份终态写法。
 */
export function patchTask(id: string, patch: Partial<Task>): void {
  if (!id || !patch) return;
  let changed = false;
  tasks = tasks.map((t) => {
    if (t.id === id) {
      changed = true;
      return { ...t, ...patch };
    }
    return t;
  });
  if (changed) {
    notify();
    const cur = tasks.find((t) => t.id === id);
    if (cur) persist(cur);
  }
}

export function removeTask(id: string): void {
  tasks = tasks.filter((t) => t.id !== id);
  progressCancels.delete(id); // 终态取消登记同生命周期清理（防长会话里 Map 只涨不落）
  notify();
  // 【失败可见 TD-02-16】后端删除失败不得静默：前端已移除但后端仍残留，需留痕（下次列表刷新会"复活"）
  deleteTask(id).catch((e) => {
    logger.warn('taskStore', '后端删除任务失败（前端已移除，可能与后端不一致）', {
      id,
      reason: e?.message || e,
    });
  });
}

/**
 * 【兄弟声明 · 2026-08-30】retryRegistry 是「按 nodeId 的键控回调注册表」（registerTaskRetry /
 * unregisterTaskRetry / isNodeRegistered），与 toolRegistry.js 的数组 push 注册表同为「运行时注册 + 查询」
 * 形态——兄弟。语义是「注册 + 按 key 查询」（canvasPlanExecutor 靠 isNodeRegistered 同步轮询等注册完成），
 * 与 eventBus 广播不同（非事件通道、不走 EVENTS 登记）。禁止再开第三种注册形态。
 */
// ── 重生成回调注册表（供 Agent runNodeGeneration / 测试 / 脚本驱动节点重新生成）──
/**
 * 节点重生成回调（节点 registerTaskRetry 注册）。
 * 【TD-01-6】唯一生产注册方是 `useNodeGeneration.start`（async → 恒返回 promise），故消费侧
 * （runNodeGenerationNow）直接 await。类型仍为 `unknown`：注册表只做「按 key 存/取」，不约束
 * 各注册方返回形态（测试亦注册同步空函数，仅用于 isNodeRegistered 探活）。
 */
export type TaskRetryFn = () => unknown;

const retryRegistry = new Map<string, TaskRetryFn>();

export function registerTaskRetry(nodeId: string, fn: TaskRetryFn): void {
  if (nodeId) retryRegistry.set(nodeId, fn);
}
export function unregisterTaskRetry(nodeId: string): void {
  if (nodeId) retryRegistry.delete(nodeId);
}

/**
 * 检查某节点是否已注册生成契约（供多步执行器在 addNodes 后等待节点渲染 + effect 注册）。
 * 场景：执行器用 ctx.addNodes 直接建节点，React 异步渲染后 ImageGenerate 才在 useNodeGeneration
 * effect 里 registerTaskRetry。执行器需轮询本函数确认注册完成，再 runNodeGeneration，否则
 * runNodeGeneration 会因找不到回调返回 false（见 canvasPlanExecutor.ts）。
 * @param {string} nodeId
 * @returns {boolean}
 */
export function isNodeRegistered(nodeId: string): boolean {
  return !!nodeId && retryRegistry.has(nodeId);
}

/* ── 生图并发上限（限制同时真正在跑的生成数）──
 * 无论 AI 一次批量生成多少个节点/任务（execute_plan 可能规划 13 张），
 * 同一时刻最多只有 MAX_CONCURRENT_GEN 个会真正触发（点开始）。
 * 超出上限的第 N 个【不自动触发、不排队】——直接跳过，让节点保持「待生成」，
 * 由用户手动点击该节点发起。避免设计「排队中」按钮，也避免一次打爆上游。
 */
const MAX_CONCURRENT_GEN = GEN_MAX_CONCURRENT;
let genActive = 0;

// 【P1-E · 跨发起方并发锁】单节点互斥。
// 任何发起方（Agent runNodeGeneration / 用户手动 start）最终都汇聚到
// useNodeGeneration.start()。start 进入时经本 Map 占位、finally 释放；同节点已有进行中 →
// claim 返回 { ok:false, inFlight:true }（明确"进行中"，不静默、不并发生成）。
// 与 genActive（全局并发数）分层：genActive 先占全局任务槽，本 Map 管单节点互斥，两层不冲突。
const nodeRunning = new Map<string, boolean>(); // nodeId -> true（仅作互斥位，不存 promise）
/** 占单节点互斥锁的结果：ok=true 取得；ok=false + inFlight=true 表示同节点生成中 */
export interface NodeRunClaim {
  ok: boolean;
  inFlight?: boolean;
}
/** 占单节点互斥锁。返回 { ok:true } 取得；或 { ok:false, inFlight:true } 同节点生成中。 */
export function claimNodeRun(nodeId: string): NodeRunClaim {
  if (!nodeId) return { ok: true };
  if (nodeRunning.has(nodeId)) return { ok: false, inFlight: true };
  nodeRunning.set(nodeId, true);
  return { ok: true };
}
/** 释放单节点互斥锁（start 的 finally 调用，务必保证每个 claim 后都 release）。 */
export function releaseNodeRun(nodeId: string): void {
  if (nodeId) nodeRunning.delete(nodeId);
}

/**
 * 按 nodeId 直接触发节点生成（供 Agent generate_node / 测试 / 脚本调用）。
 * 复用 useNodeGeneration 注册到 retryRegistry 的回调（即该节点的 start）。
 *
 * 【生图并发上限】本函数限制同时真正在跑的生成数：
 *  - 当前活跃 < MAX_CONCURRENT_GEN(6) → 占槽、真正触发、完成后释放；
 *  - 当前活跃已到上限 → 直接返回 false（= 未触发），节点保持待生成，由用户手动点。
 *    不新增状态/字段，调用方按「未触发」处理（executePlan 标 ready，不报失败）。
 *
 * 【异步执行器地基】透传 start() 的 promise 结果：本函数 await 该 promise，调用方可
 * `await runNodeGeneration(id)` 拿到已落盘的 resultUrl（供前序依赖/多图编排）。
 * 返回语义见 `NodeGenerationOutcome`（`false` = 未触发 · 对象 = 已触发结果）。
 *
 * @param {string} nodeId
 * @returns {Promise<NodeGenerationOutcome>}
 */
export async function runNodeGeneration(nodeId: string): Promise<NodeGenerationOutcome> {
  if (!nodeId) return false;
  // 并发上限：已满则返回 false（未触发），节点保持待生成，用户手动点
  if (genActive >= MAX_CONCURRENT_GEN) {
    logger.warn('gen', 'concurrency-limit-skip', { nodeId, limit: MAX_CONCURRENT_GEN });
    return false;
  }
  genActive++;
  try {
    return await runNodeGenerationNow(nodeId);
  } finally {
    genActive = Math.max(0, genActive - 1);
  }
}

/** runNodeGeneration 的「已触发」结果：成功 ok:true（含已落盘 resultUrl）/ 失败 ok:false + error。
 *  （结构上是 useNodeGeneration.NodeGenerationStartResult 的读取子集——调用方只读 ok/resultUrl/error；
 *    该 hook 另可带 aborted/inFlight，此处不重复声明，以免 taskStore 反向依赖 hook 层。） */
export interface NodeGenerationRunResult {
  ok: boolean;
  resultUrl?: string;
  error?: string;
}

/**
 * runNodeGeneration 的返回语义（**两态有别，勿混**，TD-01-6）：
 *  - `false`                    → **未触发**（无 nodeId / 并发上限已满 / 节点未注册回调）→ 按「待生成」处理，
 *                                 **不算失败**（executePlan 标 ready，用户可手动点）。
 *  - `NodeGenerationRunResult`   → **已触发**：`{ok:true, resultUrl?}` 完成 / `{ok:false, error?}` 失败。
 *
 * 【为何没有 `true`】历史 `true` = 旧同步回调「已触发但无结果信封」的兼容值。retryRegistry 唯一生产注册方
 * 是 `useNodeGeneration.start`（async → 恒返回 promise），该分支不可达（死代码）→ 已删（见 runNodeGenerationNow）。
 */
export type NodeGenerationOutcome = false | NodeGenerationRunResult;

async function runNodeGenerationNow(nodeId: string): Promise<NodeGenerationOutcome> {
  const fn = retryRegistry.get(nodeId);
  if (fn) {
    try {
      // 【TD-01-6】直接 await：注册方 start 是 async → 恒为 promise。旧「非 thenable → 返回 true」的
      // 兼容分支已删（死代码：无同步注册方；且 await 非 promise 亦安全，不会抛）。
      return (await fn()) as NodeGenerationOutcome;
    } catch (e) {
      logger.error('gen', 'run-trigger-fail', {
        nodeId,
        error: (e as { message?: string })?.message,
      });
      return { ok: false, error: (e as { message?: string })?.message || '触发失败' };
    }
  }
  logger.warn('gen', 'run-callback-missing', { nodeId });
  return false;
}

/**
 * 按 nodeId 等待该节点最近一次生成任务完成（done/fail 时 resolve）。
 *
 * 用途：Agent 多步编排 / 测试 / 脚本在需要「生成完再继续」时调用。
 * 注意：Agent 的 SSE 工具循环是同步逐轮的，本函数按需等待，不会阻塞主循环；
 *      若未来 Agent 循环支持真正的异步编排，可直接 awaitTask 拿到最终 resultUrl。
 *
 * @param {string} nodeId 节点 id
 * @param {number} [timeout] 超时 ms，默认 60s
 * @returns {Promise<{status:'completed'|'failed'|'timeout', resultUrl:string, errorMsg:string}>}
 */

/* ──────────────────────────────────────────────────────────────
 * 轮询调度注册表（S2 · ensurePolling）—— 消双轮询的地基（2026-09-03 后接 pollTask 恢复消费）
 *
 * 【为什么存在】image/video 异步任务有两个轮询源头会查同一 taskId：
 *   ① in-flight（当前页 proxyGenerate while，实时进度，生命周期=页面）
 *   ② 恢复（刷新后 pollTask，捞回结果，生命周期=数据/localTool）
 * 二者触发时机/生命周期不同不能删一套，但同一时刻必须只有一个在管——
 * 本注册表保证"一个 taskId 只有一个 poller"：in-flight 先注册占位；
 * 刷新后注册表(运行时态)清空，启动扫描对未注册任务重新注册恢复 poller。
 *   ── 更新(2026-09-03 relay 收口)：① in-flight 的 proxyGenerate while 已随旧出站退役，
 *      前端 relayGenerate（/api/generate，低频 GET attach）替代实时进度；② 恢复走 GET attach
 *      同一句柄，刷新不丢——恢复机制与本注册表骨架仍有效（详见 Step5 R6）。
 *   ── 更新(2026-09-04)：pollTask 恢复已消费 ensurePolling(occupyOnly) 占位 + isPolling 去重
 *      （见 pollTask.ts startRecoveryRound），不再是"无生产调用"的空骨架。
 *
 * 【职责】只做"调度 + 单轮驱动 + 终态收敛"，不掺 provider/传输知识。
 *  单轮"怎么查"由调用方经 register 回调提供（本轮恢复只 register: occupyOnly，不驱动查询；
 *  attach 查询闭环由 pollTask 的 relayAttachUntilDone 负责）；taskStore 不统一传输、不硬编码超时。
 *
 * 【S2 状态】注册表骨架 + ensurePolling/stopPolling/isPolling 已落地；当前生产消费方为
 *  pollTask 恢复（occupyOnly 占位防双恢复），实时进度代理已随 proxyGenerate 退役。
 *  ────────────────────────────────────────────────────────────── */

/** 轮询句柄：注册后持有，可 stop 中止。 */
export interface PollerHandle {
  /** 句柄对应 taskId */
  taskId: string;
  /** 中止轮询：清定时器 + 移除注册。终态收敛 / 取消 / 超时时调用。 */
  stop: () => void;
}

/** ensurePolling 入参 */
export interface EnsurePollingOptions {
  /**
   * 单轮回调：查一次任务状态，到终态(completed/failed)返回 true 停止；未到返回 false 继续。
   * 由 ensurePolling 定时驱动（每 pollIntervalMs 调一次）。**occupyOnly 时忽略**。
   */
  register: (taskId: string) => Promise<boolean>;
  /** 单轮间隔 ms（调用方按上传模态传：image 用 GEN_POLL_INTERVAL） */
  pollIntervalMs?: number;
  /** 总超时 ms（到点强停，防止轮询无限挂起，铁律：异步必须带总超时） */
  timeoutMs?: number;
  /** 可选取消信号：abort 时 stop */
  signal?: AbortSignal;
  /**
   * 纯占位模式（in-flight 自驱动轮询用）：只登记"该 taskId 已被接管"的标记，
   * 不让 ensurePolling 起定时器/驱动 register（in-flight 自己有 while 循环驱动）。
   * 目的：让恢复扫描看到 isPolling(taskId) 为真 → 不对同一 taskId 重复起恢复 poller。
   * 调用方自己负责在轮询结束/取消时 stopPolling(taskId) 释放占位。
   */
  occupyOnly?: boolean;
}

/** 注册表条目内部态 */
interface PollerEntry {
  taskId: string;
  stop: () => void;
  timer: ReturnType<typeof setInterval> | null;
  stopped: boolean;
}

// taskId -> 轮询条目。一个 taskId 只可能有一个 entry（ensurePolling 保证）。
const pollers = new Map<string, PollerEntry>();

const DEFAULT_POLL_INTERVAL_MS = 3000;
const DEFAULT_TIMEOUT_MS = 300_000;

/**
 * 唯一轮询入口：为 taskId 注册一个轮询器，保证同一 taskId 只有一个 poller。
 * - taskId 已注册 → 返回已有句柄，不起第二个（双轮询在构造上不可能，无需去重判断）。
 * - 未注册 → 注册并立即启动首轮，随后按 pollIntervalMs 定时驱动 register 单轮回调，
 *   直到 register 返回 true(终态)/超时/stop 为止。
 * @param {string} taskId 前端自造任务 id（taskStore 主键，非网关 task_id）
 * @param {EnsurePollingOptions} opts register 为必填单轮回调
 * @returns {PollerHandle}
 */
export function ensurePolling(taskId: string, opts: EnsurePollingOptions): PollerHandle {
  const existing = pollers.get(taskId);
  if (existing) return { taskId: existing.taskId, stop: existing.stop }; // 已有 poller → 复用，杜绝双重轮询

  const intervalMs = opts.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const startedAt = Date.now();
  let timer: ReturnType<typeof setInterval> | null = null;

  // 先造 entry 再赋值 stop/timer（runOnce/stop 引用 entry，需先有可闭包引用对象）
  const entry: PollerEntry = { taskId, stop: () => {}, timer: null, stopped: false };

  // 单次驱动：跑一轮 register，到终态/超时/中止则收敛清理
  const runOnce = async () => {
    if (entry.stopped) return;
    // 总超时：到点强停，防无限挂起
    if (Date.now() - startedAt > timeoutMs) {
      logger.warn('task', 'poll-timeout-stop', { taskId, elapsedMs: Date.now() - startedAt });
      entry.stop();
      return;
    }
    try {
      const done = await opts.register(taskId);
      if (done || entry.stopped) entry.stop();
    } catch (e) {
      // 单轮异常(网络抖动等)：不误判失败，下轮再试；连续异常仍受总超时约束
      logger.warn('task', 'poll-round-error', {
        taskId,
        error: (e as { message?: string })?.message,
      });
    }
  };

  // stop 里清理 signal 监听：避免正常终态 stop 后，signal 上仍挂着该 poller 的 abort 监听
  const onAbort = () => stop();
  const stop = () => {
    if (entry.stopped) return;
    entry.stopped = true;
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
    pollers.delete(taskId); // 释放注册，stop 后同 taskId 可被重新 ensurePolling
    if (opts.signal) opts.signal.removeEventListener('abort', onAbort);
    logger.debug('任务', '[轮询] stop', { taskId }, { module: 'image' });
  };
  entry.stop = stop;

  // 先注册（occupyOnly 与驱动模式都要在注册表占位，保证恢复扫描能 isPolling 命中）
  pollers.set(taskId, entry);

  if (opts.occupyOnly) {
    // 【纯占位】in-flight 自驱动轮询用：只登记"该 taskId 已被接管"，不起定时器/不驱动 register。
    // register 单轮回调不会被调用（in-flight 自己有 while 驱动）。调用方结束/取消时自行 stopPolling。
    if (opts.signal) {
      if (opts.signal.aborted) stop();
      else opts.signal.addEventListener('abort', onAbort, { once: true });
    }
    return { taskId: entry.taskId, stop: entry.stop };
  }

  // 立即跑首轮（异步），再挂定时器驱动后续轮
  void runOnce();
  timer = setInterval(() => {
    void runOnce();
  }, intervalMs);
  entry.timer = timer;

  // 外部取消信号：abort → stop
  if (opts.signal) {
    if (opts.signal.aborted) {
      stop();
    } else {
      opts.signal.addEventListener('abort', onAbort, { once: true });
    }
  }

  return { taskId: entry.taskId, stop: entry.stop };
}

/** 显式中止某 taskId 的轮询（终态收敛/取消时调用）。 */
export function stopPolling(taskId: string): void {
  const entry = pollers.get(taskId);
  if (entry) entry.stop();
}

/** 诊断/测试：该 taskId 当前是否已被注册轮询。 */
export function isPolling(taskId: string): boolean {
  return pollers.has(taskId);
}

/** 诊断：当前注册的轮询任务数（防泄漏检查用）。 */
export function pollingCount(): number {
  return pollers.size;
}

// 清理：按条件批量删除（同步后端）
export function clearTasksBy(predicate: (t: Task) => boolean): void {
  const removed = tasks.filter((t) => predicate(t));
  if (removed.length > 0) {
    tasks = tasks.filter((t) => !predicate(t));
    for (const t of removed) progressCancels.delete(t.id); // 同 removeTask：清理终态取消登记
    notify();
    // 【失败可见 TD-02-16】fire-and-forget 但失败须留痕（后端残留 → 下次拉到已删任务）
    batchDeleteTasks(removed.map((t) => t.id)).catch((e) => {
      logger.warn('taskStore', '批量后端删除任务失败（前端已移除）', {
        count: removed.length,
        reason: e?.message || e,
      });
    });
  }
}
export function clearAllTasks(): void {
  if (tasks.length > 0) {
    tasks = [];
    notify();
    // 【失败可见 TD-02-16】fire-and-forget 但失败须留痕（否则"已清空"是假的，刷新后重现）
    clearAllTasksApi().catch((e) => {
      logger.warn('taskStore', '后端清空任务失败（前端已清，刷新后可能重现）', {
        reason: e?.message || e,
      });
    });
  }
}

export function useTasks() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
