import { describe, it, expect, beforeEach } from 'vitest'
import {
  FOLDERS, detectAssetType, filterByFolder, addAssets, removeAsset, clearAssets, loadAssets, getAssets,
} from '../../src/components/base/assetStore.js'

beforeEach(() => {
  clearAssets()
  localStorage.clear()
  loadAssets() // 重新 seed 默认素材
})

describe('素材库数据层 §2.18', () => {
  it('FOLDERS 配置含 6 个目录（all/generated/character/scene/prop/materials）', () => {
    expect(FOLDERS).toHaveLength(6)
    expect(FOLDERS.map((f) => f.key)).toEqual(['all', 'generated', 'character', 'scene', 'prop', 'materials'])
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

  it('addAssets 新增并置默认 folder=materials', () => {
    const added = addAssets([{ url: '/files/x.png', name: '新图', type: 'image' }])
    expect(added).toHaveLength(1)
    expect(added[0].folder).toBe('materials')
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
