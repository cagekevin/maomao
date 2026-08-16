import { describe, it, expect } from 'vitest'
import { getNodeOutput } from '../../src/components/base/useConnectedInputs.js'

// §2.4 管线契约：getNodeOutput 是「连线上游→下游参考」的核心纯函数
describe('管线契约 getNodeOutput', () => {
  it('只接一层：返回四类聚合空对象当无产出', () => {
    const r = getNodeOutput({ id: 'x', type: 'promptNode', data: {} })
    expect(r).toEqual({ images: [], texts: [], videos: [], audios: [] })
  })

  it('textNode → texts（{id,label,text}）', () => {
    const r = getNodeOutput({ id: 't1', type: 'textNode', data: { text: '你好世界', label: '标题' } })
    expect(r.texts).toHaveLength(1)
    expect(r.texts[0]).toMatchObject({ id: 't1', label: '标题', text: '你好世界' })
  })

  it('textNode 空文本不产出', () => {
    const r = getNodeOutput({ id: 't1', type: 'textNode', data: { text: '' } })
    expect(r.texts).toHaveLength(0)
  })

  it('imageBoxNode.images[] → 聚合对象数组', () => {
    const r = getNodeOutput({
      id: 'b1', type: 'imageBoxNode',
      data: { images: [{ id: 'a', url: '/files/a.png', label: '图A' }, { id: 'b', url: '' }] },
    })
    expect(r.images).toHaveLength(1)
    expect(r.images[0]).toMatchObject({ id: 'a', url: '/files/a.png', label: '图A' })
  })

  it('videoExtractNode.extractedImages[] → 帧（image 类）', () => {
    const r = getNodeOutput({ id: 'v1', type: 'videoExtractNode', data: { extractedImages: ['data:image/png;base64,aaa', 'data:image/png;base64,bbb'] } })
    expect(r.images).toHaveLength(2)
    expect(r.images[0].id).toBe('frame-0')
    expect(r.images[1].label).toBe('帧 2')
  })

  it('gridSplitNode / gridMergeNode → 切片/图 聚合', () => {
    const sp = getNodeOutput({ id: 's', type: 'gridSplitNode', data: { extractedImages: ['u1', 'u2'] } })
    expect(sp.images.map((x) => x.id)).toEqual(['split-0', 'split-1'])
    const mg = getNodeOutput({ id: 'm', type: 'gridMergeNode', data: { extractedImages: ['u1'] } })
    expect(mg.images[0].id).toBe('merge-0')
  })

  it('通用兜底 imageUrl → images', () => {
    const r = getNodeOutput({ id: 'p1', type: 'promptNode', data: { imageUrl: 'http://x/y.png' } })
    expect(r.images).toHaveLength(1)
    expect(r.images[0].url).toBe('http://x/y.png')
  })

  it('通用兜底 videoUrl（data:video）→ videos，尊重 mediaType', () => {
    const r = getNodeOutput({ id: 'p1', type: 'discountVideoNode', data: { videoUrl: 'data:video/mp4;base64,xxx' } })
    expect(r.videos).toHaveLength(1)
  })

  it('通用兜底：resultUrl 兜底、mediaType=audio 优先', () => {
    const r = getNodeOutput({ id: 'a1', type: 'imageNode', data: { resultUrl: 'blob:x', mediaType: 'audio' } })
    expect(r.audios).toHaveLength(1)
  })

  it('imageUrl > videoUrl > resultUrl 优先级', () => {
    const r = getNodeOutput({ id: 'p1', type: 'promptNode', data: { imageUrl: 'http://x/i.png', videoUrl: 'http://x/v.mp4' } })
    expect(r.images).toHaveLength(1)
    expect(r.videos).toHaveLength(0)
  })

  it('剧本盒子按 shot-${id} 只取对应镜头资产（collectAssets 匹配）', () => {
    const node = {
      id: 'sb', type: 'scriptBoxNode',
      data: {
        shots: [{ id: 's1', description: '@小红帽 走进森林' }, { id: 's2', description: '@大灰狼 出现' }],
        assets: [
          { id: 'a1', name: '小红帽', imageUrl: '/files/r.png' },
          { id: 'a2', name: '大灰狼', imageUrl: '/files/w.png' },
        ],
      },
    }
    const r1 = getNodeOutput(node, 'shot-s1')
    expect(r1.images).toHaveLength(1)
    expect(r1.images[0].url).toBe('/files/r.png')
    const r2 = getNodeOutput(node, 'shot-s2')
    expect(r2.images[0].url).toBe('/files/w.png')
  })

  it('剧本盒子非 shot- 端口走通用兜底', () => {
    const node = { id: 'sb', type: 'scriptBoxNode', data: { imageUrl: '/files/out.png' } }
    const r = getNodeOutput(node, 'output')
    expect(r.images).toHaveLength(1)
    expect(r.images[0].url).toBe('/files/out.png')
  })

  it('无节点/无 data 返回空', () => {
    expect(getNodeOutput(null)).toEqual({ images: [], texts: [], videos: [], audios: [] })
    expect(getNodeOutput({ id: 'x' })).toEqual({ images: [], texts: [], videos: [], audios: [] })
  })
})
