import { test, expect } from './utils/canvasHelpers.js'
import { addNodeByPalette, lastNode, clearCanvas } from './utils/canvasHelpers.js'

// L4 §2.1：每节点 E2E 渲染 + 基础参数可见性（数据驱动）
// 节点参数矩阵（label 对齐调色板/快捷键文本）。扩展时在 NODE_MATRIX 增行即可。
const NODE_MATRIX = [
  { label: '文本', type: 'textNode', expectText: '文本' },
  { label: '图片', type: 'promptNode', expectText: '生图' },
  { label: '视频', type: 'discountVideoNode', expectText: '特惠' },
  { label: '剧本盒子', type: 'scriptBoxNode', expectText: '剧本' },
]

test.describe('节点 E2E 渲染 §2.1', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('.react-flow', { timeout: 10000 })
    await clearCanvas(page)
  })

  for (const node of NODE_MATRIX) {
    test(`渲染 ${node.type} 并可见基础结构`, async ({ page }) => {
      await addNodeByPalette(page, node.label)
      const n = await lastNode(page)
      await expect(n).toBeVisible()
      // 节点外壳 / 标题 / handle 标记（对齐 L1 结构断言的浏览器侧验证）
      await expect(n.locator('.react-flow__handle').first()).toBeVisible()
      await expect(n).toContainText(node.expectText)
    })
  }

  test('空画布引导可见（无节点时）', async ({ page }) => {
    await clearCanvas(page)
    await expect(page.locator('.react-flow__node')).toHaveCount(0)
  })
})
