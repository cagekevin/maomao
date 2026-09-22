/**
 * `skillBudget` —— 注入预算的唯一真源（TD-11-60 拆分后的四分之一）。
 * 锁两条：**截断的语义**（含 `limit<=0` = 一点都不给）与**建议上界 > 默认值**（否则一打开设置页就报警 = 纯噪声）。
 */
import { describe, it, expect } from 'vitest';
import {
  SKILL_CONTENT_LIMITS,
  SKILL_LIMIT_SUGGESTED_MAX,
  SKILL_TRUNCATION_NOTICE,
  truncateSkillContent,
} from '../../src/components/agent/skill/model/skillBudget.ts';

describe('truncateSkillContent', () => {
  it('未超限 → 原样返回且 truncated=false', () => {
    const r = truncateSkillContent('短内容', 100);

    expect(r.content).toBe('短内容');
    expect(r.truncated).toBe(false);
  });

  it('超限 → 截断 + 固定提示 + truncated=true（必须告知被截断）', () => {
    const r = truncateSkillContent('x'.repeat(20), 5);

    expect(r.truncated).toBe(true);
    expect(r.content).toBe('xxxxx' + SKILL_TRUNCATION_NOTICE);
  });

  it('limit<=0 → **一点都不给**（空内容 + truncated:true）：不再有「0 = 不限」这个反直觉约定 —— TD-11-26', () => {
    expect(truncateSkillContent('abc', 0)).toEqual({ content: '', truncated: true });
    expect(truncateSkillContent('abc', -5)).toEqual({ content: '', truncated: true });
    // 真空内容 ≠ 被截断：空输入是"本来就没有"，与"有内容但没额度"必须分开（否则调用方无从点名）
    expect(truncateSkillContent('', 0)).toEqual({ content: '', truncated: false });
  });
});

describe('SKILL_LIMIT_SUGGESTED_MAX（预算的建议上界）', () => {
  it('每一项都必须 **> 默认值**（否则一打开设置页就报警 = 纯噪声）', () => {
    for (const k of Object.keys(
      SKILL_LIMIT_SUGGESTED_MAX,
    ) as (keyof typeof SKILL_LIMIT_SUGGESTED_MAX)[]) {
      expect(SKILL_LIMIT_SUGGESTED_MAX[k]).toBeGreaterThan(SKILL_CONTENT_LIMITS[k]);
    }
  });

  it('默认值本身不许超过建议上界（默认配置不该自带一句警告）', () => {
    for (const k of Object.keys(SKILL_CONTENT_LIMITS) as (keyof typeof SKILL_CONTENT_LIMITS)[]) {
      expect(SKILL_CONTENT_LIMITS[k]).toBeLessThanOrEqual(SKILL_LIMIT_SUGGESTED_MAX[k]);
    }
  });
});
