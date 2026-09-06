import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { flushAsync } from './_testUtils.mjs';
// 静态 import（不动态 import）：
//  2026-09-02 修复——此前用「vi.resetModules() + 每例动态 import」隔离模块级单例，但在 vitest
//  并发/fork 下，动态 import 返回的实例与源码闭包捕获的实例可能分裂，导致 deleteProject 偶发读到
//  残留 projects。改为静态 import + 每例调源码的 `__resetForTest()` 显式重置，无实例分裂风险。
import {
  initProjects,
  createProject,
  switchProject,
  deleteProject,
  renameProject,
  getCurrentProject,
  saveCanvasState,
  loadCanvasState,
  __resetForTest,
} from '../../src/components/base/store/projectStore.ts';

// 内存 KV / 项目后端 mock
const mem = new Map();
// fetchProjects 返回可变 payload（供 initProjects 回退链测试注入后端响应）
const projectsPayload = { projects: [], lastOpened: '' };
// 2026-09-04 中间层折叠：contentStore 不再 import kvStore 的 storageGet/Set/Delete，而是直接调
// localToolApi 的 kvGet/kvSet/kvDelete → 三件套必须并进 localToolApi mock（原 kvStore mock 迁移来）。
// kvStore mock 瘦身为只剩 CANVAS_STATE_PREFIX（projectStore 仍经 storage/index 引它）。
vi.mock('../../src/components/base/api/localToolApi.ts', () => ({
  fetchProjects: vi.fn(async () => ({ data: { ...projectsPayload } })),
  saveProjects: vi.fn(async () => ({ ok: true })),
  // ↓ 自原 kvStore mock(:24-29) 迁来：折叠后 contentStore 直接调这三个
  kvGet: vi.fn(async (k) => (mem.has(k) ? mem.get(k) : null)),
  kvSet: vi.fn(async (k, v) => {
    mem.set(k, v);
  }),
  kvDelete: vi.fn(async (k) => {
    mem.delete(k);
  }),
}));
vi.mock('../../src/components/base/storage/kvStore.ts', () => ({
  CANVAS_STATE_PREFIX: 'canvas-state-v1-',
}));

// 每例前重置内存态 + 清存储，再清掉上例可能残留的 debounce 定时器（300ms 落盘节流）。
// 残留定时器会在 localStorage.clear() 之后把旧 projects 写回存储，导致下例读到脏数据。
beforeEach(() => {
  mem.clear();
  localStorage.clear();
  projectsPayload.projects = [];
  projectsPayload.lastOpened = '';
  __resetForTest();
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('项目系统 §2.8', () => {
  it('initProjects lastOpened 命中时切到该项目（B0·缺口⑪）', async () => {
    projectsPayload.projects = [
      { id: 'p1', name: 'P1' },
      { id: 'p2', name: 'P2' },
    ];
    projectsPayload.lastOpened = 'p2';
    initProjects();
    // initProjects 是同步触发 fetch，微任务后生效
    await flushAsync();
    expect(getCurrentProject().id).toBe('p2');
  });

  it('initProjects lastOpened 不存在时回退到 list[0]（B0·缺口⑪）', async () => {
    projectsPayload.projects = [
      { id: 'p1', name: 'P1' },
      { id: 'p2', name: 'P2' },
    ];
    projectsPayload.lastOpened = 'ghost-not-exist';
    initProjects();
    await flushAsync();
    expect(getCurrentProject().id).toBe('p1');
  });

  it('initProjects 空列表时不做替换（保持 default 兜底）（B0·缺口⑪）', async () => {
    projectsPayload.projects = [];
    initProjects();
    await flushAsync();
    expect(getCurrentProject().id).toBe('default');
  });

  it('initProjects 后端缺本地独有项目 → 合并保留本地（防刷新丢项目）', async () => {
    // 模拟「上一会话新建了项目X」：先 createProject 让内存 projects 含 X（含 persist 到 localStorage 兜底）
    const x = createProject('新建项目X');
    // 后端因 saveProjects 失败/双页面覆盖缺失 X（只返回 default）
    projectsPayload.projects = [{ id: 'default', name: '默认项目' }];
    initProjects();
    await flushAsync();
    // X 不能被后端缺项冲掉
    expect(switchProject(x.id).name).toBe('新建项目X');
  });

  it('initProjects 后端有新项目（本地旧列表）→ 合并保留后端独有', async () => {
    localStorage.setItem('projects', JSON.stringify([{ id: 'default', name: '默认项目' }]));
    projectsPayload.projects = [
      { id: 'default', name: '默认项目' },
      { id: 'proj-Y', name: '后端项目Y' },
    ];
    initProjects();
    await flushAsync();
    expect(switchProject('proj-Y').name).toBe('后端项目Y');
  });

  it('默认项目存在', () => {
    expect(getCurrentProject().id).toBe('default');
  });

  it('createProject 新建并切换当前', () => {
    const p = createProject('项目A');
    expect(p.id).toBeTruthy();
    expect(p.name).toBe('项目A');
    expect(getCurrentProject().id).toBe(p.id);
  });

  it('switchProject 切到目标', () => {
    const a = createProject('A');
    const b = createProject('B');
    expect(getCurrentProject().id).toBe(b.id);
    switchProject(a.id);
    expect(getCurrentProject().id).toBe(a.id);
  });

  it('deleteProject 至少保留 1 个', () => {
    expect(deleteProject('default')).toBe(false); // 只有 default，删不掉
    const a = createProject('A');
    expect(deleteProject(a.id)).toBe(true);
  });

  it('renameProject 改名', () => {
    const a = createProject('A');
    renameProject(a.id, 'A改名');
    expect(getCurrentProject().name).toBe('A改名');
  });

  it('saveCanvasState 空画布跳过保存（防误清空）', async () => {
    const r = await saveCanvasState('default', [], []);
    expect(r.skipped).toBe(true);
    const loaded = await loadCanvasState('default');
    expect(loaded).toBeNull();
  });

  it('saveCanvasState 落盘后 loadCanvasState 可恢复', async () => {
    const nodes = [
      {
        id: 'n1',
        type: 'textNode',
        data: { text: 'hi' },
        position: { x: 1, y: 2 },
        selected: true,
        measured: { w: 100 },
      },
    ];
    const edges = [{ id: 'e1', source: 'n1', target: 'n2', selected: false }];
    const r = await saveCanvasState('default', nodes, edges);
    expect(r.success).toBe(true);
    // as any：本用例验证「落盘→读取」白名单往返，不做类型校验；快照节点是 Record<string,unknown>，
    // 直接点 `.data.text` 会被 strict 拦（静态 import 后才有真实类型）。断言只关心持久化结果。
    const loaded = (await loadCanvasState('default')) as any;
    expect(loaded.nodes).toHaveLength(1);
    // 白名单清理：selected/measured 被去除，id/type/position/data 保留
    expect(loaded.nodes[0].selected).toBeUndefined();
    expect(loaded.nodes[0].measured).toBeUndefined();
    expect(loaded.nodes[0].id).toBe('n1');
    expect(loaded.nodes[0].data.text).toBe('hi');
    expect(loaded.edges[0].source).toBe('n1');
    expect(loaded.edges[0].selected).toBeUndefined();
  });

  it('saveCanvasState 传入 viewport 后 loadCanvasState 可恢复视窗（P20）', async () => {
    const nodes = [{ id: 'n1', type: 'textNode', data: {}, position: { x: 0, y: 0 } }];
    const r = await saveCanvasState('default', nodes, [], { x: 120, y: -50, zoom: 1.5 });
    expect(r.success).toBe(true);
    const loaded = await loadCanvasState('default');
    expect(loaded.viewport).toEqual({ x: 120, y: -50, zoom: 1.5 });
  });

  it('saveCanvasState 不传 viewport → 快照无 viewport 字段，loadCanvasState 返回 null（P20 兼容旧快照）', async () => {
    const nodes = [{ id: 'n1', type: 'textNode', data: {}, position: { x: 0, y: 0 } }];
    await saveCanvasState('default', nodes, []);
    const loaded = await loadCanvasState('default');
    expect(loaded.viewport).toBeNull();
  });

  it('落盘白名单保留编组所需字段（parentId/extent/style/width/height）→ 刷新后尺寸与父关系不丢', async () => {
    // 模拟编组后的节点：group 带 width/height/style/initialWidth，子节点带 parentId + 相对坐标
    const group = {
      id: 'g1',
      type: 'group',
      position: { x: 160, y: 160 },
      width: 780,
      height: 530,
      style: { width: 780, height: 530 },
      initialWidth: 780,
      initialHeight: 530,
      data: { name: '编组' },
    };
    const child = {
      id: 'a',
      type: 'imageNode',
      position: { x: 40, y: 40 },
      parentId: 'g1',
      style: { width: 300, height: 200 },
      data: {},
    };
    const r = await saveCanvasState('default', [group, child], []);
    expect(r.success).toBe(true);
    // as any：同上——快照节点 Record<string,unknown>，本用例验证编组字段持久化往返，非类型校验
    const loaded = (await loadCanvasState('default')) as any;
    expect(loaded.nodes).toHaveLength(2);
    const g = loaded.nodes.find((n) => n.type === 'group');
    const c = loaded.nodes.find((n) => n.id === 'a');
    // 尺寸保真：width/height/style/initialWidth 必须保留（否则刷新后 group 大小塌成 0）
    expect(g.width).toBe(780);
    expect(g.height).toBe(530);
    expect(g.style.width).toBe(780);
    expect(g.style.height).toBe(530);
    expect(g.initialWidth).toBe(780);
    // 父关系保真：子节点 parentId 必须保留（否则相对坐标被当绝对坐标 → 位置乱）
    expect(c.parentId).toBe('g1');
    // 运行时态仍被清理
    expect(g.measured).toBeUndefined();
  });

  it('saveCanvasState 版本冲突：远程版本更高拒绝覆盖', async () => {
    await saveCanvasState('default', [{ id: 'n1', type: 'textNode', data: {}, position: {} }], []);
    // 模拟远程已有更高版本
    mem.set('canvas-state-v1-default_version', String(Date.now() + 100000));
    const r = await saveCanvasState(
      'default',
      [{ id: 'n2', type: 'imageNode', data: {}, position: {} }],
      [],
    );
    expect(r.success).toBe(false);
    expect(r.conflictVersion).toBeTruthy();
  });

  it('saveCanvasState 版本号单调递增（TASK-053②）', async () => {
    const n = [{ id: 'n1', type: 'textNode', data: {}, position: {} }];
    await saveCanvasState('default', n, []);
    const v1 = Number(mem.get('canvas-state-v1-default_version'));
    await saveCanvasState('default', n, []);
    const v2 = Number(mem.get('canvas-state-v1-default_version'));
    await saveCanvasState('default', n, []);
    const v3 = Number(mem.get('canvas-state-v1-default_version'));
    // 同一会话内连续保存版本号必须严格递增（同毫秒也自增，避免新旧倒挂）
    expect(v1).toBeGreaterThan(0);
    expect(v2).toBeGreaterThan(v1);
    expect(v3).toBeGreaterThan(v2);
  });

  it('saveCanvasState 与远程同版本号时自增不误判冲突', async () => {
    const n = [{ id: 'n1', type: 'textNode', data: {}, position: {} }];
    await saveCanvasState('default', n, []);
    const v1 = Number(mem.get('canvas-state-v1-default_version'));
    // 远程版本与本地相同（同毫秒碰撞场景）：应自增写入，而非误判冲突
    mem.set('canvas-state-v1-default_version', String(v1));
    const r = await saveCanvasState('default', n, []);
    expect(r.success).toBe(true);
    expect(Number(mem.get('canvas-state-v1-default_version'))).toBeGreaterThan(v1);
  });
});
