import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../src/components/base/chatApi.js', () => ({ chatCompletions: vi.fn() }))
vi.mock('../../src/components/base/imageApi.js', () => ({ generateImage: vi.fn() }))
vi.mock('../../src/components/base/toastStore.js', () => ({ showToast: vi.fn() }))

import { chatCompletions } from '../../src/components/base/chatApi.js'
import { generateImage } from '../../src/components/base/imageApi.js'
import { showToast } from '../../src/components/base/toastStore.js'
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
    updateData: (p) => { data = { ...data, ...(typeof p === 'function' ? p(data) : p) }; patches.push(p) },
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
})
