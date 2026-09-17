/**
 * 可引用媒体源（docs/136 地基）单测。
 * 覆盖：
 *   - mediaRefTypes：makeMediaRef / parseMediaRef 编解码往返（边界：非法 ref、id 含冒号）
 *   - mediaRefRegistry：注册 / 重复注册抛错 / 未注册 query 抛错 / searchMediaRefs 部分成功
 *   - providers：canvas 映射（复用 getNodeMedia + 过滤无媒体）/ library 映射（复用它 detectAssetType）
 *   - canvasNodesBridge：引用相等短路 / 订阅 / **源码级：不 import 存储**
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Node } from '@xyflow/react';

// ── canvasNodesBridge：模块级会话态，需按用例重置（vi.resetModules）──
const loadBridge = async () => {
  vi.resetModules();
  return import('../../src/components/base/media/canvasNodesBridge');
};

const mkNode = (id: string, data: Record<string, unknown> = {}): Node => ({
  id,
  position: { x: 0, y: 0 },
  data,
});

describe('mediaRefTypes：ref 编解码', () => {
  it('makeMediaRef / parseMediaRef 往返', async () => {
    const { makeMediaRef, parseMediaRef } =
      await import('../../src/components/base/media/mediaRefTypes');
    const ref = makeMediaRef('canvas', 'n_123');
    expect(ref).toBe('canvas:n_123');
    expect(parseMediaRef(ref)).toEqual({ source: 'canvas', id: 'n_123' });
    expect(parseMediaRef(makeMediaRef('library', 'r-9'))).toEqual({
      source: 'library',
      id: 'r-9',
    });
  });

  it('非法 ref → null（无分隔符 / 空 id / 未知来源）', async () => {
    const { parseMediaRef } = await import('../../src/components/base/media/mediaRefTypes');
    expect(parseMediaRef('')).toBeNull();
    expect(parseMediaRef('canvas')).toBeNull();
    expect(parseMediaRef(':noSource')).toBeNull();
    expect(parseMediaRef('canvas:')).toBeNull();
    expect(parseMediaRef('unknown:x')).toBeNull();
  });

  it('id 含冒号 → id 保留全部（只按第一个分隔符切 source）', async () => {
    const { parseMediaRef } = await import('../../src/components/base/media/mediaRefTypes');
    expect(parseMediaRef('canvas:a:b:c')).toEqual({ source: 'canvas', id: 'a:b:c' });
  });

  it('generated 是合法来源（新增来源须同步 KNOWN_SOURCES）', async () => {
    const { makeMediaRef, parseMediaRef } =
      await import('../../src/components/base/media/mediaRefTypes');
    expect(parseMediaRef(makeMediaRef('generated', 'r1'))).toEqual({
      source: 'generated',
      id: 'r1',
    });
  });
});

describe('mediaRefRegistry：注册表行为', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('未注册来源被 query → 抛错（fail-fast，不静默返回 []）', async () => {
    const { queryMediaRefs } = await import('../../src/components/base/media/mediaRefRegistry');
    await expect(queryMediaRefs('canvas')).rejects.toThrow(/未注册/);
  });

  it('重复注册同一 source → 抛错（第二份真相）', async () => {
    const { registerMediaRefSource } =
      await import('../../src/components/base/media/mediaRefRegistry');
    const provider = { source: 'canvas' as const, label: 'x', list: async () => [] };
    registerMediaRefSource(provider);
    expect(() => registerMediaRefSource(provider)).toThrow(/已注册/);
  });

  it('searchMediaRefs 部分成功：一个来源挂了，另一个仍返回 + 失败被暴露', async () => {
    const { registerMediaRefSource, searchMediaRefs, __resetMediaRefSourcesForTest } =
      await import('../../src/components/base/media/mediaRefRegistry');

    __resetMediaRefSourcesForTest();
    registerMediaRefSource({
      source: 'canvas',
      label: '画布',
      list: async () => [
        {
          ref: 'canvas:n1',
          source: 'canvas',
          name: 'ok',
          type: 'image',
          url: 'http://x/a.png',
        },
      ],
    });
    registerMediaRefSource({
      source: 'library',
      label: '素材库',
      list: async () => {
        throw new Error('素材库暂时不可用');
      },
    });

    const result = await searchMediaRefs('a');
    expect(result.items).toHaveLength(1);
    expect(result.items[0].ref).toBe('canvas:n1');
    expect(result.failures).toEqual([{ source: 'library', message: '素材库暂时不可用' }]);
  });

  it('provider 返回相对 URL → 不抛（只留痕，不炸面板）', async () => {
    const { registerMediaRefSource, queryMediaRefs, __resetMediaRefSourcesForTest } =
      await import('../../src/components/base/media/mediaRefRegistry');
    __resetMediaRefSourcesForTest();
    registerMediaRefSource({
      source: 'canvas',
      label: '画布',
      list: async () => [
        { ref: 'canvas:r', source: 'canvas', name: 'bad', type: 'image', url: '/files/a.png' },
      ],
    });
    await expect(queryMediaRefs('canvas')).resolves.toHaveLength(1);
  });
});

describe('canvasNodesBridge：只读快照三件套', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('写 → 读；引用相等短路（同引用不通知）', async () => {
    const b = await loadBridge();
    expect(b.getCanvasNodesSnapshot()).toEqual([]);

    const listener = vi.fn();
    const unsub = b.subscribeCanvasNodes(listener);

    const nodes = [mkNode('n1', { assetUrl: 'http://x/a.png' })];
    b.setCanvasNodesSnapshot(nodes);
    expect(b.getCanvasNodesSnapshot()).toBe(nodes);
    expect(listener).toHaveBeenCalledTimes(1);

    b.setCanvasNodesSnapshot(nodes); // 同一引用 → 不通知
    expect(listener).toHaveBeenCalledTimes(1);

    unsub();
    b.setCanvasNodesSnapshot([mkNode('n2')]);
    expect(listener).toHaveBeenCalledTimes(1); // 退订后不再收
  });

  it('★源码级：本模块**不 import 任何存储**（不持久化的硬锁）', async () => {
    const fs = await import('node:fs');
    const src = fs.readFileSync(
      new URL('../../src/components/base/media/canvasNodesBridge.ts', import.meta.url),
      'utf8',
    );
    const importLines = src
      .split('\n')
      .filter((line) => /^\s*import\s/.test(line))
      .join('\n');
    expect(importLines).not.toMatch(/contentStore|localStorage|storage|api\//);
  });
});

describe('providers：映射（复用既有真源）', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('canvasSource：只收有媒体的节点，忽略无媒体节点；type 过滤生效', async () => {
    const bridge = await loadBridge();
    bridge.setCanvasNodesSnapshot([
      mkNode('n1', { assetUrl: 'http://x/a.png' }),
      mkNode('n2', { assetType: 'video', videoUrl: 'http://x/v.mp4' }),
      mkNode('n3', { label: '纯文本' }),
    ]);

    const { canvasSourceProvider } =
      await import('../../src/components/base/media/providers/canvasSource');
    const all = await canvasSourceProvider.list();
    expect(all.map((r) => r.ref)).toEqual(['canvas:n1', 'canvas:n2']);
    expect(all[0]).toMatchObject({ type: 'image', source: 'canvas' });
    expect(all[1]).toMatchObject({ type: 'video', source: 'canvas' });

    const onlyVideo = await canvasSourceProvider.list({ types: ['video'] });
    expect(onlyVideo).toHaveLength(1);
    expect(onlyVideo[0].ref).toBe('canvas:n2');

    const kw = await canvasSourceProvider.list({ keyword: '纯文本' });
    expect(kw).toHaveLength(0); // 该节点无媒体，即便名字匹配也不收录
  });

  it('★分类（第二层）由 provider 声明：library = 4 目录项；generated = 4 类型项；canvas 无分类', async () => {
    const { librarySourceProvider } =
      await import('../../src/components/base/media/providers/librarySource');
    const { generatedSourceProvider } =
      await import('../../src/components/base/media/providers/generatedSource');
    const { canvasSourceProvider } =
      await import('../../src/components/base/media/providers/canvasSource');

    // 素材库：按目录（全部/人物/场景/道具）—— 真源派生自 resourceStore.FOLDERS
    const libCats = librarySourceProvider.categories?.() ?? [];
    expect(libCats.map((c) => c.label)).toEqual(['全部', '人物', '场景', '道具']);
    expect(libCats.find((c) => c.key === 'character')?.query).toEqual({
      folder: 'migrated/人物',
    });
    // 【用户裁定 2026-09-17】「全部」= **精确 `migrated` 根**（尚未归类），不是"不过滤"
    // （去掉子目录 → 待归类区；其下子文件夹以卡片呈现，可拖入归类）。
    expect(libCats.find((c) => c.key === 'all')?.query).toEqual({ folderExact: 'migrated' });
    // 人物/场景/道具仍是**前缀**（含更深子目录）
    expect(libCats.find((c) => c.key === 'scene')?.query).toEqual({ folder: 'migrated/场景' });

    // 生成：按类型
    const genCats = generatedSourceProvider.categories?.() ?? [];
    expect(genCats.map((c) => c.label)).toEqual(['全部', '图片', '视频', '音频']);
    expect(genCats.find((c) => c.key === 'video')?.query).toEqual({ types: ['video'] });

    // 画布：无分类（不声明）
    expect(canvasSourceProvider.categories).toBeUndefined();
  });

  it('★librarySource 分类不含 tasks（归「生成」tab，不重复）', async () => {
    const { librarySourceProvider } =
      await import('../../src/components/base/media/providers/librarySource');
    const libCats = librarySourceProvider.categories?.() ?? [];
    // resourceStore.FOLDERS 里有 'generated'(tasks) 一项，但 library 分类必须排除它。
    expect(libCats.some((c) => c.query && 'folder' in c.query && c.query.folder === 'tasks')).toBe(
      false,
    );
  });

  it('★librarySource：文件夹条目（type:folder）保留为 isFolder 卡片（落点），不参与类型过滤；generated 则剔除', async () => {
    // 【2026-09-17】mock 目标从 localToolApi 改为**分页读取层** pagedList：
    // provider 的职责是"把后端条目映射成 MediaRef"，它不该被分页实现的内部信封形状绑住
    // （否则每次改读取器形状都要改 provider 测试 = 脆）。取全量/翻页本身由 pagedList.test.ts 覆盖。
    vi.doMock('../../src/components/base/api/pagedList.ts', () => ({
      fetchAllResourcePages: async () => [
        { id: 'f1', name: '人物', url: '/files/migrated/人物', type: 'folder', folder: 'migrated' },
        { id: 'r1', name: 'a.png', url: '/files/a.png', type: 'image', folder: 'migrated' },
      ],
    }));

    const { librarySourceProvider } =
      await import('../../src/components/base/media/providers/librarySource');
    const { generatedSourceProvider } =
      await import('../../src/components/base/media/providers/generatedSource');

    const lib = await librarySourceProvider.list();
    const folderRef = lib.find((r) => r.ref === 'library:f1');
    expect(folderRef?.isFolder).toBe(true);
    expect(folderRef?.folder).toBe('migrated');
    expect(lib.some((r) => r.ref === 'library:r1')).toBe(true);

    // 生成源：分类维度是媒体类型，目录卡片无意义 → 剔除。
    const gen = await generatedSourceProvider.list();
    expect(gen.some((r) => r.isFolder)).toBe(false);
  });

  it('librarySource：非图/视频/音频（text）不收录', async () => {
    vi.doMock('../../src/components/base/api/pagedList.ts', () => ({
      fetchAllResourcePages: async () => [
        { id: 'r1', name: 'a.png', url: '/files/a.png', type: 'image' },
        { id: 'r2', name: 'b.txt', url: '/files/b.txt', type: 'text' },
      ],
    }));

    const { librarySourceProvider } =
      await import('../../src/components/base/media/providers/librarySource');
    const list = await librarySourceProvider.list();
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ ref: 'library:r1', type: 'image', source: 'library' });
    // url 已归一为绝对
    expect(list[0].url).toMatch(/^https?:\/\/.+\/files\/a\.png$/);
  });
});
