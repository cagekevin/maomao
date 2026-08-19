import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../src/components/base/chatApi.js', () => ({ chatCompletions: vi.fn() }))
vi.mock('../../src/components/base/imageApi.js', () => ({ generateImage: vi.fn() }))
vi.mock('../../src/components/base/toastStore.js', () => ({ showToast: vi.fn() }))
vi.mock('../../src/components/base/assetStore.js', () => ({
  localizeAndStoreToLibrary: vi.fn(),
  assetFolderOf: vi.fn(() => 'migrated/人物'),
  makeImageThumbnail: vi.fn(),
  sendToAssetLibrary: vi.fn(),
  getAssets: vi.fn(() => []),
  useAssets: vi.fn(() => []),
  FOLDERS: [],
}))

import { chatCompletions } from '../../src/components/base/chatApi.js'
import { generateImage } from '../../src/components/base/imageApi.js'
import { showToast } from '../../src/components/base/toastStore.js'
import { localizeAndStoreToLibrary, makeImageThumbnail } from '../../src/components/base/assetStore.js'
import { createScriptBoxEngine } from '../../src/components/base/scriptBoxEngine.js'

const providerState = {
  providers: [
    { id: 'lovart', isPrimary: true, protocol: 'apimart',
      chat_models: [{ id: 'lovart-chat' }], image_models: [{ id: 'gpt-image-2' }], video_models: [] },
  ],
  primary: { id: 'lovart', isPrimary: true, protocol: 'apimart',
    chat_models: [{ id: 'lovart-chat' }], image_models: [{ id: 'gpt-image-2' }], video_models: [] },
}

describe('剧本盒引擎深度业务 §2.7', () => {
  let data, patches, addNodes
  const ctx = () => ({
    getData: () => data,
    updateData: (p) => { const patch = typeof p === 'function' ? p(data) : p; data = { ...data, ...patch }; patches.push(patch) },
    getProviderState: () => providerState,
    nodeId: 'sb-1',
    setEdges: vi.fn(),
    getNodes: () => [{ id: 'sb-1', position: { x: 0, y: 0 }, width: 900, data }],
    addNodes: (ns) => { (addNodes.push?.(ns) ?? addNodes.push(ns)); data = { ...data } },
  })

  beforeEach(() => {
    patches = []
    addNodes = []
    data = {}
    vi.clearAllMocks()
  })

  // ── onGenerateShotPrompts：@资产匹配 + 约束注入 + 并发写回 ──
  it('onGenerateShotPrompts：每个分镜按 @名 匹配有图资产作为参考，并注入约束', async () => {
    chatCompletions.mockResolvedValue({
      ok: true,
      content: JSON.stringify({ prompt: '分镜画面提示词', videoPrompt: '【时长 5秒】视频内容' }),
    })
    data = {
      shots: [
        { id: 's1', description: '@小红帽 走进 @森林', dialogue: '小红帽：采蘑菇', prompt: '', videoPrompt: '' },
        { id: 's2', description: '@大灰狼 出现', prompt: '', videoPrompt: '' },
      ],
      assets: [
        { id: 'a1', name: '小红帽', imageUrl: '/files/r.png' },
        { id: 'a2', name: '森林', imageUrl: '/files/f.png' },
        { id: 'a3', name: '大灰狼', imageUrl: '/files/w.png' },
      ],
      globalStyle: '皮克斯',
      globalConstraints: ['风格统一'],
      imageGlobalConstraint: '不要文字',
      videoGlobalConstraint: '慢镜头',
    }
    const eng = createScriptBoxEngine(ctx())
    await eng.onGenerateShotPrompts()
    // 两个分镜都生成（并发 Promise.all）
    expect(chatCompletions).toHaveBeenCalledTimes(2)
    // 第一个分镜的 user 中应包含匹配到的参考资产
    const firstCall = chatCompletions.mock.calls[0][0]
    expect(firstCall.messages[1].content).toContain('@小红帽')
    expect(firstCall.messages[1].content).toContain('@森林')
    expect(firstCall.messages[1].content).toContain('不要文字') // imageConstraint 注入
    expect(firstCall.messages[1].content).toContain('慢镜头') // videoConstraint 注入
    // 写回：两个分镜都拿到 prompt/videoPrompt
    const last = patches[patches.length - 1]
    expect(last.shots.find((s) => s.id === 's1').prompt).toBe('分镜画面提示词')
    expect(last.shots.find((s) => s.id === 's1').videoPrompt).toContain('【时长 5秒】')
    expect(last.shots.find((s) => s.id === 's2').prompt).toBe('分镜画面提示词')
  })

  it('onGenerateShotPrompts：开启上一镜尾帧时，@图片1 缺失则后处理强制补写', async () => {
    chatCompletions.mockResolvedValue({ ok: true, content: JSON.stringify({ prompt: '画面', videoPrompt: '视频' }) })
    data = {
      shots: [
        { id: 's1', index: 1, description: '镜头1', usePrevShotVideoTail: false, prompt: '', videoPrompt: '' },
        { id: 's2', index: 2, description: '镜头2', usePrevShotVideoTail: true, prevShotImageRefUrls: ['/files/tail.jpg'], prompt: '', videoPrompt: '' },
      ],
    }
    const eng = createScriptBoxEngine(ctx())
    await eng.onGenerateShotPrompts()
    // 模型输出不含 @图片1 → 强制补写；s1 未开启则保持原样
    const last = patches[patches.length - 1]
    const s2 = last.shots.find((x) => x.id === 's2')
    expect(s2.prompt).toContain('@图片1')
    expect(s2.videoPrompt).toContain('@图片1')
    const s1 = last.shots.find((x) => x.id === 's1')
    expect(s1.prompt).not.toContain('@图片1')
    // 承接/钩子上下文也注入（s2 是结尾镜，只有上一镜承接，无下一镜钩子）
    const s2Call = chatCompletions.mock.calls.find((c) => (c[0].messages[1].content || '').includes('镜头编号：2'))[0]
    expect(s2Call.messages[1].content).toContain('【剧情承接：上一镜状态描述】镜头1')
    expect(s2Call.messages[1].content).toContain('结尾镜')
    expect(s2Call.messages[1].content).toContain('【负面黑名单·绝对禁止出现】')
  })

  it('onGenerateShotPrompts：videoPrompt 已含 @视频1 时不重复补写标签', async () => {
    chatCompletions.mockResolvedValue({ ok: true, content: JSON.stringify({ prompt: '画面', videoPrompt: '@视频1 从尾帧延续' }) })
    data = {
      shots: [
        { id: 's1', index: 1, description: '镜头1', usePrevShotVideoTail: false, prompt: '', videoPrompt: '' },
        { id: 's2', index: 2, description: '镜头2', usePrevShotVideoTail: true, prevShotImageRefUrls: ['/files/tail.jpg'], prompt: '', videoPrompt: '' },
      ],
    }
    const eng = createScriptBoxEngine(ctx())
    await eng.onGenerateShotPrompts()
    const last = patches[patches.length - 1]
    const s2 = last.shots.find((x) => x.id === 's2')
    // videoPrompt 已含 @视频1 → 不再追加，仍是模型原输出
    expect(s2.videoPrompt).toBe('@视频1 从尾帧延续')
    // 但 prompt 缺失 @图片1 → 仍补写（prompt 只认 @图片1）
    expect(s2.prompt).toContain('@图片1')
  })

  it('onGenerateShotPrompts：单个 shotId 只生成该分镜', async () => {
    chatCompletions.mockResolvedValue({ ok: true, content: JSON.stringify({ prompt: 'P', videoPrompt: 'V' }) })
    data = {
      shots: [
        { id: 's1', description: '镜头1', prompt: '', videoPrompt: '' },
        { id: 's2', description: '镜头2', prompt: '', videoPrompt: '' },
      ],
    }
    const eng = createScriptBoxEngine(ctx())
    await eng.onGenerateShotPrompts(['s2'])
    expect(chatCompletions).toHaveBeenCalledTimes(1)
    const last = patches[patches.length - 1]
    expect(last.shots.find((s) => s.id === 's2').prompt).toBe('P')
    expect(last.shots.find((s) => s.id === 's1').prompt).toBe('') // 未动
  })

  it('onGenerateShotPrompts：chat 失败 → 该分镜复位 promptLoading', async () => {
    chatCompletions.mockResolvedValue({ ok: false, error: '超时' })
    data = { shots: [{ id: 's1', description: '镜头1', promptLoading: true, prompt: '', videoPrompt: '' }] }
    const eng = createScriptBoxEngine(ctx())
    await eng.onGenerateShotPrompts(['s1'])
    expect(showToast).toHaveBeenCalledWith('超时', expect.objectContaining({ type: 'error' }))
    const last = patches[patches.length - 1]
    expect(last.shots[0].promptLoading).toBe(false)
  })

  // ── onGenerateAllAssetImages：选中集 / 全量无图 ──
  it('onGenerateAllAssetImages：传 ids → 只生成选中', async () => {
    generateImage.mockResolvedValue({ ok: true, url: '/files/x.png' })
    data = {
      assets: [
        { id: 'a1', name: '小红帽', category: 'character', description: '少女', prompt: '', imageUrl: '' },
        { id: 'a2', name: '大灰狼', category: 'character', description: '狼', prompt: '', imageUrl: '' },
      ],
    }
    const eng = createScriptBoxEngine(ctx())
    await eng.onGenerateAllAssetImages(['a1'])
    expect(generateImage).toHaveBeenCalledTimes(1)
    const last = patches[patches.length - 1]
    expect(last.assets.find((a) => a.id === 'a1').has).toBe(true)
    expect(last.assets.find((a) => a.id === 'a2').has).toBeUndefined() // 未生成
  })

  it('onGenerateAllAssetImages：undefined → 生成全部无图资产', async () => {
    generateImage.mockResolvedValue({ ok: true, url: '/files/x.png' })
    data = {
      assets: [
        { id: 'a1', name: '小红帽', category: 'character', description: '少女', prompt: '', imageUrl: '' },
        { id: 'a2', name: '大灰狼', category: 'character', description: '狼', prompt: '', imageUrl: '/files/old.png' },
      ],
    }
    const eng = createScriptBoxEngine(ctx())
    await eng.onGenerateAllAssetImages()
    expect(generateImage).toHaveBeenCalledTimes(1) // 只有 a1 无图
  })

  it('onGenerateAllAssetImages：无资产 → 提示先生成脚本', async () => {
    data = { assets: [] }
    const eng = createScriptBoxEngine(ctx())
    await eng.onGenerateAllAssetImages()
    expect(showToast).toHaveBeenCalledWith(expect.stringContaining('请先在第1步生成脚本'), expect.anything())
    expect(generateImage).not.toHaveBeenCalled()
  })

  // ── onConnectShot：连线建下游节点 + refImages 匹配 ──
  it('onConnectShot：建 promptNode 下游 + 自动连线，且带入 @资产参考图', () => {
    data = {
      shots: [
        { id: 's1', index: 1, prompt: '猫的图', videoPrompt: '', description: '@小红帽 出现' },
      ],
      assets: [
        { id: 'a1', name: '小红帽', imageUrl: '/files/r.png' },
      ],
    }
    const eng = createScriptBoxEngine(ctx())
    eng.onConnectShot('s1', 'image')
    expect(addNodes).toHaveLength(1)
    const node = addNodes[0][0]
    expect(node.type).toBe('promptNode')
    expect(node.data.label).toBe('镜头1图')
    expect(node.data.prompt).toBe('猫的图')
    // 参考图来自镜头里 @小红帽 匹配到的有图资产
    expect(node.data.images).toEqual([{ id: 'script-asset-a1', url: '/files/r.png' }])
    // 自动连线 sb-1 → 新节点
    expect(ctx().setEdges).toBeDefined()
  })

  it('onConnectShot：target=video → 建 discountVideoNode', () => {
    data = { shots: [{ id: 's1', index: 2, prompt: '', videoPrompt: '猫的视频', description: '' }] }
    const eng = createScriptBoxEngine(ctx())
    eng.onConnectShot('s1', 'video')
    const node = addNodes[0][0]
    expect(node.type).toBe('discountVideoNode')
    expect(node.data.prompt).toBe('猫的视频')
  })

  it('onConnectShot：镜头不存在 → 不建节点', () => {
    data = { shots: [] }
    const eng = createScriptBoxEngine(ctx())
    eng.onConnectShot('nope', 'image')
    expect(addNodes).toHaveLength(0)
  })

  // ── onGenerateShotImage：成功写回 imgGen ──
  it('onGenerateShotImage：成功 → 写回 imgGen{type,label,prompt}', async () => {
    chatCompletions.mockResolvedValue({ ok: true, content: '关键帧画面提示词' })
    data = { shots: [{ id: 's1', description: '镜头1', prompt: '', videoPrompt: '' }], globalStyle: '皮克斯' }
    const eng = createScriptBoxEngine(ctx())
    await eng.onGenerateShotImage('s1', 'keyframe')
    const last = patches[patches.length - 1]
    expect(last.shots[0].imgGen).toMatchObject({ type: 'keyframe', label: '关键帧', prompt: '关键帧画面提示词' })
  })

  it('onGenerateShotImage：无 provider → 报「请先配置文本大模型」', async () => {
    const eng = createScriptBoxEngine({ ...ctx(), getProviderState: () => ({ providers: [], primary: null }) })
    data = { shots: [{ id: 's1', description: '镜头1', prompt: '', videoPrompt: '' }] }
    await eng.onGenerateShotImage('s1', 'keyframe')
    expect(showToast).toHaveBeenCalledWith('请先在「设置」中配置文本大模型', expect.objectContaining({ type: 'error' }))
    expect(chatCompletions).not.toHaveBeenCalled()
  })

  // ── onGenerateScript 成功：分镜归一化细节（id/index/duration 兜底） ──
  it('onGenerateScript：分镜归一化补默认字段（duration/grid/connImg）', async () => {
    chatCompletions.mockResolvedValue({
      ok: true,
      content: JSON.stringify({
        projectName: '小红帽',
        globalStyle: '皮克斯',
        shots: [{ description: '@小红帽 出现' }], // 无 index/duration
        assets: [{ name: '小红帽', category: 'character', description: '少女' }],
      }),
    })
    data = { story: '小红帽的故事' }
    const eng = createScriptBoxEngine(ctx())
    await eng.onGenerateScript()
    const last = patches[patches.length - 1]
    const shot = last.shots[0]
    expect(shot.id).toBe('sb-1-shot-0')
    expect(shot.index).toBe(1)
    expect(shot.duration).toBe('5s')
    expect(shot.grid).toBe(0)
    expect(shot.connImg).toBe(false)
    // 资产 prompt 走 ZgPrompt
    expect(last.assets[0].prompt).toContain('[视觉风格：皮克斯]')
  })

  // ── P1-2 onGenerateTailFrameVariants：抽帧 → 多角度生图 → 写回变体 ──
  it('onGenerateTailFrameVariants：第 1 镜被拒，不抽帧不生图', async () => {
    const cf = vi.fn()
    data = { shots: [{ id: 's1', index: 1 }] }
    const eng = createScriptBoxEngine({ ...ctx(), captureVideoFrame: cf })
    await eng.onGenerateTailFrameVariants('s1')
    expect(showToast).toHaveBeenCalledWith(expect.stringContaining('仅第 2 镜'), expect.anything())
    expect(cf).not.toHaveBeenCalled()
    expect(generateImage).not.toHaveBeenCalled()
  })

  it('onGenerateTailFrameVariants：抽上一镜尾帧 → 官方「原版 + composed 综合图」并自动选中 composed', async () => {
    const cf = vi.fn(async () => 'data:image/jpeg;base64,FRAME')
    generateImage.mockResolvedValue({ ok: true, url: '/files/variant.png' })
    data = {
      shots: [
        { id: 's1', index: 1 },
        { id: 's2', index: 2, tailFrameVariantsLoading: false, prevTailFrameVariants: [] },
      ],
      tailFrameAngleIds: ['forward', 'closeup'],
    }
    const nodes = [
      { id: 'sb-1', type: 'scriptBoxNode', data, position: { x: 0, y: 0 }, width: 900 },
      { type: 'discountVideoNode', data: { upstreamShotId: 's1', videoUrl: '/files/prev.mp4' } },
    ]
    const eng = createScriptBoxEngine({ ...ctx(), getNodes: () => nodes, captureVideoFrame: cf })
    await eng.onGenerateTailFrameVariants('s2')
    // 抽帧来自上一镜视频；官方 B1：只调一次资产生图合成「综合图」
    expect(cf).toHaveBeenCalledWith('/files/prev.mp4', 1)
    expect(generateImage).toHaveBeenCalledTimes(1)
    // 最终写回［原版 + composed］、自动选中 composed、关 loading
    const last = patches[patches.length - 1]
    const shot = last.shots.find((s) => s.id === 's2')
    expect(shot.tailFrameVariantsLoading).toBe(false)
    expect(shot.tailFrameVariantsError).toBeUndefined()
    expect(shot.prevTailFrameVariants.map((v) => v.id)).toEqual(['original', 'composed'])
    expect(shot.prevTailFrameVariants[0]).toMatchObject({ id: 'original', imageUrl: 'data:image/jpeg;base64,FRAME' })
    expect(shot.selectedTailFrameVariantId).toBe('composed')
    expect(shot.prevShotImageRefUrls).toEqual(['/files/variant.png'])
  })

  it('onGenerateTailFrameVariants：未找到上一镜视频 → 提示先生成上一镜视频', async () => {
    const cf = vi.fn()
    data = { shots: [{ id: 's1', index: 1 }, { id: 's2', index: 2 }] }
    const eng = createScriptBoxEngine({ ...ctx(), getNodes: () => [{ id: 'sb-1', type: 'scriptBoxNode', data, position: { x: 0, y: 0 }, width: 900 }], captureVideoFrame: cf })
    await eng.onGenerateTailFrameVariants('s2')
    expect(showToast).toHaveBeenCalledWith(expect.stringContaining('上一镜的视频结果'), expect.anything())
    expect(cf).not.toHaveBeenCalled()
  })

  // ── P0-2 真上传 + P2-1 本地化落盘：videoStatus 状态机 / imageUrl 改写 / thumbnailUrl 生成 ──
  it('onRetryVideoAssetUpload：成功 → uploading→uploaded，imageUrl 本地化', async () => {
    localizeAndStoreToLibrary.mockResolvedValueOnce('/files/migrated/人物/主角.png')
    data = { assets: [{ id: 'a1', category: 'character', name: '主角', imageUrl: '/files/orig.png', videoStatus: '' }], shots: [] }
    const eng = createScriptBoxEngine(ctx())
    await eng.onRetryVideoAssetUpload('a1')
    // 中间有一次 uploading 标记
    expect(patches.some((p) => p.assets?.[0]?.videoStatus === 'uploading')).toBe(true)
    const final = patches[patches.length - 1].assets.find((a) => a.id === 'a1')
    expect(final.videoStatus).toBe('uploaded')
    expect(final.videoError).toBeUndefined()
    expect(final.imageUrl).toBe('/files/migrated/人物/主角.png')
  })

  it('onRetryVideoAssetUpload：失败 → failed + videoError', async () => {
    localizeAndStoreToLibrary.mockRejectedValueOnce(new Error('落盘失败'))
    data = { assets: [{ id: 'a1', category: 'character', name: '主角', imageUrl: 'data:image/png;base64,x' }], shots: [] }
    const eng = createScriptBoxEngine(ctx())
    await eng.onRetryVideoAssetUpload('a1')
    const final = patches[patches.length - 1].assets.find((a) => a.id === 'a1')
    expect(final.videoStatus).toBe('failed')
    expect(final.videoError).toBe('落盘失败')
  })

  it('onGenerateAssetImage：生图成功后本地化落盘 + 缩略图生成，imageUrl/thumbnailUrl 均改本地 /files 路径', async () => {
    generateImage.mockResolvedValueOnce({ ok: true, url: 'https://upstream/x.png' })
    makeImageThumbnail.mockResolvedValueOnce('data:image/jpeg;base64,THUMB')
    localizeAndStoreToLibrary
      .mockResolvedValueOnce('/files/migrated/人物/角色1.png')   // 主图本地化
      .mockResolvedValueOnce('/files/migrated/人物/角色1_thumb.png') // 缩略图本地化
    data = { assets: [{ id: 'a1', category: 'character', name: '角色1', imageUrl: '', thumbailUrl: '' }], shots: [] }
    const eng = createScriptBoxEngine(ctx())
    await eng.onGenerateAssetImage('a1')
    const final = patches[patches.length - 1].assets.find((a) => a.id === 'a1')
    expect(final.has).toBe(true)
    expect(final.loading).toBe(false)
    expect(final.imageUrl).toBe('/files/migrated/人物/角色1.png')
    expect(final.thumbnailUrl).toBe('/files/migrated/人物/角色1_thumb.png')
  })
})
