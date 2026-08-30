/**
 * useAssetMoveToFolder 测试：把文件「拖到文件夹卡片」归类。
 * 复用真实 canMoveAsset/resolveMovePaths，仅 mock moveFile 与 toast。
 */
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useAssetMoveToFolder, ASSET_MOVE_MIME } from '../../src/components/base/useAssetMoveToFolder.js'

const mocks = vi.hoisted(() => ({
  moveFile: vi.fn(),
  showToast: vi.fn(),
  publish: vi.fn(),
}))

vi.mock('../../src/components/base/localToolApi.ts', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, moveFile: mocks.moveFile }
})
vi.mock('../../src/components/base/toastStore.ts', () => ({ showToast: mocks.showToast }))
vi.mock('../../src/components/base/eventBus.ts', () => ({ publish: mocks.publish }))

function payload(item) {
  return JSON.stringify({ folder: item.folder || '', name: item.name, source: item.source, type: item.type })
}
function makeDropEvent(data) {
  return {
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
    dataTransfer: { getData: () => data },
  }
}
function makeDragStartEvent() {
  const setData = vi.fn()
  const dt = { setData, effectAllowed: '' }
  return { dataTransfer: dt, setData }
}

beforeEach(() => {
  mocks.moveFile.mockReset().mockResolvedValue({ code: 0, data: { ok: true } })
  mocks.showToast.mockReset()
  mocks.publish.mockReset()
})

describe('sourceDragProps（源·文件卡片）', () => {
  it('非文件夹 → 可拖拽，onDragStart 写入移动 payload', () => {
    const { result } = renderHook(() => useAssetMoveToFolder({ connected: true, onRefreshed: vi.fn() }))
    const p = result.current.sourceDragProps({ folder: 'migrated', name: 'a.png', source: 'local-tool', type: 'image', url: 'x' })
    expect(p.draggable).toBe(true)
    const evt = makeDragStartEvent()
    p.onDragStart(evt)
    expect(evt.setData).toHaveBeenCalledTimes(1)
    expect(evt.setData.mock.calls[0][0]).toBe(ASSET_MOVE_MIME)
    expect(JSON.parse(evt.setData.mock.calls[0][1])).toEqual({ folder: 'migrated', name: 'a.png', source: 'local-tool', type: 'image' })
    expect(evt.dataTransfer.effectAllowed).toBe('move')
  })

  it('文件夹 / 无 url → 不启用拖拽', () => {
    const { result } = renderHook(() => useAssetMoveToFolder({ connected: true, onRefreshed: vi.fn() }))
    expect(result.current.sourceDragProps({ type: 'folder', name: 'x' })).toEqual({})
    expect(result.current.sourceDragProps({ type: 'image' })).toEqual({})
  })
})

describe('folderDropProps（目标·文件夹卡片）', () => {
  it('拖文件到子文件夹 → moveFile(相对 src/dst)，toast 成功，回调刷新', async () => {
    const onRefreshed = vi.fn()
    const { result } = renderHook(() => useAssetMoveToFolder({ connected: true, onRefreshed }))
    const it = { folder: 'migrated', name: 'a.png', source: 'local-tool', type: 'image' }
    const folderCard = { folder: 'migrated', name: '人物' } // 完整路径 migrated/人物
    await result.current.folderDropProps(folderCard).onDrop(makeDropEvent(payload(it)))
    expect(mocks.moveFile).toHaveBeenCalledWith('migrated/a.png', 'migrated/人物/a.png')
    expect(mocks.showToast).toHaveBeenCalledWith('已移动到「migrated/人物」', { type: 'success' })
    expect(onRefreshed).toHaveBeenCalledTimes(1)
    // 移动也必须广播 url 变更（与改名同一事件），App 据此同步内存节点，否则同会话内仍指旧路径 → 404
    expect(mocks.publish).toHaveBeenCalledWith('resource:renamed', {
      oldUrl: 'http://127.0.0.1:18080/files/migrated/a.png',
      newUrl: 'http://127.0.0.1:18080/files/migrated/人物/a.png',
    })
  })

  it('目标与源同目录 → 忽略，不调 moveFile，toast 提示', async () => {
    const onRefreshed = vi.fn()
    const { result } = renderHook(() => useAssetMoveToFolder({ connected: true, onRefreshed }))
    const it = { folder: 'migrated', name: 'a.png', source: 'local-tool', type: 'image' }
    const folderCard = { folder: 'migrated', name: 'a' } // 目标 migrated 下的 a 无意义；直接用同目录场景→构造同目录
    // 同目录：目标目录 === 源目录。构造目标目录为 migrated（folder='', name='migrated'）
    const rootFolderCard = { folder: '', name: 'migrated' } // moveTargetDirOf → 'migrated'
    await result.current.folderDropProps(rootFolderCard).onDrop(makeDropEvent(payload(it)))
    expect(mocks.showToast).toHaveBeenCalledWith('文件已在目标目录', { type: 'warning' })
    expect(mocks.moveFile).not.toHaveBeenCalled()
    expect(onRefreshed).not.toHaveBeenCalled()
    void folderCard
  })

  it('非 local-tool 资源 → 不移动，toast 提示', async () => {
    const { result } = renderHook(() => useAssetMoveToFolder({ connected: true, onRefreshed: vi.fn() }))
    const it = { folder: 'migrated', name: 'a.png', source: 'remote', type: 'image' }
    await result.current.folderDropProps({ folder: 'migrated', name: '场景' }).onDrop(makeDropEvent(payload(it)))
    expect(mocks.showToast).toHaveBeenCalledWith('仅支持移动本地资源', { type: 'warning' })
    expect(mocks.moveFile).not.toHaveBeenCalled()
  })

  it('未连接本地引擎 → 不移动', async () => {
    const { result } = renderHook(() => useAssetMoveToFolder({ connected: false, onRefreshed: vi.fn() }))
    await result.current.folderDropProps({ folder: 'migrated', name: '场景' }).onDrop(makeDropEvent(payload({ folder: 'migrated', name: 'a.png', source: 'local-tool', type: 'image' })))
    expect(mocks.moveFile).not.toHaveBeenCalled()
    expect(mocks.showToast).toHaveBeenCalledWith('请先连接本地引擎', { type: 'warning' })
  })
})