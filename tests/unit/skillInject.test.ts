import { describe, it, expect, beforeEach } from 'vitest';
import {
  freezeSkillTurn,
  getSkillIndexText,
} from '../../src/components/agent/skill/skillInject.ts';
import {
  SKILLS_KEY,
  writeSkillConfig,
  writeSkillList,
} from '../../src/components/agent/skill/skillRepository.ts';
import { contentClearCache } from '../../src/components/base/core/contentStore.ts';

beforeEach(() => {
  localStorage.clear();
  contentClearCache();
});

/**
 * 把技能写进**缓存**（= 正文与磁盘落点的真相所在）。
 * 【为什么测试也走这条路】契约要求调用方**只给 id**（不许镜像字段）⇒ 测试若自己造对象传进去，
 * 就把契约又测回了"镜像"那条老路（那正是 TD-11-16 的根因）。
 */
function putSkills(entries: Record<string, unknown>[]): void {
  writeSkillList(entries);
}

describe('getSkillIndexText（块①：默认关 ⇒ 不注入）', () => {
  const item = { id: 'a1', name: '漫画生成', description: '生成分镜式漫画页' };

  it('开关关闭（默认）⇒ 空串：模型不知道存在 skill 体系，也就不会乱用', () => {
    expect(getSkillIndexText([item])).toBe('');
  });

  it('开关打开 ⇒ 出清单（含 id 与用途）', () => {
    writeSkillConfig({ catalogToModel: true });

    const text = getSkillIndexText([item]);

    expect(text).toContain('仅表示存在');
    expect(text).toContain('a1');
    expect(text).toContain('生成分镜式漫画页');
  });
});

describe('freezeSkillTurn（发送起点冻结：入参只有 id，正文与落点由模块现查）', () => {
  it('留痕存**全文**，发给模型的 docs 才按预算截断 —— 两者不许是同一份', () => {
    // 存在的意义：事后拿留痕去跟磁盘文件比对，若留痕也是截断版，比对必然假不等。
    writeSkillConfig({
      contentLimits: { singleSkillChars: 5, expansionTotalChars: 1000, maxExplicitBindings: 4 },
    });
    putSkills([{ id: 'u1', name: '甲', content: '一二三四五六七八九十' }]);

    const turn = freezeSkillTurn(['u1']);

    expect(turn.bindings[0].content).toBe('一二三四五六七八九十'); // 留痕：全文
    expect(turn.docs).toContain('一二三四五'); // 注入：截断
    expect(turn.docs).not.toContain('六七八九十');
  });

  it('绑定齐备，且 **category/slug 来自缓存**（丢了它「按需读资料」恒失败 —— TD-11-16 的回归闸）', () => {
    putSkills([
      { id: 'u1', name: '用户技能', content: '正文', category: '客户项目', slug: '用户技能' },
    ]);

    const turn = freezeSkillTurn(['u1']);

    expect(turn.bindings).toHaveLength(1);
    expect(turn.bindings[0]).toMatchObject({
      skillId: 'u1',
      name: '用户技能',
      origin: 'user',
      // ↓ 这两行是本用例的**要害**：旧实现在装配处丢掉它们，导致 skill_read_file 恒报"不在磁盘上"
      category: '客户项目',
      slug: '用户技能',
    });
    expect(typeof turn.bindings[0].contentHash).toBe('string');
    expect(turn.error).toBeUndefined();
    expect(turn.missing).toBeUndefined();
  });

  it('在设置页换组/改名后，下一次冻结用**新落点**（现查 ⇒ 天然跟随，无需回填）', () => {
    putSkills([{ id: 'u1', name: '甲', content: '正文', category: '旧组', slug: '甲' }]);
    expect(freezeSkillTurn(['u1']).bindings[0].category).toBe('旧组');

    putSkills([{ id: 'u1', name: '甲', content: '正文', category: '新组', slug: '甲-2' }]);
    const again = freezeSkillTurn(['u1']);

    expect(again.bindings[0].category).toBe('新组');
    expect(again.bindings[0].slug).toBe('甲-2');
  });

  it('内置 skill：按 id 冻结、origin=builtin，且**没有落点**（它本来就没有磁盘包，不是漏传）', () => {
    const turn = freezeSkillTurn(['skill_ecommerce_detail']);

    expect(turn.bindings).toHaveLength(1);
    expect(turn.bindings[0].origin).toBe('builtin');
    expect(turn.bindings[0].name).toBeTruthy();
    expect(turn.bindings[0].category).toBeUndefined();
    expect(turn.bindings[0].slug).toBeUndefined();
    expect(turn.docs).toContain('本次启用 Skill（1 项）');
  });

  it('指纹随正文变（同一个 skill 改一版 ⇒ 指纹必变，否则"冻结"无法对账）', () => {
    putSkills([{ id: 'x', name: 'X', content: '第一版' }]);
    const a = freezeSkillTurn(['x']).bindings[0].contentHash;
    putSkills([{ id: 'x', name: 'X', content: '第二版' }]);
    const b = freezeSkillTurn(['x']).bindings[0].contentHash;

    expect(a).not.toBe(b);
  });

  it('查不到的 id ⇒ 进 missing 且不注入（技能被删了却以为发过，是最难查的那类）', () => {
    putSkills([{ id: 'z', name: '正常', content: '正文' }]);

    const turn = freezeSkillTurn(['z', 'ghost']);

    expect(turn.bindings.map((b) => b.skillId)).toEqual(['z']);
    expect(turn.missing).toEqual(['ghost']);
    expect(turn.docs).not.toContain('ghost');
  });

  it('缓存损坏（坏 JSON 字符串）⇒ error 且一个都不注入（不把"读不到"假装成"没选 skill"）', () => {
    // contentStore 的 tryParse 在 JSON.parse 失败时返回**原字符串** ⇒ 非数组 ⇒ repository 判"形状违约"。
    // 物理键前缀与 skillStore.test.ts 同款；若前缀或键名变了，写坏值会失效 ⇒ 这条会变红（不会假绿）。
    localStorage.setItem(`yimao:${SKILLS_KEY}`, '{"broken":');
    contentClearCache();

    const turn = freezeSkillTurn(['u1']);

    expect(turn.bindings).toEqual([]);
    expect(turn.docs).toBe('');
    expect(turn.error).toBeTruthy();
  });

  it('空正文 / 全空白 ⇒ 既不进绑定，也不进 docs（口径一致，不留半截）', () => {
    putSkills([
      { id: 'y', name: '空正文', content: '   ' },
      { id: 'z', name: '正常', content: '正文' },
    ]);

    const turn = freezeSkillTurn(['y', 'z']);

    expect(turn.bindings.map((b) => b.skillId)).toEqual(['z']);
    expect(turn.docs).toContain('开始：正常');
    expect(turn.docs).not.toContain('空正文');
  });

  it('重复 id 只绑定一次（同一技能不会被注入两遍）', () => {
    putSkills([{ id: 'u1', name: '甲', content: '正文' }]);

    const turn = freezeSkillTurn(['u1', 'u1']);

    expect(turn.bindings).toHaveLength(1);
  });

  it('零绑定 ⇒ 空 docs：这才是"本轮没发 skill"的信号（空数组不是）', () => {
    const turn = freezeSkillTurn([]);

    expect(turn.bindings).toEqual([]);
    expect(turn.docs).toBe('');
  });

  it('入参为 undefined/脏数据不抛（发送链路不许因脏选择崩）', () => {
    expect(() => freezeSkillTurn(undefined as never)).not.toThrow();
    expect(freezeSkillTurn(undefined as never).docs).toBe('');
    expect(freezeSkillTurn([123 as never, null as never]).docs).toBe('');
  });
});
