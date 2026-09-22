import { describe, it, expect, beforeEach, vi } from 'vitest';

// skillApi 是唯一网络边界：桩掉它，本测试只锁 hydrate / migration 的**判别与写入语义**。
// 用 vi.hoisted 拿 mock 句柄（vi.mock 会被提升到 import 之前，普通 const 会踩 TDZ）。
const api = vi.hoisted(() => ({ list: vi.fn(), read: vi.fn(), save: vi.fn() }));

vi.mock('../../src/components/agent/skill/store/skillApi.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../src/components/agent/skill/store/skillApi.ts')>()),
  listSkillPackages: api.list,
  // 「只取入口文件」是同一个读的轻量形态（TD-11-55 起漂移侦测也走它）⇒ 桩复用 `api.list`，
  // 但**参数照实现给**（用例要断"只取 SKILL.md"，参数若被桩吞掉那条断言就没意义了）。
  readDiskSkillPackages: () => api.list({ withContent: true, onlySkillMd: true }),
  readSkillPackage: api.read,
  saveSkillPackage: api.save,
}));

import {
  detectSkillDrift,
  reloadSkillsFromDisk,
} from '../../src/components/agent/skill/store/skillHydrate.ts';
import { migrateSkillsToDiskIfNeeded } from '../../src/components/agent/skill/store/skillMigration.ts';
import { UNSORTED_GROUP } from '../../src/components/agent/skill/rules/skillGroup.ts';
import {
  SKILLS_KEY,
  readSkillList,
  writeSkillList,
} from '../../src/components/agent/skill/store/skillRepository.ts';
import { contentClearCache, contentSet } from '../../src/components/base/core/contentStore.ts';

const ID = '11111111-1111-4111-8111-111111111111';

const mdWithId = [
  '---',
  `id: ${ID}`,
  'name: 漫画生成',
  'description: 生成分镜式漫画页',
  '---',
  '正文内容',
].join('\n');
const mdWithoutId = [
  '---',
  'name: 漫画生成',
  'description: 生成分镜式漫画页',
  '---',
  '正文内容',
].join('\n');

/** 造一个「一个包」的 list 响应 */
function libWith(md: string) {
  return {
    ok: true as const,
    data: {
      root: '/tmp/skills',
      groups: ['图片类'],
      packages: [
        {
          category: '图片类',
          slug: '漫画生成',
          files: ['SKILL.md'],
          contents: [{ relPath: 'SKILL.md', encoding: 'utf8' as const, content: md }],
        },
      ],
    },
  };
}

const emptyLib = { ok: true as const, data: { root: '/tmp/skills', groups: [], packages: [] } };

beforeEach(() => {
  localStorage.clear();
  contentClearCache(); // 清 contentStore 内存缓存，防跨测试污染
  api.list.mockReset();
  api.read.mockReset();
  api.save.mockReset();
});

describe('reloadSkillsFromDisk（磁盘 → 缓存）', () => {
  it('技能库为空 ⇒ 按「未决」处理：不写空、缓存原样保留', async () => {
    writeSkillList([{ id: 'skill_1', name: '旧的', description: '', content: 'x' }]);
    api.list.mockResolvedValue(emptyLib);

    const r = await reloadSkillsFromDisk();

    expect(r.changed).toBe(false);
    expect(r.loaded).toBe(0);
    // 【未决必须显式】否则 UI 只能拿 `changed:false` 说成"磁盘内容与缓存一致"，
    // 把"磁盘已经空了"谎报成"两边一样"（TD-11-18）
    expect(r.undecided).toBe(true);
    // 关键：一次误触手不能把缓存里的技能全抹掉
    expect(readSkillList().list).toHaveLength(1);
  });

  it('正常包 ⇒ 纳入缓存（正文只存 body，frontmatter 不进注入）', async () => {
    api.list.mockResolvedValue(libWith(mdWithId));

    const r = await reloadSkillsFromDisk();

    expect(r.ok).toBe(true);
    expect(r.loaded).toBe(1);
    const list = readSkillList().list as Array<Record<string, unknown>>;
    expect(list[0]).toMatchObject({
      kind: 'user',
      id: ID,
      category: '图片类',
      slug: '漫画生成',
      name: '漫画生成',
      description: '生成分镜式漫画页',
    });
    expect(list[0].content).toBe('正文内容');
    expect(String(list[0].contentHash)).not.toBe('');
  });

  it('缺 frontmatter id ⇒ 不猜身份：不纳入 + 如实列出', async () => {
    writeSkillList([{ id: 'skill_1', name: '旧的', description: '', content: 'x' }]);
    api.list.mockResolvedValue(libWith(mdWithoutId));

    const r = await reloadSkillsFromDisk();

    expect(r.loaded).toBe(0);
    expect(r.missingId).toEqual([{ category: '图片类', slug: '漫画生成' }]);
    // 缓存没被改写（不许给一个会变的身份，也不许把旧数据冲掉）
    expect(readSkillList().list).toHaveLength(1);
  });

  it('保留旧缓存里「磁盘上没有」的字段（aliases / source）', async () => {
    writeSkillList([
      {
        kind: 'user',
        id: ID,
        category: '图片类',
        slug: '漫画生成',
        name: '漫画生成',
        description: '生成分镜式漫画页',
        content: '正文内容',
        contentHash: '',
        aliases: ['skill_old'],
      },
    ]);
    api.list.mockResolvedValue(libWith(mdWithId));

    await reloadSkillsFromDisk();

    const list = readSkillList().list as Array<Record<string, unknown>>;
    expect(list[0].aliases).toEqual(['skill_old']);
  });

  it('内容未变 ⇒ changed=false（不做无意义写盘）', async () => {
    api.list.mockResolvedValue(libWith(mdWithId));

    const first = await reloadSkillsFromDisk();
    const second = await reloadSkillsFromDisk();

    expect(first.changed).toBe(true);
    expect(second.changed).toBe(false);
    // 这一次"没有变化"是**真的比对出来的结论**，不是未决
    expect(first.undecided).toBe(false);
    expect(second.undecided).toBe(false);
  });

  it('正文引用了包内没有的资料 ⇒ **装载期**就如实报（不等模型运行期调 skill_read_file 才发现）', async () => {
    api.list.mockResolvedValue(
      libWith(
        ['---', `id: ${ID}`, 'name: 漫画生成', '---', '先读 `references/风格.md` 再画'].join('\n'),
      ),
    );

    const r = await reloadSkillsFromDisk();

    // **分字段**（TD-11-46）：包**已纳入** ⇒ 进 `warnings`，**不许**进 `failures`
    // （混在一起时消费者只能说"N 个包未纳入"，而它们其实都进来了 —— 用户会去排查一个不存在的问题）
    expect(r.warnings.join('｜')).toContain('references/风格.md');
    expect(r.failures).toEqual([]);
    expect(r.ok).toBe(true); // 缺引用**不连坐**：该包照常纳入，只是如实把差集列出来
    expect(readSkillList().list).toHaveLength(1);
  });

  it('引用的资料确实在包里 ⇒ 不误报', async () => {
    api.list.mockResolvedValue({
      ok: true as const,
      data: {
        root: '/tmp/skills',
        groups: ['图片类'],
        packages: [
          {
            category: '图片类',
            slug: '漫画生成',
            files: ['SKILL.md', 'references/风格.md'],
            contents: [
              {
                relPath: 'SKILL.md',
                encoding: 'utf8' as const,
                content: [
                  '---',
                  `id: ${ID}`,
                  'name: 漫画生成',
                  '---',
                  '先读 `references/风格.md`',
                ].join('\n'),
              },
              {
                relPath: 'references/风格.md',
                encoding: 'utf8' as const,
                content: '冷调',
              },
            ],
          },
        ],
      },
    });

    const r = await reloadSkillsFromDisk();

    expect(r.failures).toEqual([]);
    expect(r.warnings).toEqual([]);
  });

  it('后端失败 ⇒ ok:false + 原样转发 message（不伪装成空库）', async () => {
    api.list.mockResolvedValue({ ok: false, message: '请求失败：HTTP 500' });

    const r = await reloadSkillsFromDisk();

    expect(r.ok).toBe(false);
    expect(r.error).toBe('请求失败：HTTP 500');
    expect(r.undecided).toBe(true); // 读不到 ⇒ 当然未决（调用方报的是"读不到"，不是"你没有技能"）
  });
});

describe('migrateSkillsToDiskIfNeeded（localStorage → 磁盘，一次性）', () => {
  it('磁盘已有包 ⇒ 幂等跳过：一次写盘都不发', async () => {
    api.list.mockResolvedValue(libWith(mdWithId));

    const r = await migrateSkillsToDiskIfNeeded();

    expect(r.skipped).toBe(true);
    expect(r.migrated).toBe(0);
    expect(api.save).not.toHaveBeenCalled();
  });

  it('缓存为空 ⇒ 跳过（没有要迁的东西）', async () => {
    api.list.mockResolvedValue(emptyLib);

    const r = await migrateSkillsToDiskIfNeeded();

    expect(r.skipped).toBe(true);
    expect(api.save).not.toHaveBeenCalled();
  });

  it('缓存有旧 Skill ⇒ 写盘 + 新 UUID 进 frontmatter + 旧 id 登记进 aliases（不改写旧键）', async () => {
    writeSkillList([
      { id: 'skill_1700000000000', name: '我的技能', description: '描述', content: '执行 XX' },
    ]);
    api.list.mockResolvedValue(emptyLib);
    api.save.mockResolvedValue({
      ok: true,
      data: { category: UNSORTED_GROUP, slug: '我的技能', written: 1 },
    });

    const r = await migrateSkillsToDiskIfNeeded();

    expect(r.migrated).toBe(1);
    expect(api.save).toHaveBeenCalledTimes(1);
    const [category, slug, files] = api.save.mock.calls[0] as [
      string,
      string,
      Array<{ relPath: string; content: string }>,
    ];
    expect(category).toBe(UNSORTED_GROUP);
    expect(slug).toBe('我的技能');
    expect(files[0].relPath).toBe('SKILL.md');
    // 新 id 必须写进 frontmatter（否则重启就换身份）
    expect(files[0].content).toMatch(/^---\nid: [0-9a-f-]{36}\n/);

    const list = readSkillList().list as Array<Record<string, unknown>>;
    expect(list).toHaveLength(1);
    expect(list[0].id).not.toBe('skill_1700000000000');
    expect(list[0].aliases).toEqual(['skill_1700000000000']);
    expect(list[0].content).toBe('执行 XX');
  });

  it('落盘失败 ⇒ 该条原样保留（不清不覆盖）+ 如实上报', async () => {
    writeSkillList([{ id: 'skill_1', name: '我的技能', description: '', content: '执行 XX' }]);
    api.list.mockResolvedValue(emptyLib);
    api.save.mockResolvedValue({ ok: false, message: '目录不存在' });

    const r = await migrateSkillsToDiskIfNeeded();

    expect(r.migrated).toBe(0);
    expect(r.ok).toBe(false);
    expect(r.failures).toEqual([{ id: 'skill_1', message: '目录不存在' }]);
    const list = readSkillList().list as Array<Record<string, unknown>>;
    expect(list[0].id).toBe('skill_1'); // 旧条目还在，用户仍能用
  });

  it('缓存形状违约（非数组）⇒ 不迁（避免把残缺列表固化到磁盘）', async () => {
    // 经**真实写入 API** 注入非数组值（直接 setItem 会被存储层的键/缓存机制绕过，测不到本层）。
    // 注意：**语法坏**的 JSON 在 contentStore 层与"真空"不可分（读不到即 null）⇒ 那不是本层能判的；
    // 本层能判的是「有值但形状不对」（跨版本结构变更 / 人工改过存储都会长这样）。
    contentSet(SKILLS_KEY, { a: 1 });
    contentClearCache();
    api.list.mockResolvedValue(emptyLib);

    const r = await migrateSkillsToDiskIfNeeded();

    expect(r.ok).toBe(false);
    expect(r.error).toBeTruthy();
    expect(api.save).not.toHaveBeenCalled();
  });
});

describe('detectSkillDrift（磁盘被外部改了 ⇒ 只提示，不擅自动缓存）', () => {
  it('磁盘正文变了 ⇒ 报出该 skill（用缓存里的名字，便于用户对上号）', async () => {
    api.list.mockResolvedValue(libWith(mdWithId));
    await reloadSkillsFromDisk(); // 建立基线（与 hydrate 同一把尺子：contentHash）
    api.list.mockResolvedValue(libWith(mdWithId.replace('正文内容', '改过的正文')));

    const r = await detectSkillDrift();

    expect(r.ok).toBe(true);
    expect(r.changed.map((c) => c.id)).toEqual([ID]);
    expect(r.changed[0].name).toBe('漫画生成');
    // 取数范围与判据匹配：只拉 `SKILL.md`（本函数只比它的正文指纹），不把 references/** 全量搬回来（TD-11-39）
    expect(api.list).toHaveBeenLastCalledWith({ withContent: true, onlySkillMd: true });
  });

  it('没变 ⇒ 不报（防假报：假报会让用户点一次「重载」却发现什么都没变）', async () => {
    api.list.mockResolvedValue(libWith(mdWithId));
    await reloadSkillsFromDisk();

    const r = await detectSkillDrift();

    expect(r.changed).toEqual([]);
  });

  it('**只读**：侦测后缓存一字不改（改不改由用户点「重新载入」决定）', async () => {
    api.list.mockResolvedValue(libWith(mdWithId));
    await reloadSkillsFromDisk();
    const before = JSON.stringify(readSkillList().list);
    api.list.mockResolvedValue(libWith(mdWithId.replace('正文内容', '外部改的')));

    await detectSkillDrift();

    expect(JSON.stringify(readSkillList().list)).toBe(before);
  });

  it('缓存为空 ⇒ 无基线：返回空且**连盘都不拉**（不是"没漂移"，是"无从判断"）', async () => {
    api.list.mockResolvedValue(libWith(mdWithId));

    const r = await detectSkillDrift();

    expect(r.ok).toBe(true);
    expect(r.changed).toEqual([]);
    expect(api.list).not.toHaveBeenCalled();
  });

  it('后端失败 ⇒ ok:false（绝不伪装成"无漂移"，否则用户以为一切正常）', async () => {
    api.list.mockResolvedValue(libWith(mdWithId));
    await reloadSkillsFromDisk();
    api.list.mockResolvedValue({ ok: false, message: '后端没起' });

    const r = await detectSkillDrift();

    expect(r.ok).toBe(false);
    expect(r.error).toContain('后端没起');
  });

  it('缺 frontmatter id 的新包不报（它压根没进缓存、没有基线，交给「重读 / 补齐 id」）', async () => {
    api.list.mockResolvedValue(libWith(mdWithId));
    await reloadSkillsFromDisk();
    api.list.mockResolvedValue(libWith(mdWithoutId));

    const r = await detectSkillDrift();

    expect(r.changed).toEqual([]);
  });
});
