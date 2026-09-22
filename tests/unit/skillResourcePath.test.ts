/**
 * `skillResourcePath` —— 模型**能读哪些文件**的唯一判据（TD-11-60 拆分后的四分之一）。
 *
 * 本文件锁的是安全面：读侧准入（含 `scripts/**` 整目录永不读）+ 正文引用提取。
 * 顺带锁"读侧与导入侧**共用同一张扩展名表**"（TD-11-34：两边曾各写一份且取值不同）。
 */
import { describe, it, expect } from 'vitest';
import {
  assertSafeSkillRelativePath,
  extractResourcePaths,
} from '../../src/components/agent/skill/skillResourcePath.ts';
// 导入侧准入：与读侧共用同一张扩展名表（本文件断的就是"两边取值一致"）
import { isImportablePackageFile } from '../../src/components/agent/skill/skillImport.ts';

describe('assertSafeSkillRelativePath（读资料的唯一准入判据）', () => {
  it('放行包内文本资料', () => {
    for (const ok of [
      'SKILL.md',
      'references/workflow.md',
      'references/art-styles/manga.md',
      'references/a.txt',
    ])
      expect(assertSafeSkillRelativePath(ok), ok).toBe(true);
  });

  it('拒绝绝对路径 / 上跳 / 隐式目录', () => {
    for (const bad of ['/etc/passwd', '../a.md', 'a/../../b.md', '.hidden/a.md', 'references/', ''])
      expect(assertSafeSkillRelativePath(bad), bad).toBe(false);
  });

  it('拒绝 scheme（含 windows 盘符）与反斜杠', () => {
    for (const bad of ['http://x/a.md', 'file:///a.md', 'C:/a.md', 'references\\a.md'])
      expect(assertSafeSkillRelativePath(bad), bad).toBe(false);
  });

  it('scripts/** 整目录永不读；非文本扩展名一律拒', () => {
    expect(assertSafeSkillRelativePath('scripts/run.sh')).toBe(false);
    expect(assertSafeSkillRelativePath('references/x.sh')).toBe(false);
    expect(assertSafeSkillRelativePath('references/noext')).toBe(false);
  });
});

describe('TEXT_RESOURCE_EXT（文本类扩展名：读侧与导入侧**同一张表**）', () => {
  it('改一处两边同时生效：`html`/`tsv` 读得到 ⇒ 也导得进（导入侧此前另写一份、少这两类 —— TD-11-34）', () => {
    expect(isImportablePackageFile('pkg/references/page.html')).toBe(true);
    expect(isImportablePackageFile('pkg/data.tsv')).toBe(true);
    expect(assertSafeSkillRelativePath('references/page.html')).toBe(true);
  });

  it('差异只在**用途**：导入侧收 `scripts/**`（随包保全在磁盘上），读侧禁（脚本永不进模型视野）', () => {
    expect(isImportablePackageFile('pkg/scripts/run.md')).toBe(true);
    expect(assertSafeSkillRelativePath('scripts/run.md')).toBe(false);
  });
});

describe('extractResourcePaths（只有正文显式写出的才可读）', () => {
  it('反引号 + markdown 链接都收，非法项丢弃，重复去重', () => {
    const body = [
      '先读 `references/workflow.md`，再看 `references/art-styles/manga.md`，',
      '另见 [规范](references/spec.md)，锚点形式 [X](references/spec.md#L1)，',
      '无效 `../evil.md`、`scripts/run.sh`、`references/x.sh`；重复 `references/workflow.md`。',
    ].join('');

    expect(extractResourcePaths(body)).toEqual([
      'references/workflow.md',
      'references/art-styles/manga.md',
      'references/spec.md',
    ]);
  });

  it('不带目录的引用不算资料路径（避免把普通代码片段当文件）', () => {
    expect(extractResourcePaths('用 `npm run dev` 和 `foo.md`')).toEqual([]);
  });

  it('空输入 → 空数组（不抛）', () => {
    expect(extractResourcePaths('')).toEqual([]);
  });
});
