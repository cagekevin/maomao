// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import NodeTitle from '../../src/components/NodeTitle.jsx'

describe('NodeTitle', () => {
  it('默认用 defaultTitle 显示', () => {
    render(<NodeTitle defaultTitle="剧本盒子" />)
    expect(screen.getByText('剧本盒子')).toBeTruthy()
  })

  it('label 优先于 defaultTitle', () => {
    render(<NodeTitle label="我的标题" defaultTitle="默认" />)
    expect(screen.getByText('我的标题')).toBeTruthy()
  })

  it('双击进入编辑态（input）', () => {
    render(<NodeTitle label="标题" defaultTitle="默认" />)
    const btn = screen.getByText('标题')
    fireEvent.doubleClick(btn)
    const input = document.querySelector('input')
    expect(input).toBeTruthy()
  })

  it('编辑回车提交并裁剪空白', () => {
    render(<NodeTitle label="标题" defaultTitle="默认" />)
    fireEvent.doubleClick(screen.getByText('标题'))
    const input = document.querySelector('input')
    fireEvent.change(input, { target: { value: '  新名字  ' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    // 提交后回到按钮态，显示裁剪后的名字
    expect(screen.getByText('新名字')).toBeTruthy()
  })

  it('编辑 Escape 取消恢复原名', () => {
    render(<NodeTitle label="原名" defaultTitle="默认" />)
    fireEvent.doubleClick(screen.getByText('原名'))
    const input = document.querySelector('input')
    fireEvent.change(input, { target: { value: '临时' } })
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(screen.getByText('原名')).toBeTruthy()
  })

  it('label 变化后内容同步', () => {
    const { rerender } = render(<NodeTitle label="A" defaultTitle="默认" />)
    expect(screen.getByText('A')).toBeTruthy()
    rerender(<NodeTitle label="B" defaultTitle="默认" />)
    expect(screen.getByText('B')).toBeTruthy()
  })
})
