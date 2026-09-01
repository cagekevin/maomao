/**
 * TaskCenter 深度测试。
 *
 * TaskCenter 是任务中心面板（近 200 次提交改动 8 次，此前无测试）。
 * 核心交互：状态/类型筛选、搜索、任务卡片多态渲染（完成/进行中/失败/待处理）、
 * 更多菜单（重试/删除/下载/刷新）、大图预览、清理任务。
 *
 * 本文件断言真实行为：
 *  - 空态渲染
 *  - 过滤/搜索/类型筛选
 *  - 各状态卡片渲染（进度条、阶段文案、错误块、缩略图）
 *  - 更多菜单操作（重试/删除/下载/复制）
 *  - 大图预览弹窗
 *  - 清理任务
 */
import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

// 内存状态：任务列表
const h = vi.hoisted(() => {
  let tasks = []
  const useTasks = vi.fn(() => tasks)
  const setTasks = (list) => { tasks = list }
  const removeTask = vi.fn()
  // 带 rest 参数声明：保证 mock 工厂可无损透传调用参数，无需 as any 强转
  const retryTask = vi.fn((..._a: unknown[]) => true)
  const clearTasksBy = vi.fn()
  const clearAllTasks = vi.fn()
  const pollOneTask = vi.fn()
  const downloadUrl = vi.fn(async (..._a: unknown[]) => ({ ok: true }))
  const showToast = vi.fn()
  const clipboardWrite = vi.fn()
  const loggerWarn = vi.fn()
  return { useTasks, setTasks, removeTask, retryTask, clearTasksBy, clearAllTasks, pollOneTask, downloadUrl, showToast, clipboardWrite, loggerWarn }
})

// jsdom 无 navigator.clipboard；复制提示词逻辑依赖它，固定为一个可断言 mock
Object.defineProperty(globalThis.navigator, 'clipboard', {
  value: { writeText: (...a) => h.clipboardWrite(...a) },
  configurable: true,
})

vi.mock('../../src/components/base/taskStore.ts', () => ({
  useTasks: () => h.useTasks(),
  // 纯函数按真实实现兜底，不改组件行为
  statusDotClass: (status) => {
    if (status === 'completed') return 'bg-emerald-400'
    if (status === 'failed') return 'bg-red-400'
    return 'bg-blue-400'
  },
  statusLabel: (status, progress = 0) => {
    if (status === 'completed') return '已完成'
    if (status === 'failed') return '失败'
    if (status === 'pending') return '生成中'
    if (status === 'running') return progress > 0 ? `${Math.round(progress)}%` : '生成中'
    return status
  },
  typeLabel: (type: string) =>
    ({ text: '文本', image: '生图', video: '视频', sd2Video: 'SD2视频', discountVideo: '特惠视频', custom: '万能', rhWebapp: 'AI应用' } as Record<string, string>)[type] || type,
  removeTask: (...a: unknown[]) => h.removeTask(...a),
  retryTask: (...a: unknown[]) => h.retryTask(...a),
  clearTasksBy: (...a: unknown[]) => h.clearTasksBy(...a),
  clearAllTasks: (...a: unknown[]) => h.clearAllTasks(...a),
}))
vi.mock('../../src/components/base/logger.ts', () => ({ logger: { warn: (...a: unknown[]) => h.loggerWarn(...a) } }))
vi.mock('../../src/components/base/clipboard.ts', () => ({ downloadUrl: (...a: unknown[]) => h.downloadUrl(...a) }))
vi.mock('../../src/components/base/api/pollTask.ts', () => ({ pollOneTask: (...a: unknown[]) => h.pollOneTask(...a) }))
vi.mock('../../src/components/base/toastStore.ts', () => ({ showToast: (...a: unknown[]) => h.showToast(...a) }))
vi.mock('../../src/hooks/useAssetDragToCanvas.ts', () => ({ makeAssetDragProps: () => ({ draggable: true }) }))
vi.mock('../../src/components/base/hooks.ts', () => ({ useOutsideClick: () => {} }))
vi.mock('../../src/components/base/imageUrl.ts', () => ({
  useRenderImageResolver: () => (u) => (u && u.startsWith('/files/') ? `THUMB${u}` : u || ''),
}))
vi.mock('../../src/components/base/VideoThumbnail.tsx', () => ({ default: ({ src, onActivate }) =>
  React.createElement('div', { 'data-testid': 'video-thumbnail', onClick: onActivate }, src) }))

import TaskCenter from '../../src/components/base/TaskCenter.tsx'

function makeTask(overrides = {}) {
  return {
    id: 't1', status: 'completed', type: 'image', modelName: 'gpt-4o', prompt: '一只猫',
    createdAt: '2026-08-18T10:00:00Z', resultUrl: 'http://x/result.png', stageLabel: '',
    progress: 0, errorMsg: '', pollTaskId: '', nodeId: 'n1', channelName: 'web',
    ...overrides,
  }
}

beforeEach(() => {
  h.setTasks([])
  vi.clearAllMocks()
})

describe('TaskCenter — 空态', () => {
  it('无任务 → 显示「暂无任务」', () => {
    render(<TaskCenter />)
    expect(screen.getByText('暂无任务')).toBeTruthy()
  })
})

describe('TaskCenter — 任务列表渲染', () => {
  it('显示任务状态圆点、文案、类型、模型名', () => {
    h.setTasks([makeTask()])
    render(<TaskCenter />)
    expect(screen.getByText('已完成')).toBeTruthy()
    expect(screen.getByText('生图')).toBeTruthy()
    expect(screen.getByText('gpt-4o')).toBeTruthy()
    expect(screen.getByText('一只猫')).toBeTruthy()
  })

  it('运行中任务 → 显示进度条、阶段文案、百分比', () => {
    h.setTasks([makeTask({ status: 'running', progress: 60, stageLabel: '正在生图…' })])
    render(<TaskCenter />)
    expect(screen.getByText('正在生图…')).toBeTruthy()
    expect(screen.getAllByText('60%').length).toBeGreaterThan(0) // 状态徽标 + 进度文本各显示一次
  })

  it('待处理任务 → 显示「生成中」', () => {
    h.setTasks([makeTask({ status: 'pending' })])
    render(<TaskCenter />)
    expect(screen.getByText('生成中')).toBeTruthy()
  })

  it('失败任务 → 显示错误信息', () => {
    h.setTasks([makeTask({ status: 'failed', errorMsg: 'API 超时' })])
    render(<TaskCenter />)
    expect(screen.getByText('失败')).toBeTruthy()
    expect(screen.getByText('API 超时')).toBeTruthy()
  })

  it('已完成图片任务 → 显示缩略图', () => {
    h.setTasks([makeTask({ type: 'image', resultUrl: 'http://x/done.png' })])
    render(<TaskCenter />)
    const img = document.querySelector('img[src="http://x/done.png"]')
    expect(img).toBeTruthy()
  })

  it('已完成视频任务 → 渲染 VideoThumbnail', () => {
    h.setTasks([makeTask({ type: 'video', resultUrl: 'http://x/video.mp4' })])
    render(<TaskCenter />)
    expect(screen.getByTestId('video-thumbnail')).toBeTruthy()
  })
})

describe('TaskCenter — 过滤与搜索', () => {
  beforeEach(() => {
    h.setTasks([
      makeTask({ id: 't1', status: 'completed', type: 'image', prompt: '猫' }),
      makeTask({ id: 't2', status: 'running', type: 'video', prompt: '狗' }),
      makeTask({ id: 't3', status: 'failed', type: 'text', prompt: '鸟' }),
    ])
  })

  it('点击过滤按钮 → 展开过滤区', () => {
    render(<TaskCenter />)
    fireEvent.click(screen.getByText('过滤'))
    expect(screen.getByPlaceholderText('搜索提示词或渠道...')).toBeTruthy()
  })

  it('搜索关键词 → 过滤任务', () => {
    render(<TaskCenter />)
    fireEvent.click(screen.getByText('过滤'))
    fireEvent.change(screen.getByPlaceholderText('搜索提示词或渠道...'), { target: { value: '猫' } })
    expect(screen.getByText('猫')).toBeTruthy()
    // P2：过滤经 200ms 防抖后生效（输入即时、过滤停顿后触发）
    return waitFor(() => expect(screen.queryByText('狗')).toBeNull())
  })

  it('状态下拉筛选 → 只显示失败', () => {
    render(<TaskCenter />)
    fireEvent.click(screen.getByText('过滤'))
    fireEvent.change(screen.getByDisplayValue('所有状态'), { target: { value: 'failed' } })
    expect(screen.getByText('鸟')).toBeTruthy()
    expect(screen.queryByText('猫')).toBeNull()
  })

  it('类型下拉筛选 → 只显示视频', () => {
    render(<TaskCenter />)
    fireEvent.click(screen.getByText('过滤'))
    fireEvent.change(screen.getAllByDisplayValue('所有类型')[0], { target: { value: 'video' } })
    expect(screen.getByText('狗')).toBeTruthy()
    expect(screen.queryByText('猫')).toBeNull()
  })
})

describe('TaskCenter — 更多菜单操作', () => {
  it('点击 ⋮ 打开菜单，点「复制提示词」→ showToast 提示已复制（校验副作用参数）', () => {
    h.setTasks([makeTask()])
    render(<TaskCenter />)
    const menus = document.querySelectorAll('button[title="复制提示词"]')
    fireEvent.click(menus[0])
    expect(h.showToast).toHaveBeenCalledWith('已复制提示词', { type: 'success' })
  })

  it('更多菜单 → 点击「再来一次」触发 retryTask', () => {
    h.setTasks([makeTask()])
    render(<TaskCenter />)
    // 打开 ⋮ 菜单
    fireEvent.click(screen.getByTitle('更多操作'))
    fireEvent.click(screen.getByText('再来一次'))
    expect(h.retryTask).toHaveBeenCalledWith('t1')
  })

  it('更多菜单 → 点击「删除任务」触发 removeTask', () => {
    h.setTasks([makeTask()])
    render(<TaskCenter />)
    fireEvent.click(screen.getByTitle('更多操作'))
    fireEvent.click(screen.getByText('删除任务'))
    expect(h.removeTask).toHaveBeenCalledWith('t1')
  })

  it('已完成任务 → 更多菜单显示「下载结果」', () => {
    h.setTasks([makeTask({ status: 'completed' })])
    render(<TaskCenter />)
    fireEvent.click(screen.getByTitle('更多操作'))
    expect(screen.getByText('下载结果')).toBeTruthy()
  })

  it('运行中任务 → 更多菜单不显示「下载结果」', () => {
    h.setTasks([makeTask({ status: 'running', pollTaskId: 'p1' })])
    render(<TaskCenter />)
    fireEvent.click(screen.getByTitle('更多操作'))
    expect(screen.queryByText('下载结果')).toBeNull()
    expect(screen.getByText('再来一次')).toBeTruthy()
  })

  it('失败任务(有 pollTaskId) → 更多菜单显示「刷新状态」', () => {
    h.setTasks([makeTask({ status: 'failed', pollTaskId: 'p1' })])
    render(<TaskCenter />)
    fireEvent.click(screen.getByTitle('更多操作'))
    expect(screen.getByText('刷新状态')).toBeTruthy()
  })
})

describe('TaskCenter — 大图预览', () => {
  it('点击已完成图片缩略图 → 打开预览弹窗', () => {
    h.setTasks([makeTask({ type: 'image', resultUrl: 'http://x/big.png' })])
    render(<TaskCenter />)
    const img = document.querySelector('img[src="http://x/big.png"]')
    fireEvent.click(img.closest('[class*="cursor-pointer"]'))
    expect(screen.getByText('按住拖到画布添加')).toBeTruthy()
    expect(screen.getByTitle('关闭')).toBeTruthy()
  })

  it('预览弹窗关闭按钮 → 关闭弹窗', () => {
    h.setTasks([makeTask({ type: 'image', resultUrl: 'http://x/big.png' })])
    render(<TaskCenter />)
    const img = document.querySelector('img[src="http://x/big.png"]')
    fireEvent.click(img.closest('[class*="cursor-pointer"]'))
    fireEvent.click(screen.getByTitle('关闭'))
    expect(screen.queryByText('按住拖到画布添加')).toBeNull()
  })
})

describe('TaskCenter — 清理任务', () => {
  it('清理下拉 → 清理失败任务 + 清理全部任务', () => {
    h.setTasks([makeTask({ id: 't1', status: 'failed' }), makeTask({ id: 't2', status: 'completed' })])
    render(<TaskCenter />)
    // 打开清理下拉（⋮ 顶部按钮）
    const moreBtns = document.querySelectorAll('button[title="清理任务"]')
    fireEvent.click(moreBtns[0])
    expect(screen.getByText(/清理失败任务/)).toBeTruthy()
    expect(screen.getByText(/清理全部任务/)).toBeTruthy()

    fireEvent.click(screen.getByText(/清理失败任务/))
    expect(h.clearTasksBy).toHaveBeenCalled()
  })
})

describe('TaskCenter — 展开请求/响应数据', () => {
  it('点击「请求/响应数据」→ 展开 JSON 数据', () => {
    h.setTasks([makeTask()])
    render(<TaskCenter />)
    fireEvent.click(screen.getByText('请求/响应数据'))
    expect(screen.getByText(/"id": "t1"/)).toBeTruthy()
    expect(screen.getByText(/"status": "completed"/)).toBeTruthy()
  })
})