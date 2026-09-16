// @vitest-environment node
/**
 * backupStore 单测（批 1-1）。
 * 覆盖：LS_KEYS 清单读/写、conversationKeys 动态键、exportAll 打包、importAll 回写、
 * backupToBlob 序列化、当前项目回退、空输入防护。
 * 策略：storageAdapter 走真实内存 localStorage（setup.mjs 提供），projectStore 用内存 stub。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  contentGet,
  contentSet,
  contentClearCache,
} from '../../src/components/base/core/contentStore.ts';

// ── stub projectStore：内存画布快照 + 当前项目 + 项目列表（内存真相）──
const canvasStore = new Map();
/** 当前项目「内存真相」（TD-02-4 后 backupStore 委托 getCurrentProject，不再从存储重推导） */
let currentProject: { id: string; name?: string } = { id: 'default', name: '默认项目' };
/** 项目列表「内存真相」（TD-15-2 后 exportAll 枚举项目取此，不再只读 localStorage 副本） */
let memoryProjects: { id: string; name?: string }[] = [];
vi.mock('../../src/components/base/store/projectStore.ts', () => ({
  loadCanvasState: vi.fn(async (id) => canvasStore.get(id) || null),
  saveCanvasState: vi.fn(async (id, nodes, edges) => {
    canvasStore.set(id, { nodes, edges });
    return { ok: true };
  }),
  getCurrentProject: vi.fn(() => currentProject),
  getAllProjects: vi.fn(() => memoryProjects),
}));

// ── 账号/会话 KV stub：exportAll 经 contentGetAsync('yimao_accounts')/会话键走 KV。
// 会话键已迁 KV（backend:'kv'），为让「动态收集 AI 会话键」用例确定性往返，用 Map 兜底 kvGet/kvSet；
// 不 stub 网络会走真实 localToolApi → 失败降级 + 误导性告警，故统一置 Map 存储（账号初始为空不打包）。
const kvStore = new Map();
vi.mock('../../src/components/base/api/localToolApi.ts', async (importOriginal) => ({
  ...(await importOriginal()),
  kvGet: vi.fn(async (key) => (kvStore.has(key) ? kvStore.get(key) : null)),
  kvSet: vi.fn(async (key, value) => {
    kvStore.set(key, value);
    return { ok: true };
  }),
  kvDelete: vi.fn(async (key) => {
    kvStore.delete(key);
    return { ok: true };
  }),
  // 【TD-02-30】KV 键枚举：按后端真实口径桩 —— 后端已过滤 CAS 内部元数据 `<key>_version`，
  // 故这里也只返回用户数据键（前端不重复实现该过滤，判据归后端）。
  kvKeys: vi.fn(async () => [...kvStore.keys()].filter((k) => !k.endsWith('_version'))),
}));

const { exportAll, importAll, backupToBlob } =
  await import('@/components/base/store/backupStore.ts');
const { getCurrentProject } = await import('@/components/base/store/projectStore.ts');

beforeEach(() => {
  localStorage.clear();
  canvasStore.clear();
  kvStore.clear();
  contentClearCache();
  currentProject = { id: 'default', name: '默认项目' };
  memoryProjects = [];
});

describe('backupStore — 导出 exportAll', () => {
  it('收集 LS_KEYS 清单里存在的值并打包', async () => {
    contentSet('projects', [{ id: 'p1', name: 'P1' }]);
    contentSet('app_settings', { theme: 'dark' });
    contentSet('yimao_node_prefs', { textGenerateNode: { model: 'x' } });
    canvasStore.set('p1', { nodes: [{ id: 'n1' }], edges: [] });

    const backup = await exportAll();
    expect(backup.version).toBe(3);
    expect(backup.type).toBe('yimao-backup');
    expect(backup.ls.projects).toEqual([{ id: 'p1', name: 'P1' }]);
    expect(backup.ls.app_settings).toEqual({ theme: 'dark' });
    expect(backup.ls.yimao_node_prefs).toEqual({ textGenerateNode: { model: 'x' } });
    expect(backup.canvas.p1).toEqual({ nodes: [{ id: 'n1' }], edges: [] });
    expect(typeof backup.exportedAt).toBe('string');
  });

  it('无项目的兜底：当前项目 id 回退为 default 且不抛错', async () => {
    const backup = await exportAll();
    expect(backup.ls).toBeDefined();
    // default 项目无快照 → canvas 为空对象
    expect(backup.canvas).toEqual({});
  });

  it('当前项目委托 projectStore 内存真相（不再从存储重推导，TD-02-4）', async () => {
    // 存储里只有 p1、lastOpenedProject 也指向 p1；但内存真相是 p2（模拟 300ms 防抖窗口内刚切换）。
    // 旧实现（读 projects + lastOpenedProject 重推导）只会遍历 p1 → 漏导出 p2 的画布。
    contentSet('projects', [{ id: 'p1' }]);
    contentSet('lastOpenedProject', 'p1');
    currentProject = { id: 'p2', name: '内存真相' };
    canvasStore.set('p2', { nodes: [{ id: 'n2' }], edges: [] });

    const backup = await exportAll();

    expect(getCurrentProject).toHaveBeenCalled();
    expect(Object.keys(backup.canvas)).toEqual(['p2']);
    expect(backup.canvas.p2).toEqual({ nodes: [{ id: 'n2' }], edges: [] });
  });

  it('项目枚举以 projectStore 内存真相为准（防抖窗内新建项目不漏备，TD-15-2）', async () => {
    // 存储副本只有 p1；内存真相多出 p2（模拟 300ms 防抖窗内刚新建项目）
    contentSet('projects', [{ id: 'p1', name: 'P1' }]);
    memoryProjects = [
      { id: 'p1', name: 'P1' },
      { id: 'p2', name: '新项目' },
    ];
    canvasStore.set('p2', { nodes: [{ id: 'n2' }], edges: [] });

    const backup = await exportAll();

    // p2 的画布被导出（旧实现只读 ls.projects 副本 → 漏 p2）
    expect(backup.canvas).toEqual({ p2: { nodes: [{ id: 'n2' }], edges: [] } });
    // 备份包内项目列表同时补上 p2（枚举与列表同源，导入后自洽）
    expect(backup.ls.projects).toEqual([
      { id: 'p1', name: 'P1' },
      { id: 'p2', name: '新项目' },
    ]);
  });

  it('AI 会话键（KV 后端）经 kv 段落入备份（v3 起不再靠手写枚举塞进 ls 段）', async () => {
    contentSet('projects', [{ id: 'p1' }, { id: 'p2' }]);
    contentSet('agent_conversations_canvas-assistant-p1', { messages: [] });
    contentSet('agent_active_conversation_id_canvas-assistant-p1', 'c1');
    const backup = await exportAll();
    expect(backup.kv['agent_conversations_canvas-assistant-p1']).toEqual({ messages: [] });
    expect(backup.kv['agent_active_conversation_id_canvas-assistant-p1']).toBe('c1');
    // p2 没有会话键 → 不出现（kv 段按"实际存在的键"派生，不靠项目列表枚举）
    expect(backup.kv['agent_conversations_canvas-assistant-p2']).toBeUndefined();
    // 同一键不得同时在 ls 段出现（禁"一物两段"）
    expect(backup.ls['agent_conversations_canvas-assistant-p1']).toBeUndefined();
  });

  it('【TD-02-30】KV 工程数据（剪辑 / 3D 工程）经 kv 段进备份 —— 修复前换机导入后全丢', async () => {
    contentSet('projects', [{ id: 'p1' }]);
    // 剪辑工程三键 + 3D 工程两键：均已登记 backend:'kv'，但修复前 exportAll 完全不收
    kvStore.set('video_editor_projects_p1', [{ id: 'e1', name: '片子' }]);
    kvStore.set('video_editor_active_project_p1', 'e1');
    kvStore.set('video_editor_project_p1_e1', { id: 'e1', tracks: [] });
    kvStore.set('director3d-project', { scene: 1 });
    kvStore.set('director3d-project-node9', { scene: 2 });

    const backup = await exportAll();

    expect(backup.kv.video_editor_projects_p1).toEqual([{ id: 'e1', name: '片子' }]);
    expect(backup.kv.video_editor_active_project_p1).toBe('e1');
    expect(backup.kv.video_editor_project_p1_e1).toEqual({ id: 'e1', tracks: [] });
    expect(backup.kv['director3d-project']).toEqual({ scene: 1 });
    expect(backup.kv['director3d-project-node9']).toEqual({ scene: 2 });
  });

  it('kv 段只收"登记表里的 KV 键"，且不与 canvas / accounts 段重复（一物一段）', async () => {
    contentSet('projects', [{ id: 'p1' }]);
    canvasStore.set('p1', { nodes: [{ id: 'n1' }], edges: [] });
    // 后端 KV 里同时存在：画布键 / 账号键 / 未登记键（如缓存键）
    kvStore.set('canvas-state-v1-p1', { nodes: [{ id: 'n1' }], edges: [] });
    kvStore.set('yimao_accounts', [{ id: 'a1' }]);
    kvStore.set('img_cache_deadbeef', 'x');

    const backup = await exportAll();

    expect(backup.canvas.p1).toEqual({ nodes: [{ id: 'n1' }], edges: [] });
    expect(backup.accounts).toEqual([{ id: 'a1' }]);
    expect(backup.kv['canvas-state-v1-p1']).toBeUndefined(); // 画布走 canvas 段（保 sanitize 写路径）
    expect(backup.kv['yimao_accounts']).toBeUndefined(); // 账号走 accounts 段
    expect(backup.kv['img_cache_deadbeef']).toBeUndefined(); // 未登记 → 不是用户数据
  });

  it('exportAll 包含 KV 账号环境（非空才入包；账号为 KV 后端，不进 ls 清单）', async () => {
    // 账号经 KV 单独走 out.accounts（不是 LS_KEYS 里的键）。
    // 【由 backupCloudClipboard.test.ts 合并而来】该文件曾重复覆盖 clipboard/backupStore/cloudSync 三处，
    // 删除整文件时把这条「云同步独有」的用例保留在此。
    kvStore.set('yimao_accounts', [{ id: 'acc1', name: '环境1' }]);
    const backup = await exportAll();
    expect(backup.accounts).toEqual([{ id: 'acc1', name: '环境1' }]);
    expect(backup.ls.yimao_accounts).toBeUndefined(); // KV 后端键不进 ls
  });

  it('备份清单由 contracts.ts getLocalKeys() 统一生成，新增登记键自动进备份（无手写清单漂移）', async () => {
    // 这些新登记键此前未进手写 LS_KEYS，收口后必须自动进备份
    contentSet('agent_panel_width', '320');
    contentSet('agent_input_mode', 'agent');
    contentSet('canvasAgentGenParams', { model: 'x', ratio: '1:1' });
    const backup = await exportAll();
    expect(backup.ls.agent_panel_width).toBe('320');
    expect(backup.ls.agent_input_mode).toBe('agent');
    expect(backup.ls.canvasAgentGenParams).toEqual({ model: 'x', ratio: '1:1' });
  });
});

describe('backupStore — 导入 importAll', () => {
  it('写回 ls 全部键 + 画布快照，返回计数', async () => {
    const backup = {
      version: 2,
      type: 'yimao-backup',
      ls: { app_settings: { theme: 'light' }, projects: [{ id: 'pa' }] },
      canvas: { pa: { nodes: [{ id: 'x' }], edges: [{ id: 'e' }] } },
    };
    const res = await importAll(backup);
    expect(res.ok).toBe(true);
    expect(res.ls).toBe(2);
    expect(res.canvas).toBe(1);
    expect(res.failed).toEqual([]); // TD-15-3：无失败项
    expect(contentGet('app_settings')).toEqual({ theme: 'light' });
    expect(canvasStore.get('pa')).toEqual({ nodes: [{ id: 'x' }], edges: [{ id: 'e' }] });
  });

  it('空 ls/canvas 时计数归零但不报错', async () => {
    const res = await importAll({ ls: {}, canvas: {} });
    expect(res.ok).toBe(true);
    expect(res.ls).toBe(0);
    expect(res.canvas).toBe(0);
  });

  it('无效备份（非对象）直接失败', async () => {
    const res = await importAll(null);
    expect(res.ok).toBe(false);
    expect(res.error).toContain('无效');
    expect(res.ls).toBe(0);
  });

  // ── 【TD-15-3】格式/版本守卫 + 诚实失败（先红后绿：改前恒返 ok:true / 无守卫）──
  it('拒绝非 yimao 备份（type 不符）且不写入任何数据', async () => {
    const res = await importAll({ type: 'other-backup', ls: { app_settings: { theme: 'x' } } });
    expect(res.ok).toBe(false);
    expect(res.error).toContain('不是 yimao');
    expect(contentGet('app_settings')).toBeUndefined(); // 预检拒绝 → 未写入
  });

  it('拒绝高于当前支持的备份版本（防新版数据被旧版静默错读）', async () => {
    const res = await importAll({ type: 'yimao-backup', version: 99, ls: {} });
    expect(res.ok).toBe(false);
    expect(res.error).toContain('高于当前支持');
  });

  it('缺 type/version 的旧包放行（宽松向后兼容，不误拒合法数据）', async () => {
    const res = await importAll({ ls: {}, canvas: {} });
    expect(res.ok).toBe(true);
  });

  it('单个画布写失败 → 不再假成功：ok=false + failed 列明（TD-15-3）', async () => {
    const { saveCanvasState } = await import('../../src/components/base/store/projectStore.ts');
    vi.mocked(saveCanvasState).mockImplementationOnce(async () => {
      throw new Error('磁盘满');
    });
    const res = await importAll({
      type: 'yimao-backup',
      version: 2,
      ls: {},
      canvas: { bad: { nodes: [], edges: [] } },
    });
    expect(res.ok).toBe(false);
    expect(res.failed).toEqual([{ projectId: 'bad', error: '磁盘满' }]);
    expect(res.error).toContain('1 项导入失败');
  });

  it('canvas 快照 saveCanvasState 返回 skipped 时不计入 canvas 计数', async () => {
    const { saveCanvasState } = await import('../../src/components/base/store/projectStore.ts');
    vi.mocked(saveCanvasState).mockImplementationOnce(async () => ({
      success: false,
      skipped: true,
    }));
    const res = await importAll({ ls: {}, canvas: { skip1: { nodes: [], edges: [] } } });
    expect(res.canvas).toBe(0);
  });

  it('【TD-02-30】回写 kv 段工程键（剪辑 / 3D）并计入 kv 计数', async () => {
    const res = await importAll({
      type: 'yimao-backup',
      version: 3,
      ls: {},
      canvas: {},
      kv: {
        video_editor_project_p1_e1: { id: 'e1', tracks: [] },
        'director3d-project': { scene: 1 },
      },
    });
    expect(res.ok).toBe(true);
    expect(res.kv).toBe(2);
    expect(kvStore.get('video_editor_project_p1_e1')).toEqual({ id: 'e1', tracks: [] });
    expect(kvStore.get('director3d-project')).toEqual({ scene: 1 });
    expect(res.failed).toEqual([]);
  });

  it('kv 段里混入 canvas-/accounts 键时按同一判据挡掉（不绕过 canvas 写路径、不与 accounts 重复写）', async () => {
    const res = await importAll({
      type: 'yimao-backup',
      version: 3,
      ls: {},
      canvas: {},
      kv: {
        'canvas-state-v1-p1': { nodes: [{ id: 'n1' }], edges: [] }, // 应由 canvas 段承载
        yimao_accounts: [{ id: 'a1' }], // 应由 accounts 段承载
        'director3d-project': { scene: 1 }, // 合法 kv 段键
      },
    });
    expect(res.kv).toBe(1);
    expect(kvStore.get('canvas-state-v1-p1')).toBeUndefined();
    expect(kvStore.get('yimao_accounts')).toBeUndefined();
    expect(kvStore.get('director3d-project')).toEqual({ scene: 1 });
  });

  it('旧包（无 kv 段 / version 2）仍可导入 —— 向后兼容，不因新增段而拒收', async () => {
    const res = await importAll({
      version: 2,
      type: 'yimao-backup',
      ls: { app_settings: { theme: 'dark' } },
      canvas: {},
      accounts: [{ id: 'acc1' }],
    });
    expect(res.ok).toBe(true);
    expect(res.kv).toBe(0);
    expect(res.ls).toBe(2); // app_settings + accounts
    expect(kvStore.get('yimao_accounts')).toEqual([{ id: 'acc1' }]);
  });
});

describe('backupStore — backupToBlob', () => {
  it('产出 JSON 序列化的 Blob', () => {
    const backup = { version: 2, type: 'yimao-backup', ls: { a: 1 }, canvas: {} };
    const blob = backupToBlob(backup);
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe('application/json');
  });
});
