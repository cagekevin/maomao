import { MOVEMENT_CODES } from './scene3dConstants'
import type { PointerCaptureTarget, Scene3DMovementCode } from './scene3dSharedTypes'

// 有文本语义的 input type（这些里面 WASD/方向键是输入内容，必须挡）。
// range/checkbox/radio/button 等**不在列**：它们上面 WASD 没有文本含义，不该吞移动键——
// 2026-08-07 飞书反馈「操控相机一开始可以、后来没法操控」根因：拖过速度滑杆（input[type=range]）
// 后焦点留在 range 上，旧守卫按 tagName 一刀切把 WASD 全吞了。
const TEXTUAL_INPUT_TYPES = new Set([
  'text', 'search', 'email', 'number', 'password', 'tel', 'url',
  'date', 'datetime-local', 'month', 'time', 'week', 'color',
])

/** 纯判定核心（可单测）：textarea/select/contenteditable 恒文本；input 按 type 分。 */
export function isTextualControl(tagName: string, inputType: string | null): boolean {
  if (tagName !== 'INPUT') return true
  return TEXTUAL_INPUT_TYPES.has((inputType || 'text').toLowerCase())
}

export function isEditableKeyboardTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const host = target.closest('input, textarea, select, [contenteditable="true"]')
  if (!host) return false
  return isTextualControl(host.tagName, host.getAttribute('type'))
}

export function pointerCaptureTarget(target: unknown): PointerCaptureTarget | null {
  return target && typeof target === 'object' ? target as PointerCaptureTarget : null
}

export function isMovementCode(code: string): code is Scene3DMovementCode {
  return MOVEMENT_CODES.has(code)
}

export function clearMovementKeyState(keys: Record<Scene3DMovementCode, boolean>): void {
  keys.KeyW = false
  keys.KeyA = false
  keys.KeyS = false
  keys.KeyD = false
  keys.ArrowUp = false
  keys.ArrowDown = false
  keys.ArrowLeft = false
  keys.ArrowRight = false
  keys.Space = false
  keys.ShiftLeft = false
  keys.ShiftRight = false
}

export function hasActiveMovementKey(keys: Record<Scene3DMovementCode, boolean>): boolean {
  return (
    keys.KeyW ||
    keys.KeyA ||
    keys.KeyS ||
    keys.KeyD ||
    keys.ArrowUp ||
    keys.ArrowDown ||
    keys.ArrowLeft ||
    keys.ArrowRight ||
    keys.Space ||
    keys.ShiftLeft ||
    keys.ShiftRight
  )
}
