import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import React from 'react'
import { render, act } from '@testing-library/react'
import { useCanvasShortcuts } from '../../src/hooks/useCanvasShortcuts.ts'

/**
 * 这些回归测试锁定 useCanvasShortcuts 的「守卫」行为，
 * 防止重构（如 TASK-047 去硬编码化）时误删：
 *   - 选中文本时跳过无修饰快速添加键（Q/W/E）
 *   - 选中文本时不影响带修饰的系统快捷键（Ctrl+Z 等）
 *   - 输入框内的按键一律跳过
 */

// 挂载 hook 的测试组件
function Harness({ handlers }) {
  useCanvasShortcuts(handlers)
  return null
}

function fireKeyDown(init) {
  const e = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init })
  act(() => {
    window.dispatchEvent(e)
  })
  return e
}

// 可控的 window.getSelection
function setSelectionText(text: string) {
  ;(window as any).getSelection = vi.fn(() => ({
    toString: () => text,
  }))
}

beforeEach(() => {
  ;(window as any).getSelection = vi.fn(() => ({ toString: () => '' }))
  localStorage.clear()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('useCanvasShortcuts 守卫（防回退）', () => {
  it('无选中文本时按 Q 应触发 onAdd(textNode)', () => {
    const onAdd = vi.fn()
    render(<Harness handlers={{ onAdd }} />)
    setSelectionText('')
    fireKeyDown({ key: 'q' })
    expect(onAdd).toHaveBeenCalledWith('textNode')
  })

  it('【回归点】选中文本时按 Q 不应触发 onAdd（守卫必须拦截）', () => {
    const onAdd = vi.fn()
    render(<Harness handlers={{ onAdd }} />)
    setSelectionText('hello')
    fireKeyDown({ key: 'q' })
    expect(onAdd).not.toHaveBeenCalled()
  })

  it('【回归点】选中文本时按 W/E 同样不应触发快速添加', () => {
    const onAdd = vi.fn()
    render(<Harness handlers={{ onAdd }} />)
    setSelectionText('selected')
    fireKeyDown({ key: 'w' })
    fireKeyDown({ key: 'e' })
    expect(onAdd).not.toHaveBeenCalled()
  })

  it('选中文本时 Ctrl+Z 仍应触发 onUndo（守卫只挡无修饰键）', () => {
    const onUndo = vi.fn()
    const onAdd = vi.fn()
    render(<Harness handlers={{ onUndo, onAdd }} />)
    setSelectionText('selected')
    fireKeyDown({ key: 'z', ctrlKey: true })
    expect(onUndo).toHaveBeenCalledTimes(1)
    expect(onAdd).not.toHaveBeenCalled()
  })

  it('选中文本时 Ctrl+A 应被守卫跳过（不触发 onSelectAll）', () => {
    const onSelectAll = vi.fn()
    render(<Harness handlers={{ onSelectAll }} />)
    setSelectionText('selected')
    fireKeyDown({ key: 'a', ctrlKey: true })
    expect(onSelectAll).not.toHaveBeenCalled()
  })

  it('输入框内的无修饰 Q 不应触发 onAdd', () => {
    const onAdd = vi.fn()
    render(<Harness handlers={{ onAdd }} />)
    setSelectionText('')
    const input = document.createElement('input')
    document.body.appendChild(input)
    const e = new KeyboardEvent('keydown', { key: 'q', bubbles: true, cancelable: true })
    Object.defineProperty(e, 'target', { value: input })
    act(() => {
      window.dispatchEvent(e)
    })
    expect(onAdd).not.toHaveBeenCalled()
    document.body.removeChild(input)
  })

  it('Ctrl+Z 撤销应触发 onUndo', () => {
    const onUndo = vi.fn()
    render(<Harness handlers={{ onUndo }} />)
    setSelectionText('')
    fireKeyDown({ key: 'z', ctrlKey: true })
    expect(onUndo).toHaveBeenCalledTimes(1)
  })

  it('Ctrl+G 编组应触发 onGroup（任意时刻，不因选中文本跳过）', () => {
    const onGroup = vi.fn()
    render(<Harness handlers={{ onGroup }} />)
    setSelectionText('selected')
    fireKeyDown({ key: 'g', ctrlKey: true })
    expect(onGroup).toHaveBeenCalledTimes(1)
  })
})
