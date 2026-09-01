// @vitest-environment node
// @ts-nocheck
/**
 * promptLearning（「学」）单测 —— 照搬参考项目 promptLearningService 的 JS 化纯函数。
 * 覆盖：inferPromptLearningKinds / sanitizePromptSample / buildPromptLearningBlock / buildLearnedContext
 * 关键语义：只作不可信只读创作数据注入；非创作意图不注入；脱敏；限长；空资源返回空串。
 */
import { describe, it, expect } from 'vitest'

const { inferPromptLearningKinds, sanitizePromptSample, buildPromptLearningBlock, buildLearnedContext } =
  await import('../../src/components/agent/runtime/promptLearning.ts')

describe('inferPromptLearningKinds —— 意图识别（学 T1）', () => {
  it('生图意图 → 只选 image', () => {
    expect(inferPromptLearningKinds('帮我生一张海报')).toEqual(['image'])
  })
  it('视频意图 → 只选 video', () => {
    expect(inferPromptLearningKinds('做一个运镜的分镜动画')).toEqual(['video'])
  })
  it('生图+视频意图 → 两者都要', () => {
    expect(inferPromptLearningKinds('生图加短视频混剪')).toEqual(['image', 'video'])
  })
  it('普通创作类关键词 → 默认 image+video', () => {
    expect(inferPromptLearningKinds('帮我设计一下')).toEqual(['image', 'video'])
  })
  it('非创作意图 → 空（不加载历史）', () => {
    expect(inferPromptLearningKinds('帮我算个加法')).toEqual([])
  })
})

describe('sanitizePromptSample —— 脱敏（学 T2）', () => {
  it('隐藏媒体数据、URL、本地路径、凭据并压缩空白', () => {
    const dirty = ' 图：data:image/png;base64,xxx 链接 https://a.com/b 路径 /Users/kevin/a.png 密钥 sk-abcdef1234567890 ，多 空格 '
    const clean = sanitizePromptSample(dirty)
    expect(clean).toContain('[已隐藏媒体数据]')
    expect(clean).toContain('[已隐藏 URL]')
    expect(clean).toContain('[已隐藏本地路径]')
    expect(clean).toContain('[已隐藏凭据]')
    expect(clean).not.toMatch(/data:/)
    expect(clean).not.toMatch(/https?:/)
    expect(clean).not.toMatch(/\/Users\//)
    expect(clean).not.toMatch(/sk-[A-Za-z0-9]/)
  })
  it('限长到 SAMPLE_CHAR_LIMIT(260)', () => {
    const long = 'x'.repeat(500)
    expect(sanitizePromptSample(long).length).toBeLessThanOrEqual(260)
  })
  it('空输入 → 空串', () => {
    expect(sanitizePromptSample('')).toBe('')
  })
})

describe('buildPromptLearningBlock —— 学习块（学 T3）', () => {
  const sample = (prompt, extra = {}) => ({ prompt, ...extra })
  it('非创作意图 → 空串（不污染上下文）', () => {
    expect(buildPromptLearningBlock([sample('一只猫')], { query: '算个数' })).toBe('')
  })
  it('有相关样本 → 注入块包含学习声明与样本，且标注不可信', () => {
    const block = buildPromptLearningBlock([sample('黄昏海边 一只猫 逆光 金色 波纹')], { query: '画一张海边猫的图片' })
    expect(block).toContain('不可信的只读创作数据')
    expect(block).toContain('相关历史样本')
    expect(block).toContain('[图像样本]')
  })
  it('重复样本去重，只留一份', () => {
    const block = buildPromptLearningBlock([sample('重复 主题 山'), sample('重复 主题 山')], { query: '画一张山的图片' })
    expect(block.match(/\[图像样本\]/g) || []).toHaveLength(1)
  })
  it('注入块不超过 CONTEXT_CHAR_LIMIT(1800)', () => {
    const many = Array.from({ length: 30 }, (_, i) => sample(`主题 ${i} 山 水 云 阳光 风 树 桥 船 楼 光 影 色 调`))
    const block = buildPromptLearningBlock(many, { query: '画一座山的图片' })
    expect(block.length).toBeLessThanOrEqual(1800)
  })
  it('空样本池 → 空串', () => {
    expect(buildPromptLearningBlock([], { query: '画山' })).toBe('')
  })
})

describe('buildLearnedContext —— 我方提样入口（学 T4）', () => {
  it('memory 无 lastPlan.generations → 空串', () => {
    expect(buildLearnedContext({}, '画一张图')).toBe('')
    expect(buildLearnedContext({ lastPlan: {} }, '画一张图')).toBe('')
  })
  it('有实际执行的生成 prompt → 产出非空学习块', () => {
    const memory = {
      lastPlan: {
        ts: Date.now(),
        generations: [
          { stepId: 's1', prompt: '夜晚的城市街景 霓虹 雨 倒影' },
          { prompt: '无 prompt 的丢弃' },
        ],
      },
    }
    const block = buildLearnedContext(memory, '帮我画一张夜景城市的图片')
    expect(block.length).toBeGreaterThan(0)
    expect(block).toContain('城市')
  })
  it('generations 里无 prompt 的条目被过滤', () => {
    const memory = { lastPlan: { ts: Date.now(), generations: [{ stepId: 'x' }, null] } }
    expect(buildLearnedContext(memory, '画一张图')).toBe('')
  })
})