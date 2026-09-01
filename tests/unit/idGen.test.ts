// @vitest-environment node
// @ts-nocheck
/**
 * idGen 单测 —— 集中 ID 生成工具。
 * 覆盖：格式、唯一性、prefix 语义、非法 prefix 清洗。
 */
import { describe, it, expect } from 'vitest'
import { generateId } from '../../src/components/base/idGen.ts'

describe('idGen — generateId', () => {
  it('默认前缀为 id', () => {
    expect(generateId()).toMatch(/^id_[a-z0-9]+_[a-z0-9]+$/)
  })

  it('带前缀：格式 {prefix}_{ts36}_{rand36}', () => {
    expect(generateId('node')).toMatch(/^node_[a-z0-9]+_[a-z0-9]+$/)
  })

  it('同前缀两次生成 id 不同（随机后缀）', () => {
    const a = generateId('x')
    const b = generateId('x')
    expect(a).not.toBe(b)
  })

  it('前缀含非法字符被清洗为下划线', () => {
    expect(generateId('a b.c')).toMatch(/^a_b_c_[a-z0-9]+_[a-z0-9]+$/)
  })

  it('空前缀回落为 id', () => {
    expect(generateId('')).toMatch(/^id_/)
    expect(generateId(null)).toMatch(/^id_/)
  })
})
