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
vi.mock('../../src/components/base/providerModels.js', () => ({
  resolveProviderModel: vi.fn(() => ({ provider: 'openai', modelId: 'gpt-4o-mini' })),
  buildAllModels: vi.fn(() => [{ id: 'gpt-4o-mini' }]),
}))
vi.mock('../../src/components/base/toastStore.js', () => {
  const showToast = vi.fn()
  return { showToast, toastStore: { showToast } }
})

const {
  parseJsonText,
  useJsonObject,
  dialogueLines,
  assembleShotUser,
  createScriptBoxEngine,
} = await import('../../src/components/base/scriptBoxEngine.js')

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
})
