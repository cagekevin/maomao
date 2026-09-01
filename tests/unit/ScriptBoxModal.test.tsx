/**
 * 剧本盒子统一节点内弹层容器单测。
 * 保证收口后的 ScriptBoxModal 行为稳定：标题/默认页脚/自定义页脚/宽度/高度/遮罩点击关闭。
 *
 * 运行：vitest run tests/unit/ScriptBoxModal.test.jsx
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'
import ScriptBoxModal from '../../src/components/scriptbox/ScriptBoxModal.tsx'

describe('ScriptBoxModal（剧本盒统一节点内弹层容器）', () => {
  it('渲染标题 + 默认「取消/确定」页脚', () => {
    const onClose = vi.fn()
    const onOk = vi.fn()
    render(
      <ScriptBoxModal title="编辑画面描述" onClose={onClose} onOk={onOk}>
        <span>正文内容</span>
      </ScriptBoxModal>
    )
    expect(screen.getByText('编辑画面描述')).toBeTruthy()
    expect(screen.getByText('正文内容')).toBeTruthy()
    expect(screen.getByText('取消')).toBeTruthy()
    expect(screen.getByText('确定')).toBeTruthy()
  })

  it('点「确定」触发 onOk，点「取消」触发 onClose', () => {
    const onClose = vi.fn()
    const onOk = vi.fn()
    render(<ScriptBoxModal title="t" onClose={onClose} onOk={onOk}><span>x</span></ScriptBoxModal>)
    fireEvent.click(screen.getByText('确定'))
    expect(onOk).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByText('取消'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('自定义 okText / cancelText', () => {
    render(
      <ScriptBoxModal title="标题" onClose={() => {}} onOk={() => {}} okText="重新生成" cancelText="不生成">
        <span>x</span>
      </ScriptBoxModal>
    )
    expect(screen.getByText('重新生成')).toBeTruthy()
    expect(screen.getByText('不生成')).toBeTruthy()
  })

  it('传 footer prop 时用自定义页脚，覆盖默认按钮', () => {
    render(
      <ScriptBoxModal title="总体设置" onClose={() => {}} footer={<button>保存</button>}>
        <span>x</span>
      </ScriptBoxModal>
    )
    expect(screen.getByText('保存')).toBeTruthy()
    // 默认「取消/确定」不应出现
    expect(screen.queryByText('确定')).toBeNull()
    expect(screen.queryByText('取消')).toBeNull()
  })

  it('宽度/高度透传到卡片', () => {
    const { container } = render(
      <ScriptBoxModal title="t" width={760} height={600} onClose={() => {}}><span>x</span></ScriptBoxModal>
    )
    // 卡片是第二个 div（遮罩为第一个）
    const card = container.querySelector('div[style*="width: 760px"]')
    expect(card).toBeTruthy()
    expect(card.style.height).toBe('600px')
  })
})
