// @vitest-environment node
import { describe, it, expect } from 'vitest';
import {
  presetIdFor,
  isPresetId,
  collectPresetIds,
  syncCreativePresets,
  trimPreset,
  isValidPresetEntry,
  toDictEntry,
  CATALOG_KINDS,
} from '../../../src/components/base/creative/creativePresets.ts';
import {
  STYLE_PRESETS,
  FILTER_PRESETS,
  MOTION_PRESETS,
  MJ_PRESETS,
  ALL_CATALOG,
  catalogByKind,
  isMj,
} from '../../../src/components/base/creative/creativeCatalog.ts';

describe('creativePresets —— 命名空间', () => {
  it('style/filter/motion 补齐 cp_ 前缀', () => {
    expect(presetIdFor('style', 'style-643')).toBe('cp_style-643');
    expect(presetIdFor('filter', 'filter-714')).toBe('cp_filter-714');
    expect(presetIdFor('motion', 'motion-694')).toBe('cp_motion-694');
  });
  it('mj 用 cp_mj- 前缀（原始 id 无 kind）', () => {
    expect(presetIdFor('mj', 'char1')).toBe('cp_mj-char1');
  });
  it('isPresetId 只认 cp_ 开头', () => {
    expect(isPresetId('cp_style-1')).toBe(true);
    expect(isPresetId('style-1')).toBe(false);
    expect(isPresetId('pp_face')).toBe(false);
  });
});

describe('creativePresets —— collectPresetIds', () => {
  it('只收集 cp_* 胶囊 id，忽略普通素材芯片', () => {
    const p = '参考 @{img-1:人物} 与 @{cp_style-643:暖阳} 与 @{cp_mj-char1:MJ}';
    expect(collectPresetIds(p)).toEqual(['cp_style-643', 'cp_mj-char1']);
  });
  it('无 @ 时返回空', () => {
    expect(collectPresetIds('纯文本')).toEqual([]);
  });
});

describe('creativePresets —— syncCreativePresets（字典 GC，I1）', () => {
  it('返回只含被引用 cp_* id 的字典（删胶囊清孤儿）', () => {
    const dict = {
      'cp_style-643': { kind: 'style' as const, name: '暖阳', prompt: '视觉风格：暖阳' },
      'cp_mj-char1': { kind: 'mj' as const, name: 'MJ', prompt: 'codes' },
      'cp_style-999': { kind: 'style' as const, name: '孤儿', prompt: '被删' },
    };
    const out = syncCreativePresets('参考 @{cp_style-643:暖阳}', dict);
    expect(Object.keys(out)).toEqual(['cp_style-643']);
    expect(out['cp_style-643']).toEqual(dict['cp_style-643']);
  });
  it('prompt 无胶囊 → 空字典', () => {
    expect(syncCreativePresets('纯文本', { 'cp_style-1': { kind: 'style', prompt: 'x' } })).toEqual(
      {},
    );
  });
  it('纯函数不修改入参', () => {
    const dict: { 'cp_style-1': { kind: 'style'; prompt: string } } = {
      'cp_style-1': { kind: 'style', prompt: 'x' },
    };
    syncCreativePresets('@{cp_style-1:x}', dict);
    expect(Object.keys(dict)).toEqual(['cp_style-1']);
  });
});

describe('creativePresets —— trimPreset（I4：不落盘字段不外泄）', () => {
  it('丢弃 description/medium/codes/parameters/vibe，只留 6 字段', () => {
    const rich = {
      id: 'cp_mj-char1',
      kind: 'mj',
      category: '分类',
      name: '名字',
      prompt: '完整提示词一大段',
      preview: '/mj-styles/x.webp',
      description: 'desc',
      medium: '真实照片',
      codes: '--sref 123',
      parameters: '--ar 16:9',
      vibe: '糖果粉',
    };
    const out = trimPreset(rich);
    expect(out).toEqual({
      id: 'cp_mj-char1',
      kind: 'mj',
      category: '分类',
      name: '名字',
      prompt: '完整提示词一大段',
      preview: '/mj-styles/x.webp',
    });
    expect('medium' in out).toBe(false);
    expect('codes' in out).toBe(false);
    expect('parameters' in out).toBe(false);
    expect('vibe' in out).toBe(false);
    expect('description' in out).toBe(false);
  });
});

describe('creativePresets —— 字典校验与产物', () => {
  it('isValidPresetEntry：非 cp_ / 缺 prompt / 空 prompt 拒绝', () => {
    expect(isValidPresetEntry('cp_style-1', { kind: 'style', prompt: 'x' })).toBe(true);
    expect(isValidPresetEntry('style-1', { kind: 'style', prompt: 'x' })).toBe(false);
    expect(isValidPresetEntry('cp_style-1', null as any)).toBe(false);
    expect(isValidPresetEntry('cp_style-1', { kind: 'style', prompt: '' })).toBe(false);
  });
  it('toDictEntry 产出 {kind,name,prompt}', () => {
    expect(
      toDictEntry({ id: 'cp_style-1', kind: 'style', category: 'c', name: '名', prompt: 'p' }),
    ).toEqual({ kind: 'style', name: '名', prompt: 'p' });
  });
  it('CATALOG_KINDS 只含前 4 类', () => {
    expect([...CATALOG_KINDS]).toEqual(['style', 'filter', 'motion', 'mj']);
  });
});

describe('creativeCatalog —— 真值计数与 id 归一化', () => {
  it('四类计数 = 217/17/51/493（真值）', () => {
    expect(STYLE_PRESETS.length).toBe(217);
    expect(FILTER_PRESETS.length).toBe(17);
    expect(MOTION_PRESETS.length).toBe(51);
    expect(MJ_PRESETS.length).toBe(493);
    expect(ALL_CATALOG.length).toBe(217 + 17 + 51 + 493);
  });
  it('catalog 项 id 带 cp_ 前缀且唯一', () => {
    const ids = ALL_CATALOG.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(isPresetId(id)).toBe(true);
  });
  it('MJ 条目为 MjPreset，携带不落盘字段（UI 详情用）', () => {
    const mj = MJ_PRESETS[0];
    expect(isMj(mj)).toBe(true);
    expect(mj.kind).toBe('mj');
    expect(isPresetId(mj.id)).toBe(true);
    // 富字段应在（详情态所需），但它必须能经 trimPreset 裁剪掉
    if (isMj(mj)) {
      expect('codes' in mj || 'vibe' in mj).toBe(true);
    }
  });
  it('分类名非空', () => {
    for (const p of STYLE_PRESETS) expect(p.category).toBeTruthy();
    for (const p of MJ_PRESETS) expect(p.category).toBeTruthy();
  });
  it('catalogByKind 返回该 kind 全量', () => {
    expect(catalogByKind('style')).toHaveLength(217);
    expect(catalogByKind('mj')).toHaveLength(493);
  });
});

describe('creativeCatalog × trimPreset（I4 全链路）', () => {
  it('把 MjPreset 经 trimPreset 收敛为落盘 6 字段', () => {
    const mj = MJ_PRESETS[0];
    const trimmed = trimPreset(mj);
    expect(trimmed.kind).toBe('mj');
    expect('codes' in trimmed).toBe(false);
    expect('parameters' in trimmed).toBe(false);
    expect('vibe' in trimmed).toBe(false);
    expect('medium' in trimmed).toBe(false);
  });
});
