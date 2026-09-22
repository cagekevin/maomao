import { describe, it, expect, beforeEach, vi } from 'vitest';

// skillApi 是唯一网络边界：桩掉它，本测试锁的是「谁该写回、谁必须被保护」的判据。
const api = vi.hoisted(() => ({ list: vi.fn(), read: vi.fn(), save: vi.fn() }));

vi.mock('../../src/components/agent/skill/skillApi.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../src/components/agent/skill/skillApi.ts')>()),
  listSkillPackages: api.list,
  // 「只取入口文件」是同一个读的轻量形态（TD-11-65 起云写回也走它）⇒ 桩复用 `api.list`，
  // 参数照实现给（用例要断"只取 SKILL.md"，参数被桩吞掉那条断言就没意义了）
  readDiskSkillPackages: () => api.list({ withContent: true, onlySkillMd: true }),
  readSkillPackage: api.read,
  saveSkillPackage: api.save,
}));

import { applyCloudSkillsToDisk } from '../../src/components/agent/skill/skillCloudSync.ts';
import { contentFingerprint } from '../../src/components/base/core/utils.ts';
import { readSkillList, writeSkillList } from '../../src/components/agent/skill/skillRepository.ts';
import { contentClearCache } from '../../src/components/base/core/contentStore.ts';

const ID = 'id-1';
const CLOUD_BODY = '云端最新正文';
const DISK_OLD_BODY = '磁盘上的旧正文';

/** 缓存里的技能（= 刚从云端拉下来的那一份） */
const cloudEntry = (over: Record<string, unknown> = {}) => ({
  kind: 'user',
  id: ID,
  category: '图片类',
  slug: '漫画生成',
  name: '漫画生成',
  description: '描述',
  content: CLOUD_BODY,
  contentHash: contentFingerprint(CLOUD_BODY),
  ...over,
});

/** 磁盘上的包（正文可指定，用于制造"一致/不一致"） */
const diskLib = (body: string, id = ID) => ({
  ok: true as const,
  data: {
    root: '/r',
    groups: ['图片类'],
    packages: [
      {
        category: '图片类',
        slug: '漫画生成',
        files: ['SKILL.md'],
        contents: [
          {
            relPath: 'SKILL.md',
            encoding: 'utf8' as const,
            content: ['---', `id: ${id}`, 'name: 漫画生成', '---', body].join('\n'),
          },
        ],
      },
    ],
  },
});
const emptyLib = { ok: true as const, data: { root: '/r', groups: [], packages: [] } };

const saveOk = { ok: true, data: { category: '图片类', slug: '漫画生成', written: 1 } };

beforeEach(() => {
  localStorage.clear();
  contentClearCache();
  api.list.mockReset();
  api.read.mockReset();
  api.save.mockReset();
  api.save.mockResolvedValue(saveOk);
  api.read.mockResolvedValue({
    ok: true,
    data: {
      category: '图片类',
      slug: '漫画生成',
      scope: 'package',
      files: [{ relPath: 'SKILL.md', encoding: 'utf8', content: '---\nid: id-1\n---\n旧' }],
    },
  });
});

describe('applyCloudSkillsToDisk（云拉取后写回磁盘）', () => {
  it('磁盘与云端一致 ⇒ 一个包都不写（省往返，也不让台账基线漂移）', async () => {
    writeSkillList([cloudEntry()]);
    api.list.mockResolvedValue(diskLib(CLOUD_BODY));

    const r = await applyCloudSkillsToDisk();

    expect(r).toMatchObject({ ok: true, written: 0, already: 1 });
    expect(api.save).not.toHaveBeenCalled();
  });

  it('磁盘是旧的（或无包）⇒ 写回，且写进去的是**云端正文**', async () => {
    writeSkillList([cloudEntry()]);
    api.list.mockResolvedValue(diskLib(DISK_OLD_BODY));

    const r = await applyCloudSkillsToDisk();

    expect(r).toMatchObject({ ok: true, written: 1, already: 0 });
    expect(api.save).toHaveBeenCalledTimes(1);
    const [category, slug, files] = api.save.mock.calls[0] as [
      string,
      string,
      Array<{ relPath: string; content: string }>,
    ];
    expect(category).toBe('图片类');
    expect(slug).toBe('漫画生成'); // 落点不变（目录名不是身份）
    expect(files.find((f) => f.relPath === 'SKILL.md')?.content).toContain(CLOUD_BODY);
  });

  it('本地磁盘有未回灌的改动 ⇒ **跳过写回**并如实上报（不静默覆盖用户刚写的东西）', async () => {
    writeSkillList([cloudEntry()]);
    api.list.mockResolvedValue(diskLib(DISK_OLD_BODY));

    const r = await applyCloudSkillsToDisk({ protectIds: new Set([ID]) });

    expect(r.written).toBe(0);
    expect(r.protected).toEqual(['漫画生成']);
    expect(api.save).not.toHaveBeenCalled();
  });

  it('写回时 id 不变（身份不换：启用态/绑定都指着它）', async () => {
    writeSkillList([cloudEntry()]);
    api.list.mockResolvedValue(emptyLib);

    await applyCloudSkillsToDisk();

    const files = api.save.mock.calls[0][2] as Array<{ relPath: string; content: string }>;
    expect(files.find((f) => f.relPath === 'SKILL.md')?.content).toContain(`id: ${ID}`);
  });

  it('一个包失败不连坐：其余照常写回，失败原因如实回报', async () => {
    writeSkillList([cloudEntry(), cloudEntry({ id: 'id-2', slug: '另一个', name: '另一个' })]);
    api.list.mockResolvedValue(emptyLib);
    api.save.mockResolvedValueOnce({ ok: false, message: '磁盘只读' }).mockResolvedValue(saveOk);

    const r = await applyCloudSkillsToDisk();

    expect(r.ok).toBe(false);
    expect(r.written).toBe(1);
    expect(r.failed).toHaveLength(1);
    expect(r.failed[0].message).toContain('磁盘只读');
  });

  it('缓存损坏 ⇒ 前置失败，一个包都不写', async () => {
    localStorage.setItem('yimao:agent_skills', '{"broken":');
    contentClearCache();

    const r = await applyCloudSkillsToDisk();

    expect(r.ok).toBe(false);
    expect(r.error).toBeTruthy();
    expect(api.save).not.toHaveBeenCalled();
  });

  it('技能库读不到（后端没起）⇒ 前置失败，不写任何包（不假装写回成功）', async () => {
    writeSkillList([cloudEntry()]);
    api.list.mockResolvedValue({ ok: false, message: '后端没起' });

    const r = await applyCloudSkillsToDisk();

    expect(r.ok).toBe(false);
    expect(r.error).toContain('后端没起');
    expect(api.save).not.toHaveBeenCalled();
  });

  it('形状不全的条目（缺 id/name/content）**计入 failed**（差额必须可见），但不中断其余 —— TD-11-24', async () => {
    writeSkillList([{ id: '', name: '', content: '' }, cloudEntry()]);
    api.list.mockResolvedValue(emptyLib);

    const r = await applyCloudSkillsToDisk();

    expect(r.written).toBe(1);
    // 【旧实现只有一句 `continue`】⇒ 云端拉回 2 条、实写 1 条，用户看不到差额（以为全收敛了）
    expect(r.failed).toHaveLength(1);
    expect(r.failed[0].message).toContain('未写回磁盘');
    expect(readSkillList().list).toHaveLength(2); // 残缺条目原样留着，不静默删
  });
});
