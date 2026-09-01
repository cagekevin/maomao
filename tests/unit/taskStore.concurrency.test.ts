// @vitest-environment node
// @ts-nocheck
/**
 * taskStore 生图并发上限测试。
 * 验证 runNodeGeneration 同时最多跑 MAX_CONCURRENT_GEN(6) 个，第 7 个返回 { ok:false, skipped:true }，
 * 且不排队、不触发（保持待生成，由用户手动点）。这是「AI 批量生图一次规划很多张，但同一时刻
 * 最多 6 个真正在跑」的关键保护（避免打爆上游限流）。
 */
import { describe, it, expect, beforeEach } from 'vitest'
import {
  registerTaskRetry,
  unregisterTaskRetry,
  runNodeGeneration,
  claimNodeRun,
  releaseNodeRun,
} from '../../src/components/base/taskStore.ts'

function makePending() {
  let resolve
  const gate = new Promise((r) => { resolve = r })
  return { gate, resolve }
}

beforeEach(() => {
  // 每个用例前清空注册（id 前缀唯一，这里仅保险）
})

describe('taskStore 生图并发上限（最多 6 个同时跑，超出跳过）', () => {
  it('第 7 个并发请求返回 skipped，不触发、不排队', async () => {
    const callOrder = []
    const resolvers = []
    // 注册 7 个节点，每个 fn 返回一个「挂起」的 promise（模拟生成进行中）
    for (let i = 0; i < 7; i++) {
      const { gate, resolve } = makePending()
      resolvers.push(resolve)
      registerTaskRetry(`conc-${i}`, () => {
        callOrder.push(i)
        return gate.then(() => ({ ok: true, resultUrl: `http://r/${i}.png` }))
      })
    }

    // 同时触发 7 个（模拟 AI 批量一次生成 7 个节点）
    const promises = Array.from({ length: 7 }, (_, i) => runNodeGeneration(`conc-${i}`))

    // 让微任务队列推进（前 6 个占槽、触发；第 7 个判断 genActive>=6 返回 skipped）
    await Promise.resolve()
    await Promise.resolve()

    // 前 6 个已真正触发（fn 被调 6 次），第 7 个被跳过（不触发）
    expect(callOrder).toHaveLength(6)

    // 第 7 个立即返回 false（未触发，不排队不阻塞），前 6 个仍挂起
    const seventh = await promises[6]
    expect(seventh).toBe(false)

    // 释放前 6 个挂起的任务，让它们完成
    for (const r of resolvers) r()
    const firstSix = await Promise.all(promises.slice(0, 6))
    expect(firstSix.every((r) => r?.ok === true)).toBe(true)

    // 清理
    for (let i = 0; i < 7; i++) unregisterTaskRetry(`conc-${i}`)
  })

  it('释放槽位后（前 6 个完成），新的生成可正常触发', async () => {
    const { gate, resolve } = makePending()
    registerTaskRetry('conc-a', () => gate.then(() => ({ ok: true, resultUrl: 'http://r/a.png' })))
    registerTaskRetry('conc-b', async () => ({ ok: true, resultUrl: 'http://r/b.png' }))

    // 触发第一个并保持挂起 → 占 1 槽
    const p1 = runNodeGeneration('conc-a')
    await Promise.resolve()
    // 第二个此时 genActive=1<6，可触发（立即完成）
    const p2 = runNodeGeneration('conc-b')
    expect((await p2).ok).toBe(true)

    // 释放第一个 → 槽位释放，无异常
    resolve()
    expect((await p1).ok).toBe(true)

    unregisterTaskRetry('conc-a')
    unregisterTaskRetry('conc-b')
  })
})

describe('taskStore P1-E 单节点互斥锁（claimNodeRun/releaseNodeRun）', () => {
  it('同一节点二次 claim 返回 inFlight，不重复占位；释放后可再占', () => {
    releaseNodeRun('lock-1') // 清残留
    expect(claimNodeRun('lock-1')).toEqual({ ok: true })
    // 同节点仍持有 → 明确「进行中」
    expect(claimNodeRun('lock-1')).toEqual({ ok: false, inFlight: true })
    // 不同节点互不影响
    expect(claimNodeRun('lock-2')).toEqual({ ok: true })
    // 释放后同节点可再占
    releaseNodeRun('lock-1')
    expect(claimNodeRun('lock-1')).toEqual({ ok: true })
    // 清理
    releaseNodeRun('lock-1')
    releaseNodeRun('lock-2')
  })

  it('无 nodeId 不锁（视为可占）', () => {
    expect(claimNodeRun()).toEqual({ ok: true })
    expect(claimNodeRun('')).toEqual({ ok: true })
  })
})
