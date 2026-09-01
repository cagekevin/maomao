/**
 * NodeTitle 深度测试。
 *
 * 节点标题栏：显示小图标 + 名称，双击改名，支持拖拽（drag-handle）。
 * 此前测试只有「挂载不崩」冒烟，编辑交互/边界全部测不出。
 * 本文件改为断言真实交互：
 *  - label 与 defaultTitle 的优先级（label 优先）
 *  - label 变化时跟随（useEffect 同步）
 *  - 双击进入编辑态 → 输入 → Enter 提交、blur 提交、Escape 取消还原
 *  - 空/纯空格输入回退到 defaultTitle（trim 兜底）
 *  - 拖拽句柄类名 drag-handle（无限画布拖拽依赖）
 */
import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import NodeTitle from '../../src/components/base/NodeTitle.tsx'

function setup(props: { label?: string; defaultTitle?: string; icon?: React.ReactNode; className?: string; floating?: boolean; onRename?: () => void } = {}) {
  const view = render(
    <NodeTitle
      label={props.label}
      defaultTitle={props.defaultTitle || '未命名'}
      icon={props.icon}
      className={props.className}
      floating={props.floating}
      onRename={props.onRename}
    />
  )
  return view
}

describe('NodeTitle — 展示', () => {
  it('label 优先于 defaultTitle 展示', () => {
    setup({ label: '我的节点', defaultTitle: '默认名' })
    expect(screen.getByRole('button', { name: '我的节点' })).toBeTruthy()
    expect(screen.queryByText('默认名')).toBeNull()
  })

  it('无 label 时回退到 defaultTitle', () => {
    setup({ label: '', defaultTitle: '默认名' })
    expect(screen.getByRole('button', { name: '默认名' })).toBeTruthy()
  })

  it('渲染自定义图标', () => {
    setup({ label: '节点', icon: <span data-testid="node-icon">◎</span> })
    expect(screen.getByTestId('node-icon')).toBeTruthy()
  })

  it('外部 label 变化时标题跟随更新', () => {
    const { rerender } = setup({ label: '旧名' })
    expect(screen.getByRole('button', { name: '旧名' })).toBeTruthy()
    rerender(<NodeTitle label="新名" defaultTitle="默认名" />)
    expect(screen.getByRole('button', { name: '新名' })).toBeTruthy()
    expect(screen.queryByText('旧名')).toBeNull()
  })

  it('带 drag-handle 与 cursor-move，支持无限画布拖拽', () => {
    setup({ label: '节点' })
    const wrap = screen.getByRole('button', { name: '节点' }).closest('div')
    expect(wrap.className).toContain('drag-handle')
    expect(wrap.className).toContain('cursor-move')
  })

  it('floating 时使用绝对定位类（悬浮标题栏）', () => {
    setup({ label: '节点', floating: true })
    const wrap = screen.getByRole('button', { name: '节点' }).closest('div')
    expect(wrap.className).toContain('absolute')
    expect(wrap.className).toContain('-top-6')
  })
})

describe('NodeTitle — 双击改名交互', () => {
  it('双击进入编辑态，显示输入框并聚焦', () => {
    setup({ label: '旧名' })
    fireEvent.doubleClick(screen.getByRole('button', { name: '旧名' }))
    const input = screen.getByRole('textbox')
    expect(input).toBeTruthy()
    expect((input as HTMLInputElement).value).toBe('旧名')
  })

  it('Enter 提交新名称', () => {
    setup({ label: '旧名' })
    fireEvent.doubleClick(screen.getByRole('button', { name: '旧名' }))
    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: '新名字' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    // 提交后回到展示态
    expect(screen.queryByRole('textbox')).toBeNull()
    expect(screen.getByRole('button', { name: '新名字' })).toBeTruthy()
  })

  it('失焦（blur）提交新名称', () => {
    setup({ label: '旧名' })
    fireEvent.doubleClick(screen.getByRole('button', { name: '旧名' }))
    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: '失焦提交' } })
    fireEvent.blur(input)
    expect(screen.queryByRole('textbox')).toBeNull()
    expect(screen.getByRole('button', { name: '失焦提交' })).toBeTruthy()
  })

  it('Escape 取消编辑并还原为 label', () => {
    setup({ label: '旧名' })
    fireEvent.doubleClick(screen.getByRole('button', { name: '旧名' }))
    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: '不要这个' } })
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(screen.queryByRole('textbox')).toBeNull()
    expect(screen.getByRole('button', { name: '旧名' })).toBeTruthy()
  })

  it('输入纯空格提交时回退到 defaultTitle（trim 兜底）', () => {
    setup({ label: '旧名', defaultTitle: '默认名' })
    fireEvent.doubleClick(screen.getByRole('button', { name: '旧名' }))
    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: '   ' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(screen.getByRole('button', { name: '默认名' })).toBeTruthy()
  })

  it('输入为空字符串提交时回退到 defaultTitle', () => {
    setup({ label: '旧名', defaultTitle: '默认名' })
    fireEvent.doubleClick(screen.getByRole('button', { name: '旧名' }))
    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: '' } })
    fireEvent.blur(input)
    expect(screen.getByRole('button', { name: '默认名' })).toBeTruthy()
  })

  it('编辑态输入框带 nodrag，避免拖拽冲突', () => {
    setup({ label: '旧名' })
    fireEvent.doubleClick(screen.getByRole('button', { name: '旧名' }))
    const input = screen.getByRole('textbox')
    expect(input.className).toContain('nodrag')
    expect(input.className).toContain('nowheel')
  })

  it('传入 onRename 时，Enter 提交会回调新名（写回节点数据）', () => {
    const onRename = vi.fn()
    setup({ label: '旧名', onRename })
    fireEvent.doubleClick(screen.getByRole('button', { name: '旧名' }))
    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: '猫' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onRename).toHaveBeenCalledWith('猫')
  })

  it('传入 onRename 时，blur 提交会回调新名', () => {
    const onRename = vi.fn()
    setup({ label: '旧名', onRename })
    fireEvent.doubleClick(screen.getByRole('button', { name: '旧名' }))
    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: '狗' } })
    fireEvent.blur(input)
    expect(onRename).toHaveBeenCalledWith('狗')
  })

  it('传入 onRename 时，空/纯空格输入回退 defaultTitle 后仍回调默认名', () => {
    const onRename = vi.fn()
    setup({ label: '旧名', defaultTitle: '图片', onRename })
    fireEvent.doubleClick(screen.getByRole('button', { name: '旧名' }))
    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: '   ' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onRename).toHaveBeenCalledWith('图片')
  })

  it('不传 onRename 时不回调（向后兼容，零影响其他节点）', () => {
    const onRename = vi.fn()
    setup({ label: '旧名' }) // 不传 onRename
    fireEvent.doubleClick(screen.getByRole('button', { name: '旧名' }))
    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: '新名' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onRename).not.toHaveBeenCalled()
  })
})
