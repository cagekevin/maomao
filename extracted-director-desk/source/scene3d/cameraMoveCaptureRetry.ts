// 运镜离屏出片的「失败重试」纯逻辑（配单测 cameraMoveCaptureRetry.test.ts 锁行为）。
//
// 根因（用户真机）：离屏捕获 Canvas 一次 WebGL 上下文丢失（GPU/驱动/多 Electron 抢 context 配额，
// demand/always 都会中断 useFrame 循环）→ onResult 要么给 null（帧不足）要么永不回调（循环停死）→
// mp4 永久失败、轨迹节点建了却没徽标没视频。治法：一次瞬态失败不判死——
//   ① 给离屏 Canvas 接 attachWebGLContextRecovery（preventDefault→浏览器补发 restore）；
//   ② 若某次捕获超时 / 返回 null / 零帧，延迟后重挂捕获器重来，最多 N 次；只有 N 次都败才清标志放弃。
//
// 这里只放「纯决策」：该不该重试、第几次、等多久、每次挂载用什么 key。React/计时器副作用留在 Host。

/** 一次捕获尝试的结局：ok=拿到可用结果；null=帧不足/相机缺失；timeout=循环停死没回调。 */
export type CameraMoveCaptureOutcome = 'ok' | 'null' | 'timeout'

export type CameraMoveRetryConfig = {
  /** 最多尝试几次（含首次）。默认 3 = 首次 + 2 次重试。 */
  maxAttempts: number
  /** 每次失败后等多久再重挂（ms）。给上下文腾出配额恢复。 */
  retryDelayMs: number
  /** 单次捕获的看门狗超时（ms）：超过没回调即判 timeout（循环停死）。 */
  attemptTimeoutMs: number
}

export const DEFAULT_CAMERA_MOVE_RETRY: CameraMoveRetryConfig = {
  maxAttempts: 3,
  retryDelayMs: 800,
  attemptTimeoutMs: 30_000,
}

/** attempt 从 1 起数（1=首次）。是否还能再试？ */
export function canRetryCameraMoveCapture(attempt: number, config: CameraMoveRetryConfig): boolean {
  return attempt < Math.max(1, config.maxAttempts)
}

/**
 * 拿到某次结局后决定下一步：
 * - 'ok'      → 完成（提交结果、清标志）。
 * - 'null'/'timeout' 且还有次数 → 重试（等 retryDelayMs、attempt+1、换新挂载 key）。
 * - 'null'/'timeout' 且已到上限 → 放弃（清标志，别永远卡着重试）。
 */
export type CameraMoveRetryDecision =
  | { kind: 'done' }
  | { kind: 'retry'; nextAttempt: number; delayMs: number }
  | { kind: 'giveUp' }

export function decideCameraMoveRetry(
  outcome: CameraMoveCaptureOutcome,
  attempt: number,
  config: CameraMoveRetryConfig = DEFAULT_CAMERA_MOVE_RETRY,
): CameraMoveRetryDecision {
  if (outcome === 'ok') return { kind: 'done' }
  if (canRetryCameraMoveCapture(attempt, config)) {
    return { kind: 'retry', nextAttempt: attempt + 1, delayMs: Math.max(0, config.retryDelayMs) }
  }
  return { kind: 'giveUp' }
}
