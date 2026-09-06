/**
 * promptManager 单元测试（阶段一·算法与逻辑层）
 * 覆盖：预设加载/种子数据、全量保存、新建模板、最近使用、卡片映射/搜索/分类。
 * 严格基于 src/components/base/promptManager.js 真实导出编写。
 */
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import {
  contentClearCache,
  contentGet,
  contentSet,
} from '../../src/components/base/core/contentStore.ts';
import * as pm from '../../src/components/base/prompt/promptManager.ts';

const STORAGE_KEY = 'yimao_preset_prompts'; // 对齐 promptManager.js 内部 STORAGE_KEY
const RECENT_KEY = 'yimao_preset_recent'; // 对齐 promptManager.js 内部 RECENT_KEY

const readStored = (key) => {
  return contentGet(key) ?? null;
};

beforeEach(() => {
  localStorage.clear();
  contentClearCache();
});

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
  contentClearCache();
});

describe('ensureIds', () => {
  it('为缺 id 的预设补全 id', () => {
    const out = pm.ensureIds([{ title: 'a', prompt: 'x' }]);
    expect(out[0].id).toBeTruthy();
    expect(out[0].title).toBe('a');
  });

  it('保留已有 id 不变', () => {
    const out = pm.ensureIds([{ id: 'keep', title: 'a', prompt: 'x' }]);
    expect(out[0].id).toBe('keep');
  });

  it('非数组输入返回空数组', () => {
    expect(pm.ensureIds(null)).toEqual([]);
    expect(pm.ensureIds(undefined)).toEqual([]);
  });
});

describe('loadPresets / savePresets', () => {
  it('本地为空时写入内置示例并返回', () => {
    const list = pm.loadPresets();
    expect(list.length).toBe(pm.DEFAULT_PRESETS.length);
    expect(readStored(STORAGE_KEY)).toBeTruthy();
  });

  it('本地已有数据则返回已存数据（不覆盖）', () => {
    const mine = [{ id: 'my1', title: '自定义', type: 'text', prompt: 'p', enabled: true }];
    pm.savePresets(mine);
    const list = pm.loadPresets();
    expect(list.find((x) => x.id === 'my1')).toBeTruthy();
    expect(list.length).toBe(1);
    expect(readStored(STORAGE_KEY)[0].id).toBe('my1');
  });

  it('旧数据缺 id 时被补齐并写回', () => {
    contentSet(STORAGE_KEY, [{ title: '旧', type: 'text', prompt: 'p' }]);
    const list = pm.loadPresets();
    expect(list[0].id).toBeTruthy();
    const reread = readStored(STORAGE_KEY);
    expect(reread[0].id).toBeTruthy();
  });
});

describe('createPreset', () => {
  it('返回空模板且默认启用', () => {
    const p = pm.createPreset();
    expect(p.id).toBeTruthy();
    expect(p.title).toBe('');
    expect(p.type).toBe('all');
    expect(p.enabled).toBe(true);
  });
});

describe('saveAndNotify', () => {
  it('保存后通过 eventBus 广播 presets-changed', async () => {
    const handler = vi.fn();
    const { subscribe } = await import('../../src/components/base/core/eventBus.ts');
    const unsub = subscribe('presets-changed', handler);
    const list = [{ id: 'n1', title: 't', type: 'text', prompt: 'p', enabled: true }];
    pm.saveAndNotify(list);
    expect(handler).toHaveBeenCalledWith(list);
    expect(readStored(STORAGE_KEY)[0].id).toBe('n1');
    unsub();
  });
});

describe('recent', () => {
  it('recordRecent 去重且置顶、上限 50', () => {
    pm.recordRecent('a');
    pm.recordRecent('b');
    pm.recordRecent('a');
    expect(pm.getRecent()).toEqual(['a', 'b']);
    pm.recordRecent('c');
    const big = Array.from({ length: 60 }, (_, i) => 'x' + i);
    big.forEach((id) => pm.recordRecent(id));
    expect(pm.getRecent().length).toBe(50);
    expect(pm.getRecent()[0]).toBe('x59');
  });
});

describe('cards mapping', () => {
  it('mapToLibraryCards 过滤禁用项并映射字段', () => {
    const list = [
      { id: '1', title: 'T1', type: 'image', prompt: 'P1', enabled: true },
      { id: '2', title: 'T2', type: 'video', prompt: 'P2', enabled: false },
    ];
    const cards = pm.mapToLibraryCards(list);
    expect(cards.length).toBe(1);
    expect(cards[0]).toMatchObject({
      id: '1',
      title: 'T1',
      content: 'P1',
      category: 'image',
      presetIndex: 0,
      isLocal: true,
    });
  });

  it('getRecentCards 按 id 顺序提取', () => {
    const cards = [
      { id: '1', title: 'A' },
      { id: '2', title: 'B' },
      { id: '3', title: 'C' },
    ] as unknown as Parameters<typeof pm.getRecentCards>[0];
    expect(pm.getRecentCards(cards, ['3', '1'])).toEqual([
      { id: '3', title: 'C' },
      { id: '1', title: 'A' },
    ]);
  });

  it('searchCards 按标题或内容匹配（大小写不敏感）', () => {
    const cards = [
      { id: '1', title: '赛博', content: '城市' },
      { id: '2', title: '小猫', content: '花园' },
    ] as unknown as Parameters<typeof pm.getRecentCards>[0];
    expect(pm.searchCards(cards, '赛博').length).toBe(1);
    expect(pm.searchCards(cards, '花园').length).toBe(1);
    expect(pm.searchCards(cards, '').length).toBe(2);
    expect(pm.searchCards(cards, '没有').length).toBe(0);
  });
});

describe('分类元信息', () => {
  it('TYPE_LABEL / CATEGORY_OPTIONS 结构正确', () => {
    expect(pm.TYPE_LABEL.text).toBe('文本');
    expect(pm.CATEGORY_OPTIONS.map((o) => o.value)).toEqual(['', 'text', 'image', 'video']);
  });
});
