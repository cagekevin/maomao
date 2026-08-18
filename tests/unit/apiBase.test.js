// @vitest-environment node
/**
 * API_BASE 常量单测（原 apiBase.js，已合并至 config.js）。
 * API_BASE 是 localTool 后端固定地址，所有 API 层统一入口契约。
 * 测其值符合原型阶段约定。
 */
import { describe, it, expect } from 'vitest'

const { API_BASE } = await import('../../src/components/base/config.js')

describe('config.js — API_BASE 常量', () => {
  it('指向 localTool 后端固定地址 18080', () => {
    expect(API_BASE).toBe('http://127.0.0.1:18080')
  })
  it('为 http 协议绝对地址（非相对路径）', () => {
    expect(API_BASE.startsWith('http://')).toBe(true)
  })
})
