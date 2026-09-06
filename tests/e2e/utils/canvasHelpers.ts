import { test, expect } from '@playwright/test';
import type { Page, Locator } from '@playwright/test';

// L4 共用 helper：画布节点工厂、面板断言、清理
// 选择器基于真实 DOM（src/App.tsx + 节点组件）：
//   - 调色板按钮由 addNodeFromMenu 渲染，文本即节点名（文本/图片/视频/剧本盒子/...）
//   - React Flow 画布根 .react-flow，节点 .react-flow__node，连接 .react-flow__edge
//
// 更新(2026-09-02)：src 全 TS 化后本文件随 e2e 一起转 .ts，并补齐 Page/Locator 标注。
//  此前全部形参返回值为隐式 any——改 DOM 选择器/helper 签名时 tsc 一声不吭，只能等 playwright
//  跑起来才发现。现由 `tests/tsconfig.json` 纳入 `npm run type-check` 门禁。

// 通过「右键画布空白 → 上下文菜单 → 点击菜单项」新增节点。
// 这是应用唯一的常驻添加入口（QWE 快捷、顶部按钮最终都走 addNodeFromMenu，
// 而常驻 DOM 里节点添加项仅存在于右键上下文菜单）。
export async function addNodeByPalette(page: Page, label: string): Promise<void> {
  // 在画布中心右键打开上下文菜单（对齐 ReactFlow onPaneContextMenu）
  const pane = page.locator('.react-flow__pane').first();
  await pane.click({ button: 'right' });
  // 菜单项以 button 渲染，文本即 label（文本/图片/视频/剧本盒子…）
  const item = page.getByRole('button', { name: label, exact: true }).first();
  await expect(item).toBeVisible({ timeout: 5000 });
  await item.click();
  await page.waitForSelector('.react-flow__node', { timeout: 5000 });
}

// 新增节点并返回最后一个节点句柄
export async function lastNode(page: Page): Promise<Locator> {
  const nodes = page.locator('.react-flow__node');
  await expect(nodes.first()).toBeVisible();
  return nodes.last();
}

// 断言画布存在 N 个节点
export async function expectNodeCount(page: Page, n: number): Promise<void> {
  await expect(page.locator('.react-flow__node')).toHaveCount(n);
}

// 清空画布（选中全部 + Delete）—— 走键盘捷径，对齐 App 全局操作
export async function clearCanvas(page: Page): Promise<void> {
  await page.keyboard.press('Control+A');
  await page.keyboard.press('Delete');
  await page.waitForTimeout(150);
}

export { test, expect };
