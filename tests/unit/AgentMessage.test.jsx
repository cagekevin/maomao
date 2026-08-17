// @vitest-environment jsdom
/**
 * AgentMessage 单测（批 4）。
 * 覆盖：user / assistant / tool 三态渲染、思考过程折叠、工具调用标签、
 * 图片 URL 渲染、阶段1 策划确认按钮、tool 失败重试按钮。
 * 依赖的 LazyImage / filesApi 统一 mock 为透明占位。
 */
import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

vi.mock('../../src/components/base/LazyImage.jsx', () => ({
  default: ({ src, alt }) => <img data-testid="lazy-img" src={src} alt={alt || ''} />,
}))

// filesApi.toAbsoluteFileUrl 仅做 URL 补全，mock 成原样返回
vi.mock('../../src/components/base/filesApi.js', () => ({
  toAbsoluteFileUrl: (u) => u,
  uploadFileToLocal: vi.fn(),
  uploadResult: vi.fn(),
}))

import AgentMessage from '../../src/components/AgentMessage.jsx'

describe('AgentMessage - user', () => {
  it('渲染用户文本气泡', () => {
    render(<AgentMessage message={{ role: 'user', content: '帮我生一张图' }} />)
    expect(screen.getByText('帮我生一张图')).toBeTruthy()
  })

  it('渲染用户附件缩略图', () => {
    render(<AgentMessage message={{ role: 'user', content: '看这张', attachments: [{ url: 'http://x/a.png' }] }} />)
    // 用户附件用原生 <img>（非 LazyImage），src 透传
    const img = document.querySelector('img[src="http://x/a.png"]')
    expect(img).toBeTruthy()
  })

  it('显示已使用 Skill 标签', () => {
    render(<AgentMessage message={{ role: 'user', content: 'x', skills: [{ name: '风格迁移' }] }} />)
    expect(screen.getByText('风格迁移')).toBeTruthy()
  })
})

describe('AgentMessage - assistant', () => {
  it('渲染助手文本内容', () => {
    render(<AgentMessage message={{ role: 'assistant', content: '好的，开始生成' }} />)
    expect(screen.getByText('好的，开始生成')).toBeTruthy()
  })

  it('渲染工具调用标签（name + 参数）', () => {
    const msg = {
      role: 'assistant',
      content: '',
      tool_calls: [{ function: { name: 'create_node', arguments: '{"type":"imageNode"}' } }],
    }
    render(<AgentMessage message={msg} />)
    expect(screen.getByText('create_node')).toBeTruthy()
    expect(screen.getByText('type=imageNode')).toBeTruthy()
  })

  it('渲染思考过程并点击切换展开/折叠文案', () => {
    render(<AgentMessage message={{ role: 'assistant', content: 'c', reasoning: '让我想想' }} />)
    const toggle = screen.getByText('思考过程')
    expect(toggle).toBeTruthy()
    // 非流式历史消息默认折叠，显示"点击展开"
    expect(screen.getByText('点击展开')).toBeTruthy()
    fireEvent.click(toggle)
    // 展开后文案变为"点击折叠"
    expect(screen.getByText('点击折叠')).toBeTruthy()
  })

  it('图片 URL 在助手回复里渲染成可预览图', () => {
    render(<AgentMessage message={{ role: 'assistant', content: '看 http://x/p.png 这张图' }} />)
    expect(screen.getAllByTestId('lazy-img').length).toBeGreaterThan(0)
  })

  it('awaiting_confirm 时渲染「确认，按此执行」按钮', () => {
    const onConfirm = vi.fn()
    render(<AgentMessage message={{ role: 'assistant', content: 'c', awaiting_confirm: true, streaming: false }} onConfirmPlan={onConfirm} />)
    const btn = screen.getByText('确认，按此执行')
    expect(btn).toBeTruthy()
    fireEvent.click(btn)
    expect(onConfirm).toHaveBeenCalled()
  })

  it('无确认态时不显示确认按钮', () => {
    render(<AgentMessage message={{ role: 'assistant', content: 'c' }} />)
    expect(screen.queryByText('确认，按此执行')).toBeFalsy()
  })
})

describe('AgentMessage - tool', () => {
  it('成功 tool 显示成功图标与文案', () => {
    render(<AgentMessage message={{ role: 'tool', content: JSON.stringify({ ok: true, nodeId: 'n1' }) }} />)
    expect(screen.getByText(/操作成功/)).toBeTruthy()
  })

  it('失败 tool 带 nodeId 时显示「重试」按钮', () => {
    const onRetry = vi.fn()
    render(<AgentMessage message={{ role: 'tool', content: JSON.stringify({ ok: false, error: '生成失败', nodeId: 'n1' }) }} onRetryStep={onRetry} />)
    const btn = screen.getByText('重试')
    expect(btn).toBeTruthy()
    fireEvent.click(btn)
    expect(onRetry).toHaveBeenCalledWith('n1')
  })

  it('execute_plan 多步失败渲染「重试此步」按钮', () => {
    const onRetry = vi.fn()
    const content = JSON.stringify({
      ok: false,
      data: { entries: [{ nodeId: 'a', status: 'failed', error: 'e1' }, { nodeId: 'b', status: 'failed', error: 'e2' }] },
    })
    render(<AgentMessage message={{ role: 'tool', content }} onRetryStep={onRetry} />)
    const btns = screen.getAllByText('重试此步')
    expect(btns.length).toBe(2)
    fireEvent.click(btns[0])
    expect(onRetry).toHaveBeenCalledWith('a')
  })
})
