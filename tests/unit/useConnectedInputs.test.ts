// @ts-nocheck
import { describe, it, expect } from 'vitest'
import { getNodeOutput, NODE_OUTPUTS } from '../../src/hooks/useConnectedInputs.ts'
import { SHOT_HANDLE_PREFIX, shotHandleId, parseShotHandle } from '../../src/components/base/contracts.ts'

// 分镜端口契约（contracts.SHOT_HANDLE_PREFIX）：写侧 shotHandleId / 读侧 parseShotHandle 必须成对往返
describe('分镜端口 handle 契约', () => {
  it('前缀值与 handle 形态', () => {
    expect(SHOT_HANDLE_PREFIX).toBe('shot-')
    expect(shotHandleId('s1')).toBe('shot-s1')
  })

  it('编解码往返（写侧→读侧）', () => {
    expect(parseShotHandle(shotHandleId('abc-123'))).toBe('abc-123')
  })

  it('分镜 id 自身含前缀不误伤（旧 replace 实现在此会红）', () => {
    expect(shotHandleId('shot-9')).toBe('shot-shot-9')
    expect(parseShotHandle(shotHandleId('shot-9'))).toBe('shot-9')
  })

  it('非分镜端口 / 空值一律 null', () => {
    expect(parseShotHandle('output')).toBeNull()
    expect(parseShotHandle('shot-')).toBeNull()
    expect(parseShotHandle('')).toBeNull()
    expect(parseShotHandle(undefined)).toBeNull()
    expect(parseShotHandle(null)).toBeNull()
  })
})

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

  it('通用兜底图片产出带 label（改名流向下游候选）', () => {
    const r = getNodeOutput({ id: 'p1', type: 'promptNode', data: { imageUrl: 'http://x/y.png', label: '猫' } })
    expect(r.images[0].label).toBe('猫')
  })

  it('通用兜底图片无 label → 不注入（下游兜底 图片N）', () => {
    const r = getNodeOutput({ id: 'p1', type: 'promptNode', data: { imageUrl: 'http://x/y.png' } })
    expect(r.images[0].label).toBeUndefined()
  })

  it('通用兜底 videoUrl（data:video）→ videos，尊重 mediaType，且带 label（预留）', () => {
    const r = getNodeOutput({ id: 'p1', type: 'discountVideoNode', data: { videoUrl: 'data:video/mp4;base64,xxx', label: '参考' } })
    expect(r.videos).toHaveLength(1)
    expect(r.videos[0].label).toBe('参考')
  })

  it('通用兜底：resultUrl 兜底、mediaType=audio 优先，且带 label（预留）', () => {
    const r = getNodeOutput({ id: 'a1', type: 'imageNode', data: { resultUrl: 'blob:x', mediaType: 'audio', label: 'BGM' } })
    expect(r.audios).toHaveLength(1)
    expect(r.audios[0].label).toBe('BGM')
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
    expect(r1.images[0].label).toBe('小红帽') // 资产名带出，供下游 @名 匹配
    const r2 = getNodeOutput(node, 'shot-s2')
    expect(r2.images[0].url).toBe('/files/w.png')
    expect(r2.images[0].label).toBe('大灰狼')
  })

  it('剧本盒子非 shot- 端口走通用兜底', () => {
    const node = { id: 'sb', type: 'scriptBoxNode', data: { imageUrl: '/files/out.png' } }
    const r = getNodeOutput(node, 'output')
    expect(r.images).toHaveLength(1)
    expect(r.images[0].url).toBe('/files/out.png')
  })

  it('剧本盒声明在非分镜端口时「弃权」（返回 undefined），不屏蔽通用兜底', () => {
    // 断言实现一变必红：若有人把 getNodeOutput 里的 `if (out)` 改回 `|| {}`，
    // 声明返回 undefined 会被当空产出 → 通用兜底被屏蔽 → 上一条断言立刻变红。
    const d = { imageUrl: '/files/out.png' }
    expect(NODE_OUTPUTS.scriptBoxNode(d, 'output')).toBeUndefined()
    expect(NODE_OUTPUTS.scriptBoxNode(d, undefined)).toBeUndefined()
    // 分镜端口命中时正常返回产出对象
    expect(NODE_OUTPUTS.scriptBoxNode({ shots: [{ id: 's1' }] }, shotHandleId('s1'))).toBeDefined()
  })

  it('无节点/无 data 返回空', () => {
    expect(getNodeOutput(null)).toEqual({ images: [], texts: [], videos: [], audios: [] })
    expect(getNodeOutput({ id: 'x' })).toEqual({ images: [], texts: [], videos: [], audios: [] })
  })

  it('剧本盒产出已登记进 NODE_OUTPUTS 声明表（防回退成 getNodeOutput 内特判）', () => {
    // 断言实现一变必红：若有人把 scriptBoxNode 挪回 getNodeOutput 的 if 特判，
    // 本表查不到该键 → 走 genericOutput 兜底 → 分镜资产静默丢失且 dev 校验器失声。
    expect(Object.keys(NODE_OUTPUTS)).toContain('scriptBoxNode')
    // textNode 刻意保留特判（读 node.id 非 data 派生），不应出现在声明表里
    expect(Object.keys(NODE_OUTPUTS)).not.toContain('textNode')
  })
})
