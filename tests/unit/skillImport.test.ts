import { describe, it, expect, beforeEach, vi } from 'vitest';

// skillApi 是唯一网络边界：桩掉它，本测试锁的是**切包规则 + 整包提交语义**。
const api = vi.hoisted(() => ({ list: vi.fn(), read: vi.fn(), save: vi.fn() }));

vi.mock('../../src/components/agent/skill/store/skillApi.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../src/components/agent/skill/store/skillApi.ts')>()),
  listSkillPackages: api.list,
  readSkillPackage: api.read,
  saveSkillPackage: api.save,
}));

import {
  SKILL_IMPORT_ACCEPT,
  importSkillPackages,
  importSkillText,
  isImportablePackageFile,
  isSkillImportFile,
  skillNameFromFile,
} from '../../src/components/agent/skill/write/skillImport.ts';
import { UNSORTED_GROUP } from '../../src/components/agent/skill/rules/skillGroup.ts';
import {
  readSkillList,
  writeSkillList,
} from '../../src/components/agent/skill/store/skillRepository.ts';
import { contentClearCache } from '../../src/components/base/core/contentStore.ts';

const saveOk = { ok: true, data: { category: 'x', slug: 'y', written: 1 } };

/** 造一个包的文件集合（frontmatter 可选） */
function pkg(
  folder: string,
  fm = ['name: 漫画生成', 'description: 生成分镜式漫画页'],
  extra: string[] = ['references/a.md'],
) {
  const p = (rel: string) => (folder ? `${folder}/${rel}` : rel);
  return [
    { relPath: p('SKILL.md'), content: ['---', ...fm, '---', '正文'].join('\n') },
    ...extra.map((rel) => ({ relPath: p(rel), content: `内容：${rel}` })),
  ];
}

beforeEach(() => {
  localStorage.clear();
  contentClearCache();
  api.list.mockReset();
  api.read.mockReset();
  api.save.mockReset();
  api.list.mockResolvedValue({ ok: true, data: { root: '/r', groups: [], packages: [] } });
  api.save.mockResolvedValue(saveOk);
});

describe('isImportablePackageFile（导入准入的唯一判据）', () => {
  it('放行包内文本文件', () => {
    for (const ok of ['SKILL.md', 'references/a.md', 'references/style/x.txt', 'a/b/c.json'])
      expect(isImportablePackageFile(ok), ok).toBe(true);
  });

  it('拒绝隐藏段与二进制（隐藏段会让后端整包 400，必须提交前就剔掉）', () => {
    for (const bad of [
      '.DS_Store',
      '包/.git/config',
      'references/.keep.md',
      'references/a.png',
      'references/字体.ttf',
      'a//b.md',
      '',
    ])
      expect(isImportablePackageFile(bad), bad).toBe(false);
  });
});

describe('importSkillPackages（整目录导入）', () => {
  it('选了包文件夹本身 ⇒ 一个包，references 原样带进整包写', async () => {
    const r = await importSkillPackages(pkg('漫画生成'));

    expect(r.ok).toBe(true);
    expect(api.save).toHaveBeenCalledTimes(1);
    const [category, slug, files] = api.save.mock.calls[0] as [
      string,
      string,
      Array<{ relPath: string; content: string }>,
    ];
    expect(category).toBe(UNSORTED_GROUP);
    expect(slug).toBe('漫画生成'); // frontmatter.name 优先于文件夹名
    expect(files.map((f) => f.relPath).sort()).toEqual(['SKILL.md', 'references/a.md']);
    expect(files.find((f) => f.relPath === 'references/a.md')?.content).toBe(
      '内容：references/a.md',
    );
    // 目录名前缀必须被剥掉，否则会写成 `漫画生成/references/a.md`（后端会当越界/错层）
    expect(files.find((f) => f.relPath === 'references/a.md')?.content).not.toContain('漫画生成/');
  });

  it('选了**装着多个包的上级目录** ⇒ 按"谁直接含 SKILL.md"切成多个包，且不串包', async () => {
    const files = [...pkg('P/X'), ...pkg('P/Y', ['name: Y技能'])];

    const r = await importSkillPackages(files);

    expect(r.ok).toBe(true);
    expect(api.save).toHaveBeenCalledTimes(2);
    const bySlug = new Map(
      api.save.mock.calls.map((c) => [
        c[1] as string,
        (c[2] as Array<{ relPath: string }>).map((f) => f.relPath).sort(),
      ]),
    );
    expect([...bySlug.keys()].sort()).toEqual(['Y技能', '漫画生成']);
    // X 的包只能有 X 的文件（串包 = 把别人的 references 一起写进去）
    for (const [, rels] of bySlug) expect(rels).toEqual(['SKILL.md', 'references/a.md']);
  });

  it('选中的目录没有 SKILL.md ⇒ 明确前置失败，且**一次写盘都不发**', async () => {
    const r = await importSkillPackages([{ relPath: '随便/a.md', content: 'x' }]);

    expect(r.ok).toBe(false);
    expect(r.error).toContain('没找到 SKILL.md');
    expect(api.save).not.toHaveBeenCalled();
  });

  it('二进制/隐藏文件不参与提交（否则一个 .DS_Store 就让整包写失败）', async () => {
    const r = await importSkillPackages([
      ...pkg('包'),
      { relPath: '包/.DS_Store', content: 'junk' },
      { relPath: '包/references/pic.png', content: 'junk' },
    ]);

    expect(r.ok).toBe(true);
    const files = api.save.mock.calls[0][2] as Array<{ relPath: string }>;
    expect(files.map((f) => f.relPath).sort()).toEqual(['SKILL.md', 'references/a.md']);
  });

  it('一个包失败不连坐：其余包照常导入，失败原因如实回报', async () => {
    api.save.mockResolvedValueOnce({ ok: false, message: '磁盘只读' }).mockResolvedValue(saveOk);

    const r = await importSkillPackages([...pkg('A'), ...pkg('B')]);

    expect(r.ok).toBe(false);
    expect(r.imported).toHaveLength(1);
    expect(r.failed).toHaveLength(1);
    expect(r.failed[0].message).toContain('磁盘只读');
  });

  it('已存在的同 id ⇒ 视为**整包覆盖**（提交集合即最终状态，不合并旧包）', async () => {
    writeSkillList([
      {
        kind: 'user',
        id: 'id-1',
        category: '旧组',
        slug: '旧名',
        name: '旧',
        description: '',
        content: 'x',
        contentHash: 'h',
      },
    ]);
    api.read.mockResolvedValue({
      ok: true,
      data: {
        category: '旧组',
        slug: '旧名',
        scope: 'package',
        files: [{ relPath: 'SKILL.md', encoding: 'utf8', content: '旧的' }],
      },
    });

    const r = await importSkillPackages(pkg('新文件夹', ['id: id-1', 'name: 新名']));

    expect(r.ok).toBe(true);
    expect(r.imported[0].updated).toBe(true); // 事前就存在 ⇒ 是更新不是新增
    const files = api.save.mock.calls[0][2] as Array<{ relPath: string; content: string }>;
    expect(files.map((f) => f.relPath).sort()).toEqual(['SKILL.md', 'references/a.md']);
    expect(files.find((f) => f.relPath === 'references/a.md')?.content).not.toContain('旧的');
    expect(readSkillList().list).toHaveLength(1); // 没有多出一份
  });

  it('落盘成功才进缓存（导入失败时缓存一字不改）', async () => {
    api.save.mockResolvedValue({ ok: false, message: '后端没起' });

    await importSkillPackages(pkg('X'));

    expect(readSkillList().list).toEqual([]);
  });

  it('入参为空 ⇒ 与"没找到 SKILL.md"同口径的前置失败（不抛）', async () => {
    const r = await importSkillPackages([]);
    expect(r.ok).toBe(false);
    expect(r.error).toBeTruthy();
  });
});

// 【本段随 TD-11-68 搬来】它此前住在 `skillCatalog.test.ts` 里 —— 而它断的是**本文件**的判据
// （单文件导入白名单，TD-11-52 从 legacy 壳迁入本模块）。测试住在被断对象的旁边才对得上。
describe('isSkillImportFile / skillNameFromFile（单文件导入白名单；实现住模块内，TD-11-52）', () => {
  it('`.md` / `.markdown` / `.txt` 收；其余不收（含大小写）', () => {
    for (const ok of ['a.md', 'a.markdown', 'a.txt', 'A.MD']) {
      expect(isSkillImportFile(ok), `${ok} 应可导入`).toBe(true);
    }
    for (const no of ['a.png', 'a.skill', 'a', 'a.md.bak', 'a.md.png']) {
      expect(isSkillImportFile(no), `${no} 不该被当 Skill 文件`).toBe(false);
    }
  });

  it('去扩展名得到 Skill 名（与白名单**同一口径**：正则只写一份）', () => {
    expect(skillNameFromFile('电商详情页.md')).toBe('电商详情页');
    expect(skillNameFromFile('漫画生成.markdown')).toBe('漫画生成');
  });

  it('**幂等**：已去过扩展名的名字再调它不掉字（`报告 v1.2` 不许被吃成 `报告 v1`）', () => {
    expect(skillNameFromFile('报告 v1.2')).toBe('报告 v1.2');
  });
});

describe('SKILL_IMPORT_ACCEPT（文件选择框的 accept：与白名单同一份取值）', () => {
  it('accept 列出的每一项都真能导入（不许"选择框钓你挑一个必然失败的文件"）', () => {
    const exts = SKILL_IMPORT_ACCEPT.split(',');

    expect(exts).toEqual(['.md', '.markdown', '.txt']);
    for (const ext of exts) expect(isSkillImportFile(`x${ext}`), `${ext} 应可导入`).toBe(true);
  });
});

// 【本节随 `importSkillText` 从 skillPersist.test.ts 搬来（TD-11-63 顺带）】
// 它断的是"导入不丢作者写的东西"——而导入用例已搬到白名单旁边（`skillImport.ts`）。
describe('importSkillText（导入不丢作者写的东西）', () => {
  it('剥掉 frontmatter 当正文，且未知字段原样带进新 frontmatter', async () => {
    const text = [
      '---',
      'name: 导入的技能',
      'description: 导入描述',
      'when-to-use: 用户要求 X 时',
      'x-author: 张三',
      '---',
      '',
      '正文第一行',
    ].join('\n');

    const r = await importSkillText('随便叫什么.md', text);

    expect(r.ok).toBe(true);
    const [, , files] = api.save.mock.calls[0] as [
      string,
      string,
      Array<{ relPath: string; content: string }>,
    ];
    const md = files[0].content;
    expect(md).toContain('name: 导入的技能');
    expect(md).toContain('when-to-use: 用户要求 X 时');
    expect(md).toContain('x-author: 张三'); // 未知字段不许丢
    expect(md).toMatch(/---\n\n正文第一行$/); // 正文里不再带 frontmatter
    const list = readSkillList().list as Array<Record<string, unknown>>;
    expect(list[0].name).toBe('导入的技能');
  });

  it('没有 frontmatter ⇒ 用文件名当名称（去掉白名单扩展名），全文当正文', async () => {
    await importSkillText('电商详情.md', '就一段正文');

    const [, slug, files] = api.save.mock.calls[0] as [
      string,
      string,
      Array<{ relPath: string; content: string }>,
    ];
    expect(slug).toBe('电商详情');
    expect(files[0].content).toContain('就一段正文');
  });

  it('名字里本来有点 ⇒ **不被吃**（面板传原文件名、设置页传已去扩展名，两种输入都原样保留 · TD-11-63）', async () => {
    // 面板那条调用点传的是 `File.name`（含扩展名）
    await importSkillText('报告 v1.2.md', '正文');
    expect(api.save.mock.calls[0][1], '原文件名 ⇒ 只掉白名单扩展名').toBe('报告 v1.2');

    api.save.mockClear();
    // 设置页那条调用点已先 `skillNameFromFile(f.name)` 去过一次 —— 再经本函数必须**幂等**
    await importSkillText('清单 v2.1', '正文');
    expect(api.save.mock.calls[0][1], '已去扩展名 ⇒ 不许再吃一段').toBe('清单 v2.1');
  });
});
