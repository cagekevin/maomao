// @vitest-environment jsdom
// @ts-nocheck
/**
 * useAssetCardDragProps 单测（素材卡片拖拽 · 回归护栏）。
 *
 * 锁定 2026-08-28 的 bug：素材从素材库拖到画布后，uploads/web 里凭空多出一份重复文件。
 *
 * 根因：d7ac136 把卡片的 assetDragProps（写 application/x-yimao-asset）换成了只写
 * application/x-yimao-move 的 sourceDragProps。画布侧 useAssetDropPaste.onDrop 读不到
 * x-yimao-asset、也没有 files，就退回「拖入 URL」分支，把素材的本机 URL 当成网页图
 * 走「本地化」，后端于是把 127.0.0.1 的文件重新下载一份存进 uploads/web。
 *
 * 因此卡片【必须】在一次 dragstart 里同时写两套 MIME：
 *   - application/x-yimao-move  → 拖到文件夹卡片上做移动归类
 *   - application/x-yimao-asset → 拖到画布上建节点（少了它就会掉进 web 目录）
 *
 * 这两条断言被打破 = 该 bug 回归。
 */
import { describe, it, expect } from 'vitest'
import { renderHook } from '@testing-library/react'

const { useAssetCardDragProps } = await import('../../src/hooks/useAssetDragToCanvas.ts')

const ASSET = {
  id: 'local-migrated/道具-a.png',
  url: 'http://127.0.0.1:18080/files/migrated/道具/a.png',
  name: 'a.png',
  type: 'image',
  source: 'local-tool',
}

/** 模拟 DataTransfer：只记录 setData 的键值对与 effectAllowed */
function fakeDataTransfer() {
  const data = {}
  return {
    data,
    effectAllowed: '',
    setData: (type, val) => { data[type] = String(val) },
    getData: (type) => data[type] || '',
  }
}

function renderCardProps() {
  const { result } = renderHook(() => useAssetCardDragProps({ connected: true, onRefreshed: () => {} }))
  return result.current
}

describe('useAssetCardDragProps — 文件卡片', () => {
  it('可拖拽，且一次 dragstart 同时写「移动归类」与「拖到画布」两套 MIME', () => {
    const { cardDragProps } = renderCardProps()
    const props = cardDragProps(ASSET)
    expect(props.draggable).toBe(true)

    const dt = fakeDataTransfer()
    props.onDragStart({ dataTransfer: dt })

    // 缺了 asset 这条 → 画布认不出素材 → 误判成网页图 → 重复下载进 uploads/web
    expect(dt.data['application/x-yimao-asset']).toBeTruthy()
    expect(dt.data['application/x-yimao-move']).toBeTruthy()
  })

  it('拖到画布的 payload 带 url/name/type（画布据此建节点）', () => {
    const { cardDragProps } = renderCardProps()
    const dt = fakeDataTransfer()
    cardDragProps(ASSET).onDragStart({ dataTransfer: dt })

    const payload = JSON.parse(dt.data['application/x-yimao-asset'])
    expect(payload.url).toBe(ASSET.url)
    expect(payload.name).toBe('a.png')
    expect(payload.type).toBe('image')
  })

  it('无 url 的条目不可拖拽（返回空属性，不挂 draggable）', () => {
    const { cardDragProps } = renderCardProps()
    expect(cardDragProps({ id: 'x', name: 'x.png', type: 'image' })).toEqual({})
  })
})

describe('useAssetCardDragProps — 文件夹卡片', () => {
  it('作为移动落点：不给 draggable，只给 drop/dragOver 承接', () => {
    const { cardDragProps } = renderCardProps()
    const props = cardDragProps({ id: 'f', name: '道具', type: 'folder', folder: 'migrated' })
    expect(props.draggable).toBeUndefined()
    expect(typeof props.onDrop).toBe('function')
    expect(typeof props.onDragOver).toBe('function')
  })
})
