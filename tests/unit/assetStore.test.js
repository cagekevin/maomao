// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  FOLDERS, detectAssetType, filterByFolder, addAssets, removeAsset, clearAssets, loadAssets, getAssets, flushPersist, safeAssetBase,
} from '../../src/components/base/assetStore.js'

const STORAGE_KEY = 'yimao:yimao_asset_library' // storageAdapter 对键加 yimao: 前缀

beforeEach(() => {
  clearAssets()
  localStorage.clear()
  loadAssets() // 重新 seed 默认素材
})

describe('素材库数据层 §2.18', () => {
  it('FOLDERS 配置含 6 个目录（all/generated/character/scene/prop/migrated）', () => {
    expect(FOLDERS).toHaveLength(6)
    expect(FOLDERS.map((f) => f.key)).toEqual(['all', 'generated', 'character', 'scene', 'prop', 'migrated'])
  })

  it('detectAssetType 按 mime/扩展名分类', () => {
    expect(detectAssetType({ type: 'image/png', name: 'a.png' })).toBe('image')
    expect(detectAssetType({ type: 'video/mp4', name: 'a.mp4' })).toBe('video')
    expect(detectAssetType({ type: 'audio/mpeg', name: 'a.mp3' })).toBe('audio')
    expect(detectAssetType({ type: 'text/plain', name: 'a.txt' })).toBe('text')
    expect(detectAssetType({ name: 'a.webp' })).toBe('image')
    expect(detectAssetType({ name: 'a.unknown' })).toBe('image') // 兜底 image
  })

  it('filterByFolder：全部返回全部；单目录按 folder 前缀匹配', () => {
    const list = getAssets() // 默认 seed
    expect(filterByFolder(list, null).length).toBe(list.length)
    const char = filterByFolder(list, 'migrated/人物')
    expect(char.every((a) => a.folder === 'migrated/人物')).toBe(true)
    const gen = filterByFolder(list, 'tasks')
    expect(gen.every((a) => a.folder === 'tasks')).toBe(true)
  })

  it('addAssets 新增并置默认 folder=migrated', () => {
    const added = addAssets([{ url: '/files/x.png', name: '新图', type: 'image' }])
    expect(added).toHaveLength(1)
    expect(added[0].folder).toBe('migrated')
    expect(added[0].id).toBeTruthy()
    expect(getAssets().find((a) => a.id === added[0].id)).toBeTruthy()
  })

  it('addAssets 指定 folder 落对应目录', () => {
    const added = addAssets([{ url: '/files/y.png', type: 'image' }], 'migrated/场景')
    expect(added[0].folder).toBe('migrated/场景')
  })

  it('removeAsset 删除指定 id', () => {
    const added = addAssets([{ url: '/files/z.png', type: 'image' }])
    removeAsset(added[0].id)
    expect(getAssets().find((a) => a.id === added[0].id)).toBeFalsy()
  })

  it('clearAssets 清空', () => {
    clearAssets()
    expect(getAssets()).toHaveLength(0)
  })
})

describe('assetStore P4 落盘节流', () => {
  beforeEach(() => {
    // 排空文件级 beforeEach 用真实定时器排的待落盘（避免脏 timer 污染假定时器窗口，导致后续 schedule 不排程）
    flushPersist()
    vi.useFakeTimers()
    localStorage.removeItem(STORAGE_KEY)
  })
  afterEach(() => { vi.useRealTimers() })

  it('高频变更（addAssets/removeAsset）在防抖窗口内不触发落盘，窗口结束只落盘 1 次', () => {
    clearAssets()
    addAssets([{ url: '/a.png', type: 'image' }])
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
    addAssets([{ url: '/b.png', type: 'image' }])
    removeAsset(getAssets()[0].id)
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
    vi.advanceTimersByTime(300)
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY))
    expect(Array.isArray(saved)).toBe(true)
    // 窗口内 3 次变更合并为最终态：加了 2 个、删了 1 个 → 只剩 1 个
    expect(saved).toHaveLength(1)
  })

  it('flushPersist 强制立即落盘（供页面卸载兜底）', () => {
    clearAssets()
    addAssets([{ url: '/c.png', type: 'image' }])
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
    flushPersist()
    expect(localStorage.getItem(STORAGE_KEY)).not.toBeNull()
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY))
    expect(saved).toHaveLength(1)
  })

  it('flushPersist 后防抖窗口内不重复落盘', () => {
    const setSpy = vi.spyOn(Storage.prototype, 'setItem')
    clearAssets()
    addAssets([{ url: '/d.png', type: 'image' }])
    flushPersist()
    const writesBefore = setSpy.mock.calls.filter(([k]) => k === STORAGE_KEY).length
    vi.advanceTimersByTime(300) // 原定时器已清，不应再写
    const writesAfter = setSpy.mock.calls.filter(([k]) => k === STORAGE_KEY).length
    expect(writesAfter).toBe(writesBefore)
  })
})

describe('safeAssetBase（发送到素材库落盘文件名安全化）', () => {
  it('中文名保留（无非法字符）', () => {
    expect(safeAssetBase('猫')).toBe('猫')
  })
  it('去非法字符 /\\:*?"<>| → 下划线', () => {
    expect(safeAssetBase('a/b\\c')).toBe('a_b_c')
  })
  it('空白 → 下划线', () => {
    expect(safeAssetBase('猫 狗')).toBe('猫_狗')
  })
  it('去掉尾部扩展名，避免「猫.png.png」', () => {
    expect(safeAssetBase('猫.png')).toBe('猫')
    expect(safeAssetBase('photo.123')).toBe('photo')
  })
  it('空/纯空白 → 回退 asset', () => {
    expect(safeAssetBase('')).toBe('asset')
    expect(safeAssetBase('   ')).toBe('asset')
    expect(safeAssetBase()).toBe('asset')
  })
})
