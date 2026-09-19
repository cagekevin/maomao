// @vitest-environment jsdom
/**
 * useScriptBoxEngine 单测（批 3）。
 * 覆盖引擎回调注入 hook：
 *   - 挂载后把引擎回调写回 node.data.onXxx（经 setNodes 注入）
 *   - getData 实时从 getNodes 读最新 data
 *   - updateData 经 setNodes 不可变合并
 *   - getProviderState 读 providersRef（避免闭包过期）
 *   - addNodes 经 screenToFlowPosition 偏移落点
 * 通过 vi.mock 隔离 @xyflow/react / scriptBoxEngine / settings/providerStore。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { ScriptBoxEngineDeps } from '../../src/components/scriptbox/scriptBoxEngine.ts';
import { publish } from '../../src/components/base/core/event/eventBus.ts';

const setNodes = vi.fn();
const getNodes = vi.fn((): Array<{ id: string; data: Record<string, unknown> }> => [
  { id: 'sb1', data: { shots: [] } },
]);
const getNode = vi.fn((nid) => getNodes().find((n) => n.id === nid));
const setEdges = vi.fn();
const addNodes = vi.fn();
const screenToFlowPosition = vi.fn(() => ({ x: 5, y: 7 }));

vi.mock('@xyflow/react', () => ({
  useReactFlow: () => ({ getNodes, getNode, setNodes, setEdges, addNodes, screenToFlowPosition }),
}));

const engineCallbacks = {
  onGenerateScript: vi.fn(),
  onGenerateShotImage: vi.fn(),
  onGenerateShotPrompts: vi.fn(),
};
const createScriptBoxEngine = vi.fn((cfg: ScriptBoxEngineDeps) => ({
  ...engineCallbacks,
  __cfg: cfg,
}));
// 工厂用 Parameters<> 精确透传：既无 as any，又保留 mock.calls[0][0] 的精确类型
vi.mock('../../src/components/scriptbox/scriptBoxEngine.ts', async (importOriginal) => ({
  ...((await importOriginal()) as Record<string, unknown>),
  createScriptBoxEngine: (...a: Parameters<typeof createScriptBoxEngine>) =>
    createScriptBoxEngine(...a),
}));

// 节点参数记忆（yimao_node_prefs）落点：nodePrefs 经 contentStore 读写，这里用内存态替代，
// 只让 key 命中 'yimao_node_prefs' 时返回，避免牵动 contentStore 的真实注册/后端逻辑。
let prefsStore = {};
// 展开真模块再覆盖（TD-17-15：模块**新增导出**时桩不再脱钩 —— 判据见 tests/unit/mockPartialSpread.test.ts）
/**
 * contentStore 桩：只覆盖本套件要控的 `yimao_node_prefs`，其余从真模块派生。
 *
 * ⚠️ **`contentSet` 必须如实返回 `PersistWriteOutcome`（形如 `{ok,landed}`），不能返 `undefined`**
 *   —— 它被 `projectStore.loadProjects()` 顶层的 `confirmPersist(contentSet(...))` 消费，
 *   返回 `undefined` ⇒ `confirmPersist` 读 `outcome.ok` 抛 `TypeError` ⇒ **整套件崩**。
 *   这正是 TD-17-15 暴露的第二类缺陷：**桩违反了自己的契约**（假成功/假值），
 *   而旧的"手写桩只声明被用到的导出"恰好把这条链挡住了、让人看不见。
 */
vi.mock('../../src/components/base/core/contentStore.ts', async (importOriginal) => ({
  ...((await importOriginal()) as Record<string, unknown>),
  contentGet: (k: any) => (k === 'yimao_node_prefs' ? prefsStore : null),
  contentSet: (k: any, v: any) => {
    if (k === 'yimao_node_prefs') prefsStore = v;
    return { ok: true, landed: 'local' }; // 契约：PersistWriteOutcome（见 contentStore.ts）
  },
}));

const loadProviders = vi.fn(() => Promise.resolve());
const useProvidersList = vi.fn(() => [{ id: 'p1', isPrimary: true }]);
// 素材库落盘通道：本测试只验「recover 时补归类被触发/未触发」，隔离真实落盘与网络。
// 不 mock 会拉起 resourceStore→projectStore 的真实顶层链（测试环境未构造）。
const localizeMock = vi.fn(() => Promise.resolve('/files/migrated/人物/a1.png'));
vi.mock('../../src/components/resource/resourceStore.ts', async (importOriginal) => ({
  ...((await importOriginal()) as Record<string, unknown>),
  localizeAndStoreToResourceLibrary: (...a: Parameters<typeof localizeMock>) => localizeMock(...a),
  resourceFolderOf: (category: string) =>
    ({ character: 'migrated/人物', scene: 'migrated/场景', prop: 'migrated/道具' })[category] ||
    'migrated/其他',
}));
// 展开真模块再覆盖（TD-17-15：模块**新增导出**时桩不再脱钩 —— 判据见 tests/unit/mockPartialSpread.test.ts）
vi.mock('../../src/components/settings/providerStore.ts', async (importOriginal) => ({
  ...((await importOriginal()) as Record<string, unknown>),
  useProvidersList: (...a: Parameters<typeof useProvidersList>) => useProvidersList(...a),
  load: (...a: Parameters<typeof loadProviders>) => loadProviders(...a),
  // 【2026-09-17 桩跟契约走】供应商加载已收口到 store 的单 hook（TD-24-4 §二）：
  // 本测试关注的是"拿到 providers 之后"的解析行为，加载动作在 hook 内，这里置空。
  useEnsureProvidersLoaded: () => {},
}));

const { useScriptBoxEngine } = await import('../../src/components/scriptbox/useScriptBoxEngine.ts');

beforeEach(() => {
  setNodes.mockClear();
  getNodes.mockClear();
  getNode.mockClear();
  addNodes.mockClear();
  createScriptBoxEngine.mockClear();
  loadProviders.mockClear();
  useProvidersList.mockReturnValue([{ id: 'p1', isPrimary: true }]);
  prefsStore = {};
});

describe('useScriptBoxEngine', () => {
  /**
   * 【TD-09-4 · 2026-09-16 契约已改，本用例随之重写】
   * 原用例锁的是「挂载后把引擎回调注入 node.data.onXxx」（靠 useEffect + patchNodeDataById 重注入）。
   * 该设计**已撤销**：node.data 经 `canvasSnapshotSchema.NODE_KEEP` 整包 `JSON.stringify` 落盘，
   * 函数在序列化时**静默丢弃** —— 持久化类型声明函数字段属类型不诚实，重注入只是在掩盖「每次落盘都在丢」。
   * 现契约：回调经 hook **返回值** `callbacks` 下发（React 通道），data 里**不再有函数**。
   * 故断言改为：① 返回值带完整回调集合；② setNodes 的**所有调用都不含函数值**（落盘不再丢函数）。
   */
  it('回调经返回值下发（data 里不再有函数 —— 落盘不再静默丢回调）', () => {
    const { result } = renderHook(() => useScriptBoxEngine('sb1', { shots: [] }));
    // 本文件的 createScriptBoxEngine 被 mock 成返回 engineCallbacks（见顶部 mock），
    // 故断言「hook 把引擎实例原样作为 callbacks 下发」= 三个 mock 回调都在返回值上。
    const callbacks = result.current.callbacks;
    expect(callbacks.onGenerateScript).toBeTypeOf('function');
    expect(callbacks.onGenerateShotImage).toBeTypeOf('function');
    expect(callbacks.onGenerateShotPrompts).toBeTypeOf('function');
    expect(callbacks).toBe(createScriptBoxEngine.mock.results.at(-1)!.value);
  });

  it('挂载后不向 node.data 注入任何函数（撤销重注入后必须零写入）', () => {
    renderHook(() => useScriptBoxEngine('sb1', { shots: [] }));
    // 挂载期 setNodes 不该被调（旧实现会调一次写 15 个函数字段）
    for (const [updater] of setNodes.mock.calls) {
      if (typeof updater !== 'function') continue;
      const out = updater([{ id: 'sb1', data: {} }])[0] as { data: Record<string, unknown> };
      const fnKeys = Object.entries(out.data || {}).filter(([, v]) => typeof v === 'function');
      expect(fnKeys.map(([k]) => k)).toEqual([]);
    }
  });

  it('createScriptBoxEngine 用最新 data（getData 读 getNodes）', () => {
    renderHook(() => useScriptBoxEngine('sb1', { shots: [] }));
    const cfg = createScriptBoxEngine.mock.calls[0][0]!;
    expect((cfg.getData as unknown as () => unknown)()).toMatchObject({ shots: [] });
    expect(cfg.getProviderState?.()).toEqual({
      providers: [{ id: 'p1', isPrimary: true }],
      primary: { id: 'p1', isPrimary: true },
    });
  });

  it('updateData 经 setNodes 不可变合并（对象 patch）', () => {
    renderHook(() => useScriptBoxEngine('sb1', { shots: [] }));
    const cfg = createScriptBoxEngine.mock.calls[0][0]!;
    // updateData 内部直接调 setNodes(updater)；这里验证其注入的 updater 正确合并
    // 注入回调的 useEffect 先触发，updateData 后触发，故取最后一个 function 调用
    cfg.updateData({ title: '新剧本' });
    const calls = setNodes.mock.calls.filter((c) => typeof c[0] === 'function');
    expect(calls.length).toBeGreaterThan(0);
    const call = calls[calls.length - 1];
    const out = call[0]([{ id: 'sb1', data: { shots: [], a: 1 } }])[0];
    expect(out.data).toEqual({ shots: [], a: 1, title: '新剧本' });
  });

  it('updateData 支持函数式 patch（并发安全，基于 latest 合并）', () => {
    renderHook(() => useScriptBoxEngine('sb1', { shots: [] }));
    const cfg = createScriptBoxEngine.mock.calls[0][0]!;
    cfg.updateData((latest) => ({ title: `${latest.title}＋更新` }));
    const calls = setNodes.mock.calls.filter((c) => typeof c[0] === 'function');
    const call = calls[calls.length - 1];
    const out = call[0]([{ id: 'sb1', data: { title: '旧', a: 1 } }])[0];
    expect(out.data).toEqual({ title: '旧＋更新', a: 1 });
  });

  it('hook 返回 { updateData } 且稳定（跨 render 引用一致，供 ScriptBoxNode 复用）', () => {
    const { result, rerender } = renderHook(() => useScriptBoxEngine('sb1', { shots: [] }));
    expect(result.current.updateData).toBeTypeOf('function');
    const first = result.current.updateData;
    rerender({ shots: [1] });
    expect(result.current.updateData).toBe(first);
  });

  /** TD-04-2：addNodes 经 commitNewNodes → setNodes 函数式追加；取最后一次 updater 应用到 mock 现状，返回新节点 */
  function lastAddedNode() {
    const updater = setNodes.mock.calls.at(-1)?.[0];
    expect(typeof updater).toBe('function');
    const next = updater(getNodes());
    // 新节点是 concat 到末尾的那个（id 以 'x' 为准）
    return next.find((n: any) => n.id === 'x');
  }

  it('addNodes 经 screenToFlowPosition 偏移落点', () => {
    renderHook(() => useScriptBoxEngine('sb1', { shots: [] }));
    const cfg = createScriptBoxEngine.mock.calls[0][0]!;
    // base = screenToFlowPosition({x:0,y:0}) = {x:5,y:7}；偏移 x + base.x + 100, y + base.y
    cfg.addNodes!([{ id: 'x', position: { x: 10, y: 20 } }]);
    const out = lastAddedNode();
    expect(out.data).toEqual({});
    expect(out.position).toEqual({ x: 115, y: 27 });
  });

  it('addNodes 注入节点模型记忆（复用 App.addNode 的新建口径）', () => {
    prefsStore = { imageGenerateNode: { model: 'p1::gpt-image-1' } };
    renderHook(() => useScriptBoxEngine('sb1', { shots: [] }));
    const cfg = createScriptBoxEngine.mock.calls[0][0]!;
    // 剧本盒已预填 aspectRatio → 不被记忆覆盖；selectedModel 缺失 → 由记忆补上
    cfg.addNodes!([
      {
        id: 'x',
        type: 'imageGenerateNode',
        position: { x: 10, y: 20 },
        data: { prompt: 'p', aspectRatio: '16:9' },
      },
    ]);
    const out = lastAddedNode();
    expect(out.data.selectedModel).toBe('p1::gpt-image-1');
    expect(out.data.aspectRatio).toBe('16:9');
    expect(out.data.prompt).toBe('p');
  });

  it('addNodes 无记忆时不写空模型（留给节点兜底自动选第一个）', () => {
    renderHook(() => useScriptBoxEngine('sb1', { shots: [] }));
    const cfg = createScriptBoxEngine.mock.calls[0][0]!;
    cfg.addNodes!([
      { id: 'x', type: 'videoGenerateNode', position: { x: 0, y: 0 }, data: { prompt: 'v' } },
    ]);
    const out = lastAddedNode();
    // 记忆为空 → 注入默认 ''，与系统新建一致；节点侧 useGenerateNode 的兜底仍会生效
    expect(out.data.selectedModel).toBe('');
    expect(out.data.prompt).toBe('v');
  });

  // ── 【TD-01-9】剧本盒资产图「生成中刷新」回填（先红后绿：改前无订阅 → 不回填）──
  /** 取最后一次 updateData 的更新结果（应用到给定 data） */
  function applyLatestUpdater(data: Record<string, unknown>) {
    const calls = setNodes.mock.calls.filter((c) => typeof c[0] === 'function');
    const call = calls[calls.length - 1];
    return call[0]([{ id: 'sb1', data }])[0].data;
  }

  it('收到「本剧本盒资产任务」完成广播 → 反解回填 assets + 补归类进素材库（TD-01-13 边界）', () => {
    // 让「最新 data」含该资产及其分类（补归类要读 category → folder）
    getNodes.mockReturnValue([
      {
        id: 'sb1',
        data: {
          shots: [],
          assets: [{ id: 'a1', category: 'character', name: '角色1', assetUrl: '' }],
        },
      },
    ]);
    const { unmount } = renderHook(() => useScriptBoxEngine('sb1', { shots: [] }));
    localizeMock.mockClear();
    publish('agent:task-completed', {
      taskId: 't1',
      nodeId: 'sb1-asset-a1', // 伪 nodeId：`${nodeId}-asset-${assetId}`
      resultUrl: 'http://127.0.0.1:18080/files/migrated/1.png',
      status: 'completed',
    });
    const data = applyLatestUpdater({ assets: [{ id: 'a1', loading: true }] });
    expect(data.assets[0]).toMatchObject({
      id: 'a1',
      loading: false,
      has: true,
      assetUrl: 'http://127.0.0.1:18080/files/migrated/1.png',
      thumbnailUrl: 'http://127.0.0.1:18080/files/migrated/1.png',
    });
    // 补归类：素材库落盘被调一次，folder 由资产分类派生（character → migrated/人物）
    expect(localizeMock).toHaveBeenCalledTimes(1);
    expect(localizeMock).toHaveBeenCalledWith('http://127.0.0.1:18080/files/migrated/1.png', {
      name: '角色1',
      folder: 'migrated/人物',
    });
    unmount();
    getNodes.mockReturnValue([{ id: 'sb1', data: { shots: [] } }]); // 还原默认
  });

  it('资产已归档（imageStatus=uploaded）→ 回填照常但**不再补归类**（判据 = 状态位，TD-01-25）', () => {
    getNodes.mockReturnValue([
      {
        id: 'sb1',
        data: {
          shots: [],
          assets: [
            {
              id: 'a2',
              category: 'character',
              name: '角色2',
              assetUrl: 'http://127.0.0.1:18080/files/migrated/人物/2.png',
              imageStatus: 'uploaded', // 生成路径已真归档（或手动上传过）
            },
          ],
        },
      },
    ]);
    const { unmount } = renderHook(() => useScriptBoxEngine('sb1', { shots: [] }));
    localizeMock.mockClear();
    publish('agent:task-completed', {
      taskId: 't2',
      nodeId: 'sb1-asset-a2', // 伪 nodeId：`${nodeId}-asset-${assetId}`
      resultUrl: 'http://127.0.0.1:18080/files/migrated/2.png',
      status: 'completed',
    });
    // 回填仍发生（图照样回填剧本盒），但**不再重复归档**（收口前靠 sha1 幂等兜住的那次冗余调用消失）
    expect(localizeMock).not.toHaveBeenCalled();
    unmount();
    getNodes.mockReturnValue([{ id: 'sb1', data: { shots: [] } }]); // 还原默认
  });

  it('非本剧本盒 / 非资产任务 / 未完成（空 URL）的广播 → 一律不回填、不落素材库', () => {
    const { unmount } = renderHook(() => useScriptBoxEngine('sb1', { shots: [] }));
    localizeMock.mockClear();
    const before = setNodes.mock.calls.length;
    publish('agent:task-completed', {
      nodeId: 'other-asset-a1',
      resultUrl: 'u',
      status: 'completed',
    });
    publish('agent:task-completed', { nodeId: 'sb1', resultUrl: 'u', status: 'completed' }); // 节点自身，非资产
    publish('agent:task-completed', { nodeId: 'sb1-asset-a1', resultUrl: '', status: 'completed' }); // 空 URL（文本类）
    publish('agent:task-completed', { nodeId: 'sb1-asset-a1', resultUrl: 'u', status: 'running' });
    // 尾帧任务：非本盒 / 空 shotId 也不回填
    publish('agent:task-completed', {
      nodeId: 'other-tailframe-s1',
      resultUrl: 'u',
      status: 'completed',
    });
    publish('agent:task-completed', {
      nodeId: 'sb1-tailframe-',
      resultUrl: 'u',
      status: 'completed',
    });
    expect(setNodes.mock.calls.length).toBe(before);
    expect(localizeMock).not.toHaveBeenCalled();
    unmount();
  });

  // ── 【TD-01-12】剧本盒尾帧综合图「生成中刷新」回填（先红后绿：改前无订阅 → 该镜 composed 卡 loading）──
  it('收到「本剧本盒尾帧综合图任务」完成广播 → 回填该镜 composed 变体 + 自动选中 + 复位 loading', () => {
    const { unmount } = renderHook(() => useScriptBoxEngine('sb1', { shots: [] }));
    const before = setNodes.mock.calls.length;
    publish('agent:task-completed', {
      taskId: 't2',
      nodeId: 'sb1-tailframe-s2', // 伪 nodeId：`${nodeId}-tailframe-${shotId}`
      resultUrl: 'http://127.0.0.1:18080/files/migrated/脚本/尾帧变体/x.png',
      status: 'completed',
    });
    expect(setNodes.mock.calls.length).toBe(before + 1);
    const data = applyLatestUpdater({
      shots: [
        {
          id: 's2',
          tailFrameVariantsLoading: true,
          prevTailFrameVariants: [
            { id: 'original', assetUrl: 'orig' },
            { id: 'composed', loading: true },
          ],
        },
      ],
    });
    const s2 = data.shots.find((s: any) => s.id === 's2');
    expect(s2.tailFrameVariantsLoading).toBe(false);
    expect(s2.selectedTailFrameVariantId).toBe('composed');
    expect(s2.prevShotImageRefUrls).toEqual([
      'http://127.0.0.1:18080/files/migrated/脚本/尾帧变体/x.png',
    ]);
    expect(s2.prevTailFrameVariants.find((v: any) => v.id === 'composed')).toMatchObject({
      assetUrl: 'http://127.0.0.1:18080/files/migrated/脚本/尾帧变体/x.png',
      thumbnailUrl: 'http://127.0.0.1:18080/files/migrated/脚本/尾帧变体/x.png',
      loading: false,
    });
    unmount();
  });

  it('尾帧回填：变体数组无 composed 占位（刷新早于占位写回）→ 追加 composed', () => {
    const { unmount } = renderHook(() => useScriptBoxEngine('sb1', { shots: [] }));
    publish('agent:task-completed', {
      nodeId: 'sb1-tailframe-s9',
      resultUrl: 'u9',
      status: 'completed',
    });
    const data = applyLatestUpdater({
      shots: [{ id: 's9', prevTailFrameVariants: [{ id: 'original', assetUrl: 'orig' }] }],
    });
    const s9 = data.shots.find((s: any) => s.id === 's9');
    expect(s9.prevTailFrameVariants.map((v: any) => v.id)).toEqual(['original', 'composed']);
    expect(s9.prevTailFrameVariants[1]).toMatchObject({ assetUrl: 'u9', loading: false });
    unmount();
  });
});
