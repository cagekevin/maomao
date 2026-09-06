import { test, expect } from './utils/canvasHelpers';
import { addNodeByPalette, lastNode, clearCanvas, expectNodeCount } from './utils/canvasHelpers';

// L4 §2.2/2.3：画布交互 —— 新增 / 删除 / 选中 / 快捷键
test.describe('画布交互 §2.2/2.3', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.react-flow', { timeout: 10000 });
    await clearCanvas(page);
  });

  test('QWE 快捷键新增文本/图片/视频节点', async ({ page }) => {
    await page.keyboard.press('q'); // 文本
    await page.keyboard.press('w'); // 图片
    await page.keyboard.press('e'); // 视频
    await expectNodeCount(page, 3);
  });

  test('选中节点后 Delete 删除', async ({ page }) => {
    await addNodeByPalette(page, '文本');
    const n = await lastNode(page);
    await n.click();
    await page.keyboard.press('Delete');
    await page.waitForTimeout(150);
    await expectNodeCount(page, 0);
  });

  test('Ctrl+A 全选 + Delete 清空', async ({ page }) => {
    await addNodeByPalette(page, '文本');
    await addNodeByPalette(page, '图片');
    await clearCanvas(page);
    await expectNodeCount(page, 0);
  });

  test('节点拖拽改变位置（指针事件）', async ({ page }) => {
    await addNodeByPalette(page, '文本');
    const n = await lastNode(page);
    const box = await n.boundingBox();
    const target = { x: box.x + 120, y: box.y + 80 };
    await page.mouse.move(box.x + box.width / 2, box.y + 10);
    await page.mouse.down();
    await page.mouse.move(target.x, target.y, { steps: 8 });
    await page.mouse.up();
    await page.waitForTimeout(150);
    const box2 = await n.boundingBox();
    expect(Math.abs(box2.x - target.x)).toBeLessThan(60);
  });
});
