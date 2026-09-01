/**
 * tests/unit/error-envelope.test.js
 * B2 错误信封统一：前端 extractErrorDetail 纯函数全分支 + httpRequest 集成 + 后端 sendError 带 code。
 *
 * 关联：docs/26-API中转层连接优化-执行计划-2026-08-22.md §B2（T2.1/T2.2）
 * 验收：
 *  - extractErrorDetail 单一函数覆盖所有错误源（error字符串 / error{code,message} / detail / message / 空）
 *  - 字符串兜底分支仍在（{error:'msg'} → {code:'UNKNOWN',message:'msg'}，B0 兼容）
 *  - HttpError.message 无 `HTTP ${status}` 前缀；status 由 HttpError.status 单独暴露
 *  - 后端 sendError 带 code → {error:{code,message}}；不传 code → {error:message}（B0 冻结形态不变）
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { extractErrorDetail, httpRequest, HttpError } from '@/components/base/api/httpClient.ts'

describe('extractErrorDetail — 错误信封唯一解析入口', () => {
  it('error 为字符串 → 字符串兜底 {code:UNKNOWN}', () => {
    expect(extractErrorDetail({ error: 'bad request' })).toEqual({ code: 'UNKNOWN', message: 'bad request' })
  })

  it('error 为结构化 {code,message} → 透传结构化', () => {
    expect(extractErrorDetail({ error: { code: 'business', message: '余额不足' } }))
      .toEqual({ code: 'business', message: '余额不足' })
  })

  it('error 结构化缺 code → 回落 UNKNOWN；缺 message 回落 detail', () => {
    expect(extractErrorDetail({ error: { detail: '磁盘满' } })).toEqual({ code: 'UNKNOWN', message: '磁盘满' })
  })

  it('平铺 detail → 取 detail', () => {
    expect(extractErrorDetail({ detail: 'db down' })).toEqual({ code: 'UNKNOWN', message: 'db down' })
  })

  it('平铺 message → 取 message', () => {
    expect(extractErrorDetail({ message: 'boom' })).toEqual({ code: 'UNKNOWN', message: 'boom' })
  })

  it('空/无字段 → {code:UNKNOWN, message:""}', () => {
    expect(extractErrorDetail({})).toEqual({ code: 'UNKNOWN', message: '' })
    expect(extractErrorDetail(undefined)).toEqual({ code: 'UNKNOWN', message: '' })
    expect(extractErrorDetail(null)).toEqual({ code: 'UNKNOWN', message: '' })
  })

  it('优先级：error.message > data.detail > data.message', () => {
    expect(extractErrorDetail({ error: { message: 'A' }, detail: 'B', message: 'C' }))
      .toEqual({ code: 'UNKNOWN', message: 'A' })
  })
})

describe('httpRequest — 结构化错误信封透传 message（B2 无 HTTP 前缀）', () => {
  beforeEach(() => { global.fetch = vi.fn() })

  it('error:{code,message} → HttpError.status 单独暴露，message 纯业务', async () => {
    global.fetch.mockResolvedValue({ ok: false, status: 422, json: () => Promise.resolve({ error: { code: 'business', message: '参数非法' } }) })
    await expect(httpRequest('/api/x')).rejects.toMatchObject({ name: 'HttpError', status: 422, message: '参数非法' })
  })

  it('提取结果仍能抛 HttpError', async () => {
    global.fetch.mockResolvedValue({ ok: false, status: 500, json: () => Promise.resolve({ error: 'server err' }) })
    await expect(httpRequest('/api/x')).rejects.toThrow(HttpError)
  })
})