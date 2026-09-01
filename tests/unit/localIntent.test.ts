import { describe, it, expect } from 'vitest'
import { classifyLocalIntent, buildIntentHint } from '../../src/components/agent/runtime/useAgentChat.ts'

/**
 * 意图本地判定（docs/76 · L1 层）
 *
 * 本层只做「把本地规则的结论告诉 LLM」这一件事，是引导不是拦截：
 * tools 照常全量传给模型，本地判定只多追加一句 system 提示，不限制任何能力。
 *
 * 回归背景：用户发图 +「反推图像提示词」时，模型在【查看画布】与【生成/改图】间
 * 摇摆 6 轮后误调 get_node_details —— 该工具只返回节点结构化 data，读不到图像
 * 画面内容。修复后该输入须本地判为 content，并注入「不需要调用画布工具」的提示。
 */
describe('意图本地判定 classifyLocalIntent（docs/76 L1）', () => {
  const cases: [string, string][] = [
    // ── content：内容理解/产出文字（本次故障无处安放的那一档）──
    ['反推图像提示词', 'content'],
    ['反推这张图的提示词', 'content'],
    ['帮我写个提示词', 'content'],
    ['描述这张图', 'content'],
    ['这张图里有什么', 'content'],
    ['提取图上文字', 'content'],
    ['这张图什么风格', 'content'],
    ['把这段文案润色一下', 'content'],
    ['翻译这段话', 'content'],
    ['帮我起个名字', 'content'],
    // ── generate：生成动词优先，绝不把真实出图引导成「不用工具」──
    ['反推提示词并生成一张图', 'generate'],
    ['根据这张图生成', 'generate'],
    ['把这张图改成黑白', 'generate'],
    ['生成一只赛博朋克猫', 'generate'],
    // ── chat：短问候 ──
    ['你好', 'chat'],
    ['谢谢', 'chat'],
    // ── null：判不出 → 不注入，行为同现状（漏判是安全的失败模式）──
    ['', 'null'],
    ['帮我把这些节点连起来', 'null'],
    ['看看画布上有哪些节点', 'null'],
    ['撤销刚才那一步', 'null'],
    // 「画一只猫」本地判不出（GENERATE_RE 未收单字「画」，避免误伤「画风」类描述词），
    // 交 LLM 正常出图——漏判不产生错误行为，符合「宁可漏判不可误判」。
    ['画一只猫', 'null'],
  ]
  it.each(cases)('%s → %s', (text, expected) => {
    const got = classifyLocalIntent(text)
    expect(got.intent ?? 'null').toBe(expected)
  })

  it('判不出时返回 intent:null + confidence:0（下游不注入任何提示）', () => {
    expect(classifyLocalIntent('帮我把这些节点连起来')).toEqual({ intent: null, confidence: 0 })
  })

  it('空输入 / 纯空白不判定', () => {
    expect(classifyLocalIntent('').intent).toBeNull()
    expect(classifyLocalIntent('   ').intent).toBeNull()
  })
})

describe('buildIntentHint（注入给 LLM 的预判提示）', () => {
  it('content 命中时提示「不需要调用画布工具」——本次故障回归用例', () => {
    const hint = buildIntentHint('反推图像提示词')
    expect(hint).toContain('内容理解/产出文字')
    expect(hint).toContain('不需要调用任何画布工具')
  })

  it('chat 命中时提示只做文字回应', () => {
    expect(buildIntentHint('你好')).toContain('纯聊天')
  })

  it('generate 命中时提示按生成流程执行（不引导成不用工具）', () => {
    expect(buildIntentHint('生成一只赛博朋克猫')).toContain('生成/改图')
  })

  it('判不出时返回空串 —— 调用方据此跳过注入，行为与改动前完全一致', () => {
    expect(buildIntentHint('帮我把这些节点连起来')).toBe('')
    expect(buildIntentHint('')).toBe('')
  })
})
