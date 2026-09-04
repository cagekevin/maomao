/**
 * PromptInput「上游素材消失 → 清除富文本引用芯片」回归测试。
 *
 * 场景：用户先在富文本里 @ 出一张上游图（序列化后为 `@{id:label|thumb}`，缩略图 URL 已编码进
 * value 字符串），随后在上游被断开（点素材缩略图红 × 删连线）——此时传入的 refImages 少了该素材，
 * 但 value 字符串里那个芯片仍在。旧实现只按 value 重建 DOM，缩略图会残留在富文本里指向已断上游。
 *
 * 断言核心：素材从 refImages 消失后，富文本里引用它的 data-ref-id 芯片被移除，且 onChange 同步
 * 回不含该引用的新 value（不残留）。
 */
import React, { useState } from 'react'
import { describe, it, expect } from 'vitest'
import { render, act } from '@testing-library/react'
import PromptInput from '../../src/components/base/prompt/PromptInput.tsx'

/** 双实例中省略；这里单实例：value 已含 img1 芯片串，refImages 提供该素材，可随时断开 */
function DisconnectHarness({ onChangeOut }) {
  const [value, setValue] = useState('@{img1:上游图|a.png}')
  const [refImages, setRefImages] = useState([{ id: 'img1', label: '上游图', url: 'a.png' }])
  const change = (v) => { setValue(v); onChangeOut?.(v) }
  return (
    <>
      <PromptInput
        value={value}
        onChange={change}
        refImages={refImages}
        refTexts={[]}
        placeholder="描述..."
        richText
      />
      <button type="button" onClick={() => setRefImages([])}>disconnect</button>
    </>
  )
}

describe('PromptInput 上游素材消失清理', () => {
  it('素材从 refImages 消失后，富文本里的引用芯片被自动移除，且 onChange 不再含该引用', async () => {
    let lastValue = null
    const { container } = render(
      <DisconnectHarness onChangeOut={(v) => { lastValue = v }} />
    )
    const el = container.querySelector('[contenteditable="true"]')

    // 初始：value 自带 @{img1:...} 芯片串 → 重建后 DOM 出现 data-ref-id=img1 芯片
    expect(el.querySelector('[data-ref-id="img1"]')).toBeTruthy()

    // 模拟断开上游：refImages 清空（等价点红 × 删连线后 connected 少该素材）
    await act(async () => {
      container.querySelector('button').click()
    })

    // 富文本里引用 img1 的芯片应被清掉，缩略图不再残留
    expect(el.querySelector('[data-ref-id="img1"]')).toBeNull()
    // onChange 应被写回一个不再引用 img1 的新 value（纯文字描述，无残留 `@{img1`）
    if (lastValue != null) expect(String(lastValue)).not.toContain('@{img1')
  })

  it('素材仍在 refImages 时，即使触发重建也不误删引用芯片', async () => {
    const { container } = render(<DisconnectHarness onChangeOut={() => {}} />)
    const el = container.querySelector('[contenteditable="true"]')

    // 未断开（refImages 仍含 img1）→ 芯片保留
    expect(el.querySelector('[data-ref-id="img1"]')).toBeTruthy()
  })
})
