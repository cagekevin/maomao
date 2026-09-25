// @vitest-environment node
import { describe, it, expect } from 'vitest';
import {
  presetIdFor,
  isPresetId,
  collectPresetIds,
  syncCreativePresets,
  toDictEntry,
  CATALOG_KINDS,
  PRESET_KINDS,
  normalizeChipFieldWrite,
} from '../../../src/components/creative/creativePresets.ts';
import type { CreativePresetsDict } from '../../../src/components/creative/creativePresets.ts';
import {
  STYLE_PRESETS,
  FILTER_PRESETS,
  MOTION_PRESETS,
  MJ_PRESETS,
  catalogByKind,
} from '../../../src/components/creative/creativeCatalog.ts';

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

describe('creativePresets —— normalizeChipFieldWrite（I1 接线点 · TD-05-13）', () => {
  const dict = {
    'cp_style-643': { kind: 'style' as const, name: '暖阳', prompt: '视觉风格：暖阳' },
    'cp_style-999': { kind: 'style' as const, name: '孤儿', prompt: '被删' },
  };

  it('写 prompt 且含胶囊 → 裁掉孤儿项', () => {
    const data = { prompt: '@{cp_style-643:暖阳}', creativePresets: dict };
    const out = normalizeChipFieldWrite(data, { prompt: '@{cp_style-643:暖阳}' });
    expect(Object.keys(out.creativePresets as object)).toEqual(['cp_style-643']);
    // 纯函数：入参不被修改
    expect(Object.keys(dict)).toHaveLength(2);
  });

  it('不触及 chip 字段 → 返回值 === 入参引用（零成本 no-op）', () => {
    const data = { prompt: '@{cp_style-643:暖阳}', creativePresets: dict };
    // 引用相等 = 未重建，通用写路径（锁设置/位置等）无额外开销
    expect(normalizeChipFieldWrite(data, { selectedModel: 'gpt-4o' })).toBe(data);
  });

  it('无 creativePresets 字段 → 原引用返回（不引入空字段）', () => {
    const data = { prompt: '纯文本' };
    expect(normalizeChipFieldWrite(data, { prompt: '纯文本' })).toBe(data);
  });

  it('prompt 与 text 取并集（TextGenerate 两字段皆可含胶囊）', () => {
    const data = {
      prompt: '@{cp_style-643:暖阳}',
      text: '@{cp_style-999:孤儿}',
      creativePresets: dict,
    };
    const out = normalizeChipFieldWrite(data, { text: '@{cp_style-999:孤儿}' });
    expect(Object.keys(out.creativePresets as object).sort()).toEqual([
      'cp_style-643',
      'cp_style-999',
    ]);
  });

  it('胶囊全删 → 字典清空', () => {
    const data = { prompt: '', creativePresets: dict };
    const out = normalizeChipFieldWrite(data, { prompt: '' });
    expect(out.creativePresets).toEqual({});
  });
});

describe('creativePresets —— 字典产物', () => {
  it('toDictEntry 产出 {kind,name,prompt}', () => {
    expect(
      toDictEntry({ id: 'cp_style-1', kind: 'style', category: 'c', name: '名', prompt: 'p' }),
    ).toEqual({ kind: 'style', name: '名', prompt: 'p' });
  });
  it('CATALOG_KINDS 只含前 4 类', () => {
    expect([...CATALOG_KINDS]).toEqual(['style', 'filter', 'motion', 'mj']);
  });
  /**
   * TD-05-12 母体收口契约：字典写入的唯一产物 = `toDictEntry(preset)`，其返回类型即
   * `CreativePresetsDict` 的值形态（`CreativePresetEntry`）。本用例锁「产物可直接入字典」，
   * 防再次退回「节点手抄 Record<string,{kind:string;...}>」——手抄会让 kind 退化 string，
   * 快照里的 kind 便不受 PresetKind 约束。
   */
  it('toDictEntry 产物可直接并入 CreativePresetsDict（母体收口）', () => {
    const dict: CreativePresetsDict = {};
    const entry = toDictEntry({
      id: 'cp_style-1',
      kind: 'style',
      category: 'c',
      name: '名',
      prompt: 'p',
    });
    dict['cp_style-1'] = entry;
    // kind 必须仍是 PresetKind 的合法值（非宽化的 string）
    expect(PRESET_KINDS).toContain(dict['cp_style-1'].kind);
  });
});

describe('creativeCatalog —— 真值计数与 id 归一化', () => {
  it('四类计数 = 217/17/51/493（真值）', () => {
    expect(STYLE_PRESETS.length).toBe(217);
    expect(FILTER_PRESETS.length).toBe(17);
    expect(MOTION_PRESETS.length).toBe(51);
    expect(MJ_PRESETS.length).toBe(493);
  });
  it('四类全量 id 带 cp_ 前缀且全局唯一（不重叠）', () => {
    // 遍历真源 CATALOG_KINDS（而非手写四类），新增 catalog 类时本用例自动覆盖
    const all = CATALOG_KINDS.flatMap((k) => catalogByKind(k));
    expect(all).toHaveLength(217 + 17 + 51 + 493);
    const ids = all.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(isPresetId(id)).toBe(true);
  });
  it('MJ 条目为 MjPreset，携带不落盘字段（UI 详情用）', () => {
    const mj = MJ_PRESETS[0];
    // 收窄走 kind 判别（MjPreset extends CreativePreset，无需类型守卫函数）
    expect(mj.kind).toBe('mj');
    expect(isPresetId(mj.id)).toBe(true);
    // 富字段应在（详情态所需），但 toDictEntry 白名单不含它 ⇒ 进不了字典/快照（I4）
    expect('codes' in mj || 'vibe' in mj).toBe(true);
  });
  it('分类名非空', () => {
    for (const p of STYLE_PRESETS) expect(p.category).toBeTruthy();
    for (const p of MJ_PRESETS) expect(p.category).toBeTruthy();
  });
  it('catalogByKind 返回该 kind 全量（单一入口 · TD-05-14 接线）', () => {
    for (const k of CATALOG_KINDS) {
      expect(catalogByKind(k)).toBe(catalogByKind(k)); // 模块级常量引用稳定 → 可作 memo deps
    }
    expect(catalogByKind('style')).toHaveLength(217);
    expect(catalogByKind('mj')).toHaveLength(493);
  });
});

describe('creativeCatalog × toDictEntry（I4 全链路）', () => {
  it('MjPreset 的富字段经 toDictEntry 白名单挡在字典外（只产 kind/name/prompt）', () => {
    const mj = MJ_PRESETS[0];
    const entry = toDictEntry(mj);
    expect(entry).toEqual({ kind: mj.kind, name: mj.name, prompt: mj.prompt });
    for (const k of [
      'description',
      'medium',
      'codes',
      'parameters',
      'vibe',
      'video',
      'preview',
      'id',
    ])
      expect(k in entry).toBe(false);
  });
});
