import { describe, expect, it } from 'vitest'
import * as actions from './actions'

// L1 回归：actions.tsx 里每个按钮组件都必须 forwardRef。
//
// 根因（2026-08-18 跑 decompose-ui 走查时抓到）：WorkbenchButton 是普通函数组件，
// 直接 return <button>，ref 被静默吞掉。而全仓 16 处 `<TooltipTrigger asChild>`（Radix）
// 靠给子组件传 ref 拿 DOM 节点定位气泡/管焦点——拿不到就气泡定位不准，dev 下刷
// 「Function components cannot be given refs」，生产不报警告但 ref 照样失效。
//
// 为什么按「模块全体导出」断言而不是列名单：这个模块是工作区按钮的唯一真相源，
// 里面每个导出都是按钮、都可能被塞进 asChild/被 focus()/被量尺寸。列名单会漏掉
// 以后新加的按钮——那这类 bug 就还能从新入口复发（P2 不算修到根因）。
const FORWARD_REF_TYPE = Symbol.for('react.forward_ref')

type MaybeComponent = { $$typeof?: symbol; displayName?: string }

describe('设计系统按钮转发 ref（P2 根因门）', () => {
  const componentEntries = Object.entries(actions as Record<string, unknown>).filter(
    ([, value]) => typeof value === 'function' || (typeof value === 'object' && value !== null && '$$typeof' in value),
  )

  it('actions.tsx 至少导出了按钮组件（防模块改名后空跑假绿）', () => {
    expect(componentEntries.length).toBeGreaterThanOrEqual(5)
  })

  it.each(componentEntries)('%s 是 forwardRef 组件', (name, value) => {
    const component = value as MaybeComponent
    expect(
      component.$$typeof,
      `${name} 没有转发 ref：Radix <TooltipTrigger asChild> 等消费方拿不到 DOM 节点，气泡定位/焦点管理会静默失效。\n` +
        `改法：export const ${name} = forwardRef<HTMLButtonElement, ${name}Props>(function ${name}(props, ref) { ... <button ref={ref} ... /> })`,
    ).toBe(FORWARD_REF_TYPE)
  })
})
