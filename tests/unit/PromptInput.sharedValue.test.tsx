// @ts-nocheck
/**
 * PromptInput「两个实例共用同一个 value」回归测试（全屏大窗光标被抢）。
 *
 * 场景（TextNode / DiscountVideoNode / PromptNode / TemplateNode 均如此）：
 * 节点面板里的 PromptInput 与全屏弹窗里的 PromptInput 同时挂载、共用同一个 value。
 * 在弹窗里每敲一个字 → value 变 → 面板那个实例也走「外部 value 变化 → 重建 DOM」分支。
 * 若它无差别 restoreCursor，就会把全局 selection 抢到自己内部，光标瞬间跳出弹窗，
 * 后续输入的字全落进面板那个被遮住的输入框（现象：一写字光标就错乱）。
 *
 * 断言核心：编辑哪个实例，selection 就必须留在哪个实例里。
 */
import React, { useState } from 'react'
import { describe, it, expect } from 'vitest'
import { render, fireEvent, act } from '@testing-library/react'
import PromptInput from '../../src/components/base/PromptInput.tsx'

/** 面板实例 + 全屏实例，共用同一份 value（复刻节点里的挂载形态） */
function SharedValueHarness() {
  const [value, setValue] = useState('')
  return (
    <>
      <PromptInput value={value} onChange={setValue} placeholder="面板" richText />
      <PromptInput value={value} onChange={setValue} placeholder="全屏" richText />
    </>
  )
}

/** 单实例 + 外部改 value（模拟预设追加/改名重建） */
function ExternalChangeHarness() {
  const [value, setValue] = useState('abc')
  return (
    <>
      <button type="button" onClick={() => setValue('Xabc')}>外改</button>
      <PromptInput value={value} onChange={setValue} richText />
    </>
  )
}

const placeCaretAtEnd = (el) => {
  const range = document.createRange()
  range.selectNodeContents(el)
  range.collapse(false)
  const sel = document.getSelection()
  sel.removeAllRanges()
  sel.addRange(range)
}

/** 模拟在 contentEditable 里敲一个字：插入文本 + 光标后移 + 派发 input */
const typeInto = (el, ch) => {
  const sel = document.getSelection()
  const range = sel.getRangeAt(0)
  const node = document.createTextNode(ch)
  range.insertNode(node)
  range.setStartAfter(node)
  range.collapse(true)
  sel.removeAllRanges()
  sel.addRange(range)
  fireEvent.input(el)
}

describe('PromptInput 共享 value 双实例', () => {
  it('在全屏实例里打字，光标不会被面板实例抢走', () => {
    const { container } = render(<SharedValueHarness />)
    const [panel, full] = container.querySelectorAll('[contenteditable="true"]')

    act(() => {
      placeCaretAtEnd(full)
      typeInto(full, 'a')
    })

    const sel = document.getSelection()
    expect(full.contains(sel.anchorNode)).toBe(true)
    expect(panel.contains(sel.anchorNode)).toBe(false)
    expect(full.textContent).toBe('a')
  })

  it('连续输入时每敲一个字光标都留在大窗里，且面板实例同步到同一内容', () => {
    const { container } = render(<SharedValueHarness />)
    const [panel, full] = container.querySelectorAll('[contenteditable="true"]')

    act(() => {
      placeCaretAtEnd(full)
      for (const ch of ['a', 'b', 'c']) typeInto(full, ch)
    })

    const sel = document.getSelection()
    expect(full.contains(sel.anchorNode)).toBe(true)
    expect(full.textContent).toBe('abc')
    expect(panel.textContent).toBe('abc') // 面板实例重建后内容与大窗一致
  })
})

describe('PromptInput 外部 value 变化重建', () => {
  it('重建后光标仍停在原偏移，不会跳到开头', () => {
    const { container } = render(<ExternalChangeHarness />)
    const el = container.querySelector('[contenteditable="true"]')
    const textNode = el.firstChild

    act(() => {
      const range = document.createRange()
      range.setStart(textNode, 1) // 'a|bc'
      range.collapse(true)
      const sel = document.getSelection()
      sel.removeAllRanges()
      sel.addRange(range)
    })

    act(() => {
      container.querySelector('button').click()
    })

    const range = document.getSelection().getRangeAt(0)
    expect(el.contains(range.startContainer)).toBe(true)
    expect(range.startContainer.textContent).toBe('Xabc')
    expect(range.startOffset).toBe(1) // 仍是 'X|a…' 的相对位置语义（不丢光标）
  })
})
