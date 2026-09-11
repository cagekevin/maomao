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
  getLoadedVersion,
  __resetForTest,
} from '../../src/components/base/store/projectStore.ts';
// 409 判定用真实 HttpError：projectStore 用 `instanceof HttpError` 识别冲突，
// 桩里必须抛同一个类（同文件 → 同一模块实例），否则会被当成「KV 不可用」走 fail 分支。
import { HttpError } from '../../src/components/base/api/httpClient.ts';

// ── 内存 KV / 项目后端 mock ──
// 共享状态用 vi.hoisted 提前创建：vi.mock 工厂会被提升到 import 之前，工厂体里引用它们时不能处于 TDZ。
const H = vi.hoisted(() => ({
  mem: new Map<string, unknown>(),
  /** kvSet 调用记录（断言 CAS 入参用） */
  kvSetCalls: [] as Array<{ key: string; value: unknown; ifVersion?: number }>,
  /** kvGet / kvGetVersion 读写顺序记录（断言「版本→快照→版本」用） */
  ops: [] as string[],
  /** kvGetVersion 返回队列（非空时优先弹出，用于模拟「读期间版本被改」） */
  versionQueue: [] as number[],
  fetchProjectsPayload: { projects: [] as Array<{ id: string; name: string }>, lastOpened: '' },
  /** 个别用例（串行化）替换 kvSet 实现；返回 null 表示走默认 CAS 语义 */
  kvSetOverride: null as
    null | ((k: string, v: unknown, opts: { ifVersion?: number }) => Promise<unknown>),
}));

// 2026-09-04 中间层折叠：contentStore 直接调 localToolApi 的 kvGet/kvSet/kvDelete。
// docs/118 起 projectStore 直调 kvSet（CAS）+ kvGetVersion（版本读），桩必须同步提供并模拟服务端语义。
vi.mock('../../src/components/base/api/localToolApi.ts', async () => {
  const { HttpError: RealHttpError } = await import('../../src/components/base/api/httpClient.ts');
  const S = H;
  return {
    fetchProjects: vi.fn(async () => ({ data: { ...S.fetchProjectsPayload } })),
    saveProjects: vi.fn(async () => ({ ok: true })),
    kvGet: vi.fn(async (k: string) => {
      S.ops.push(`snapshot:${k}`);
      return S.mem.has(k) ? S.mem.get(k) : null;
    }),
    // GET /api/kv/version：真实语义 = 读 <key>_version，读不到 0
    kvGetVersion: vi.fn(async (k: string) => {
      S.ops.push(`version:${k}`);
      if (S.versionQueue.length) return S.versionQueue.shift() as number;
      const v = Number(S.mem.get(`${k}_version`));
      return Number.isFinite(v) ? v : 0;
    }),
    kvDelete: vi.fn(async (k: string) => {
      S.mem.delete(k);
    }),
    // POST /api/kv/set：真实 CAS 语义桩（ifVersion 不匹配 → 409 且不写）
    kvSet: vi.fn(async (k: string, v: unknown, opts: { ifVersion?: number } = {}) => {
      S.kvSetCalls.push({ key: k, value: v, ifVersion: opts?.ifVersion });
      if (S.kvSetOverride) return S.kvSetOverride(k, v, opts);
      const cur = Number(S.mem.get(`${k}_version`)) || 0;
      if (opts?.ifVersion !== undefined && opts.ifVersion !== cur) {
        throw new RealHttpError(409, '版本冲突', {
          error: { code: 'conflict', message: '版本冲突' },
          current: cur,
        });
      }
      S.mem.set(k, v);
      const next = Math.max(Date.now(), cur + 1);
      S.mem.set(`${k}_version`, String(next));
      return { code: 0, data: { ok: true, version: next } };
    }),
  };
});
vi.mock('../../src/components/base/storage/kvStore.ts', () => ({
  CANVAS_STATE_PREFIX: 'canvas-state-v1-',
}));

const CANVAS_KEY = 'canvas-state-v1-default';
const VERSION_KEY = `${CANVAS_KEY}_version`;
const node = (id: string) => ({ id, type: 'textGenerateNode', data: {}, position: {} });

// 每例前重置内存态 + 清存储，再清掉上例可能残留的 debounce 定时器（300ms 落盘节流）。
// 残留定时器会在 localStorage.clear() 之后把旧 projects 写回存储，导致下例读到脏数据。
beforeEach(() => {
  H.mem.clear();
  H.kvSetCalls.length = 0;
  H.ops.length = 0;
  H.versionQueue.length = 0;
  H.kvSetOverride = null;
  localStorage.clear();
  H.fetchProjectsPayload.projects = [];
  H.fetchProjectsPayload.lastOpened = '';
  __resetForTest();
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('项目系统 §2.8', () => {
  it('initProjects lastOpened 命中时切到该项目（B0·缺口⑪）', async () => {
    H.fetchProjectsPayload.projects = [
      { id: 'p1', name: 'P1' },
      { id: 'p2', name: 'P2' },
    ];
    H.fetchProjectsPayload.lastOpened = 'p2';
    initProjects();
    // initProjects 是同步触发 fetch，微任务后生效
    await flushAsync();
    expect(getCurrentProject().id).toBe('p2');
  });

  it('initProjects lastOpened 不存在时回退到 list[0]（B0·缺口⑪）', async () => {
    H.fetchProjectsPayload.projects = [
      { id: 'p1', name: 'P1' },
      { id: 'p2', name: 'P2' },
    ];
    H.fetchProjectsPayload.lastOpened = 'ghost-not-exist';
    initProjects();
    await flushAsync();
    expect(getCurrentProject().id).toBe('p1');
  });

  it('initProjects 空列表时不做替换（保持 default 兜底）（B0·缺口⑪）', async () => {
    H.fetchProjectsPayload.projects = [];
    initProjects();
    await flushAsync();
    expect(getCurrentProject().id).toBe('default');
  });

  it('initProjects 后端缺本地独有项目 → 合并保留本地（防刷新丢项目）', async () => {
    // 模拟「上一会话新建了项目X」：先 createProject 让内存 projects 含 X（含 persist 到 localStorage 兜底）
    const x = createProject('新建项目X');
    // 后端因 saveProjects 失败/双页面覆盖缺失 X（只返回 default）
    H.fetchProjectsPayload.projects = [{ id: 'default', name: '默认项目' }];
    initProjects();
    await flushAsync();
    // X 不能被后端缺项冲掉
    expect(switchProject(x.id).name).toBe('新建项目X');
  });

  it('initProjects 后端有新项目（本地旧列表）→ 合并保留后端独有', async () => {
    localStorage.setItem('projects', JSON.stringify([{ id: 'default', name: '默认项目' }]));
    H.fetchProjectsPayload.projects = [
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
        type: 'textGenerateNode',
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
    const nodes = [{ id: 'n1', type: 'textGenerateNode', data: {}, position: { x: 0, y: 0 } }];
    const r = await saveCanvasState('default', nodes, [], { x: 120, y: -50, zoom: 1.5 });
    expect(r.success).toBe(true);
    const loaded = await loadCanvasState('default');
    expect(loaded.viewport).toEqual({ x: 120, y: -50, zoom: 1.5 });
  });

  it('saveCanvasState 不传 viewport → 快照无 viewport 字段，loadCanvasState 返回 null（P20 兼容旧快照）', async () => {
    const nodes = [{ id: 'n1', type: 'textGenerateNode', data: {}, position: { x: 0, y: 0 } }];
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
      type: 'assetNode',
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
});

// ════════════════════════════════════════════════════════════════════════
// docs/118 §五 C1/C2：服务端原子 CAS（客户端不再自算版本）
// ════════════════════════════════════════════════════════════════════════
describe('projectStore · 画布快照 CAS（docs/118 §6.1 A）', () => {
  it('A1 首次保存传 ifVersion = loadedVersion（CAS 基线）；成功后 loadedVersion 前进', async () => {
    expect(getLoadedVersion()).toBe(0);
    await saveCanvasState('default', [node('n1')], []);
    const first = H.kvSetCalls.at(-1);
    expect(first.key).toBe(CANVAS_KEY);
    expect(first.ifVersion).toBe(0);

    const v1 = getLoadedVersion();
    expect(v1).toBeGreaterThan(0);
    // 第二次保存：基线已是服务端返回的新版本
    await saveCanvasState('default', [node('n2')], []);
    expect(H.kvSetCalls.at(-1).ifVersion).toBe(v1);
    expect(getLoadedVersion()).toBeGreaterThan(v1);
  });

  it('A2 服务端 409 → 返回 conflict 且不重试、不覆盖（一次请求，旧值原地不动）', async () => {
    await saveCanvasState('default', [node('n1')], []);
    const callsBefore = H.kvSetCalls.length;
    const baseline = getLoadedVersion();

    // 模拟「另一窗口先写了」：远端版本被推进
    const remote = baseline + 1000;
    H.mem.set(VERSION_KEY, String(remote));

    const r = await saveCanvasState('default', [node('n2')], []);
    expect(r.success).toBe(false);
    expect(r.skipped).toBe(true);
    expect(r.conflict).toBe(true);
    expect(r.conflictVersion).toBe(remote);
    // 不再发第二次请求（fail-closed：不重写、不重试）
    expect(H.kvSetCalls.length).toBe(callsBefore + 1);
    // value 未被改写（快照内容仍是第一次写入的 n1）
    const snap = H.mem.get(CANVAS_KEY) as any;
    expect(snap.nodes[0].id).toBe('n1');
    // 冲突不推进本地基线（否则下次会拿别人的版本当自己的基线 → 静默覆盖）
    expect(getLoadedVersion()).toBe(baseline);
  });

  it('A3 force:true（备份导入）→ 不传 ifVersion（无条件覆盖）', async () => {
    await saveCanvasState('default', [node('n1')], [], undefined, { force: true });
    expect(H.kvSetCalls.at(-1).ifVersion).toBeUndefined();
  });

  it('A4 并发两次 → 串行（第二次在第一次 resolve 之后才发起，非时序赌运气）', async () => {
    // 可控闸门：第一次 kvSet 挂在 gate 上；若实现是并发，第二次会立刻被发起 → 断言立刻失败
    let releaseFirst!: () => void;
    const gate = new Promise<void>((r) => {
      releaseFirst = r;
    });
    let call = 0;
    H.kvSetOverride = async (k, v, opts) => {
      call += 1;
      if (call === 1) await gate;
      const cur = Number(H.mem.get(`${k}_version`)) || 0;
      if (opts?.ifVersion !== undefined && opts.ifVersion !== cur) {
        throw new HttpError(409, '版本冲突', { current: cur });
      }
      H.mem.set(k, v);
      const next = Math.max(Date.now(), cur + 1);
      H.mem.set(`${k}_version`, String(next));
      return { code: 0, data: { ok: true, version: next } };
    };

    const p1 = saveCanvasState('default', [node('n1')], []);
    const p2 = saveCanvasState('default', [node('n2')], []);

    // 给足微任务/宏任务机会：第一次仍挂起，第二次【必须还没被发起】
    await new Promise((r) => setTimeout(r, 20));
    expect(H.kvSetCalls.length).toBe(1);

    releaseFirst();
    const [r1, r2] = await Promise.all([p1, p2]);
    expect(H.kvSetCalls.length).toBe(2);
    expect(r1.success).toBe(true);
    expect(r2.success).toBe(true);
  });

  it('A5 loadCanvasState 三段读「版本 → 快照 → 版本」，loadedVersion 取最后 v2', async () => {
    await saveCanvasState('default', [node('n1')], []);
    const serverV = getLoadedVersion();

    H.ops.length = 0;
    const loaded = await loadCanvasState('default');
    expect(loaded?.nodes).toHaveLength(1);
    expect(H.ops).toEqual([
      `version:${CANVAS_KEY}`,
      `snapshot:${CANVAS_KEY}`,
      `version:${CANVAS_KEY}`,
    ]);
    expect(getLoadedVersion()).toBe(serverV);
  });

  it('A6 loadCanvasState 读期间版本变化（v1≠v2）→ 重读，loadedVersion 取最新', async () => {
    await saveCanvasState('default', [node('n1')], []);
    const serverV = getLoadedVersion();

    // 第 1 次 v1=serverV；此后 v2=serverV+1（模拟读期间别人写入）→ 触发重读
    H.versionQueue = [serverV, serverV + 1, serverV + 1];
    H.ops.length = 0;

    const loaded = await loadCanvasState('default');
    expect(loaded?.nodes).toHaveLength(1);
    expect(H.ops.filter((o) => o.startsWith('version:')).length).toBe(3); // 三次版本读 = 重读一次
    expect(getLoadedVersion()).toBe(serverV + 1);
  });
});
