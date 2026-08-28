/**
 * AssetCardMenu 组件测试（关键交互 + 防崩）。
 * 复用真实 canMoveAsset/resolveMovePaths（保持「实现一变必红」），仅 mock 网络与反馈。
 */
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import AssetCardMenu from '../../src/components/base/AssetCardMenu.jsx'

const mocks = vi.hoisted(() => ({
  moveFile: vi.fn(),
  fetchResources: vi.fn(),
  rescanResources: vi.fn(),
  createFolder: vi.fn(),
  showToast: vi.fn(),
}))

vi.mock('../../src/components/base/localToolApi.js', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    moveFile: mocks.moveFile,
    fetchResources: mocks.fetchResources,
    rescanResources: mocks.rescanResources,
    createFolder: mocks.createFolder,
  }
})
vi.mock('../../src/components/base/toastStore.js', () => ({ showToast: mocks.showToast }))
vi.mock('../../src/components/base/logger.js', () => ({ logger: { warn: () => {} } }))

const localFile = {
  id: 'local-migrated-a.png', source: 'local-tool', type: 'image',
  name: 'a.png', folder: 'migrated', url: 'http://127.0.0.1:18080/files/migrated/a.png',
}

beforeEach(() => {
  mocks.moveFile.mockReset()
  mocks.fetchResources.mockReset()
  mocks.rescanResources.mockReset()
  mocks.createFolder.mockReset()
  mocks.showToast.mockReset()
  // 默认：当前层有一个子文件夹「主题A」，moveFile 成功
  mocks.fetchResources.mockResolvedValue({ data: { items: [{ id: 'f1', name: '主题A', type: 'folder', source: 'local-tool', folder: 'migrated' }] } })
  mocks.moveFile.mockResolvedValue({ code: 0, data: { ok: true } })
})

// 打开 ⋯ 下拉并进入「移动到文件夹」选择器（等待 fetchResources 返回文件夹项）
async function openMovePicker(item, props = {}) {
  render(<AssetCardMenu item={item} connected {...props} />)
  fireEvent.click(screen.getByTitle('更多操作'))
  fireEvent.click(await screen.findByText('移动到文件夹'))
  await screen.findByText('主题A')
}

describe('AssetCardMenu · 菜单项可见性', () => {
  it('本地文件 → ⋯ 下拉含「移动到文件夹」', async () => {
    render(<AssetCardMenu item={localFile} connected />)
    fireEvent.click(screen.getByTitle('更多操作'))
    expect(await screen.findByText('移动到文件夹')).toBeTruthy()
    expect(screen.getByText('删除')).toBeTruthy()
  })

  it('文件夹 / 远程资源 → 不提供「移动到文件夹」入口', async () => {
    const { rerender } = render(<AssetCardMenu item={{ ...localFile, type: 'folder' }} connected />)
    fireEvent.click(screen.getByTitle('更多操作'))
    await screen.findByText('删除')
    expect(screen.queryByText('移动到文件夹')).toBeNull()
    fireEvent.click(document.body.firstChild) // 关闭
  })
})

describe('AssetCardMenu · 移动流程', () => {
  it('进入子文件夹 → 移动到此处 → moveFile(src,dst) 成功，回调刷新 + toast', async () => {
    const onRefreshed = vi.fn()
    await openMovePicker(localFile, { onRefreshed })
    // 进入「主题A」子目录
    fireEvent.click(await screen.findByText('主题A'))
    fireEvent.click(screen.getByText('移动到此处'))
    await waitFor(() => expect(mocks.moveFile).toHaveBeenCalledWith('migrated/a.png', 'migrated/主题A/a.png'))
    expect(mocks.showToast).toHaveBeenCalledWith('已移动到「migrated/主题A」', { type: 'success' })
    expect(onRefreshed).toHaveBeenCalledTimes(1)
  })

  it('目标与源同目录 → 忽略不调 moveFile，toast 提示', async () => {
    const onRefreshed = vi.fn()
    await openMovePicker(localFile, { onRefreshed })
    // 不进入任何子文件夹，浏览目录仍为源目录 migrated
    fireEvent.click(screen.getByText('移动到此处'))
    await waitFor(() => expect(mocks.showToast).toHaveBeenCalled())
    expect(mocks.showToast).toHaveBeenCalledWith('文件已在目标目录', { type: 'warning' })
    expect(mocks.moveFile).not.toHaveBeenCalled()
    expect(onRefreshed).not.toHaveBeenCalled()
  })

  it('移动失败 → toast 报错，不回调刷新', async () => {
    mocks.moveFile.mockRejectedValue(Object.assign(new Error('目标文件已存在'), { name: 'HttpError', status: 409 }))
    const onRefreshed = vi.fn()
    await openMovePicker(localFile, { onRefreshed })
    fireEvent.click(screen.getByText('主题A'))
    fireEvent.click(screen.getByText('移动到此处'))
    await waitFor(() => expect(mocks.showToast).toHaveBeenCalledWith('目标文件已存在', { type: 'error' }))
    expect(onRefreshed).not.toHaveBeenCalled()
  })
})

describe('AssetCardMenu · 基础操作回调', () => {
  it('复制/打开目录/删除回调透传 item', async () => {
    const onCopy = vi.fn(); const onOpenDir = vi.fn(); const onDelete = vi.fn(); const onRename = vi.fn()
    render(<AssetCardMenu item={localFile} connected onCopy={onCopy} onOpenDir={onOpenDir} onDelete={onDelete} onRename={onRename} />)
    fireEvent.click(screen.getByTitle('更多操作'))
    await screen.findByText('复制链接')
    // 模拟真实事件时序：pointerdown(先触发外部关闭) → click。曾因外部关闭未排除菜单本体，
    // 菜单项 pointerdown 即被卸载、click 不执行 → 回归点。
    const copyItem = screen.getByText('复制链接')
    fireEvent.pointerDown(copyItem)
    fireEvent.click(copyItem)
    expect(onCopy).toHaveBeenCalledWith(localFile)
    fireEvent.click(screen.getByTitle('更多操作'))
    fireEvent.pointerDown(screen.getByText('打开所在目录'))
    fireEvent.click(screen.getByText('打开所在目录'))
    expect(onOpenDir).toHaveBeenCalledWith(localFile)
    fireEvent.click(screen.getByTitle('更多操作'))
    fireEvent.pointerDown(screen.getByText('删除'))
    fireEvent.click(screen.getByText('删除'))
    expect(onDelete).toHaveBeenCalledWith(localFile)
  })
})