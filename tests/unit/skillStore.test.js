import { describe, it, expect, beforeEach } from 'vitest'
import {
  getBuiltinSkills, getCustomSkills, getAllSkills, findSkill,
  upsertCustomSkill, deleteCustomSkill, markSkillUsed, getSkillUsage,
} from '../../src/components/base/skillStore.js'

beforeEach(() => {
  localStorage.clear()
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
