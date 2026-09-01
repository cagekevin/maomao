import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '../../src/components/nodes')

// 回归防护：确认四个节点的初始化已去掉「读记忆做回退」的写法，
// 记忆只由 App.addNode 注入新建节点，存量节点初始化只读 data + 纯常量。
// 若有人又把 `|| xxxPrefs.xxx` 加回来，本测试必红。
// 只写节点名（不带扩展名）：TS 规范化迁移期同一节点可能是 .jsx 或 .tsx，
// 由 resolveNodeFile 探测，避免每次改名都要改本测试。
const TARGETS = {
  PromptNode: ['imgPrefs'],
  TextNode: ['textPrefs'],
  TemplateNode: ['myPrefs'],
  DiscountVideoNode: ['vidPrefs'],
}

/** 按 .jsx → .tsx 顺序探测节点文件（迁移期两者皆可能存在） */
function resolveNodeFile(name) {
  for (const ext of ['.jsx', '.tsx']) {
    const p = resolve(root, name + ext)
    if (existsSync(p)) return p
  }
  throw new Error(`未找到节点文件：${name}.jsx / ${name}.tsx`)
}

describe('记忆回退回归防护（存量节点不得读记忆）', () => {
  for (const [name, prefVars] of Object.entries(TARGETS)) {
    it(`${name} 初始化不再用记忆做回退`, () => {
      const src = readFileSync(resolveNodeFile(name), 'utf8')
      for (const v of prefVars) {
        // 允许 prefs 变量仍被声明/传给 useGenerateNode/写记忆(set)，
        // 但禁止出现在 useState 初值的「|| 回退」位置。
        const bad = new RegExp(`\\?\\?\\s*${v}\\.\\w+|\\|\\|\\s*${v}\\.\\w+`)
        expect(bad.test(src), `${name} 仍含 ${v}.xxx 回退`).toBe(false)
      }
    })
  }
})
