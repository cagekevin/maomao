import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// 隔离 taskStore 的 IO 依赖（localToolApi/filesApi 走 fetch → localTool），
// 只验证纯逻辑：状态映射、类型映射、面板状态、任务清理、重试注册、进度落库节流。
vi.mock('../../src/components/base/api/localToolApi.ts', () => ({
  fetchTasks: vi.fn(async () => ({ items: [] })),
  saveTask: vi.fn(async () => {}),
  deleteTask: vi.fn(async () => {}),
  batchDeleteTasks: vi.fn(async () => {}),
  clearAllTasksApi: vi.fn(async () => {}),
}));
import { saveTask } from '@/components/base/api/localToolApi.ts';
// saveTask 的入参在 src 侧是 unknown（①类偏宽）；测试侧按落库形状用 Task 收敛，便于断言字段
import type { Task } from '@/components/base/store/taskStore.ts';

const {
  statusLabel,
  taskMediaKind,
  getPanel,
  setPanel,
  openTaskCenter,
  openResourceLibrary,
  togglePin,
  clearTasksBy,
  clearAllTasks,
  registerTaskRetry,
  unregisterTaskRetry,
  isNodeRegistered,
  runNodeGeneration,
  reportGenerate,
  getTasks,
  completeTask,
  failTask,
} = await import('../../src/components/base/store/taskStore.ts');

beforeEach(() => {
  // 任务清理依赖内部 tasks 数组，逐测试前清空（clearAllTasks 会触发事件但不影响断言）
  clearAllTasks();
});

describe('taskStore §2.6 状态映射', () => {
  it('statusLabel：完成/失败/未知/生成中/带进度百分比', () => {
    expect(statusLabel('completed')).toBe('已完成');
    expect(statusLabel('failed')).toBe('失败');
    expect(statusLabel('pending')).toBe('生成中');
    expect(statusLabel('running')).toBe('生成中');
    expect(statusLabel('running', 42)).toBe('42%');
    // 【TD-08-24】unknown 原为「无映射 → 原样透出英文字符串」；现为**正式终态**（提交结果未知），
    // 必须有中文文案 —— 否则任务中心显示 "unknown"，用户看不懂，更易误当失败重提（重复计费）。
    expect(statusLabel('unknown')).toBe('结果未知');
  });

  it('statusLabel：表外状态仍原样透出（不吞不认识的值）', () => {
    expect(statusLabel('some-future-state')).toBe('some-future-state');
  });
});

describe('taskStore §2.6 结果媒体形态（taskMediaKind · 唯一判据）', () => {
  it('登记为媒体的 type → image / video（含视频别名）', () => {
    expect(taskMediaKind('image')).toBe('image');
    expect(taskMediaKind('video')).toBe('video');
    expect(taskMediaKind('sd2Video')).toBe('video');
    expect(taskMediaKind('discountVideo')).toBe('video');
  });

  // fail-safe 是这条判据的全部价值所在：旧实现在渲染端写「非 video 即图片」，
  // 未知类型会被猜成图片 → 文本任务的 result_url（正文）被当图片地址请求。
  it('文本 / 音频 / 未知 / 空 → none（不为非媒体类型制造媒体请求）', () => {
    expect(taskMediaKind('text')).toBe('none');
    expect(taskMediaKind('audio')).toBe('none');
    expect(taskMediaKind('someFutureKind')).toBe('none');
    expect(taskMediaKind('')).toBe('none');
    expect(taskMediaKind(undefined)).toBe('none');
  });
});

describe('taskStore §2.6 面板状态', () => {
  it('openTaskCenter 展开面板并切到任务中心 tab', () => {
    setPanel({ expanded: false, activeTab: 'generated' });
    openTaskCenter();
    expect(getPanel()).toEqual({ expanded: true, activeTab: 'tasks', pinned: false });
  });

  it('setPanel 保留未指定字段', () => {
    setPanel({ expanded: true });
    expect(getPanel().activeTab).toBe('tasks');
    expect(getPanel().expanded).toBe(true);
  });

  it('togglePin 切换钉住状态，且 openTaskCenter/openResourceLibrary 保留 pinned', () => {
    setPanel({ expanded: false, activeTab: 'generated', pinned: false });
    togglePin();
    expect(getPanel().pinned).toBe(true);
    // 自动弹出任务中心不应清除钉住态
    openTaskCenter();
    expect(getPanel()).toEqual({ expanded: true, activeTab: 'tasks', pinned: true });
    // 自动弹出素材库同样保留钉住态
    setPanel({ activeTab: 'assets' });
    openResourceLibrary();
    expect(getPanel()).toEqual({ expanded: true, activeTab: 'assets', pinned: true });
    togglePin();
    expect(getPanel().pinned).toBe(false);
  });
});

describe('taskStore §2.6 任务清理', () => {
  it('clearTasksBy 按条件删除任务', () => {
    reportGenerate('n1', 'image', 'p1');
    reportGenerate('n2', 'image', 'p2');
    clearTasksBy((t) => t.nodeId === 'n1');
    const remaining = getTasks();
    expect(remaining).toHaveLength(1);
    expect(remaining[0].nodeId).toBe('n2');
  });

  it('clearAllTasks 清空全部任务', () => {
    reportGenerate('n1', 'image', 'p1');
    reportGenerate('n2', 'video', 'p2');
    clearAllTasks();
    // 用顶部已导入的单例 getTasks：taskStore 是模块级单例，require() 拿不到新实例，
    // 且在 Node <22.12 上 require(esm) 会抛 "Cannot use import statement outside a module"。
    const remaining = getTasks();
    expect(remaining).toHaveLength(0);
  });
});

describe('taskStore §2.6 重试注册/触发', () => {
  it('registerTaskRetry → isNodeRegistered 为真', () => {
    registerTaskRetry('nodeX', () => {});
    expect(isNodeRegistered('nodeX')).toBe(true);
    expect(isNodeRegistered('nodeY')).toBe(false);
  });

  it('unregisterTaskRetry 注销后 isNodeRegistered 为假', () => {
    registerTaskRetry('nodeZ', () => {});
    expect(isNodeRegistered('nodeZ')).toBe(true);
    unregisterTaskRetry('nodeZ');
    expect(isNodeRegistered('nodeZ')).toBe(false);
  });
});

// ── 【TD-01-6】runNodeGeneration 返回语义：false=未触发 · 对象=结果（旧 `true` 一态已删）──
describe('taskStore §2.6 runNodeGeneration 返回语义（TD-01-6）', () => {
  it('节点未注册回调 → 返回 false（未触发，非失败）', async () => {
    await expect(runNodeGeneration('no-such-node')).resolves.toBe(false);
  });

  it('回调抛错 → 返回 { ok:false, error }（已触发但失败）', async () => {
    registerTaskRetry('boom', async () => {
      throw new Error('炸了');
    });
    const r = await runNodeGeneration('boom');
    expect(r).toMatchObject({ ok: false, error: '炸了' });
    unregisterTaskRetry('boom');
  });

  it('回调返回 promise → 透传其结果（对象原样，供 await 拿 resultUrl）', async () => {
    registerTaskRetry('ok1', async () => ({ ok: true, resultUrl: 'http://r/1.png' }));
    const r = await runNodeGeneration('ok1');
    expect(r).toEqual({ ok: true, resultUrl: 'http://r/1.png' });
    unregisterTaskRetry('ok1');
  });

  it('【先红锚点】非 thenable 回调返回值一律透传：不再伪造 true（旧兼容分支已删）', async () => {
    // 旧实现 `thenable ? await thenable : true` 对同步/非 promise 返回值一律返回 true（伪造「已触发」）；
    // 现直接 `await fn()` → 原样透传 false（未触发语义不再被伪造）。
    registerTaskRetry('sync-false', () => false);
    await expect(runNodeGeneration('sync-false')).resolves.toBe(false);
    unregisterTaskRetry('sync-false');
  });
});

describe('taskStore §P4 进度落库节流', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('高频 progress 在防抖窗口内只落库 1 次（创建即时 + 进度合并为最终态）', () => {
    vi.mocked(saveTask).mockClear();
    const handle = reportGenerate('n1', 'image', 'p1');
    expect(saveTask).toHaveBeenCalledTimes(1); // 创建即时
    handle.progress(10, '阶段A');
    handle.progress(40, '阶段B');
    handle.progress(70, '阶段C');
    expect(saveTask).toHaveBeenCalledTimes(1); // 窗口内未落
    vi.advanceTimersByTime(200);
    expect(saveTask).toHaveBeenCalledTimes(2); // 合并落 1 次，写最终态
    const last = vi.mocked(saveTask).mock.calls.at(-1)![0] as Task;
    expect(last.id).toBe(handle.taskId);
    expect(last.progress).toBe(70);
    // stageLabel 是纯运行时展示字段，落库前已被 persist 剥离（后端 tasks 表无此列），
    // 故后端收到的载荷不应携带它 —— 验证剥离逻辑生效。
    expect(last.stageLabel).toBeUndefined();
  });

  it('done 取消未落进度写，即时落完成态且不被晚到的进度覆盖', () => {
    vi.mocked(saveTask).mockClear();
    const handle = reportGenerate('n2', 'image', 'p2');
    vi.mocked(saveTask).mockClear(); // 只统计完成路径的落库
    handle.progress(30, '阶段');
    handle.done('/result.png');
    expect(saveTask).toHaveBeenCalledTimes(1);
    const last = vi.mocked(saveTask).mock.calls.at(-1)![0] as Task;
    expect(last.status).toBe('completed');
    expect(last.progress).toBe(100);
    expect(last.resultUrl).toBe('/result.png');
    vi.advanceTimersByTime(400);
    expect(saveTask).toHaveBeenCalledTimes(1); // 无晚到的进度覆盖终态
  });

  it('fail 同 done：取消未落进度写，即时落失败态', () => {
    vi.mocked(saveTask).mockClear();
    const handle = reportGenerate('n3', 'image', 'p3');
    vi.mocked(saveTask).mockClear();
    handle.progress(50, '阶段');
    handle.fail('网络错误');
    expect(saveTask).toHaveBeenCalledTimes(1);
    const last = vi.mocked(saveTask).mock.calls.at(-1)![0] as Task;
    expect(last.status).toBe('failed');
    expect(last.errorMsg).toBe('网络错误');
    vi.advanceTimersByTime(400);
    expect(saveTask).toHaveBeenCalledTimes(1);
  });

  // 【TD-01-20】恢复路径（pollTask 调用的就是这两个原语）必须与 live **同一份口径**。
  // 此前恢复走 patchTask ⇒ 不取消未落的进度写、无终态防御 ⇒ 同一件事两套（live 有、恢复没有）。
  it('恢复路径 completeTask：与 live 同口径（取消未落进度写 + 非字符串防御）', () => {
    vi.mocked(saveTask).mockClear();
    const handle = reportGenerate('n4', 'image', 'p4');
    vi.mocked(saveTask).mockClear(); // 只统计终态路径的落库
    handle.progress(30, '阶段');
    // 上游偶发返回对象（历史 bug 会让 .startsWith 崩）→ 原语必须防御，不得把对象写进 resultUrl
    completeTask(handle.taskId, { url: 'oops' } as unknown as string);
    expect(saveTask).toHaveBeenCalledTimes(1);
    const last = vi.mocked(saveTask).mock.calls.at(-1)![0] as Task;
    expect(last.status).toBe('completed');
    expect(last.progress).toBe(100);
    expect(last.resultUrl).toBe('');
    vi.advanceTimersByTime(400);
    expect(saveTask).toHaveBeenCalledTimes(1); // 无晚到的进度覆盖终态
  });

  it('恢复路径 failTask：与 live 同口径（取消未落进度写 + 默认文案）', () => {
    vi.mocked(saveTask).mockClear();
    const handle = reportGenerate('n5', 'image', 'p5');
    vi.mocked(saveTask).mockClear();
    handle.progress(50);
    failTask(handle.taskId);
    expect(saveTask).toHaveBeenCalledTimes(1);
    const last = vi.mocked(saveTask).mock.calls.at(-1)![0] as Task;
    expect(last.status).toBe('failed');
    expect(last.errorMsg).toBe('生成失败');
    vi.advanceTimersByTime(400);
    expect(saveTask).toHaveBeenCalledTimes(1);
  });

  it('任务已被删除时：终态原语不凭空造行（恢复 attach 到已删任务）', () => {
    const before = getTasks().length;
    completeTask('no-such-task', '/files/x.png');
    failTask('no-such-task', 'boom');
    expect(getTasks()).toHaveLength(before);
  });
});

// ════════════════════════════════════════════════════════════════
// 注：原「resource:renamed 同步 resultUrl」用例已随 src 移除该订阅逻辑而删除
//（taskStore.ts 在 2026-09-12 重构中移除了 eventBus.subscribe('resource:renamed', …)
// 及其依赖的 buildUrlRewritePairs 引入；对应功能收口，测试不再锁该路径，避免变成死测试）。
// ════════════════════════════════════════════════════════════════
