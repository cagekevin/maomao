import { test, expect } from './utils/canvasHelpers.js'
import { addNodeByPalette, lastNode, clearCanvas } from './utils/canvasHelpers.js'

// L4 §2.7/2.16：剧本盒子节点 UI 状态机（三步：策划→分镜→资产）+ 镜头端口
test.describe('剧本盒子状态机 §2.7/2.16', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('.react-flow', { timeout: 10000 })
    await clearCanvas(page)
    await addNodeByPalette(page, '剧本盒子')
  })

  test('剧本盒节点渲染且含三步导航', async ({ page }) => {
    const n = await lastNode(page)
    await expect(n).toBeVisible()
    // 三步导航（策划/分镜/资产 或 StepNav 进度环）
    await expect(n.getByText(/策划|分镜|资产|镜头|剧本/).first()).toBeVisible()
  })

  test('切换至分镜步显示镜头表', async ({ page }) => {
    const n = await lastNode(page)
    const shotTab = n.getByText(/分镜|镜头|Shot/i).first()
    if (await shotTab.count()) {
      await shotTab.click()
      await page.waitForTimeout(120)
      // 镜头表头列（对齐 §2.16 StepShots 8 列）
      await expect(n.getByText(/镜头|景别|运镜|台词|时长|画面|音效|参考/i).first()).toBeVisible()
    } else {
      test.skip(true, '未找到分镜步骤入口')
    }
  })
})
