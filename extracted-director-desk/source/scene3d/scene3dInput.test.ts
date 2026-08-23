import { describe, expect, it } from 'vitest'
import { isTextualControl } from './scene3dInput'

// 键盘守卫回归门岗（2026-08-07 飞书反馈「操控相机一开始可以、后来没法操控」根因）：
// 守卫只挡**文本语义**控件（text/number/textarea/select/contenteditable），
// range/checkbox/button 这类非文本控件上 WASD 没有文本含义，必须放行。

describe('isTextualControl', () => {
  it('文本类 input 被挡', () => {
    expect(isTextualControl('INPUT', 'text')).toBe(true)
    expect(isTextualControl('INPUT', 'number')).toBe(true)
    expect(isTextualControl('INPUT', null)).toBe(true) // 缺省 type=text
    expect(isTextualControl('INPUT', 'TEXT')).toBe(true) // 大小写不敏感
  })

  it('range/checkbox 等非文本 input 放行（操控滑杆拖完后 WASD 不被吞）', () => {
    expect(isTextualControl('INPUT', 'range')).toBe(false)
    expect(isTextualControl('INPUT', 'checkbox')).toBe(false)
    expect(isTextualControl('INPUT', 'radio')).toBe(false)
    expect(isTextualControl('INPUT', 'button')).toBe(false)
  })

  it('textarea/select 恒为文本语义', () => {
    expect(isTextualControl('TEXTAREA', null)).toBe(true)
    expect(isTextualControl('SELECT', null)).toBe(true)
  })
})
