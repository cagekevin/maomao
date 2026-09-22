/**
 * 技能**读写路径的失败契约**（禁止静默吞错）—— 外加组合层（`listAllSkills`）与乱码修复的冒烟断言。
 *
 * 【为什么叫这个名字（2026-09-22）】本文件此前叫 `skillStore.test.ts`，测的是 legacy 转发壳
 * `runtime/skillStore.ts`。**壳已删**（消费者只有面板，改走门面 ⇒ 见该轮轮次文件）⇒ 文件名不能继续
 * 指向一个不存在的模块。改名后主体 = `skillRepository` 的读写契约（`readSkillList` / `writeSkillList`
 * / `readUserSkills` 的三形态处置 + 落盘自确认），另有组合层与文本清洗的少数断言（一并留在这里，
 * **不另开文件** —— 拆成三个文件是"只加不减"）。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
// 组合与内置从门面取（TD-11-51/52：白名单/乱码修复/组合都已搬进模块）
import {
  getBuiltinSkills,
  listAllSkills,
  readUserSkills,
  repairMojibakeText,
} from '../../src/components/agent/skill/index.ts';
// 写入口已收口到 skillRepository（唯一）；本文件用它**造数据**，不再有"只写缓存"的旁路 API
import {
  readSkillList,
  writeSkillList,
} from '../../src/components/agent/skill/store/skillRepository.ts';
import { contentClearCache } from '../../src/components/base/core/contentStore.ts';
import { sGet } from '@/components/base/storage/storageAdapter.ts';

/** 缓存里一条用户 skill 的最小形状（造数据用；此前借 legacy `Skill`，壳删后本文件自持） */
interface SeedSkill {
  id: string;
  name: string;
  description: string;
  content: string;
  category?: string;
  slug?: string;
}

/**
 * 造一条缓存里的用户 skill。
 * 【为什么经 `writeSkillList` 而不是随便 `localStorage.setItem`】唯一写入口才有"落盘自确认 +
 * 形状归一"的语义；测试造数据也走同一条路，才不会造出现实中不可能出现的形状。
 */
function seedSkill(over: Partial<SeedSkill> = {}): SeedSkill {
  const entry: SeedSkill = { id: 'seed-1', name: 'A', description: '', content: 'c', ...over };
  const cur = readSkillList().list as SeedSkill[];
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
    // `id` 是**稳定契约**（用户的启用态/绑定都指向它，改 id = 断启用态）⇒ 值得锁。
    expect(b[0].id).toBe('skill_ecommerce_detail');
    // 【2026-09-22 删掉一条自证式断言】原 `expect(b[0].builtin).toBe(true)` 断的是**这个常量里
    // 刚写下的字面量**（生产代码里零读者）—— 把常量删掉那个字段它照样绿，属"断言自己刚写进 mock 的值"
    // （ADR-0049 形态③）。字段本身已删（只写不读）；"内置进官方组"这条**行为**由
    // `skillLibraryView.test.ts` 的 `kind === 'official'` 断（那才是真断言）。
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

  it('组合层按 id 查得到（面板的 `skillNameOf` 直接用它现查）', () => {
    expect(listAllSkills().list.some((s) => s.id === 'skill_ecommerce_detail')).toBe(true);
    seedSkill({ id: 'f1', name: 'Y' });
    expect(listAllSkills().list.find((s) => s.id === 'f1')?.name).toBe('Y');
    // 【原 `findSkill` 的用例已随壳删除】壳的 `findSkill` 就是 `listAllSkills().list.find(...)`
    // 这一行的封装 ⇒ 它一删，被测对象就只剩这一行（没有第二个消费者，也没有第二份实现）。
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
      const bad = writeSkillList(
        (readSkillList().list as SeedSkill[]).filter((s) => s.id !== 'd2'),
      );
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
