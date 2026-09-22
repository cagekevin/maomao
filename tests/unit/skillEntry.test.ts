/**
 * `skillEntry` —— 技能包**入口文件**的唯一口径（TD-11-59）。
 *
 * 本文件锁的是那两件曾经散落的事：
 *  · `find(f => f.relPath === 'SKILL.md')` 抄了 7 遍 ⇒ 收成 `findSkillEntryFile`（任一处写错就静默少一个包）；
 *  · `<分类>/<目录名>/SKILL.md` 拼了两遍 ⇒ 收成 `skillEntryRelPath`（拼法一分歧，界面给的路径就找不到文件）。
 * 跨栈那半（与后端同名常量必须相等）由 `check:arch` 的 `CROSS_STACK_CONSTS` 对账，本文件只锁"值本身"。
 */
import { describe, it, expect } from 'vitest';
import {
  SKILL_ENTRY_FILE,
  findSkillEntryFile,
  skillEntryRelPath,
} from '../../src/components/agent/skill/rules/skillEntry.ts';
import type { SkillPackageFile } from '../../src/components/agent/skill/skillTypes.ts';

const f = (
  relPath: string,
  content = '正文',
  encoding: 'utf8' | 'base64' = 'utf8',
): SkillPackageFile => ({
  relPath,
  encoding,
  content,
});

describe('skillEntry（入口文件唯一口径 · TD-11-59）', () => {
  it('入口文件名就是 `SKILL.md`（改它必须同时改后端同名常量 —— 跨栈对账会拦）', () => {
    expect(SKILL_ENTRY_FILE).toBe('SKILL.md');
  });

  it('findSkillEntryFile：按名字取出入口文件（**不是**"第一个文件"、也不是"名字含它"）', () => {
    const files = [f('references/风格.md'), f(SKILL_ENTRY_FILE, '入口正文'), f('scripts/run.ts')];

    expect(findSkillEntryFile(files)?.content).toBe('入口正文');
    // 名字里含 `SKILL.md` 但不是入口文件的，不许被当成它
    expect(findSkillEntryFile([f('SKILL.md.bak')])).toBeNull();
    expect(findSkillEntryFile([f('references/SKILL.md')])).toBeNull();
  });

  it('缺入口文件 / 没带 contents ⇒ `null`（不是 undefined：调用方统一判空）', () => {
    expect(findSkillEntryFile([f('references/a.md')])).toBeNull();
    expect(findSkillEntryFile(undefined)).toBeNull();
    expect(findSkillEntryFile([])).toBeNull();
  });

  it('binary 入口文件也照实返回（由调用方按 `encoding` 决定能不能读，本层不替它判）', () => {
    expect(findSkillEntryFile([f(SKILL_ENTRY_FILE, 'AAEC', 'base64')])?.encoding).toBe('base64');
  });

  it('skillEntryRelPath：`<分类>/<目录名>/SKILL.md`（界面显示的路径 = 磁盘落点）', () => {
    expect(skillEntryRelPath('图片类', '漫画生成')).toBe('图片类/漫画生成/SKILL.md');
    expect(skillEntryRelPath('图片类', '漫画生成').endsWith(SKILL_ENTRY_FILE)).toBe(true);
  });
});
