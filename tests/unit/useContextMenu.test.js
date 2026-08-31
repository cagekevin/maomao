// @vitest-environment jsdom
/**
 * useContextMenu 单测（批 3）。
 * 覆盖 useContextMenu() hook 的状态/回调行为：
 *   - onPaneContextMenu：空白处右键 → state.type==='canvas'，并 preventDefault/stopPropagation
 *   - onNodeContextMenu：节点右键 → state.type==='node' & nodeId
 *   - onPaneClick / close：关闭（state=null）
 *   - 可编辑目标（input/textarea）右键被忽略（isEditableTarget 守卫）
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'

const { useContextMenu } = await import('../../src/hooks/useContextMenu.ts')

function makeEvent({ target, clientX = 5, clientY = 6 } = {}) {
  const e = {
    clientX,
    clientY,
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
    target: target || document.createElement('div'),
  }
  return e
}

describe('useContextMenu', () => {
  let hook
  beforeEach(() => {
    const r = renderHook(() => useContextMenu())
    hook = r.result
  })

  it('初始 state 为 null', () => {
    expect(hook.current.state).toBeNull()
  })

  it('onPaneContextMenu → canvas 菜单 + 阻止默认/冒泡', () => {
    const e = makeEvent()
    act(() => hook.current.onPaneContextMenu(e))
    expect(hook.current.state).not.toBeNull()
    expect(hook.current.state.type).toBe('canvas')
    expect(hook.current.state.nodeId).toBeUndefined()
    expect(e.preventDefault).toHaveBeenCalled()
    expect(e.stopPropagation).toHaveBeenCalled()
  })

  it('onNodeContextMenu → node 菜单带 nodeId', () => {
    const e = makeEvent()
    act(() => hook.current.onNodeContextMenu(e, { id: 'n1' }))
    expect(hook.current.state.type).toBe('node')
    expect(hook.current.state.nodeId).toBe('n1')
  })

  it('onPaneClick / close → 关闭', () => {
    const e = makeEvent()
    act(() => hook.current.onPaneContextMenu(e))
    expect(hook.current.state).not.toBeNull()
    act(() => hook.current.onPaneClick())
    expect(hook.current.state).toBeNull()
    act(() => hook.current.onPaneContextMenu(e))
    act(() => hook.current.close())
    expect(hook.current.state).toBeNull()
  })

  it('可编辑目标（input）右键被忽略', () => {
    const input = document.createElement('input')
    const e = makeEvent({ target: input })
    act(() => hook.current.onPaneContextMenu(e))
    expect(hook.current.state).toBeNull()
  })
})
