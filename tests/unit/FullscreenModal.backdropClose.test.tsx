/**
 * FullscreenModal「遮罩点击关闭」回归测试。
 *
 * 修复：旧实现 `onClick` 只看 `e.target === e.currentTarget`（点到的公共祖先是否遮罩）。
 * 但用户「从右往左框选文字」时鼠标常在面板内容里按下、到面板外（遮罩）松开，
 * 此时 click 的 target 会落到遮罩（面板是遮罩子元素，两者公共祖先即遮罩）→ 被误判为「点空白」而关闭。
 *
 * 修复：引入 backdropStartRef，仅当「本次 mousedown 起点也落在遮罩空白上」时，click 落在遮罩才关闭。
 * 从面板内容按下（拖选）→ 即使在遮罩上松开也不关闭。
 */
import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent, act } from '@testing-library/react'
import FullscreenModal from '../../src/components/base/panels/FullscreenModal.tsx'

const BACKDROP_SEL = '.input-panel-fullscreen-root'

function renderModal(onClose: () => void) {
  render(
    <FullscreenModal open title="编辑" onClose={onClose} showHeader={false}>
      <div contentEditable suppressContentEditableWarning>
        这是一段可以从右往左框选的文字内容。
      </div>
    </FullscreenModal>
  )
  const backdrop = document.querySelector(BACKDROP_SEL) as HTMLElement
  const content = backdrop?.querySelector('[contenteditable="true"]') as HTMLElement
  return { backdrop, content }
}

describe('FullscreenModal 遮罩点击关闭', () => {
  it('真·点遮罩空白（按下与点击都在遮罩）→ 关闭', () => {
    const onClose = vi.fn()
    const { backdrop } = renderModal(onClose)
    act(() => {
      fireEvent.mouseDown(backdrop)
      fireEvent.click(backdrop)
    })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('从面板内容按下、到遮罩松开（拖选结束在框外）→ 不关闭', () => {
    const onClose = vi.fn()
    const { backdrop, content } = renderModal(onClose)
    act(() => {
      fireEvent.mouseDown(content) // 起点在内容区：从右往左框选开始
      fireEvent.click(backdrop)    // mouseup 落在遮罩，click target 落到遮罩
    })
    expect(onClose).not.toHaveBeenCalled()
  })

  it('按下与点击都在面板内部 → 不关闭', () => {
    const onClose = vi.fn()
    const { content } = renderModal(onClose)
    act(() => {
      fireEvent.mouseDown(content)
      fireEvent.click(content)
    })
    expect(onClose).not.toHaveBeenCalled()
  })
})
