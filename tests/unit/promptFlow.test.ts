// @ts-nocheck
import { describe, it, expect } from 'vitest'
import {
  normalizePrompts, ensureCurrentPrompt, confirmPrompt, editPrompt, savePromptEdit,
  cancelPromptEdit, reopenPrompt, confirmAllPrompts, advanceToNextOrGenerate, PROMPT_STATUS,
} from '../../src/components/base/promptFlow.ts'

const P = PROMPT_STATUS

describe('promptFlow · prompts 逐条确认状态机（对齐大雄 confirm/edit/save/reopen/confirm-all）', () => {
  it('normalizePrompts：兼容 string[] 与对象数组，缺省 status=pending', () => {
    const out = normalizePrompts(['猫', { prompt: '狗', count: 2, attachment_indices: [0] }, null, ''])
    expect(out).toHaveLength(2)
    expect(out[0]).toMatchObject({ prompt: '猫', status: P.PENDING })
    expect(out[1]).toMatchObject({ prompt: '狗', count: 2, attachment_indices: [0] })
  })

  it('ensureCurrentPrompt：无 current/editing 时把第一个 pending 置 current', () => {
    const out = ensureCurrentPrompt(normalizePrompts(['A', 'B']))
    expect(out[0].status).toBe(P.CURRENT)
    expect(out[1].status).toBe(P.PENDING)
  })

  it('confirmPrompt：确认当前 → 推进下一个 pending；未全确认返回 done=false', () => {
    const init = ensureCurrentPrompt(normalizePrompts(['A', 'B', 'C']))
    const r1 = confirmPrompt(init)
    expect(r1.prompts[0].status).toBe(P.CONFIRMED)
    expect(r1.prompts[1].status).toBe(P.CURRENT)
    expect(r1.done).toBe(false)
  })

  it('confirmPrompt 全确认后 done=true 并返回 generations', () => {
    let state = ensureCurrentPrompt(normalizePrompts(['A', 'B']))
    state = confirmPrompt(state).prompts
    const r = confirmPrompt(state)
    expect(r.done).toBe(true)
    expect(r.generations).toHaveLength(2)
    expect(r.generations.map((g) => g.prompt)).toEqual(['A', 'B'])
  })

  it('editPrompt / cancelPromptEdit：current → editing → current', () => {
    const init = ensureCurrentPrompt(normalizePrompts(['A']))
    const editing = editPrompt(init)
    expect(editing[0].status).toBe(P.EDITING)
    const back = cancelPromptEdit(editing)
    expect(back[0].status).toBe(P.CURRENT)
  })

  it('savePromptEdit：更新文本 + 确认；空文本报错', () => {
    const init = ensureCurrentPrompt(normalizePrompts(['A', 'B']))
    const editing = editPrompt(init)
    const r = savePromptEdit(editing, 0, '改成白猫')
    expect(r.prompts[0].prompt).toBe('改成白猫')
    expect(r.prompts[0].status).toBe(P.CONFIRMED)
    expect(r.prompts[1].status).toBe(P.CURRENT)
    const err = savePromptEdit(editing, 0, '   ')
    expect(err.error).toBeTruthy()
  })

  it('reopenPrompt：全部处理完后反悔某 confirmed 项 → 置为 current；有 current 时拒绝反悔', () => {
    let state = ensureCurrentPrompt(normalizePrompts(['A', 'B']))
    state = confirmPrompt(state).prompts // A confirmed, B current（有 current → 反悔被拒）
    expect(reopenPrompt(state, 0)[0].status).toBe(P.CONFIRMED) // 保持 confirmed，未反悔
    state = confirmPrompt(state).prompts // B confirmed，全部处理完（done）
    const reopened = reopenPrompt(state, 0) // 反悔 A
    expect(reopened[0].status).toBe(P.CURRENT) // A 变回 current
  })

  it('confirmAllPrompts：全 confirmed（保留 skipped）并返回 generations', () => {
    const init = normalizePrompts(['A', 'B', 'C']).map((p, i) => (i === 2 ? { ...p, status: P.SKIPPED } : p))
    const r = confirmAllPrompts(init)
    expect(r.done).toBe(true)
    expect(r.generations).toHaveLength(2) // skipped 的 C 不生成
    expect(r.generations.map((g) => g.prompt)).toEqual(['A', 'B'])
  })
})
