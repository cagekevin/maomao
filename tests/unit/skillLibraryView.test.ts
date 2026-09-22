/**
 * `skillLibraryView` —— "行 = 磁盘包 ∪ 索引状态"的判定中枢（TD-11-44 的根）。
 *
 * 本文件锁的是**设计里最容易退化的那几条**：
 *  · 列表骨架必须来自**磁盘**（索引里有、磁盘没有 ⇒ 只能成 `index-only` 行，不许伪装成正常行）；
 *  · 缺 id / 未纳入索引 / 读不到 的行**各有各的动作**，且都**不可编辑**（能编辑 = 磁盘必存在）；
 *  · 无描述 ≠ 不可用（只是不进「可用清单」）；
 *  · 组三态与"空分组要留着"、"官方恒在最前、`_未分类` 恒在最后"。
 */
import { describe, it, expect } from 'vitest';
// 【故意**不**导入两个组哨兵】它们已不是导出面（TD-11-62）：消费者拿 `kind`（语义）。
// 本文件若还要 import 哨兵才能断言，就说明"外面还在比哨兵"这件事没被修掉。
import { buildSkillLibraryView } from '../../src/components/agent/skill/view/skillLibraryView.ts';
// 选用入口（下拉）已独立成文件（TD-11-68）—— 它与列表是**两个用例**，但共用同一套组语义
import { buildSkillPickerGroups } from '../../src/components/agent/skill/view/skillPickerView.ts';
import type {
  SkillLibrary,
  SkillPackageFile,
} from '../../src/components/agent/skill/skillTypes.ts';
import { UNSORTED_GROUP as UNSORTED } from '../../src/components/agent/skill/rules/skillGroup.ts';

const fm = (fields: Record<string, string>, body = '正文'): string =>
  `---\n${Object.entries(fields)
    .map(([k, v]) => `${k}: ${v}`)
    .join('\n')}\n---\n${body}`;

const pkg = (
  category: string,
  slug: string,
  md: string,
  extras: { relPath: string; content: string }[] = [],
) => ({
  category,
  slug,
  files: ['SKILL.md', ...extras.map((e) => e.relPath)],
  contents: [
    { relPath: 'SKILL.md', encoding: 'utf8' as const, content: md },
    ...extras.map((e) => ({ relPath: e.relPath, encoding: 'utf8' as const, content: e.content })),
  ] as SkillPackageFile[],
});

const lib = (groups: string[], packages: ReturnType<typeof pkg>[]): SkillLibrary => ({
  root: '/r',
  groups,
  packages,
});

const BUILTIN = {
  id: 'skill_ecommerce_detail',
  name: '电商详情页套图',
  description: '内置的套图规划',
  content: '内置正文',
};

const base = {
  indexRows: [] as unknown[],
  enabledMap: {} as Record<string, boolean>,
  builtins: [] as (typeof BUILTIN)[],
};

describe('buildSkillLibraryView · 行从磁盘来（投影不得伪装成正常行）', () => {
  it('索引里有、磁盘上没有 ⇒ 进「磁盘上已删除」收纳组，`index-only` 且不可用不可编辑', () => {
    const view = buildSkillLibraryView({
      ...base,
      disk: lib([], []),
      indexRows: [{ id: 'a', category: '图片类', slug: '旧技能', name: '旧技能', content: '正文' }],
    });

    const row = view.groups.at(-1)!.rows[0];
    // 消费者读 `kind` / `label`，**不认识哨兵 `name`**（TD-11-62：改哨兵值不许影响任何渲染分支）
    expect(view.groups.at(-1)!.kind).toBe('index-only');
    expect(view.groups.at(-1)!.label).toBe('磁盘上已删除');
    expect(row.state).toBe('index-only');
    expect(row.usable).toBe(false);
    expect(row.editable).toBe(false);
    expect(view.counts.indexOnly).toBe(1);
  });

  it('磁盘有、frontmatter 缺 id ⇒ `missing-id`（不可用不可编辑，只给补齐）', () => {
    const view = buildSkillLibraryView({
      ...base,
      disk: lib(
        ['图片类'],
        [pkg('图片类', '漫画生成', fm({ name: '漫画生成', description: '画漫画' }))],
      ),
    });

    expect(view.groups[0].rows[0].state).toBe('missing-id');
    expect(view.groups[0].rows[0].usable).toBe(false);
    expect(view.groups[0].rows[0].editable).toBe(false);
    expect(view.counts.missingId).toBe(1);
  });

  it('磁盘有、有 id，但索引里没有 ⇒ `not-indexed`（只给重读，仍不可编辑）', () => {
    const view = buildSkillLibraryView({
      ...base,
      disk: lib(['图片类'], [pkg('图片类', '漫画生成', fm({ id: 'id-1', name: '漫画生成' }))]),
      indexRows: [],
    });

    expect(view.groups[0].rows[0].state).toBe('not-indexed');
    expect(view.groups[0].rows[0].editable).toBe(false);
  });

  it('磁盘有 + 有 id + 索引有 ⇒ `ok`：可编辑、可用', () => {
    const view = buildSkillLibraryView({
      ...base,
      disk: lib(['图片类'], [pkg('图片类', '漫画生成', fm({ id: 'id-1', name: '漫画生成' }))]),
      indexRows: [{ id: 'id-1', category: '图片类', slug: '漫画生成', name: '漫画生成' }],
    });

    const row = view.groups[0].rows[0];
    expect(row.state).toBe('ok');
    expect(row.usable).toBe(true);
    expect(row.editable).toBe(true); // 能编辑 ⇒ 磁盘必存在（保存不可能"把已删的包重建"）
  });

  it('SKILL.md 读不到（残包 / 二进制）⇒ `unreadable`，仍如实列出来（不隐藏）', () => {
    const view = buildSkillLibraryView({
      ...base,
      disk: {
        root: '/r',
        groups: ['图片类'],
        packages: [{ category: '图片类', slug: '半成品', files: [], contents: [] }],
      },
    });

    expect(view.groups[0].rows[0].state).toBe('unreadable');
    expect(view.groups[0].rows[0].name).toBe('半成品');
    expect(view.groups[0].rows[0].usable).toBe(false);
  });
});

describe('buildSkillLibraryView · 行上的提醒（与状态正交）', () => {
  it('无描述 ⇒ `noDescription` 但**仍可用**（只是不进「可用清单」）', () => {
    const view = buildSkillLibraryView({
      ...base,
      disk: lib(['图片类'], [pkg('图片类', '漫画生成', fm({ id: 'id-1', name: '漫画生成' }))]),
      indexRows: [{ id: 'id-1', category: '图片类', slug: '漫画生成', name: '漫画生成' }],
    });

    const row = view.groups[0].rows[0];
    expect(row.noDescription).toBe(true);
    expect(row.usable).toBe(true); // 正文照样能注入 ⇒ 不许把它算成"不可用"
  });

  it('正文引用了包里没有的资料 ⇒ `missingRefs` 列出来（模型读到会失败，行上先说）', () => {
    const view = buildSkillLibraryView({
      ...base,
      disk: lib(
        ['图片类'],
        [
          pkg(
            '图片类',
            '漫画生成',
            fm({ id: 'id-1', name: '漫画生成', description: 'd' }, '先读 `references/风格.md`'),
          ),
        ],
      ),
      indexRows: [{ id: 'id-1', category: '图片类', slug: '漫画生成', name: '漫画生成' }],
    });

    expect(view.groups[0].rows[0].missingRefs).toEqual(['references/风格.md']);
    expect(view.groups[0].rows[0].resourceCount).toBe(1);
  });

  it('正文长度如实带给行（详情/编辑器的预算条要用）', () => {
    const view = buildSkillLibraryView({
      ...base,
      disk: lib(['图片类'], [pkg('图片类', '漫画生成', fm({ id: 'id-1' }, '一二三四五'))]),
      indexRows: [{ id: 'id-1', category: '图片类', slug: '漫画生成' }],
    });

    expect(view.groups[0].rows[0].contentLength).toBe(5);
  });
});

describe('buildSkillLibraryView · 组与三态', () => {
  it('官方恒在最前（内置行 readonly：能开关、不能编辑）', () => {
    const view = buildSkillLibraryView({
      ...base,
      disk: lib(['营销文案'], []),
      builtins: [BUILTIN],
    });

    expect(view.groups[0].kind).toBe('official');
    expect(view.groups[0].label).toBe('官方');
    expect(view.groups[0].rows[0].readonly).toBe(true);
    expect(view.groups[0].rows[0].editable).toBe(false);
    expect(view.groups[0].rows[0].usable).toBe(true);
  });

  it('磁盘上的空分组要留着（它是真实存在的目录）', () => {
    const view = buildSkillLibraryView({ ...base, disk: lib(['营销文案', '空组'], []) });

    // 组顺序 = `compareSkillGroups`（本地中文序；`_未分类` 恒最后）—— 视图层是唯一排序口径
    expect(view.groups.map((g) => g.name)).toEqual(['空组', '营销文案']);
    expect(view.groups[0].rows).toEqual([]);
    expect(view.groups[1].rows).toEqual([]);
  });

  it('`toggleIds` 与组头计数**同源**（组内哪些行可开关只判一次 · TD-11-67）', () => {
    const view = buildSkillLibraryView({
      ...base,
      disk: lib(
        ['图片类'],
        [
          pkg('图片类', 'a', fm({ id: 'id-a', name: 'A', description: 'd' })),
          pkg('图片类', 'no-id', fm({ name: '缺 id', description: 'd' })), // 未纳入索引 ⇒ 不参与开关
        ],
      ),
      indexRows: [
        { id: 'id-a', category: '图片类', slug: 'a', name: 'A' },
        { id: 'gone', category: '图片类', slug: 'gone', name: 'G' }, // 仅索引 ⇒ 不参与开关
      ],
    });

    const g = view.groups.find((x) => x.name === '图片类')!;
    expect(g.toggleIds).toEqual(['id-a']);
    // 与计数同源：消费者拿 `toggleIds.length` 就该等于组头显示的 `toggleable`
    expect(g.toggleIds.length).toBe(g.toggleable);
  });

  it('组三态：全开 / 部分 / 全关（缺 id 与仅索引的行不参与开关）', () => {
    const view = buildSkillLibraryView({
      ...base,
      disk: lib(
        ['营销文案', '素材处理', '未分类'],
        [
          pkg('营销文案', 'a', fm({ id: 'id-a', name: 'A', description: 'd' })),
          pkg('营销文案', 'b', fm({ id: 'id-b', name: 'B', description: 'd' })),
          pkg('素材处理', 'c', fm({ id: 'id-c', name: 'C', description: 'd' })),
          pkg('未分类', 'd', fm({ id: 'id-d', name: 'D', description: 'd' })),
        ],
      ),
      indexRows: [
        { id: 'id-a', category: '营销文案', slug: 'a', name: 'A' },
        { id: 'id-b', category: '营销文案', slug: 'b', name: 'B' },
        { id: 'id-c', category: '素材处理', slug: 'c', name: 'C' },
        { id: 'id-d', category: '未分类', slug: 'd', name: 'D' },
      ],
      // `id-c` 显式关；索引里没记过的（如内置）按**缺省启用**
      enabledMap: { 'id-a': true, 'id-b': false, 'id-c': false, 'id-d': true },
    });

    const byName = Object.fromEntries(view.groups.map((g) => [g.name, g]));
    // 组开关只有两态：有一个开着就算 on（"开了一半"不是第三种状态，开了几个看 onCount）
    expect(byName['营销文案'].toggleState).toBe('on'); // a 开 b 关 ⇒ 这组在用
    expect(byName['营销文案'].onCount).toBe(1);
    expect(byName['素材处理'].toggleState).toBe('off'); // c 显式关 ⇒ 一个都没开
    expect(byName['未分类'].toggleState).toBe('on'); // d 开
  });

  it('`_未分类` 恒排最后、显示为「未分组」；「已删除」收纳组排在它之后', () => {
    const view = buildSkillLibraryView({
      ...base,
      disk: lib([UNSORTED, '甲组'], [pkg(UNSORTED, 'x', fm({ id: 'id-x', name: 'X' }))]),
      indexRows: [
        { id: 'id-x', category: UNSORTED, slug: 'x', name: 'X' },
        { id: 'gone', category: '老组', slug: 'g', name: 'G' },
      ],
    });

    expect(view.groups.map((g) => g.label)).toEqual(['甲组', '未分组', '磁盘上已删除']);
    // 语义类别如实：磁盘组 = normal（**默认值不是"没判"**），末组 = index-only
    expect(view.groups.map((g) => g.kind)).toEqual(['normal', 'normal', 'index-only']);
  });
});

describe('组语义 kind / 行预填 categoryInput（消费者不许比哨兵 · TD-11-62/58）', () => {
  it('三种组的 kind 各自如实（官方 / 已删除 / 普通磁盘组）', () => {
    const view = buildSkillLibraryView({
      ...base,
      disk: lib(['营销文案'], [pkg('营销文案', 'a', fm({ id: 'id-a', name: 'A' }))]),
      indexRows: [
        { id: 'id-a', category: '营销文案', slug: 'a', name: 'A' },
        { id: 'gone', category: '老组', slug: 'g', name: 'G' },
      ],
      builtins: [BUILTIN],
    });

    expect(view.groups.map((g) => g.kind)).toEqual(['official', 'normal', 'index-only']);
  });

  it('`categoryInput`：兜底组 ⇒ 空串（它不是用户要填的组名）；普通组 ⇒ 原名', () => {
    const view = buildSkillLibraryView({
      ...base,
      disk: lib(
        ['营销文案', UNSORTED],
        [
          pkg('营销文案', 'a', fm({ id: 'id-a', name: 'A', description: 'd' })),
          pkg(UNSORTED, 'b', fm({ id: 'id-b', name: 'B', description: 'd' })),
        ],
      ),
      indexRows: [
        { id: 'id-a', category: '营销文案', slug: 'a', name: 'A' },
        { id: 'id-b', category: UNSORTED, slug: 'b', name: 'B' },
      ],
    });

    const rows = view.groups.flatMap((g) => g.rows);
    expect(rows.find((r) => r.name === 'A')!.categoryInput).toBe('营销文案');
    expect(rows.find((r) => r.name === 'B')!.categoryInput).toBe(''); // 兜底组不预填内部名
  });

  it('不可编辑的行 `categoryInput` 也是空串（没有输入框，就不给"预填值"）', () => {
    const view = buildSkillLibraryView({
      ...base,
      disk: lib([], []),
      indexRows: [{ id: 'a', category: '图片类', slug: '旧技能', name: '旧技能', content: '正文' }],
    });

    expect(view.groups.at(-1)!.rows[0].editable).toBe(false);
    expect(view.groups.at(-1)!.rows[0].categoryInput).toBe('');
  });
});

describe('buildSkillLibraryView · 未决（读不到磁盘 ≠ 磁盘上没有技能）', () => {
  it('disk=null ⇒ undecided=true，且按索引显示（不清空、不否定）', () => {
    const view = buildSkillLibraryView({
      ...base,
      disk: null,
      indexRows: [
        { id: 'id-1', category: '图片类', slug: '漫画生成', name: '漫画生成', content: '正文' },
      ],
    });

    expect(view.undecided).toBe(true);
    expect(view.counts.rows).toBe(1);
    expect(view.groups[0].rows[0].name).toBe('漫画生成');
    // 未决时"磁盘上已删"这件事**无从判断** ⇒ 不许凭空造出仅索引行
    expect(view.counts.indexOnly).toBe(0);
  });
});

describe('buildSkillPickerGroups（AI 面板下拉：与列表同语义，消费者不比哨兵）', () => {
  const mine = (id: string, name: string, category?: string) => ({
    id,
    name,
    description: 'd',
    content: '正文',
    builtin: false,
    ...(category === undefined ? {} : { category }),
  });

  it('官方组（内置）恒在最前，用户技能按分组摆好；组头只有 `kind` / `label`（**没有**哨兵 name）', () => {
    const groups = buildSkillPickerGroups([
      { ...BUILTIN, builtin: true },
      mine('id-a', 'A', '营销文案'),
      mine('id-b', 'B', '图片类'),
      mine('id-c', 'C'),
    ]);

    expect(groups.map((g) => g.kind)).toEqual(['official', 'normal', 'normal', 'normal']);
    expect(groups.map((g) => g.label)).toEqual(['官方', '图片类', '营销文案', '未分组']);
    // 消费者拿到的组**不含 `name`** ⇒ 想比哨兵也无从比起（改哨兵值不可能影响这里）
    expect('name' in groups[0]).toBe(false);
  });

  it('行只带 `id` + `name`（选定只传 id；正文由冻结层按 id 现查）', () => {
    const groups = buildSkillPickerGroups([{ ...BUILTIN, builtin: true }]);

    expect(groups[0].items).toEqual([{ id: BUILTIN.id, name: BUILTIN.name }]);
  });

  it('没有成员的组不出现（选用入口摆空组只是挡路）', () => {
    expect(buildSkillPickerGroups([])).toEqual([]);
  });

  it('给磁盘现状 ⇒ 「磁盘上已删、索引里还在」的条目**不进下拉**（TD-11-55）', () => {
    const groups = buildSkillPickerGroups(
      [mine('id-a', 'A', '图片类'), mine('gone', '旧技能', '图片类')],
      lib(['图片类'], [pkg('图片类', 'a', fm({ id: 'id-a', name: 'A', description: 'd' }))]),
    );

    // 判据来自视图层的 `row.usable`（磁盘有 + 有 id + 已在索引）—— 不是这里另写一份
    expect(groups.flatMap((g) => g.items).map((i) => i.id)).toEqual(['id-a']);
  });

  it('磁盘读不到（`null`）⇒ 按索引列出，**不把下拉变空**（"读不到"≠"磁盘上没有"）', () => {
    const groups = buildSkillPickerGroups([mine('id-a', 'A', '图片类')], null);

    expect(groups.flatMap((g) => g.items).map((i) => i.id)).toEqual(['id-a']);
  });
});

describe('buildSkillLibraryView · 计数（芯片用）', () => {
  it('磁盘包数 / 行数 / 可用 / 已启用 各自如实', () => {
    const view = buildSkillLibraryView({
      ...base,
      disk: lib(
        ['营销文案', '图片类'],
        [
          pkg('营销文案', 'a', fm({ id: 'id-a', name: 'A', description: 'd' })),
          pkg('图片类', 'b', fm({ id: 'id-b', name: 'B', description: 'd' })),
          pkg('图片类', 'c', fm({ name: 'C', description: 'd' })), // 缺 id
        ],
      ),
      indexRows: [
        { id: 'id-a', category: '营销文案', slug: 'a', name: 'A' },
        { id: 'id-b', category: '图片类', slug: 'b', name: 'B' },
      ],
      enabledMap: { 'id-a': false },
      builtins: [BUILTIN],
    });

    expect(view.counts).toEqual({
      diskPackages: 3,
      rows: 4, // 3 个磁盘包 + 1 个内置
      usable: 3, // a、b、内置（缺 id 的 c 不可用）
      enabled: 2, // b + 内置（a 被关）
      missingId: 1,
      indexOnly: 0,
    });
  });
});
