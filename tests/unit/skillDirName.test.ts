/**
 * `skillDirName` —— 磁盘目录名的规则（TD-11-60 拆分后的四分之一）。
 *
 * 锁的是**跨栈对齐面**：前端产出/放行的名字必须是后端 `isSafeSegment` 一定能收的
 * （不然用户在"保存"这一步才吃到一个难懂的 400，而错误离成因已经很远）。
 */
import { describe, it, expect } from 'vitest';
import {
  isLegalDirSegment,
  slugifySkillName,
  uniqueSlugIn,
} from '../../src/components/agent/skill/rules/skillDirName.ts';

describe('slugifySkillName（只用于**新造**名字；产出必须被后端 isSafeSegment 接受）', () => {
  it('路径敌意字符 / 控制字符被剥、前导点去掉、空白压平', () => {
    expect(slugifySkillName('  a/b:c  ')).toBe('a b c');
    expect(slugifySkillName('..隐藏')).toBe('隐藏');
    expect(slugifySkillName('a\u0000b')).toBe('a b');
    expect(slugifySkillName('   ')).toBe('未命名');
  });

  it('`*?"<>|` 会被剥（POSIX 合法、Windows 建不出来）⇒ **已有磁盘组名不许经它**（TD-11-25）', () => {
    // 这条同时说明"为什么必须有 resolveGroupName"：经它一转，`客户*项目` 就变成了另一个目录名，
    // 技能会落到别处（用户看到"明明有这个分组却进了别处"）。
    expect(slugifySkillName('客户*项目')).toBe('客户 项目');
  });

  it('截断到 64 字后**不留尾空格**（否则后端判"前后空白"直接 400）', () => {
    const s = slugifySkillName(`${'a'.repeat(63)} b`);

    expect(s.length).toBeLessThanOrEqual(64);
    expect(s).toBe(s.trim());
    expect(s).toBe('a'.repeat(63));
  });
});

describe('isLegalDirSegment（"调用方直接给出落点"的围栏，TD-11-53）', () => {
  it('拒分隔符/冒号/控制符/`.`/`..`/前导点/前后空白/超长；正名放行', () => {
    for (const bad of [
      '',
      'a/b',
      'a\\b',
      'a:b',
      'a\u0000b',
      '.',
      '..',
      '.hidden',
      ' x ',
      'x'.repeat(65),
    ]) {
      expect(isLegalDirSegment(bad), `${JSON.stringify(bad)} 应被拒`).toBe(false);
    }
    for (const ok of ['客户项目', '漫画生成', 'a b', 'x'.repeat(64), '_未分类']) {
      expect(isLegalDirSegment(ok), `${ok} 应放行`).toBe(true);
    }
  });
});

describe('uniqueSlugIn（撞名去重）', () => {
  it('已占用 ⇒ 依次试 `-2`/`-3`…，并把结果记回集合（同一集合内不重复）', () => {
    const used = new Set<string>(['甲']);

    expect(uniqueSlugIn('甲', used)).toBe('甲-2');
    expect(uniqueSlugIn('甲', used)).toBe('甲-3');
    expect(uniqueSlugIn('乙', used)).toBe('乙');
    expect(used.has('甲-2')).toBe(true);
  });
});
