/**
 * `skillApi` 的**取数范围**契约（TD-11-39 / TD-11-59 / TD-11-65）。
 *
 * 【为什么必须有这个文件（探针逼出来的）】最初"漂移侦测只取 `SKILL.md`"这条断言写在
 * `skillHydrate.test.ts` 里，但那个文件**必须把 `readDiskSkillPackages` 桩掉**（否则单测会真连后端）
 * ⇒ 断言实际测的是**我自己的桩**（自证式断言）：把真实实现改回"全量拉 references"，
 * 那条断言**照样绿**（实测：探针 0 红）。⇒ 取数范围这一层要**打到真实实现**（只 mock HTTP），
 * 断言的是**拼出来的 URL**（"只取入口文件"就落在 `only=` 这个查询参数上）。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SKILL_ENTRY_FILE } from '../../src/components/agent/skill/rules/skillEntry.ts';

const http = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock('../../src/components/base/api/httpClient.ts', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  httpRequest: http.request,
}));

import {
  listSkillPackages,
  readDiskSkillPackages,
  readSkillLibrary,
} from '../../src/components/agent/skill/store/skillApi.ts';

const env = (data: unknown) => ({ code: 0, data });

beforeEach(() => {
  http.request.mockReset();
  http.request.mockResolvedValue(env({ root: '/r', groups: [], packages: [] }));
});

const lastUrl = () => String(http.request.mock.calls.at(-1)?.[0] ?? '');

describe('skillApi · 取数范围（URL 即契约）', () => {
  it('读整个技能库（画列表 / 编辑）：带 `withContent=1`，**不**限 `only`', async () => {
    await readSkillLibrary();

    expect(lastUrl()).toContain('/api/skills');
    expect(lastUrl()).toContain('withContent=1');
    expect(lastUrl()).not.toContain('only=');
  });

  it('「只取入口文件」（漂移侦测 / 云写回 / 取用面共用）：`only=` 就是入口文件名常量', async () => {
    await readDiskSkillPackages();

    expect(lastUrl()).toContain('withContent=1');
    // 取值必须来自 `SKILL_ENTRY_FILE`（不是手抄的 'SKILL.md'）—— 与后端 `only` 的比对口径同源
    expect(lastUrl()).toContain(`only=${SKILL_ENTRY_FILE}`);
  });

  it('不带内容（只列清单）：连 `withContent` 都不带（别让后端白读一堆正文）', async () => {
    await listSkillPackages();

    expect(lastUrl()).toContain('/api/skills');
    expect(lastUrl()).not.toContain('withContent');
  });

  it('失败按事实收敛：`{ok:false, message, status, notFound}`（404 = 磁盘上本来就没有它）', async () => {
    http.request.mockRejectedValue(Object.assign(new Error('Skill 包不存在'), { status: 404 }));

    const r = await readSkillLibrary();

    expect(r.ok).toBe(false);
    if (r.ok === false) {
      expect(r.status).toBe(404);
      expect(r.notFound).toBe(true); // 调用方按**事实**分支，不去猜 message 文案
    }
  });
});
