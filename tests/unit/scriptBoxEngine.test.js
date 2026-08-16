import { describe, it, expect, vi, beforeEach } from 'vitest'

// mock 网络与统一提示（让 createScriptBoxEngine 回调可在单测中受控验证）
vi.mock('../../src/components/base/chatApi.js', () => ({
  chatCompletions: vi.fn(),
}))
vi.mock('../../src/components/base/imageApi.js', () => ({
  generateImage: vi.fn(),
}))
vi.mock('../../src/components/base/toastStore.js', () => ({
  showToast: vi.fn(),
}))

import { chatCompletions } from '../../src/components/base/chatApi.js'
import { generateImage } from '../../src/components/base/imageApi.js'
import { showToast } from '../../src/components/base/toastStore.js'
import { parseJsonText, useJsonObject, dialogueLines, assembleShotUser, createScriptBoxEngine } from '../../src/components/base/scriptBoxEngine.js'

// ═══════════════════════════════════════════════════════════════
// 剧本盒引擎纯函数（parseJsonText/useJsonObject/dialogueLines/assembleShotUser）
// ═══════════════════════════════════════════════════════════════
describe('剧本盒引擎纯函数 parseJsonText', () => {
  it('去掉 ```json 围栏并解析纯 JSON', () => {
    const r = parseJsonText('```json\n{"name":"小红帽","shots":[]}\n```')
    expect(r.ok).toBe(true)
    expect(r.data.name).toBe('小红帽')
  })

  it('提取包裹在前后文字中的首个 {...} 块', () => {
    const r = parseJsonText('以下是结果：{"a":1} 结束')
    expect(r.ok).toBe(true)
    expect(r.data.a).toBe(1)
  })

  it('非法 JSON 返回 { ok:false }', () => {
    const r = parseJsonText('不是json')
    expect(r.ok).toBe(false)
    expect(r.data).toBeNull()
  })

  it('空输入返回 { ok:false }', () => {
    expect(parseJsonText('').ok).toBe(false)
    expect(parseJsonText(null).ok).toBe(false)
  })
})

describe('剧本盒引擎纯函数 useJsonObject', () => {
  it('默认模型使用 json_object', () => {
    expect(useJsonObject('gpt-4o')).toBe(true)
    expect(useJsonObject('')).toBe(true)
  })

  it('deepseek/claude 不使用 json_object', () => {
    expect(useJsonObject('deepseek-chat')).toBe(false)
    expect(useJsonObject('claude-3')).toBe(false)
    expect(useJsonObject('DeepSeek-V3')).toBe(false) // 大小写不敏感
  })
})

describe('剧本盒引擎纯函数 dialogueLines', () => {
  it('「说话者：台词」格式行 → 说话者+完整原句', () => {
    const r = dialogueLines('小红帽：你去哪')
    expect(r).toContain('说话者：小红帽')
    expect(r).toContain('完整原句：你去哪')
  })

  it('旁白标记行 → 旁白+完整原句', () => {
    const r = dialogueLines('[旁白|] 天黑了')
    expect(r).toContain('旁白')
    expect(r).toContain('完整原句：天黑了')
  })

  it('无前缀纯文本 → 只补完整原句', () => {
    const r = dialogueLines('只是环境声')
    expect(r).toContain('完整原句：只是环境声')
  })

  it('多行 → 每行独立并 \n 连接，空行过滤', () => {
    const r = dialogueLines('小红帽：你好\n\n旁白：起风了')
    const lines = r.split('\n').filter(Boolean)
    expect(lines).toHaveLength(2)
    expect(lines[0]).toContain('小红帽')
    expect(lines[1]).toContain('起风了')
  })

  it('空/undefined → 空串', () => {
    expect(dialogueLines('')).toBe('')
    expect(dialogueLines(null)).toBe('')
    expect(dialogueLines(undefined)).toBe('')
  })
})

describe('剧本盒引擎纯函数 assembleShotUser', () => {
  const baseShot = { index: 1, duration: '5s', shotType: '中景', lighting: '自然光', motion: '推', description: '@小红帽 走进 @森林', dialogue: '小红帽：我去采蘑菇', sound: '环境音' }

  it('拼接镜头完整 user 内容（编号/时长/景别/描述/对白/音效/资产）', () => {
    const r = assembleShotUser(baseShot, [{ name: '小红帽' }, { name: '森林' }], '皮克斯')
    expect(r).toContain('镜头编号：1')
    expect(r).toContain('时长：5s')
    expect(r).toContain('景别：中景')
    expect(r).toContain('画面描述：@小红帽 走进 @森林')
    expect(r).toContain('说话者：小红帽')
    expect(r).toContain('统一风格：皮克斯')
    expect(r).toContain('@小红帽、@森林')
  })

  it('无资产时提示不凭空加角色', () => {
    const r = assembleShotUser({ ...baseShot, description: '空旷草原' }, [], '')
    expect(r).toContain('本分镜未引用具体资源')
  })

  it('可选字段缺失时跳过对应行', () => {
    const r = assembleShotUser({ index: 2, description: '只有描述' }, [], '')
    expect(r).toContain('镜头编号：2')
    expect(r).not.toContain('景别：')
    expect(r).not.toContain('光影：')
    expect(r).toContain('画面描述：只有描述')
  })
})

// ═══════════════════════════════════════════════════════════════
// 剧本盒引擎回调 createScriptBoxEngine（含「报错统一显示」回归防护）
// ═══════════════════════════════════════════════════════════════
// 通过 mock chatApi/imageApi/showToast，验证：
//  - 每个失败路径都正确调用统一 showToast（而非无订阅的 window 事件）→ 用户能看到报错
//  - 每个成功路径正确写回 node.data 状态
describe('剧本盒引擎回调 createScriptBoxEngine', () => {
  // 引擎依赖注入捕获器
  let data
  let patches
  let providerState
  const ctx = () => ({
    getData: () => data,
    updateData: (p) => { patches.push(p) },
    getProviderState: () => providerState,
    nodeId: 'sb-1',
    setEdges: vi.fn(),
    getNodes: () => [{ id: 'sb-1', position: { x: 0, y: 0 }, width: 900, data }],
    addNodes: vi.fn(),
  })

  // 构造一个带真实文本模型的 provider（chat + image 都有）
  const fullProviderState = {
    providers: [
      { id: 'lovart', name: 'Lovart', isPrimary: true, protocol: 'apimart',
        chat_models: [{ id: 'lovart-chat', label: 'Lovart 设计 Agent' }],
        image_models: [{ id: 'gpt-image-2', label: 'GPT Image 2' }],
        video_models: [] },
    ],
    primary: { id: 'lovart', isPrimary: true, protocol: 'apimart',
      chat_models: [{ id: 'lovart-chat' }], image_models: [{ id: 'gpt-image-2' }], video_models: [] },
  }

  beforeEach(() => {
    patches = []
    data = {}
    providerState = fullProviderState
    vi.clearAllMocks()
  })

  // ---------- onGenerateScript 报错路径 ----------
  it('无剧情 → 报「请先输入剧情」到统一 toast（error），且不调用 chat', async () => {
    const eng = createScriptBoxEngine(ctx())
    await eng.onGenerateScript()
    expect(showToast).toHaveBeenCalledTimes(1)
    expect(showToast).toHaveBeenCalledWith('请先输入剧情', expect.objectContaining({ type: 'error' }))
    expect(chatCompletions).not.toHaveBeenCalled()
  })

  it('有剧情但无 provider → 报「请先配置文本大模型」error toast', async () => {
    providerState = { providers: [], primary: null }
    data = { story: '小红帽的故事' }
    const eng = createScriptBoxEngine(ctx())
    await eng.onGenerateScript()
    expect(showToast).toHaveBeenCalledWith('请先在「设置」中配置文本大模型', expect.objectContaining({ type: 'error' }))
    expect(chatCompletions).not.toHaveBeenCalled()
  })

  it('chat 返回失败 → 报该错误到统一 toast，并复位 genMask', async () => {
    chatCompletions.mockResolvedValue({ ok: false, error: '网络错误' })
    data = { story: '小红帽的故事' }
    const eng = createScriptBoxEngine(ctx())
    await eng.onGenerateScript()
    expect(chatCompletions).toHaveBeenCalledTimes(1)
    expect(showToast).toHaveBeenCalledWith('网络错误', expect.objectContaining({ type: 'error' }))
    expect(patches.some((p) => p.genMask === false)).toBe(true)
  })

  it('chat 返回非 JSON → 报「JSON 不完整」error toast', async () => {
    chatCompletions.mockResolvedValue({ ok: true, content: '不是 JSON' })
    data = { story: '小红帽的故事' }
    const eng = createScriptBoxEngine(ctx())
    await eng.onGenerateScript()
    expect(showToast).toHaveBeenCalledWith(expect.stringContaining('JSON 不完整'), expect.objectContaining({ type: 'error' }))
  })

  it('chat 成功 → 写回 shots/assets、复位 genMask、报「已生成 N 个分镜」success toast', async () => {
    chatCompletions.mockResolvedValue({
      ok: true,
      content: JSON.stringify({
        projectName: '小红帽', globalStyle: '皮克斯',
        shots: [{ description: '@小红帽 走进 @森林' }, { description: '@大灰狼 出现' }],
        assets: [{ name: '小红帽', category: 'character', description: '蓝发少女' }],
      }),
    })
    data = { story: '小红帽的故事' }
    const eng = createScriptBoxEngine(ctx())
    await eng.onGenerateScript()

    const last = patches[patches.length - 1]
    expect(last.genMask).toBe(false)
    expect(last.shots).toHaveLength(2)
    expect(last.assets).toHaveLength(1)
    expect(last.assets[0]).toMatchObject({ name: '小红帽', category: 'character', has: false })
    expect(showToast).toHaveBeenCalledWith('已生成 2 个分镜', expect.objectContaining({ type: 'success' }))
  })

  // ---------- onGenerateAssetImage ----------
  it('资产生图无 provider → 报「请先配置资产生图大模型」error toast', async () => {
    providerState = { providers: [], primary: null }
    data = { assets: [{ id: 'a1', name: '小红帽', category: 'character', description: '蓝发少女' }] }
    const eng = createScriptBoxEngine(ctx())
    await eng.onGenerateAssetImage('a1')
    expect(showToast).toHaveBeenCalledWith('请先在「设置」中配置资产生图大模型', expect.objectContaining({ type: 'error' }))
    expect(generateImage).not.toHaveBeenCalled()
  })

  it('资产生图成功 → 写回 imageUrl/has:true', async () => {
    generateImage.mockResolvedValue({ ok: true, url: '/files/a.png' })
    data = { assets: [{ id: 'a1', name: '小红帽', category: 'character', description: '蓝发少女', prompt: '' }] }
    const eng = createScriptBoxEngine(ctx())
    await eng.onGenerateAssetImage('a1')
    const last = patches[patches.length - 1]
    expect(last.assets[0]).toMatchObject({ has: true, imageUrl: '/files/a.png', thumbnailUrl: '/files/a.png', loading: false })
  })

  // ---------- onGenerateShotPrompts ----------
  it('生成分镜提示词无 provider → 报「请先配置文本大模型」error toast', async () => {
    providerState = { providers: [], primary: null }
    data = { shots: [{ id: 's1', description: '镜头1' }] }
    const eng = createScriptBoxEngine(ctx())
    await eng.onGenerateShotPrompts()
    expect(showToast).toHaveBeenCalledWith('请先在「设置」中配置文本大模型', expect.objectContaining({ type: 'error' }))
  })

  // ---------- onStopScriptItem（全停） ----------
  it('全停 → 复位 genMask 与所有 loading 状态', () => {
    data = {
      genMask: true,
      shots: [{ id: 's1', promptLoading: true, imgGenLoading: true }],
      assets: [{ id: 'a1', loading: true }],
    }
    const eng = createScriptBoxEngine(ctx())
    eng.onStopScriptItem()
    const last = patches[patches.length - 1]
    expect(last.genMask).toBe(false)
    expect(last.shots[0].promptLoading).toBe(false)
    expect(last.shots[0].imgGenLoading).toBe(false)
    expect(last.assets[0].loading).toBe(false)
  })

  // ---------- toast 类型分档（回归防护：错误用红条、成功用绿条） ----------
  it('toast 自动分档：失败/配置类 → error，成功类 → success', async () => {
    chatCompletions.mockResolvedValue({ ok: false, error: '脚本生成失败' })
    data = { story: '小红帽的故事' }
    const eng = createScriptBoxEngine(ctx())
    await eng.onGenerateScript()
    expect(showToast).toHaveBeenCalledWith('脚本生成失败', expect.objectContaining({ type: 'error' }))
  })

  // ---------- 批量生成提示词：分批并发（每批最多 6 个） ----------
  it('批量生成 13 个分镜提示词：峰值并发 ≤ 6，且最终全部写回', async () => {
    // 用可控延迟的 mock 统计"同时进行中"的最大并发数
    let inflight = 0
    let maxInflight = 0
    let resolveQueue = []
    chatCompletions.mockImplementation(() => {
      inflight += 1
      maxInflight = Math.max(maxInflight, inflight)
      return new Promise((resolve) => {
        resolveQueue.push(() => { inflight -= 1; resolve({ ok: true, content: '{"prompt":"图提示词","videoPrompt":"视频提示词"}' }) })
      })
    })

    data = { shots: Array.from({ length: 13 }, (_, i) => ({ id: `s${i + 1}`, index: i + 1, description: `镜头${i + 1}` })) }
    const eng = createScriptBoxEngine(ctx())

    // 异步启动，随后逐个放行 mock，观察并发峰值
    const runPromise = eng.onGenerateShotPrompts()
    await new Promise((r) => setTimeout(r, 20))
    // 放行所有待决请求（此时应已按批 6/6/1 发起）
    while (resolveQueue.length) {
      resolveQueue.splice(0).forEach((fn) => fn())
      await new Promise((r) => setTimeout(r, 5))
    }
    await runPromise

    expect(maxInflight).toBeLessThanOrEqual(6) // 峰值并发不超过 6
    expect(chatCompletions).toHaveBeenCalledTimes(13) // 13 个镜头都请求了
    // 全部写回 prompt/videoPrompt：收集所有 patch 里带 prompt 的 shot，去重后应为 13
    const written = new Set()
    for (const p of patches) {
      for (const s of p.shots || []) {
        if (s.prompt === '图提示词') written.add(s.id)
      }
    }
    expect(written.size).toBe(13)
  })
})
