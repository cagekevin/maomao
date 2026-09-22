import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  findSkill,
  markSkillUsed,
  getSkillUsage,
  type Skill,
} from '../../src/components/agent/runtime/skillStore.ts';
// 白名单/乱码修复已搬进模块（TD-11-52）；组合与内置从门面取（TD-11-51）
import {
  getBuiltinSkills,
  listAllSkills,
  readUserSkills,
  repairMojibakeText,
} from '../../src/components/agent/skill/index.ts';
// 写入口已收口到 skillRepository（唯一）；本文件用它**造数据**，不再有"只写缓存"的旁路 API
import { readSkillList, writeSkillList } from '../../src/components/agent/skill/skillRepository.ts';
import { contentClearCache } from '../../src/components/base/core/contentStore.ts';
import { sGet } from '@/components/base/storage/storageAdapter.ts';

/**
 * 造一条缓存里的用户 skill。
 * 【为什么经 `writeSkillList` 而不是随便 `localStorage.setItem`】唯一写入口才有"落盘自确认 +
 * 形状归一"的语义；测试造数据也走同一条路，才不会造出现实中不可能出现的形状。
 */
function seedSkill(over: Partial<Skill> = {}): Skill {
  const entry: Skill = { id: 'seed-1', name: 'A', description: '', content: 'c', ...over };
  const cur = readSkillList().list as Skill[];
  writeSkillList([...cur.filter((s) => s.id !== entry.id), entry]);
  return entry;
}

beforeEach(() => {
  localStorage.clear();
  contentClearCache(); // 清 contentStore 内存缓存，防跨测试污染
});

describe('Skill 系统 §2.19', () => {
  it('getBuiltinSkills 返回内置 skill（含电商详情页）', () => {
    const b = getBuiltinSkills();
    expect(Array.isArray(b)).toBe(true);
    expect(b.length).toBeGreaterThanOrEqual(1);
    expect(b[0].id).toBe('skill_ecommerce_detail');
    expect(b[0].builtin).toBe(true);
  });

  it('listAllSkills = 内置 + 自定义（组合唯一实现在模块内）', () => {
    const before = listAllSkills().list.length;
    seedSkill({ id: 'mine', name: '我的技能', content: '执行XX' });
    expect(listAllSkills().list.length).toBe(before + 1);
  });

  it('listAllSkills：没有用户 skill 时只有内置（组合唯一实现在模块内）', () => {
    expect(listAllSkills().list.every((s) => s.builtin)).toBe(true);
  });

  it('listAllSkills 带出缓存条目的分组字段（供设置页分组树用）', () => {
    seedSkill({ id: 'g1', name: 'G', category: '客户项目', slug: 'G' });

    const mine = listAllSkills().list.filter((s) => !s.builtin);
    expect(mine).toHaveLength(1);
    expect(mine[0].category).toBe('客户项目');
    expect(mine[0].slug).toBe('G');
  });

  it('findSkill 可在内置+自定义中找到', () => {
    expect(findSkill('skill_ecommerce_detail')).toBeTruthy();
    seedSkill({ id: 'f1', name: 'Y' });
    expect(findSkill('f1')?.name).toBe('Y');
  });

  it('markSkillUsed 计数递增，getSkillUsage 读取', () => {
    expect(getSkillUsage('skill_ecommerce_detail')).toBe(0);
    const n1 = markSkillUsed('skill_ecommerce_detail');
    expect(n1).toBe(1);
    const n2 = markSkillUsed('skill_ecommerce_detail');
    expect(n2).toBe(2);
    expect(getSkillUsage('skill_ecommerce_detail')).toBe(2);
  });
});

// ═══════════════════════════════════════════════════════════════════
// 错误透传（禁止静默吞错）
// 断言原则：只断言「返回值语义」与「错误是否原样透传」，
//          绝不以 toast 为判定依据（toast 有 5s 全局节流，会漏报/误报，是虚假信号）。
// ═══════════════════════════════════════════════════════════════════
describe('Skill 错误透传（禁止静默）', () => {
  it('readUserSkills：未存过 → ok=true 且 list=[]（不是错误）', () => {
    const res = readUserSkills();
    expect(res.ok).toBe(true);
    expect(res.list).toEqual([]);
    expect(res.error).toBe('');
  });

  it('readUserSkills：数据损坏（坏 JSON 字符串）→ ok=false 且 error 含实际类型', () => {
    // contentStore 的 tryParse 在 JSON.parse 失败时返回原字符串，
    // 此时 Array.isArray 为 false——真实会发生的路径（写一半被打断 / 人工改过存储）。
    localStorage.setItem('yimao:agent_skills', '{"broken":');
    contentClearCache();
    const res = readUserSkills();
    expect(res.ok).toBe(false);
    expect(res.list).toEqual([]); // list 恒为 array，防消费方 .filter 崩溃
    expect(res.error).toContain('string'); // 透传实际类型，不泛化
  });

  it('readUserSkills：list 恒为 array —— 损坏时消费方与组合层都不崩溃', () => {
    localStorage.setItem('yimao:agent_skills', 'not-json');
    contentClearCache();
    expect(() => readUserSkills().list.filter(() => true)).not.toThrow();
    expect(() => listAllSkills().list.filter(() => true)).not.toThrow();
    // 【TD-11-66 起：损坏是**返回值**，不是异常】数组照旧给（只剩内置），但 `ok:false` + 原因一并给
    expect(listAllSkills().ok).toBe(false);
    expect(listAllSkills().error).toBeTruthy();
  });

  it('写入口：落盘失败返回 ok=false（失败是**返回值**不是异常，禁 try/catch 判成功）', () => {
    const spy = vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    try {
      const r = writeSkillList([{ id: 'a', name: 'A', description: '', content: 'c' }]);
      expect(r.ok).toBe(false);
      expect(r.error).toBeTruthy(); // 必须有可读原因，禁止空 error
    } finally {
      spy.mockRestore(); // 必须 finally，否则断言失败会泄漏 mock 污染后续用例
    }
  });

  it('写失败后 cache 与磁盘**不一致** ⇒ 落盘确认必须绕缓存直读（本仓实测过的坑）', () => {
    seedSkill({ id: 'd2', name: 'Y' });
    const spy = vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    try {
      const bad = writeSkillList((readSkillList().list as Skill[]).filter((s) => s.id !== 'd2'));
      expect(bad.ok).toBe(false);
      // 磁盘真值：写未生效，d2 仍在（sGet 绕过 contentStore 的 cache 直读底层）
      const disk = JSON.parse(sGet('agent_skills') || '[]') as Array<{ id: string }>;
      expect(disk.some((s) => s.id === 'd2')).toBe(true);
      // ⚠️ cache 视角却"已删除"——正因如此，落盘确认必须用 sGet/contentReadThrough 而非 contentGet，
      //    否则写失败永远检测不到（写失败时回读仍返回新值）。
      expect(readUserSkills().list.some((s) => (s as { id?: string }).id === 'd2')).toBe(false);
    } finally {
      spy.mockRestore();
    }
  });

  it('repairMojibakeText：纯英文内容不被误判为乱码（宁可不修，不可错改）', () => {
    // 含 ™ 与 é：score=2 且 cjk=0，若无防护会判定为乱码并强行反解 → 内容被静默改写
    const en = 'Premium lighting™, café style';
    expect(repairMojibakeText(en)).toBe(en);
  });

  it('repairMojibakeText：真实乱码仍被修复（防护不得误杀功能本身）', () => {
    // 样本程序生成：UTF-8 字节被误当 Latin-1 解码 = 真实的乱码形态，不手写避免造假
    const mojibake = (text: string) =>
      Array.from(new TextEncoder().encode(text))
        .map((b) => String.fromCharCode(b))
        .join('');
    // ⚠️ 回归防线：UTF-8 中文 3 字节→1 字符，修复后长度比恒为 ≈0.33。
    //    若日后有人加「长度塌陷 >50% 则视为误判」的阈值，下面的断言会立刻变红。
    expect(repairMojibakeText(mojibake('电商'))).toBe('电商');
    expect(repairMojibakeText(mojibake('电商详情页套图'))).toBe('电商详情页套图');
    expect(repairMojibakeText(mojibake('生成赛博朋克猫咪图'))).toBe('生成赛博朋克猫咪图');
  });

  it('损坏时组合层不抛错：listAllSkills 退回"只有内置"', () => {
    localStorage.setItem('yimao:agent_skills', 'garbage');
    contentClearCache();
    expect(() => listAllSkills()).not.toThrow();
    expect(listAllSkills().list.every((s) => s.builtin)).toBe(true);
  });
});
