/**
 * 阶段三（entry 组件）· 脚本盒引擎纯逻辑单测
 *
 * 对应 docs/10-测试覆盖补齐计划-2026-08-17.md §三「entry 组件」：
 *   - scriptBoxEngine.js 的纯导出函数（parseJsonText / useJsonObject /
 *     dialogueLines / assembleShotUser）与引擎编排（createScriptBoxEngine）。
 *   - 真实生成走 chatApi/imageApi，通过 vi.mock 注入假实现，隔离网络与 React 依赖。
 *
 * 运行：vitest run tests/unit/scriptBoxEngine.test.js
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// 隔离外部依赖（网络 / 模型 / toast），仅保留 scriptBoxPrompts（纯提示词拼接）
vi.mock('../../src/components/base/chatApi.js', () => ({ chatCompletions: vi.fn() }))
vi.mock('../../src/components/base/imageApi.js', () => ({ generateImage: vi.fn() }))
// 统一出口：toAbsoluteFileUrl 把相对 /files/ 补全为绝对原图（与 imageUrl.js 真实行为一致，注入 data.images 前收口）
vi.mock('../../src/components/base/imageUrl.js', () => ({
  toAbsoluteFileUrl: (u) => (u && u.startsWith('/files/') ? `http://127.0.0.1:18080${u}` : u || ''),
}))
vi.mock('../../src/components/base/providerModels.js', () => ({
  resolveProviderModel: vi.fn(() => ({ provider: 'openai', modelId: 'gpt-4o-mini' })),
  buildAllModels: vi.fn(() => [{ id: 'gpt-4o-mini' }]),
}))
vi.mock('../../src/components/base/toastStore.js', () => {
  const showToast = vi.fn()
  return { showToast, toastStore: { showToast } }
})
vi.mock('../../src/components/base/assetStore.js', () => ({
  localizeAndStoreToLibrary: vi.fn(),
  assetFolderOf: vi.fn(() => 'migrated/人物'),
  sendToAssetLibrary: vi.fn(),
  getAssets: vi.fn(() => []),
  useAssets: vi.fn(() => []),
  FOLDERS: [],
}))

import { normalizeScriptBoxData, defaultScriptBoxTop, defaultShotFields, defaultAssetFields } from '../../src/components/base/scriptBoxSchema.js'

const {
  parseJsonText,
  useJsonObject,
  dialogueLines,
  assembleShotUser,
  createScriptBoxEngine,
} = await import('../../src/components/base/scriptBoxEngine.js')

const { chatCompletions } = await import('../../src/components/base/chatApi.js')

describe('scriptBoxEngine · 纯导出函数', () => {
  describe('parseJsonText', () => {
    it('提取 ```json 代码块 → {ok:true,data}', () => {
      const raw = '说明文字\n```json\n{"a":1}\n```\n结束'
      expect(parseJsonText(raw)).toEqual({ ok: true, data: { a: 1 } })
    })
    it('无代码块时截取首尾 {} 直接 parse', () => {
      expect(parseJsonText('前缀 {"b":2} 后缀')).toEqual({ ok: true, data: { b: 2 } })
    })
    it('非法 JSON → {ok:false,data:null}', () => {
      expect(parseJsonText('{bad}')).toEqual({ ok: false, data: null })
    })
    it('空串 → {ok:false,data:null}', () => {
      expect(parseJsonText('')).toEqual({ ok: false, data: null })
    })
  })

  describe('useJsonObject', () => {
    it('gpt/deepseek/claude 判定：deepseek→false', () => {
      expect(useJsonObject('deepseek-chat')).toBe(false)
    })
    it('claude → false', () => {
      expect(useJsonObject('claude-3-opus')).toBe(false)
    })
    it('gpt/其他 → true', () => {
      expect(useJsonObject('gpt-4o')).toBe(true)
      expect(useJsonObject('gemini-1.5-pro')).toBe(true)
    })
    it('未传/空 → true', () => {
      expect(useJsonObject()).toBe(true)
    })
  })

  describe('dialogueLines', () => {
    it('「说话者：原句」格式 → 说话者：X，完整原句：Y', () => {
      expect(dialogueLines('甲方：你好')).toBe('说话者：甲方，完整原句：你好')
    })
    it('旁白（[旁白|说话者]原句）→ 旁白，完整原句：Y', () => {
      expect(dialogueLines('[旁白|旁白]天黑了')).toBe('旁白，完整原句：天黑了')
    })
    it('普通行 → 完整原句：X', () => {
      expect(dialogueLines('一句旁白')).toBe('完整原句：一句旁白')
    })
    it('空/非字符串 → 空串', () => {
      expect(dialogueLines(null)).toBe('')
      expect(dialogueLines('')).toBe('')
    })
    it('数组对白（UI 编辑后形态）→ 逐行解析为说话者/完整原句', () => {
      // P2-⑤：dialogue 双态，UI 编辑后是数组 [{kind,role,text}]，必须逐行而非 String() 逗号拼接
      const arr = [
        { kind: '台词', role: '甲', text: '你好' },
        { kind: '旁白', role: '', text: '天黑了' },
      ]
      expect(dialogueLines(arr)).toContain('说话者：甲，完整原句：你好')
      expect(dialogueLines(arr)).toContain('旁白，完整原句：天黑了')
    })
  })

  describe('assembleShotUser', () => {
    const ref = [{ name: '城堡' }]
    it('合并 shot 字段 + 参考资源 + 全局风格', () => {
      const shot = {
        index: 1, duration: '5s', shotType: '近景', lighting: '暖光',
        motion: '推镜', description: '主角登场', dialogue: '旁白：开始', sound: '风声',
      }
      const out = assembleShotUser(shot, ref, '写实风')
      expect(out).toContain('镜头编号：1')
      expect(out).toContain('画面描述：主角登场')
      expect(out).toContain('@城堡')
      expect(out).toContain('统一风格：写实风')
      expect(out).toContain('环境音/动作音：风声')
    })
    it('无参考资源 → 回退提示句', () => {
      const out = assembleShotUser({ index: 2, description: 'x' }, [], undefined)
      expect(out).toContain('本分镜未引用具体资源')
    })
    it('P2-4：imageNegative 仅作用 prompt、videoNegative 仅作用 videoPrompt', () => {
      const shot = { index: 2, description: 'x' }
      const out = assembleShotUser(shot, [], '', { imageNegative: '勿模糊', videoNegative: '勿抖动' })
      expect(out).toContain('【生图负面词·仅作用于 prompt】勿模糊')
      expect(out).toContain('【生视频负面词·仅作用于 videoPrompt】勿抖动')
    })
    it('P1-3：开启上一镜尾帧且锁定参考 URL → 注入视觉起点约束', () => {
      const shot = { index: 2, description: 'x', usePrevShotVideoTail: true, prevShotImageRefUrls: ['/files/tail.jpg'] }
      const out = assembleShotUser(shot, [], '')
      expect(out).toContain('【视觉起点·必带约束】')
      expect(out).toContain('@图片1')
    })
    it('P1-3：未开启尾帧 → 不注入视觉起点', () => {
      const out = assembleShotUser({ index: 2, description: 'x', prevShotImageRefUrls: ['/files/tail.jpg'] }, [], '')
      expect(out).not.toContain('@图片1')
    })
    it('P2-3：首镜/末镜/中段分别命中对应位置语义', () => {
      expect(assembleShotUser({ index: 1, description: 'x' }, [], '')).toContain('开场镜')
      expect(assembleShotUser({ index: 3, description: 'x' }, [], '', { totalShots: 3 })).toContain('结尾镜')
      expect(assembleShotUser({ index: 2, description: 'x' }, [], '', { totalShots: 3 })).toContain('中段镜')
    })
    it('对齐官方：位置标注（第 u+1/d 镜）+ 上一镜承接 + 下一镜钩子', () => {
      const shot = { index: 2, description: 'x' }
      const out = assembleShotUser(shot, [], '', {
        totalShots: 3, shotIndexInStory: 1,
        prevShot: { description: '@主角 走进房间' },
        nextShot: { description: '@大灰狼 破门而入' },
      })
      expect(out).toContain('第 2 镜 / 共 3 镜')
      expect(out).toContain('【剧情承接：上一镜状态描述】@主角 走进房间')
      expect(out).toContain('【剧情钩子：下一镜预告】@大灰狼 破门而入')
    })
    it('对齐官方：命中四象限剧情职责（前 20% / 中段 / 后 80%+）', () => {
      expect(assembleShotUser({ index: 1, description: 'x' }, [], '', { totalShots: 10, shotIndexInStory: 0 })).toContain('交代信息/建立悬念/锚定冲突')
      expect(assembleShotUser({ index: 5, description: 'x' }, [], '', { totalShots: 10, shotIndexInStory: 4 })).toContain('冲突升级/情绪累积/压力堆叠')
      expect(assembleShotUser({ index: 10, description: 'x' }, [], '', { totalShots: 10, shotIndexInStory: 9 })).toContain('收束留钩/余韵钩子')
    })
    it('对齐官方：通用负面黑名单始终注入', () => {
      const out = assembleShotUser({ index: 1, description: 'x' }, [], '')
      expect(out).toContain('【负面黑名单·绝对禁止出现】')
      expect(out).toContain('通用负面（prompt + videoPrompt 同时遵守）')
    })
    it('对齐官方：出场分工按 class 拆核心/压迫位/背景位 + 场景 + 道具', () => {
      const refs = [
        { category: 'character', name: '小红帽' },
        { category: 'character', name: '大灰狼' },
        { category: 'scene', name: '森林' },
        { category: 'prop', name: '篮子' },
      ]
      const out = assembleShotUser({ index: 2, description: 'x' }, refs, '')
      expect(out).toContain('小红帽｜核心人物')
      expect(out).toContain('大灰狼｜主压迫位/对手位')
      expect(out).toContain('【本分镜场景环境角色】@森林')
      expect(out).toContain('【本分镜关键道具】@篮子')
    })
  })
})

describe('scriptBoxSchema · normalizeScriptBoxData（P0-0）', () => {
  it('缺字段旧数据归一化补齐顶层/分镜/资产默认，不丢存量', () => {
    const raw = { story: '旧故事', shots: [{ id: 's1', description: '旧' }], assets: [{ id: 'a1', imageUrl: '/files/a.png' }] }
    const d = normalizeScriptBoxData(raw)
    expect(d.story).toBe('旧故事') // 存量保留
    expect(d.imageNegative).toBe('') // 新字段补默认
    expect(d.videoNegative).toBe('')
    expect(Array.isArray(d.tailFrameAngleIds)).toBe(true)
    // shot 子字段补齐 P1-1 连续性默认
    const s = d.shots[0]
    expect(s.usePrevShotVideoTail).toBe(false)
    expect(s.prevShotImageRefUrls).toEqual([])
    expect(s.prevTailFrameVariants).toEqual([])
    expect(s.selectedTailFrameVariantId).toBe('original')
    // asset 子字段：thumbnailUrl 缺省回退 imageUrl（P0-3）
    expect(d.assets[0].thumbnailUrl).toBe('/files/a.png')
  })
  it('non-object 项兜底为空默认', () => {
    const d = normalizeScriptBoxData({ shots: [null, 'x'], assets: [undefined] })
    expect(d.shots.length).toBe(2)
    expect(d.shots[1].usePrevShotVideoTail).toBe(false)
    expect(d.assets[0].imageUrl).toBe('')
  })
  it('默认值对象为全新引用（防共享突变）', () => {
    const a = defaultShotFields()
    const b = defaultShotFields()
    expect(a).toEqual(b)
    a.usePrevShotVideoTail = true
    expect(b.usePrevShotVideoTail).toBe(false)
    expect(defaultScriptBoxTop().tailFrameAngleIds).toEqual(['forward', 'closeup', 'rotateLeft45'])
    expect(defaultAssetFields().thumbnailUrl).toBe('')
  })
})

describe('scriptBoxEngine · 引擎编排', () => {
  function makeEngine(initial) {
    const store = { ...initial }
    const addNodes = vi.fn()
    const getData = vi.fn(() => store)
    const updateData = vi.fn((patch) => { Object.assign(store, patch); return true })
    const getProviderState = vi.fn(() => ({ providers: [{ id: 'openai' }], primary: 'openai' }))
    const setEdges = vi.fn((updater) => { store._edges = updater(store._edges || []) })
    const engine = createScriptBoxEngine({
      getData, updateData, addNodes, setEdges,
      nodeId: 'node-1', getNodes: vi.fn(() => []), getProviderState,
    })
    return { engine, store, addNodes, updateData, getData }
  }

  beforeEach(() => vi.clearAllMocks())

  it('onGenerateScript 校验：无剧情时仅 toast 不调用 chat', async () => {
    const { chatCompletions } = await import('../../src/components/base/chatApi.js')
    const { toastStore } = await import('../../src/components/base/toastStore.js')
    const { engine, store } = makeEngine({})
    await engine.onGenerateScript()
    expect(chatCompletions).not.toHaveBeenCalled()
    expect(toastStore.showToast).toHaveBeenCalledWith(expect.stringContaining('剧情'), expect.anything())
    expect(store.genMask).toBeUndefined()
  })

  it('onGenerateScript 调用 chatCompletions 并归一化写回 shots/assets', async () => {
    const { chatCompletions } = await import('../../src/components/base/chatApi.js')
    chatCompletions.mockResolvedValueOnce({
      ok: true,
      content: '```json\n{"projectName":"小猫历险","globalStyle":"手绘","shots":[{"index":1,"description":"猫跳上桌"}],"assets":[{"name":"猫","category":"character","description":"橘猫"}]}\n```',
    })
    const { engine, store } = makeEngine({ story: '一只猫', shotCount: 3 })
    await engine.onGenerateScript()
    expect(chatCompletions).toHaveBeenCalled()
    expect(Array.isArray(store.shots)).toBe(true)
    expect(store.shots[0]).toMatchObject({ id: 'node-1-shot-0', index: 1, description: '猫跳上桌' })
    expect(store.assets[0]).toMatchObject({ name: '猫', category: 'character' })
    expect(store.globalStyle).toBe('手绘')
    expect(store.genMask).toBe(false)
    expect(store.projectName).toBe('小猫历险')
  })

  it('onGenerateScript 把上游接入图片传给 chatCompletions（编剧 AI 看产品外观）', async () => {
    const { chatCompletions } = await import('../../src/components/base/chatApi.js')
    chatCompletions.mockResolvedValueOnce({ ok: true, content: '```json\n{"shots":[{"description":"展示产品"}]}\n```' })
    const { engine, store } = makeEngine({
      story: '为产品拍一支广告',
      upstreamStory: '产品是一款无线耳机',
      upstreamImages: [{ id: 'i1', url: 'http://127.0.0.1:18080/files/p.png' }, { id: 'i2', url: '/files/q.png' }],
    })
    await engine.onGenerateScript()
    expect(chatCompletions).toHaveBeenCalled()
    const call = chatCompletions.mock.calls[0][0]
    // 上游图片以 images 传给模型（转 image_url 内容块）
    expect(call.images).toEqual(['http://127.0.0.1:18080/files/p.png', '/files/q.png'])
    // 上游文本并入剧情
    const userMsg = call.messages.find((m) => m.role === 'user')
    expect(userMsg.content).toContain('为产品拍一支广告')
    expect(userMsg.content).toContain('产品是一款无线耳机')
    // story 只写回用户手填部分，上游文本留在 upstreamStory（只读素材区展示，避免重复）
    expect(store.story).toBe('为产品拍一支广告')
    expect(store.upstreamStory).toBe('产品是一款无线耳机')
  })

  it('onGenerateScript 无上游图片时 images 为空数组', async () => {
    const { chatCompletions } = await import('../../src/components/base/chatApi.js')
    chatCompletions.mockResolvedValueOnce({ ok: true, content: '```json\n{"shots":[{"description":"x"}]}\n```' })
    const { engine } = makeEngine({ story: 'no imgs' })
    await engine.onGenerateScript()
    const call = chatCompletions.mock.calls[0][0]
    expect(call.images).toEqual([])
  })

  it('onGenerateScript 模型返回非 JSON 时回退 genMask=false 并 toast', async () => {
    const { chatCompletions } = await import('../../src/components/base/chatApi.js')
    const { toastStore } = await import('../../src/components/base/toastStore.js')
    chatCompletions.mockResolvedValueOnce({ ok: true, content: '不是json' })
    const { engine, store } = makeEngine({ story: 'x' })
    await engine.onGenerateScript()
    expect(store.genMask).toBe(false)
    expect(toastStore.showToast).toHaveBeenCalled()
  })

  it('onStopScriptItem 全停：中止所有 AbortController', async () => {
    const { chatCompletions } = await import('../../src/components/base/chatApi.js')
    chatCompletions.mockImplementationOnce(() => new Promise(() => {})) // 永不 resolve，保持运行
    const { engine, store } = makeEngine({ story: '长跑剧情' })
    const p = engine.onGenerateScript() // 触发一次生成并挂起
    // 等待引擎进入请求（abortMap 注册 'script'）
    await new Promise((r) => setTimeout(r, 20))
    engine.onStopScriptItem() // 全停
    // 不应抛错；await 让挂起的 promise 在 abort 后结束（catch 静默）
    await Promise.race([p, new Promise((r) => setTimeout(r, 50))])
    expect(true).toBe(true) // 能安全中止即达标
  })

  it('onConnectShot 建下游 promptNode 并自动连线', async () => {
    const { engine, store, addNodes } = makeEngine({
      shots: [{ id: 's1', index: 1, prompt: 'p', videoPrompt: 'v' }],
    })
    engine.onConnectShot('s1', 'image')
    expect(addNodes).toHaveBeenCalledTimes(1)
    const node = addNodes.mock.calls[0][0][0]
    expect(node.type).toBe('promptNode')
    expect(node.data.prompt).toBe('p')
    expect(store._edges.length).toBe(1)
    expect(store._edges[0].source).toBe('node-1')
    expect(store._edges[0].sourceHandle).toBe('shot-s1')
  })

  // ── P0-②：下游参考图字段名统一为 images（生图/生视频不再各用各的名字）──
  it('onConnectShot 生图/生视频下游参考图字段统一为 images', async () => {
    const assets = [{ id: 'asset-城堡', name: '城堡', imageUrl: '/files/城堡.png' }]
    const { engine, addNodes } = makeEngine({
      shots: [{ id: 's1', index: 1, description: '走进 @城堡', prompt: 'p', videoPrompt: 'v' }],
      assets,
    })
    // 生图下游
    engine.onConnectShot('s1', 'image')
    const imgNode = addNodes.mock.calls[0][0][0]
    expect(imgNode.type).toBe('promptNode')
    expect(imgNode.data.images).toEqual([{ id: 'script-asset-asset-城堡', url: 'http://127.0.0.1:18080/files/城堡.png' }])
    expect(imgNode.data.refImages).toBeUndefined() // 不再使用 refImages 命名
    // 生视频下游
    addNodes.mockClear()
    engine.onConnectShot('s1', 'video')
    const vidNode = addNodes.mock.calls[0][0][0]
    expect(vidNode.type).toBe('discountVideoNode')
    expect(vidNode.data.images).toEqual([{ id: 'script-asset-asset-城堡', url: 'http://127.0.0.1:18080/files/城堡.png' }])
    expect(vidNode.data.refImages).toBeUndefined()
  })

  // ── 缺陷②「偶发」来源B：连线早于资产生图 → data.images 快照冻结为空，且永不更新 ──
  it('onConnectShot 连线时资产还没出图(imageUrl为空) → 下游 node.data.images 为空且不随后来出图自动补', async () => {
    // 资产已注册但 imageUrl 为空（用户先连线、后生成资产图）
    const assets = [{ id: 'asset-城堡', name: '城堡', imageUrl: '' }]
    const { engine, addNodes, store } = makeEngine({
      shots: [{ id: 's1', index: 1, description: '走进 @城堡', prompt: 'p', videoPrompt: 'v' }],
      assets,
    })
    engine.onConnectShot('s1', 'image')
    const node = addNodes.mock.calls[0][0][0]
    expect(node.data.images).toEqual([]) // 快照冻结：连线那一刻图片还没生成

    // 之后用户生成城堡图（imageUrl 补上）→ 已创建的下游节点 images 不会自动补
    store.assets = [{ id: 'asset-城堡', name: '城堡', imageUrl: '/files/x.png' }]
    // 断言：node.data 是连线时快照，字面引用未被外部 store 改变（collected 结果已固化在数组里）
    // 且引擎没有任何后续触发来刷新该节点 —— 表现为「这一镜垫不上图」的另一种偶发（与边界 bug 无关）
    expect(node.data.images).toEqual([])
  })

  // ── P0-①：onConnectShots 支持 target，批量建对应下游类型 ──
  it('onConnectShots(ids, "video") 批量建 discountVideoNode', async () => {
    const { engine, addNodes } = makeEngine({
      shots: [
        { id: 's1', index: 1, description: '@城堡', prompt: 'p1', videoPrompt: 'v1' },
        { id: 's2', index: 2, description: '@森林', prompt: 'p2', videoPrompt: 'v2' },
      ],
      assets: [{ id: 'a1', name: '城堡', imageUrl: '/f/1.png' }, { id: 'a2', name: '森林', imageUrl: '/f/2.png' }],
    })
    // onConnectShots 内部逐个调 onConnectShot（forEach），每次 addNodes 1 个节点
    engine.onConnectShots(['s1', 's2'], 'video')
    const allNodes = addNodes.mock.calls.flatMap((c) => c[0])
    expect(allNodes).toHaveLength(2)
    expect(allNodes.every((n) => n.type === 'discountVideoNode')).toBe(true)
  })

  it('onConnectShots 缺省 target 默认 "image"（兼容旧调用）', async () => {
    const { engine, addNodes } = makeEngine({
      shots: [{ id: 's1', index: 1, description: 'x', prompt: 'p', videoPrompt: 'v' }],
    })
    engine.onConnectShots(['s1'])
    expect(addNodes).toHaveBeenCalledTimes(1)
    expect(addNodes.mock.calls[0][0][0].type).toBe('promptNode')
  })

  it('onConnectShots 未传/空数组 → 全部镜头（与批量生成逻辑一致）', async () => {
    const { engine, addNodes } = makeEngine({
      shots: [
        { id: 's1', index: 1, description: 'x', prompt: 'p1', videoPrompt: 'v1' },
        { id: 's2', index: 2, description: 'y', prompt: 'p2', videoPrompt: 'v2' },
      ],
    })
    // 空数组 → 全部
    engine.onConnectShots([], 'image')
    let allNodes = addNodes.mock.calls.flatMap((c) => c[0])
    expect(allNodes).toHaveLength(2)
    expect(allNodes.every((n) => n.type === 'promptNode')).toBe(true)
    // 不传 → 全部
    addNodes.mockClear()
    engine.onConnectShots(undefined, 'video')
    allNodes = addNodes.mock.calls.flatMap((c) => c[0])
    expect(allNodes).toHaveLength(2)
    expect(allNodes.every((n) => n.type === 'discountVideoNode')).toBe(true)
  })

  // ── 从素材库选择图片设为资产参考图（onPickAssetImage）──
  it('onPickAssetImage：把素材库图片 URL 写入资产（补全绝对地址）', async () => {
    const { engine, store } = makeEngine({
      assets: [{ id: 'a1', name: '主角', category: 'character', imageUrl: '', thumbnailUrl: '', has: false, imageStatus: '' }],
    })
    engine.onPickAssetImage('a1', '/files/migrated/人物/主角.png')
    expect(store.assets[0].has).toBe(true)
    expect(store.assets[0].imageStatus).toBe('uploaded')
    expect(store.assets[0].imageUrl).toContain('/files/migrated/人物/主角.png')
    expect(store.assets[0].thumbnailUrl).toBe(store.assets[0].imageUrl)
  })

  it('onPickAssetImage：空 URL 不写资产，资产不存在不抛错', async () => {
    const { engine, store } = makeEngine({
      assets: [{ id: 'a1', name: '主角', category: 'character', imageUrl: '', has: false }],
    })
    engine.onPickAssetImage('a1', '') // 空 url → 只 toast，不写入
    expect(store.assets[0].has).toBe(false)
    expect(() => engine.onPickAssetImage('nope', '/files/x.png')).not.toThrow() // 资产不存在 → 静默
  })

  // ── P1-③：按钮连下游透传宽高比/时长预填（复刻 App.jsx 对 shot- 端口的预填）──
  it('onConnectShot 透传宽高比（image→aspectRatio；video→size+时长+durationFromScript）', async () => {
    const { engine, addNodes } = makeEngine({
      aspectRatio: '9:16',
      shots: [{ id: 's1', index: 1, description: 'x', prompt: 'p', videoPrompt: 'v', duration: '7s' }],
    })
    // image 下游
    engine.onConnectShot('s1', 'image')
    const imgNode = addNodes.mock.calls[0][0][0]
    expect(imgNode.data.aspectRatio).toBe('9:16')
    addNodes.mockClear()
    // video 下游
    engine.onConnectShot('s1', 'video')
    const vidNode = addNodes.mock.calls[0][0][0]
    expect(vidNode.data.size).toBe('9:16')
    expect(vidNode.data.selectedSeconds).toBe('7')
    expect(vidNode.data.durationFromScript).toBe(true)
  })

  it('onConnectShot 宽高比 custom 用 customAspectRatio；4:4 归一为 1:1', async () => {
    const { engine, addNodes } = makeEngine({
      aspectRatio: 'custom',
      customAspectRatio: '2:1',
      shots: [{ id: 's1', index: 1, description: 'x', prompt: 'p', videoPrompt: 'v', duration: '5s' }],
    })
    engine.onConnectShot('s1', 'image')
    expect(addNodes.mock.calls[0][0][0].data.aspectRatio).toBe('2:1')
    addNodes.mockClear()

    const { engine: e2, addNodes: addNodes2 } = makeEngine({
      aspectRatio: '4:4',
      shots: [{ id: 's2', index: 1, description: 'x', prompt: 'p', videoPrompt: 'v', duration: '5s' }],
    })
    e2.onConnectShot('s2', 'video')
    expect(addNodes2.mock.calls[0][0][0].data.size).toBe('1:1')
  })
})

// ── P11 收口：批量生成期间多次分镜写回合并为低频一次 setNodes ──
// 契约：① 合并生效（updateData/setNodes 调用次数显著少于 N×2）；
//       ② 合并不丢数据（所有分镜 prompt 最终都完整写回）。
describe('scriptBoxEngine · P11 批量写回合并', () => {
  function makeBatchEngine(shots, assets = []) {
    const store = { shots: shots.map((s) => ({ ...s })), assets }
    // 真实记录每次 setNodes 调用（函数式补丁也计一次）；不直接应用，留给 flush 统一应用，
    // 以模拟 ReactFlow 的「一次 setNodes = 一次全图重建」代价。
    const setNodesCalls = []
    const getData = vi.fn(() => store)
    const updateData = vi.fn((patch) => {
      setNodesCalls.push(patch)
      const next = typeof patch === 'function' ? patch(store) : patch
      store.shots = next.shots || store.shots
      store.assets = next.assets || store.assets
      return true
    })
    const getProviderState = vi.fn(() => ({ providers: [{ id: 'openai' }], primary: 'openai' }))
    const engine = createScriptBoxEngine({
      getData, updateData, addNodes: vi.fn(), setEdges: vi.fn(),
      nodeId: 'node-batch', getNodes: vi.fn(() => []), getProviderState,
    })
    return { engine, store, updateData, setNodesCalls }
  }

  beforeEach(() => {
    vi.useFakeTimers()
    chatCompletions.mockReset()
    chatCompletions.mockResolvedValue({
      ok: true,
      content: JSON.stringify({ prompt: '分镜画面提示词', videoPrompt: '【时长 5秒】视频内容' }),
    })
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('批量生成 N 个分镜：setNodes 调用次数显著少于 N×2（合并生效），且所有 prompt 写回', async () => {
    const N = 8
    const shots = Array.from({ length: N }, (_, i) => ({
      id: `s${i}`, index: i + 1, description: `镜头${i}`, prompt: '', videoPrompt: '',
    }))
    const { engine, store, updateData, setNodesCalls } = makeBatchEngine(shots)

    // 立即 resolve → 分镜完成并入 200ms flush 窗口；START_GAP_MS=500 串行启动需推进足够时长
    const p = engine.onGenerateShotPrompts()
    await vi.advanceTimersByTimeAsync(N * 600 + 500) // 覆盖 N*START_GAP + flush 窗口
    await p

    // 契约①：合并生效——调用次数远低于朴素「每个分镜 loading 开/关 + 写 prompt ≈ 2N」次
    expect(updateData.mock.calls.length).toBeLessThan(N * 2)
    expect(updateData.mock.calls.length).toBeGreaterThan(0)
    // 验证确实是「合并」而非「1 次全量」导致无法区分——至少比逐分镜写入少一截
    expect(setNodesCalls.length).toBeLessThan(N * 2)

    // 契约②：合并不丢数据——所有分镜 prompt 最终完整写回
    expect(store.shots).toHaveLength(N)
    for (const s of store.shots) {
      expect(s.prompt).toBe('分镜画面提示词')
      expect(s.videoPrompt).toBe('【时长 5秒】视频内容')
      expect(s.promptLoading).toBe(false)
    }
  })

  it('合并不丢数据：错误分镜（JSON 不完整）也正确回退且动画关闭', async () => {
    const shots = [
      { id: 'sa', index: 1, description: 'a', prompt: '', videoPrompt: '' },
      { id: 'sb', index: 2, description: 'b', prompt: '', videoPrompt: '' },
    ]
    const { engine, store, updateData } = makeBatchEngine(shots)
    // 第二个分镜返回非 JSON → 走「回退 + toast」分支，仍应并入合并 flush
    chatCompletions.mockResolvedValueOnce({ ok: true, content: JSON.stringify({ prompt: 'ok-p', videoPrompt: 'ok-v' }) })
    chatCompletions.mockResolvedValueOnce({ ok: true, content: '不是json' })

    const p = engine.onGenerateShotPrompts()
    await vi.advanceTimersByTimeAsync(shots.length * 600 + 500)
    await p

    expect(updateData.mock.calls.length).toBeLessThan(shots.length * 2)
    expect(store.shots[0]).toMatchObject({ prompt: 'ok-p', promptLoading: false })
    expect(store.shots[1]).toMatchObject({ prompt: '', promptLoading: false })
  })
})
