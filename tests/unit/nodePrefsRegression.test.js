import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '../../src/components/nodes')

// 回归防护：确认四个节点的初始化已去掉「读记忆做回退」的写法，
// 记忆只由 App.addNode 注入新建节点，存量节点初始化只读 data + 纯常量。
// 若有人又把 `|| xxxPrefs.xxx` 加回来，本测试必红。
const TARGETS = {
  'PromptNode.jsx': ['imgPrefs'],
  'TextNode.jsx': ['textPrefs'],
  'TemplateNode.jsx': ['myPrefs'],
  'DiscountVideoNode.jsx': ['vidPrefs'],
}

describe('记忆回退回归防护（存量节点不得读记忆）', () => {
  for (const [file, prefVars] of Object.entries(TARGETS)) {
    it(`${file} 初始化不再用记忆做回退`, () => {
      const src = readFileSync(resolve(root, file), 'utf8')
      for (const v of prefVars) {
        // 允许 prefs 变量仍被声明/传给 useGenerateNode/写记忆(set)，
        // 但禁止出现在 useState 初值的「|| 回退」位置。
        const bad = new RegExp(`\\?\\?\\s*${v}\\.\\w+|\\|\\|\\s*${v}\\.\\w+`)
        expect(bad.test(src), `${file} 仍含 ${v}.xxx 回退`).toBe(false)
      }
    })
  }
})
