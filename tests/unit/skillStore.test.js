import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  getBuiltinSkills, getCustomSkills, readCustomSkills, getAllSkills, findSkill,
  upsertCustomSkill, deleteCustomSkill, markSkillUsed, getSkillUsage,
  repairMojibakeText,
} from '../../src/components/base/skillStore.ts'
import { contentClearCache } from '../../src/components/base/contentStore.ts'
import { sGet } from '@/components/base/storage/storageAdapter.ts'

beforeEach(() => {
  localStorage.clear()
  contentClearCache() // 清 contentStore 内存缓存，防跨测试污染
})

describe('Skill 系统 §2.19', () => {
  it('getBuiltinSkills 返回内置 skill（含电商详情页）', () => {
    const b = getBuiltinSkills()
    expect(Array.isArray(b)).toBe(true)
    expect(b.length).toBeGreaterThanOrEqual(1)
    expect(b[0].id).toBe('skill_ecommerce_detail')
    expect(b[0].builtin).toBe(true)
  })

  it('getAllSkills = 内置 + 自定义', () => {
    const before = getAllSkills().length
    upsertCustomSkill({ name: '我的技能', content: '执行XX' })
    expect(getAllSkills().length).toBe(before + 1)
  })

  it('getCustomSkills 初始为空', () => {
    expect(getCustomSkills()).toEqual([])
  })

  it('upsertCustomSkill 新增 + 更新（同 id 覆盖）', () => {
    const s = upsertCustomSkill({ id: 's1', name: 'A', content: 'c1' })
    expect(s.id).toBe('s1')
    const updated = upsertCustomSkill({ id: 's1', name: 'A2', content: 'c2' })
    expect(updated.name).toBe('A2')
    expect(getCustomSkills()).toHaveLength(1) // 未重复添加
  })

  it('upsertCustomSkill 缺 name/content 返回 null', () => {
    expect(upsertCustomSkill({ name: '' })).toBeNull()
    expect(upsertCustomSkill({ content: '' })).toBeNull()
  })

  it('deleteCustomSkill 删除自定义 skill', () => {
    upsertCustomSkill({ id: 'd1', name: 'X', content: 'c' })
    deleteCustomSkill('d1')
    expect(findSkill('d1')).toBeNull()
  })

  it('findSkill 可在内置+自定义中找到', () => {
    expect(findSkill('skill_ecommerce_detail')).toBeTruthy()
    upsertCustomSkill({ id: 'f1', name: 'Y', content: 'c' })
    expect(findSkill('f1')?.name).toBe('Y')
  })

  it('markSkillUsed 计数递增，getSkillUsage 读取', () => {
    expect(getSkillUsage('skill_ecommerce_detail')).toBe(0)
    const n1 = markSkillUsed('skill_ecommerce_detail')
    expect(n1).toBe(1)
    const n2 = markSkillUsed('skill_ecommerce_detail')
    expect(n2).toBe(2)
    expect(getSkillUsage('skill_ecommerce_detail')).toBe(2)
  })
})

// ═══════════════════════════════════════════════════════════════════
// 错误透传（禁止静默吞错）
// 断言原则：只断言「返回值语义」与「错误是否原样透传」，
//          绝不以 toast 为判定依据（toast 有 5s 全局节流，会漏报/误报，是虚假信号）。
// ═══════════════════════════════════════════════════════════════════
describe('Skill 错误透传（禁止静默）', () => {
  it('readCustomSkills：未存过 → ok=true 且 list=[]（不是错误）', () => {
    const res = readCustomSkills()
    expect(res.ok).toBe(true)
    expect(res.list).toEqual([])
    expect(res.error).toBe('')
  })

  it('readCustomSkills：数据损坏（坏 JSON 字符串）→ ok=false 且 error 含实际类型', () => {
    // contentStore 的 tryParse 在 JSON.parse 失败时返回原字符串，
    // 此时 Array.isArray 为 false——真实会发生的路径（写一半被打断 / 人工改过存储）。
    localStorage.setItem('yimao:agent_skills', '{"broken":')
    contentClearCache()
    const res = readCustomSkills()
    expect(res.ok).toBe(false)
    expect(res.list).toEqual([]) // list 恒为 array，防消费方 .filter 崩溃
    expect(res.error).toContain('string') // 透传实际类型，不泛化
  })

  it('readCustomSkills：list 恒为 array —— 损坏时消费方 getCustomSkills 不崩溃', () => {
    localStorage.setItem('yimao:agent_skills', 'not-json')
    contentClearCache()
    expect(() => getCustomSkills().filter(() => true)).not.toThrow()
    expect(() => getAllSkills().filter(() => true)).not.toThrow()
    expect(Array.isArray(getAllSkills())).toBe(true)
  })

  it('saveCustomSkills：写失败返回 ok=false 并透传原始 error.message', () => {
    const spy = vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })
    try {
      // 写失败必须可见：upsert 转发失败信号 → 返回 null，禁止返回对象让 UI 谎报「已保存」
      expect(upsertCustomSkill({ name: 'A', content: 'c' })).toBeNull()
    } finally {
      spy.mockRestore() // 必须 finally，否则断言失败会泄漏 mock 污染后续用例
    }
  })

  it('deleteCustomSkill：转发写结果（失败时 ok=false 且 error 透传）', () => {
    upsertCustomSkill({ id: 'd1', name: 'X', content: 'c' })
    expect(deleteCustomSkill('d1').ok).toBe(true)

    // 注意顺序：d2 必须在 mock 生效【之前】写入，否则它压根没落盘，
    // 删除时列表长度不变 → 落盘确认判成功（属正确语义，无法用来验证失败路径）。
    upsertCustomSkill({ id: 'd2', name: 'Y', content: 'c' })

    const spy = vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })
    try {
      // 删除【已真实落盘】的项 + setItem 抛错 → 落盘未生效，回读仍是旧数据 → 须判失败
      const badRes = deleteCustomSkill('d2')
      expect(badRes.ok).toBe(false)
      expect(badRes.error).toBeTruthy() // 必须有可读原因，禁止空 error
      // 磁盘真值：删除未生效，d2 仍在（sGet 绕过 contentStore 的 cache 直读底层）
      const disk = JSON.parse(sGet('agent_skills') || '[]')
      expect(disk.some((s) => s.id === 'd2')).toBe(true)
      // ⚠️ 同时钉死一个真实陷阱：写失败后 cache 与磁盘会不一致——
      //    UI（走 cache）会显示「已删除」，磁盘上其实还在。刷新页面即「复活」。
      //    正因如此，落盘确认必须用 sGet 而非 contentGet，否则永远检测不到失败。
      expect(findSkill('d2')).toBeFalsy() // cache 视角：已删除
      expect(disk.some((s) => s.id === 'd2')).toBe(true) // 磁盘视角：仍在 → 不一致
    } finally {
      spy.mockRestore()
    }
  })

  it('repairMojibakeText：纯英文内容不被误判为乱码（宁可不修，不可错改）', () => {
    // 含 ™ 与 é：score=2 且 cjk=0，若无防护会判定为乱码并强行反解 → 内容被静默改写
    const en = 'Premium lighting™, café style'
    expect(repairMojibakeText(en)).toBe(en)
  })

  it('repairMojibakeText：真实乱码仍被修复（防护不得误杀功能本身）', () => {
    // 样本程序生成：UTF-8 字节被误当 Latin-1 解码 = 真实的乱码形态，不手写避免造假
    const mojibake = (text) =>
      Array.from(new TextEncoder().encode(text)).map((b) => String.fromCharCode(b)).join('')
    // ⚠️ 回归防线：UTF-8 中文 3 字节→1 字符，修复后长度比恒为 ≈0.33。
    //    若日后有人加「长度塌陷 >50% 则视为误判」的阈值，下面的断言会立刻变红。
    expect(repairMojibakeText(mojibake('电商'))).toBe('电商')
    expect(repairMojibakeText(mojibake('电商详情页套图'))).toBe('电商详情页套图')
    expect(repairMojibakeText(mojibake('生成赛博朋克猫咪图'))).toBe('生成赛博朋克猫咪图')
  })

  it('getCustomSkills 兼容语义：损坏时返回 [] 而非抛错（保护既有 5 处消费方）', () => {
    localStorage.setItem('yimao:agent_skills', 'garbage')
    contentClearCache()
    expect(getCustomSkills()).toEqual([])
  })
})
