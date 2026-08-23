import { describe, it, expect } from 'vitest'
import {
  canRetryCameraMoveCapture,
  decideCameraMoveRetry,
  DEFAULT_CAMERA_MOVE_RETRY,
  type CameraMoveRetryConfig,
} from './cameraMoveCaptureRetry'

const cfg: CameraMoveRetryConfig = { maxAttempts: 3, retryDelayMs: 800, attemptTimeoutMs: 30_000 }

describe('canRetryCameraMoveCapture', () => {
  it('允许在到达上限前重试', () => {
    expect(canRetryCameraMoveCapture(1, cfg)).toBe(true)
    expect(canRetryCameraMoveCapture(2, cfg)).toBe(true)
  })
  it('到上限即不再重试', () => {
    expect(canRetryCameraMoveCapture(3, cfg)).toBe(false)
    expect(canRetryCameraMoveCapture(4, cfg)).toBe(false)
  })
  it('maxAttempts<1 兜底为 1（至少试一次、不重试）', () => {
    expect(canRetryCameraMoveCapture(1, { ...cfg, maxAttempts: 0 })).toBe(false)
  })
})

describe('decideCameraMoveRetry', () => {
  it('ok → done（不管第几次）', () => {
    expect(decideCameraMoveRetry('ok', 1, cfg)).toEqual({ kind: 'done' })
    expect(decideCameraMoveRetry('ok', 3, cfg)).toEqual({ kind: 'done' })
  })

  it('null 且有次数 → 重试（attempt+1、带延迟）', () => {
    expect(decideCameraMoveRetry('null', 1, cfg)).toEqual({ kind: 'retry', nextAttempt: 2, delayMs: 800 })
    expect(decideCameraMoveRetry('null', 2, cfg)).toEqual({ kind: 'retry', nextAttempt: 3, delayMs: 800 })
  })

  it('timeout（循环停死没回调）同样重试', () => {
    expect(decideCameraMoveRetry('timeout', 1, cfg)).toEqual({ kind: 'retry', nextAttempt: 2, delayMs: 800 })
  })

  it('失败但已到上限 → giveUp（清标志，别永远卡着）', () => {
    expect(decideCameraMoveRetry('null', 3, cfg)).toEqual({ kind: 'giveUp' })
    expect(decideCameraMoveRetry('timeout', 3, cfg)).toEqual({ kind: 'giveUp' })
  })

  it('完整一条链：首次 timeout → 二次 null → 三次 ok 全程正确', () => {
    const d1 = decideCameraMoveRetry('timeout', 1, cfg)
    expect(d1).toEqual({ kind: 'retry', nextAttempt: 2, delayMs: 800 })
    const d2 = decideCameraMoveRetry('null', (d1 as { nextAttempt: number }).nextAttempt, cfg)
    expect(d2).toEqual({ kind: 'retry', nextAttempt: 3, delayMs: 800 })
    const d3 = decideCameraMoveRetry('ok', (d2 as { nextAttempt: number }).nextAttempt, cfg)
    expect(d3).toEqual({ kind: 'done' })
  })

  it('两次都失败到底 → 最终 giveUp（不无限重试）', () => {
    let attempt = 1
    let decision = decideCameraMoveRetry('timeout', attempt, cfg)
    while (decision.kind === 'retry') {
      attempt = decision.nextAttempt
      decision = decideCameraMoveRetry('timeout', attempt, cfg)
    }
    expect(decision.kind).toBe('giveUp')
    expect(attempt).toBe(3) // 首次 + 2 次重试后放弃
  })

  it('默认配置为 3 次 / 800ms', () => {
    expect(DEFAULT_CAMERA_MOVE_RETRY.maxAttempts).toBe(3)
    expect(DEFAULT_CAMERA_MOVE_RETRY.retryDelayMs).toBe(800)
  })

  it('负延迟被夹到 0', () => {
    const d = decideCameraMoveRetry('null', 1, { ...cfg, retryDelayMs: -50 })
    expect(d).toEqual({ kind: 'retry', nextAttempt: 2, delayMs: 0 })
  })
})
