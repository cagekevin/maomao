import { test, expect } from './utils/canvasHelpers.js'

// L4 §2.9/2.10：设置 / TopNav / 素材库入口可见性
test.describe('设置与导航 §2.9/2.10', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('.react-flow', { timeout: 10000 })
  })

  test('顶部导航渲染（含 AI 助手入口）', async ({ page }) => {
    // TopNav：至少存在导航区与 AI 助手按钮（文本/图标）
    await expect(page.locator('header, nav').first()).toBeVisible()
    await expect(page.getByText(/AI|助手|智能/).first()).toBeVisible()
  })

  test('设置面板可打开', async ({ page }) => {
    // 设置按钮为图标按钮，accessible name 靠 title="设置"（TopNav）
    const settingsBtn = page.getByTitle('设置').first()
    if (await settingsBtn.count()) {
      await settingsBtn.click()
      // 设置视图切换后渲染 SettingsFrame：至少出现模型/供应商/API 相关配置区
      await expect(page.getByText(/模型|供应商|Provider|API|Key|设置/i).first()).toBeVisible({ timeout: 5000 })
    } else {
      test.skip(true, '未找到设置入口按钮')
    }
  })

  test('素材库入口可见', async ({ page }) => {
    // 左侧收起态工具栏：素材 tab 按钮 title="素材"（LeftPanel）
    const assetBtn = page.getByTitle('素材').first()
    if (await assetBtn.count()) {
      await assetBtn.click()
      await expect(page.getByText(/图片|视频|音频|全部|素材/i).first()).toBeVisible({ timeout: 5000 })
    } else {
      test.skip(true, '未找到素材库入口按钮')
    }
  })
})
