import { describe, it, expect, beforeEach, vi } from 'vitest';

// skillApi 是唯一网络边界：桩掉它，本测试锁的是**写路径的顺序语义**（落盘优先 / 失败不动缓存）。
const api = vi.hoisted(() => ({
  list: vi.fn(),
  read: vi.fn(),
  save: vi.fn(),
  del: vi.fn(),
}));

vi.mock('../../src/components/agent/skill/skillApi.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../src/components/agent/skill/skillApi.ts')>()),
  listSkillPackages: api.list,
  readSkillPackage: api.read,
  saveSkillPackage: api.save,
  deleteSkillPackage: api.del,
}));

import {
  deleteSkillEverywhere,
  discardSkillFromIndex,
  restoreSkillFromIndex,
  saveSkillToDisk,
  skillMarkdownForExport,
} from '../../src/components/agent/skill/skillPersist.ts';
// `importSkillText` 已搬到 `skillImport.ts`（与"可导入扩展名白名单 + 去扩展名"同住，一份口径）
// —— 它的用例也随之搬到 `skillImport.test.ts`（测试住在被断对象旁边）。
import { contentFingerprint } from '../../src/components/base/core/utils.ts';
import { UNSORTED_GROUP } from '../../src/components/agent/skill/skillGroup.ts';
import { readSkillList, writeSkillList } from '../../src/components/agent/skill/skillRepository.ts';
import { contentClearCache } from '../../src/components/base/core/contentStore.ts';

const existing = (over: Record<string, unknown> = {}) => ({
  kind: 'user',
  id: 'id-1',
  category: '图片类',
  slug: '漫画生成',
  name: '漫画生成',
  description: '旧描述',
  content: '旧正文',
  contentHash: 'h-old',
  aliases: ['skill_old'],
  ...over,
});

const saveOk = { ok: true, data: { category: '图片类', slug: '漫画生成', written: 1 } };

beforeEach(() => {
  localStorage.clear();
  contentClearCache();
  api.list.mockReset();
  api.read.mockReset();
  api.save.mockReset();
  api.del.mockReset();
  api.list.mockResolvedValue({ ok: true, data: { root: '/r', groups: [], packages: [] } });
});

describe('saveSkillToDisk（先落盘成功，才回写缓存）', () => {
  it('新建：落盘后再进缓存，frontmatter 带新 UUID', async () => {
    api.save.mockResolvedValue(saveOk);

    const r = await saveSkillToDisk({ name: '我的技能', description: '描述', content: '正文' });

    expect(r.ok).toBe(true);
    expect(api.save).toHaveBeenCalledTimes(1);
    const [category, slug, files] = api.save.mock.calls[0] as [
      string,
      string,
      Array<{ relPath: string; content: string }>,
    ];
    expect(category).toBe(UNSORTED_GROUP);
    expect(slug).toBe('我的技能');
    expect(files[0].content).toMatch(/^---\nid: [0-9a-f-]{36}\n/);

    const list = readSkillList().list as Array<Record<string, unknown>>;
    expect(list).toHaveLength(1);
    expect(list[0].name).toBe('我的技能');
    expect(list[0].content).toBe('正文');
  });

  it('更新既有：先读整包，只替换 SKILL.md（references 原样保住）', async () => {
    writeSkillList([existing()]);
    api.read.mockResolvedValue({
      ok: true,
      data: {
        category: '图片类',
        slug: '漫画生成',
        scope: 'package',
        files: [
          { relPath: 'SKILL.md', encoding: 'utf8', content: '旧文件' },
          { relPath: 'references/manga.md', encoding: 'utf8', content: '网点规范' },
          { relPath: 'scripts/run.sh', encoding: 'utf8', content: 'echo hi' },
        ],
      },
    });
    api.save.mockResolvedValue(saveOk);

    const r = await saveSkillToDisk({
      id: 'id-1',
      name: '漫画生成',
      description: '新描述',
      content: '新正文',
    });

    expect(r.ok).toBe(true);
    expect(api.read).toHaveBeenCalledWith('图片类', '漫画生成', 'package');
    const [, , files] = api.save.mock.calls[0] as [
      string,
      string,
      Array<{ relPath: string; content: string }>,
    ];
    // 关键：不改整包语义 ⇒ 附带文件必须原样带过，只有 SKILL.md 变
    expect(files.map((f) => f.relPath).sort()).toEqual([
      'SKILL.md',
      'references/manga.md',
      'scripts/run.sh',
    ]);
    expect(files.find((f) => f.relPath === 'references/manga.md')?.content).toBe('网点规范');
    expect(files.find((f) => f.relPath === 'scripts/run.sh')?.content).toBe('echo hi');
    expect(files.find((f) => f.relPath === 'SKILL.md')?.content).toContain('新正文');
    // id 保持（改名换组都不该换身份）
    const list = readSkillList().list as Array<Record<string, unknown>>;
    expect(list[0].id).toBe('id-1');
    expect(list[0].description).toBe('新描述');
    expect(list[0].aliases).toEqual(['skill_old']); // 缓存里"磁盘上没有"的字段要带过
  });

  it('更新时保留磁盘上原有的 frontmatter（未知字段不被一次保存抹掉）', async () => {
    // `SKILL.md` 是整文件重建的 ⇒ 不带过磁盘上原有声明，用户/外部包写的 `x-author` 会被静默删除。
    writeSkillList([existing()]);
    api.read.mockResolvedValue({
      ok: true,
      data: {
        category: '图片类',
        slug: '漫画生成',
        scope: 'package',
        files: [
          {
            relPath: 'SKILL.md',
            encoding: 'utf8',
            content: [
              '---',
              'id: id-1',
              'name: 漫画生成',
              'x-author: 张三',
              'version: 2',
              '---',
              '旧正文',
            ].join('\n'),
          },
        ],
      },
    });
    api.save.mockResolvedValue(saveOk);

    const r = await saveSkillToDisk({
      id: 'id-1',
      name: '漫画生成',
      description: '新描述',
      content: '新正文',
    });

    expect(r.ok).toBe(true);
    const files = api.save.mock.calls[0][2] as Array<{ relPath: string; content: string }>;
    const md = files.find((f) => f.relPath === 'SKILL.md')?.content || '';
    expect(md).toContain('x-author: 张三'); // 未知字段带过
    expect(md).toContain('version: 2'); // 已知但本次没传的字段也带过
    expect(md).toContain('新正文');
    expect(md).toContain('id: id-1');
  });

  it('落盘失败 ⇒ 缓存一个字都不改（核心红线）', async () => {
    writeSkillList([existing()]);
    api.read.mockResolvedValue({
      ok: true,
      data: { category: '图片类', slug: '漫画生成', scope: 'package', files: [] },
    });
    api.save.mockResolvedValue({ ok: false, message: '磁盘只读' });

    const r = await saveSkillToDisk({
      id: 'id-1',
      name: '漫画生成',
      description: '新描述',
      content: '新正文',
    });

    expect(r.ok).toBe(false);
    expect(r.ok === false && r.message).toContain('磁盘只读');
    expect(r.ok === false && 'diskWritten' in r && r.diskWritten).toBeFalsy();
    const list = readSkillList().list as Array<Record<string, unknown>>;
    expect(list[0].description).toBe('旧描述'); // 没写盘就不许动缓存
    expect(list[0].content).toBe('旧正文');
  });

  it('磁盘已写成功但缓存回写失败 ⇒ 不谎报成功（diskWritten 标记）', async () => {
    api.save.mockResolvedValue(saveOk);
    // 模拟"存储写不进去"（配额爆/被禁）：直接让底层 setItem 抛错
    const spy = vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceeded');
    });

    const r = await saveSkillToDisk({ name: '我的技能', description: '', content: '正文' });

    spy.mockRestore();
    expect(r.ok).toBe(false);
    // 失败契约是判别联合（`ok:false` 有两支：半程成功 / 冲突）⇒ 取 `diskWritten` 前必须收窄
    if (r.ok === false && 'diskWritten' in r) {
      expect(r.diskWritten).toBe(true);
      expect(r.message).toContain('已写盘');
    } else {
      expect.unreachable('这条应当是"已写盘但缓存回写失败"那一支');
    }
  });
});

describe('deleteSkillEverywhere（先删磁盘，成功才动缓存）', () => {
  it('磁盘 404 = 本来就没有 ⇒ 不算失败，照常清缓存', async () => {
    writeSkillList([existing()]);
    api.del.mockResolvedValue({
      ok: false,
      message: 'Skill 包不存在',
      status: 404,
      notFound: true,
    });

    const r = await deleteSkillEverywhere('id-1');

    expect(r.ok).toBe(true);
    expect(readSkillList().list).toHaveLength(0);
  });

  it('磁盘删除真失败 ⇒ 不删缓存（否则磁盘留着、缓存没了 = 幽灵包）', async () => {
    writeSkillList([existing()]);
    api.del.mockResolvedValue({ ok: false, message: '权限不足', status: 500 });

    const r = await deleteSkillEverywhere('id-1');

    expect(r.ok).toBe(false);
    expect(readSkillList().list).toHaveLength(1);
  });

  it('旧条目没有磁盘形态（无 category/slug）⇒ 只清缓存且如实标注', async () => {
    writeSkillList([existing({ category: undefined, slug: undefined })]);

    const r = await deleteSkillEverywhere('id-1');

    expect(r.ok).toBe(true);
    expect(r.cacheOnly).toBe(true);
    expect(api.del).not.toHaveBeenCalled();
  });
});

describe('分组（组 = 技能库一级目录；新建时选组 / 编辑时换组）', () => {
  it('新建指定分组 ⇒ 落到该组（目录由整包写顺带创建，无需单独"建组"动作）', async () => {
    api.save.mockResolvedValue(saveOk);

    await saveSkillToDisk({
      name: '客户海报',
      description: '',
      content: '正文',
      category: '客户项目',
    });

    const [category, slug] = api.save.mock.calls[0] as [string, string];
    expect(category).toBe('客户项目');
    expect(slug).toBe('客户海报');
    const list = readSkillList().list as Array<Record<string, unknown>>;
    expect(list[0].category).toBe('客户项目');
  });

  it('分组名里的路径敌意字符被安全化（不许借组名越界，也不许前导点）', async () => {
    api.save.mockResolvedValue(saveOk);

    for (const raw of ['../etc', '.hidden', 'a\\b', 'a:b']) {
      api.save.mockClear();
      await saveSkillToDisk({ name: 'X', description: '', content: '正文', category: raw });
      const [category] = api.save.mock.calls[0] as [string, string];
      // 三条与后端 `isSafeSegment` 对齐的判据：无分隔符 / 无盘符冒号 / 不以 . 开头（否则后端 400）
      expect(category, raw).not.toContain('/');
      expect(category, raw).not.toContain('\\');
      expect(category, raw).not.toContain(':');
      expect(category.startsWith('.'), raw).toBe(false);
    }
  });

  it('换组 = 新位置写成功后才删旧包（顺序反了就等于"删了旧的还没写新的"）', async () => {
    writeSkillList([existing()]);
    api.read.mockResolvedValue({
      ok: true,
      data: {
        category: '图片类',
        slug: '漫画生成',
        scope: 'package',
        files: [{ relPath: 'SKILL.md', encoding: 'utf8', content: '旧文件' }],
      },
    });
    api.save.mockResolvedValue(saveOk);
    api.del.mockResolvedValue({
      ok: true,
      data: { category: '图片类', slug: '漫画生成', deleted: true },
    });

    const r = await saveSkillToDisk({
      id: 'id-1',
      name: '漫画生成',
      description: '描述',
      content: '新正文',
      category: '视频类',
    });

    expect(r.ok).toBe(true);
    expect(api.save.mock.calls[0][0]).toBe('视频类'); // 新位置
    expect(api.del).toHaveBeenCalledWith('图片类', '漫画生成'); // 再删旧位置
    const list = readSkillList().list as Array<Record<string, unknown>>;
    expect(list[0].category).toBe('视频类');
    expect(list[0].slug).toBe('漫画生成');
    expect(list[0].id).toBe('id-1'); // 换组不换身份（绑定/启用态都指着它）
  });

  it('输入的是**磁盘上已存在的分组名**（含 `*`）⇒ 原样落进去，不改名（TD-11-25）', async () => {
    writeSkillList([existing()]);
    api.list.mockResolvedValue({
      ok: true,
      data: { root: '/r', groups: ['客户*项目'], packages: [] },
    });
    api.read.mockResolvedValue({
      ok: true,
      data: {
        category: '图片类',
        slug: '漫画生成',
        scope: 'package',
        files: [{ relPath: 'SKILL.md', encoding: 'utf8', content: '旧文件' }],
      },
    });
    api.save.mockResolvedValue(saveOk);
    api.del.mockResolvedValue({ ok: true, data: { deleted: true } });

    const r = await saveSkillToDisk({
      id: 'id-1',
      name: '漫画生成',
      description: '描述',
      content: '正文',
      category: '客户*项目', // 用户从磁盘上已有的分组里选/填的
    });

    expect(r.ok).toBe(true);
    // 不许被 `slugifySkillName` 改成 `客户 项目`：那等于给一个真实存在的目录改名，技能会落到别处
    expect(api.save.mock.calls[0][0]).toBe('客户*项目');
    expect(api.save.mock.calls[0][1]).toBe('漫画生成'); // 只换组，目录名不动（身份是 id）
  });

  it('输入的是**新名字** ⇒ 仍走安全化（不把"后端会拒的名字"甩给用户）', async () => {
    api.save.mockResolvedValue({ ok: true, data: { category: '新 组', slug: '技能', written: 1 } });

    const r = await saveSkillToDisk({
      name: '技能',
      description: 'd',
      content: 'c',
      category: '新/组',
    });

    expect(r.ok).toBe(true);
    expect(api.save.mock.calls[0][0]).toBe('新 组');
  });

  it('清空「分组」框（显式空串）⇒ **移回未分组**（旧实现把空串与 undefined 折叠 ⇒ 永远移不回去）', async () => {
    writeSkillList([existing()]);
    api.read.mockResolvedValue({
      ok: true,
      data: {
        category: '图片类',
        slug: '漫画生成',
        scope: 'package',
        files: [{ relPath: 'SKILL.md', encoding: 'utf8', content: '旧文件' }],
      },
    });
    api.save.mockResolvedValue(saveOk);
    api.del.mockResolvedValue({ ok: true, data: { deleted: true } });

    const r = await saveSkillToDisk({
      id: 'id-1',
      name: '漫画生成',
      description: '旧描述',
      content: '正文',
      category: '', // ← 用户把「分组」框清空了 = 明确要求未分组
    });

    expect(r.ok).toBe(true);
    expect(api.save.mock.calls[0][0]).toBe(UNSORTED_GROUP); // 落到未分类
    expect(api.del).toHaveBeenCalledWith('图片类', '漫画生成'); // 旧位置此时才删（新位置写成功之后）
    const list = readSkillList().list as Array<Record<string, unknown>>;
    expect(list[0].category).toBe(UNSORTED_GROUP);
  });

  it('没提分组（`undefined`：导入 / 云写回）⇒ 保持既有分组不动（两态语义不同，不可折叠）', async () => {
    writeSkillList([existing()]);
    api.read.mockResolvedValue({
      ok: true,
      data: {
        category: '图片类',
        slug: '漫画生成',
        scope: 'package',
        files: [{ relPath: 'SKILL.md', encoding: 'utf8', content: '旧文件' }],
      },
    });
    api.save.mockResolvedValue(saveOk);

    const r = await saveSkillToDisk({
      id: 'id-1',
      name: '漫画生成',
      description: '旧描述',
      content: '正文',
    });

    expect(r.ok).toBe(true);
    expect(api.save.mock.calls[0][0]).toBe('图片类'); // 原地不动
    expect(api.del).not.toHaveBeenCalled();
  });

  it('同组保存（分组名没变）⇒ 不触发移动、不删任何东西', async () => {
    writeSkillList([existing()]);
    api.read.mockResolvedValue({
      ok: true,
      data: {
        category: '图片类',
        slug: '漫画生成',
        scope: 'package',
        files: [{ relPath: 'SKILL.md', encoding: 'utf8', content: '旧文件' }],
      },
    });
    api.save.mockResolvedValue(saveOk);

    await saveSkillToDisk({
      id: 'id-1',
      name: '漫画生成',
      description: '描述',
      content: '新正文',
      category: '图片类',
    });

    expect(api.del).not.toHaveBeenCalled();
  });

  it('新位置写成功但旧包删失败 ⇒ 如实报"磁盘上有两份"（不谎报成功）', async () => {
    writeSkillList([existing()]);
    api.read.mockResolvedValue({
      ok: true,
      data: {
        category: '图片类',
        slug: '漫画生成',
        scope: 'package',
        files: [{ relPath: 'SKILL.md', encoding: 'utf8', content: '旧文件' }],
      },
    });
    api.save.mockResolvedValue(saveOk);
    api.del.mockResolvedValue({ ok: false, message: '权限不足', status: 500 });

    const r = await saveSkillToDisk({
      id: 'id-1',
      name: '漫画生成',
      description: '描述',
      content: '新正文',
      category: '视频类',
    });

    expect(r.ok).toBe(false);
    if (r.ok === false && 'diskWritten' in r) {
      expect(r.diskWritten).toBe(true);
      expect(r.message).toContain('两份');
    } else {
      expect.unreachable('这条应当是"新位置已写、旧位置没删掉"那一支');
    }
    // 缓存**不动**：磁盘上旧包还在，若把缓存改成新组就会出现"缓存说在视频类、磁盘图片类里也有一份"
    const list = readSkillList().list as Array<Record<string, unknown>>;
    expect(list[0].category).toBe('图片类');
  });
});

describe('保存冲突（界面直接编辑磁盘 ⇒ 两个写者真实存在 · TD-11-44）', () => {
  /** 磁盘上当前的 `SKILL.md`（正文可参数化：用来造"外部改过"的情形） */
  const diskWith = (body: string) => ({
    ok: true as const,
    data: {
      category: '图片类',
      slug: '漫画生成',
      scope: 'package' as const,
      files: [
        {
          relPath: 'SKILL.md',
          encoding: 'utf8' as const,
          content: `---\nid: id-1\nname: 漫画生成\n---\n${body}`,
        },
      ],
    },
  });

  it('磁盘那一版被外部改过 ⇒ 返回 conflict、附磁盘正文，且**一个字都不写**', async () => {
    writeSkillList([existing()]);
    api.read.mockResolvedValue(diskWith('外部改过的正文'));
    api.save.mockResolvedValue(saveOk);

    const r = await saveSkillToDisk({
      id: 'id-1',
      name: '漫画生成',
      description: '我的描述',
      content: '我改的正文',
      baselineHash: contentFingerprint('旧正文'), // 界面渲染时看到的那一版
    });

    expect(r.ok).toBe(false);
    if (r.ok === false && 'conflict' in r) {
      expect(r.conflict).toBe(true);
      expect(r.diskContent).toBe('外部改过的正文'); // 用户可"放弃我的、加载磁盘版"
      expect(r.message).toContain('外部改动');
    } else {
      expect.unreachable('应当是冲突那一支');
    }
    expect(api.save).not.toHaveBeenCalled(); // 不静默覆盖：磁盘与索引都不许动
    expect((readSkillList().list as Array<Record<string, unknown>>)[0].content).toBe('旧正文');
  });

  it('基线一致（磁盘没被动过）⇒ 正常保存，不报冲突', async () => {
    writeSkillList([existing()]);
    api.read.mockResolvedValue(diskWith('旧正文'));
    api.save.mockResolvedValue(saveOk);

    const r = await saveSkillToDisk({
      id: 'id-1',
      name: '漫画生成',
      description: '我的描述',
      content: '我改的正文',
      baselineHash: contentFingerprint('旧正文'),
    });

    expect(r.ok).toBe(true);
    expect(api.save).toHaveBeenCalledTimes(1);
  });

  it('用户选「用我的覆盖」⇒ `allowOverwrite` 放行', async () => {
    writeSkillList([existing()]);
    api.read.mockResolvedValue(diskWith('外部改过的正文'));
    api.save.mockResolvedValue(saveOk);

    const r = await saveSkillToDisk({
      id: 'id-1',
      name: '漫画生成',
      description: '我的描述',
      content: '我改的正文',
      baselineHash: contentFingerprint('旧正文'),
      allowOverwrite: true,
    });

    expect(r.ok).toBe(true);
    expect(api.save).toHaveBeenCalledTimes(1);
  });

  it('不给 baselineHash（新建 / 导入 / 云写回）⇒ 不做冲突检测（不在"编辑某一版"的语境里）', async () => {
    writeSkillList([existing()]);
    api.read.mockResolvedValue(diskWith('外部改过的正文'));
    api.save.mockResolvedValue(saveOk);

    const r = await saveSkillToDisk({
      id: 'id-1',
      name: '漫画生成',
      description: '描述',
      content: '新正文',
    });

    expect(r.ok).toBe(true);
    expect(api.save).toHaveBeenCalledTimes(1);
  });
});

describe('导出 = 磁盘那个文件逐字（导出/导入对称 · TD-11-70）', () => {
  const diskMd = [
    '---',
    'id: id-1',
    'name: 漫画生成',
    'allowed-tools: a, b',
    'user-invocable: false',
    'x-keep: v',
    '---',
    '正文',
  ].join('\n');

  it('读磁盘的 `SKILL.md` 并**逐字**给出（`allowed-tools` / 布尔 / `unknown` 一个不丢）', async () => {
    writeSkillList([existing()]);
    api.read.mockResolvedValue({
      ok: true,
      data: {
        category: '图片类',
        slug: '漫画生成',
        scope: 'content',
        files: [{ relPath: 'SKILL.md', encoding: 'utf8', content: diskMd }],
      },
    });

    const md = await skillMarkdownForExport('id-1');

    expect(md).toBe(diskMd); // 逐字：导出的是**那个文件**，不是我们重拼的一份
    // 下面这些字段在"从缓存重拼"的旧实现下**全都会丢**（缓存只留 5 个字段）⇒ 导出→再导入即残缺
    expect(md).toContain('allowed-tools: a, b');
    expect(md).toContain('user-invocable: false');
    expect(md).toContain('x-keep: v');
  });

  it('磁盘读不到 / 没有磁盘包 ⇒ `null`（由调用方**如实说**降级到"仅正文"，不悄悄给残缺 frontmatter）', async () => {
    writeSkillList([existing()]);
    api.read.mockResolvedValue({
      ok: false,
      message: 'Skill 包不存在',
      status: 404,
      notFound: true,
    });

    expect(await skillMarkdownForExport('id-1')).toBeNull();
  });
});

describe('恢复 / 丢弃（索引里那份可能是最后一份正文 · TD-11-44）', () => {
  it('恢复：用索引的正文重建磁盘包，并**落回原路径**（不让位成 -2）', async () => {
    writeSkillList([existing()]);
    api.read.mockResolvedValue({
      ok: false,
      message: 'Skill 包不存在',
      status: 404,
      notFound: true,
    });
    api.save.mockResolvedValue(saveOk);

    const r = await restoreSkillFromIndex('id-1');

    expect(r.ok).toBe(true);
    const [category, slug, files] = api.save.mock.calls[0] as [
      string,
      string,
      Array<{ relPath: string; content: string }>,
    ];
    expect(category).toBe('图片类');
    expect(slug).toBe('漫画生成'); // ← 排除"它自己"的占用，才落得回原路径
    expect(files[0].content).toContain('旧正文');
    expect(files[0].content).toContain('id: id-1'); // 身份不变
  });

  it('落点目录名非法 ⇒ 在**产出点**就拒绝（`slug` 第二入口的围栏，TD-11-53）', async () => {
    writeSkillList([existing()]);
    api.read.mockResolvedValue({
      ok: false,
      message: 'Skill 包不存在',
      status: 404,
      notFound: true,
    });
    api.save.mockResolvedValue(saveOk);

    for (const bad of ['../escape', '.hidden', 'a/b', ' x ', 'x'.repeat(65)]) {
      const r = await saveSkillToDisk({
        id: 'id-1',
        name: '漫画生成',
        description: 'd',
        content: '正文',
        slug: bad,
      });
      expect(r.ok, `${bad} 应被拒`).toBe(false);
      if (r.ok === false) expect(r.message).toContain('落点目录名非法');
    }
    expect(api.save).not.toHaveBeenCalled(); // 一个包都没写
  });

  it('丢弃：只把条目移出索引，**不碰磁盘**', async () => {
    writeSkillList([existing()]);

    const r = discardSkillFromIndex('id-1');

    expect(r.ok).toBe(true);
    expect(readSkillList().list).toHaveLength(0);
    expect(api.del).not.toHaveBeenCalled();
  });
});
