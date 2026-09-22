import { describe, it, expect, beforeEach, vi } from 'vitest';

// skillApi 是唯一网络边界：桩掉它，本测试锁的是**安全判据与回报话术**（不外发、不猜）。
const api = vi.hoisted(() => ({ read: vi.fn() }));

vi.mock('../../src/components/agent/skill/skillApi.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../src/components/agent/skill/skillApi.ts')>()),
  readSkillPackage: api.read,
}));

import {
  readSkillResource,
  setSkillTurnBindings,
} from '../../src/components/agent/skill/skillResource.ts';
import { writeSkillConfig } from '../../src/components/agent/skill/skillRepository.ts';
import { contentClearCache } from '../../src/components/base/core/contentStore.ts';
import type { SkillBinding } from '../../src/components/agent/skill/skillTypes.ts';

/** 造一个绑定；正文默认引用 references/风格.md */
function binding(over: Partial<SkillBinding> = {}): SkillBinding {
  return {
    skillId: 'id-1',
    name: '漫画生成',
    contentHash: 'h',
    content: '先读 `references/风格.md`，再按它执行。',
    origin: 'user',
    category: '图片类',
    slug: '漫画生成',
    ...over,
  };
}

/** 造一个"读到该文件"的后端响应 */
function pkgWith(relPath: string, content: string, encoding: 'utf8' | 'base64' = 'utf8') {
  return {
    ok: true as const,
    data: {
      category: '图片类',
      slug: '漫画生成',
      scope: 'content' as const,
      files: [{ relPath, encoding, content }],
    },
  };
}

beforeEach(() => {
  localStorage.clear();
  contentClearCache();
  setSkillTurnBindings(null);
  api.read.mockReset();
});

describe('readSkillResource（按需读附属资料）', () => {
  it('本轮没有启用 Skill ⇒ 拒绝，且**一次盘都不拉**', async () => {
    const r = await readSkillResource('references/风格.md');

    expect(r.ok).toBe(false);
    expect(r.error).toContain('本轮没有启用 Skill');
    expect(api.read).not.toHaveBeenCalled();
  });

  it('发送结束清空绑定后 ⇒ 读不到上一轮的文件（防串轮）', async () => {
    setSkillTurnBindings([binding()]);
    setSkillTurnBindings(null);

    const r = await readSkillResource('references/风格.md');

    expect(r.ok).toBe(false);
    expect(api.read).not.toHaveBeenCalled();
  });

  it('正文**没有引用**这个文件 ⇒ 拒绝，并列出可读项（"包内任意可读"是另一种攻击面）', async () => {
    setSkillTurnBindings([binding()]);

    const r = await readSkillResource('references/秘密.md');

    expect(r.ok).toBe(false);
    expect(r.error).toContain('正文里没有引用');
    expect(r.error).toContain('references/风格.md'); // 把可读的告诉它，模型才能自己改对
    expect(api.read).not.toHaveBeenCalled();
  });

  it('路径准入：scripts/** 与上跳一律拒（连盘都不碰）', async () => {
    setSkillTurnBindings([
      binding({ content: '看 `scripts/run.sh` 与 `../x.md` 与 `references/a.png`' }),
    ]);

    for (const bad of ['scripts/run.sh', '../x.md', 'references/a.png']) {
      const r = await readSkillResource(bad);
      expect(r.ok, bad).toBe(false);
      expect(r.error).toContain('路径不允许');
    }
    expect(api.read).not.toHaveBeenCalled();
  });

  it('正常读：返回内容，并带回 skill/path（供模型对账）', async () => {
    setSkillTurnBindings([binding()]);
    api.read.mockResolvedValue(pkgWith('references/风格.md', '网点与低饱和'));

    const r = await readSkillResource('references/风格.md');

    expect(r.ok).toBe(true);
    expect(r.skill).toBe('漫画生成');
    expect(r.path).toBe('references/风格.md');
    expect(r.content).toBe('网点与低饱和');
    expect(r.truncated).toBe(false);
    expect(api.read).toHaveBeenCalledWith('图片类', '漫画生成', 'content');
  });

  it('超长资料被截断，并**如实标记** truncated（否则模型会把截断版当全文）', async () => {
    writeSkillConfig({
      contentLimits: { singleSkillChars: 4, expansionTotalChars: 100, maxExplicitBindings: 4 },
    });
    setSkillTurnBindings([binding()]);
    api.read.mockResolvedValue(pkgWith('references/风格.md', '一二三四五六七八'));

    const r = await readSkillResource('references/风格.md');

    expect(r.ok).toBe(true);
    expect(r.truncated).toBe(true);
    expect(r.content).toContain('一二三四');
    expect(r.content).not.toContain('五六七八');
  });

  it('包内没有该文件 ⇒ 明确说"没有"（不静默回空内容）', async () => {
    setSkillTurnBindings([binding()]);
    api.read.mockResolvedValue(pkgWith('references/别的.md', 'x'));

    const r = await readSkillResource('references/风格.md');

    expect(r.ok).toBe(false);
    expect(r.error).toContain('技能包里没有');
  });

  it('二进制资料 ⇒ 明确拒（只支持文本）', async () => {
    setSkillTurnBindings([binding()]);
    api.read.mockResolvedValue(pkgWith('references/风格.md', 'AAAA', 'base64'));

    const r = await readSkillResource('references/风格.md');

    expect(r.ok).toBe(false);
    expect(r.error).toContain('二进制');
  });

  it('本轮启用多个 Skill 且未指明 ⇒ 拒绝（歧义不猜：猜错会读到另一个技能的同类文件）', async () => {
    setSkillTurnBindings([binding(), binding({ skillId: 'id-2', name: '视频生成' })]);

    const r = await readSkillResource('references/风格.md');

    expect(r.ok).toBe(false);
    expect(r.error).toContain('请用 id 指明');
    expect(api.read).not.toHaveBeenCalled();
  });

  it('用名字或 id 指明 ⇒ 只读那一个', async () => {
    setSkillTurnBindings([
      binding(),
      binding({ skillId: 'id-2', name: '视频生成', category: '视频类', slug: '视频生成' }),
    ]);
    api.read.mockResolvedValue({
      ok: true,
      data: {
        category: '视频类',
        slug: '视频生成',
        scope: 'content',
        files: [{ relPath: 'references/风格.md', encoding: 'utf8', content: '视频版' }],
      },
    });

    const byId = await readSkillResource('references/风格.md', 'id-2');

    expect(byId.ok).toBe(true);
    expect(byId.content).toBe('视频版');
    expect(api.read).toHaveBeenCalledWith('视频类', '视频生成', 'content');
  });

  it('指明的 Skill 不在本轮 ⇒ 拒绝并列出本轮启用的是哪些', async () => {
    setSkillTurnBindings([binding()]);

    const r = await readSkillResource('references/风格.md', '不存在的技能');

    expect(r.ok).toBe(false);
    expect(r.error).toContain('本轮启用的是：漫画生成');
  });

  it('没有磁盘落点（如面板里拖入的 .md）⇒ 明确说读不了，而不是报"文件不存在"', async () => {
    setSkillTurnBindings([binding({ category: undefined, slug: undefined })]);

    const r = await readSkillResource('references/风格.md');

    expect(r.ok).toBe(false);
    expect(r.error).toContain('不在磁盘上');
    expect(api.read).not.toHaveBeenCalled();
  });

  it('后端失败 ⇒ 原样透传原因（不伪装成"文件不存在"）', async () => {
    setSkillTurnBindings([binding()]);
    api.read.mockResolvedValue({ ok: false, message: '后端没起' });

    const r = await readSkillResource('references/风格.md');

    expect(r.ok).toBe(false);
    expect(r.error).toContain('后端没起');
  });

  it('缺 path ⇒ 明确的用法提示（不抛）', async () => {
    setSkillTurnBindings([binding()]);

    const r = await readSkillResource(undefined);

    expect(r.ok).toBe(false);
    expect(r.error).toContain('缺少 path');
  });
});
