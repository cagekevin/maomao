/**
 * 可引用媒体源（docs/136 地基）单测。
 * 覆盖：
 *   - mediaRefTypes：makeMediaRef 写入口（ref 前缀契约）
 *   - mediaRefRegistry：注册 / 重复注册抛错 / 未注册 query 抛错
 *   - providers：canvas 映射（复用 getNodeMedia + 过滤无媒体）/ library 映射（复用它 detectAssetType）
 *   - canvasNodesBridge：写/读快照 / **源码级：不 import 存储**
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

describe('mediaRefTypes：ref 写入口', () => {
  it('makeMediaRef：`${source}:${id}`（三个内置来源）', async () => {
    const { makeMediaRef } = await import('../../src/components/base/media/mediaRefTypes');
    expect(makeMediaRef('canvas', 'n_123')).toBe('canvas:n_123');
    expect(makeMediaRef('library', 'r-9')).toBe('library:r-9');
    expect(makeMediaRef('generated', 'r1')).toBe('generated:r1');
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

// ── 【TD-02-47 母体】来源的**展示面**（顺序/显示名/默认分类）由来源自己声明，消费方 0 行接入 ──
describe('mediaRefRegistry：展示顺序由 provider.order 派生（TD-02-47）', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('★顺序来自**声明**而非注册顺序（逆序注册仍按 order 排）—— 这就是"新增来源消费方改 0 行"的机制', async () => {
    const { registerMediaRefSource, listMediaRefSources, __resetMediaRefSourcesForTest } =
      await import('../../src/components/base/media/mediaRefRegistry');
    __resetMediaRefSourcesForTest();
    // 故意按与 order 相反的顺序注册
    registerMediaRefSource({ source: 'canvas', label: '画布', order: 3, list: async () => [] });
    registerMediaRefSource({ source: 'generated', label: '生成', order: 1, list: async () => [] });
    registerMediaRefSource({ source: 'library', label: '素材库', order: 2, list: async () => [] });

    expect(listMediaRefSources().map((p) => p.source)).toEqual(['generated', 'library', 'canvas']);
    // 显示名随来源一起下发（消费方不写映射）
    expect(listMediaRefSources().map((p) => p.label)).toEqual(['生成', '素材库', '画布']);
  });

  it('未声明 order 的来源排在所有显式声明者之后（同缺省者保持注册顺序）', async () => {
    const { registerMediaRefSource, listMediaRefSources, __resetMediaRefSourcesForTest } =
      await import('../../src/components/base/media/mediaRefRegistry');
    __resetMediaRefSourcesForTest();
    registerMediaRefSource({ source: 'canvas', label: '画布', list: async () => [] }); // 无 order
    registerMediaRefSource({ source: 'library', label: '素材库', order: 2, list: async () => [] });
    registerMediaRefSource({ source: 'generated', label: '生成', list: async () => [] }); // 无 order

    expect(listMediaRefSources().map((p) => p.source)).toEqual(['library', 'canvas', 'generated']);
  });

  it('内置来源都显式声明 order 且互不相同（否则顺序退化为注册序 = 依赖 import 顺序的隐式耦合）', async () => {
    const { generatedSourceProvider } =
      await import('../../src/components/base/media/providers/generatedSource');
    const { librarySourceProvider } =
      await import('../../src/components/base/media/providers/librarySource');
    const { canvasSourceProvider } =
      await import('../../src/components/base/media/providers/canvasSource');
    const g = generatedSourceProvider.order ?? -1;
    const l = librarySourceProvider.order ?? -1;
    const c = canvasSourceProvider.order ?? -1;
    expect(g).toBeGreaterThan(-1); // 都声明了
    expect(l).toBeGreaterThan(-1);
    expect(c).toBeGreaterThan(-1);
    expect(new Set([g, l, c]).size).toBe(3); // 互不相同
    expect(l).toBeGreaterThan(g); // 用户裁定 2026-09-17：生成在素材库之前
  });
});

describe('generatedSource：分类 = 可引用媒体域（TD-02-49）', () => {
  it('分类清单由 MediaRefType 派生：全部 + 三类，且**不含 text**', async () => {
    const { generatedSourceProvider } =
      await import('../../src/components/base/media/providers/generatedSource');
    const { MEDIA_REF_TYPES } = await import('../../src/components/base/media/mediaRefTypes');
    const { ASSET_TYPE_META } = await import('../../src/types/asset');
    const cats = generatedSourceProvider.categories!();
    // 【为什么锁这条】原先本清单是**手抄**的 ['image','video','audio']，与 GeneratedView 的面板筛选
    // （text）早漂移却互称"同口径"。现派生自唯一真源（资产类型目录的 mediaRef 标记）⇒ 新增类型自动跟上。
    expect(cats.map((c) => c.key)).toEqual(['all', ...MEDIA_REF_TYPES]);
    expect(cats.map((c) => c.key)).not.toContain('text'); // 文本产物不进可引用媒体（只在任务中心）
    // 显示名取自目录条目（全仓唯一一份中文名），不是本处硬编码
    expect(cats.find((c) => c.key === 'audio')?.label).toBe(ASSET_TYPE_META.audio.label);
  });
});

describe('canvasNodesBridge：只读快照', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('写 → 读：快照即引用（零拷贝）', async () => {
    const b = await loadBridge();
    expect(b.getCanvasNodesSnapshot()).toEqual([]);

    const nodes = [mkNode('n1', { assetUrl: 'http://x/a.png' })];
    b.setCanvasNodesSnapshot(nodes);
    expect(b.getCanvasNodesSnapshot()).toBe(nodes);
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

  it('canvasSource：**只持 contentId 的文件型节点**必须被收录（TD-16-23 顺序修复）', async () => {
    // 先 resetModules（loadBridge 内含），再种子 resourceStore，最后 import canvasSource ——
    // 三者必须落在**同一个模块注册表**里，否则解析器读到的是一片空的 resource 列表。
    const bridge = await loadBridge();
    const rs = await import('../../src/components/base/store/resourceStore.ts');
    rs.resetResourceStoreForTest();
    rs.addResources([
      { url: '/files/sha1abc.png', contentId: 'sha1:abc', type: 'image', name: 'x.png' },
    ]);
    const { logger } = await import('../../src/components/base/core/logger.ts');
    const warnSpy = vi.spyOn(logger, 'warn');

    bridge.setCanvasNodesSnapshot([
      mkNode('n_file', { contentId: 'sha1:abc', label: '文件型图' }), // 只持 contentId（无 assetUrl/url）
      mkNode('n_gone', { contentId: 'sha1:missing', label: '引用已删' }), // contentId 解析不出地址
      mkNode('n_text', { label: '纯文本' }), // 真·非媒体节点
    ]);

    const { canvasSourceProvider } =
      await import('../../src/components/base/media/providers/canvasSource');
    const all = await canvasSourceProvider.list();
    // 【TD-02-46】列表条目 = 媒体 | 文件夹（`MediaRefEntry`）—— 要读媒体字段必须先窄化（画布来源本就不产文件夹）
    const media = all.filter((r) => !r.isFolder);

    // ① 顺序修复：原实现在解析 url **之前**按 `!media.type` 跳过 ⇒ 这类节点被静默漏掉
    expect(media.map((r) => r.ref)).toEqual(['canvas:n_file']);
    expect(media[0].type).toBe('image'); // 类型由唯一判型入口按解析出的地址判
    expect(media[0].contentId).toBe('sha1:abc');
    expect(String(media[0].url)).toContain('/files/sha1abc.png');

    // ② 「媒体节点但解析不出地址」= 必须留痕（不阻断 ≠ 不可见）；非媒体节点则**不**留痕
    const warned = warnSpy.mock.calls.map((c) => String(c[1]));
    expect(warned.some((m) => m.includes('无可渲染地址'))).toBe(true);
    expect(warnSpy).toHaveBeenCalledTimes(1); // n_text 是正常状态，不产生噪声
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
    // 【TD-02-46 收口】文件夹条目**没有 `type` 字段** —— 此前谎报 `type:'image'`（注释自述"仅为满足类型"），
    // 漏判 `isFolder` 的消费方会把它当图片（建出指向**目录**的资产节点）。
    // 类型层已用判别联合 `MediaRefEntry = MediaRef | MediaRefFolder` 钉死，这里再把**运行时形状**钉一次。
    expect(Object.keys(folderRef ?? {})).not.toContain('type');

    // 对照组：同批的**媒体**条目仍带 type（且按新契约**必须先窄化**才读得到）
    const mediaOnly = lib.filter((r) => !r.isFolder);
    expect(mediaOnly.find((r) => r.ref === 'library:r1')?.type).toBe('image');
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
