/**
 * `skillGroup` —— 分组的**唯一语义家**（TD-11-58/62/68）。
 *
 * 本文件锁三件事：
 *  · **措辞唯一**：`labelOfGroup` 是完整映射（含两个伪组），`skillGroupLabel` 只兜 `_未分类`；
 *  · **语义成字段**：`kindOfGroup` 把"哪一类组"提成 `official`/`index-only`/`normal`，
 *    消费者读它、**不许**比组名（哨兵只在 `skillGroup.ts` 里存在）；
 *  · **排序**：`_未分类` 恒最后（它是兜底，不是用户有意建的分组）。
 */
import { describe, it, expect } from 'vitest';
import {
  INDEX_ONLY_GROUP,
  OFFICIAL_GROUP,
  UNSORTED_GROUP,
  categoryInputOf,
  compareSkillGroups,
  kindOfGroup,
  labelOfGroup,
  skillGroupLabel,
} from '../../src/components/agent/skill/skillGroup.ts';

describe('labelOfGroup（组名 → 显示名：**完整映射的唯一措辞源**）', () => {
  it('两个伪组各有自己的措辞；真实磁盘组名原样透传；兜底组走最后一步兜底', () => {
    expect(labelOfGroup(OFFICIAL_GROUP)).toBe('官方');
    expect(labelOfGroup(INDEX_ONLY_GROUP)).toBe('磁盘上已删除');
    expect(labelOfGroup('营销文案')).toBe('营销文案');
    expect(labelOfGroup(UNSORTED_GROUP)).toBe('未分组');
  });
});

describe('skillGroupLabel（只兜 `_未分类` 的最后一步 —— TD-11-69）', () => {
  it('`_未分类` → 「未分组」；真实组名原样透传（伪组措辞不在这里，见 `labelOfGroup`）', () => {
    expect(skillGroupLabel(UNSORTED_GROUP)).toBe('未分组');
    expect(skillGroupLabel('甲组')).toBe('甲组');
  });
});

describe('kindOfGroup（组名 → 语义类别：消费者读它，不比组名）', () => {
  it('三种类别各自如实；判据与措辞同一处口径（只在这里认哨兵）', () => {
    expect(kindOfGroup(OFFICIAL_GROUP)).toBe('official');
    expect(kindOfGroup(INDEX_ONLY_GROUP)).toBe('index-only');
    expect(kindOfGroup('甲组')).toBe('normal');
    expect(kindOfGroup(UNSORTED_GROUP)).toBe('normal'); // 兜底组是**普通组**（它能被用户改），不是伪组
  });
});

describe('compareSkillGroups（`_未分类` 恒排最后）', () => {
  it('兜底组排在任何真实组之后、它与自己相等', () => {
    expect(compareSkillGroups('甲组', UNSORTED_GROUP)).toBeLessThan(0);
    expect(compareSkillGroups(UNSORTED_GROUP, '甲组')).toBeGreaterThan(0);
    expect(compareSkillGroups(UNSORTED_GROUP, UNSORTED_GROUP)).toBe(0);
  });
});

describe('categoryInputOf（输入框预填值：哨兵不外泄给界面）', () => {
  it('兜底组 ⇒ 空串（它不是用户要填的组名）；不可编辑的行 ⇒ 也空串；其余原样', () => {
    expect(categoryInputOf(UNSORTED_GROUP, true)).toBe('');
    expect(categoryInputOf('营销文案', true)).toBe('营销文案');
    expect(categoryInputOf('营销文案', false)).toBe('');
  });
});
