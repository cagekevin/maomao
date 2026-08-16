import { describe, it, expect } from 'vitest'
import { parseJsonText, useJsonObject, dialogueLines, assembleShotUser } from '../../src/components/base/scriptBoxEngine.js'

// §2.7 剧本盒引擎纯函数（scriptBoxEngine 内不依赖 React/网络的纯逻辑）
// 规划 §3.1 的 scriptBox.test.js 遗漏项：parseJsonText/useJsonObject/dialogueLines/assembleShotUser

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
