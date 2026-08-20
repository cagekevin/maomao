// @vitest-environment jsdom
/**
 * LoopNode 深度测试。
 * 审计建议 P1：循环次数、上游连接、拆分逻辑。
 * 该节点导出纯函数 splitByMethod / splitSmartPromptItems，可用契约测试覆盖拆分边界，
 * 再配合 UI 测试验证「上游文本 → 分段渲染 → 运行建节点」主链路。
 */
import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { mocks } from './_nodeMocks.mjs'
import { splitByMethod, splitSmartPromptItems } from '../../src/components/nodes/LoopNode.jsx'

vi.mock('@xyflow/react', () => mocks.xyflow)
vi.mock('../../src/components/base/NodeShell.jsx', () => ({ default: mocks.NodeShell }))
vi.mock('../../src/components/base/useConnectedInputs.js', () => ({ useConnectedInputs: mocks.useConnectedInputs }))
vi.mock('../../src/components/base/toastStore.js', () => ({ showToast: mocks.showToast, toastWarning: mocks.toastWarning }))
vi.mock('../../src/components/base/useSyncNodeData.js', () => ({ useSyncNodeData: mocks.useSyncNodeData }))
vi.mock('../../src/components/base/hooks.js', () => ({ useOutsideClick: mocks.useOutsideClick }))

import LoopNodeComponent from '../../src/components/nodes/LoopNode.jsx'
beforeEach(() => { mocks.resetNodeMockState() })
const setup = (props = {}) => render(<LoopNodeComponent id="lp1" data={{}} selected={false} {...props} />)

describe('LoopNode — 拆分纯函数契约（splitSmartPromptItems）', () => {
  it('数字序号切分（含无空格写法），去重空段', () => {
    const r = splitSmartPromptItems('1.主图 2.配色 3.参考')
    expect(r).toEqual(['主图', '配色', '参考'])
  })

  it('换行切分（2 段以上才切，单段回退整段）', () => {
    expect(splitSmartPromptItems('甲\n乙\n丙')).toEqual(['甲', '乙', '丙'])
    expect(splitSmartPromptItems('只有一段')).toEqual(['只有一段'])
  })

  it('空/空白输入 → 空数组', () => {
    expect(splitSmartPromptItems('')).toEqual([])
    expect(splitSmartPromptItems('   ')).toEqual([])
    expect(splitSmartPromptItems()).toEqual([])
  })
})

describe('LoopNode — 拆分方式（splitByMethod）', () => {
  it('newline：按回车换行切', () => {
    expect(splitByMethod('a\nb\nc', 'newline')).toEqual(['a', 'b', 'c'])
  })
  it('number：按序号切', () => {
    expect(splitByMethod('1.甲 2.乙', 'number')).toEqual(['甲', '乙'])
  })
  it('semicolon：按分号切（兼容中英文分号）', () => {
    expect(splitByMethod('a;b；c', 'semicolon')).toEqual(['a', 'b', 'c'])
  })
  it('json：解析数组，非法 JSON 回退整段', () => {
    expect(splitByMethod('["x","y"]', 'json')).toEqual(['x', 'y'])
    expect(splitByMethod('不是json', 'json')).toEqual(['不是json'])
  })
  it('ordinal：按「第N张图」等序数词切', () => {
    const r = splitByMethod('第一张图：主图 第二张图：配色', 'ordinal')
    expect(r).toHaveLength(2)
  })
})

describe('LoopNode — UI 上游连接与运行', () => {
  it('空态（无上游文本）→ 不显示分段、不显示段数', () => {
    setup()
    expect(screen.queryByText(/段$/)).toBeNull()
    expect(screen.getByText('运行')).toBeTruthy()
  })

  it('上游文本 → 按换行分成 N 段 textarea', () => {
    mocks.setConnectedInputs({ images: [], texts: [{ text: '段落一\n段落二\n段落三' }] })
    setup()
    expect(screen.getAllByRole('textbox')).toHaveLength(3)
    expect(screen.getByText('3 段')).toBeTruthy()
  })

  it('点「运行」→ 为每段建生图节点（setNodes 被调用）', () => {
    mocks.setConnectedInputs({ images: [], texts: [{ text: '甲\n乙' }] })
    setup()
    const before = mocks.xyflowCalls.setNodes
    fireEvent.click(screen.getByText('运行'))
    expect(mocks.xyflowCalls.setNodes).toBeGreaterThan(before)
  })

  it('切换拆分方式下拉 → 按序号重切段', () => {
    mocks.setConnectedInputs({ images: [], texts: [{ text: '1.主图 2.配色' }] })
    setup()
    // 默认为 newline：无换行 → 整段 1 段
    expect(screen.getByText('1 段')).toBeTruthy()
    fireEvent.click(screen.getByText('按回车换行'))
    // 下拉菜单项用 onMouseDown 触发切换（非 onClick）
    fireEvent.mouseDown(screen.getByText('按序号 (1. 2. 3.)'))
    expect(screen.getByText('2 段')).toBeTruthy()
  })
})