// @vitest-environment node
/**
 * apiBase 单测（批 2，API 封装层）。
 * apiBase.js 仅导出 API_BASE 常量（localTool 后端固定地址），
 * 是统一入口契约，被所有 API 层 import。测其值符合原型阶段约定。
 */
import { describe, it, expect } from 'vitest'

const { API_BASE } = await import('../../src/components/base/apiBase.js')

describe('apiBase — API_BASE 常量', () => {
  it('指向 localTool 后端固定地址 18080', () => {
    expect(API_BASE).toBe('http://127.0.0.1:18080')
  })
  it('为 http 协议绝对地址（非相对路径）', () => {
    expect(API_BASE.startsWith('http://')).toBe(true)
  })
})
